import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { nextFrame } from './files'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export type OcrLanguage = 'por' | 'eng' | 'por+eng'
export type OcrProgress = (value: number, message: string) => void

export type OcrResult = {
  bytes: Uint8Array
  text: string
  recognizedPages: number
  skippedPages: number
  characters: number
}

type TsvWord = { left: number; top: number; width: number; height: number; confidence: number; text: string }

function parseTsv(tsv: string | null | undefined): TsvWord[] {
  if (!tsv) return []
  const lines = tsv.split(/\r?\n/)
  const words: TsvWord[] = []
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split('\t')
    if (columns.length < 12 || columns[0] !== '5') continue
    const text = columns.slice(11).join('\t').trim()
    const confidence = Number(columns[10])
    if (!text || !Number.isFinite(confidence) || confidence < 20) continue
    words.push({
      left: Number(columns[6]) || 0,
      top: Number(columns[7]) || 0,
      width: Number(columns[8]) || 0,
      height: Number(columns[9]) || 0,
      confidence,
      text,
    })
  }
  return words
}

function winAnsiSafe(text: string) {
  return text
    .normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

export async function ocrPdfToSearchable(
  file: File,
  language: OcrLanguage,
  dpi: number,
  skipPagesWithText: boolean,
  onProgress: OcrProgress,
): Promise<OcrResult> {
  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const pdfjs = await pdfjsLib.getDocument({ data: new Uint8Array(sourceBytes) }).promise
  const output = await PDFDocument.load(sourceBytes)
  const outputPages = output.getPages()
  const font = await output.embedFont(StandardFonts.Helvetica)
  let currentPage = 1
  let recognizedPages = 0
  let skippedPages = 0
  const textPages: string[] = []

  onProgress(2, 'Carregando motor OCR e modelo de idioma…')
  const { createWorker, OEM } = await import('tesseract.js')
  const langs = language === 'por+eng' ? ['por', 'eng'] : language
  const worker = await createWorker(langs, OEM.LSTM_ONLY, {
    logger: message => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        const pageFraction = (currentPage - 1 + message.progress) / Math.max(1, pdfjs.numPages)
        onProgress(8 + Math.round(pageFraction * 84), `OCR página ${currentPage}/${pdfjs.numPages}: ${Math.round(message.progress * 100)}%`)
      }
    },
  })

  try {
    for (let pageNumber = 1; pageNumber <= pdfjs.numPages; pageNumber++) {
      currentPage = pageNumber
      const sourcePage = await pdfjs.getPage(pageNumber)
      const existing = await sourcePage.getTextContent()
      const existingText = existing.items.map((item: any) => 'str' in item ? item.str : '').join(' ').trim()

      if (skipPagesWithText && existingText.replace(/\s/g, '').length >= 24) {
        textPages.push(existingText)
        skippedPages++
        onProgress(8 + Math.round((pageNumber / pdfjs.numPages) * 84), `Página ${pageNumber}/${pdfjs.numPages} já possui texto — preservada.`)
        continue
      }

      const viewport = sourcePage.getViewport({ scale: Math.max(1, dpi / 72) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await sourcePage.render({ canvasContext: ctx, viewport, canvas }).promise

      const recognition = await worker.recognize(canvas, {}, { text: true, tsv: true })
      const pageText = recognition.data.text?.trim() || ''
      textPages.push(pageText)
      recognizedPages++

      const words = parseTsv(recognition.data.tsv)
      const targetPage = outputPages[pageNumber - 1]
      const { width: pageWidth, height: pageHeight } = targetPage.getSize()
      const scaleX = pageWidth / canvas.width
      const scaleY = pageHeight / canvas.height

      for (const word of words) {
        const safe = winAnsiSafe(word.text)
        if (!safe) continue
        const size = Math.max(4, Math.min(42, word.height * scaleY * 0.82))
        const x = Math.max(0, word.left * scaleX)
        const y = Math.max(0, pageHeight - ((word.top + word.height) * scaleY))
        try {
          targetPage.drawText(safe, {
            x,
            y,
            size,
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
          })
        } catch {
          // Uma palavra com glifo não suportado não pode invalidar a página inteira.
        }
      }

      canvas.width = 1
      canvas.height = 1
      await nextFrame()
    }

    onProgress(94, 'Criando PDF pesquisável…')
    const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
    if (bytes.byteLength < 100) throw new Error('O OCR produziu um PDF inválido. O download foi bloqueado.')
    const text = textPages.join('\n\n--- PÁGINA ---\n\n')
    onProgress(100, 'OCR concluído.')
    return { bytes, text, recognizedPages, skippedPages, characters: text.length }
  } finally {
    await worker.terminate().catch(() => {})
    await pdfjs.destroy().catch(() => {})
  }
}
