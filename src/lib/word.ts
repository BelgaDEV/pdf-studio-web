import mammoth from 'mammoth/mammoth.browser'
import DOMPurify from 'dompurify'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, PageBreak, TextRun } from 'docx'
import type { ProgressFn } from './pdf'
import { extractPdfText } from './pdf'
import { nextFrame } from './files'

export async function wordToPdf(file: File, onProgress: ProgressFn) {
  onProgress(8, 'Lendo o documento Word…')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  onProgress(25, 'Reconstruindo o documento no navegador…')

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-10000px'
  wrapper.style.top = '0'
  wrapper.style.width = '794px'
  wrapper.style.padding = '56px 64px'
  wrapper.style.boxSizing = 'border-box'
  wrapper.style.background = '#fff'
  wrapper.style.color = '#111'
  wrapper.style.font = '16px/1.5 Arial, sans-serif'
  wrapper.innerHTML = DOMPurify.sanitize(result.value)
  wrapper.querySelectorAll('img').forEach((img) => {
    ;(img as HTMLImageElement).style.maxWidth = '100%'
    ;(img as HTMLImageElement).style.height = 'auto'
  })
  document.body.appendChild(wrapper)
  await nextFrame()

  onProgress(45, 'Renderizando páginas…')
  const canvas = await html2canvas(wrapper, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true })
  wrapper.remove()

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = canvas.height * imgW / canvas.width
  const pageCanvasHeightPx = Math.floor(canvas.width * pageH / pageW)
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageCanvasHeightPx))

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const sliceH = Math.min(pageCanvasHeightPx, canvas.height - pageIndex * pageCanvasHeightPx)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext('2d')!
    ctx.drawImage(canvas, 0, pageIndex * pageCanvasHeightPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const data = slice.toDataURL('image/jpeg', 0.92)
    if (pageIndex > 0) pdf.addPage()
    const slicePtH = sliceH * pageW / canvas.width
    pdf.addImage(data, 'JPEG', 0, 0, pageW, slicePtH, undefined, 'FAST')
    onProgress(50 + Math.round(((pageIndex + 1) / pageCount) * 46), `Criando PDF: página ${pageIndex + 1}/${pageCount}…`)
    await nextFrame()
  }
  onProgress(100, 'Concluído.')
  return pdf.output('blob')
}

export async function pdfToWord(file: File, onProgress: ProgressFn) {
  const pages = await extractPdfText(file, (v, m) => onProgress(Math.round(v * 0.8), m))
  onProgress(84, 'Montando documento Word…')
  const children: Paragraph[] = []
  pages.forEach((text, index) => {
    const chunks = text.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (chunks.length === 0) chunks.push('')
    chunks.forEach((chunk) => children.push(new Paragraph({ children: [new TextRun(chunk)] })))
    if (index < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
  })
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  onProgress(100, 'DOCX criado com sucesso.')
  return blob
}
