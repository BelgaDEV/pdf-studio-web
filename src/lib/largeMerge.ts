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

interface MergeSource {
  blob: Blob
  label: string
  count: number
}

export interface LargeMergeResult {
  blob: Blob
  mergedFiles: number
  skippedFiles: string[]
  engine: 'qpdf-wasm-direct' | 'qpdf-wasm-batched'
}

const DIRECT_MAX_BYTES = 256 * 1024 * 1024
const INITIAL_GROUP_MAX_BYTES = 64 * 1024 * 1024
const INITIAL_GROUP_MAX_FILES = 40
const PDF_HEADER = '%PDF-'

function resultBytes(result: WasmExecResult): Uint8Array {
  const file = result.files?.[0]
  if (!file?.data) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(-1800)
    throw new Error(`qpdf não gerou o PDF mesclado.${details ? ` ${details}` : ''}`)
  }
  return file.data instanceof Uint8Array ? new Uint8Array(file.data) : new Uint8Array(file.data)
}

async function looksLikePdf(blob: Blob): Promise<boolean> {
  if (blob.size < 8) return false
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer())
  const text = String.fromCharCode(...head)
  return text.includes(PDF_HEADER)
}

function safePath(index: number): string {
  return `/merge-${String(index + 1).padStart(5, '0')}.pdf`
}

async function qpdfMergeSources(sources: MergeSource[], onProgress?: (message: string) => void): Promise<Blob> {
  if (sources.length === 0) throw new Error('Nenhum PDF válido para mesclar.')
  if (sources.length === 1) return sources[0].blob

  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    const files: Array<{ name: string; data: Uint8Array }> = []
    const args: string[] = ['--empty', '--pages']

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const path = safePath(i)
      const data = new Uint8Array(await source.blob.arrayBuffer())
      files.push({ name: path, data })
      args.push(path, '1-z')
      if (i % 10 === 0) {
        onProgress?.(`Preparando bloco: ${i + 1}/${sources.length} PDF(s)…`)
        await nextFrame()
      }
    }

    args.push('--', '/merged-output.pdf')
    onProgress?.(`Mesclando bloco com ${sources.length} PDF(s) via qpdf…`)
    await nextFrame()

    const result = await qpdf.exec(args, {
      files,
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
  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    const data = new Uint8Array(await source.blob.arrayBuffer())
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
      bytes + source.blob.size > INITIAL_GROUP_MAX_BYTES
    )
    if (wouldOverflow) {
      groups.push(current)
      current = []
      bytes = 0
    }
    current.push(source)
    bytes += source.blob.size
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
    if (!(await looksLikePdf(source.blob))) {
      skipped.push(source.label)
      return null
    }
    // Uma fonte isolada só é validada estruturalmente quando qpdf realmente precisa lê-la.
    if (await qpdfValidateSource(source)) return source
    skipped.push(source.label)
    return null
  }

  try {
    const blob = await qpdfMergeSources(sources, onProgress)
    return {
      blob,
      label: `${sources[0].label} … ${sources[sources.length - 1].label}`,
      count: sources.reduce((sum, item) => sum + item.count, 0),
    }
  } catch (error) {
    // Um único arquivo problemático não deve derrubar uma mesclagem com milhares.
    // Dividimos o grupo até isolar a origem da falha. Também ajuda quando o grupo
    // ficou grande demais para a memória disponível do navegador.
    if (sources.length <= 2) {
      const valid: MergeSource[] = []
      for (const source of sources) {
        try {
          if (!(await looksLikePdf(source.blob))) throw new Error('Cabeçalho inválido')
          if (!(await qpdfValidateSource(source))) throw new Error('PDF inválido, protegido ou incompatível')
          valid.push(source)
        } catch {
          skipped.push(source.label)
        }
      }
      if (valid.length === 0) return null
      if (valid.length === 1) return valid[0]
      const blob = await qpdfMergeSources(valid, onProgress)
      return { blob, label: `${valid[0].label} … ${valid[valid.length - 1].label}`, count: valid.reduce((s, x) => s + x.count, 0) }
    }

    const middle = Math.ceil(sources.length / 2)
    const left = await mergeGroupResilient(sources.slice(0, middle), skipped, onProgress)
    const right = await mergeGroupResilient(sources.slice(middle), skipped, onProgress)
    const survivors = [left, right].filter((x): x is MergeSource => Boolean(x))
    if (survivors.length === 0) return null
    if (survivors.length === 1) return survivors[0]
    const blob = await qpdfMergeSources(survivors, onProgress)
    return { blob, label: `${survivors[0].label} … ${survivors[survivors.length - 1].label}`, count: survivors.reduce((s, x) => s + x.count, 0) }
  }
}

