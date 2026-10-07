import { PDFDocument } from 'pdf-lib'
import type { PdfBookmarkSpec } from './bookmarks'
import type { LargeMergeResult } from './largeMerge'
import { nextFrame } from './files'

export type CompressionMode = 'smart'|'basic'|'medium'|'high'|'maximum'|'target'
export type PresetCompressionMode = Exclude<CompressionMode, 'target'>
export type ProgressFn = (value: number, message: string) => void

const profiles = {
  medium: { dpi: 160, quality: 0.82 },
  high: { dpi: 120, quality: 0.68 },
  maximum: { dpi: 96, quality: 0.50 },
} as const

async function loadPdfJs(file: File | Uint8Array) {
  // PDF.js é carregado apenas quando uma operação realmente precisa renderizar
  // ou inspecionar páginas. Isso evita baixar o worker na Home/ferramentas leves.
  const { loadPdfJsDocument } = await import('./pdfjsSecure')
  const data = file instanceof File
    ? new Uint8Array(await file.arrayBuffer())
    : new Uint8Array(file)
  return loadPdfJsDocument(data)
}

async function destroyPdfJs(pdf: unknown) {
  const { destroyPdfJsDocument } = await import('./pdfjsSecure')
  await destroyPdfJsDocument(pdf as any)
}

function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 100) return false
  const limit = Math.min(bytes.byteLength, 1024)
  let head = ''
  for (let i = 0; i < limit; i++) head += String.fromCharCode(bytes[i])
  return head.includes('%PDF-')
}

function ensureValidPdfBytes(bytes: Uint8Array, label = 'PDF gerado'): Uint8Array {
  if (!bytes || bytes.byteLength < 100 || !looksLikePdf(bytes)) {
    throw new Error(`${label} ficou vazio ou inválido. O download foi bloqueado para proteger seu arquivo.`)
  }
  return bytes
}

