import { ChevronLeft, ChevronRight, Github, HelpCircle, Home, LockKeyhole, Map, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { tools, type ToolCategory } from '../lib/tools'

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

  useEffect(()=>{
    const path=location.pathname
    let title='PDF Studio — automação documental privada'
    if(path==='/faq') title='FAQ e Ajuda — PDF Studio'
    else if(path==='/roadmap') title='Roadmap — PDF Studio'
    else if(path.startsWith('/tool/')){
      const id=path.split('/').filter(Boolean).pop()
      const tool=tools.find(t=>t.id===id)
      if(tool) title=`${tool.title} — PDF Studio`
    }
    document.title=title
  },[location.pathname])
  const normalized=query.trim().toLocaleLowerCase('pt-BR')
  const grouped=useMemo(()=>groups.map(group=>({
    ...group,
    items:tools.filter(t=>t.category===group.id && (!normalized || `${t.title} ${t.desc}`.toLocaleLowerCase('pt-BR').includes(normalized)))
  })).filter(group=>group.items.length>0),[normalized])

  return <div className={`app-shell app-shell-with-sidebar ${collapsed?'sidebar-collapsed':''}`}>
    <aside className="quick-sidebar" aria-label="Acesso rápido às ferramentas">
      <div className="quick-sidebar-head">
        <Link to="/" className="brand sidebar-brand"><span className="brand-mark">P</span><span className="sidebar-label">PDF Studio</span></Link>
        <button className="sidebar-collapse" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expandir menu':'Recolher menu'}>{collapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button>
      </div>
      <div className="sidebar-label sidebar-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ferramenta..." aria-label="Buscar ferramenta"/></div>
      <nav className="quick-nav">
        <NavLink to="/" end className={({isActive})=>`quick-nav-item ${isActive?'active':''}`}><Home size={18}/><span className="sidebar-label">Início</span></NavLink>
        <NavLink to="/faq" className={({isActive})=>`quick-nav-item ${isActive?'active':''}`}><HelpCircle size={18}/><span className="sidebar-label">FAQ / Ajuda</span></NavLink>
        <NavLink to="/roadmap" className={({isActive})=>`quick-nav-item ${isActive?'active':''}`}><Map size={18}/><span className="sidebar-label">Roadmap</span></NavLink>
        <div className="sidebar-divider"/>
        {grouped.map(group=><div className="quick-nav-group" key={group.id}>
          <p className="sidebar-label">{group.title}</p>
          {group.items.map(t=>{const Icon=t.icon;return <NavLink key={t.id} to={`/tool/${t.id}`} className={({isActive})=>`quick-nav-item tool-shortcut ${isActive?'active':''}`} title={t.title}>
            <span className="quick-icon" style={{background:t.color}}><Icon size={15}/></span><span className="sidebar-label">{t.title}</span>{'badge' in t && <small className="sidebar-label">{t.badge}</small>}
          </NavLink>})}
        </div>)}
      </nav>
      <div className="sidebar-bottom sidebar-label"><ShieldCheck size={15}/><span>Processamento local</span></div>
    </aside>

    <header className="topbar">
      <Link to="/" className="brand mobile-brand"><span className="brand-mark">P</span><span>PDF Studio</span></Link>
      <nav className="desktop-nav">
        <Link to="/#tools">Ferramentas</Link><Link to="/faq">FAQ</Link><Link to="/roadmap">Roadmap</Link><Link to="/#privacy">Privacidade</Link>
        <a href="https://github.com/BelgaDEV/pdf-studio-web" target="_blank" rel="noreferrer"><Github size={17}/> GitHub</a>
      </nav>
      <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Menu">{open?<X/>:<Menu/>}</button>
    </header>
    {open && <div className="mobile-menu">
      <NavLink to="/" onClick={()=>setOpen(false)}>Início</NavLink>
      <NavLink to="/faq" onClick={()=>setOpen(false)}>FAQ / Ajuda</NavLink>
      <NavLink to="/roadmap" onClick={()=>setOpen(false)}>Roadmap</NavLink>
      {tools.map(t=><NavLink key={t.id} to={`/tool/${t.id}`} onClick={()=>setOpen(false)}>{t.title}</NavLink>)}
    </div>}
    <main className="app-main"><Outlet/></main>
    <footer className="footer">
      <div><div className="brand footer-brand"><span className="brand-mark">P</span><span>PDF Studio</span></div><p>Ferramentas PDF privadas, processadas no seu navegador.</p></div>
      <div className="footer-badges"><span><ShieldCheck size={16}/> Sem upload</span><span><LockKeyhole size={16}/> Processamento local</span><span>v1.8.4</span></div>
    </footer>
  </div>
}
