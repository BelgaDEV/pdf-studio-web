import { Crown } from 'lucide-react'
import PlanCards from '../components/PlanCards'

export default function PlansPage() {
  return <div className="info-page public-info-page plans-page">
    <section className="info-hero">
      <div className="info-hero-icon"><Crown size={28}/></div>
      <div>
        <p className="kicker">PLANOS</p>
        <h1>Comece grátis. Assine quando precisar de mais.</h1>
        <p>O plano Básico não pede cadastro. Seus documentos são processados no seu navegador em todos os planos.</p>
      </div>
    </section>
    <section className="plans-section plans-page-grid"><PlanCards/></section>
  </div>
}
