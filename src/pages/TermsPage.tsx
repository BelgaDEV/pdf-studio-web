import { FileCheck2, Scale, TriangleAlert } from 'lucide-react'
import { APP_NAME, APP_VERSION } from '../lib/appMeta'

export default function TermsPage(){
  return <div className="info-page public-info-page">
    <section className="info-hero"><div className="info-hero-icon"><Scale size={28}/></div><div><p className="kicker">TERMOS DE USO</p><h1>Uso responsável das ferramentas.</h1><p>Condições gerais para uso do {APP_NAME} v{APP_VERSION} enquanto o produto está em fase pública de evolução.</p></div></section>
    <section className="public-info-grid">
      <article><FileCheck2/><h2>Você controla os arquivos</h2><p>Use somente documentos que você tenha autorização para processar, editar, converter, proteger ou compartilhar.</p></article>
      <article><TriangleAlert/><h2>Revise o resultado</h2><p>Conversão, OCR, compressão, comparação, redação e PDF/A podem variar conforme o documento. Resultados profissionais devem ser conferidos antes de protocolo, assinatura ou entrega.</p></article>
      <article><Scale/><h2>Não substitui validação profissional</h2><p>Presets, Trust Report, Redline e recursos jurídicos são ferramentas de apoio. Eles não constituem parecer jurídico, perícia, certificação, assinatura digital ou garantia de aceitação por terceiros.</p></article>
    </section>
    <section className="public-copy-block"><h2>Disponibilidade</h2><p>O serviço pode evoluir, mudar ou interromper recursos durante a fase pública. Funcionalidades marcadas como Beta podem apresentar limitações adicionais.</p><h2>Responsabilidade do usuário</h2><p>Antes de depender de um resultado para finalidade regulatória, judicial, contratual ou de arquivamento, valide o arquivo e as regras aplicáveis ao destino.</p><h2>Planos comerciais</h2><p>Os recursos profissionais apresentados na Home representam a direção comercial do produto. Enquanto a contratação não estiver oficialmente disponível, eles não constituem oferta de assinatura ou compromisso de preço.</p></section>
  </div>
}
