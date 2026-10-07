import { Database, HardDrive, LockKeyhole, ShieldCheck } from 'lucide-react'
import { APP_NAME, APP_VERSION } from '../lib/appMeta'

export default function PrivacyPage(){
  return <div className="info-page public-info-page">
    <section className="info-hero"><div className="info-hero-icon"><ShieldCheck size={28}/></div><div><p className="kicker">PRIVACIDADE</p><h1>Privacidade por arquitetura.</h1><p>Esta página descreve o comportamento atual do {APP_NAME} v{APP_VERSION}. O princípio do produto é processar documentos localmente sempre que a ferramenta permitir.</p></div></section>
    <section className="public-info-grid">
      <article><HardDrive/><h2>Documentos no dispositivo</h2><p>Nas ferramentas locais, o conteúdo do PDF é processado no navegador. O fluxo atual não depende de um backend que receba e armazene seus documentos.</p></article>
      <article><Database/><h2>Preferências locais</h2><p>Favoritos, recentes e workflows podem usar armazenamento local do navegador. Esses dados servem à experiência do produto e não incluem o conteúdo dos PDFs.</p></article>
      <article><LockKeyhole/><h2>Recursos externos</h2><p>Alguns motores podem baixar arquivos técnicos necessários ao processamento, como modelos de idioma para OCR. Isso é diferente de enviar o conteúdo do documento para processamento remoto.</p></article>
    </section>
    <section className="public-copy-block"><h2>O que o produto não promete</h2><p>Processamento local reduz exposição, mas não substitui controles do dispositivo, do navegador, da rede ou políticas internas da sua organização. Arquivos baixados continuam sob responsabilidade do usuário após o processamento.</p><h2>Dados de diagnóstico</h2><p>A versão atual não envia o nome ou o conteúdo do documento como telemetria de produto. Se futuramente forem adicionadas métricas anônimas de funcionamento, essa página deverá ser atualizada antes da ativação.</p><h2>Atualizações desta página</h2><p>Esta descrição acompanha o comportamento técnico do produto e deve ser revista sempre que houver mudança relevante de arquitetura, armazenamento ou processamento.</p></section>
  </div>
}
