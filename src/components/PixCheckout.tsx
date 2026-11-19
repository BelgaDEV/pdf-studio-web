import { Check, Copy, Loader2, QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { checkPixPayment, startPixPayment, type PixCharge, type PixPeriod } from '../lib/subscription'

const POLL_MS = 4000

const OPTIONS: { period: PixPeriod; label: string; price: string; note: string }[] = [
  { period: 'month', label: '1 mês', price: 'R$ 19,90', note: '30 dias de Premium' },
  { period: 'year', label: '12 meses', price: 'R$ 199,00', note: 'economize R$ 39,80' },
]

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Pagamento do Premium com Pix: gera o QR Code e espera a confirmação. */
export default function PixCheckout({ title, onPaid }: { title: string; onPaid: (period: PixPeriod) => void | Promise<void> }) {
  const [charge, setCharge] = useState<PixCharge | null>(null)
  const [busy, setBusy] = useState<PixPeriod | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [expired, setExpired] = useState(false)

  // Pergunta ao servidor, a cada poucos segundos, se o Pix já caiu.
  useEffect(() => {
    if (!charge) return
    let active = true
    let timer: number | undefined
    const deadline = charge.expiresAt ? Date.parse(charge.expiresAt) + 60_000 : Date.now() + 31 * 60_000
    const tick = async () => {
      try {
        const result = await checkPixPayment(charge.id)
        if (!active) return
        if (result.premium) { await onPaid(charge.period); if (active) setCharge(null); return }
        if (['cancelled', 'rejected', 'expired'].includes(result.status)) { setExpired(true); return }
      } catch { /* tenta de novo no próximo ciclo */ }
      if (!active) return
      if (Date.now() > deadline) { setExpired(true); return }
      timer = window.setTimeout(tick, POLL_MS)
    }
    timer = window.setTimeout(tick, POLL_MS)
    return () => { active = false; window.clearTimeout(timer) }
  }, [charge, onPaid])

  async function generate(period: PixPeriod) {
    setError(''); setExpired(false); setCopied(false); setBusy(period)
    try { setCharge(await startPixPayment(period)) } catch (err) {
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
        ? <p className="pix-status">Este Pix expirou sem pagamento. Gere um novo quando quiser.</p>
        : <>
            <p className="pix-help">Abra o app do seu banco, escolha <strong>Pix → Ler QR Code</strong> ou <strong>Pix copia e cola</strong>.</p>
            {charge.qrCodeBase64 && <img className="pix-qr" src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="QR Code do Pix" width={200} height={200}/>}
            <label className="field-label" htmlFor="pix-code">Pix copia e cola</label>
            <textarea id="pix-code" className="text-field pix-code" readOnly value={charge.qrCode} rows={3} onFocus={event => event.currentTarget.select()}/>
            <button type="button" className="secondary-btn" onClick={copy}>{copied ? <><Check size={15}/> Código copiado</> : <><Copy size={15}/> Copiar código</>}</button>
            <p className="pix-status"><Loader2 size={15} className="spin"/> Aguardando o pagamento. O Premium é liberado aqui assim que o Pix cair.</p>
            {charge.expiresAt && <small className="account-hint">O código vale até {new Date(charge.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</small>}
          </>}
      <button type="button" className="link-btn" onClick={() => { setCharge(null); setExpired(false) }}>{expired ? 'Gerar novo Pix' : 'Escolher outro período'}</button>
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