async function ensurePdfPageCount(bytes: Uint8Array, expectedPages: number): Promise<void> {
  const pdf = await loadPdfJs(bytes)
  try {
    if (pdf.numPages !== expectedPages) {
      throw new Error(`Validação falhou: o original tem ${expectedPages} páginas e o resultado tem ${pdf.numPages}. O download foi bloqueado.`)
    }
  } finally {
    await destroyPdfJs(pdf)
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Falha ao converter página em JPEG.')), 'image/jpeg', quality))
}

export async function compressPdf(file: File, mode: CompressionMode, onProgress: ProgressFn) {
  onProgress(2, 'Analisando o documento…')
  if (mode === 'target') {
    throw new Error('Use compressPdfToTarget() para o modo Por tamanho.')
  }
  const { ghostscriptCompressWasm, qpdfOptimizeWasm } = await import('./wasmCompression')
  let selected: PresetCompressionMode = mode
  let analysis: { pages:number; textChars:number; avgBytesPerPage:number; recommended: PresetCompressionMode } | null = null
  if (mode === 'smart') {
    const { inspectPdf } = await import('./pdfPreview')
    analysis = await inspectPdf(file)
    selected = analysis.recommended
    const label = selected === 'basic' ? 'Básico' : selected === 'medium' ? 'Médio' : selected === 'high' ? 'Alto' : 'Máximo'
    onProgress(6, `Modo Inteligente escolheu: ${label}`)
  }

  const original = new Uint8Array(await file.arrayBuffer())
  const originalSize = file.size
  ensureValidPdfBytes(original, 'PDF original')

  // O modo Básico usa qpdf real compilado para WebAssembly. Diferente do
  // pdf-lib, ele recompõe streams Flate, gera object streams e remove
  // recursos não referenciados sem rasterizar as páginas.
  if (selected === 'basic') {
    try {
      const optimized = await qpdfOptimizeWasm(original, onProgress)
      ensureValidPdfBytes(optimized, 'PDF otimizado')
      const candidate = optimized.byteLength < originalSize ? optimized : original
      onProgress(100, 'Concluído.')
      return { bytes: candidate, mode: selected, engine: 'qpdf-wasm', rasterized: false }
    } catch (error) {
      // Fallback seguro: nunca bloqueamos o usuário se o WASM não carregar.
      console.warn('qpdf WASM indisponível; usando fallback estrutural.', error)
      const doc = await PDFDocument.load(original, { updateMetadata: false })
      onProgress(60, 'Aplicando otimização estrutural de compatibilidade…')
      const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
      const candidate = bytes.byteLength >= 100 && bytes.byteLength < originalSize ? bytes : original
      ensureValidPdfBytes(candidate)
      onProgress(100, 'Concluído.')
      return { bytes: candidate, mode: selected, engine: 'pdf-lib-fallback', rasterized: false }
    }
  }

  // Médio/Alto/Máximo passam pelo Ghostscript real em WebAssembly e, na
  // sequência, por qpdf. É a mesma arquitetura do aplicativo desktop:
  // recompressão de imagens/fontes + otimização estrutural.
  try {
    const gsProfile = selected as 'medium' | 'high' | 'maximum'
    let best = await ghostscriptCompressWasm(original, gsProfile, onProgress, 12, 76)
    ensureValidPdfBytes(best, 'PDF recompresso')

    try {
      onProgress(80, 'Aplicando otimização estrutural final com qpdf…')
      const optimized = await qpdfOptimizeWasm(best, (value, message) => {
        const mapped = 80 + Math.round((Math.max(12, value) - 12) / 82 * 15)
        onProgress(Math.min(95, Math.max(80, mapped)), message)
      })
      if (looksLikePdf(optimized) && optimized.byteLength < best.byteLength) best = optimized
    } catch (error) {
      console.warn('qpdf pós-processamento indisponível; mantendo saída Ghostscript.', error)
    }

    // No Máximo, se a primeira passada ainda economizar muito pouco,
    // executamos uma segunda passada extrema. Ela continua preservando
    // texto/vetores pelo pdfwrite, mas baixa imagens para 72 DPI/JPEG 35.
    if (selected === 'maximum' && best.byteLength > originalSize * 0.94) {
      onProgress(50, 'Máximo: tentando uma segunda passagem mais agressiva…')
      const extreme = await ghostscriptCompressWasm(original, 'extreme', onProgress, 52, 86)
      if (looksLikePdf(extreme) && extreme.byteLength < best.byteLength) {
        best = extreme
        try {
          const optimizedExtreme = await qpdfOptimizeWasm(extreme, (value, message) => {
            const mapped = 87 + Math.round((Math.max(12, value) - 12) / 82 * 8)
            onProgress(Math.min(95, Math.max(87, mapped)), message)
          })
          if (looksLikePdf(optimizedExtreme) && optimizedExtreme.byteLength < best.byteLength) best = optimizedExtreme
        } catch {}
      }
    }

    // Último recurso do modo Máximo: se até Ghostscript não conseguir
    // reduzir pelo menos alguns pontos percentuais (comum em PDFs já muito
    // otimizados), usamos rasterização adaptativa para priorizar TAMANHO.
    // Esse fallback é deliberadamente exclusivo do Máximo, pois remove a
    // camada de texto selecionável. A interface deixa isso explícito.
    if (selected === 'maximum' && best.byteLength >= originalSize * 0.98) {
      onProgress(8, 'PDF já está muito otimizado. Ativando redução visual extrema…')
      const raster = await adaptiveRasterCompress(file, originalSize, onProgress)
      if (looksLikePdf(raster) && raster.byteLength < best.byteLength) {
        best = raster
        onProgress(96, 'Redução visual extrema concluída.')
        const candidate = best.byteLength < originalSize ? best : original
        ensureValidPdfBytes(candidate)
        onProgress(100, 'Concluído.')
        return { bytes: candidate, mode: selected, engine: 'adaptive-raster', rasterized: candidate !== original }
      }
    }

    const candidate = best.byteLength >= 100 && best.byteLength < originalSize ? best : original
    ensureValidPdfBytes(candidate)
    onProgress(100, 'Concluído.')
    return { bytes: candidate, mode: selected, engine: 'ghostscript-wasm + qpdf-wasm', rasterized: false }
  } catch (error) {
    // Nunca escondemos a falha do WASM. Registramos o motivo e partimos para
    // um compressor visual adaptativo que TEM meta de tamanho por página.
    // Isso mantém o site funcional mesmo quando o browser/CDN não consegue
    // inicializar o Ghostscript. O trade-off é rasterizar as páginas.
    const diagnostic = error instanceof Error ? error.message : String(error)
    console.warn('Motor WASM avançado falhou; ativando fallback adaptativo.', error)
    onProgress(5, 'Motor avançado indisponível. Ativando compressão adaptativa local…')

    const fallback = await compatibilityRasterCompress(
      file,
      selected as 'medium' | 'high' | 'maximum',
      originalSize,
      onProgress,
    )
    ensureValidPdfBytes(fallback, 'PDF de compatibilidade')

    const candidate = fallback.byteLength < originalSize ? fallback : original
    onProgress(100, candidate === original ? 'Concluído sem redução.' : 'Concluído com fallback adaptativo.')
    return {
      bytes: candidate,
      mode: selected,
      engine: 'adaptive-raster-fallback',
      rasterized: candidate !== original,
      diagnostic,
    }
  }
}


const MIB = 1024 * 1024
const TARGET_TOLERANCE = 1.0

function rangedProgress(
  start: number,
  end: number,
  onProgress: ProgressFn,
  prefix?: string,
): ProgressFn {
  return (value, message) => {
    const normalized = Math.max(0, Math.min(100, value)) / 100
    const mapped = start + Math.round((end - start) * normalized)
    onProgress(mapped, prefix ? `${prefix}: ${message}` : message)
  }
}

function targetProfileOrder(ratio: number): Array<'medium' | 'high' | 'maximum' | 'extreme'> {
  if (ratio >= 0.72) return ['medium', 'high', 'maximum', 'extreme']
  if (ratio >= 0.52) return ['high', 'maximum', 'extreme']
  if (ratio >= 0.34) return ['maximum', 'extreme']
  return ['extreme']
}

/**
 * Comprime buscando um tamanho máximo escolhido pelo usuário.
 *
 * Estratégia:
 * 1) qpdf estrutural, sem perda visual;
 * 2) Ghostscript em perfis progressivamente mais fortes, preservando texto/vetores;
 * 3) apenas se necessário, rasterização adaptativa com orçamento de bytes/página.
 *
 * O resultado só é marcado como "Meta atingida" quando fica realmente menor
 * ou igual ao limite escolhido pelo usuário.
 */
export async function compressPdfToTarget(
  file: File,
  targetMb: number,
  onProgress: ProgressFn,
) {
  const { ghostscriptCompressWasm, qpdfOptimizeWasm } = await import('./wasmCompression')
  if (!Number.isFinite(targetMb) || targetMb <= 0) {
    throw new Error('Informe um tamanho alvo válido em MB.')
  }

  const targetBytes = Math.floor(targetMb * MIB)
  const originalSize = file.size
  if (targetBytes >= originalSize) {
    throw new Error(`A meta precisa ser menor que o arquivo original (${(originalSize / MIB).toFixed(1)} MB).`)
  }

  onProgress(2, 'Analisando o PDF e calculando a meta…')
  const { inspectPdf } = await import('./pdfPreview')
  const analysis = await inspectPdf(file)
  const original = new Uint8Array(await file.arrayBuffer())
  ensureValidPdfBytes(original, 'PDF original')

  // Evita metas absurdamente baixas que gerariam páginas ilegíveis ou um PDF
  // estruturalmente impossível. O valor é conservador e proporcional às páginas.
  const minimumTargetBytes = Math.max(512 * 1024, analysis.pages * 7_000 + 120_000)
  if (targetBytes < minimumTargetBytes) {
    throw new Error(
      `Meta muito baixa para ${analysis.pages} páginas. Tente pelo menos ${(minimumTargetBytes / MIB).toFixed(1)} MB para preservar legibilidade.`,
    )
  }

  const targetRatio = targetBytes / originalSize
  let best = original
  let engine = 'original'
  let rasterized = false
  const attempts: string[] = []

  // 1) Otimização estrutural sem perda. Pode bastar quando a meta está próxima.
  try {
    const structural = await qpdfOptimizeWasm(original, rangedProgress(4, 13, onProgress, 'Otimização estrutural'))
    if (looksLikePdf(structural) && structural.byteLength < best.byteLength) {
      best = structural
      engine = 'qpdf-wasm'
      attempts.push(`qpdf ${(best.byteLength / MIB).toFixed(1)} MB`)
    }
    if (best.byteLength <= targetBytes * TARGET_TOLERANCE) {
      await ensurePdfPageCount(best, analysis.pages)
      onProgress(100, 'Meta atingida preservando texto e vetores.')
      return {
        bytes: best,
        mode: 'target' as const,
        engine,
        rasterized,
        targetBytes,
        targetReached: best.byteLength <= targetBytes * TARGET_TOLERANCE,
        attempts,
        pages: analysis.pages,
      }
    }
  } catch (error) {
    console.warn('qpdf não pôde ser usado na busca por tamanho.', error)
  }

  // 2) Tenta perfis nativos progressivos. A ordem depende de quão agressiva é
  // a redução solicitada para evitar perda desnecessária de qualidade.
  const order = targetProfileOrder(targetRatio)
  const nativeStart = 15
  const nativeEnd = 58
  const slot = Math.max(7, Math.floor((nativeEnd - nativeStart) / order.length))

  for (let index = 0; index < order.length; index++) {
    const profile = order[index]
    const start = nativeStart + index * slot
    const end = index === order.length - 1 ? nativeEnd : Math.min(nativeEnd, start + slot - 1)
    try {
      onProgress(start, `Buscando a meta com perfil ${profile}…`)
      const candidate = await ghostscriptCompressWasm(original, profile, onProgress, start, end)
      if (looksLikePdf(candidate) && candidate.byteLength < best.byteLength) {
        best = candidate
        engine = `ghostscript-${profile}`
        attempts.push(`${profile} ${(best.byteLength / MIB).toFixed(1)} MB`)
      }
      onProgress(end, `Melhor resultado até agora: ${(best.byteLength / MIB).toFixed(1)} MB • meta ${targetMb.toFixed(1)} MB`)
      if (best.byteLength <= targetBytes * TARGET_TOLERANCE) break
    } catch (error) {
      console.warn(`Perfil ${profile} indisponível na busca por tamanho.`, error)
      attempts.push(`${profile} indisponível`)
    }
  }

  // qpdf pode retirar alguns pontos percentuais depois do pdfwrite.
  if (best !== original) {
    try {
      const optimized = await qpdfOptimizeWasm(best, rangedProgress(59, 67, onProgress, 'Finalização estrutural'))
      if (looksLikePdf(optimized) && optimized.byteLength < best.byteLength) {
        best = optimized
        engine += ' + qpdf-wasm'
        attempts.push(`qpdf final ${(best.byteLength / MIB).toFixed(1)} MB`)
      }
    } catch (error) {
      console.warn('qpdf final indisponível na busca por tamanho.', error)
    }
  }

  // Se já atingimos a meta com estrutura preservada, paramos aqui.
  if (best.byteLength <= targetBytes * TARGET_TOLERANCE) {
    ensureValidPdfBytes(best, 'PDF na meta')
    await ensurePdfPageCount(best, analysis.pages)
    onProgress(100, 'Meta atingida preservando a estrutura do PDF.')
    return {
      bytes: best,
      mode: 'target' as const,
      engine,
      rasterized,
      targetBytes,
      targetReached: true,
      attempts,
      pages: analysis.pages,
    }
  }

  // 3) Último recurso: orçamento real de bytes por página. Aqui priorizamos
  // atingir a meta escolhida. O custo é rasterizar páginas e perder recursos
  // interativos/texto selecionável.
  onProgress(69, `Ainda acima da meta (${(best.byteLength / MIB).toFixed(1)} MB). Ajustando página por página…`)
  const raster = await targetRasterCompress(file, originalSize, targetBytes, onProgress, 70, 96)
  if (looksLikePdf(raster) && raster.byteLength < best.byteLength) {
    best = raster
    engine = 'target-adaptive-raster'
    rasterized = true
    attempts.push(`adaptativo ${(best.byteLength / MIB).toFixed(1)} MB`)
  }

  ensureValidPdfBytes(best, 'PDF final por tamanho')
  await ensurePdfPageCount(best, analysis.pages)
  const targetReached = best.byteLength <= targetBytes * TARGET_TOLERANCE
  onProgress(
    100,
    targetReached
      ? `Meta atingida: ${(best.byteLength / MIB).toFixed(1)} MB.`
      : `Melhor resultado possível: ${(best.byteLength / MIB).toFixed(1)} MB.`,
  )
  return {
    bytes: best,
    mode: 'target' as const,
    engine,
    rasterized,
    targetBytes,
    targetReached,
    attempts,
    pages: analysis.pages,
  }
}

async function targetRasterCompress(
  file: File,
  originalSize: number,
  targetBytes: number,
  onProgress: ProgressFn,
  progressStart = 70,
  progressEnd = 96,
): Promise<Uint8Array> {
  const source = await loadPdfJs(file)
  const output = await PDFDocument.create()
  const ratio = targetBytes / Math.max(1, originalSize)

  const dpi = ratio >= 0.72 ? 150
    : ratio >= 0.55 ? 132
      : ratio >= 0.40 ? 112
        : ratio >= 0.27 ? 96
          : ratio >= 0.18 ? 84
            : 72

  const qualities = ratio >= 0.65
    ? [0.80, 0.72, 0.64, 0.56, 0.48]
    : ratio >= 0.45
      ? [0.70, 0.62, 0.54, 0.46, 0.38, 0.32]
      : ratio >= 0.28
        ? [0.60, 0.52, 0.44, 0.36, 0.30, 0.25]
        : [0.50, 0.42, 0.35, 0.29, 0.24, 0.20]

  const minLinearScale = ratio >= 0.65 ? 0.66
    : ratio >= 0.45 ? 0.56
      : ratio >= 0.28 ? 0.46
        : 0.34

  // Reservamos 18% para xref, objetos, metadados e variações de serialização.
  // Isso tende a colocar o PDF final próximo, porém abaixo, da meta escolhida.
  const payloadTarget = targetBytes * 0.82
  const pageBudget = Math.max(6_000, Math.floor(payloadTarget / Math.max(1, source.numPages)))

  for (let i = 1; i <= source.numPages; i++) {
    const page = await source.getPage(i)
    const ptViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: dpi / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    const jpeg = await jpegUnderBudget(canvas, pageBudget, qualities, minLinearScale)
    const jpg = await output.embedJpg(await jpeg.arrayBuffer())
    const newPage = output.addPage([ptViewport.width, ptViewport.height])
    newPage.drawImage(jpg, { x: 0, y: 0, width: ptViewport.width, height: ptViewport.height })

    canvas.width = 1
    canvas.height = 1
    const ratioDone = i / Math.max(1, source.numPages)
    const percent = progressStart + Math.round((progressEnd - progressStart) * ratioDone)
    onProgress(
      percent,
      `Ajustando à meta: página ${i}/${source.numPages} • orçamento ${Math.round(pageBudget / 1024)} KB/página`,
    )
    await nextFrame()
  }

  onProgress(progressEnd + 1, 'Montando PDF no tamanho alvo…')
  return output.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 20,
  })
}