async function mergeDirect(files: File[], onProgress: MergeProgressFn): Promise<LargeMergeResult> {
  onProgress(2, `Preparando ${files.length.toLocaleString('pt-BR')} PDFs para mesclagem massiva…`)
  await nextFrame()

  const sources: MergeSource[] = []
  const skipped: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size < 8 || !(await looksLikePdf(file))) {
      skipped.push(file.name)
    } else {
      sources.push({ blob: file, label: file.name, count: 1 })
    }
    if (i % 25 === 0 || i === files.length - 1) {
      onProgress(2 + Math.round(((i + 1) / files.length) * 18), `Validando arquivos: ${i + 1}/${files.length}…`)
      await nextFrame()
    }
  }

  if (sources.length < 2) throw new Error('Não há pelo menos 2 PDFs válidos para mesclar.')

  try {
    onProgress(24, `qpdf carregado. Mesclando ${sources.length.toLocaleString('pt-BR')} PDFs…`)
    const blob = await qpdfMergeSources(sources, message => onProgress(28, message))
    onProgress(100, 'Mesclagem massiva concluída.')
    return { blob, mergedFiles: sources.length, skippedFiles: skipped, engine: 'qpdf-wasm-direct' }
  } catch {
    // Se um arquivo corrompido/protegido derrubar a execução direta, passamos
    // automaticamente ao modo por blocos, que consegue isolar o problema.
    return mergeBatched(files, onProgress)
  }
}

async function mergeBatched(files: File[], onProgress: MergeProgressFn, initialSkipped: string[] = []): Promise<LargeMergeResult> {
  const skipped = [...initialSkipped]
  const skipSet = new Set(skipped)
  const sources: MergeSource[] = []

  onProgress(3, `Ativando modo por blocos para ${files.length.toLocaleString('pt-BR')} PDFs…`)
  await nextFrame()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (skipSet.has(file.name)) continue
    if (file.size < 8 || !(await looksLikePdf(file))) {
      skipped.push(file.name)
      skipSet.add(file.name)
    } else {
      sources.push({ blob: file, label: file.name, count: 1 })
    }
    if (i % 25 === 0 || i === files.length - 1) {
      onProgress(3 + Math.round(((i + 1) / files.length) * 12), `Pré-validando: ${i + 1}/${files.length}…`)
      await nextFrame()
    }
  }

  if (sources.length < 2) throw new Error('Não há pelo menos 2 PDFs válidos para mesclar.')

  const groups = groupSources(sources)
  let level: MergeSource[] = []

  for (let i = 0; i < groups.length; i++) {
    const start = 16 + Math.round((i / Math.max(1, groups.length)) * 44)
    onProgress(start, `Bloco ${i + 1}/${groups.length}: ${groups[i].length} PDF(s)…`)
    const merged = await mergeGroupResilient(groups[i], skipped, message => onProgress(Math.min(59, start + 1), message))
    if (merged) level.push(merged)
    await nextFrame()
  }

  if (level.length === 0) throw new Error('Nenhum bloco pôde ser mesclado.')

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
      const progress = 61 + Math.min(34, Math.round(((pair + 1) / totalPairs) * 34))
      onProgress(progress, `Consolidando resultado: rodada ${round}, bloco ${pair + 1}/${totalPairs}…`)
      const merged = await qpdfMergeSources([level[i], level[i + 1]])
      next.push({
        blob: merged,
        label: `${level[i].label} … ${level[i + 1].label}`,
        count: level[i].count + level[i + 1].count,
      })
      // Remove referências grandes já consumidas antes de seguir.
      level[i] = { blob: new Blob(), label: '', count: 0 }
      level[i + 1] = { blob: new Blob(), label: '', count: 0 }
      await nextFrame()
    }
    level = next
  }

  const final = level[0]
  if (final.blob.size < 100) throw new Error('O PDF final ficou vazio e foi bloqueado.')
  onProgress(100, 'Mesclagem massiva concluída.')
  return { blob: final.blob, mergedFiles: final.count, skippedFiles: skipped, engine: 'qpdf-wasm-batched' }
}

export async function mergeManyPdfs(files: File[], onProgress: MergeProgressFn): Promise<LargeMergeResult> {
  if (files.length < 2) throw new Error('Selecione pelo menos 2 PDFs.')
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)

  // Milhares de arquivos pequenos funcionam melhor em uma única execução qpdf.
  // Acima do limite de staging, usamos a árvore de blocos para manter o pico de memória previsível.
  if (totalBytes <= DIRECT_MAX_BYTES) {
    return mergeDirect(files, onProgress)
  }
  return mergeBatched(files, onProgress)
}
