import { Crown, LogIn, UserPlus } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { canAccess, requiredAccess } from '../lib/plans'
import { tools } from '../lib/tools'

/** Mostra a ferramenta só para quem tem o nível de acesso exigido. */
export default function PlanGate({ toolId, children }: { toolId: string; children: ReactNode }) {
  const required = requiredAccess(toolId)
  const { ready, session, access, ensureLoaded } = useAuth()
  const location = useLocation()

  useEffect(() => { if (required !== 'visitor') ensureLoaded() }, [required, ensureLoaded])

  if (required === 'visitor' || canAccess(access, required)) return <>{children}</>
  if (!ready) return <div className="route-loading" role="status" aria-live="polite">Verificando seu acesso…</div>

  const tool = tools.find(item => item.id === toolId)
  const next = encodeURIComponent(location.pathname)

  return <section className="tool-page">
    <div className="workspace-card plan-gate" role="region" aria-labelledby="plan-gate-title">
      <span className="auth-icon">{required === 'premium' ? <Crown size={24}/> : <UserPlus size={24}/>}</span>
      <h1 id="plan-gate-title">{tool?.title}</h1>
      {required === 'account' && <>
        <p>Esta ferramenta é gratuita, mas precisa de uma conta para salvar suas configurações.</p>
        <div className="plan-gate-actions">
          <Link className="primary-btn" to={`/entrar?modo=criar&next=${next}`}><UserPlus size={16}/> Criar conta grátis</Link>
          <Link className="secondary-btn" to={`/entrar?next=${next}`}><LogIn size={16}/> Já tenho conta</Link>
        </div>
      </>}
      {required === 'premium' && <>
        <p>{tool?.desc}</p>
        <p>Esta ferramenta faz parte do plano <strong>Premium</strong>.</p>
        <div className="plan-gate-actions">
          <Link className="primary-btn" to="/planos"><Crown size={16}/> Ver planos</Link>
          {session
            ? <Link className="secondary-btn" to="/conta">Ver meu plano</Link>
            : <Link className="secondary-btn" to={`/entrar?next=${next}`}><LogIn size={16}/> Já sou Premium</Link>}
        </div>
      </>}
    </div>
  </section>
}
