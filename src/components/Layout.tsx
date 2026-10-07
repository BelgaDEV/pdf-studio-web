import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Clock3, Home, LockKeyhole, Menu, Search, ShieldCheck, Star, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { tools, type ToolCategory, type ToolId } from '../lib/tools'
import { loadFavoriteToolIds, loadRecentToolIds, recordRecentTool, subscribeProductivity, toggleFavoriteTool } from '../lib/productivity'
import { APP_META, APP_NAME, APP_VERSION } from '../lib/appMeta'

const groups: { id:ToolCategory; title:string }[] = [
  { id:'legal', title:'Legal & Business' },
  { id:'essential', title:'PDF essencial' },
  { id:'document', title:'Document Tools' },
  { id:'automation', title:'Automação' },
  { id:'convert', title:'Conversores' },
]

const megaMenuGroups: Array<{title:string; eyebrow:string; ids:ToolId[]}> = [
  { title:'Organizar PDF', eyebrow:'PÁGINAS E ESTRUTURA', ids:['merge','split','organize','edit-pages','page-numbers'] },
  { title:'Converter PDF', eyebrow:'FORMATOS', ids:['pdf-word','word-pdf','pdf-jpg','pdf-png','images-pdf'] },
  { title:'Otimizar PDF', eyebrow:'TAMANHO E LEITURA', ids:['compress','ocr','remove-blank','extract-images','pdf-txt'] },
  { title:'Editar e proteger', eyebrow:'CONTEÚDO E SEGURANÇA', ids:['watermark','remove-metadata','protect','pdfa','redact'] },
  { title:'Profissional', eyebrow:'JURÍDICO E AUTOMAÇÃO', ids:['compare','prepare-document','tribunal-presets','trust-report','batch'] },
]

