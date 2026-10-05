import {
  PDFDocument,
  PDFName,
  PDFNumber,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib'
import type { PdfBookmarkSpec } from './bookmarks'

export interface TocResult {
  pagesCreated: number
  entriesCreated: number
  shiftedSpecs: PdfBookmarkSpec[]
}

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN_X = 52
const TOP_Y = 760
const ROW_HEIGHT = 22
const ROWS_PER_PAGE = 27
const TITLE_SIZE = 20
const ROW_SIZE = 10.5
const PAGE_NO_SIZE = 10

function cleanTitle(title: string, fallbackIndex: number): string {
  const normalized = title.replace(/\.pdf$/i, '').trim()
  return normalized || `Documento ${fallbackIndex + 1}`
}

function asciiFallback(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '?')
}

function widthSafe(font: PDFFont, text: string, size: number): { text: string; width: number } {
  try {
    return { text, width: font.widthOfTextAtSize(text, size) }
  } catch {
    const safe = asciiFallback(text)
    return { text: safe, width: font.widthOfTextAtSize(safe, size) }
  }
}

function fitText(font: PDFFont, input: string, maxWidth: number, size: number): string {
  let candidate = cleanTitle(input, 0)
  let measured = widthSafe(font, candidate, size)
  if (measured.width <= maxWidth) return measured.text

  const suffix = '…'
  const fallbackSuffix = '...'
  const suffixWidth = (() => {
    try { return font.widthOfTextAtSize(suffix, size) } catch { return font.widthOfTextAtSize(fallbackSuffix, size) }
  })()
  const renderedSuffix = (() => {
    try { font.encodeText(suffix); return suffix } catch { return fallbackSuffix }
  })()

  candidate = measured.text
  while (candidate.length > 3) {
    candidate = candidate.slice(0, -1)
    const width = font.widthOfTextAtSize(candidate, size)
    if (width + suffixWidth <= maxWidth) return candidate.trimEnd() + renderedSuffix
  }
  return candidate
}

function addLinkAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  target: PDFPage,
  rect: [number, number, number, number],
  refs: PDFRef[],
): void {
  const { context } = pdfDoc
  const annotation = context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: context.obj(rect.map(value => PDFNumber.of(value))),
    Border: context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
    Dest: context.obj([target.ref, PDFName.of('Fit')]),
  })
  refs.push(context.register(annotation))
  page.node.set(PDFName.of('Annots'), context.obj(refs))
}

/**
 * Insere um índice clicável no início do PDF.
 * `specs.pageIndex` deve apontar para as páginas do documento antes da inserção do índice.
 */
export async function addClickableTableOfContents(
  pdfDoc: PDFDocument,
  specs: PdfBookmarkSpec[],
  title = 'Índice de documentos',
): Promise<TocResult> {
  const validSpecs = specs
    .map((spec, index) => ({ title: cleanTitle(spec.title, index), pageIndex: Math.trunc(spec.pageIndex) }))
    .filter(spec => spec.pageIndex >= 0 && spec.pageIndex < pdfDoc.getPageCount())

  if (validSpecs.length === 0) return { pagesCreated: 0, entriesCreated: 0, shiftedSpecs: [] }

  const tocPages = Math.max(1, Math.ceil(validSpecs.length / ROWS_PER_PAGE))
  for (let i = 0; i < tocPages; i++) pdfDoc.insertPage(i, [A4_WIDTH, A4_HEIGHT])

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const allPages = pdfDoc.getPages()
  const contentPages = allPages.slice(tocPages)

  for (let tocPageIndex = 0; tocPageIndex < tocPages; tocPageIndex++) {
    const page = allPages[tocPageIndex]
    const linkRefs: PDFRef[] = []
    const sliceStart = tocPageIndex * ROWS_PER_PAGE
    const sliceEnd = Math.min(validSpecs.length, sliceStart + ROWS_PER_PAGE)

    page.drawText(fitText(bold, title || 'Índice de documentos', 430, TITLE_SIZE), {
      x: MARGIN_X,
      y: 790,
      size: TITLE_SIZE,
      font: bold,
      color: rgb(0.08, 0.13, 0.2),
    })
    page.drawText(`Página ${tocPageIndex + 1} de ${tocPages}`, {
      x: 466,
      y: 794,
      size: 8,
      font: regular,
      color: rgb(0.42, 0.48, 0.56),
    })
    page.drawLine({
      start: { x: MARGIN_X, y: 777 },
      end: { x: A4_WIDTH - MARGIN_X, y: 777 },
      thickness: 0.7,
      color: rgb(0.78, 0.82, 0.86),
    })

    for (let index = sliceStart; index < sliceEnd; index++) {
      const spec = validSpecs[index]
      const row = index - sliceStart
      const y = TOP_Y - row * ROW_HEIGHT
      const destinationPage = contentPages[spec.pageIndex]
      if (!destinationPage) continue

      const numberText = String(tocPages + spec.pageIndex + 1)
      const numberWidth = regular.widthOfTextAtSize(numberText, PAGE_NO_SIZE)
      const titleMaxWidth = 405
      const displayTitle = fitText(regular, spec.title, titleMaxWidth, ROW_SIZE)

      page.drawText(displayTitle, {
        x: MARGIN_X,
        y,
        size: ROW_SIZE,
        font: regular,
        color: rgb(0.08, 0.19, 0.31),
      })
      page.drawLine({
        start: { x: MARGIN_X, y: y - 5.5 },
        end: { x: A4_WIDTH - MARGIN_X, y: y - 5.5 },
        thickness: 0.35,
        color: rgb(0.86, 0.89, 0.92),
      })
      page.drawText(numberText, {
        x: A4_WIDTH - MARGIN_X - numberWidth,
        y,
        size: PAGE_NO_SIZE,
        font: bold,
        color: rgb(0.08, 0.35, 0.22),
      })

      addLinkAnnotation(pdfDoc, page, destinationPage, [MARGIN_X - 4, y - 6, A4_WIDTH - MARGIN_X + 4, y + 13], linkRefs)
    }

    page.drawText('Clique em um documento para ir diretamente à sua primeira página.', {
      x: MARGIN_X,
      y: 48,
      size: 8.5,
      font: regular,
      color: rgb(0.42, 0.48, 0.56),
    })
  }

  return {
    pagesCreated: tocPages,
    entriesCreated: validSpecs.length,
    shiftedSpecs: validSpecs.map(spec => ({ ...spec, pageIndex: spec.pageIndex + tocPages })),
  }
}
