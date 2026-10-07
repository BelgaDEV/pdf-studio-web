import { Bug, HelpCircle, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_VERSION } from '../lib/appMeta'

export default function ContactPage(){
  return <div className="info-page public-info-page">
    <section className="info-hero"><div className="info-hero-icon"><HelpCircle size={28}/></div><div><p className="kicker">CONTATO E SUPORTE</p><h1>Ajuda para diagnosticar sem expor documentos.</h1><p>Enquanto o canal comercial dedicado está em preparação, use estas orientações para identificar problemas no {APP_NAME} v{APP_VERSION}.</p></div></section>
    <section className="public-info-grid">
      <article><HelpCircle/><h2>Primeiro: Central de Ajuda</h2><p>O FAQ cobre privacidade, compressão, OCR, comparação, PDF/A, limites de navegador e operações pesadas.</p><Link to="/faq">Abrir FAQ →</Link></article>
      <article><Bug/><h2>Ao reportar um problema</h2><p>Informe versão do app, navegador, ferramenta utilizada, etapa em que falhou e mensagem de erro. Não envie conteúdo confidencial apenas para reproduzir um problema.</p></article>
      <article><Info/><h2>Canal comercial</h2><p>O canal oficial de contato e contratação será publicado aqui antes da abertura dos planos pagos. Nenhuma cobrança está ativa nesta versão.</p></article>
    </section>
    <section className="public-copy-block"><h2>Diagnóstico recomendado</h2><p>Para um relato técnico útil, informe: <strong>PDF Studio v{APP_VERSION}</strong>, navegador e versão, sistema operacional, tamanho aproximado do arquivo, número de páginas e texto exato do erro. Prefira um arquivo fictício para reproduções.</p></section>
  </div>
}