type CompatibilityMode = 'medium' | 'high' | 'maximum'

const COMPATIBILITY_PROFILES: Record<CompatibilityMode, {
  dpi: number
  targetRatio: number
  qualities: number[]
  minLinearScale: number
}> = {
  // A meta é deliberadamente menor que o original para absorver o overhead
  // da estrutura PDF. Só entra quando o Ghostscript WASM falha.
  medium: {
    dpi: 144,
    targetRatio: 0.70,
    qualities: [0.78, 0.70, 0.62, 0.54],
    minLinearScale: 0.72,
  },
  high: {
    dpi: 112,
    targetRatio: 0.52,
    qualities: [0.66, 0.58, 0.50, 0.42],
    minLinearScale: 0.64,
  },
  maximum: {
    dpi: 92,
    targetRatio: 0.34,
    qualities: [0.52, 0.44, 0.36, 0.30, 0.24],
    minLinearScale: 0.48,
  },
}

async function jpegUnderBudget(
  sourceCanvas: HTMLCanvasElement,
  budget: number,
  qualities: number[],
  minLinearScale: number,
): Promise<Blob> {
  let working = sourceCanvas
  let ownedCanvas: HTMLCanvasElement | null = null
  let linearScale = 1
  let best: Blob | null = null

  try {
    // Em cada resolução, reduzimos primeiro a qualidade JPEG. Se ainda não
    // couber na meta da página, diminuímos as dimensões progressivamente.
    while (true) {
      for (const quality of qualities) {
        const blob = await canvasToJpeg(working, quality)
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= budget) return blob
      }

      if (linearScale <= minLinearScale + 0.001) break
      const nextScale = Math.max(minLinearScale, linearScale * 0.82)
      const down = document.createElement('canvas')
      down.width = Math.max(1, Math.round(sourceCanvas.width * nextScale))
      down.height = Math.max(1, Math.round(sourceCanvas.height * nextScale))
      const ctx = down.getContext('2d', { alpha: false })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, down.width, down.height)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(sourceCanvas, 0, 0, down.width, down.height)
      if (ownedCanvas) {
        ownedCanvas.width = 1
        ownedCanvas.height = 1
      }
      ownedCanvas = down
      working = down
      linearScale = nextScale
    }

    if (!best) throw new Error('Não foi possível gerar JPEG da página.')
    return best
  } finally {
    if (ownedCanvas) {
      ownedCanvas.width = 1
      ownedCanvas.height = 1
    }
  }
}

