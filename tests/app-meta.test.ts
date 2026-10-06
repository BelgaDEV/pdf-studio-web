import { describe, expect, it } from 'vitest'
import { APP_NAME, APP_VERSION } from '../src/lib/appMeta'
import { PDF_STUDIO_VERSION, sha256Bytes } from '../src/lib/trustReport'
import { tools } from '../src/lib/tools'

describe('commercial metadata', () => {
  it('keeps the application version centralized', () => {
    expect(PDF_STUDIO_VERSION).toBe(APP_VERSION)
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('keeps tool IDs unique', () => {
    const ids = tools.map(tool => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(tools.length).toBeGreaterThan(20)
  })

  it('generates a stable SHA-256 digest', async () => {
    const digest = await sha256Bytes(new TextEncoder().encode(APP_NAME))
    expect(digest).toMatch(/^[a-f0-9]{64}$/)
  })
})
