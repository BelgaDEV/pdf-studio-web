import { PDFDocument } from 'pdf-lib'
import { compressPdf, compressPdfToTarget, type CompressionMode } from './pdf'
import { ocrPdfToSearchable, type OcrLanguage } from './ocr'
import {
  addPageNumbers,
  addWatermark,
  convertToPdfA,
  removeBlankPages,
  removePdfMetadata,
  type BlankSensitivity,
  type NumberPosition,
  type PdfaVersion,
  type WatermarkPosition,
} from './documentTools'

export type PrepareCompressionMode = 'off' | CompressionMode
export type PrepareStepKey = 'remove-blank' | 'compress' | 'ocr' | 'remove-metadata' | 'watermark' | 'page-numbers' | 'pdfa'
export type PrepareStepState = 'pending' | 'working' | 'done' | 'skipped' | 'error'

export type PrepareDocumentOptions = {
  removeBlank: boolean
  blankSensitivity: BlankSensitivity
  compressionMode: PrepareCompressionMode
  targetMb: number
  ocr: boolean
  ocrLanguage: OcrLanguage
  ocrDpi: number
  ocrSkipPagesWithText: boolean
  removeMetadata: boolean
  watermark: boolean
  watermarkText: string
  watermarkOpacity: number
  watermarkFontSize: number
  watermarkRotation: number
  watermarkPosition: WatermarkPosition
  pageNumbers: boolean
  pageNumberStart: number
  pageNumberFontSize: number
  pageNumberPosition: NumberPosition
  pageNumberShowTotal: boolean
  pageNumberPrefix: string
  pdfa: boolean
  pdfaVersion: PdfaVersion
}

export type PrepareStepReport = {
  key: PrepareStepKey
  label: string
  beforeBytes: number
  afterBytes: number
  detail: string
}

export type PrepareDocumentResult = {
  bytes: Uint8Array
  originalBytes: number
  finalBytes: number
  originalPages: number
  finalPages: number
  reports: PrepareStepReport[]
  removedBlankPages: number[]
  ocrRecognizedPages: number
  ocrSkippedPages: number
}

export type PrepareProgressFn = (
  overallProgress: number,
  message: string,
  step: PrepareStepKey,
  state: PrepareStepState,
) => void

const stepLabels: Record<PrepareStepKey, string> = {
  'remove-blank': 'Remover páginas em branco',
  compress: 'Comprimir',
  ocr: 'OCR pesquisável',
  'remove-metadata': 'Remover metadados',
  watermark: 'Marca d’água',
  'page-numbers': 'Numeração de páginas',
  pdfa: 'Converter para PDF/A',
}

function enabledSteps(options: PrepareDocumentOptions): PrepareStepKey[] {
  const steps: PrepareStepKey[] = []
  if (options.removeBlank) steps.push('remove-blank')
  if (options.compressionMode !== 'off') steps.push('compress')
  if (options.ocr) steps.push('ocr')
  if (options.removeMetadata) steps.push('remove-metadata')
  if (options.watermark) steps.push('watermark')
  if (options.pageNumbers) steps.push('page-numbers')
  if (options.pdfa) steps.push('pdfa')
  return steps
}

function fileFromBytes(bytes: Uint8Array, name: string): File {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return new File([blob], name, { type: 'application/pdf', lastModified: Date.now() })
}

function pctDelta(before: number, after: number) {
  if (!before) return '0%'
  const value = ((after - before) / before) * 100
  if (Math.abs(value) < 0.05) return 'sem alteração de tamanho'
  return value < 0 ? `${Math.abs(value).toFixed(1)}% menor` : `${value.toFixed(1)}% maior`
}

