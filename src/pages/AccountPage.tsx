import { CheckCircle2, Crown, Loader2, LogOut, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PixCheckout from '../components/PixCheckout'
import { useAuth } from '../lib/auth'
import { ACCESS_LABEL, TOOL_ACCESS } from '../lib/plans'
import { cancelPremium, startPremiumCheckout, syncPremium, type PixPeriod } from '../lib/subscription'
import { tools } from '../lib/tools'

export default function AccountPage() {
  const { ready, session, profile, access, ensureLoaded, refreshProfile, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [payerEmail, setPayerEmail] = useState('')
  const [busy, setBusy] = useState<'' | 'checkout' | 'cancel' | 'sync'>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const returnHandled = useRef(false)

  const pixPaid = useCallback(async (period: PixPeriod) => {
    await refreshProfile()
    setError('')
    setNotice(`Pix recebido! Seu Premium está ativo por ${period === 'year' ? '12 meses' : '1 mês'}. Bom proveito.`)
  }, [refreshProfile])

  useEffect(() => { ensureLoaded() }, [ensureLoaded])
  useEffect(() => { if (ready && !session) navigate('/entrar?next=/conta', { replace: true }) }, [ready, session, navigate])
  useEffect(() => { if (session?.user.email && !payerEmail) setPayerEmail(session.user.email) }, [session, payerEmail])

  // Volta do Mercado Pago: confere o pagamento algumas vezes até o Premium aparecer.
  useEffect(() => {
    if (!session || params.get('assinatura') !== 'retorno' || returnHandled.current) return
    returnHandled.current = true
    setBusy('sync')
    setNotice('Confirmando seu pagamento com o Mercado Pago…')
    let active = true
    ;(async () => {
      for (let attempt = 0; attempt < 6 && active; attempt++) {
        try {
          const result = await syncPremium()
          if (result.premium) {
            await refreshProfile()
            if (active) setNotice('Pronto! Seu Premium está ativo. Bom proveito.')
            break
          }
          if (result.status === 'cancelled') { if (active) setNotice('A assinatura não foi concluída. Você pode tentar de novo quando quiser.'); break }
        } catch { /* tenta de novo */ }
        if (attempt === 5 && active) setNotice('Seu pagamento está em processamento. O Premium é liberado automaticamente assim que o Mercado Pago confirmar; pode levar alguns minutos.')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      if (active) {
        setBusy('')
        const next = new URLSearchParams(params)
        next.delete('assinatura')
        setParams(next, { replace: true })
      }
    })()
    return () => { active = false }
  }, [session, params, setParams, refreshProfile])

  if (!ready || !session) return <div className="route-loading" role="status" aria-live="polite">Carregando sua conta…</div>

  const premiumTools = tools.filter(tool => TOOL_ACCESS[tool.id] === 'premium')
  const until = profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString('pt-BR') : null
  const status = profile?.mp_status ?? null
  const renewing = status === 'authorized'

  async function subscribe(event: FormEvent) {
    event.preventDefault()
    setError(''); setNotice(''); setBusy('checkout')
    try { await startPremiumCheckout(payerEmail.trim()) } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o pagamento.')
      setBusy('')
    }
  }

  async function cancel() {
    setConfirmCancel(false)
    setError(''); setNotice(''); setBusy('cancel')
    try {
      await cancelPremium()
      await refreshProfile()
      setNotice(`Assinatura cancelada. Nenhuma nova cobrança será feita${until ? ` e o Premium continua até ${until}` : ''}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar agora.')
    } finally { setBusy('') }
  }

  return <div className="info-page public-info-page auth-page">
    <section className="auth-card account-card" aria-labelledby="account-title">
      <div className="auth-card-head"><span className="auth-icon"><UserRound size={22}/></span><h1 id="account-title">Minha conta</h1></div>
      {params.get('senha') === 'ok' && <p className="auth-notice" role="status"><CheckCircle2 size={16}/> Senha alterada com sucesso.</p>}
      {notice && <p className="auth-notice" role="status">{busy === 'sync' ? <Loader2 size={16} className="spin"/> : <CheckCircle2 size={16}/>} {notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <dl className="account-details">
        <div><dt>E-mail</dt><dd>{session.user.email}</dd></div>
        <div><dt>Plano</dt><dd><span className={`plan-badge plan-${access}`}>{access === 'premium' && <Crown size={13}/>}{ACCESS_LABEL[access]}</span>{until && access === 'premium' && <small> {renewing ? 'renova em' : 'até'} {until}</small>}</dd></div>
      </dl>

      {access === 'premium' && renewing && <div className="account-upgrade">
        <h2><Crown size={17}/> Assinatura ativa</h2>
        <p>R$ 19,90 por mês, renovada automaticamente pelo Mercado Pago. Você pode cancelar quando quiser; o Premium continua até o fim do período já pago.</p>
        {!confirmCancel
          ? <button type="button" className="secondary-btn" onClick={() => setConfirmCancel(true)} disabled={!!busy}>{busy === 'cancel' ? 'Cancelando…' : 'Cancelar assinatura'}</button>
          : <div className="cancel-confirm" role="group" aria-label="Confirmar cancelamento">
              <p>Cancelar a renovação automática?{until ? ` Você continua com o Premium até ${until}.` : ''}</p>
              <div className="cancel-confirm-actions">
                <button type="button" className="danger-btn" onClick={cancel} disabled={!!busy}>Sim, cancelar</button>
                <button type="button" className="secondary-btn" onClick={() => setConfirmCancel(false)} disabled={!!busy}>Manter assinatura</button>
              </div>
            </div>}
      </div>}

      {access === 'premium' && status === 'cancelled' && <div className="account-upgrade">
        <h2><Crown size={17}/> Assinatura cancelada</h2>
        <p>Não haverá novas cobranças. Seu Premium continua{until ? ` até ${until}` : ''}. Depois dessa data, você pode assinar de novo aqui mesmo.</p>
      </div>}

      {access === 'premium' && !renewing && <div className="account-upgrade">
        <PixCheckout title="Estender o Premium com Pix" onPaid={pixPaid}/>
        <small className="account-hint">Os dias pagos são somados depois{until ? ` de ${until}` : ' do período atual'}.</small>
      </div>}

      {access !== 'premium' && <form className="account-upgrade" onSubmit={subscribe}>
        <h2><Crown size={17}/> Premium no cartão · R$ 19,90 por mês</h2>
        <p>Libera {premiumTools.map(tool => tool.title).join(', ')}, além de compressão máxima e sem limites para juntar arquivos e fazer OCR.</p>
        <label className="field-label" htmlFor="payer-email">E-mail da sua conta Mercado Pago</label>
        <input id="payer-email" className="text-field" type="email" required autoComplete="email" value={payerEmail} onChange={event => setPayerEmail(event.target.value)} disabled={!!busy}/>
        <small className="account-hint">Use o mesmo e-mail com que você entra no Mercado Pago. A cobrança é mensal e você cancela quando quiser, aqui mesmo.</small>
        <button type="submit" className="primary-btn wide" disabled={!!busy}>{busy === 'checkout' ? 'Abrindo o Mercado Pago…' : 'Assinar Premium'}</button>
        <p className="account-hint"><Link to="/planos">Comparar planos</Link></p>
      </form>}

      {access !== 'premium' && <div className="account-upgrade">
        <PixCheckout title="Prefere pagar com Pix?" onPaid={pixPaid}/>
      </div>}

      <div className="auth-switch">
        <Link to="/">Ir para as ferramentas</Link>
        <button type="button" onClick={async () => { await signOut(); navigate('/', { replace: true }) }}><LogOut size={14}/> Sair</button>
      </div>
    </section>
  </div>
}