export default function Layout(){
  const location=useLocation()
  const [open,setOpen]=useState(false)
  const [collapsed,setCollapsed]=useState(false)
  const [query,setQuery]=useState('')
  const [favorites,setFavorites]=useState<ToolId[]>(()=>loadFavoriteToolIds())
  const [recents,setRecents]=useState<ToolId[]>(()=>loadRecentToolIds())

  useEffect(()=>{
    const previous=window.history.scrollRestoration
    window.history.scrollRestoration='manual'
    return ()=>{ window.history.scrollRestoration=previous }
  },[])

  useLayoutEffect(()=>{
    const resetScroll=()=>{
      const root=document.documentElement
      const previousBehavior=root.style.scrollBehavior
      root.style.scrollBehavior='auto'
      window.scrollTo(0,0)
      root.scrollTop=0
      document.body.scrollTop=0
      const main=document.querySelector('.app-main')
      if(main instanceof HTMLElement) main.scrollTop=0
      requestAnimationFrame(()=>{ root.style.scrollBehavior=previousBehavior })
    }

    if(location.hash){
      const targetId=decodeURIComponent(location.hash.slice(1))
      requestAnimationFrame(()=>{
        const target=document.getElementById(targetId)
        if(target) target.scrollIntoView({block:'start'})
        else resetScroll()
      })
      return
    }

    resetScroll()
  },[location.pathname,location.hash])

  useEffect(()=>{
    const path=location.pathname
    let meta: {title:string;description:string} = APP_META.home
    if(path==='/faq') meta=APP_META.faq
    else if(path==='/roadmap') meta=APP_META.roadmap
    else if(path==='/workflows') meta=APP_META.workflows
    else if(path==='/privacy') meta=APP_META.privacy
    else if(path==='/terms') meta=APP_META.terms
    else if(path==='/licenses') meta=APP_META.licenses
    else if(path==='/contact') meta=APP_META.contact
    else if(path.startsWith('/tool/')){
      const id=path.split('/').filter(Boolean).pop()
      const tool=tools.find(t=>t.id===id)
      meta=tool
        ? {title:`${tool.title} — ${APP_NAME}`,description:tool.desc}
        : APP_META.notFound
    } else if(path!=='/') meta=APP_META.notFound

    document.title=meta.title
    let description=document.querySelector('meta[name="description"]')
    if(!description){
      description=document.createElement('meta')
      description.setAttribute('name','description')
      document.head.appendChild(description)
    }
    description.setAttribute('content',meta.description)
  },[location.pathname])

  useEffect(()=>subscribeProductivity(()=>{setFavorites(loadFavoriteToolIds());setRecents(loadRecentToolIds())}),[])
  useEffect(()=>{
    if(!location.pathname.startsWith('/tool/')) return
    const id=location.pathname.split('/').filter(Boolean).pop() as ToolId | undefined
    if(id && tools.some(tool=>tool.id===id)){
      const next=recordRecentTool(id)
      setRecents(next)
    }
  },[location.pathname])

  const isLanding=location.pathname==='/'
  const normalized=query.trim().toLocaleLowerCase('pt-BR')
  const grouped=useMemo(()=>groups.map(group=>({
    ...group,
    items:tools.filter(t=>t.category===group.id && (!normalized || `${t.title} ${t.desc}`.toLocaleLowerCase('pt-BR').includes(normalized)))
  })).filter(group=>group.items.length>0),[normalized])
  const favoriteTools=favorites.map(id=>tools.find(tool=>tool.id===id)).filter(Boolean) as Array<(typeof tools)[number]>
  const recentTools=recents.map(id=>tools.find(tool=>tool.id===id)).filter(Boolean) as Array<(typeof tools)[number]>
  function toggleFavorite(id:ToolId){ setFavorites(toggleFavoriteTool(id)) }
  function renderToolShortcut(t:(typeof tools)[number],showStar=true){
    const Icon=t.icon
    const favorite=favorites.includes(t.id)
    return <div className="quick-tool-row" key={t.id}>
      <NavLink to={`/tool/${t.id}`} className={({isActive})=>`quick-nav-item tool-shortcut ${isActive?'active':''}`} title={t.title}>
        <span className="quick-icon" style={{background:t.color}}><Icon size={15}/></span><span className="sidebar-label">{t.title}</span>{'badge' in t && <small className="sidebar-label">{t.badge}</small>}
      </NavLink>
      {showStar&&<button type="button" className={`quick-favorite-btn sidebar-label ${favorite?'active':''}`} onClick={()=>toggleFavorite(t.id)} aria-label={favorite?`Remover ${t.title} dos favoritos`:`Adicionar ${t.title} aos favoritos`} title={favorite?'Remover dos favoritos':'Adicionar aos favoritos'}><Star size={13} fill={favorite?'currentColor':'none'}/></button>}
    </div>
  }

  return <div className={isLanding?'app-shell landing-shell':`app-shell app-shell-with-sidebar ${collapsed?'sidebar-collapsed':''}`}>
    {!isLanding&&<aside className="quick-sidebar" aria-label="Acesso rápido às ferramentas">
      <div className="quick-sidebar-head">
        <Link to="/" className="brand sidebar-brand"><span className="brand-mark">P</span><span className="sidebar-label">PDF Studio</span></Link>
        <button className="sidebar-collapse" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expandir menu':'Recolher menu'}>{collapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button>
      </div>
      <div className="sidebar-label sidebar-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ferramenta..." aria-label="Buscar ferramenta"/></div>
      <nav className="quick-nav">
        <NavLink to="/" end className={({isActive})=>`quick-nav-item ${isActive?'active':''}`}><Home size={18}/><span className="sidebar-label">Início</span></NavLink>
        <div className="sidebar-divider"/>
        {!normalized&&favoriteTools.length>0&&<div className="quick-nav-group productivity-group"><p className="sidebar-label"><Star size={10}/> Favoritos</p>{favoriteTools.slice(0,5).map(t=>renderToolShortcut(t,true))}</div>}
        {!normalized&&recentTools.length>0&&<div className="quick-nav-group productivity-group"><p className="sidebar-label"><Clock3 size={10}/> Recentes</p>{recentTools.slice(0,5).map(t=>renderToolShortcut(t,false))}</div>}
        {(favoriteTools.length>0||recentTools.length>0)&&!normalized&&<div className="sidebar-divider"/>}
        {grouped.map(group=><div className="quick-nav-group" key={group.id}>
          <p className="sidebar-label">{group.title}</p>
          {group.items.map(t=>renderToolShortcut(t,true))}
        </div>)}
      </nav>
      <div className="sidebar-bottom sidebar-label"><ShieldCheck size={15}/><span>Processamento local</span></div>
    </aside>}

    <header className="topbar">
      <Link to="/" className="brand mobile-brand"><span className="brand-mark">P</span><span>PDF Studio</span></Link>
      <nav className="desktop-nav">
        {isLanding?<>
          <Link to="/tool/merge">Juntar PDF</Link>
          <Link to="/tool/split">Dividir PDF</Link>
          <Link to="/tool/compress">Comprimir PDF</Link>
          <div className="topbar-dropdown">
            <button type="button">Converter PDF <ChevronDown size={14}/></button>
            <div className="topbar-dropdown-menu">
              <Link to="/tool/pdf-word"><b>PDF para Word</b><small>Transforme PDF em DOCX</small></Link>
              <Link to="/tool/word-pdf"><b>Word para PDF</b><small>Converta DOCX em PDF</small></Link>
              <Link to="/tool/pdf-jpg"><b>PDF para JPG</b><small>Exporte páginas como imagem</small></Link>
              <Link to="/tool/images-pdf"><b>Imagens para PDF</b><small>Junte JPG e PNG em PDF</small></Link>
            </div>
          </div>
          <div className="mega-menu-trigger">
            <button type="button" className="mega-menu-button" aria-haspopup="true">Todas as ferramentas <ChevronDown size={14}/></button>
            <div className="mega-menu-panel" role="menu" aria-label="Todas as ferramentas PDF">
              <div className="mega-menu-surface">
                <div className="mega-menu-head">
                  <div><span>PDF STUDIO</span><strong>Todas as ferramentas em um só lugar</strong></div>
                  <a href="#ferramentas">Ver grade completa <ArrowRight size={14}/></a>
                </div>
                <div className="mega-menu-grid">
                  {megaMenuGroups.map(group=><section className="mega-menu-column" key={group.title}>
                    <span className="mega-menu-eyebrow">{group.eyebrow}</span>
                    <h3>{group.title}</h3>
                    <div className="mega-menu-links">
                      {group.ids.map(id=>{
                        const tool=tools.find(item=>item.id===id)
                        if(!tool) return null
                        const Icon=tool.icon
                        return <Link key={tool.id} to={`/tool/${tool.id}`} className="mega-menu-tool">
                          <span className="mega-menu-tool-icon" style={{color:tool.color}}><Icon size={16}/></span>
                          <span><b>{tool.title}</b><small>{tool.desc}</small></span>
                        </Link>
                      })}
                    </div>
                  </section>)}
                </div>
                <div className="mega-menu-footer">
                  <span><ShieldCheck size={14}/> Processamento principal no dispositivo</span>
                  <Link to="/tool/compare">Destaque: Comparar PDFs <ArrowRight size={14}/></Link>
                </div>
              </div>
            </div>
          </div>
          <Link className="topbar-compare-link" to="/tool/compare">Comparar PDF</Link>
          <Link to="/faq">Ajuda</Link>
          <Link className="topbar-cta" to="/tool/prepare-document">Preparar documento <ArrowRight size={15}/></Link>
        </>:<>
          <Link to="/">Início</Link><Link to="/workflows">Workflows</Link><Link to="/faq">FAQ</Link><Link to="/roadmap">Roadmap</Link><Link to="/#privacidade">Privacidade</Link>
        </>}
      </nav>
      <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Menu">{open?<X/>:<Menu/>}</button>
    </header>
    {open && <div className="mobile-menu">
      {isLanding?<>
        <NavLink to="/tool/merge" onClick={()=>setOpen(false)}>Juntar PDF</NavLink>
        <NavLink to="/tool/split" onClick={()=>setOpen(false)}>Dividir PDF</NavLink>
        <NavLink to="/tool/compress" onClick={()=>setOpen(false)}>Comprimir PDF</NavLink>
        <NavLink to="/tool/pdf-word" onClick={()=>setOpen(false)}>PDF para Word</NavLink>
        <NavLink to="/tool/word-pdf" onClick={()=>setOpen(false)}>Word para PDF</NavLink>
        <a href="#ferramentas" onClick={()=>setOpen(false)}>Todas as ferramentas</a>
        <NavLink to="/tool/compare" onClick={()=>setOpen(false)}>Comparar PDF</NavLink>
        <a href="#privacidade" onClick={()=>setOpen(false)}>Privacidade</a>
        <a href="#planos" onClick={()=>setOpen(false)}>Planos</a>
        <NavLink to="/faq" onClick={()=>setOpen(false)}>FAQ / Ajuda</NavLink>
        <NavLink to="/tool/prepare-document" onClick={()=>setOpen(false)}>Preparar documento</NavLink>
      </>:<>
        <NavLink to="/" onClick={()=>setOpen(false)}>Início</NavLink>
        <NavLink to="/workflows" onClick={()=>setOpen(false)}>Workflows salvos</NavLink>
        <NavLink to="/faq" onClick={()=>setOpen(false)}>FAQ / Ajuda</NavLink>
        <NavLink to="/roadmap" onClick={()=>setOpen(false)}>Roadmap</NavLink>
        {tools.map(t=><NavLink key={t.id} to={`/tool/${t.id}`} onClick={()=>setOpen(false)}>{t.title}</NavLink>)}
      </>}
    </div>}
    <main className="app-main"><Outlet/></main>
    <footer className="footer">
      <div className="footer-identity"><div className="brand footer-brand"><span className="brand-mark">P</span><span>PDF Studio</span></div><p>Ferramentas PDF privadas, processadas no seu navegador.</p><nav className="footer-links" aria-label="Informações públicas"><Link to="/privacy">Privacidade</Link><Link to="/terms">Termos</Link><Link to="/licenses">Licenças</Link><Link to="/contact">Contato</Link><Link to="/faq">Ajuda</Link></nav></div>
      <div className="footer-badges"><span><ShieldCheck size={16}/> Sem upload</span><span><LockKeyhole size={16}/> Processamento local</span><span>v{APP_VERSION}</span></div>
    </footer>
  </div>
}
