import { APP_VERSION } from './appMeta'
import { PDFDocument } from 'pdf-lib'
import { jsPDF } from 'jspdf'
import type { PrepareDocumentOptions, PrepareDocumentResult } from './prepareDocument'
import { humanSize } from './files'

export const TRUST_REPORT_SCHEMA = 'pdf-studio-trust/v1' as const
export const TRUST_REPORT_VERSION = '1.0'
export const PDF_STUDIO_VERSION = APP_VERSION

export type TrustValidationStatus = 'passed' | 'warning' | 'info'

export type TrustFileSnapshot = {
  name: string
  sizeBytes: number
  pages: number
  sha256: string
}

export type TrustValidation = {
  key: string
  label: string
  status: TrustValidationStatus
  detail: string
}

export type TrustOperation = {
  key: string
  label: string
  beforeBytes: number
  afterBytes: number
  detail: string
}

export type TrustSettingsSummary = {
  presetName?: string
  compressionMode: string
  targetMb?: number
  ocr: boolean
  removeMetadata: boolean
  watermark: boolean
  pageNumbers: boolean
  pdfa: boolean
  pdfaVersion?: number
  removeBlank: boolean
}

export type DocumentTrustReport = {
  schema: typeof TRUST_REPORT_SCHEMA
  reportVersion: string
  reportId: string
  reportSha256: string
  createdAt: string
  application: {
    name: 'PDF Studio Web'
    version: string
    processingMode: 'local-browser'
  }
  source: TrustFileSnapshot
  output: TrustFileSnapshot
  operations: TrustOperation[]
  validations: TrustValidation[]
  settings: TrustSettingsSummary
  processing: {
    filesUploaded: false
    statement: string
  }
  disclaimer: string
}

export type TrustVerificationCheck = {
  key: string
  label: string
  ok: boolean
  expected: string
  actual: string
}

export type TrustVerificationResult = {
  matched: boolean
  snapshot: TrustFileSnapshot
  checks: TrustVerificationCheck[]
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256Bytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requer um contexto seguro (HTTPS ou localhost).')
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const stable = new Uint8Array(source.byteLength)
  stable.set(source)
  return hex(await crypto.subtle.digest('SHA-256', stable.buffer))
}


function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  const object = value as Record<string, unknown>
  const keys = Object.keys(object).filter(key => object[key] !== undefined).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
}

async function reportPayloadHash(report: Omit<DocumentTrustReport, 'reportSha256'>): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalJson(report)))
}

async function recomputeReportHash(report: DocumentTrustReport): Promise<string> {
  const { reportSha256: _ignored, ...payload } = report
  return reportPayloadHash(payload)
}

async function pagesFromBytes(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes.slice(), { updateMetadata: false })
  return doc.getPageCount()
}

export async function inspectTrustFile(file: File): Promise<TrustFileSnapshot> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pages = await pagesFromBytes(bytes)
  const sha256 = await sha256Bytes(bytes)
  return { name: file.name, sizeBytes: file.size, pages, sha256 }
}

