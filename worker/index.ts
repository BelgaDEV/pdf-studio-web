/**
 * Worker da Lauda: entrega o site (assets) e atende /api/* para a
 * assinatura Premium pelo Mercado Pago.
 *
 * Segredos (Cloudflare → Workers → pdf-studio-web → Settings → Variables and Secrets):
 *   MP_ACCESS_TOKEN      Access Token do Mercado Pago
 *   MP_WEBHOOK_SECRET    Chave secreta dos webhooks do Mercado Pago
 *   SUPABASE_SECRET_KEY  Chave secreta (service_role / sb_secret_) do Supabase
 * Variáveis públicas (wrangler.jsonc): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.
 */
import {
  approvedPixPurchase,
  buildPixPaymentBody,
  buildPreapprovalBody,
  isPixPeriod,
  isUuid,
  isValidEmail,
  parsePixExternalReference,
  PIX_PLANS,
  premiumUntilAfterPix,
  profileUpdateFromPreapproval,
  verifyWebhookSignature,
  type PixPayment,
  type PixPeriod,
  type Preapproval,
} from './subscription'

type AssetsBinding = { fetch(request: Request): Promise<Response> }

export interface Env {
  ASSETS: AssetsBinding
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SECRET_KEY?: string
  MP_ACCESS_TOKEN?: string
  MP_WEBHOOK_SECRET?: string
}

const MP_API = 'https://api.mercadopago.com'

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function requireConfig(env: Env) {
  if (!env.MP_ACCESS_TOKEN || !env.SUPABASE_SECRET_KEY) {
    throw new HttpError(503, 'A assinatura online ainda não está configurada. Tente novamente mais tarde.')
  }
  return { mpToken: env.MP_ACCESS_TOKEN, supabaseKey: env.SUPABASE_SECRET_KEY }
}

/** Confere o login do Supabase enviado pelo site (Authorization: Bearer). */
async function currentUser(request: Request, env: Env): Promise<{ id: string; email: string | null }> {
  const auth = request.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/.test(auth)) throw new HttpError(401, 'Entre na sua conta para continuar.')
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: auth },
  })
  if (!res.ok) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.')
  const user = await res.json() as { id?: string; email?: string }
  if (!isUuid(user.id)) throw new HttpError(401, 'Sessão inválida.')
  return { id: user.id, email: user.email ?? null }
}

type ProfileRow = { id: string; plan: string; premium_until: string | null; mp_preapproval_id: string | null; mp_status: string | null }

