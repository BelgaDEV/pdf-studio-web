import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('v2.0.8 lazy loading', () => {
  it('keeps tool routes out of the initial Home bundle', () => {
    const main = read('src/main.tsx')
    expect(main).toContain("lazy(() => import('./pages/ToolPage'))")
    expect(main).not.toMatch(/import ToolPage from ['"]\.\/pages\/ToolPage['"]/)
  })

  it('does not statically import heavy engines from ToolPage', () => {
    const toolPage = read('src/pages/ToolPage.tsx')
    expect(toolPage).not.toMatch(/^import .* from ['"]\.\.\/lib\/pdf['"]/m)
    expect(toolPage).not.toMatch(/^import .* from ['"]\.\.\/lib\/word['"]/m)
    expect(toolPage).not.toMatch(/^import JSZip from ['"]jszip['"]/m)
    expect(toolPage).toContain("await import('../lib/pdf')")
    expect(toolPage).toContain("await import('../lib/word')")
  })

  it('keeps PDF.js and WASM engines behind dynamic imports', () => {
    const pdf = read('src/lib/pdf.ts')
    expect(pdf).not.toMatch(/^import .*pdfjsSecure/m)
    expect(pdf).not.toMatch(/^import .*wasmCompression/m)
    expect(pdf).not.toMatch(/^import JSZip from ['"]jszip['"]/m)
    expect(pdf).toContain("await import('./pdfjsSecure')")
    expect(pdf).toContain("await import('./wasmCompression')")
  })

  it('loads each Word conversion stack only when invoked', () => {
    const word = read('src/lib/word.ts')
    expect(word).not.toMatch(/^import .*mammoth/m)
    expect(word).not.toMatch(/^import .*html2canvas/m)
    expect(word).not.toMatch(/^import .*jspdf/m)
    expect(word).not.toMatch(/^import .*docx/m)
    expect(word).toContain("import('mammoth/mammoth.browser')")
    expect(word).toContain("import('docx')")
  })
})
