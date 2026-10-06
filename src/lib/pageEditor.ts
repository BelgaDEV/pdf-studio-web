import { degrees, PDFDocument } from 'pdf-lib'
import { destroyPdfJsDocument, loadPdfJsDocument } from './pdfjsSecure'
import { nextFrame } from './files'

export type PagePlanItem = {
  id: string
  sourceIndex: number
  rotation: number
}

export type PageThumbnail = {
  sourceIndex: number
  url: string
  width: number
  height: number
}

export type PageEditorProgress = (value: number, message: string) => void

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a miniatura da página.')), type, quality)
  })
}

export async function renderPdfThumbnails(
  file: File,
  onProgress: PageEditorProgress,
): Promise<PageThumbnail[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await loadPdfJsDocument(data)
  const thumbs: PageThumbnail[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const targetWidth = 150
      const scale = Math.min(0.32, Math.max(0.12, targetWidth / Math.max(1, base.width)))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      const blob = await canvasToBlob(canvas)
      thumbs.push({
        sourceIndex: pageNumber - 1,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      })
      canvas.width = 1
      canvas.height = 1
      onProgress(Math.round((pageNumber / pdf.numPages) * 100), `Criando miniaturas: página ${pageNumber}/${pdf.numPages}`)
      if (pageNumber % 4 === 0) await nextFrame()
    }
    return thumbs
  } finally {
    await destroyPdfJsDocument(pdf)
  }
}

export function revokeThumbnails(thumbs: PageThumbnail[]) {
  thumbs.forEach(thumb => URL.revokeObjectURL(thumb.url))
}

export async function buildPdfFromPagePlan(
  file: File,
  plan: PagePlanItem[],
  onProgress: PageEditorProgress,
): Promise<Uint8Array> {
  if (plan.length === 0) throw new Error('O documento precisa ter pelo menos uma página.')
  const original = new Uint8Array(await file.arrayBuffer())
  const source = await PDFDocument.load(original)
  const output = await PDFDocument.create()

  for (let index = 0; index < plan.length; index++) {
    const item = plan[index]
    if (item.sourceIndex < 0 || item.sourceIndex >= source.getPageCount()) continue
    const [copied] = await output.copyPages(source, [item.sourceIndex])
    const baseRotation = copied.getRotation().angle || 0
    const finalRotation = ((baseRotation + item.rotation) % 360 + 360) % 360
    copied.setRotation(degrees(finalRotation))
    output.addPage(copied)
    onProgress(5 + Math.round(((index + 1) / plan.length) * 88), `Montando página ${index + 1}/${plan.length}…`)
    if (index % 8 === 0) await nextFrame()
  }

  onProgress(96, 'Finalizando PDF…')
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
  if (bytes.byteLength < 100) throw new Error('O PDF editado ficou inválido. O download foi bloqueado.')
  onProgress(100, 'Concluído.')
  return bytes
}