async function compatibilityRasterCompress(
  file: File,
  mode: CompatibilityMode,
  originalSize: number,
  onProgress: ProgressFn,
): Promise<Uint8Array> {
  const profile = COMPATIBILITY_PROFILES[mode]
  const source = await loadPdfJs(file)
  const output = await PDFDocument.create()

  // Reservamos ~12% da meta para objetos, xref, páginas e metadados.
  const payloadTarget = originalSize * profile.targetRatio * 0.88
  const pageBudget = Math.max(10_000, Math.floor(payloadTarget / Math.max(1, source.numPages)))

  for (let i = 1; i <= source.numPages; i++) {
    const page = await source.getPage(i)
    const ptViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: profile.dpi / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    const jpeg = await jpegUnderBudget(
      canvas,
      pageBudget,
      profile.qualities,
      profile.minLinearScale,
    )
    const jpg = await output.embedJpg(await jpeg.arrayBuffer())
    const newPage = output.addPage([ptViewport.width, ptViewport.height])
    newPage.drawImage(jpg, { x: 0, y: 0, width: ptViewport.width, height: ptViewport.height })

    canvas.width = 1
    canvas.height = 1
    const percent = 7 + Math.round((i / source.numPages) * 87)
    onProgress(percent, `Fallback adaptativo: página ${i}/${source.numPages} • meta ${Math.round(pageBudget / 1024)} KB/página`)
    await nextFrame()
  }

  onProgress(96, 'Montando PDF compactado…')
  const bytes = await output.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 20,
  })
  onProgress(99, 'Validando resultado…')
  return bytes
}

