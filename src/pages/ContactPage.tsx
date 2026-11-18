import { Bug, HelpCircle, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_CONTACT_EMAIL, APP_NAME, APP_OWNER, APP_VERSION } from '../lib/appMeta'

export default function ContactPage(){
  return <div className="info-page public-info-page">
    <section className="info-hero"><div className="info-hero-icon"><HelpCircle size={28}/></div><div><p className="kicker">CONTATO E SUPORTE</p><h1>Fale com a gente.</h1><p>Dúvidas, sugestões, problemas ou interesse comercial no {APP_NAME}: escreva para <a href={`mailto:${APP_CONTACT_EMAIL}`}>{APP_CONTACT_EMAIL}</a>.</p></div></section>
    <section className="public-info-grid">
      <article><HelpCircle/><h2>Primeiro: Central de Ajuda</h2><p>O FAQ cobre privacidade, compressão, OCR, comparação, PDF/A, limites de navegador e operações pesadas.</p><Link to="/faq">Abrir FAQ →</Link></article>
      <article><Bug/><h2>Ao reportar um problema</h2><p>Informe versão do app, navegador, ferramenta utilizada, etapa em que falhou e mensagem de erro. Não envie conteúdo confidencial apenas para reproduzir um problema.</p></article>
      <article><Mail/><h2>E-mail</h2><p>Atendimento por <a href={`mailto:${APP_CONTACT_EMAIL}`}>{APP_CONTACT_EMAIL}</a>. Responsável: {APP_OWNER}. Nenhuma cobrança está ativa nesta versão.</p></article>
    </section>
    <section className="public-copy-block"><h2>Diagnóstico recomendado</h2><p>Para um relato técnico útil, informe: <strong>Lauda v{APP_VERSION}</strong>, navegador e versão, sistema operacional, tamanho aproximado do arquivo, número de páginas e texto exato do erro. Prefira um arquivo fictício para reproduções.</p></section>
  </div>
}
