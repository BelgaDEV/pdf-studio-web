import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type QualityCaseName =
  | 'merge'
  | 'split'
  | 'compress'
  | 'redaction'
  | 'compare'
  | 'protect'
  | 'pdfa'
  | 'word-to-pdf'
  | 'prepare'
  | 'ocr'

export type QualityCaseResult = {
  case: QualityCaseName
  durationMs: number
  details: Record<string, string | number | boolean>
}

const noopProgress = () => {}

function toFile(bytes: Uint8Array | ArrayBuffer | Blob, name: string, type = 'application/pdf'): File {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type })
  return new File([blob], name, { type, lastModified: 1700000000000 })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function pageCount(bytes: Uint8Array | ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getPageCount()
}

async function textPdf(
  pages: string[],
  metadata: { title?: string; author?: string; subject?: string } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  if (metadata.title) doc.setTitle(metadata.title)
  if (metadata.author) doc.setAuthor(metadata.author)
  if (metadata.subject) doc.setSubject(metadata.subject)

  for (const [index, text] of pages.entries()) {
    const page = doc.addPage([595, 842])
    page.drawText(`QUALITY GATE ${index + 1}`, { x: 48, y: 790, size: 10, font, color: rgb(0.35, 0.35, 0.35) })
    const lines = text.match(/.{1,78}(?:\s|$)/g) || [text]
    let y = 720
    for (const line of lines.slice(0, 24)) {
      page.drawText(line.trim(), { x: 56, y, size: 14, font, color: rgb(0.08, 0.08, 0.08) })
      y -= 24
    }
  }
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

function seededNoise(width: number, height: number, seed: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state & 0xff
  }
  for (let i = 0; i < width * height; i++) {
    const p = i * 4
    data[p] = random()
    data[p + 1] = random()
    data[p + 2] = random()
    data[p + 3] = 255
  }
  return new ImageData(data, width, height)
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`Canvas não gerou ${type}.`)), type, quality)
  })
}

async function imageHeavyPdf(pageTotal = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageTotal; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 700
    canvas.height = 700
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(seededNoise(canvas.width, canvas.height, 0xC0FFEE + i * 101), 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(18, 18, 300, 54)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 24px Arial'
    ctx.fillText(`QUALITY IMAGE ${i + 1}`, 32, 54)
    const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.88)).arrayBuffer())
    const image = await doc.embedJpg(jpeg)
    const page = doc.addPage([595, 595])
    page.drawImage(image, { x: 0, y: 0, width: 595, height: 595 })
    canvas.width = 1
    canvas.height = 1
  }
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

