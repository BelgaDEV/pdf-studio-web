import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'release', 'commercial')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

if (!existsSync(join(root, 'dist', 'index.html'))) {
  throw new Error('Build não encontrado. Execute `npm run build` antes da release comercial.')
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(join(root, 'dist'), join(out, 'dist'), { recursive: true })

for (const file of ['README_COMERCIAL.md', 'THIRD_PARTY_NOTICES.md', 'SOURCE_CODE_NOTICE.md']) {
  if (existsSync(join(root, file))) await cp(join(root, file), join(out, file))
}

await writeFile(join(out, 'VERSION'), `${pkg.version}\n`, 'utf8')
console.log(`Release comercial ${pkg.version} criada em ${out}`)
