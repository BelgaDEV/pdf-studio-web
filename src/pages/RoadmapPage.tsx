import { CheckCircle2, Clock3, Map, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_VERSION } from '../lib/appMeta'
import { tools } from '../lib/tools'

const releases = [
  {version:'v1.0–1.4',title:'Base web e ferramentas essenciais',status:'done',items:['React + Vite + processamento local-first','Compressão, mesclagem, divisão, conversões e OCR','Ghostscript/qpdf WebAssembly e organização visual de páginas']},
  {version:'v1.5–1.9.1',title:'Produtividade e Legal / Business',status:'done',items:['Bookmarks, índice e Document Tools','Redação permanente, Comparar PDFs e Presets Tribunal','Trust Report, workflows, favoritos, recentes e Redline']},
  {version:'v2.0–2.0.4',title:'Experiência comercial',status:'done',items:['Landing premium com ferramentas primeiro','Mega menu e navegação simplificada','Pacote interno/comercial separado e correções de navegação']},
  {version:'v2.0.5–2.0.7',title:'Security Hardening e qualidade',status:'done',items:['Atualização do PDF.js e jsPDF','CSP, sanitização HTML e loaders seguros','TypeScript, testes de segurança e regressão PDF verdes']},
  {version:'v2.0.8',title:'Performance / Lazy Loading',status:'done',items:['Code splitting de rotas e ferramentas','Motores pesados carregados somente sob demanda','Payload inicial validado em aproximadamente 0,39 MB sem gzip']},
  {version:'v2.0.9',title:'Public Polish',status:'done',items:['404 real e tratamento global de falhas','Páginas públicas de Privacidade, Termos, Licenças e Contato','Versão centralizada, textos públicos coerentes e cache de assets versionados']},
  {version:`v${APP_VERSION}`,title:'Quality Gate',status:'current',items:['Fixtures fictícias determinísticas e reabertura dos arquivos gerados','9 fluxos críticos validados no navegador + OCR real em gate completo','Relatórios Playwright, CI e validação de Ghostscript/qpdf/PDF.js/Word']},
]

const productPillars = [
  {title:'Privacidade',desc:'Local-first e sem upload de documentos no fluxo padrão.'},
  {title:'Automação',desc:'Preparar documento, lote, presets e fluxos documentais.'},
  {title:'Legal / Business',desc:'Redação, comparação, índice, bookmarks, tribunal e PDF/A.'},
  {title:'Confiança',desc:'Trust Report, SHA-256 e verificações do resultado.'},
]

export default function RoadmapPage(){
  const done=tools.length+1
  return <div className="info-page roadmap-page roadmap-page-clean">
    <section className="info-hero roadmap-hero">
      <div className="info-hero-icon"><Map size={28}/></div>
      <div><p className="kicker">MAPA DO PRODUTO</p><h1>Roadmap do PDF Studio</h1><p>Uma visão limpa da evolução do produto e das principais entregas incorporadas até a versão atual v{APP_VERSION}.</p></div>
    </section>

    <section className="roadmap-kpis">
      <div><strong>{done}</strong><span>ferramentas/fluxos acessíveis</span></div>
      <div><strong>7</strong><span>Document Tools</span></div>
      <div><strong>6</strong><span>recursos Legal / Business</span></div>
      <div><strong>100%</strong><span>local-first no processamento atual</span></div>
    </section>

    <section className="roadmap-block">
      <div className="section-head compact"><div><p className="kicker">POSICIONAMENTO</p><h2>Os quatro pilares do PDF Studio</h2></div></div>
      <div className="pillar-grid">{productPillars.map(item=><div className="pillar-card" key={item.title}><strong>{item.title}</strong><p>{item.desc}</p></div>)}</div>
      <div className="roadmap-callout"><ShieldCheck size={20}/><div><strong>Proposta central</strong><span>Automação documental privada para profissionais, jurídico e empresas — não apenas mais um conversor de PDF.</span></div></div>
    </section>

    <section className="roadmap-block roadmap-history">
      <div className="section-head compact"><div><p className="kicker">EVOLUÇÃO</p><h2>Linha do tempo até a v{APP_VERSION}</h2></div></div>
      <div className="release-timeline">{releases.map(release=><article className={`release-card ${release.status}`} key={release.version}>
        <div className="release-marker">{release.status==='current'?<Clock3 size={17}/>:<CheckCircle2 size={17}/>}</div>
        <div className="release-copy"><div className="release-title"><span>{release.version}</span><h3>{release.title}</h3>{release.status==='current'&&<small>ATUAL</small>}</div><ul>{release.items.map(item=><li key={item}>{item}</li>)}</ul></div>
      </article>)}</div>
    </section>

    <div className="roadmap-actions">
      <Link className="primary-btn" to="/">Explorar ferramentas</Link>
      <Link className="secondary-btn" to="/faq">Abrir FAQ</Link>
    </div>
  </div>
}