async function adaptiveRasterCompress(file: File, originalSize: number, onProgress: ProgressFn): Promise<Uint8Array> {
  const source = await loadPdfJs(file)
  const output = await PDFDocument.create()
  // Buscamos aproximadamente 60% do tamanho original. Há folga para a
  // estrutura do PDF, então cada imagem tenta ficar abaixo de 88% da quota.
  const pageBudget = Math.max(18_000, Math.floor((originalSize * 0.60 / Math.max(1, source.numPages)) * 0.88))

  for (let i = 1; i <= source.numPages; i++) {
    const page = await source.getPage(i)
    const ptViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: 96 / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    let chosen: Blob | null = null
    for (const quality of [0.50, 0.42, 0.34, 0.28]) {
      const candidate = await canvasToJpeg(canvas, quality)
      chosen = candidate
      if (candidate.size <= pageBudget) break
    }

    if (chosen && chosen.size > pageBudget) {
      const small = document.createElement('canvas')
      small.width = Math.max(1, Math.floor(canvas.width * 0.76))
      small.height = Math.max(1, Math.floor(canvas.height * 0.76))
      const sctx = small.getContext('2d', { alpha: false })!
      sctx.fillStyle = '#fff'
      sctx.fillRect(0, 0, small.width, small.height)
      sctx.drawImage(canvas, 0, 0, small.width, small.height)
      chosen = await canvasToJpeg(small, 0.30)
      small.width = 1
      small.height = 1
    }

    if (!chosen) throw new Error(`Falha ao rasterizar a página ${i}.`)
    const jpg = await output.embedJpg(await chosen.arrayBuffer())
    const newPage = output.addPage([ptViewport.width, ptViewport.height])
    newPage.drawImage(jpg, { x: 0, y: 0, width: ptViewport.width, height: ptViewport.height })
    canvas.width = 1
    canvas.height = 1
    onProgress(10 + Math.round((i / source.numPages) * 84), `Redução visual extrema: página ${i}/${source.numPages}…`)
    await nextFrame()
  }

  onProgress(95, 'Montando PDF final…')
  return output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 25 })
}

export interface MergeResult {
  blob: Blob
  mergedFiles: number
  skippedFiles: string[]
  engine: 'pdf-lib' | LargeMergeResult['engine']
  bookmarksCreated: number
  tocPagesCreated: number
  tocEntriesCreated: number
  bookmarkWarning?: string
  tocWarning?: string
  bookmarkCategoriesCreated: number
}

