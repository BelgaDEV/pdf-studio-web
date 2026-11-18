import type { ToolId } from './tools'

/**
 * Níveis de acesso da Lauda. Para mudar o que é grátis ou premium,
 * edite somente TOOL_ACCESS abaixo.
 */
export type AccessLevel = 'visitor' | 'account' | 'premium'

export type Profile = {
  id: string
  email: string | null
  plan: 'free' | 'premium'
  premium_until: string | null
}

/** Ferramentas que exigem conta ou Premium. As demais são livres para todos. */
export const TOOL_ACCESS: Partial<Record<ToolId, AccessLevel>> = {
  'tribunal-presets': 'account',
  'prepare-document': 'account',
  redact: 'premium',
  compare: 'premium',
  pdfa: 'premium',
  'trust-report': 'premium',
}

export function requiredAccess(toolId: string): AccessLevel {
  return TOOL_ACCESS[toolId as ToolId] ?? 'visitor'
}

export function isPremium(profile: Profile | null): boolean {
  if (!profile || profile.plan !== 'premium') return false
  return !profile.premium_until || new Date(profile.premium_until).getTime() > Date.now()
}

export function userAccess(signedIn: boolean, profile: Profile | null): AccessLevel {
  if (!signedIn) return 'visitor'
  return isPremium(profile) ? 'premium' : 'account'
}

const rank: Record<AccessLevel, number> = { visitor: 0, account: 1, premium: 2 }

export function canAccess(user: AccessLevel, required: AccessLevel): boolean {
  return rank[user] >= rank[required]
}

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  visitor: 'Visitante',
  account: 'Conta grátis',
  premium: 'Premium',
}
