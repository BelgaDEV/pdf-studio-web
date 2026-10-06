import DOMPurify from 'dompurify'

/**
 * Sanitização defensiva para HTML originado de documentos Office.
 * Mammoth converte DOCX para HTML, mas não sanitiza conteúdo não confiável.
 */
export function sanitizeOfficeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'link', 'base'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: false,
  })
}