export interface MergeOptions {
  createBookmarks?: boolean
  createTableOfContents?: boolean
  tocTitle?: string
  bookmarkHierarchy?: boolean
  bookmarkCategories?: string[]
}

const NAVIGATION_POSTPROCESS_MAX_BYTES = 220 * 1024 * 1024

function bookmarkTitle(fileName: string, fallbackIndex: number): string {
  const title = fileName.replace(/\.pdf$/i, '').trim()
  return title || `Documento ${fallbackIndex + 1}`
}

async function buildBookmarkSpecs(
  files: File[],
  fileIndices: number[],
  onProgress: ProgressFn,
  startProgress: number,
  endProgress: number,
  categories: string[] = [],
): Promise<PdfBookmarkSpec[]> {
  const specs: PdfBookmarkSpec[] = []
  let pageIndex = 0

  for (let position = 0; position < fileIndices.length; position++) {
    const fileIndex = fileIndices[position]
    const file = files[fileIndex]
    let pdf: any = null
    try {
      pdf = await loadPdfJs(file)
      const pages = pdf.numPages
      specs.push({ title: bookmarkTitle(file.name, position), pageIndex, category: (categories[fileIndex] || '').trim() || undefined })
      pageIndex += pages
    } finally {
      if (pdf) {
        await destroyPdfJs(pdf)
      }
    }

    if (position % 5 === 0 || position === fileIndices.length - 1) {
      const fraction = (position + 1) / Math.max(1, fileIndices.length)
      const mapped = startProgress + Math.round((endProgress - startProgress) * fraction)
      onProgress(mapped, `Mapeando documentos: ${position + 1}/${fileIndices.length}…`)
      await nextFrame()
    }
  }

  return specs
}

async function addNavigationToMergedBlob(
  blob: Blob,
  specs: PdfBookmarkSpec[],
  onProgress: ProgressFn,
  options: Required<Pick<MergeOptions, 'createBookmarks'|'createTableOfContents'|'tocTitle'|'bookmarkHierarchy'>>,
): Promise<{ blob: Blob; bookmarksCreated: number; bookmarkCategoriesCreated: number; tocPagesCreated: number; tocEntriesCreated: number }> {
  const [{ addClickableTableOfContents }, { addPdfBookmarks, addPdfBookmarksHierarchical }] = await Promise.all([
    import('./tableOfContents'),
    import('./bookmarks'),
  ])
  onProgress(92, 'Preparando índice e navegação…')
  await nextFrame()

  const bytes = new Uint8Array(await blob.arrayBuffer())
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const expectedPages = specs.length === 0 ? 0 : Math.max(...specs.map(spec => spec.pageIndex)) + 1
  if (expectedPages > doc.getPageCount()) {
    throw new Error('A estrutura de páginas mudou durante a mesclagem e a navegação não pôde ser aplicada com segurança.')
  }

  let shiftedSpecs = specs
  let tocPagesCreated = 0
  let tocEntriesCreated = 0

  if (options.createTableOfContents && specs.length > 0) {
    onProgress(94, 'Criando índice automático clicável…')
    await nextFrame()
    const toc = await addClickableTableOfContents(doc, specs, options.tocTitle)
    shiftedSpecs = toc.shiftedSpecs
    tocPagesCreated = toc.pagesCreated
    tocEntriesCreated = toc.entriesCreated
  }

  let bookmarksCreated = 0
  let bookmarkCategoriesCreated = 0
  if (options.createBookmarks && shiftedSpecs.length > 0) {
    onProgress(96, options.bookmarkHierarchy ? 'Criando bookmarks hierárquicos…' : 'Criando marcadores de navegação…')
    await nextFrame()
    const bookmarkSpecs: PdfBookmarkSpec[] = tocPagesCreated > 0
      ? [{ title: options.tocTitle || 'Índice de documentos', pageIndex: 0, root: true }, ...shiftedSpecs]
      : shiftedSpecs
    if (options.bookmarkHierarchy) {
      const result = addPdfBookmarksHierarchical(doc, bookmarkSpecs, true)
      bookmarksCreated = result.totalCreated
      bookmarkCategoriesCreated = result.categoryBookmarksCreated
    } else {
      bookmarksCreated = addPdfBookmarks(doc, bookmarkSpecs, true)
    }
  }

  onProgress(98, 'Gravando índice e navegação…')
  await nextFrame()
  const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 25 })
  if (!saved || saved.byteLength < 100) throw new Error('A etapa de índice/navegação gerou um PDF inválido.')

  return {
    blob: new Blob([saved], { type: 'application/pdf' }),
    bookmarksCreated,
    bookmarkCategoriesCreated,
    tocPagesCreated,
    tocEntriesCreated,
  }
}

