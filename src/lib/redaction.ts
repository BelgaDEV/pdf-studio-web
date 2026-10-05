import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { nextFrame } from './files'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export type RedactionRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type RedactionMap = Record<number, RedactionRect[]>
export type RedactionProgress = (value: number, message: string) => void

export type RedactionResult = {
  bytes: Uint8Array
  pageCount: number
  redactedPages: number
  redactionCount: number
  verifiedPages: number
}

export async function loadPdfForRedaction(file: File) {
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjsLib.getDocument({ data }).promise
}

export async function renderRedactionPreview(
  pdf: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  zoom = 1,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: Math.max(0.65, Math.min(2.2, zoom)) })
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas indisponível para visualizar o documento.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return { width: canvas.width, height: canvas.height }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.94): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        reject(new Error('Não foi possível rasterizar a página redigida.'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/jpeg', quality)
  })
}

function validRect(rect: RedactionRect): boolean {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.width) && Number.isFinite(rect.height)
    && rect.width > 0.001 && rect.height > 0.001
}

function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 100) return false
  const limit = Math.min(1024, bytes.byteLength)
  let head = ''
  for (let i = 0; i < limit; i++) head += String.fromCharCode(bytes[i])
  return head.includes('%PDF-')
}

async function verifyPermanentRedaction(bytes: Uint8Array, redactedPageNumbers: number[], expectedPages: number, onProgress: RedactionProgress) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise
  try {
    if (pdf.numPages !== expectedPages) {
      throw new Error(`Falha de segurança: o original tem ${expectedPages} página(s), mas o resultado tem ${pdf.numPages}.`)
    }

    for (let index = 0; index < redactedPageNumbers.length; index++) {
      const pageNumber = redactedPageNumbers[index]
      const page = await pdf.getPage(pageNumber)
      const text = await page.getTextContent()
      const chars = text.items.reduce((total: number, item: any) => total + (typeof item?.str === 'string' ? item.str.trim().length : 0), 0)
      if (chars > 0) {
        throw new Error(`Falha de segurança na página ${pageNumber}: ainda existe uma camada de texto extraível após a redação.`)
      }
      onProgress(92 + Math.round(((index + 1) / Math.max(1, redactedPageNumbers.length)) * 6), `Verificando remoção permanente: página ${pageNumber}…`)
      if (index % 3 === 0) await nextFrame()
    }
  } finally {
    await pdf.destroy().catch(() => {})
  }
}

export async function permanentlyRedactPdf(
  file: File,
  redactions: RedactionMap,
  options: { dpi?: number; jpegQuality?: number } = {},
  onProgress: RedactionProgress,
): Promise<RedactionResult> {
  const input = new Uint8Array(await file.arrayBuffer())
  const redactedPageNumbers = Object.keys(redactions)
    .map(Number)
    .filter(pageNumber => (redactions[pageNumber] || []).some(validRect))
    .sort((a, b) => a - b)

  if (!redactedPageNumbers.length) throw new Error('Marque pelo menos uma área sensível antes de aplicar a redação permanente.')

  onProgress(3, 'Abrindo documento para redação segura…')
  const pdfJs = await pdfjsLib.getDocument({ data: new Uint8Array(input) }).promise
  const source = await PDFDocument.load(input, { updateMetadata: false })
  const output = await PDFDocument.create()
  const dpi = Math.max(120, Math.min(300, options.dpi || 200))
  const renderScale = dpi / 72
  const jpegQuality = Math.max(0.82, Math.min(0.98, options.jpegQuality || 0.94))
  let redactionCount = 0

  try {
    const pageCount = source.getPageCount()
    if (pdfJs.numPages !== pageCount) throw new Error('O documento não pôde ser validado antes da redação.')

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const pageNumber = pageIndex + 1
      const pageRedactions = (redactions[pageNumber] || []).filter(validRect)

      if (!pageRedactions.length) {
        const [copied] = await output.copyPages(source, [pageIndex])
        output.addPage(copied)
      } else {
        const page = await pdfJs.getPage(pageNumber)
        const displayViewport = page.getViewport({ scale: 1 })
        const renderViewport = page.getViewport({ scale: renderScale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(renderViewport.width))
        canvas.height = Math.max(1, Math.round(renderViewport.height))
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) throw new Error(`Canvas indisponível para redigir a página ${pageNumber}.`)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise

        // Segurança: a página inteira é rasterizada antes da tarja. O conteúdo
        // original da página não é copiado para o PDF final, portanto não existe
        // texto/objeto escondido atrás do retângulo preto.
        ctx.fillStyle = '#000'
        for (const rect of pageRedactions) {
          const x = Math.max(0, Math.min(1, rect.x)) * canvas.width
          const y = Math.max(0, Math.min(1, rect.y)) * canvas.height
          const width = Math.max(0, Math.min(1 - rect.x, rect.width)) * canvas.width
          const height = Math.max(0, Math.min(1 - rect.y, rect.height)) * canvas.height
          ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(width), Math.ceil(height))
          redactionCount++
        }

        const imageBytes = await canvasToJpeg(canvas, jpegQuality)
        const image = await output.embedJpg(imageBytes)
        const outPage = output.addPage([displayViewport.width, displayViewport.height])
        outPage.drawImage(image, { x: 0, y: 0, width: displayViewport.width, height: displayViewport.height })
        canvas.width = 1
        canvas.height = 1
      }

      const mapped = 7 + Math.round(((pageIndex + 1) / pageCount) * 79)
      onProgress(mapped, pageRedactions.length ? `Redigindo permanentemente página ${pageNumber}/${pageCount}…` : `Preservando página ${pageNumber}/${pageCount}…`)
      if (pageIndex % 3 === 0) await nextFrame()
    }

    // Um novo catálogo é criado de propósito. Isso evita carregar metadados,
    // anexos e outras estruturas documentais antigas para o arquivo redigido.
    output.setProducer('PDF Studio — Redação Permanente')
    output.setCreator('PDF Studio')
    output.setCreationDate(new Date())
    output.setModificationDate(new Date())

    onProgress(88, 'Finalizando PDF sem conteúdo oculto das páginas redigidas…')
    const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20 })
    if (!looksLikePdf(bytes)) throw new Error('O PDF redigido ficou inválido. O download foi bloqueado.')

    await verifyPermanentRedaction(bytes, redactedPageNumbers, pageCount, onProgress)
    onProgress(100, 'Redação permanente verificada com sucesso.')
    return {
      bytes,
      pageCount,
      redactedPages: redactedPageNumbers.length,
      redactionCount,
      verifiedPages: redactedPageNumbers.length,
    }
  } finally {
    await pdfJs.destroy().catch(() => {})
  }
}
