import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage(){
  return <div className="info-page public-status-page">
    <section className="public-status-card">
      <span className="public-status-code">404</span>
      <div className="info-hero-icon"><SearchX size={28}/></div>
      <p className="kicker">NÃO ENCONTRADO</p>
      <h1>Essa página não existe.</h1>
      <p>O endereço pode estar incorreto ou a ferramenta pode ter mudado. Volte para a Home para localizar a função desejada.</p>
      <div className="public-status-actions"><Link className="primary-btn" to="/"><ArrowLeft size={17}/> Ver todas as ferramentas</Link><Link className="secondary-btn" to="/faq">Abrir Central de Ajuda</Link></div>
    </section>
  </div>
}
