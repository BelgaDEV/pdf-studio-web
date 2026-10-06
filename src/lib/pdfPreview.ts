import { destroyPdfJsDocument, loadPdfJsDocument } from './pdfjsSecure'

export type PreviewCompressionRecommendation = 'basic'|'medium'|'high'|'maximum'

export async function inspectPdf(file: File) {
  const pdf = await loadPdfJsDocument(new Uint8Array(await file.arrayBuffer()))
  try {
    const sample = Math.min(3, pdf.numPages)
    let textChars = 0
    for (let i=1;i<=sample;i++) {
      const page = await pdf.getPage(i)
      const text = await page.getTextContent()
      textChars += text.items.reduce((acc: number, item: any) => acc + ('str' in item ? item.str.length : 0), 0)
    }
    const avgBytes = file.size / Math.max(pdf.numPages,1)
    let recommended: PreviewCompressionRecommendation = 'medium'
    if (file.size < 8 * 1024 * 1024 && avgBytes < 75_000 && textChars > 900) recommended = 'basic'
    else if (avgBytes > 700_000 && textChars < 250) recommended = 'maximum'
    else if (avgBytes > 320_000 || file.size > 120 * 1024 * 1024) recommended = 'high'
    return { pages: pdf.numPages, textChars, avgBytesPerPage: avgBytes, recommended }
  } finally {
    await destroyPdfJsDocument(pdf)
  }
}

export async function renderFirstPage(file: File, canvas: HTMLCanvasElement) {
  const pdf = await loadPdfJsDocument(new Uint8Array(await file.arrayBuffer()))
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const maxWidth = Math.min(520, canvas.parentElement?.clientWidth || 520)
    const scale = Math.max(0.5, maxWidth / base.width)
    const viewport = page.getViewport({ scale })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d', { alpha: false })!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
  } finally {
    await destroyPdfJsDocument(pdf)
  }
}
