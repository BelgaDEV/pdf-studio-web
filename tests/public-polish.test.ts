import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { APP_VERSION } from '../src/lib/appMeta'

const read = (path:string) => readFileSync(path,'utf8')

describe('v2.0.9 public polish', () => {
  it('publishes the current version consistently in public copy', () => {
    expect(APP_VERSION).toBe('2.1.2')
    const faq=read('src/pages/FaqPage.tsx')
    const roadmap=read('src/pages/RoadmapPage.tsx')
    expect(faq).not.toContain('v1.9.1')
    expect(roadmap).not.toContain('Linha do tempo até a v1.9.1')
    expect(roadmap).toContain('APP_VERSION')
  })

  it('has explicit public information and 404 routes', () => {
    const main=read('src/main.tsx')
    for(const path of ['/privacy','/terms','/licenses','/contact']) expect(main).toContain(`path="${path}"`)
    expect(main).toContain('path="*"')
  })

  it('does not silently map an invalid tool id to the first tool', () => {
    const page=read('src/pages/ToolPage.tsx')
    expect(page).not.toContain("tools.find(t=>t.id===id) || tools[0]")
    expect(page).toContain('if(!knownTool) return <NotFoundPage/>')
  })

  it('keeps hashed assets immutable while revalidating the app shell', () => {
    const headers=read('public/_headers')
    expect(headers).toContain('/assets/*')
    expect(headers).toContain('max-age=31536000, immutable')
    expect(headers).toContain('/index.html')
    expect(headers).toContain('Cache-Control: no-cache')
  })
})
