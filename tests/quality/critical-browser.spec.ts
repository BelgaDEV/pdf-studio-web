import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

type QualityCaseName = 'merge'|'split'|'compress'|'redaction'|'compare'|'protect'|'pdfa'|'word-to-pdf'|'prepare'|'ocr'
type QualityResult = { case: QualityCaseName; durationMs: number; details: Record<string, string|number|boolean> }

async function runCase(page: Page, name: QualityCaseName): Promise<QualityResult> {
  return page.evaluate(async (caseName) => {
    const harness = await import('/tests/quality/browserHarness.ts')
    return harness.runQualityCase(caseName as any)
  }, name) as Promise<QualityResult>
}

async function attachReport(testInfo: TestInfo, title: string, results: QualityResult[], failures: string[]) {
  const payload = JSON.stringify({ title, generatedAt: new Date().toISOString(), results, failures }, null, 2)
  mkdirSync('quality-results', { recursive: true })
  writeFileSync(`quality-results/${title}.json`, payload, 'utf8')
  await testInfo.attach(`${title}.json`, { body: Buffer.from(payload), contentType: 'application/json' })
}

const coreCases: Array<{ name: QualityCaseName; label: string }> = [
  { name: 'merge', label: 'Juntar PDF' },
  { name: 'split', label: 'Dividir PDF' },
  { name: 'compress', label: 'Comprimir PDF / Ghostscript' },
  { name: 'redaction', label: 'Redação Permanente' },
  { name: 'compare', label: 'Comparar PDFs' },
  { name: 'protect', label: 'Proteger PDF / AES-256' },
  { name: 'pdfa', label: 'PDF/A / Ghostscript' },
  { name: 'word-to-pdf', label: 'Word → PDF' },
  { name: 'prepare', label: 'Preparar Documento' },
]

test.describe.configure({ mode: 'serial' })

test('[core] 9 fluxos críticos produzem saídas válidas e reabertas', async ({ page }, testInfo) => {
  test.setTimeout(8 * 60 * 1000)
  await page.goto('/')
  const results: QualityResult[] = []
  const failures: string[] = []

  for (const item of coreCases) {
    await test.step(item.label, async () => {
      try {
        const result = await runCase(page, item.name)
        results.push(result)
        console.log(`[QUALITY] ${item.label}: OK (${result.durationMs} ms)`, result.details)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`${item.label}: ${message}`)
        console.error(`[QUALITY] ${item.label}: FALHOU`, error)
      }
    })
  }

  await attachReport(testInfo, 'quality-core', results, failures)
  expect(failures, `Falhas no Quality Gate:\n${failures.join('\n')}`).toEqual([])
  expect(results).toHaveLength(coreCases.length)
})

test('[online] OCR real reconhece um scan e cria camada pesquisável', async ({ page }, testInfo) => {
  test.setTimeout(5 * 60 * 1000)
  await page.goto('/')
  const results: QualityResult[] = []
  const failures: string[] = []
  try {
    const result = await runCase(page, 'ocr')
    results.push(result)
    console.log(`[QUALITY] OCR: OK (${result.durationMs} ms)`, result.details)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`OCR: ${message}`)
    console.error('[QUALITY] OCR: FALHOU', error)
  }
  await attachReport(testInfo, 'quality-ocr', results, failures)
  expect(failures, `Falha no OCR real:\n${failures.join('\n')}`).toEqual([])
  expect(results).toHaveLength(1)
})