async function scannedPdf(text: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 520
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 112px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const png = new Uint8Array(await (await canvasBlob(canvas, 'image/png')).arrayBuffer())
  const doc = await PDFDocument.create()
  const image = await doc.embedPng(png)
  const page = doc.addPage([800, 260])
  page.drawImage(image, { x: 0, y: 0, width: 800, height: 260 })
  canvas.width = 1
  canvas.height = 1
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

async function extractText(bytes: Uint8Array, name = 'quality.pdf'): Promise<string> {
  const { extractPdfText } = await import('/src/lib/pdf.ts')
  const pages = await extractPdfText(toFile(bytes, name), noopProgress)
  return pages.join('\n')
}

async function runMerge(): Promise<Record<string, string | number | boolean>> {
  const { mergePdfs } = await import('/src/lib/pdf.ts')
  const a = toFile(await textPdf(['DOCUMENTO ALFA. Conteúdo jurídico fictício para teste de mesclagem.']), 'alfa.pdf')
  const b = toFile(await textPdf(['DOCUMENTO BETA. Segunda peça fictícia para validar ordem e integridade.']), 'beta.pdf')
  const result = await mergePdfs([a, b], noopProgress, { createBookmarks: false, createTableOfContents: false })
  const bytes = new Uint8Array(await result.blob.arrayBuffer())
  assert(await pageCount(bytes) === 2, 'Juntar PDF alterou a quantidade esperada de páginas.')
  const text = (await extractText(bytes, 'merged.pdf')).toUpperCase()
  assert(text.includes('DOCUMENTO ALFA') && text.includes('DOCUMENTO BETA'), 'Juntar PDF perdeu conteúdo textual de uma das entradas.')
  return { pages: 2, engine: result.engine, bytes: bytes.byteLength }
}

async function runSplit(): Promise<Record<string, string | number | boolean>> {
  const { splitPdfBySize } = await import('/src/lib/pdf.ts')
  const sourceBytes = await imageHeavyPdf(3)
  const parts = await splitPdfBySize(toFile(sourceBytes, 'dossie-imagens.pdf'), 0.18, noopProgress)
  assert(parts.length >= 2, `Dividir PDF deveria criar múltiplas partes; criou ${parts.length}.`)
  let totalPages = 0
  for (const part of parts) {
    assert(part.byteLength > 100, 'Dividir PDF gerou uma parte vazia.')
    totalPages += await pageCount(part)
  }
  assert(totalPages === 3, `Dividir PDF perdeu/duplicou páginas: esperado 3, obtido ${totalPages}.`)
  return { parts: parts.length, totalPages, sourceBytes: sourceBytes.byteLength }
}

async function runCompress(): Promise<Record<string, string | number | boolean>> {
  const { compressPdf } = await import('/src/lib/pdf.ts')
  const sourceBytes = await imageHeavyPdf(1)
  const result = await compressPdf(toFile(sourceBytes, 'imagem-pesada.pdf'), 'medium', noopProgress)
  assert(result.bytes.byteLength > 100, 'Comprimir PDF gerou saída vazia.')
  assert(await pageCount(result.bytes) === 1, 'Comprimir PDF alterou a quantidade de páginas.')
  assert(String(result.engine).includes('ghostscript'), `Compressão média não passou pelo Ghostscript: ${result.engine}.`)
  return { engine: result.engine, beforeBytes: sourceBytes.byteLength, afterBytes: result.bytes.byteLength, rasterized: result.rasterized }
}

async function runRedaction(): Promise<Record<string, string | number | boolean>> {
  const { permanentlyRedactPdf } = await import('/src/lib/redaction.ts')
  const source = await textPdf(['SEGREDO-QUALITY-92741 CPF FICTÍCIO 123.456.789-00. Texto que não pode sobreviver na camada textual.'])
  const result = await permanentlyRedactPdf(
    toFile(source, 'segredo.pdf'),
    { 1: [{ id: 'quality-redaction', x: 0.05, y: 0.08, width: 0.90, height: 0.20 }] },
    { dpi: 160, jpegQuality: 0.90 },
    noopProgress,
  )
  const text = (await extractText(result.bytes, 'redacted.pdf')).toUpperCase()
  assert(!text.includes('SEGREDO-QUALITY-92741'), 'Redação permanente deixou o conteúdo sensível na camada de texto.')
  assert(result.verifiedPages === 1 && result.redactionCount === 1, 'Redação permanente não confirmou a página redigida.')
  return { pages: result.pageCount, redactedPages: result.redactedPages, redactions: result.redactionCount, searchableSecret: text.includes('SEGREDO') }
}

async function runCompare(): Promise<Record<string, string | number | boolean>> {
  const { comparePdfFiles } = await import('/src/lib/pdfCompare.ts')
  const original = toFile(await textPdf(['CLÁUSULA 4. O pagamento ocorrerá em 30 dias após a entrega.']), 'contrato-original.pdf')
  const revised = toFile(await textPdf(['CLÁUSULA 4. O pagamento ocorrerá em 45 dias após a entrega, incluindo despesas administrativas.']), 'contrato-revisado.pdf')
  const result = await comparePdfFiles(original, revised, { visual: false }, noopProgress)
  assert(result.summary.totalDifferences >= 1, 'Comparar PDF não detectou alteração textual conhecida.')
  assert(result.pages.some(page => page.status === 'modified'), 'Comparar PDF não marcou a página alterada como modificada.')
  const changed = result.pages.find(page => page.status === 'modified')
  assert((changed?.textChange.addedWords || 0) > 0 || (changed?.textChange.removedWords || 0) > 0, 'Comparar PDF não calculou delta de palavras.')
  return { totalDifferences: result.summary.totalDifferences, modified: result.summary.modified, addedWords: changed?.textChange.addedWords || 0, removedWords: changed?.textChange.removedWords || 0 }
}

async function runProtect(): Promise<Record<string, string | number | boolean>> {
  const { protectPdfWithPassword } = await import('/src/lib/documentTools.ts')
  const password = 'Quality-2026!'
  const source = await textPdf(['DOCUMENTO PROTEGIDO — conteúdo fictício do Quality Gate.'])
  const protectedBytes = await protectPdfWithPassword(toFile(source, 'protegido.pdf'), password, noopProgress)
  assert(protectedBytes.byteLength > 100, 'Proteger PDF gerou saída vazia.')

  let opensWithoutPassword = true
  try { await PDFDocument.load(protectedBytes) } catch { opensWithoutPassword = false }
  assert(!opensWithoutPassword, 'PDF protegido abriu sem senha no parser de validação.')

  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    const result: any = await qpdf.exec([
      `--password=${password}`,
      '--decrypt',
      '--',
      '/protected.pdf',
      '/decrypted.pdf',
    ], {
      files: [{ name: '/protected.pdf', data: protectedBytes }],
      outputs: ['/decrypted.pdf'],
    })
    const decrypted = result.files?.[0]?.data
    assert(decrypted, 'qpdf não conseguiu reabrir o PDF usando a senha definida.')
    const decryptedBytes = decrypted instanceof Uint8Array ? decrypted : new Uint8Array(decrypted)
    assert(await pageCount(decryptedBytes) === 1, 'PDF protegido não preservou a página após descriptografia de verificação.')
  } finally {
    qpdf.dispose()
  }
  return { encrypted: true, passwordVerified: true, bytes: protectedBytes.byteLength }
}

