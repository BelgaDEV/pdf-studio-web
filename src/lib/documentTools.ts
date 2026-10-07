import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib'
import { nextFrame } from './files'

export type DocumentProgressFn = (value: number, message: string) => void
export type WatermarkPosition = 'center' | 'top' | 'bottom'
export type NumberPosition = 'bottom-center' | 'bottom-right' | 'top-center'
export type BlankSensitivity = 'conservative' | 'normal' | 'aggressive'
export type PdfaVersion = 1 | 2 | 3

function looksLikePdf(bytes: Uint8Array): boolean {
  if (!bytes || bytes.byteLength < 100) return false
  const limit = Math.min(bytes.byteLength, 1024)
  let head = ''
  for (let i = 0; i < limit; i++) head += String.fromCharCode(bytes[i])
  return head.includes('%PDF-')
}

function validatePdf(bytes: Uint8Array, label = 'PDF gerado'): Uint8Array {
  if (!looksLikePdf(bytes)) throw new Error(`${label} ficou vazio ou inválido. O download foi bloqueado.`)
  return bytes
}

async function loadPdfJs(file: File | Uint8Array) {
  const { loadPdfJsDocument } = await import('./pdfjsSecure')
  const data = file instanceof File
    ? new Uint8Array(await file.arrayBuffer())
    : new Uint8Array(file)
  return loadPdfJsDocument(data)
}

export async function addWatermark(
  file: File,
  options: { text: string; opacity: number; fontSize: number; rotation: number; position: WatermarkPosition },
  onProgress: DocumentProgressFn,
): Promise<Uint8Array> {
  const text = options.text.trim()
  if (!text) throw new Error('Digite o texto da marca d’água.')
  onProgress(5, 'Abrindo PDF…')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages = doc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const size = Math.max(10, Math.min(160, options.fontSize))
    const textWidth = font.widthOfTextAtSize(text, size)
    const rotation = options.rotation
    let x = (width - textWidth) / 2
    let y = (height - size) / 2
    if (options.position === 'top') y = height - size - 34
    if (options.position === 'bottom') y = 34
    page.drawText(text, {
      x: Math.max(12, x),
      y,
      size,
      font,
      color: rgb(0.28, 0.34, 0.4),
      opacity: Math.max(0.05, Math.min(0.9, options.opacity)),
      rotate: degrees(rotation),
    })
    onProgress(10 + Math.round(((i + 1) / pages.length) * 80), `Aplicando marca d’água: página ${i + 1}/${pages.length}…`)
    if (i % 8 === 0) await nextFrame()
  }
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
  onProgress(100, 'Marca d’água aplicada.')
  return validatePdf(out)
}

export async function addPageNumbers(
  file: File,
  options: { startAt: number; fontSize: number; position: NumberPosition; showTotal: boolean; prefix: string },
  onProgress: DocumentProgressFn,
): Promise<Uint8Array> {
  onProgress(5, 'Abrindo PDF…')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const startAt = Math.max(1, Math.floor(options.startAt || 1))
  const endNumber = startAt + pages.length - 1
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const current = startAt + i
    const numberText = options.showTotal ? `${current} de ${endNumber}` : String(current)
    const text = `${options.prefix || ''}${numberText}`
    const size = Math.max(7, Math.min(32, options.fontSize))
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, size)
    const margin = 24
    let x = (width - textWidth) / 2
    let y = margin
    if (options.position === 'bottom-right') x = width - textWidth - margin
    if (options.position === 'top-center') y = height - size - margin
    page.drawText(text, { x: Math.max(10, x), y, size, font, color: rgb(0.25, 0.3, 0.36), opacity: 0.92 })
    onProgress(10 + Math.round(((i + 1) / pages.length) * 80), `Numerando página ${i + 1}/${pages.length}…`)
    if (i % 12 === 0) await nextFrame()
  }
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
  onProgress(100, 'Numeração concluída.')
  return validatePdf(out)
}

function blankThreshold(sensitivity: BlankSensitivity): number {
  if (sensitivity === 'conservative') return 0.00045
  if (sensitivity === 'aggressive') return 0.0032
  return 0.00135
}

async function pageInkRatio(page: any): Promise<number> {
  const base = page.getViewport({ scale: 1 })
  const targetWidth = Math.min(320, Math.max(160, base.width * 0.33))
  const scale = targetWidth / base.width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return 1
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let sampled = 0
  let ink = 0
  const step = 4
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const p = (y * canvas.width + x) * 4
      const r = pixels[p]
      const g = pixels[p + 1]
      const b = pixels[p + 2]
      sampled++
      if (r < 242 || g < 242 || b < 242) ink++
    }
  }
  canvas.width = 1
  canvas.height = 1
  return sampled ? ink / sampled : 0
}

