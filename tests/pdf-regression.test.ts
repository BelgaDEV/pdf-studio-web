// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// Este teste cobre apenas a regressão de metadados. Isolamos o PDF.js para
// evitar carregar o build de navegador em ambiente Node.
vi.mock('../src/lib/pdfjsSecure', () => ({ loadPdfJsDocument: vi.fn(), pdfjsLib: {} }))

import { removePdfMetadata } from '../src/lib/documentTools'

async function fixturePdf() {
  const doc = await PDFDocument.create()
  doc.setTitle('Sensitive title')
  doc.setAuthor('Internal author')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  page.drawText('PDF Studio regression fixture', { x: 72, y: 760, size: 16, font })
  return doc.save()
}

describe('PDF regression suite', () => {
  it('removes document metadata without corrupting pages', async () => {
    const source = await fixturePdf()
    const file = new File([source], 'fixture.pdf', { type: 'application/pdf' })
    const output = await removePdfMetadata(file, () => {})
    const result = await PDFDocument.load(output.bytes)

    expect(output.engine).toBe('pdf-lib')
    expect(result.getPageCount()).toBe(1)
    expect(result.getTitle() ?? '').not.toBe('Sensitive title')
    expect(result.getAuthor() ?? '').not.toBe('Internal author')
    expect(output.bytes.byteLength).toBeGreaterThan(500)
  })
})
