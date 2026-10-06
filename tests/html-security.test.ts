import { describe, expect, it } from 'vitest'
import { sanitizeOfficeHtml } from '../src/lib/htmlSecurity'

describe('Office HTML sanitization', () => {
  it('removes active content from converted DOCX HTML', () => {
    const dirty = '<p>Contrato</p><script>alert(1)</script><iframe srcdoc="<script>alert(2)</script>"></iframe><a href="javascript:alert(3)" onclick="alert(4)">link</a>'
    const clean = sanitizeOfficeHtml(dirty)
    expect(clean).toContain('Contrato')
    expect(clean).not.toMatch(/<script/i)
    expect(clean).not.toMatch(/<iframe/i)
    expect(clean).not.toMatch(/javascript:/i)
    expect(clean).not.toMatch(/onclick=/i)
  })
})