export async function mergePdfs(files: File[], onProgress: ProgressFn, options: MergeOptions = {}): Promise<MergeResult> {
  if (files.length < 2) throw new Error('Selecione pelo menos 2 PDFs.')
  const createBookmarks = options.createBookmarks ?? true
  const createTableOfContents = options.createTableOfContents ?? true
  const tocTitle = (options.tocTitle || 'Índice de documentos').trim() || 'Índice de documentos'
  const bookmarkHierarchy = options.bookmarkHierarchy ?? true
  const bookmarkCategories = options.bookmarkCategories || []
  const needsNavigation = createBookmarks || createTableOfContents
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const useMassiveMode = files.length >= 100 || totalBytes >= 128 * 1024 * 1024

  if (useMassiveMode) {
    const mappedProgress: ProgressFn = needsNavigation
      ? (value, message) => onProgress(Math.min(86, Math.round(value * 0.86)), message)
      : onProgress
    const { mergeManyPdfs } = await import('./largeMerge')
    const result = await mergeManyPdfs(files, mappedProgress)

    if (!needsNavigation) {
      onProgress(100, 'Mesclagem concluída.')
      return { ...result, bookmarksCreated: 0, bookmarkCategoriesCreated: 0, tocPagesCreated: 0, tocEntriesCreated: 0 }
    }

    if (result.blob.size > NAVIGATION_POSTPROCESS_MAX_BYTES) {
      const maxMb = Math.round(NAVIGATION_POSTPROCESS_MAX_BYTES / 1024 / 1024)
      const sizeMb = (result.blob.size / 1024 / 1024).toFixed(1)
      onProgress(100, 'Mesclagem concluída. Índice/marcadores foram omitidos para proteger a memória do navegador.')
      return {
        ...result,
        bookmarksCreated: 0,
        bookmarkCategoriesCreated: 0,
        tocPagesCreated: 0,
        tocEntriesCreated: 0,
        bookmarkWarning: createBookmarks ? `O PDF final tem ${sizeMb} MB. Marcadores automáticos são pós-processados apenas em resultados de até ~${maxMb} MB na versão web.` : undefined,
        tocWarning: createTableOfContents ? `O PDF final tem ${sizeMb} MB. O índice clicável é pós-processado apenas em resultados de até ~${maxMb} MB na versão web.` : undefined,
      }
    }

    try {
      const specs = await buildBookmarkSpecs(files, result.mergedFileIndices, onProgress, 87, 91, bookmarkCategories)
      const navigation = await addNavigationToMergedBlob(result.blob, specs, onProgress, {
        createBookmarks,
        createTableOfContents,
        tocTitle,
        bookmarkHierarchy,
      })
      const parts = []
      if (navigation.tocEntriesCreated) parts.push(`${navigation.tocEntriesCreated.toLocaleString('pt-BR')} item(ns) no índice`)
      if (navigation.bookmarksCreated) parts.push(`${navigation.bookmarksCreated.toLocaleString('pt-BR')} marcador(es)`)
      onProgress(100, parts.length ? `Concluído com ${parts.join(' e ')}.` : 'Concluído.')
      return { ...result, ...navigation }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Falha ao criar índice/navegação.'
      onProgress(100, 'Mesclagem concluída sem o pós-processamento de navegação.')
      return {
        ...result,
        bookmarksCreated: 0,
        bookmarkCategoriesCreated: 0,
        tocPagesCreated: 0,
        tocEntriesCreated: 0,
        bookmarkWarning: createBookmarks ? `O PDF foi mesclado, mas os marcadores não puderam ser adicionados: ${detail}` : undefined,
        tocWarning: createTableOfContents ? `O PDF foi mesclado, mas o índice clicável não pôde ser adicionado: ${detail}` : undefined,
      }
    }
  }

  const out = await PDFDocument.create()
  const specs: PdfBookmarkSpec[] = []
  let done = 0
  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
      const firstPageIndex = out.getPageCount()
      const pages = await out.copyPages(src, src.getPageIndices())
      pages.forEach(p => out.addPage(p))
      if (needsNavigation && pages.length > 0) {
        specs.push({ title: bookmarkTitle(file.name, index), pageIndex: firstPageIndex, category: (bookmarkCategories[index] || '').trim() || undefined })
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'PDF inválido ou protegido.'
      throw new Error(`Falha ao abrir "${file.name}": ${detail}`)
    }
    done++
    const limit = needsNavigation ? 82 : 92
    onProgress(Math.round(done/files.length*limit), `Adicionando ${done}/${files.length}: ${file.name}…`)
    await nextFrame()
  }

  const navigationModules = needsNavigation
    ? await Promise.all([import('./tableOfContents'), import('./bookmarks')])
    : null
  const addClickableTableOfContents = navigationModules?.[0].addClickableTableOfContents
  const addPdfBookmarks = navigationModules?.[1].addPdfBookmarks
  const addPdfBookmarksHierarchical = navigationModules?.[1].addPdfBookmarksHierarchical

  let shiftedSpecs = specs
  let tocPagesCreated = 0
  let tocEntriesCreated = 0
  if (createTableOfContents && specs.length > 0) {
    onProgress(86, 'Criando índice automático clicável…')
    await nextFrame()
    const toc = await addClickableTableOfContents!(out, specs, tocTitle)
    shiftedSpecs = toc.shiftedSpecs
    tocPagesCreated = toc.pagesCreated
    tocEntriesCreated = toc.entriesCreated
  }

  let bookmarksCreated = 0
  let bookmarkCategoriesCreated = 0
  if (createBookmarks && shiftedSpecs.length > 0) {
    onProgress(91, bookmarkHierarchy ? `Criando bookmarks hierárquicos…` : `Criando marcadores de navegação…`)
    const bookmarkSpecs: PdfBookmarkSpec[] = tocPagesCreated > 0
      ? [{ title: tocTitle, pageIndex: 0, root: true }, ...shiftedSpecs]
      : shiftedSpecs
    if (bookmarkHierarchy) {
      const result = addPdfBookmarksHierarchical!(out, bookmarkSpecs, true)
      bookmarksCreated = result.totalCreated
      bookmarkCategoriesCreated = result.categoryBookmarksCreated
    } else {
      bookmarksCreated = addPdfBookmarks!(out, bookmarkSpecs, true)
    }
    await nextFrame()
  }

  onProgress(96, 'Finalizando arquivo mesclado…')
  const bytes = await out.save({ useObjectStreams:true, addDefaultPage:false, objectsPerTick:25 })
  if (!bytes || bytes.byteLength < 100) throw new Error('O PDF mesclado ficou vazio e foi bloqueado.')
  const resultParts = []
  if (tocEntriesCreated) resultParts.push(`${tocEntriesCreated.toLocaleString('pt-BR')} item(ns) no índice`)
  if (bookmarksCreated) resultParts.push(`${bookmarksCreated.toLocaleString('pt-BR')} marcador(es)`)
  onProgress(100, resultParts.length ? `Concluído com ${resultParts.join(' e ')}.` : 'Concluído.')
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    mergedFiles: files.length,
    skippedFiles: [],
    engine: 'pdf-lib',
    bookmarksCreated,
    bookmarkCategoriesCreated,
    tocPagesCreated,
    tocEntriesCreated,
  }
}

