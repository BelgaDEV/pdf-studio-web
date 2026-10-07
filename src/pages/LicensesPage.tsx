import { FileCheck2, Info, Scale } from 'lucide-react'
import { APP_NAME, APP_VERSION } from '../lib/appMeta'

export default function LicensesPage(){
  return <div className="info-page public-info-page">
    <section className="info-hero"><div className="info-hero-icon"><FileCheck2 size={28}/></div><div><p className="kicker">LICENÇAS</p><h1>Transparência sobre o software.</h1><p>Informações de licenciamento relevantes ao {APP_NAME} v{APP_VERSION} e aos componentes usados no processamento documental.</p></div></section>
    <section className="public-info-grid">
      <article><Scale/><h2>Aplicação</h2><p>A distribuição atual do projeto é identificada como AGPL-3.0-or-later. O modelo de licenciamento comercial deverá ser revisto antes da abertura de uma oferta proprietária paga.</p></article>
      <article><Info/><h2>Componentes de terceiros</h2><p>O produto utiliza bibliotecas e motores independentes, cada um sujeito à sua própria licença. O pacote-fonte inclui avisos de terceiros para auditoria da distribuição.</p></article>
      <article><FileCheck2/><h2>Ghostscript</h2><p>O Ghostscript possui licenciamento próprio, incluindo AGPL e opção comercial do fornecedor. Esse ponto é tratado como requisito explícito antes de uma distribuição proprietária comercial.</p></article>
    </section>
    <section className="public-copy-block"><h2>Por que esta página existe</h2><p>Licenciamento é parte da segurança jurídica do produto. A página não substitui os textos integrais das licenças nem os avisos incluídos no código-fonte, mas torna os principais pontos visíveis para usuários e avaliadores.</p><h2>Antes da venda</h2><p>Qualquer mudança de modelo comercial deverá preservar as obrigações das dependências utilizadas ou substituir os componentes cujo licenciamento não seja compatível com o modelo escolhido.</p></section>
  </div>
}
