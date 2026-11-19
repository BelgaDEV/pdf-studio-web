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

/* ---------- Pix avulso (1 mês ou 12 meses, sem renovação automática) ---------- */

export type PixPeriod = 'month' | 'year'

export const PIX_PLANS: Record<PixPeriod, { amount: number; days: number; description: string }> = {
  month: { amount: 19.9, days: 30, description: 'Lauda Premium - 1 mês (Pix)' },
  year: { amount: 199, days: 365, description: 'Lauda Premium - 12 meses (Pix)' },
}

/** Tempo para pagar o QR Code antes de ele expirar. */
export const PIX_EXPIRES_MINUTES = 30

const PIX_REF_RE = /^lauda-pix:(month|year):([0-9a-f-]{36})$/i

export type PixPayment = {
  id: number | string
  status?: string
  status_detail?: string
  transaction_amount?: number
  currency_id?: string
  payment_method_id?: string
  external_reference?: string | null
  date_of_expiration?: string | null
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } | null
}

export function isPixPeriod(value: unknown): value is PixPeriod {
  return value === 'month' || value === 'year'
}

export function pixExternalReference(userId: string, period: PixPeriod): string {
  return `lauda-pix:${period}:${userId}`
}

export function parsePixExternalReference(ref: unknown): { period: PixPeriod; userId: string } | null {
  if (typeof ref !== 'string') return null
  const match = PIX_REF_RE.exec(ref)
  if (!match || !isUuid(match[2])) return null
  return { period: match[1].toLowerCase() as PixPeriod, userId: match[2].toLowerCase() }
}

/** Corpo para gerar o Pix (POST /v1/payments). */
export function buildPixPaymentBody(input: { userId: string; payerEmail: string; period: PixPeriod; now?: Date }) {
  const plan = PIX_PLANS[input.period]
  const expires = new Date((input.now ?? new Date()).getTime() + PIX_EXPIRES_MINUTES * 60 * 1000)
  return {
    transaction_amount: plan.amount,
    description: plan.description,
    payment_method_id: 'pix',
    external_reference: pixExternalReference(input.userId, input.period),
    date_of_expiration: expires.toISOString().replace('Z', '+00:00'),
    payer: { email: input.payerEmail },
  }
}

/** O pagamento é um Pix da Lauda, aprovado, no valor certo? Devolve dono e período. */
export function approvedPixPurchase(payment: PixPayment): { period: PixPeriod; userId: string } | null {
  if (payment.status !== 'approved') return null
  const ref = parsePixExternalReference(payment.external_reference)
  if (!ref) return null
  if (payment.currency_id && payment.currency_id !== PREMIUM_CURRENCY) return null
  if (typeof payment.transaction_amount !== 'number' || payment.transaction_amount < PIX_PLANS[ref.period].amount - 0.001) return null
  return ref
}

/** Novo fim do Premium: soma os dias a partir do que for maior, hoje ou o fim atual. */
export function premiumUntilAfterPix(currentUntil: string | null | undefined, period: PixPeriod, now = new Date()): string {
  const current = currentUntil ? Date.parse(currentUntil) : NaN
  const base = Number.isFinite(current) ? Math.max(current, now.getTime()) : now.getTime()
  return new Date(base + PIX_PLANS[period].days * DAY_MS).toISOString()
}
