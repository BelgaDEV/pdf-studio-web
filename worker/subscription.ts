/**
 * Regras da assinatura Premium (Mercado Pago), sem dependência de rede:
 * dá para testar isoladamente (tests/subscription.test.ts).
 */

export const PREMIUM_PRICE = 19.9
export const PREMIUM_CURRENCY = 'BRL'
export const PREMIUM_REASON = 'Lauda Premium'
/** Folga depois da data da próxima cobrança, para o pagamento ser processado. */
export const GRACE_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Preapproval = {
  id: string
  status?: string
  external_reference?: string | null
  next_payment_date?: string | null
  auto_recurring?: { transaction_amount?: number; currency_id?: string } | null
}

export type ProfileUpdate = {
  mp_preapproval_id: string
  mp_status: string
  mp_updated_at: string
  plan?: 'premium'
  premium_until?: string
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Corpo para criar a assinatura mensal (POST /preapproval). */
export function buildPreapprovalBody(input: { userId: string; payerEmail: string; backUrl: string }) {
  return {
    reason: PREMIUM_REASON,
    external_reference: input.userId,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: PREMIUM_PRICE,
      currency_id: PREMIUM_CURRENCY,
    },
  }
}

/** A assinatura é mesmo a do Lauda Premium (valor e moeda)? */
export function isLaudaPremium(preapproval: Preapproval): boolean {
  const recurring = preapproval.auto_recurring
  return !!recurring
    && recurring.currency_id === PREMIUM_CURRENCY
    && typeof recurring.transaction_amount === 'number'
    && recurring.transaction_amount >= PREMIUM_PRICE - 0.001
}

/**
 * O que gravar no perfil a partir do status da assinatura.
 * - authorized: Premium até a próxima cobrança + folga.
 * - paused / cancelled: não tira o Premium na hora; ele vence sozinho no fim
 *   do período já pago (premium_until).
 * - pending: só registra o status.
 */
export function profileUpdateFromPreapproval(preapproval: Preapproval, now = new Date()): ProfileUpdate {
  const status = preapproval.status ?? 'pending'
  const update: ProfileUpdate = {
    mp_preapproval_id: preapproval.id,
    mp_status: status,
    mp_updated_at: now.toISOString(),
  }
  if (status === 'authorized' && isLaudaPremium(preapproval)) {
    const next = preapproval.next_payment_date ? Date.parse(preapproval.next_payment_date) : NaN
    const base = Number.isFinite(next) ? Math.max(next, now.getTime()) : now.getTime() + 31 * DAY_MS
    update.plan = 'premium'
    update.premium_until = new Date(base + GRACE_DAYS * DAY_MS).toISOString()
  }
  return update
}

/** Lê o cabeçalho x-signature ("ts=...,v1=..."). */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null
  let ts = ''
  let v1 = ''
  for (const part of header.split(',')) {
    const [key, ...rest] = part.split('=')
    const value = rest.join('=').trim()
    if (key.trim() === 'ts') ts = value
    if (key.trim() === 'v1') v1 = value
  }
  return ts && v1 ? { ts, v1 } : null
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Confere a assinatura do aviso (webhook) do Mercado Pago:
 * HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a
 * chave secreta do webhook.
 */
export async function verifyWebhookSignature(input: {
  secret: string
  signatureHeader: string | null
  requestId: string | null
  dataId: string
}): Promise<boolean> {
  const parsed = parseSignatureHeader(input.signatureHeader)
  if (!parsed || !input.secret) return false
  // O Mercado Pago usa o id em minúsculas quando ele é alfanumérico.
  const id = /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId
  let manifest = `id:${id};`
  if (input.requestId) manifest += `request-id:${input.requestId};`
  manifest += `ts:${parsed.ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  return safeEqual(mac, parsed.v1.toLowerCase())
}