function reportDateCode(iso: string): string {
  const date = new Date(iso)
  const yyyy = date.getFullYear().toString().padStart(4, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function settingsSummary(options: PrepareDocumentOptions, presetName?: string): TrustSettingsSummary {
  return {
    presetName: presetName || undefined,
    compressionMode: options.compressionMode,
    targetMb: options.compressionMode === 'target' ? options.targetMb : undefined,
    ocr: options.ocr,
    removeMetadata: options.removeMetadata,
    watermark: options.watermark,
    pageNumbers: options.pageNumbers,
    pdfa: options.pdfa,
    pdfaVersion: options.pdfa ? options.pdfaVersion : undefined,
    removeBlank: options.removeBlank,
  }
}

function buildValidations(result: PrepareDocumentResult, options: PrepareDocumentOptions): TrustValidation[] {
  const expectedPages = result.originalPages - result.removedBlankPages.length
  const pageIntegrity = expectedPages === result.finalPages
  const validations: TrustValidation[] = [
    {
      key: 'pdf-structure',
      label: 'Estrutura PDF',
      status: 'passed',
      detail: `Arquivo final aberto e validado com ${result.finalPages} página(s).`,
    },
    {
      key: 'page-integrity',
      label: 'Integridade de páginas',
      status: pageIntegrity ? 'passed' : 'warning',
      detail: pageIntegrity
        ? `Contagem compatível com o fluxo: ${result.originalPages} original(is) - ${result.removedBlankPages.length} removida(s) = ${result.finalPages} final(is).`
        : `Esperado ${expectedPages} página(s) após remoções, mas o resultado possui ${result.finalPages}. Revise o documento.`,
    },
    {
      key: 'hashes',
      label: 'Impressões SHA-256',
      status: 'passed',
      detail: 'Hashes SHA-256 calculados para o arquivo original e para o resultado final.',
    },
  ]

  if (options.compressionMode === 'target') {
    const limit = Math.max(0.1, options.targetMb) * 1024 * 1024
    const reached = result.finalBytes <= limit
    validations.push({
      key: 'target-size',
      label: 'Meta de tamanho',
      status: reached ? 'passed' : 'warning',
      detail: reached
        ? `Resultado ${humanSize(result.finalBytes)} dentro da meta de ${options.targetMb.toFixed(1)} MB.`
        : `Resultado ${humanSize(result.finalBytes)} acima da meta de ${options.targetMb.toFixed(1)} MB; foi preservado o melhor resultado seguro.`,
    })
  }

  if (options.ocr) {
    validations.push({
      key: 'ocr',
      label: 'OCR',
      status: 'info',
      detail: `${result.ocrRecognizedPages} página(s) processada(s) por OCR; ${result.ocrSkippedPages} página(s) já continham texto.`,
    })
  }

  if (options.removeMetadata) {
    validations.push({
      key: 'metadata',
      label: 'Limpeza de metadados',
      status: 'info',
      detail: options.pdfa
        ? 'Etapa de limpeza executada. A conversão PDF/A posterior pode inserir metadados técnicos obrigatórios do padrão arquivístico.'
        : 'Etapa de remoção de metadados documentais executada antes da validação final.',
    })
  }

  if (options.pdfa) {
    validations.push({
      key: 'pdfa',
      label: `PDF/A-${options.pdfaVersion}b`,
      status: 'info',
      detail: 'Conversão executada pelo motor PDF/A. Para conformidade regulatória formal, valide também em um validador PDF/A dedicado.',
    })
  }

  validations.push({
    key: 'local-processing',
    label: 'Processamento local',
    status: 'info',
    detail: 'O fluxo desta aplicação é executado no navegador. O Trust Report não contém o conteúdo textual do documento.',
  })

  return validations
}

export async function createDocumentTrustReport(
  source: File,
  result: PrepareDocumentResult,
  options: PrepareDocumentOptions,
  outputName: string,
  presetName?: string,
): Promise<DocumentTrustReport> {
  const createdAt = new Date().toISOString()
  const sourceBytes = new Uint8Array(await source.arrayBuffer())
  const [sourceHash, outputHash] = await Promise.all([
    sha256Bytes(sourceBytes),
    sha256Bytes(result.bytes),
  ])

  const sourceSnapshot: TrustFileSnapshot = {
    name: source.name,
    sizeBytes: source.size,
    pages: result.originalPages,
    sha256: sourceHash,
  }
  const outputSnapshot: TrustFileSnapshot = {
    name: outputName,
    sizeBytes: result.finalBytes,
    pages: result.finalPages,
    sha256: outputHash,
  }

  const base: Omit<DocumentTrustReport, 'reportSha256'> = {
    schema: TRUST_REPORT_SCHEMA,
    reportVersion: TRUST_REPORT_VERSION,
    reportId: `PS-${reportDateCode(createdAt)}-${outputHash.slice(0, 12).toUpperCase()}`,
    createdAt,
    application: {
      name: 'PDF Studio Web',
      version: PDF_STUDIO_VERSION,
      processingMode: 'local-browser',
    },
    source: sourceSnapshot,
    output: outputSnapshot,
    operations: result.reports.map(item => ({
      key: item.key,
      label: item.label,
      beforeBytes: item.beforeBytes,
      afterBytes: item.afterBytes,
      detail: item.detail,
    })),
    validations: buildValidations(result, options),
    settings: settingsSummary(options, presetName),
    processing: {
      filesUploaded: false,
      statement: 'Gerado por um fluxo local-first do PDF Studio Web. Os documentos são processados no navegador; o relatório registra somente dados técnicos, hashes e etapas.',
    },
    disclaimer: 'Este relatório é um registro técnico de processamento e integridade. Não é assinatura digital, carimbo do tempo, certificação jurídica, laudo pericial nem atestado de conformidade emitido por terceiro. O arquivo JSON desta versão não é assinado criptograficamente por uma autoridade externa.',
  }
  const reportSha256 = await reportPayloadHash(base)
  return { ...base, reportSha256 }
}

export function parseTrustReport(text: string): DocumentTrustReport {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('O arquivo informado não contém um JSON válido.') }
  if (!parsed || typeof parsed !== 'object') throw new Error('Trust Report inválido.')
  const value = parsed as Partial<DocumentTrustReport>
  if (value.schema !== TRUST_REPORT_SCHEMA || !value.reportId || !value.reportSha256 || !value.output?.sha256) {
    throw new Error('Este arquivo não é um Document Trust Report compatível com esta versão.')
  }
  return value as DocumentTrustReport
}

export async function verifyTrustReport(file: File, report: DocumentTrustReport): Promise<TrustVerificationResult> {
  const snapshot = await inspectTrustFile(file)
  const reportHash = await recomputeReportHash(report)
  const checks: TrustVerificationCheck[] = [
    {
      key: 'report-sha256',
      label: 'Integridade do relatório JSON',
      ok: reportHash.toLowerCase() === report.reportSha256.toLowerCase(),
      expected: report.reportSha256,
      actual: reportHash,
    },
    {
      key: 'sha256',
      label: 'SHA-256',
      ok: snapshot.sha256.toLowerCase() === report.output.sha256.toLowerCase(),
      expected: report.output.sha256,
      actual: snapshot.sha256,
    },
    {
      key: 'size',
      label: 'Tamanho do arquivo',
      ok: snapshot.sizeBytes === report.output.sizeBytes,
      expected: `${report.output.sizeBytes} bytes (${humanSize(report.output.sizeBytes)})`,
      actual: `${snapshot.sizeBytes} bytes (${humanSize(snapshot.sizeBytes)})`,
    },
    {
      key: 'pages',
      label: 'Quantidade de páginas',
      ok: snapshot.pages === report.output.pages,
      expected: `${report.output.pages}`,
      actual: `${snapshot.pages}`,
    },
  ]
  return { matched: checks.every(item => item.ok), snapshot, checks }
}

export function trustReportJsonBlob(report: DocumentTrustReport): Blob {
  return new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function trustReportPdfBlob(report: DocumentTrustReport): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const width = 210
  const margin = 16
  const bodyWidth = width - margin * 2
  let y = 18

  const ensure = (needed = 10) => {
    if (y + needed > 282) { doc.addPage(); y = 18 }
  }
  const line = (label: string, value: string, small = false) => {
    ensure(small ? 8 : 10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(small ? 8 : 9); doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(small ? 8 : 9)
    const lines = doc.splitTextToSize(value, bodyWidth - 46)
    doc.text(lines, margin + 46, y)
    y += Math.max(5, lines.length * 4.2)
  }
  const section = (title: string) => {
    ensure(14); y += 3
    doc.setDrawColor(50, 78, 99); doc.line(margin, y, width - margin, y); y += 7
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(title, margin, y); y += 6
  }

  doc.setFillColor(10, 26, 39); doc.rect(0, 0, width, 38, 'F')
  doc.setTextColor(57, 239, 136); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('PDF STUDIO', margin, 16)
  doc.setTextColor(235, 244, 252); doc.setFontSize(15); doc.text('Document Trust Report', margin, 25)
  doc.setTextColor(160, 179, 197); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(report.reportId, margin, 32)
  doc.setTextColor(30, 43, 55)
  y = 48

  line('Gerado em', new Date(report.createdAt).toLocaleString('pt-BR'))
  line('Aplicacao', `${report.application.name} v${report.application.version}`)
  line('Hash do relatorio', report.reportSha256, true)
  line('Processamento', 'Local no navegador (local-browser)')
  if (report.settings.presetName) line('Preset', report.settings.presetName)

  section('Arquivo original')
  line('Nome', report.source.name)
  line('Tamanho', `${humanSize(report.source.sizeBytes)} (${report.source.sizeBytes} bytes)`)
  line('Paginas', `${report.source.pages}`)
  line('SHA-256', report.source.sha256, true)

  section('Arquivo final')
  line('Nome', report.output.name)
  line('Tamanho', `${humanSize(report.output.sizeBytes)} (${report.output.sizeBytes} bytes)`)
  line('Paginas', `${report.output.pages}`)
  line('SHA-256', report.output.sha256, true)

  section('Etapas executadas')
  report.operations.forEach((operation, index) => {
    ensure(13)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(`${index + 1}. ${operation.label}`, margin, y); y += 4.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    const detail = `${operation.detail} | ${humanSize(operation.beforeBytes)} -> ${humanSize(operation.afterBytes)}`
    const lines = doc.splitTextToSize(detail, bodyWidth)
    doc.text(lines, margin, y); y += lines.length * 3.8 + 2.5
  })

  section('Validacoes')
  report.validations.forEach(validation => {
    ensure(11)
    const prefix = validation.status === 'passed' ? 'OK' : validation.status === 'warning' ? 'ATENCAO' : 'INFO'
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(`${prefix} - ${validation.label}`, margin, y); y += 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8)
    const lines = doc.splitTextToSize(validation.detail, bodyWidth)
    doc.text(lines, margin, y); y += lines.length * 3.6 + 2
  })

  section('Privacidade e escopo')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  let lines = doc.splitTextToSize(report.processing.statement, bodyWidth)
  doc.text(lines, margin, y); y += lines.length * 3.8 + 4
  lines = doc.splitTextToSize(report.disclaimer, bodyWidth)
  doc.setTextColor(105, 116, 126); doc.text(lines, margin, y)

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setTextColor(130, 140, 150); doc.setFontSize(7)
    doc.text(`Document Trust Report • ${report.reportId} • pagina ${page}/${pages}`, margin, 292)
  }

  return doc.output('blob')
}
