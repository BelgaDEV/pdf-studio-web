// Gera public/sitemap.xml a partir das rotas públicas e das ferramentas em src/lib/tools.ts.
// Roda antes do vite build, para o sitemap sempre acompanhar a lista de ferramentas.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const meta = readFileSync(join(root, 'src/lib/appMeta.ts'), 'utf8')
const siteUrl = meta.match(/APP_SITE_URL = '([^']+)'/)?.[1]
if (!siteUrl) throw new Error('APP_SITE_URL não encontrado em src/lib/appMeta.ts')

const toolsSource = readFileSync(join(root, 'src/lib/tools.ts'), 'utf8')
const toolIds = [...toolsSource.matchAll(/\{\s*id:\s*'([a-z0-9-]+)'/g)].map(m => m[1])
if (toolIds.length === 0) throw new Error('Nenhuma ferramenta encontrada em src/lib/tools.ts')

const pages = ['/', '/faq', '/privacy', '/terms', '/licenses', '/contact', ...toolIds.map(id => `/tool/${id}`)]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(path => `  <url><loc>${siteUrl}${path === '/' ? '/' : path}</loc></url>`).join('\n')}
</urlset>
`
writeFileSync(join(root, 'public/sitemap.xml'), xml)
console.log(`sitemap.xml: ${pages.length} páginas`)
