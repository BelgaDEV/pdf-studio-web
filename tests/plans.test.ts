import { describe, expect, it } from 'vitest'
import { canAccess, isPremium, requiredAccess, userAccess, type Profile } from '../src/lib/plans'

const base: Profile = { id: 'u1', email: 'a@b.com', plan: 'free', premium_until: null }

describe('planos e acesso', () => {
  it('ferramentas comuns ficam livres para visitantes', () => {
    expect(requiredAccess('merge')).toBe('visitor')
    expect(requiredAccess('compress')).toBe('visitor')
  })

  it('ferramentas jurídicas exigem conta ou premium', () => {
    expect(requiredAccess('tribunal-presets')).toBe('account')
    expect(requiredAccess('redact')).toBe('premium')
    expect(requiredAccess('compare')).toBe('premium')
  })

  it('premium vale sem prazo ou até a data', () => {
    expect(isPremium({ ...base, plan: 'premium' })).toBe(true)
    expect(isPremium({ ...base, plan: 'premium', premium_until: '2000-01-01T00:00:00Z' })).toBe(false)
    expect(isPremium({ ...base, plan: 'premium', premium_until: '2999-01-01T00:00:00Z' })).toBe(true)
    expect(isPremium(base)).toBe(false)
  })

  it('níveis são cumulativos', () => {
    expect(userAccess(false, null)).toBe('visitor')
    expect(userAccess(true, base)).toBe('account')
    expect(userAccess(true, { ...base, plan: 'premium' })).toBe('premium')
    expect(canAccess('premium', 'account')).toBe(true)
    expect(canAccess('account', 'premium')).toBe(false)
    expect(canAccess('visitor', 'account')).toBe(false)
  })
})
