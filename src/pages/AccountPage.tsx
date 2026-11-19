import { CheckCircle2, Crown, LogOut, UserRound } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_CONTACT_EMAIL } from '../lib/appMeta'
import { useAuth } from '../lib/auth'
import { ACCESS_LABEL, TOOL_ACCESS } from '../lib/plans'
import { tools } from '../lib/tools'

export default function AccountPage() {
  const { ready, session, profile, access, ensureLoaded, signOut } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => { ensureLoaded() }, [ensureLoaded])
  useEffect(() => { if (ready && !session) navigate('/entrar?next=/conta', { replace: true }) }, [ready, session, navigate])

  if (!ready || !session) return <div className="route-loading" role="status" aria-live="polite">Carregando sua conta…</div>

  const premiumTools = tools.filter(tool => TOOL_ACCESS[tool.id] === 'premium')
  const until = profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString('pt-BR') : null

  return <div className="info-page public-info-page auth-page">
    <section className="auth-card account-card" aria-labelledby="account-title">
      <div className="auth-card-head"><span className="auth-icon"><UserRound size={22}/></span><h1 id="account-title">Minha conta</h1></div>
      {params.get('senha') === 'ok' && <p className="auth-notice" role="status"><CheckCircle2 size={16}/> Senha alterada com sucesso.</p>}
      <dl className="account-details">
        <div><dt>E-mail</dt><dd>{session.user.email}</dd></div>
        <div><dt>Plano</dt><dd><span className={`plan-badge plan-${access}`}>{access === 'premium' && <Crown size={13}/>}{ACCESS_LABEL[access]}</span>{until && <small> até {until}</small>}</dd></div>
      </dl>
      {access !== 'premium' && <div className="account-upgrade">
        <h2><Crown size={17}/> Premium · R$ 19,90 por mês</h2>
        <p>Libera {premiumTools.map(tool => tool.title).join(', ')}, além de compressão máxima e sem limites para juntar arquivos e fazer OCR.</p>
        <p>A assinatura online está chegando. Para assinar agora, escreva para <a href={`mailto:${APP_CONTACT_EMAIL}?subject=Quero%20o%20Lauda%20Premium`}>{APP_CONTACT_EMAIL}</a>. <Link to="/planos">Comparar planos</Link></p>
      </div>}
      <div className="auth-switch">
        <Link to="/">Ir para as ferramentas</Link>
        <button type="button" onClick={async () => { await signOut(); navigate('/', { replace: true }) }}><LogOut size={14}/> Sair</button>
      </div>
    </section>
  </div>
}
