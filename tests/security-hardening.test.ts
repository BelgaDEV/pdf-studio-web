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

describe('v2.0.7 security hardening', () => {
  it('pins security-sensitive dependencies to hardened versions', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'))
    expect(pkg.dependencies.jspdf).toBe('4.2.1')
    expect(pkg.dependencies['pdfjs-dist']).toBe('6.3.289')
    expect(pkg.dependencies.mammoth).toBe('1.13.0')
    expect(pkg.devDependencies.vitest).toBe('4.1.11')
    expect(pkg.devDependencies.wrangler).toBeUndefined()
  })

  it('routes every PDF.js document load through the hardened loader', async () => {
    const files = await sourceFiles('src')
    const offenders: string[] = []
    for (const file of files) {
      if (file.endsWith('pdfjsSecure.ts')) continue
      const text = await readFile(file, 'utf8')
      if (/\bgetDocument\s*\(/.test(text) || /PDFScriptingManager/.test(text)) offenders.push(file)
    }
    expect(offenders).toEqual([])

    const secureLoader = await readFile('src/lib/pdfjsSecure.ts', 'utf8')
    expect(secureLoader).toContain('enableXfa: false')
    expect(secureLoader).toContain('scriptingManagerEnabled: false')
    expect(secureLoader).toContain('loadingTask.destroy()')
    expect(secureLoader).not.toContain('isEvalSupported:')
  })

  it('ships a CSP that blocks embedded PDF scripts and framing', async () => {
    const headers = await readFile('public/_headers', 'utf8')
    expect(headers).toContain("Content-Security-Policy:")
    expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(headers).toContain("object-src 'none'")
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain('X-Frame-Options: DENY')
  })
})