export async function splitPdfBySize(file: File, maxMb: number, onProgress: ProgressFn) {
  const source = await PDFDocument.load(await file.arrayBuffer())
  const target = Math.max(100_000, Math.floor(maxMb * 1024 * 1024))
  const parts: Uint8Array[] = []
  let start = 0
  while (start < source.getPageCount()) {
    let end = start
    let best: Uint8Array | null = null
    while (end < source.getPageCount()) {
      const trial = await PDFDocument.create()
      const copied = await trial.copyPages(source, Array.from({length:end-start+1},(_,k)=>start+k))
      copied.forEach(p=>trial.addPage(p))
      const bytes = await trial.save({ useObjectStreams:true })
      if (bytes.length <= target || end === start) {
        best = bytes
        end++
      } else break
      onProgress(Math.min(92, Math.round((end/source.getPageCount())*92)), `Calculando partes: página ${end} de ${source.getPageCount()}…`)
      await nextFrame()
    }
    if (!best) throw new Error('Não foi possível criar uma parte do PDF.')
    parts.push(best)
    start = end
  }
  onProgress(100, `PDF dividido com sucesso em ${parts.length} parte(s).`)
  return parts
}

export async function extractPdfText(file: File, onProgress: ProgressFn) {
  const pdf = await loadPdfJs(file)
  try {
    const pages: string[] = []
    for(let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items.map((x:any)=>('str' in x ? x.str : '')).join(' ')
      pages.push(text)
      onProgress(Math.round(i/pdf.numPages*100), `Extraindo texto: página ${i}/${pdf.numPages}`)
    }
    return pages
  } finally {
    await destroyPdfJs(pdf)
  }
}

export async function pdfToImagesZip(file: File, format: 'jpeg'|'png', dpi: number, onProgress: ProgressFn) {
  const [{ default: JSZip }, pdf] = await Promise.all([import('jszip'), loadPdfJs(file)])
  const zip = new JSZip()
  for(let i=1;i<=pdf.numPages;i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: dpi/72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d', {alpha:false})!
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height)
    await page.render({canvasContext:ctx,viewport,canvas}).promise
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const blob: Blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao renderizar imagem.')),mime,0.9))
    zip.file(`pagina-${String(i).padStart(3,'0')}.${format==='jpeg'?'jpg':'png'}`,blob)
    onProgress(Math.round(i/pdf.numPages*90), `Renderizando página ${i}/${pdf.numPages}…`)
    canvas.width=1; canvas.height=1
    await nextFrame()
  }
  onProgress(94,'Compactando imagens em ZIP…')
  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>onProgress(94+Math.round(m.percent*.06),'Finalizando ZIP…'))
  onProgress(100,'Concluído.')
  return blob
}

export async function imagesToPdf(files: File[], onProgress: ProgressFn) {
  const pdf = await PDFDocument.create()
  for(let i=0;i<files.length;i++) {
    const file = files[i]
    const buffer = await file.arrayBuffer()
    const image = file.type === 'image/png' ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer)
    const maxW = 595.28, maxH = 841.89
    const ratio = Math.min(maxW/image.width, maxH/image.height, 1)
    const w = image.width*ratio, h=image.height*ratio
    const page = pdf.addPage([maxW,maxH])
    page.drawImage(image,{x:(maxW-w)/2,y:(maxH-h)/2,width:w,height:h})
    onProgress(Math.round((i+1)/files.length*90),`Adicionando imagem ${i+1}/${files.length}…`)
    await nextFrame()
  }
  const bytes = await pdf.save({useObjectStreams:true})
  onProgress(100,'Concluído.')
  return bytes
}
