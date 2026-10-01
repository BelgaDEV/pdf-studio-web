import { Github, LockKeyhole, Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { tools } from '../lib/tools'

export default function Layout(){
  const [open,setOpen]=useState(false)
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark">P</span><span>PDF Studio</span></Link>
      <nav className="desktop-nav">
        <Link to="/#tools">Ferramentas</Link><Link to="/#privacy">Privacidade</Link>
        <a href="https://github.com/" target="_blank" rel="noreferrer"><Github size={17}/> GitHub</a>
      </nav>
      <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Menu">{open?<X/>:<Menu/>}</button>
    </header>
    {open && <div className="mobile-menu">
      {tools.map(t=><NavLink key={t.id} to={`/tool/${t.id}`} onClick={()=>setOpen(false)}>{t.title}</NavLink>)}
    </div>}
    <main><Outlet/></main>
    <footer className="footer">
      <div><div className="brand footer-brand"><span className="brand-mark">P</span><span>PDF Studio</span></div><p>Ferramentas PDF privadas, processadas no seu navegador.</p></div>
      <div className="footer-badges"><span><ShieldCheck size={16}/> Sem upload</span><span><LockKeyhole size={16}/> Processamento local</span></div>
    </footer>
  </div>
}
