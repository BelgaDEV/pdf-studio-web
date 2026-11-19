// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  GRACE_DAYS,
  PIX_PLANS,
  PREMIUM_PRICE,
  approvedPixPurchase,
  buildPixPaymentBody,
  buildPreapprovalBody,
  parsePixExternalReference,
  premiumUntilAfterPix,
  isValidEmail,
  parseSignatureHeader,
  profileUpdateFromPreapproval,
  verifyWebhookSignature,
} from '../worker/subscription'

const USER = '3f2b1c9e-5a4d-4e7f-9b8a-0c1d2e3f4a5b'
const NOW = new Date('2026-11-19T12:00:00Z')

describe('assinatura Premium (Mercado Pago)', () => {
  it('cria a assinatura mensal de R$ 19,90 ligada ao usuário', () => {
    const body = buildPreapprovalBody({ userId: USER, payerEmail: 'a@b.com', backUrl: 'https://x/conta' })
    expect(body.external_reference).toBe(USER)
    expect(body.auto_recurring).toEqual({ frequency: 1, frequency_type: 'months', transaction_amount: PREMIUM_PRICE, currency_id: 'BRL' })
    expect(body.status).toBe('pending')
  })

  it('autorizada libera Premium até a próxima cobrança + folga', () => {
    const update = profileUpdateFromPreapproval({
      id: 'abc', status: 'authorized', external_reference: USER,
      next_payment_date: '2026-12-19T12:00:00Z',
      auto_recurring: { transaction_amount: 19.9, currency_id: 'BRL' },
    }, NOW)
    expect(update.plan).toBe('premium')
    expect(update.premium_until).toBe(new Date(Date.parse('2026-12-19T12:00:00Z') + GRACE_DAYS * 864e5).toISOString())
    expect(update.mp_status).toBe('authorized')
  })

  it('cancelada ou pendente não mexe no plano (vence no fim do período pago)', () => {
    for (const status of ['cancelled', 'paused', 'pending']) {
      const update = profileUpdateFromPreapproval({ id: 'abc', status, auto_recurring: { transaction_amount: 19.9, currency_id: 'BRL' } }, NOW)
      expect(update.plan).toBeUndefined()
      expect(update.premium_until).toBeUndefined()
      expect(update.mp_status).toBe(status)
    }
  })

  it('não libera Premium para assinatura com valor menor ou outra moeda', () => {
    expect(profileUpdateFromPreapproval({ id: 'x', status: 'authorized', auto_recurring: { transaction_amount: 1, currency_id: 'BRL' } }, NOW).plan).toBeUndefined()
    expect(profileUpdateFromPreapproval({ id: 'x', status: 'authorized', auto_recurring: { transaction_amount: 19.9, currency_id: 'USD' } }, NOW).plan).toBeUndefined()
  })

  it('valida e-mail', () => {
    expect(isValidEmail('test_user_123@testuser.com')).toBe(true)
    expect(isValidEmail('sem-arroba')).toBe(false)
  })

  it('confere a assinatura do webhook como o Mercado Pago gera', async () => {
    const secret = 'segredo-de-teste'
    const ts = '1742505638683'
    const dataId = 'ABC123def'
    const requestId = 'req-1'
    const v1 = createHmac('sha256', secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex')
    const header = `ts=${ts},v1=${v1}`
    expect(parseSignatureHeader(header)).toEqual({ ts, v1 })
    expect(await verifyWebhookSignature({ secret, signatureHeader: header, requestId, dataId })).toBe(true)
    expect(await verifyWebhookSignature({ secret: 'outra', signatureHeader: header, requestId, dataId })).toBe(false)
    expect(await verifyWebhookSignature({ secret, signatureHeader: header, requestId, dataId: 'outro' })).toBe(false)
    expect(await verifyWebhookSignature({ secret, signatureHeader: null, requestId, dataId })).toBe(false)
  })

  describe('Pix avulso', () => {
    it('gera o Pix de 1 mês (R$ 19,90) e de 12 meses (R$ 199) ligado ao usuário', () => {
      const month = buildPixPaymentBody({ userId: USER, payerEmail: 'a@b.com', period: 'month', now: NOW })
      expect(month.transaction_amount).toBe(19.9)
      expect(month.payment_method_id).toBe('pix')
      expect(parsePixExternalReference(month.external_reference)).toEqual({ period: 'month', userId: USER })
      expect(month.date_of_expiration).toBe('2026-11-19T13:00:00.000+00:00')
      expect(buildPixPaymentBody({ userId: USER, payerEmail: 'a@b.com', period: 'year' }).transaction_amount).toBe(199)
    })

    it('só aceita Pix aprovado, da Lauda e no valor certo', () => {
      const ref = `lauda-pix:year:${USER}`
      expect(approvedPixPurchase({ id: 1, status: 'approved', transaction_amount: 199, currency_id: 'BRL', external_reference: ref })).toEqual({ period: 'year', userId: USER })
      expect(approvedPixPurchase({ id: 1, status: 'pending', transaction_amount: 199, external_reference: ref })).toBeNull()
      expect(approvedPixPurchase({ id: 1, status: 'approved', transaction_amount: 19.9, external_reference: ref })).toBeNull()
      expect(approvedPixPurchase({ id: 1, status: 'approved', transaction_amount: 199, external_reference: 'outra-coisa' })).toBeNull()
      expect(parsePixExternalReference(`lauda-pix:week:${USER}`)).toBeNull()
    })

    it('soma os dias a partir de hoje ou do fim do Premium atual', () => {
      expect(premiumUntilAfterPix(null, 'month', NOW)).toBe(new Date(NOW.getTime() + PIX_PLANS.month.days * 864e5).toISOString())
      expect(premiumUntilAfterPix('2026-01-01T00:00:00Z', 'month', NOW)).toBe(new Date(NOW.getTime() + 30 * 864e5).toISOString())
      const later = '2026-12-01T00:00:00.000Z'
      expect(premiumUntilAfterPix(later, 'year', NOW)).toBe(new Date(Date.parse(later) + 365 * 864e5).toISOString())
    })
  })
})
