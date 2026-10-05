import { CheckCircle2, Clock3, Map, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tools } from '../lib/tools'

const releases = [
  {version:'v1.0',title:'Base web local-first',status:'done',items:['React + Vite + Cloudflare Static Assets','Compressão, mesclagem, divisão e conversões básicas','Processamento no navegador, sem backend de documentos']},
  {version:'v1.1–1.3',title:'Compressão profissional',status:'done',items:['Ghostscript/qpdf WebAssembly','Fallback adaptativo','Comprimir para X MB','Proteções contra PDF vazio/inválido']},
  {version:'v1.3.1–1.4',title:'Organização e produtividade',status:'done',items:['Ordenação drag-and-drop na mesclagem','Organizador visual de páginas','Editor básico de páginas','OCR pesquisável','Processamento em lote']},
  {version:'v1.5',title:'Navegação documental',status:'done',items:['Bookmarks automáticos pelo nome do arquivo','Preparação da base para documentos compostos']},
  {version:'v1.6',title:'Document Tools',status:'done',items:['Marca d’água','Numeração de páginas','Remover páginas em branco','Remover metadados','Proteger com senha','Extrair imagens','PDF → PDF/A']},
  {version:'v1.7',title:'Legal / Business',status:'done',items:['Preparar documento','Índice automático clicável','Bookmarks Pro hierárquicos','Redação permanente','Comparar PDFs','Presets Tribunal']},
  {version:'v1.8',title:'Document Trust',status:'done',items:['Document Trust Report','SHA-256 original/final','JSON verificável','Verificação posterior do PDF','Fingerprint de documentos']},
  {version:'v1.8.1–1.8.2',title:'Experiência e navegação',status:'done',items:['Correção do painel Preparar documento','Menu lateral global de acesso rápido','FAQ pesquisável','Roadmap dentro do produto']},
  {version:'v1.8.3',title:'Layout Cleanup',status:'current',items:['Home mais compacta e conteúdo principal mais próximo do topo','Roadmap simplificado e focado no histórico do produto','Ajustes de navegação e apresentação para uma experiência mais limpa']},
]

const productPillars = [
  {title:'Privacidade',desc:'Local-first e sem upload de documentos no fluxo padrão.'},
  {title:'Automação',desc:'Preparar documento, lote, presets e fluxos documentais.'},
  {title:'Legal / Business',desc:'Redação, comparação, índice, bookmarks, tribunal e PDF/A.'},
  {title:'Confiança',desc:'Trust Report, SHA-256 e verificações do resultado.'},
]

export default function RoadmapPage(){
  const done=tools.length
  return <div className="info-page roadmap-page roadmap-page-clean">
    <section className="info-hero roadmap-hero">
      <div className="info-hero-icon"><Map size={28}/></div>
      <div><p className="kicker">MAPA DO PRODUTO</p><h1>Roadmap do PDF Studio</h1><p>Uma visão limpa da evolução do produto e das principais entregas incorporadas ao PDF Studio até a versão atual.</p></div>
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
      <div className="section-head compact"><div><p className="kicker">EVOLUÇÃO</p><h2>Linha do tempo até a v1.8.3</h2></div></div>
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
