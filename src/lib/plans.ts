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
  /** Status da assinatura no Mercado Pago (pending, authorized, paused, cancelled). */
  mp_status?: string | null
}

/**
 * Plano Básico: grátis e sem cadastro. Plano Premium: ferramentas abaixo e
 * sem os limites de FREE_LIMITS. As demais ferramentas são livres para todos.
 */
export const TOOL_ACCESS: Partial<Record<ToolId, AccessLevel>> = {
  redact: 'premium',
  compare: 'premium',
  pdfa: 'premium',
  'trust-report': 'premium',
  'prepare-document': 'premium',
  'tribunal-presets': 'premium',
  batch: 'premium',
}

/** Limites do plano Básico dentro das ferramentas livres. */
export const FREE_LIMITS = {
  /** Arquivos por vez em Juntar PDF. */
  mergeFiles: 10,
  /** Páginas por documento no OCR. */
  ocrPages: 10,
} as const

/** Modos de compressão exclusivos do Premium. */
export const PREMIUM_COMPRESSION_MODES = ['maximum', 'target'] as const

export function isPremiumCompression(mode: string): boolean {
  return (PREMIUM_COMPRESSION_MODES as readonly string[]).includes(mode)
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
  account: 'Básico',
  premium: 'Premium',
}
