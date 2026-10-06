import { ChevronLeft, ChevronRight, Clock3, Home, LockKeyhole, Menu, Search, ShieldCheck, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { tools, type ToolCategory, type ToolId } from '../lib/tools'
import { loadFavoriteToolIds, loadRecentToolIds, recordRecentTool, subscribeProductivity, toggleFavoriteTool } from '../lib/productivity'

const groups: { id:ToolCategory; title:string }[] = [
  { id:'legal', title:'Legal & Business' },
  { id:'essential', title:'PDF essencial' },
  { id:'document', title:'Document Tools' },
  { id:'automation', title:'Automação' },
  { id:'convert', title:'Conversores' },
]

export default function Layout(){
  const location=useLocation()
  const [open,setOpen]=useState(false)
  const [collapsed,setCollapsed]=useState(false)
  const [query,setQuery]=useState('')
  const [favorites,setFavorites]=useState<ToolId[]>(()=>loadFavoriteToolIds())
  const [recents,setRecents]=useState<ToolId[]>(()=>loadRecentToolIds())

  useEffect(()=>{
    const path=location.pathname
    let title='PDF Studio — automação documental privada'
    if(path==='/faq') title='FAQ e Ajuda — PDF Studio'
    else if(path==='/roadmap') title='Roadmap — PDF Studio'
    else if(path==='/workflows') title='Workflows salvos — PDF Studio'
    else if(path.startsWith('/tool/')){
      const id=path.split('/').filter(Boolean).pop()
      const tool=tools.find(t=>t.id===id)
      if(tool) title=`${tool.title} — PDF Studio`
    }
    document.title=title
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

  return <div className={`app-shell app-shell-with-sidebar ${collapsed?'sidebar-collapsed':''}`}>
    <aside className="quick-sidebar" aria-label="Acesso rápido às ferramentas">
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
    </aside>

    <header className="topbar">
      <Link to="/" className="brand mobile-brand"><span className="brand-mark">P</span><span>PDF Studio</span></Link>
      <nav className="desktop-nav">
        <Link to="/#tools">Ferramentas</Link><Link to="/workflows">Workflows</Link><Link to="/faq">FAQ</Link><Link to="/roadmap">Roadmap</Link><Link to="/#privacy">Privacidade</Link>
      </nav>
      <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Menu">{open?<X/>:<Menu/>}</button>
    </header>
    {open && <div className="mobile-menu">
      <NavLink to="/" onClick={()=>setOpen(false)}>Início</NavLink>
      <NavLink to="/workflows" onClick={()=>setOpen(false)}>Workflows salvos</NavLink>
      <NavLink to="/faq" onClick={()=>setOpen(false)}>FAQ / Ajuda</NavLink>
      <NavLink to="/roadmap" onClick={()=>setOpen(false)}>Roadmap</NavLink>
      {tools.map(t=><NavLink key={t.id} to={`/tool/${t.id}`} onClick={()=>setOpen(false)}>{t.title}</NavLink>)}
    </div>}
    <main className="app-main"><Outlet/></main>
    <footer className="footer">
      <div><div className="brand footer-brand"><span className="brand-mark">P</span><span>PDF Studio</span></div><p>Ferramentas PDF privadas, processadas no seu navegador.</p></div>
      <div className="footer-badges"><span><ShieldCheck size={16}/> Sem upload</span><span><LockKeyhole size={16}/> Processamento local</span><span>v1.9.2</span></div>
    </footer>
  </div>
}
