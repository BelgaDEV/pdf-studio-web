import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'
import { nextFrame } from './files'
import { ghostscriptCompressWasm, qpdfOptimizeWasm } from './wasmCompression'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export type CompressionMode = 'smart'|'basic'|'medium'|'high'|'maximum'
export type ProgressFn = (value: number, message: string) => void

const profiles = {
  medium: { dpi: 160, quality: 0.82 },
  high: { dpi: 120, quality: 0.68 },
  maximum: { dpi: 96, quality: 0.50 },
} as const

async function loadPdfJs(file: File | Uint8Array) {
  // PDF.js pode transferir (detach) o ArrayBuffer para o Web Worker.
  // Sempre entregamos uma COPIA quando recebemos Uint8Array para não zerar
  // o buffer original que ainda será usado como fallback/download.
  const data = file instanceof File
    ? new Uint8Array(await file.arrayBuffer())
    : new Uint8Array(file)
  return pdfjsLib.getDocument({ data }).promise
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

export async function inspectPdf(file: File) {
  const pdf = await loadPdfJs(file)
  const sample = Math.min(3, pdf.numPages)
  let textChars = 0
  for (let i=1;i<=sample;i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    textChars += text.items.reduce((acc: number, item: any) => acc + ('str' in item ? item.str.length : 0), 0)
  }
  const avgBytes = file.size / Math.max(pdf.numPages,1)
  let recommended: CompressionMode = 'medium'
  // Evita recomendar Básico para apostilas grandes só porque têm muito texto.
  // Tamanho total + bytes/página têm peso maior para decidir se vale
  // recompressão. Básico fica reservado a PDFs realmente enxutos.
  if (file.size < 8 * 1024 * 1024 && avgBytes < 75_000 && textChars > 900) recommended = 'basic'
  else if (avgBytes > 700_000 && textChars < 250) recommended = 'maximum'
  else if (avgBytes > 320_000 || file.size > 120 * 1024 * 1024) recommended = 'high'
  else recommended = 'medium'
  return { pages: pdf.numPages, textChars, avgBytesPerPage: avgBytes, recommended }
}

export async function renderFirstPage(file: File, canvas: HTMLCanvasElement) {
  const pdf = await loadPdfJs(file)
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const maxWidth = Math.min(520, canvas.parentElement?.clientWidth || 520)
  const scale = Math.max(0.5, maxWidth / base.width)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d', { alpha: false })!
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Falha ao converter página em JPEG.')), 'image/jpeg', quality))
}

export async function compressPdf(file: File, mode: CompressionMode, onProgress: ProgressFn) {
  onProgress(2, 'Analisando o documento…')
  let selected = mode
  let analysis: Awaited<ReturnType<typeof inspectPdf>> | null = null
  if (mode === 'smart') {
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

export async function mergePdfs(files: File[], onProgress: ProgressFn) {
  const out = await PDFDocument.create()
  let done = 0
  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer())
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach(p => out.addPage(p))
    done++
    onProgress(Math.round(done/files.length*90), `Adicionando ${file.name}…`)
    await nextFrame()
  }
  onProgress(96, 'Finalizando arquivo mesclado…')
  const bytes = await out.save({ useObjectStreams:true })
  onProgress(100, 'Concluído.')
  return bytes
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
  const pages: string[] = []
  for(let i=1;i<=pdf.numPages;i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((x:any)=>('str' in x ? x.str : '')).join(' ')
    pages.push(text)
    onProgress(Math.round(i/pdf.numPages*100), `Extraindo texto: página ${i}/${pdf.numPages}`)
  }
  return pages
}

export async function pdfToImagesZip(file: File, format: 'jpeg'|'png', dpi: number, onProgress: ProgressFn) {
  const pdf = await loadPdfJs(file)
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
