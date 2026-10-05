import { nextFrame } from './files'

export type MergeProgressFn = (value: number, message: string) => void

interface WasmOutputFile {
  name?: string
  data: Uint8Array | ArrayBuffer
}

interface WasmExecResult {
  files?: WasmOutputFile[]
  stdout?: string
  stderr?: string
  code?: number
}

interface MergeSourceBase {
  label: string
  count: number
  size: number
  fileIndices: number[]
}

interface BlobMergeSource extends MergeSourceBase {
  kind: 'blob'
  blob: Blob
}

interface OpfsMergeSource extends MergeSourceBase {
  kind: 'opfs'
  handle: any
  entryName: string
}

type MergeSource = BlobMergeSource | OpfsMergeSource

export interface LargeMergeResult {
  blob: Blob
  mergedFiles: number
  mergedFileIndices: number[]
  skippedFiles: string[]
  engine: 'qpdf-wasm-direct' | 'qpdf-wasm-batched' | 'qpdf-wasm-opfs'
}

const DIRECT_MAX_FILES = 48
const DIRECT_MAX_BYTES = 96 * 1024 * 1024
const INITIAL_GROUP_MAX_FILES = 20
const INITIAL_GROUP_MAX_BYTES = 20 * 1024 * 1024
const LARGE_JOB_FILES = 250
const LARGE_JOB_BYTES = 192 * 1024 * 1024
const PDF_HEADER = '%PDF-'
const QPDF_LOAD_TIMEOUT_MS = 45_000

function resultBytes(result: WasmExecResult): Uint8Array {
  const file = result.files?.[0]
  if (!file?.data) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(-1800)
    throw new Error(`qpdf não gerou o PDF mesclado.${details ? ` ${details}` : ''}`)
  }
  // IMPORTANT: do not clone a Uint8Array here. A final 500+ MB PDF would be
  // duplicated in RAM by `new Uint8Array(existingUint8Array)`.
  return file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data)
}

async function getSourceBlob(source: MergeSource): Promise<Blob> {
  if (source.kind === 'blob') return source.blob
  return await source.handle.getFile()
}

async function looksLikePdf(blob: Blob): Promise<boolean> {
  if (blob.size < 8) return false
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer())
  const text = new TextDecoder('latin1').decode(head)
  return text.includes(PDF_HEADER)
}

function safePath(index: number): string {
  return `/merge-${String(index + 1).padStart(5, '0')}.pdf`
}

function timeoutAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms)
  })
}

async function loadQpdf(onProgress?: (message: string) => void): Promise<any> {
  onProgress?.('Carregando motor qpdf WebAssembly…')
  await nextFrame()
  try {
    const qpdf = await Promise.race([
      (async () => {
        const mod = await import('@wasm-zoo/qpdf')
        onProgress?.('Inicializando qpdf WebAssembly…')
        await nextFrame()
        return await mod.load()
      })(),
      timeoutAfter(QPDF_LOAD_TIMEOUT_MS, 'O motor qpdf WebAssembly não respondeu em 45 segundos.'),
    ])
    return qpdf
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Falha desconhecida ao carregar qpdf.'
    throw new Error(`Não foi possível iniciar o motor de mesclagem local. ${detail} Tente Ctrl+F5 e execute novamente.`)
  }
}

class OpfsTempStore {
  private parent: any
  private dir: any
  private sessionName: string
  readonly enabled: boolean

  private constructor(parent: any, dir: any, sessionName: string, enabled: boolean) {
    this.parent = parent
    this.dir = dir
    this.sessionName = sessionName
    this.enabled = enabled
  }

