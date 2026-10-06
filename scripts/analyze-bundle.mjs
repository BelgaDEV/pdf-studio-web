import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const manifestPath = join(distDir, '.vite', 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const entries = Object.entries(manifest)
const entryPair = entries.find(([, value]) => value?.isEntry)
if (!entryPair) throw new Error('Manifest do Vite não contém um entrypoint.')

const [entryKey] = entryPair
const initialKeys = new Set()
function walkStatic(key) {
  if (!key || initialKeys.has(key)) return
  initialKeys.add(key)
  const item = manifest[key]
  if (!item) return
  for (const dep of item.imports || []) walkStatic(dep)
}
walkStatic(entryKey)

const files = new Set()
for (const key of initialKeys) {
  const item = manifest[key]
  if (!item) continue
  if (item.file) files.add(item.file)
  for (const css of item.css || []) files.add(css)
}

let total = 0
const rows = []
for (const file of files) {
  const bytes = (await stat(join(distDir, file))).size
  total += bytes
  rows.push({ file, bytes })
}
rows.sort((a,b) => b.bytes-a.bytes)

const heavyPattern = /(ghostscript|qpdf|pdfjs|pdf\.worker|tesseract|mammoth|jspdf|html2canvas|docx|pdf-lib|jszip)/i
const staticHeavy = [...initialKeys].filter(key => {
  const item = manifest[key] || {}
  return heavyPattern.test(`${key} ${item.name || ''} ${item.src || ''} ${item.file || ''}`)
})

const mb = value => `${(value / 1024 / 1024).toFixed(2)} MB`
console.log('\nPDF Studio — análise do carregamento inicial')
console.log('Entry:', entryKey)
console.log('Payload estático aproximado (JS + CSS, sem gzip):', mb(total))
for (const row of rows.slice(0, 12)) console.log(`  ${mb(row.bytes).padStart(8)}  ${row.file}`)

if (staticHeavy.length) {
  console.error('\n[ERRO] Motores pesados entraram no grafo inicial:')
  for (const key of staticHeavy) console.error(' -', key)
  process.exitCode = 1
} else {
  console.log('\n[OK] Ghostscript, qpdf, PDF.js, Tesseract e conversores pesados não fazem parte do grafo inicial.')
}

if (total > 1_200_000) {
  console.warn(`[AVISO] O payload inicial sem gzip está acima de ~1,2 MB (${mb(total)}). Ainda há espaço para otimização.`)
} else {
  console.log(`[OK] Payload inicial sem gzip dentro da meta atual: ${mb(total)}.`)
}
