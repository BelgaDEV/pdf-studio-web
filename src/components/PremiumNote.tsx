import { Crown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Aviso curto de recurso do plano Premium, com link para os planos. */
export default function PremiumNote({ children }: { children: ReactNode }) {
  return <div className="premium-note" role="note">
    <Crown size={17} aria-hidden="true"/>
    <span>{children}</span>
    <Link to="/planos">Ver planos</Link>
  </div>
}

/** Etiqueta "Premium" ao lado de uma opção travada. */
export function PremiumBadge() {
  return <span className="premium-badge"><Crown size={11} aria-hidden="true"/> Premium</span>
}