async function runPdfA(): Promise<Record<string, string | number | boolean>> {
  const { convertToPdfA } = await import('/src/lib/documentTools.ts')
  const source = await textPdf(['ARQUIVO PDF/A QUALITY GATE. Documento fictício para validar a conversão estrutural.'])
  const output = await convertToPdfA(toFile(source, 'arquivo.pdf'), 2, noopProgress)
  assert(output.byteLength > 100, 'PDF/A gerou saída vazia.')
  assert(await pageCount(output) === 1, 'PDF/A alterou a quantidade de páginas.')
  const raw = new TextDecoder('latin1').decode(output.subarray(0, Math.min(output.length, 250_000)))
  return { pages: 1, bytes: output.byteLength, pdfaMarkerVisible: /pdfaid:part|GTS_PDFA|OutputIntent/i.test(raw), structuralValidation: true }
}

async function runWordToPdf(): Promise<Record<string, string | number | boolean>> {
  const [{ Document, Packer, Paragraph, TextRun }, { wordToPdf }] = await Promise.all([
    import('docx'),
    import('/src/lib/word.ts'),
  ])
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ children: [new TextRun({ text: 'QUALITY GATE WORD', bold: true })] }),
        new Paragraph('Contrato fictício convertido de DOCX para PDF pelo teste de integração.'),
      ],
    }],
  })
  const docxBlob = await Packer.toBlob(doc)
  const pdfBlob = await wordToPdf(toFile(docxBlob, 'quality.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), noopProgress)
  const bytes = new Uint8Array(await pdfBlob.arrayBuffer())
  assert(bytes.byteLength > 100, 'Word → PDF gerou saída vazia.')
  const pages = await pageCount(bytes)
  assert(pages >= 1, 'Word → PDF não produziu nenhuma página.')
  return { pages, docxBytes: docxBlob.size, pdfBytes: bytes.byteLength }
}

async function runPrepare(): Promise<Record<string, string | number | boolean>> {
  const { prepareDocument } = await import('/src/lib/prepareDocument.ts')
  const source = await textPdf(
    ['PETIÇÃO FICTÍCIA QUALITY GATE. Documento com metadados para o fluxo Preparar Documento.'],
    { title: 'Título Sensível', author: 'Autor Interno', subject: 'Quality Gate' },
  )
  const result = await prepareDocument(toFile(source, 'peticao.pdf'), {
    removeBlank: false,
    blankSensitivity: 'normal',
    compressionMode: 'off',
    targetMb: 1,
    ocr: false,
    ocrLanguage: 'por',
    ocrDpi: 180,
    ocrSkipPagesWithText: true,
    removeMetadata: true,
    watermark: true,
    watermarkText: 'CONFIDENCIAL QUALITY',
    watermarkOpacity: 0.20,
    watermarkFontSize: 40,
    watermarkRotation: -28,
    watermarkPosition: 'center',
    pageNumbers: true,
    pageNumberStart: 1,
    pageNumberFontSize: 10,
    pageNumberPosition: 'bottom-center',
    pageNumberShowTotal: false,
    pageNumberPrefix: 'QG-',
    pdfa: false,
    pdfaVersion: 2,
  }, noopProgress)
  assert(result.originalPages === 1 && result.finalPages === 1, 'Preparar Documento alterou a quantidade de páginas.')
  assert(result.reports.length === 3, `Preparar Documento executou ${result.reports.length} etapas; esperado 3.`)
  const outputDoc = await PDFDocument.load(result.bytes, { updateMetadata: false })
  assert(!outputDoc.getTitle() && !outputDoc.getAuthor(), 'Preparar Documento preservou metadados que deveriam ter sido removidos.')
  const text = (await extractText(result.bytes, 'prepared.pdf')).toUpperCase()
  assert(text.includes('CONFIDENCIAL QUALITY'), 'Preparar Documento não aplicou a marca d’água esperada.')
  assert(text.includes('QG-1'), 'Preparar Documento não aplicou a numeração esperada.')
  return { reports: result.reports.length, originalPages: result.originalPages, finalPages: result.finalPages, finalBytes: result.finalBytes }
}

async function runOcr(): Promise<Record<string, string | number | boolean>> {
  const { ocrPdfToSearchable } = await import('/src/lib/ocr.ts')
  const source = await scannedPdf('QUALITY OCR 2026')
  const result = await ocrPdfToSearchable(toFile(source, 'scan-quality.pdf'), 'eng', 180, false, noopProgress)
  assert(result.recognizedPages === 1, `OCR reconheceu ${result.recognizedPages} página(s); esperado 1.`)
  assert(result.characters >= 5, `OCR retornou poucos caracteres (${result.characters}).`)
  const recognized = result.text.toUpperCase().replace(/\s+/g, ' ')
  assert(recognized.includes('OCR') || recognized.includes('QUALITY') || recognized.includes('2026'), `OCR não reconheceu o texto de controle. Retorno: ${recognized.slice(0, 120)}`)
  const searchable = (await extractText(result.bytes, 'ocr-searchable.pdf')).toUpperCase().replace(/\s+/g, ' ')
  assert(searchable.includes('OCR') || searchable.includes('QUALITY') || searchable.includes('2026'), 'OCR gerou PDF, mas a camada pesquisável não contém o texto reconhecido.')
  return { recognizedPages: result.recognizedPages, skippedPages: result.skippedPages, characters: result.characters, searchableLayer: true }
}

export async function runQualityCase(name: QualityCaseName): Promise<QualityCaseResult> {
  const started = performance.now()
  let details: Record<string, string | number | boolean>
  if (name === 'merge') details = await runMerge()
  else if (name === 'split') details = await runSplit()
  else if (name === 'compress') details = await runCompress()
  else if (name === 'redaction') details = await runRedaction()
  else if (name === 'compare') details = await runCompare()
  else if (name === 'protect') details = await runProtect()
  else if (name === 'pdfa') details = await runPdfA()
  else if (name === 'word-to-pdf') details = await runWordToPdf()
  else if (name === 'prepare') details = await runPrepare()
  else if (name === 'ocr') details = await runOcr()
  else throw new Error(`Caso de qualidade desconhecido: ${String(name)}`)
  return { case: name, durationMs: Math.round(performance.now() - started), details }
}