export async function removeBlankPages(
  file: File,
  sensitivity: BlankSensitivity,
  onProgress: DocumentProgressFn,
): Promise<{ bytes: Uint8Array; removedPages: number[] }> {
  onProgress(3, 'Analisando páginas…')
  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await loadPdfJs(sourceBytes)
  const removed: number[] = []
  const threshold = blankThreshold(sensitivity)

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    const hasText = text.items.some((item: any) => typeof item?.str === 'string' && item.str.trim().length > 0)
    let blank = false
    if (!hasText) {
      const inkRatio = await pageInkRatio(page)
      blank = inkRatio < threshold
    }
    if (blank) removed.push(i)
    onProgress(5 + Math.round((i / pdf.numPages) * 72), `Analisando página ${i}/${pdf.numPages}${blank ? ' • em branco' : ''}…`)
    if (i % 5 === 0) await nextFrame()
  }

  if (removed.length === 0) {
    onProgress(100, 'Nenhuma página em branco encontrada.')
    return { bytes: sourceBytes, removedPages: [] }
  }
  if (removed.length >= pdf.numPages) throw new Error('Todas as páginas foram identificadas como vazias. Ajuste a sensibilidade para evitar remover o documento inteiro.')

  onProgress(82, `Removendo ${removed.length} página(s) em branco…`)
  const doc = await PDFDocument.load(sourceBytes, { updateMetadata: false })
  for (const pageNumber of [...removed].sort((a, b) => b - a)) doc.removePage(pageNumber - 1)
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
  onProgress(100, 'Páginas em branco removidas.')
  return { bytes: validatePdf(out), removedPages: removed }
}

interface WasmOutputFile { name?: string; data: Uint8Array | ArrayBuffer }
interface WasmExecResult { files?: WasmOutputFile[]; stdout?: string; stderr?: string; code?: number }

function resultBytes(result: WasmExecResult, label: string): Uint8Array {
  const file = result.files?.[0]
  if (!file?.data) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(-1200)
    throw new Error(`${label} não gerou saída.${details ? ` ${details}` : ''}`)
  }
  return validatePdf(file.data instanceof Uint8Array ? new Uint8Array(file.data) : new Uint8Array(file.data), label)
}

async function removePdfMetadataWithPdfLib(
  input: Uint8Array,
  onProgress: DocumentProgressFn,
): Promise<{ bytes: Uint8Array; engine: 'pdf-lib' }> {
  onProgress(35, 'Usando removedor de compatibilidade…')
  const doc = await PDFDocument.load(input, { updateMetadata: false })
  doc.catalog.delete(PDFName.of('Metadata'))
  ;(doc.context.trailerInfo as any).Info = undefined
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
  onProgress(100, 'Metadados removidos.')
  return { bytes: validatePdf(out), engine: 'pdf-lib' }
}

export async function removePdfMetadata(
  file: File,
  onProgress: DocumentProgressFn,
): Promise<{ bytes: Uint8Array; engine: 'qpdf' | 'pdf-lib' }> {
  const input = new Uint8Array(await file.arrayBuffer())
  onProgress(8, 'Carregando removedor de metadados…')

  // @wasm-zoo/qpdf distribui um build de navegador e referencia `window`.
  // Em testes Node/SSR usamos diretamente o fallback pdf-lib; no navegador,
  // qpdf continua sendo o motor principal e o fallback permanece disponível.
  const canUseBrowserQpdf = typeof window !== 'undefined' && typeof document !== 'undefined'
  if (!canUseBrowserQpdf) return removePdfMetadataWithPdfLib(input, onProgress)

  try {
    const { load } = await import('@wasm-zoo/qpdf')
    const qpdf = await load()
    try {
      onProgress(25, 'Removendo XMP e dicionário de informações…')
      const result = await qpdf.exec([
        '--remove-metadata',
        '--remove-info',
        '--warning-exit-0',
        '--',
        '/input.pdf',
        '/output.pdf',
      ], {
        files: [{ name: '/input.pdf', data: input }],
        outputs: ['/output.pdf'],
      }) as WasmExecResult
      onProgress(100, 'Metadados removidos.')
      return { bytes: resultBytes(result, 'qpdf'), engine: 'qpdf' }
    } finally { qpdf.dispose() }
  } catch (error) {
    console.warn('qpdf não conseguiu remover metadados; usando fallback pdf-lib.', error)
    return removePdfMetadataWithPdfLib(input, onProgress)
  }
}

function makeOwnerPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let value = ''
  for (const b of bytes) value += b.toString(16).padStart(2, '0')
  return `PDFStudio-${value}`
}

export async function protectPdfWithPassword(
  file: File,
  password: string,
  onProgress: DocumentProgressFn,
): Promise<Uint8Array> {
  if (!password) throw new Error('Digite uma senha para proteger o PDF.')
  if (password.length < 4) throw new Error('Use uma senha com pelo menos 4 caracteres.')
  const input = new Uint8Array(await file.arrayBuffer())
  onProgress(8, 'Carregando criptografia AES-256…')
  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    const ownerPassword = makeOwnerPassword()
    onProgress(35, 'Protegendo o PDF com senha…')
    const result = await qpdf.exec([
      '--encrypt',
      `--user-password=${password}`,
      `--owner-password=${ownerPassword}`,
      '--bits=256',
      '--',
      '/input.pdf',
      '/output.pdf',
    ], {
      files: [{ name: '/input.pdf', data: input }],
      outputs: ['/output.pdf'],
    }) as WasmExecResult
    onProgress(100, 'PDF protegido com AES-256.')
    return resultBytes(result, 'PDF protegido')
  } finally { qpdf.dispose() }
}

function getPdfObject(store: any, id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof store.has === 'function' && store.has(id)) {
        resolve(store.get(id))
        return
      }
      let done = false
      const value = store.get(id, (obj: any) => {
        if (!done) { done = true; resolve(obj) }
      })
      if (value !== undefined && !done) { done = true; resolve(value) }
      window.setTimeout(() => {
        if (!done) { done = true; reject(new Error(`Imagem ${id} não ficou disponível a tempo.`)) }
      }, 8000)
    } catch (error) { reject(error) }
  })
}

function imageObjectToPng(image: any): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const width = Number(image?.width || image?.bitmap?.width || 0)
      const height = Number(image?.height || image?.bitmap?.height || 0)
      if (!width || !height) throw new Error('Imagem sem dimensões válidas.')
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponível para extrair imagem.')

      if (image.bitmap) {
        ctx.drawImage(image.bitmap, 0, 0, width, height)
      } else if (image.data) {
        const src = image.data as Uint8Array | Uint8ClampedArray
        const rgba = new Uint8ClampedArray(width * height * 4)
        const pixels = width * height
        if (src.length >= pixels * 4) {
          rgba.set(src.subarray(0, pixels * 4))
        } else if (src.length >= pixels * 3) {
          for (let i = 0, j = 0; i < pixels; i++, j += 3) {
            const p = i * 4
            rgba[p] = src[j]; rgba[p + 1] = src[j + 1]; rgba[p + 2] = src[j + 2]; rgba[p + 3] = 255
          }
        } else if (src.length >= pixels) {
          for (let i = 0; i < pixels; i++) {
            const p = i * 4
            rgba[p] = src[i]; rgba[p + 1] = src[i]; rgba[p + 2] = src[i]; rgba[p + 3] = 255
          }
        } else {
          const rowBytes = Math.ceil(width / 8)
          if (src.length < rowBytes * height) throw new Error('Formato de imagem incorporada não suportado.')
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
              const value = bit ? 255 : 0
              const p = (y * width + x) * 4
              rgba[p] = value; rgba[p + 1] = value; rgba[p + 2] = value; rgba[p + 3] = 255
            }
          }
        }
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
      } else {
        throw new Error('PDF.js não forneceu pixels para esta imagem.')
      }

      canvas.toBlob(blob => {
        canvas.width = 1; canvas.height = 1
        if (blob) resolve(blob)
        else reject(new Error('Falha ao gerar PNG da imagem extraída.'))
      }, 'image/png')
    } catch (error) { reject(error) }
  })
}

