import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_VERSION } from '../src/lib/appMeta'

// Vitest/Vite can transform import.meta.url into a non-file URL on Windows.
// npm scripts and CI execute from the repository root, so cwd + path.resolve
// gives us a native Windows/Linux path without depending on URL schemes.
const projectRoot = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const harness = readFileSync(resolve(projectRoot, 'tests', 'quality', 'browserHarness.ts'), 'utf8')

describe('v2.1 Quality Gate wiring', () => {
  it('centraliza a versão 2.1.2', () => {
    expect(APP_VERSION).toBe('2.1.2')
    expect(pkg.version).toBe('2.1.2')
  })

  it('registra os 10 fluxos críticos no harness real de navegador', () => {
    for (const name of ['merge','split','compress','ocr','redaction','compare','protect','pdfa','word-to-pdf','prepare']) {
      expect(harness).toContain(`'${name}'`)
    }
  })

  it('possui comandos para gate determinístico e OCR real', () => {
    expect(pkg.scripts['test:quality']).toContain('playwright.quality.config.ts')
    expect(pkg.scripts['test:quality:ocr']).toContain('[online')
    expect(pkg.scripts['quality:gate:full']).toContain('test:quality:ocr')
  })

  it('resolve arquivos do Quality Gate por caminhos nativos no Windows e CI', () => {
    const packagePath = resolve(projectRoot, 'package.json')
    const harnessPath = resolve(projectRoot, 'tests', 'quality', 'browserHarness.ts')

    expect(packagePath).toMatch(/package\.json$/i)
    expect(harnessPath).toMatch(/browserHarness\.ts$/i)
    expect(() => readFileSync(packagePath, 'utf8')).not.toThrow()
    expect(() => readFileSync(harnessPath, 'utf8')).not.toThrow()
  })
})
