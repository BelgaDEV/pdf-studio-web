import {
  ArrowRight,
  Check,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Files,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { tools, type ToolId } from '../lib/tools'

type HomeFilterId = 'all' | 'popular' | 'organize' | 'optimize' | 'convert' | 'edit' | 'security' | 'legal'

const popularIds = new Set<ToolId>(['merge','split','compress','pdf-word','word-pdf','pdf-jpg','images-pdf','ocr','protect','organize'])
const organizeIds = new Set<ToolId>(['merge','split','organize','edit-pages','page-numbers','remove-blank','extract-images'])
const optimizeIds = new Set<ToolId>(['compress','ocr','pdfa','remove-metadata','batch','prepare-document'])
const editIds = new Set<ToolId>(['watermark','page-numbers','edit-pages','redact','remove-metadata'])
const securityIds = new Set<ToolId>(['protect','redact','remove-metadata','trust-report','pdfa'])

const homePriority: ToolId[] = [
  'merge','split','compress','organize','pdf-word',
  'word-pdf','pdf-jpg','images-pdf','ocr','protect',
  'edit-pages','watermark','page-numbers','pdf-png','pdf-txt',
  'redact','compare','prepare-document','tribunal-presets','trust-report',
  'pdfa','remove-metadata','remove-blank','extract-images','batch',
]
const homePriorityIndex = new Map(homePriority.map((id,index)=>[id,index]))

const filters: Array<{id:HomeFilterId; label:string}> = [
  {id:'all',label:'Todas'},
  {id:'popular',label:'Mais usadas'},
  {id:'organize',label:'Organizar PDF'},
  {id:'optimize',label:'Otimizar PDF'},
  {id:'convert',label:'Converter PDF'},
  {id:'edit',label:'Editar PDF'},
  {id:'security',label:'Segurança'},
  {id:'legal',label:'Jurídico / Pro'},
]

function normalize(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
}

export default function Home(){
  const [activeFilter,setActiveFilter]=useState<HomeFilterId>('all')
  const [query,setQuery]=useState('')

  const filteredTools=useMemo(()=>{
    const needle=normalize(query.trim())
    return tools.filter(tool=>{
      const id=tool.id as ToolId
      let matchesCategory=true
      if(activeFilter==='popular') matchesCategory=popularIds.has(id)
      else if(activeFilter==='organize') matchesCategory=organizeIds.has(id)
      else if(activeFilter==='optimize') matchesCategory=optimizeIds.has(id)
      else if(activeFilter==='convert') matchesCategory=tool.category==='convert'
      else if(activeFilter==='edit') matchesCategory=editIds.has(id)
      else if(activeFilter==='security') matchesCategory=securityIds.has(id)
      else if(activeFilter==='legal') matchesCategory=tool.category==='legal' || id==='ocr' || id==='pdfa'
      if(!matchesCategory) return false
      if(!needle) return true
      const haystack=normalize(`${tool.title} ${tool.desc} ${'badge' in tool ? tool.badge : ''}`)
      return haystack.includes(needle)
    }).sort((a,b)=>(homePriorityIndex.get(a.id as ToolId)??999)-(homePriorityIndex.get(b.id as ToolId)??999))
  },[activeFilter,query])

  return <div className="premium-landing tool-first-landing">
    <section className="tools-first-section" id="ferramentas">
      <div className="tools-first-aura aura-one"/><div className="tools-first-aura aura-two"/>
      <div className="tools-first-intro">
        <div className="tools-first-badge"><Sparkles size={14}/> 25 ferramentas. Um único ambiente.</div>
        <h1>O que você precisa fazer<br/><span>com seu PDF?</span></h1>
        <p>Junte, divida, comprima, converta, proteja e prepare documentos sem ficar procurando a ferramenta certa. O processamento principal acontece no seu dispositivo.</p>
      </div>

      <div className="home-tool-finder">
        <Search size={20}/>
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar ferramenta: comprimir, OCR, Word, senha, Redline..." aria-label="Buscar ferramenta PDF"/>
        {query&&<button type="button" onClick={()=>setQuery('')}>Limpar</button>}
      </div>

      <div className="home-tool-filters" role="tablist" aria-label="Categorias de ferramentas">
        {filters.map(filter=><button key={filter.id} type="button" role="tab" aria-selected={activeFilter===filter.id} className={activeFilter===filter.id?'active':''} onClick={()=>setActiveFilter(filter.id)}>{filter.label}</button>)}
      </div>

      <div className="home-tools-meta"><span><b>{filteredTools.length}</b> {filteredTools.length===1?'ferramenta':'ferramentas'}</span><span><ShieldCheck size={14}/> Processamento local</span><span><LockKeyhole size={14}/> Sem upload do conteúdo</span></div>

      {filteredTools.length>0?<div className="home-tool-grid">
        {filteredTools.map(tool=>{
          const Icon=tool.icon
          const id=tool.id as ToolId
          const badge='badge' in tool ? tool.badge : (popularIds.has(id)?'POPULAR':null)
          return <Link to={`/tool/${tool.id}`} className="home-tool-card" key={tool.id} style={{'--tool-color':tool.color} as CSSProperties}>
            <div className="home-tool-card-top">
              <span className="home-tool-icon"><Icon size={23}/></span>
              {badge&&<small>{badge}</small>}
            </div>
            <div className="home-tool-card-copy"><h2>{tool.title}</h2><p>{tool.desc}</p></div>
            <span className="home-tool-open">Abrir ferramenta <ArrowRight size={15}/></span>
          </Link>
        })}
      </div>:<div className="home-tools-empty"><Search size={26}/><strong>Nenhuma ferramenta encontrada</strong><span>Tente outro termo ou selecione “Todas”.</span><button type="button" onClick={()=>{setQuery('');setActiveFilter('all')}}>Mostrar todas</button></div>}

      <div className="tools-first-trustbar">
        <span><Zap size={16}/><b>Rápido</b><small>uso imediato no navegador</small></span>
        <span><LockKeyhole size={16}/><b>Privado</b><small>arquivos ficam no dispositivo</small></span>
        <span><FileCheck2 size={16}/><b>Profissional</b><small>fluxos jurídicos e empresariais</small></span>
        <Link to="/tool/prepare-document">Preparar documento <ArrowRight size={16}/></Link>
      </div>
    </section>

    <section className="landing-section redline-showcase" id="legal-redline">
      <div className="redline-visual">
        <div className="redline-doc-head"><Files size={18}/><span><strong>Contrato — Revisão 03</strong><small>Comparação entre versões</small></span><em>REDLINE</em></div>
        <div className="redline-paper">
          <span className="paper-line wide"/><span className="paper-line"/><span className="paper-line medium"/>
          <p className="deleted">O pagamento ocorrerá em até 60 dias após a emissão.</p>
          <p className="added">O pagamento ocorrerá em até 30 dias após o aceite da nota fiscal.</p>
          <span className="paper-line wide"/><span className="paper-line small"/>
          <div className="redline-summary"><span><b>8</b> adições</span><span><b>5</b> remoções</span><span><b>4</b> alterações</span></div>
        </div>
      </div>
      <div className="redline-copy"><p className="kicker">LEGAL REDLINE</p><h2>Veja o que mudou.<br/>Entregue a revisão.</h2><p>Compare duas versões de um PDF, visualize inclusões e remoções e gere um novo documento marcado para revisão.</p><ul><li><Check size={16}/> Identificação visual de alterações</li><li><Check size={16}/> Relatório de comparação</li><li><Check size={16}/> PDF Redline para compartilhar</li></ul><Link className="primary-btn" to="/tool/compare">Comparar duas versões <ArrowRight size={17}/></Link></div>
    </section>

    <section className="landing-section privacy-premium" id="privacidade">
      <div className="privacy-premium-copy"><p className="kicker">PRIVACIDADE POR ARQUITETURA</p><h2>Seu documento não precisa viajar para ser processado.</h2><p>O processamento principal acontece no navegador. Isso reduz exposição desnecessária e torna o produto adequado para documentos que você não quer espalhar entre serviços externos.</p><div className="privacy-checks"><span><CheckCircle2 size={17}/> Sem bucket de documentos</span><span><CheckCircle2 size={17}/> Sem API de upload para o PDF</span><span><CheckCircle2 size={17}/> Processamento no dispositivo</span></div></div>
      <div className="privacy-diagram"><div className="device-box"><span className="device-dot"/><strong>SEU DISPOSITIVO</strong><div><FileCheck2/><span>PDF</span></div><i/><div><Zap/><span>Motor local</span></div><i/><div><CheckCircle2/><span>Resultado</span></div></div><div className="blocked-cloud"><span>NUVEM DE DOCUMENTOS</span><strong>não necessária</strong><EyeOff size={27}/></div></div>
    </section>

    <section className="landing-section plans-section" id="planos">
      <div className="landing-section-intro"><p className="kicker">DO USO RÁPIDO AO FLUXO PROFISSIONAL</p><h2>Use agora. Evolua com o produto.</h2><p>As ferramentas atuais já podem ser usadas no navegador. A estrutura de planos profissionais está em preparação e será publicada com preços e condições antes de qualquer cobrança.</p></div>
      <div className="commercial-plan-grid">
        <article><span className="plan-label">DISPONÍVEL AGORA</span><h3>PDF Essentials</h3><p>Para tarefas rápidas e documentos do dia a dia.</p><ul><li><Check/> Compressão e organização</li><li><Check/> Mesclar e dividir</li><li><Check/> Conversores essenciais</li></ul><Link to="/tool/compress">Começar agora <ArrowRight size={15}/></Link></article>
        <article className="highlight"><span className="plan-label">PROFISSIONAL · EM PREPARAÇÃO</span><h3>Document Workflow</h3><p>Recursos avançados já disponíveis para experimentar, com modelo comercial ainda em definição.</p><ul><li><Check/> OCR e preparação documental</li><li><Check/> Redline e redação permanente</li><li><Check/> Presets, PDF/A e Trust Report</li></ul><Link to="/tool/prepare-document">Explorar recursos profissionais <ArrowRight size={15}/></Link></article>
        <article><span className="plan-label">BUSINESS · EM PREPARAÇÃO</span><h3>Teams & Governance</h3><p>Direção futura para equipes que precisam de padrão, controle e distribuição corporativa.</p><ul><li><Check/> Presets organizacionais</li><li><Check/> Gestão e licenciamento</li><li><Check/> Distribuição corporativa</li></ul><Link to="/contact" className="plan-soon">Acompanhar evolução</Link></article>
      </div>
    </section>

    <section className="landing-cta">
      <div><p className="kicker">PRONTO PARA COMEÇAR</p><h2>Escolha uma ferramenta e resolva agora.</h2><p>Sem instalar um aplicativo e sem enviar o conteúdo do documento para uma nuvem de processamento.</p></div>
      <div><a className="primary-btn premium-primary" href="#ferramentas">Ver ferramentas <ArrowRight size={18}/></a><Link className="secondary-btn" to="/faq">Central de ajuda</Link></div>
    </section>
  </div>
}