export async function extractEmbeddedImages(
  file: File,
  options: { minDimension: number },
  onProgress: DocumentProgressFn,
): Promise<{ zip: Blob; count: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const [{ default: JSZip }, { pdfjsLib }, pdf] = await Promise.all([
    import('jszip'),
    import('./pdfjsSecure'),
    loadPdfJs(bytes),
  ])
  const zip = new JSZip()
  const seen = new Set<string>()
  let count = 0
  const minDimension = Math.max(1, options.minDimension || 1)
  const imageOp = (pdfjsLib.OPS as any).paintImageXObject
  const imageRepeatOp = (pdfjsLib.OPS as any).paintImageXObjectRepeat
  const jpegOp = (pdfjsLib.OPS as any).paintJpegXObject
  const inlineOp = (pdfjsLib.OPS as any).paintInlineImageXObject

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const opList = await page.getOperatorList()
    let pageImageIndex = 0
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      let image: any = null
      let key = ''
      if (fn === imageOp || fn === imageRepeatOp || (jpegOp !== undefined && fn === jpegOp)) {
        const id = opList.argsArray[i]?.[0]
        if (!id || typeof id !== 'string') continue
        const store = id.startsWith('g_') ? (page as any).commonObjs : (page as any).objs
        try { image = await getPdfObject(store, id) } catch { continue }
        key = image?.ref ? String(image.ref) : `${pageNumber}:${id}`
      } else if (inlineOp !== undefined && fn === inlineOp) {
        image = opList.argsArray[i]?.[0]
        key = `inline:${pageNumber}:${i}`
      } else continue

      const width = Number(image?.width || image?.bitmap?.width || 0)
      const height = Number(image?.height || image?.bitmap?.height || 0)
      if (!width || !height || width < minDimension || height < minDimension || seen.has(key)) continue
      seen.add(key)
      try {
        const png = await imageObjectToPng(image)
        pageImageIndex++
        count++
        zip.file(`pagina_${String(pageNumber).padStart(3, '0')}_imagem_${String(pageImageIndex).padStart(2, '0')}_${width}x${height}.png`, png)
      } catch (error) {
        console.warn('Imagem incorporada ignorada.', error)
      }
    }
    onProgress(5 + Math.round((pageNumber / pdf.numPages) * 82), `Extraindo imagens: página ${pageNumber}/${pdf.numPages} • ${count} encontrada(s)…`)
    await nextFrame()
  }

  if (!count) throw new Error('Nenhuma imagem incorporada compatível foi encontrada. Elementos vetoriais e textos não são tratados como imagens.')
  zip.file('LEIA-ME.txt', `PDF Studio - Extração de imagens\nArquivo: ${file.name}\nImagens extraídas: ${count}\n\nAs imagens são decodificadas pelo PDF.js e exportadas como PNG. Elementos vetoriais, textos e máscaras isoladas podem não aparecer como arquivos separados.`)
  onProgress(92, 'Criando arquivo ZIP…')
  const blob = await zip.generateAsync({ type: 'blob' }, meta => onProgress(92 + Math.round(meta.percent * 0.08), 'Compactando imagens…'))
  onProgress(100, `${count} imagem(ns) extraída(s).`)
  return { zip: blob, count }
}

const PDFA_DEF = `%!\n/ICCProfile (%rom%iccprofiles/default_rgb.icc) def\n[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark\n[{icc_PDFA} << /N 3 >> /PUT pdfmark\n[{icc_PDFA} ICCProfile (r) file /PUTFILE pdfmark\n[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark\n[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) /Info (sRGB) >> /PUT pdfmark\n[{Catalog} << /OutputIntents [{OutputIntent_PDFA}] >> /PUT pdfmark\n`

export async function convertToPdfA(
  file: File,
  version: PdfaVersion,
  onProgress: DocumentProgressFn,
): Promise<Uint8Array> {
  const input = new Uint8Array(await file.arrayBuffer())
  onProgress(7, 'Carregando Ghostscript WebAssembly…')
  await nextFrame()
  const { load } = await import('@wasm-zoo/ghostscript')
  const gs = await load()
  try {
    const definition = new TextEncoder().encode(PDFA_DEF)
    const args = [
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=pdfwrite',
      `-dPDFA=${version}`,
      '-dPDFACompatibilityPolicy=1',
      '-sColorConversionStrategy=RGB',
      '-dEmbedAllFonts=true',
      '-dSubsetFonts=true',
      '-dDetectDuplicateImages=true',
      '-dPreserveAnnots=true',
      '-sOutputFile=/output.pdf',
      '/pdfa_def.ps',
      '/input.pdf',
    ]
    if (version > 1) args.splice(7, 0, '-sBlendConversionStrategy=Simple')
    onProgress(24, `Convertendo para PDF/A-${version}b…`)
    const result = await gs.exec(args, {
      files: [
        { name: '/input.pdf', data: input },
        { name: '/pdfa_def.ps', data: definition },
      ],
      outputs: ['/output.pdf'],
    }) as WasmExecResult
    onProgress(94, 'Validando estrutura do PDF gerado…')
    const out = resultBytes(result, `PDF/A-${version}b`)
    const check = await loadPdfJs(out)
    try {
      if (check.numPages < 1) throw new Error('O PDF/A gerado não possui páginas.')
    } finally {
      const { destroyPdfJsDocument } = await import('./pdfjsSecure')
      await destroyPdfJsDocument(check)
    }
    onProgress(100, `PDF/A-${version}b criado.`)
    return out
  } finally { gs.dispose() }
}
