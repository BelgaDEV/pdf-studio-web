import { HelpCircle, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

const faq = [
  {cat:'Privacidade',q:'Meus PDFs são enviados para algum servidor?',a:'Nas ferramentas locais do PDF Studio, o arquivo é processado no próprio navegador. O objetivo do projeto é manter o documento no dispositivo do usuário. Recursos futuros que eventualmente precisem de nuvem devem ser identificados de forma explícita antes do processamento.'},
  {cat:'Privacidade',q:'O PDF Studio armazena meus documentos?',a:'Não há banco ou bucket de documentos no fluxo atual. Arquivos e resultados ficam na memória ou no armazenamento temporário do navegador durante a operação e o resultado é baixado para o dispositivo.'},
  {cat:'Automação',q:'O que são Workflows salvos?',a:'São configurações reutilizáveis do Preparar documento. Você escolhe etapas como OCR, compressão, limpeza, numeração, PDF/A e Trust Report, salva com um nome e reaplica o mesmo padrão em novos PDFs.'},
  {cat:'Automação',q:'Workflows, favoritos e recentes são enviados para um servidor?',a:'Não. Na v1.9 eles ficam no localStorage do próprio navegador. O histórico recente registra somente o identificador da ferramenta usada; não guarda nome nem conteúdo dos PDFs.'},
  {cat:'Ajuda',q:'Como adiciono uma ferramenta aos Favoritos?',a:'No menu lateral do desktop, clique na estrela ao lado da ferramenta. Os favoritos aparecem no topo do menu e também na área de acesso rápido da Home.'},
  {cat:'Compressão',q:'Qual a diferença entre Básico, Médio, Alto, Máximo e Inteligente?',a:'Básico prioriza preservação de estrutura. Médio, Alto e Máximo aumentam a redução e podem recorrer a recompressão/rasterização. Inteligente analisa o documento e escolhe um perfil. Para controle direto, use “Por tamanho”.'},
  {cat:'Compressão',q:'“Comprimir para X MB” garante exatamente o tamanho escolhido?',a:'Não. O app busca chegar abaixo ou o mais próximo possível da meta sem produzir um PDF inválido. Alguns documentos já estão muito otimizados e podem não atingir um alvo agressivo sem perda grande de qualidade.'},
  {cat:'Mesclagem',q:'Posso escolher a ordem dos PDFs antes de mesclar?',a:'Sim. Use arrastar e soltar no desktop ou os controles de movimento. O PDF final, o índice e os bookmarks seguem a ordem definida na lista.'},
  {cat:'Mesclagem',q:'O que são bookmarks e índice clicável?',a:'Bookmarks aparecem no painel lateral do leitor PDF e levam ao início de cada documento. O índice clicável cria páginas no começo do PDF com nome do arquivo e página inicial; cada item funciona como link interno.'},
  {cat:'Mesclagem',q:'Por que milhares de PDFs podem falhar no navegador?',a:'Operações extremas podem atingir limites de RAM/WebAssembly do navegador, especialmente quando o resultado final tem centenas de megabytes. O projeto possui estratégias por lotes e armazenamento temporário, mas volumes muito grandes são um candidato natural ao futuro PDF Studio Desktop.'},
  {cat:'OCR',q:'O que faz o OCR pesquisável?',a:'Ele reconhece texto em páginas escaneadas e adiciona uma camada pesquisável. Isso permite Ctrl+F e melhora extração de texto. O modelo de idioma pode precisar ser carregado no primeiro uso.'},
  {cat:'OCR',q:'Devo aplicar OCR em PDFs que já têm texto?',a:'Normalmente não. A opção de pular páginas que já têm texto reduz tempo e evita processamento desnecessário. OCR é mais útil em scans ou PDFs mistos.'},
  {cat:'Legal / Business',q:'A redação permanente é apenas uma tarja preta?',a:'Não. Nas páginas redigidas, a versão atual renderiza a página já com a área ocultada e reconstrói a página sem carregar por baixo a camada original de texto. Isso é mais seguro do que desenhar um retângulo sobre conteúdo existente.'},
  {cat:'Legal / Business',q:'Por que páginas redigidas podem perder texto selecionável?',a:'Porque a segurança da redação permanente atual vem da rasterização das páginas afetadas. As páginas não redigidas continuam preservadas normalmente.'},
  {cat:'Legal / Business',q:'Como funciona Comparar PDFs?',a:'A ferramenta tenta alinhar páginas, compara texto e, opcionalmente, diferenças visuais. Além do relatório, a v1.9.1 gera um PDF Redline: adições são marcadas em azul, remoções aparecem em vermelho tachado e alterações apenas visuais recebem marcação laranja. Não é uma perícia forense.'},
  {cat:'Legal / Business',q:'O que é Preparar documento?',a:'É um pipeline que encadeia várias ferramentas: páginas em branco, compressão, OCR, metadados, marca d’água, numeração e PDF/A. O resultado final passa de uma etapa para a próxima sem downloads intermediários.'},
  {cat:'Tribunal',q:'Os Presets Tribunal garantem aceitação do arquivo?',a:'Não. Presets são referências e automações configuráveis. Limites e regras podem mudar por tribunal, instalação, classe ou sistema. O usuário deve confirmar a regra atual do destino antes do protocolo.'},
  {cat:'Trust Report',q:'O que é Document Trust Report?',a:'É um registro técnico do processamento contendo SHA-256, tamanhos, páginas, etapas e validações. O JSON verificável permite conferir posteriormente se o PDF final corresponde exatamente ao arquivo registrado.'},
  {cat:'Trust Report',q:'O Trust Report é uma assinatura digital ICP-Brasil?',a:'Não. Ele verifica integridade e correspondência por hash, mas não substitui assinatura digital, certificado, carimbo do tempo, perícia ou certificação judicial.'},
  {cat:'Document Tools',q:'Remover metadados apaga tudo que pode identificar a origem do PDF?',a:'A ferramenta remove metadados documentais conhecidos, como Info/XMP, conforme o motor disponível. Isso não é garantia de anonimização completa de todo conteúdo visual ou textual do documento.'},
  {cat:'Document Tools',q:'PDF/A gerado pelo app é suficiente para arquivamento formal?',a:'O app gera PDF/A usando o motor configurado, mas para exigências regulatórias formais recomendamos validar o resultado com um validador dedicado como veraPDF.'},
  {cat:'Conversores',q:'PDF para Word e Word para PDF preservam o layout perfeitamente?',a:'Não. Essas ferramentas continuam Beta. PDFs complexos, tabelas, colunas, fontes e documentos Word avançados podem apresentar diferenças de layout.'},
  {cat:'Desempenho',q:'Por que uma operação pode ser lenta mesmo sem upload?',a:'Porque CPU, RAM e GPU/Canvas do seu próprio dispositivo fazem o trabalho. OCR, rasterização, comparação visual e PDFs com centenas de páginas podem exigir bastante processamento.'},
  {cat:'Desempenho',q:'Qual navegador é recomendado?',a:'Chrome e Edge atualizados são os principais alvos para as operações mais pesadas, especialmente WebAssembly e armazenamento temporário local. Outros navegadores modernos podem funcionar, mas limites variam.'},
  {cat:'Ajuda',q:'O que fazer quando um botão não executa ou uma operação para?',a:'Primeiro teste em janela anônima/sem cache, confirme que está na versão mais recente e verifique mensagens de erro/progresso. Para operações grandes, teste com um subconjunto dos arquivos. Se houver painel de diagnóstico, envie a última linha exibida.'},
]

export default function FaqPage(){
  const [query,setQuery]=useState('')
  const [cat,setCat]=useState('Todas')
  const categories=['Todas',...Array.from(new Set(faq.map(item=>item.cat)))]
  const filtered=useMemo(()=>faq.filter(item=>{
    const matchCat=cat==='Todas'||item.cat===cat
    const text=`${item.q} ${item.a} ${item.cat}`.toLocaleLowerCase('pt-BR')
    return matchCat && text.includes(query.trim().toLocaleLowerCase('pt-BR'))
  }),[query,cat])

  return <div className="info-page faq-page">
    <section className="info-hero">
      <div className="info-hero-icon"><HelpCircle size={28}/></div>
      <div><p className="kicker">CENTRAL DE AJUDA</p><h1>FAQ do PDF Studio</h1><p>Respostas rápidas sobre privacidade, compressão, OCR, ferramentas jurídicas, limites e boas práticas.</p></div>
    </section>
    <div className="info-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar: OCR, mesclar, PDF/A, Trust Report..."/></div>
    <div className="faq-chips">{categories.map(value=><button key={value} className={cat===value?'active':''} onClick={()=>setCat(value)}>{value}</button>)}</div>
    <div className="faq-meta"><ShieldCheck size={16}/><span>{filtered.length} resposta(s) • conteúdo focado no comportamento atual da v1.9.1</span></div>
    <section className="faq-list">
      {filtered.map((item,index)=><details key={`${item.cat}-${index}`} className="faq-item">
        <summary><span>{item.q}</span><small>{item.cat}</small></summary>
        <p>{item.a}</p>
      </details>)}
      {filtered.length===0&&<div className="empty-info-state">Nenhuma pergunta encontrada. Tente outro termo.</div>}
    </section>
  </div>
}
