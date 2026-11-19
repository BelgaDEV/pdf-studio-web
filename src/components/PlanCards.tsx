import { ArrowRight, Building2, Check, Crown, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_CONTACT_EMAIL } from '../lib/appMeta'
import { FREE_LIMITS } from '../lib/plans'

const premiumMail = `mailto:${APP_CONTACT_EMAIL}?subject=${encodeURIComponent('Quero o Lauda Premium')}`
const businessMail = `mailto:${APP_CONTACT_EMAIL}?subject=${encodeURIComponent('Lauda para empresas')}&body=${encodeURIComponent('Empresa:\nNúmero de usuários:\nO que vocês precisam:\n')}`

/** Os três planos da Lauda: Básico, Premium e Empresas. */
export default function PlanCards() {
  return <div className="commercial-plan-grid">
    <article>
      <span className="plan-label"><Sparkles size={11}/> GRÁTIS · SEM CADASTRO</span>
      <h3>Básico</h3>
      <p>Para o dia a dia: tudo o que você precisa para resolver um PDF rápido.</p>
      <ul>
        <li><Check/> Comprimir (níveis até Alto)</li>
        <li><Check/> Juntar até {FREE_LIMITS.mergeFiles} arquivos por vez</li>
        <li><Check/> Dividir, organizar e editar páginas</li>
        <li><Check/> Marca d’água, numeração e senha</li>
        <li><Check/> PDF ↔ Word, JPG, PNG, TXT e imagens</li>
        <li><Check/> OCR até {FREE_LIMITS.ocrPages} páginas</li>
      </ul>
      <Link to="/#ferramentas">Usar agora <ArrowRight size={15}/></Link>
    </article>
    <article className="highlight">
      <span className="plan-label"><Crown size={11}/> PARA ADVOGADOS E ESCRITÓRIOS</span>
      <h3>Premium</h3>
      <p>Tudo do Básico, sem limites, e as ferramentas jurídicas da Lauda.</p>
      <ul>
        <li><Check/> Tarjar dados sensíveis</li>
        <li><Check/> Comparar PDFs com Redline</li>
        <li><Check/> PDF/A e Document Trust Report</li>
        <li><Check/> Preparar documento e Presets Tribunal</li>
        <li><Check/> Processamento em lote</li>
        <li><Check/> Compressão máxima e para X MB</li>
        <li><Check/> Juntar e OCR sem limite</li>
      </ul>
      <a href={premiumMail}>Quero o Premium <ArrowRight size={15}/></a>
    </article>
    <article>
      <span className="plan-label"><Building2 size={11}/> SOB CONSULTA</span>
      <h3>Empresas</h3>
      <p>Para equipes e escritórios com vários usuários e necessidades próprias.</p>
      <ul>
        <li><Check/> Premium para toda a equipe</li>
        <li><Check/> Preço por volume de usuários</li>
        <li><Check/> Atendimento direto</li>
      </ul>
      <a href={businessMail}>Fale conosco <ArrowRight size={15}/></a>
    </article>
  </div>
}
