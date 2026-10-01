import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, UploadCloud, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tools } from '../lib/tools'

export default function Home(){
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><ShieldCheck size={15}/> 100% local • sem upload • sem cadastro</div>
        <h1>Seus PDFs mais leves, <span>organizados e convertidos.</span></h1>
        <p>Comprima, converta, mescle e divida documentos diretamente no navegador. Seus arquivos não precisam sair do seu dispositivo.</p>
        <div className="hero-actions"><Link className="primary-btn" to="/tool/compress">Comprimir um PDF <ArrowRight size={18}/></Link><a className="secondary-btn" href="#tools">Ver ferramentas</a></div>
        <div className="trust-row"><span><LockKeyhole size={18}/> Privacidade real</span><span><Zap size={18}/> Progresso ao vivo</span><span><CheckCircle2 size={18}/> Sem servidor</span></div>
      </div>
      <div className="upload-hero">
        <UploadCloud size={52}/><strong>Arraste seus PDFs nas ferramentas</strong><p>O processamento acontece no seu próprio navegador.</p><Link className="primary-btn wide" to="/tool/compress">Selecionar ferramenta</Link>
      </div>
    </section>

    <section id="tools" className="section">
      <div className="section-head"><div><p className="kicker">FERRAMENTAS</p><h2>Tudo para trabalhar com PDFs</h2></div><p>Sem upload, sem fila e sem esperar servidor.</p></div>
      <div className="tool-grid">{tools.map(t=>{const Icon=t.icon;return <Link to={`/tool/${t.id}`} className="tool-card" key={t.id}>
        <div className="tool-icon" style={{background:t.color}}><Icon size={23}/></div><div><h3>{t.title}</h3><p>{t.desc}</p></div><ArrowRight className="tool-arrow" size={20}/>
      </Link>})}</div>
    </section>

    <section id="privacy" className="privacy-section">
      <div><p className="kicker">PRIVACIDADE</p><h2>Seus documentos ficam com você.</h2><p>O site é apenas a interface. Compressão, mesclagem, divisão e conversões são executadas no navegador.</p></div>
      <div className="privacy-grid"><div><LockKeyhole/><strong>Sem upload</strong><span>Arquivos não são enviados para uma API.</span></div><div><ShieldCheck/><strong>Sem armazenamento</strong><span>Não temos banco ou bucket com seus documentos.</span></div><div><Zap/><strong>Seu hardware</strong><span>CPU e memória do seu dispositivo executam o trabalho.</span></div></div>
    </section>
  </>
}