  static async create(totalBytes: number, onProgress: MergeProgressFn): Promise<OpfsTempStore> {
    const storage = navigator.storage as any
    if (!storage?.getDirectory) {
      return new OpfsTempStore(null, null, '', false)
    }

    onProgress(1, 'Preparando armazenamento temporário local no dispositivo…')
    await nextFrame()

    try {
      const estimate = await navigator.storage.estimate().catch(() => ({} as StorageEstimate))
      const available = typeof estimate.quota === 'number' && typeof estimate.usage === 'number'
        ? Math.max(0, estimate.quota - estimate.usage)
        : null
      // During the first stage OPFS stores roughly one copy of the merged data.
      // Leave generous headroom for browser bookkeeping and the final qpdf pass.
      const recommendedFree = Math.max(384 * 1024 * 1024, Math.ceil(totalBytes * 1.35))
      if (available !== null && available < recommendedFree) {
        const needMb = Math.ceil(recommendedFree / 1024 / 1024)
        const freeMb = Math.floor(available / 1024 / 1024)
        throw new Error(`Espaço temporário insuficiente: ~${freeMb} MB livres; recomendamos pelo menos ${needMb} MB.`)
      }

      const root = await storage.getDirectory()
      const parent = await root.getDirectoryHandle('pdf-studio-merge-temp', { create: true })
      const sessionName = `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const dir = await parent.getDirectoryHandle(sessionName, { create: true })
      return new OpfsTempStore(parent, dir, sessionName, true)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'OPFS indisponível.'
      if (totalBytes >= LARGE_JOB_BYTES) {
        throw new Error(`A mesclagem de arquivos grandes precisa do armazenamento temporário do navegador (OPFS). ${detail}`)
      }
      return new OpfsTempStore(null, null, '', false)
    }
  }

  async persist(blob: Blob, label: string, count: number, fileIndices: number[], entryName: string): Promise<MergeSource> {
    if (!this.enabled) return { kind: 'blob', blob, label, count, fileIndices, size: blob.size }
    const handle = await this.dir.getFileHandle(entryName, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(blob)
    } finally {
      await writable.close()
    }
    return { kind: 'opfs', handle, entryName, label, count, fileIndices, size: blob.size }
  }

  async remove(source: MergeSource): Promise<void> {
    if (!this.enabled || source.kind !== 'opfs') return
    try { await this.dir.removeEntry(source.entryName) } catch { /* best effort */ }
  }

  scheduleCleanup(delayMs = 120_000): void {
    if (!this.enabled) return
    const parent = this.parent
    const sessionName = this.sessionName
    window.setTimeout(() => {
      Promise.resolve(parent.removeEntry(sessionName, { recursive: true })).catch(() => {})
    }, delayMs)
  }

  async cleanupNow(): Promise<void> {
    if (!this.enabled) return
    try { await this.parent.removeEntry(this.sessionName, { recursive: true }) } catch { /* best effort */ }
  }
}

async function qpdfMergeSources(sources: MergeSource[], onProgress?: (message: string) => void): Promise<Blob> {
  if (sources.length === 0) throw new Error('Nenhum PDF válido para mesclar.')
  if (sources.length === 1) return await getSourceBlob(sources[0])
  if (sources.length > INITIAL_GROUP_MAX_FILES && sources.every(s => s.count === 1)) {
    throw new Error(`Bloco grande demais para o modo seguro (${sources.length} PDFs).`)
  }

  const qpdf = await loadQpdf(onProgress)
  try {
    const staged: Array<{ name: string; data: Uint8Array }> = []
    const args: string[] = ['--keep-files-open=n', '--empty', '--pages']

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const path = safePath(i)
      const blob = await getSourceBlob(source)
      const data = new Uint8Array(await blob.arrayBuffer())
      staged.push({ name: path, data })
      args.push(path, '1-z')
      if (i % 4 === 0 || i === sources.length - 1) {
        onProgress?.(`Preparando lote: ${i + 1}/${sources.length} entrada(s)…`)
        await nextFrame()
      }
    }

    args.push('--', '/merged-output.pdf')
    onProgress?.(`Mesclando lote com ${sources.length} entrada(s)…`)
    await nextFrame()

    const result = await qpdf.exec(args, {
      files: staged,
      outputs: ['/merged-output.pdf'],
    }) as WasmExecResult

    const bytes = resultBytes(result)
    if (bytes.byteLength < 100) throw new Error('O PDF mesclado ficou vazio.')
    return new Blob([bytes], { type: 'application/pdf' })
  } finally {
    qpdf.dispose()
  }
}

async function qpdfValidateSource(source: MergeSource): Promise<boolean> {
  const qpdf = await loadQpdf()
  try {
    const blob = await getSourceBlob(source)
    const data = new Uint8Array(await blob.arrayBuffer())
    const result = await qpdf.exec([
      '/probe-input.pdf',
      '--warning-exit-0',
      '/probe-output.pdf',
    ], {
      files: [{ name: '/probe-input.pdf', data }],
      outputs: ['/probe-output.pdf'],
    }) as WasmExecResult
    const bytes = resultBytes(result)
    return bytes.byteLength >= 100
  } catch {
    return false
  } finally {
    qpdf.dispose()
  }
}

function groupSources(sources: MergeSource[]): MergeSource[][] {
  const groups: MergeSource[][] = []
  let current: MergeSource[] = []
  let bytes = 0

  for (const source of sources) {
    const wouldOverflow = current.length > 0 && (
      current.length >= INITIAL_GROUP_MAX_FILES ||
      bytes + source.size > INITIAL_GROUP_MAX_BYTES
    )
    if (wouldOverflow) {
      groups.push(current)
      current = []
      bytes = 0
    }
    current.push(source)
    bytes += source.size
  }
  if (current.length) groups.push(current)
  return groups
}

async function mergeGroupResilient(
  sources: MergeSource[],
  skipped: string[],
  onProgress?: (message: string) => void,
): Promise<MergeSource | null> {
  if (sources.length === 0) return null
  if (sources.length === 1) {
    const source = sources[0]
    const blob = await getSourceBlob(source)
    if (!(await looksLikePdf(blob))) {
      skipped.push(source.label)
      return null
    }
    if (await qpdfValidateSource(source)) return source
    skipped.push(source.label)
    return null
  }

  try {
    const blob = await qpdfMergeSources(sources, onProgress)
    return {
      kind: 'blob',
      blob,
      size: blob.size,
      label: `${sources[0].label} … ${sources[sources.length - 1].label}`,
      count: sources.reduce((sum, item) => sum + item.count, 0),
      fileIndices: sources.flatMap(item => item.fileIndices),
    }
  } catch {
    if (sources.length <= 2) {
      const valid: MergeSource[] = []
      for (const source of sources) {
        try {
          const blob = await getSourceBlob(source)
          if (!(await looksLikePdf(blob))) throw new Error('Cabeçalho inválido')
          if (!(await qpdfValidateSource(source))) throw new Error('PDF inválido, protegido ou incompatível')
          valid.push(source)
        } catch {
          skipped.push(source.label)
        }
      }
      if (valid.length === 0) return null
      if (valid.length === 1) return valid[0]
      const blob = await qpdfMergeSources(valid, onProgress)
      return {
        kind: 'blob', blob, size: blob.size,
        label: `${valid[0].label} … ${valid[valid.length - 1].label}`,
        count: valid.reduce((s, x) => s + x.count, 0),
        fileIndices: valid.flatMap(item => item.fileIndices),
      }
    }

    const middle = Math.ceil(sources.length / 2)
    const left = await mergeGroupResilient(sources.slice(0, middle), skipped, onProgress)
    const right = await mergeGroupResilient(sources.slice(middle), skipped, onProgress)
    const survivors = [left, right].filter((x): x is MergeSource => Boolean(x))
    if (survivors.length === 0) return null
    if (survivors.length === 1) return survivors[0]
    const blob = await qpdfMergeSources(survivors, onProgress)
    return {
      kind: 'blob', blob, size: blob.size,
      label: `${survivors[0].label} … ${survivors[survivors.length - 1].label}`,
      count: survivors.reduce((s, x) => s + x.count, 0),
      fileIndices: survivors.flatMap(item => item.fileIndices),
    }
  }
}

async function mergeDirect(files: File[], onProgress: MergeProgressFn): Promise<LargeMergeResult> {
  const sources: MergeSource[] = []
  const skipped: string[] = []
  onProgress(3, `Validando ${files.length.toLocaleString('pt-BR')} PDFs…`)
  await nextFrame()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size < 8 || !(await looksLikePdf(file))) skipped.push(file.name)
    else sources.push({ kind: 'blob', blob: file, size: file.size, label: file.name, count: 1, fileIndices: [i] })
    if (i % 10 === 0 || i === files.length - 1) {
      onProgress(3 + Math.round(((i + 1) / files.length) * 17), `Validando arquivos: ${i + 1}/${files.length}…`)
      await nextFrame()
    }
  }

  if (sources.length < 2) throw new Error('Não há pelo menos 2 PDFs válidos para mesclar.')
  onProgress(25, `Mesclando ${sources.length.toLocaleString('pt-BR')} PDFs…`)
  const blob = await qpdfMergeSources(sources, message => onProgress(40, message))
  onProgress(100, 'Mesclagem concluída.')
  return { blob, mergedFiles: sources.length, mergedFileIndices: sources.flatMap(source => source.fileIndices), skippedFiles: skipped, engine: 'qpdf-wasm-direct' }
}

async function mergeBatched(files: File[], onProgress: MergeProgressFn): Promise<LargeMergeResult> {
  const skipped: string[] = []
  const sources: MergeSource[] = []
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const store = await OpfsTempStore.create(totalBytes, onProgress)

  if (!store.enabled && (files.length >= LARGE_JOB_FILES || totalBytes >= LARGE_JOB_BYTES)) {
    throw new Error('O navegador não disponibilizou armazenamento temporário local (OPFS), necessário para esta mesclagem grande. Use Chrome/Edge atualizado e tente novamente.')
  }

  try {
    onProgress(2, store.enabled
      ? `Modo Ultra ativado: ${files.length.toLocaleString('pt-BR')} PDFs serão processados em lotes e intermediários ficarão temporariamente no disco.`
      : `Modo seguro ativado: preparando ${files.length.toLocaleString('pt-BR')} PDFs em lotes pequenos…`)
    await nextFrame()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size < 8 || !(await looksLikePdf(file))) skipped.push(file.name)
      else sources.push({ kind: 'blob', blob: file, size: file.size, label: file.name, count: 1, fileIndices: [i] })
      if (i % 20 === 0 || i === files.length - 1) {
        onProgress(2 + Math.round(((i + 1) / files.length) * 10), `Pré-validando: ${i + 1}/${files.length}…`)
        await nextFrame()
      }
    }

    if (sources.length < 2) throw new Error('Não há pelo menos 2 PDFs válidos para mesclar.')

    const groups = groupSources(sources)
    let level: MergeSource[] = []

    for (let i = 0; i < groups.length; i++) {
      const pct = 13 + Math.round((i / Math.max(1, groups.length)) * 47)
      onProgress(pct, `Lote ${i + 1}/${groups.length}: mesclando ${groups[i].length} PDF(s)…`)
      const merged = await mergeGroupResilient(groups[i], skipped, message => onProgress(pct, `Lote ${i + 1}/${groups.length} • ${message}`))
      if (merged) {
        const blob = await getSourceBlob(merged)
        const persisted = await store.persist(blob, merged.label, merged.count, merged.fileIndices, `nivel-0-${String(i + 1).padStart(4, '0')}.pdf`)
        level.push(persisted)
      }
      await nextFrame()
    }

    if (level.length === 0) throw new Error('Nenhum lote pôde ser mesclado.')

    const initialLevelCount = level.length
    let consolidated = 0
    const totalConsolidations = Math.max(1, initialLevelCount - 1)
    let round = 0

    while (level.length > 1) {
      round++
      const next: MergeSource[] = []
      const totalPairs = Math.ceil(level.length / 2)
      for (let i = 0, pair = 0; i < level.length; i += 2, pair++) {
        if (i + 1 >= level.length) {
          next.push(level[i])
          continue
        }

        const pct = 61 + Math.min(37, Math.round((consolidated / totalConsolidations) * 37))
        onProgress(pct, `Consolidando: rodada ${round}, bloco ${pair + 1}/${totalPairs}…`)
        const left = level[i]
        const right = level[i + 1]
        const mergedBlob = await qpdfMergeSources([left, right], message => onProgress(pct, `Consolidando rodada ${round} • ${message}`))
        const persisted = await store.persist(
          mergedBlob,
          `${left.label} … ${right.label}`,
          left.count + right.count,
          [...left.fileIndices, ...right.fileIndices],
          `nivel-${round}-${String(pair + 1).padStart(4, '0')}.pdf`,
        )
        next.push(persisted)
        consolidated++

        await store.remove(left)
        await store.remove(right)
        await nextFrame()
      }
      level = next
    }

    const final = level[0]
    const finalBlob = await getSourceBlob(final)
    if (finalBlob.size < 100) throw new Error('O PDF final ficou vazio e foi bloqueado.')
    onProgress(100, 'Mesclagem massiva concluída. Preparando download…')

    // Keep the OPFS session alive long enough for the browser download to consume
    // the File-backed Blob. It is removed automatically after two minutes.
    store.scheduleCleanup()
    return {
      blob: finalBlob,
      mergedFiles: final.count,
      mergedFileIndices: final.fileIndices,
      skippedFiles: skipped,
      engine: store.enabled ? 'qpdf-wasm-opfs' : 'qpdf-wasm-batched',
    }
  } catch (error) {
    await store.cleanupNow()
    throw error
  }
}

export async function mergeManyPdfs(files: File[], onProgress: MergeProgressFn): Promise<LargeMergeResult> {
  if (files.length < 2) throw new Error('Selecione pelo menos 2 PDFs.')
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const safeForDirect = files.length <= DIRECT_MAX_FILES && totalBytes <= DIRECT_MAX_BYTES
  return safeForDirect ? mergeDirect(files, onProgress) : mergeBatched(files, onProgress)
}
