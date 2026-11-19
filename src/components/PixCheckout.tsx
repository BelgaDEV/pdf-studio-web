import { Check, Copy, Loader2, QrCode } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { checkPixPayment, startPixPayment, type PixCharge, type PixPeriod } from '../lib/subscription'

const POLL_MS = 4000
/** O QR Code fica na tela pelo menos este tempo, aconteça o que acontecer. */
const MIN_VISIBLE_MS = 5 * 60_000
const FALLBACK_VALID_MS = 30 * 60_000
const STORAGE_KEY = 'lauda-pix-em-aberto'

type OpenCharge = PixCharge & { createdAt: number }

/** Até quando o QR Code fica na tela: a validade do Mercado Pago, nunca menos de 5 minutos. */
function visibleUntil(charge: OpenCharge): number {
  const expires = charge.expiresAt ? Date.parse(charge.expiresAt) : NaN
  const fromMp = Number.isFinite(expires) ? expires : charge.createdAt + FALLBACK_VALID_MS
  return Math.max(fromMp, charge.createdAt + MIN_VISIBLE_MS)
}

function loadOpenCharge(): OpenCharge | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const charge = JSON.parse(raw) as OpenCharge
    if (!charge?.id || !charge.qrCode || !charge.createdAt || Date.now() > visibleUntil(charge)) { localStorage.removeItem(STORAGE_KEY); return null }
    return charge
  } catch { return null }
}

function saveOpenCharge(charge: OpenCharge | null) {
  try { if (charge) localStorage.setItem(STORAGE_KEY, JSON.stringify(charge)); else localStorage.removeItem(STORAGE_KEY) } catch { /* sem armazenamento: segue só na memória */ }
}

const OPTIONS: { period: PixPeriod; label: string; price: string; note: string }[] = [
  { period: 'month', label: '1 mês', price: 'R$ 19,90', note: '30 dias de Premium' },
  { period: 'year', label: '12 meses', price: 'R$ 199,00', note: 'economize R$ 39,80' },
]

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Pagamento do Premium com Pix: gera o QR Code e espera a confirmação. */
export default function PixCheckout({ title, onPaid }: { title: string; onPaid: (period: PixPeriod) => void | Promise<void> }) {
  // Volta o QR Code se a página recarregar (ex.: ao trocar para o app do banco).
  const [charge, setChargeState] = useState<OpenCharge | null>(loadOpenCharge)
  const [busy, setBusy] = useState<PixPeriod | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [expired, setExpired] = useState(false)
  const [endedReason, setEndedReason] = useState('')

  const setCharge = useCallback((next: OpenCharge | null) => { saveOpenCharge(next); setChargeState(next) }, [])

  // Pergunta ao servidor, a cada poucos segundos, se o Pix já caiu.
  useEffect(() => {
    if (!charge) return
    let active = true
    let timer: number | undefined
    const deadline = visibleUntil(charge)
    const tick = async () => {
      try {
        const result = await checkPixPayment(charge.id)
        if (!active) return
        if (result.premium) { await onPaid(charge.period); if (active) setCharge(null); return }
        // Só encerra pelo status depois do tempo mínimo na tela.
        if (['cancelled', 'rejected', 'expired'].includes(result.status) && Date.now() >= charge.createdAt + MIN_VISIBLE_MS) {
          setEndedReason(`O Mercado Pago encerrou este Pix (${[result.status, result.detail].filter(Boolean).join(', ')}).`)
          setExpired(true); saveOpenCharge(null); return
        }
      } catch { /* tenta de novo no próximo ciclo */ }
      if (!active) return
      if (Date.now() > deadline) { setExpired(true); saveOpenCharge(null); return }
      timer = window.setTimeout(tick, POLL_MS)
    }
    timer = window.setTimeout(tick, POLL_MS)
    return () => { active = false; window.clearTimeout(timer) }
  }, [charge, onPaid, setCharge])

  async function generate(period: PixPeriod) {
    setError(''); setExpired(false); setEndedReason(''); setCopied(false); setBusy(period)
    try { setCharge({ ...(await startPixPayment(period)), createdAt: Date.now() }) } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o Pix agora.')
    } finally { setBusy(null) }
  }

  async function copy() {
    if (!charge) return
    try { await navigator.clipboard.writeText(charge.qrCode); setCopied(true) } catch { setCopied(false) }
  }

  if (charge) {
    const option = OPTIONS.find(item => item.period === charge.period)
    return <div className="pix-box" aria-live="polite">
      <h3><QrCode size={16}/> Pix de {brl(charge.amount)} · {option?.label}</h3>
      {expired
        ? <p className="pix-status">{endedReason || 'Este Pix expirou sem pagamento.'} Gere um novo quando quiser.</p>
        : <>
            <p className="pix-help">Abra o app do seu banco, escolha <strong>Pix → Ler QR Code</strong> ou <strong>Pix copia e cola</strong>.</p>
            {charge.qrCodeBase64 && <img className="pix-qr" src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="QR Code do Pix" width={200} height={200}/>}
            <label className="field-label" htmlFor="pix-code">Pix copia e cola</label>
            <textarea id="pix-code" className="text-field pix-code" readOnly value={charge.qrCode} rows={3} onFocus={event => event.currentTarget.select()}/>
            <button type="button" className="secondary-btn" onClick={copy}>{copied ? <><Check size={15}/> Código copiado</> : <><Copy size={15}/> Copiar código</>}</button>
            <p className="pix-status"><Loader2 size={15} className="spin"/> Aguardando o pagamento. O Premium é liberado aqui assim que o Pix cair.</p>
            {charge.expiresAt && <small className="account-hint">O código vale até {new Date(charge.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</small>}
          </>}
      <button type="button" className="link-btn" onClick={() => { setCharge(null); setExpired(false); setEndedReason('') }}>{expired ? 'Gerar novo Pix' : 'Escolher outro período'}</button>
    </div>
  }

  return <div className="pix-box">
    <h3><QrCode size={16}/> {title}</h3>
    <p className="pix-help">Sem renovação automática: você paga uma vez e o Premium vale pelo período escolhido.</p>
    <div className="pix-options">
      {OPTIONS.map(item => <button key={item.period} type="button" className="pix-option" onClick={() => generate(item.period)} disabled={!!busy}>
        <span>{item.label}</span>
        <strong>{busy === item.period ? 'Gerando…' : item.price}</strong>
        <small>{item.note}</small>
      </button>)}
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>
}
