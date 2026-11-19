import { getSupabase } from './supabase'

/** Chama a API de assinatura do Worker com o login atual. */
async function callApi<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para continuar.')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(result.error || 'Não foi possível concluir agora. Tente novamente.')
  return result
}

/** Cria a assinatura e leva para a página de pagamento do Mercado Pago. */
export async function startPremiumCheckout(payerEmail: string): Promise<void> {
  const { url } = await callApi<{ url: string }>('/api/assinatura', { payerEmail })
  if (!/^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//i.test(url)) throw new Error('Link de pagamento inesperado.')
  window.location.assign(url)
}

/** Confere no Mercado Pago o status da assinatura e atualiza o plano. */
export function syncPremium(): Promise<{ synced: boolean; status?: string; premium?: boolean }> {
  return callApi('/api/assinatura/sincronizar')
}

/** Cancela a renovação automática. O Premium segue até o fim do período pago. */
export function cancelPremium(): Promise<{ synced: boolean; status?: string }> {
  return callApi('/api/assinatura/cancelar')
}

export type PixPeriod = 'month' | 'year'

export type PixCharge = {
  id: string
  period: PixPeriod
  amount: number
  qrCode: string
  qrCodeBase64: string | null
  expiresAt: string | null
}

/** Gera o QR Code do Pix para 1 mês ou 12 meses de Premium. */
export function startPixPayment(period: PixPeriod): Promise<PixCharge> {
  return callApi('/api/pix', { period })
}

/** Pergunta se o Pix já foi pago (e libera o Premium se foi). */
export function checkPixPayment(id: string): Promise<{ status: string; detail?: string | null; premium: boolean }> {
  return callApi('/api/pix/status', { id })
}