async function getProfile(env: Env, supabaseKey: string, userId: string): Promise<ProfileRow | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,plan,premium_until,mp_preapproval_id,mp_status`, {
    headers: { apikey: supabaseKey, accept: 'application/json' },
  })
  if (!res.ok) throw new HttpError(502, 'Não foi possível ler sua conta agora.')
  const rows = await res.json() as ProfileRow[]
  return rows[0] ?? null
}

async function updateProfile(env: Env, supabaseKey: string, userId: string, update: Record<string, unknown>) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { apikey: supabaseKey, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(update),
  })
  if (!res.ok) throw new HttpError(502, 'Não foi possível atualizar sua conta agora.')
}

async function mercadoPago<T>(token: string, path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({})) as T & { message?: string; cause?: { description?: string; code?: unknown }[] }
  if (!res.ok) {
    console.warn('Mercado Pago', path, res.status, JSON.stringify(body).slice(0, 500))
    const cause = body.cause?.[0]
    const detail = [cause?.code, cause?.description ?? body.message].filter(Boolean).join(' ').slice(0, 200)
    throw new HttpError(502, `O Mercado Pago não respondeu como esperado. Tente novamente em instantes.${detail ? ` (detalhe: ${detail})` : ''}`)
  }
  return body
}

/** Busca a assinatura no Mercado Pago (fonte da verdade) e grava no perfil. */
async function syncPreapproval(env: Env, mpToken: string, supabaseKey: string, preapprovalId: string, expectedUserId?: string) {
  const preapproval = await mercadoPago<Preapproval>(mpToken, `/preapproval/${encodeURIComponent(preapprovalId)}`)
  const userId = preapproval.external_reference
  if (!isUuid(userId)) return { synced: false as const, reason: 'sem usuário' }
  if (expectedUserId && userId !== expectedUserId) throw new HttpError(403, 'Esta assinatura não pertence à sua conta.')
  const update = profileUpdateFromPreapproval(preapproval)
  if (update.premium_until) {
    // Se já havia Premium pago com Pix até mais tarde, não encurta.
    const profile = await getProfile(env, supabaseKey, userId)
    if (profile?.premium_until && Date.parse(profile.premium_until) > Date.parse(update.premium_until)) update.premium_until = profile.premium_until
  }
  await updateProfile(env, supabaseKey, userId, update)
  return { synced: true as const, status: update.mp_status, premium: update.plan === 'premium' }
}

/* ---------- Pix avulso ---------- */

const PIX_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000

async function supabaseRest<T>(env: Env, supabaseKey: string, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: supabaseKey,
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!res.ok) {
    console.warn('Supabase', path.split('?')[0], res.status, (await res.text()).slice(0, 300))
    throw new HttpError(502, 'Não foi possível atualizar sua conta agora.')
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

function insertPixRow(env: Env, supabaseKey: string, row: { id: string; user_id: string; period: PixPeriod; status: string }) {
  return supabaseRest(env, supabaseKey, 'pix_payments?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=minimal',
    body: { ...row, amount: PIX_PLANS[row.period].amount },
  })
}

/**
 * Busca o Pix no Mercado Pago e, se estiver aprovado, soma os dias ao Premium
 * uma única vez (a linha em pix_payments só é marcada por quem chegar primeiro).
 */
async function applyPixPayment(env: Env, mpToken: string, supabaseKey: string, paymentId: string, expectedUserId?: string) {
  const payment = await mercadoPago<PixPayment>(mpToken, `/v1/payments/${encodeURIComponent(paymentId)}`)
  const ref = parsePixExternalReference(payment.external_reference)
  if (!ref) return { status: payment.status ?? 'unknown', premium: false, ours: false }
  if (expectedUserId && ref.userId !== expectedUserId) throw new HttpError(403, 'Este pagamento não pertence à sua conta.')
  const id = String(payment.id)
  const status = payment.status ?? 'pending'
  const where = `pix_payments?id=eq.${encodeURIComponent(id)}&applied_at=is.null`

  // Garante a linha (caso o aviso chegue antes de ela ser gravada).
  await insertPixRow(env, supabaseKey, { id, user_id: ref.userId, period: ref.period, status })

  const purchase = approvedPixPurchase(payment)
  if (!purchase) {
    await supabaseRest(env, supabaseKey, where, { method: 'PATCH', prefer: 'return=minimal', body: { status } })
    return { status, premium: false, ours: true }
  }

  const claimed = await supabaseRest<unknown[]>(env, supabaseKey, where, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { status, applied_at: new Date().toISOString() },
  })
  if (claimed?.length === 1) {
    const profile = await getProfile(env, supabaseKey, purchase.userId)
    const currentUntil = profile?.plan === 'premium' ? profile.premium_until : null
    await updateProfile(env, supabaseKey, purchase.userId, { plan: 'premium', premium_until: premiumUntilAfterPix(currentUntil, purchase.period) })
  }
  return { status, premium: true, ours: true }
}

/** Confere os Pix ainda não confirmados dos últimos 2 dias. Devolve true se algum liberou Premium. */
async function syncPendingPix(env: Env, mpToken: string, supabaseKey: string, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - PIX_LOOKBACK_MS).toISOString()
  const rows = await supabaseRest<{ id: string }[]>(env, supabaseKey,
    `pix_payments?user_id=eq.${userId}&applied_at=is.null&status=in.(pending,in_process)&created_at=gte.${encodeURIComponent(since)}&select=id&order=created_at.desc&limit=3`)
  let premium = false
  for (const row of rows ?? []) {
    try { if ((await applyPixPayment(env, mpToken, supabaseKey, row.id, userId)).premium) premium = true } catch (error) { console.warn('Pix pendente', error) }
  }
  return premium
}

/** POST /api/pix — gera o QR Code do Pix (1 mês ou 12 meses). */
async function startPix(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const user = await currentUser(request, env)
  const body = await readJson(request)
  const period = body.period
  if (!isPixPeriod(period)) throw new HttpError(400, 'Escolha 1 mês ou 12 meses.')
  const email = user.email?.toLowerCase() ?? ''
  if (!isValidEmail(email)) throw new HttpError(400, 'Sua conta precisa de um e-mail válido para gerar o Pix.')
  const profile = await getProfile(env, supabaseKey, user.id)
  if (profile?.mp_status === 'authorized') throw new HttpError(409, 'Sua assinatura no cartão já está ativa. Cancele a renovação antes de pagar com Pix.')

  const payment = await mercadoPago<PixPayment>(mpToken, '/v1/payments', {
    method: 'POST',
    headers: { 'x-idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(buildPixPaymentBody({ userId: user.id, payerEmail: email, period })),
  })
  const data = payment.point_of_interaction?.transaction_data
  if (!data?.qr_code) throw new HttpError(502, 'O Mercado Pago não devolveu o código do Pix.')
  await insertPixRow(env, supabaseKey, { id: String(payment.id), user_id: user.id, period, status: payment.status ?? 'pending' })
  return json({
    id: String(payment.id),
    period,
    amount: PIX_PLANS[period].amount,
    qrCode: data.qr_code,
    qrCodeBase64: data.qr_code_base64 ?? null,
    expiresAt: payment.date_of_expiration ?? null,
  })
}

/** POST /api/pix/status — o site pergunta se o Pix já foi pago. */
async function pixStatus(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const user = await currentUser(request, env)
  const body = await readJson(request)
  const id = String(body.id ?? '')
  if (!/^\d{1,20}$/.test(id)) throw new HttpError(400, 'Pagamento inválido.')
  const result = await applyPixPayment(env, mpToken, supabaseKey, id, user.id)
  if (!result.ours) throw new HttpError(404, 'Pagamento não encontrado.')
  return json({ status: result.status, premium: result.premium })
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { return await request.json() as Record<string, unknown> } catch { return {} }
}

/** POST /api/assinatura — cria a assinatura e devolve o link do Mercado Pago. */
async function startSubscription(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const user = await currentUser(request, env)
  const body = await readJson(request)
  const payerEmail = String(body.payerEmail ?? user.email ?? '').trim().toLowerCase()
  if (!isValidEmail(payerEmail)) throw new HttpError(400, 'Informe o e-mail da sua conta Mercado Pago.')

  const profile = await getProfile(env, supabaseKey, user.id)
  if (profile?.mp_status === 'authorized') throw new HttpError(409, 'Sua assinatura Premium já está ativa.')

  const origin = new URL(request.url).origin
  const preapproval = await mercadoPago<Preapproval & { init_point?: string }>(mpToken, '/preapproval', {
    method: 'POST',
    body: JSON.stringify(buildPreapprovalBody({ userId: user.id, payerEmail, backUrl: `${origin}/conta?assinatura=retorno` })),
  })
  if (!preapproval.init_point) throw new HttpError(502, 'O Mercado Pago não devolveu o link de pagamento.')
  await updateProfile(env, supabaseKey, user.id, { mp_preapproval_id: preapproval.id, mp_status: preapproval.status ?? 'pending', mp_updated_at: new Date().toISOString() })
  return json({ url: preapproval.init_point })
}

/** POST /api/assinatura/sincronizar — atualiza o plano ao voltar do Mercado Pago. */
async function syncMine(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const user = await currentUser(request, env)
  const profile = await getProfile(env, supabaseKey, user.id)
  const pix = await syncPendingPix(env, mpToken, supabaseKey, user.id)
  if (!profile?.mp_preapproval_id) return json(pix ? { synced: true, premium: true } : { synced: false, reason: 'sem assinatura' })
  const result = await syncPreapproval(env, mpToken, supabaseKey, profile.mp_preapproval_id, user.id)
  return json(pix ? { ...result, premium: true } : result)
}

/** POST /api/assinatura/cancelar — cancela a renovação no Mercado Pago. */
async function cancelSubscription(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const user = await currentUser(request, env)
  const profile = await getProfile(env, supabaseKey, user.id)
  if (!profile?.mp_preapproval_id) throw new HttpError(404, 'Não encontramos uma assinatura na sua conta.')
  await mercadoPago(mpToken, `/preapproval/${encodeURIComponent(profile.mp_preapproval_id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
  return json(await syncPreapproval(env, mpToken, supabaseKey, profile.mp_preapproval_id, user.id))
}

/** POST /api/mercadopago/webhook — avisos de assinatura e de cobrança. */
async function webhook(request: Request, env: Env): Promise<Response> {
  const { mpToken, supabaseKey } = requireConfig(env)
  const url = new URL(request.url)
  const body = await readJson(request)
  const data = (body.data ?? {}) as { id?: unknown }
  const dataId = String(url.searchParams.get('data.id') ?? data.id ?? url.searchParams.get('id') ?? '')
  const type = String(url.searchParams.get('type') ?? body.type ?? url.searchParams.get('topic') ?? body.topic ?? '')
  if (!dataId) return json({ ok: true, ignored: 'sem id' })

  if (!env.MP_WEBHOOK_SECRET) throw new HttpError(503, 'Webhook sem chave configurada.')
  const valid = await verifyWebhookSignature({
    secret: env.MP_WEBHOOK_SECRET,
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
  })
  if (!valid) return json({ error: 'assinatura inválida' }, 401)

  if (type === 'payment') {
    const result = await applyPixPayment(env, mpToken, supabaseKey, dataId)
    return json({ ok: true, ...(result.ours ? { pix: result.status, premium: result.premium } : { ignored: 'pagamento sem Pix da Lauda' }) })
  }

  let preapprovalId: string | null = null
  if (type === 'subscription_preapproval' || type === 'preapproval') preapprovalId = dataId
  else if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
    const payment = await mercadoPago<{ preapproval_id?: string }>(mpToken, `/authorized_payments/${encodeURIComponent(dataId)}`)
    preapprovalId = payment.preapproval_id ?? null
  }
  if (!preapprovalId) return json({ ok: true, ignored: type || 'tipo desconhecido' })
  return json({ ok: true, ...(await syncPreapproval(env, mpToken, supabaseKey, preapprovalId)) })
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  switch (path) {
    case '/api/assinatura': return startSubscription(request, env)
    case '/api/assinatura/sincronizar': return syncMine(request, env)
    case '/api/assinatura/cancelar': return cancelSubscription(request, env)
    case '/api/pix': return startPix(request, env)
    case '/api/pix/status': return pixStatus(request, env)
    case '/api/mercadopago/webhook': return webhook(request, env)
    default: return json({ error: 'Não encontrado.' }, 404)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await handleApi(request, env, path)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('Erro na API', error)
      return json({ error: 'Erro inesperado. Tente novamente.' }, 500)
    }
  },
}