export async function prepareDocument(
  source: File,
  options: PrepareDocumentOptions,
  onProgress: PrepareProgressFn,
): Promise<PrepareDocumentResult> {
  const steps = enabledSteps(options)
  if (!steps.length) throw new Error('Selecione pelo menos uma etapa para preparar o documento.')

  const originalBytes = source.size
  const originalDoc = await PDFDocument.load(new Uint8Array(await source.arrayBuffer()), { updateMetadata: false })
  const originalPages = originalDoc.getPageCount()
  if (!originalPages) throw new Error('O PDF não possui páginas válidas.')

  let current = source
  const reports: PrepareStepReport[] = []
  let removedBlankPages: number[] = []
  let ocrRecognizedPages = 0
  let ocrSkippedPages = 0

  const reportProgress = (
    stepIndex: number,
    step: PrepareStepKey,
    value: number,
    message: string,
  ) => {
    const normalized = Math.max(0, Math.min(100, value)) / 100
    const overall = Math.min(99, Math.max(1, Math.round(((stepIndex + normalized) / steps.length) * 100)))
    onProgress(overall, `${stepLabels[step]}: ${message}`, step, 'working')
  }

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex]
    const beforeBytes = current.size
    onProgress(Math.round((stepIndex / steps.length) * 100), `Iniciando ${stepLabels[step]}…`, step, 'working')

    try {
      if (step === 'remove-blank') {
        const result = await removeBlankPages(current, options.blankSensitivity, (value, message) => reportProgress(stepIndex, step, value, message))
        removedBlankPages = result.removedPages
        current = fileFromBytes(result.bytes, source.name)
        reports.push({
          key: step,
          label: stepLabels[step],
          beforeBytes,
          afterBytes: current.size,
          detail: result.removedPages.length
            ? `${result.removedPages.length} página(s) removida(s): ${result.removedPages.slice(0, 12).join(', ')}${result.removedPages.length > 12 ? '…' : ''}`
            : 'Nenhuma página em branco encontrada.',
        })
      } else if (step === 'compress') {
        if (options.compressionMode === 'target') {
          const result = await compressPdfToTarget(current, options.targetMb, (value, message) => reportProgress(stepIndex, step, value, message))
          current = fileFromBytes(result.bytes, source.name)
          reports.push({
            key: step,
            label: stepLabels[step],
            beforeBytes,
            afterBytes: current.size,
            detail: `${result.targetReached ? 'Meta atingida' : 'Melhor resultado seguro'} • ${pctDelta(beforeBytes, current.size)}${result.rasterized ? ' • páginas rasterizadas' : ''}`,
          })
        } else {
          const mode = options.compressionMode as Exclude<CompressionMode, 'target'>
          const result = await compressPdf(current, mode, (value, message) => reportProgress(stepIndex, step, value, message))
          current = fileFromBytes(result.bytes, source.name)
          reports.push({
            key: step,
            label: stepLabels[step],
            beforeBytes,
            afterBytes: current.size,
            detail: `${pctDelta(beforeBytes, current.size)} • ${result.rasterized ? 'páginas rasterizadas' : 'estrutura preservada quando possível'}`,
          })
        }
      } else if (step === 'ocr') {
        const result = await ocrPdfToSearchable(
          current,
          options.ocrLanguage,
          options.ocrDpi,
          options.ocrSkipPagesWithText,
          (value, message) => reportProgress(stepIndex, step, value, message),
        )
        ocrRecognizedPages = result.recognizedPages
        ocrSkippedPages = result.skippedPages
        current = fileFromBytes(result.bytes, source.name)
        reports.push({
          key: step,
          label: stepLabels[step],
          beforeBytes,
          afterBytes: current.size,
          detail: `${result.recognizedPages} página(s) reconhecida(s) • ${result.skippedPages} já possuíam texto`,
        })
      } else if (step === 'remove-metadata') {
        const result = await removePdfMetadata(current, (value, message) => reportProgress(stepIndex, step, value, message))
        current = fileFromBytes(result.bytes, source.name)
        reports.push({
          key: step,
          label: stepLabels[step],
          beforeBytes,
          afterBytes: current.size,
          detail: `Metadados documentais removidos • motor ${result.engine === 'qpdf' ? 'qpdf' : 'pdf-lib'}`,
        })
      } else if (step === 'watermark') {
        const bytes = await addWatermark(current, {
          text: options.watermarkText,
          opacity: options.watermarkOpacity,
          fontSize: options.watermarkFontSize,
          rotation: options.watermarkRotation,
          position: options.watermarkPosition,
        }, (value, message) => reportProgress(stepIndex, step, value, message))
        current = fileFromBytes(bytes, source.name)
        reports.push({ key: step, label: stepLabels[step], beforeBytes, afterBytes: current.size, detail: `Marca “${options.watermarkText.trim()}” aplicada.` })
      } else if (step === 'page-numbers') {
        const bytes = await addPageNumbers(current, {
          startAt: options.pageNumberStart,
          fontSize: options.pageNumberFontSize,
          position: options.pageNumberPosition,
          showTotal: options.pageNumberShowTotal,
          prefix: options.pageNumberPrefix,
        }, (value, message) => reportProgress(stepIndex, step, value, message))
        current = fileFromBytes(bytes, source.name)
        reports.push({ key: step, label: stepLabels[step], beforeBytes, afterBytes: current.size, detail: 'Numeração aplicada em todas as páginas finais.' })
      } else if (step === 'pdfa') {
        const bytes = await convertToPdfA(current, options.pdfaVersion, (value, message) => reportProgress(stepIndex, step, value, message))
        current = fileFromBytes(bytes, source.name)
        reports.push({ key: step, label: stepLabels[step], beforeBytes, afterBytes: current.size, detail: `Convertido para PDF/A-${options.pdfaVersion}b.` })
      }

      onProgress(Math.round(((stepIndex + 1) / steps.length) * 100), `${stepLabels[step]} concluído.`, step, 'done')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      onProgress(Math.round((stepIndex / steps.length) * 100), `${stepLabels[step]} falhou: ${message}`, step, 'error')
      throw new Error(`${stepLabels[step]}: ${message}`)
    }
  }

  const finalBytes = new Uint8Array(await current.arrayBuffer())
  if (finalBytes.byteLength < 100) throw new Error('O documento final ficou vazio ou inválido.')
  const finalDoc = await PDFDocument.load(finalBytes, { updateMetadata: false })
  const finalPages = finalDoc.getPageCount()
  if (!finalPages) throw new Error('O documento final não possui páginas válidas.')

  const lastStep = steps[steps.length - 1]
  onProgress(100, 'Documento preparado e validado.', lastStep, 'done')
  return {
    bytes: finalBytes,
    originalBytes,
    finalBytes: finalBytes.byteLength,
    originalPages,
    finalPages,
    reports,
    removedBlankPages,
    ocrRecognizedPages,
    ocrSkippedPages,
  }
}
