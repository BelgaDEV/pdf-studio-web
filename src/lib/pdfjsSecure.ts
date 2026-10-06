import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type PdfJsLoadingTask = ReturnType<typeof pdfjsLib.getDocument>
export type PdfJsDocument = Awaited<PdfJsLoadingTask['promise']>

const loadingTasks = new WeakMap<PdfJsDocument, PdfJsLoadingTask>()

/**
 * Política de segurança do PDF.js.
 *
 * O app usa apenas parsing/renderização. Não instancia PDFScriptingManager,
 * não carrega o sandbox de JavaScript do viewer e mantém XFA desabilitado.
 * No PDF.js 6, o ciclo de vida deve ser encerrado pelo PDFDocumentLoadingTask
 * (PDFDocumentProxy.destroy() foi removido).
 */
export const PDFJS_SECURITY_POLICY = Object.freeze({
  enableXfa: false,
  scriptingManagerEnabled: false,
})

export { pdfjsLib }

async function toOwnedUint8Array(source: File | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    const copy = new Uint8Array(source.byteLength)
    copy.set(source)
    return copy
  }
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0))
  return new Uint8Array(await source.arrayBuffer())
}

export async function loadPdfJsDocument(source: File | Uint8Array | ArrayBuffer): Promise<PdfJsDocument> {
  const data = await toOwnedUint8Array(source)
  const loadingTask = pdfjsLib.getDocument({
    data,
    enableXfa: PDFJS_SECURITY_POLICY.enableXfa,
  })

  try {
    const pdf = await loadingTask.promise
    loadingTasks.set(pdf, loadingTask)
    return pdf
  } catch (error) {
    await loadingTask.destroy().catch(() => {})
    throw error
  }
}

/**
 * Encerra corretamente um documento carregado pelo helper acima.
 * PDF.js 6 removeu PDFDocumentProxy.destroy(); o destroy pertence ao loading task.
 */
export async function destroyPdfJsDocument(pdf: PdfJsDocument | null | undefined): Promise<void> {
  if (!pdf) return
  const loadingTask = loadingTasks.get(pdf)
  if (loadingTask) {
    loadingTasks.delete(pdf)
    await loadingTask.destroy().catch(() => {})
    return
  }

  // Fallback defensivo para documentos que não tenham sido registrados no WeakMap.
  await pdf.cleanup().catch(() => {})
}
