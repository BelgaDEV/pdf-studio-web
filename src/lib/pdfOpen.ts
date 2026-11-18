import { PDFDocument, type LoadOptions } from 'pdf-lib'

/**
 * Abre PDFs enviados pelo usuário com pdf-lib.
 *
 * Muitos PDFs (apostilas, documentos oficiais) vêm "protegidos" apenas com
 * senha de proprietário: abrem sem senha em qualquer leitor, mas trazem
 * restrições de cópia/edição. O pdf-lib recusa esses arquivos. Aqui, quando
 * isso acontece, removemos a criptografia localmente com qpdf (Apache-2.0)
 * e tentamos de novo. Se o PDF exigir senha para ABRIR, mostramos uma
 * mensagem clara pedindo que o usuário remova a senha antes.
 */

function isEncryptedError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /encrypt/i.test(message)
}

export async function decryptPdfBytes(input: Uint8Array): Promise<Uint8Array> {
  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    const result = await qpdf.exec(
      ['--decrypt', '--warning-exit-0', '--', '/input.pdf', '/output.pdf'],
      { files: [{ name: '/input.pdf', data: new Uint8Array(input) }], outputs: ['/output.pdf'] },
    )
    const file = result.files?.[0]
    if (!file?.data) {
      const details = `${result.stderr ?? ''} ${result.stdout ?? ''}`
      if (/password/i.test(details)) {
        throw new Error('Este PDF exige senha para ser aberto. Abra-o com a senha e salve uma cópia sem proteção antes de usar no PDF Studio.')
      }
      throw new Error('Não foi possível remover a proteção deste PDF.')
    }
    return file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data)
  } finally {
    qpdf.dispose()
  }
}

/** Retorna bytes que o pdf-lib consegue abrir (descriptografando se necessário). */
export async function ensureOpenablePdfBytes(input: Uint8Array): Promise<Uint8Array> {
  try {
    await PDFDocument.load(input, { updateMetadata: false })
    return input
  } catch (error) {
    if (!isEncryptedError(error)) throw error
    return decryptPdfBytes(input)
  }
}

export async function loadPdfDocument(
  input: Uint8Array | ArrayBuffer,
  options: LoadOptions = {},
): Promise<PDFDocument> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  try {
    return await PDFDocument.load(bytes, options)
  } catch (error) {
    if (!isEncryptedError(error)) throw error
    const decrypted = await decryptPdfBytes(bytes)
    return PDFDocument.load(decrypted, options)
  }
}
