// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  }))
  return nested.flat()
}

describe('PDF.js 6 compatibility', () => {
  it('does not call removed PDFDocumentProxy.destroy()', async () => {
    const files = await sourceFiles('src')
    const offenders: string[] = []
    for (const file of files) {
      if (file.endsWith('pdfjsSecure.ts')) continue
      const source = await readFile(file, 'utf8')
      if (/\b(?:pdf|pdfjs|pdfJs)\.destroy\s*\(/.test(source) || /pdfRef\.current\?\.destroy/.test(source)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('owns loading-task lifecycle in the secure loader', async () => {
    const source = await readFile('src/lib/pdfjsSecure.ts', 'utf8')
    expect(source).toContain('const loadingTask = pdfjsLib.getDocument')
    expect(source).toContain('loadingTasks.set(pdf, loadingTask)')
    expect(source).toContain('await loadingTask.destroy()')
    expect(source).toContain('source.arrayBuffer()')
  })
})
