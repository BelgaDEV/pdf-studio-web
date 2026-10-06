import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, CheckCircle2, Download, File, Info, LockKeyhole, Search, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buildComparisonRedlinePdf, buildComparisonReportPdf, comparePdfFiles, renderPdfPageToCanvas, type CompareStatus, type PdfComparisonResult } from '../lib/pdfCompare'
import { downloadBlob, humanSize, stem } from '../lib/files'

type Slot='original'|'revised'
type Filter='all'|Exclude<CompareStatus,'unchanged'>

const labels:Record<CompareStatus,string>={unchanged:'Sem alteração',modified:'Modificada',added:'Adicionada',removed:'Removida'}

export default function ComparePdfPage(){
  const [original,setOriginal]=useState<File|null>(null)
  const [revised,setRevised]=useState<File|null>(null)
  const [visual,setVisual]=useState(true)
  const [working,setWorking]=useState(false)
  const [progress,setProgress]=useState(0)
  const [status,setStatus]=useState('Selecione os dois PDFs.')
  const [error,setError]=useState('')
  const [result,setResult]=useState<PdfComparisonResult|null>(null)
  const [selectedId,setSelectedId]=useState<string>('')
  const [filter,setFilter]=useState<Filter>('all')
  const [query,setQuery]=useState('')
  const [redlineWorking,setRedlineWorking]=useState(false)
  const [redlineStatus,setRedlineStatus]=useState('')
  const originalInput=useRef<HTMLInputElement|null>(null)
  const revisedInput=useRef<HTMLInputElement|null>(null)
  const originalCanvas=useRef<HTMLCanvasElement|null>(null)
  const revisedCanvas=useRef<HTMLCanvasElement|null>(null)

  const selected=result?.pages.find(item=>item.id===selectedId) || result?.pages[0] || null

  function assign(slot:Slot,file:File|null){
    if(file && !file.name.toLowerCase().endsWith('.pdf')){setError('Selecione um arquivo PDF.');return}
    if(slot==='original') setOriginal(file)
    else setRevised(file)
    setResult(null);setSelectedId('');setProgress(0);setError('');setStatus('Pronto para comparar.')
  }

  function onDrop(slot:Slot,e:DragEvent<HTMLDivElement>){
    e.preventDefault()
    assign(slot,e.dataTransfer.files?.[0]||null)
  }

  async function run(){
    if(!original||!revised) return
    setWorking(true);setResult(null);setError('');setProgress(0);setStatus('Preparando comparação…')
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    try{
      const compared=await comparePdfFiles(original,revised,{visual},(value,message)=>{setProgress(value);setStatus(message)})
      setResult(compared)
      const first=compared.pages.find(item=>item.status!=='unchanged') || compared.pages[0]
      setSelectedId(first?.id||'')
      setStatus(compared.summary.totalDifferences===0?'Nenhuma diferença encontrada.':`${compared.summary.totalDifferences} diferença(s) encontrada(s).`)
    }catch(err){
      const message=err instanceof Error?err.message:'Não foi possível comparar os PDFs.'
      setError(message);setStatus(message);setProgress(0)
    }finally{setWorking(false)}
  }

  useEffect(()=>{
    let cancelled=false
    async function render(){
      if(!selected||!original||!revised) return
      try{
        if(originalCanvas.current){
          const ctx=originalCanvas.current.getContext('2d')
          ctx?.clearRect(0,0,originalCanvas.current.width,originalCanvas.current.height)
          if(selected.originalPage) await renderPdfPageToCanvas(original,selected.originalPage,originalCanvas.current,650)
        }
        if(revisedCanvas.current){
          const ctx=revisedCanvas.current.getContext('2d')
          ctx?.clearRect(0,0,revisedCanvas.current.width,revisedCanvas.current.height)
          if(selected.revisedPage) await renderPdfPageToCanvas(revised,selected.revisedPage,revisedCanvas.current,650)
        }
      }catch(err){if(!cancelled) console.warn('Falha ao renderizar comparação.',err)}
    }
    render()
    return()=>{cancelled=true}
  },[selectedId,result,original,revised])

  const visible=useMemo(()=>{
    if(!result) return []
    const q=query.trim().toLocaleLowerCase('pt-BR')
    return result.pages.filter(item=>{
      if(filter!=='all'&&item.status!==filter) return false
      if(!q) return true
      const hay=`${labels[item.status]} ${item.originalPage||''} ${item.revisedPage||''} ${item.textChange.addedSnippet} ${item.textChange.removedSnippet}`.toLocaleLowerCase('pt-BR')
      return hay.includes(q)
    })
  },[result,filter,query])

  async function downloadReport(){
    if(!result) return
    const bytes=await buildComparisonReportPdf(result)
    const baseOriginal=stem(result.original.fileName),baseRevised=stem(result.revised.fileName)
    downloadBlob(new Blob([bytes.slice()],{type:'application/pdf'}),`comparacao_${baseOriginal}_vs_${baseRevised}.pdf`)
  }

  async function downloadRedline(){
    if(!result||!original||!revised||redlineWorking) return
    setRedlineWorking(true);setError('');setRedlineStatus('Preparando PDF marcado…')
    try{
      const bytes=await buildComparisonRedlinePdf(original,revised,result,(value,message)=>{setRedlineStatus(`${message} ${value}%`)})
      const baseOriginal=stem(result.original.fileName),baseRevised=stem(result.revised.fileName)
      downloadBlob(new Blob([bytes.slice()],{type:'application/pdf'}),`redline_${baseOriginal}_vs_${baseRevised}.pdf`)
      setRedlineStatus('PDF marcado gerado com sucesso.')
    }catch(err){
      const message=err instanceof Error?err.message:'Não foi possível gerar o PDF marcado.'
      setError(message);setRedlineStatus(message)
    }finally{setRedlineWorking(false)}
  }

  function FileSlot({slot,file,title,subtitle}:{slot:Slot,file:File|null,title:string,subtitle:string}){
    const input=slot==='original'?originalInput:revisedInput
    return <div className={`compare-file-slot ${file?'has-file':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(slot,e)} onClick={()=>!working&&input.current?.click()}>
      {file?<>
        <div className="compare-file-icon"><File size={24}/></div>
        <div className="compare-file-info"><span className="compare-slot-label">{title}</span><strong>{file.name}</strong><small>{humanSize(file.size)}</small></div>
        <button className="remove-file-btn" type="button" onClick={e=>{e.stopPropagation();assign(slot,null)}} disabled={working} title="Remover"><X size={17}/></button>
      </>:<>
        <UploadCloud size={36}/><strong>{title}</strong><span>{subtitle}</span><button type="button" className="secondary-btn small">Selecionar PDF</button>
      </>}
      <input ref={input} hidden type="file" accept=".pdf,application/pdf" onChange={e=>assign(slot,e.target.files?.[0]||null)}/>
    </div>
  }

  return <section className="tool-page compare-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{background:'#5d7cff'}}><Search size={28}/></div><div><h1>Comparar PDFs</h1><p>Compare duas versões lado a lado, encontre alterações e gere um PDF Redline marcado.</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    <div className="compare-upload-grid">
      <FileSlot slot="original" file={original} title="PDF original" subtitle="Versão anterior ou documento base"/>
      <div className="compare-vs">VS</div>
      <FileSlot slot="revised" file={revised} title="PDF revisado" subtitle="Nova versão para comparação"/>
    </div>

    <div className="compare-options-card workspace-card">
      <div><strong>Modo de análise</strong><span>O texto e a estrutura de páginas são sempre comparados.</span></div>
      <label className="toggle-row">
        <input type="checkbox" checked={visual} onChange={e=>setVisual(e.target.checked)} disabled={working}/>
        <span><strong>Comparação visual completa</strong><small>Renderiza páginas em baixa resolução para encontrar alterações em imagens, assinaturas, posicionamento e conteúdo gráfico. É mais lenta.</small></span>
      </label>
      <button className="primary-btn compare-run-btn" type="button" onClick={run} disabled={working||!original||!revised}>{working?'Comparando…':'Comparar documentos'}</button>
    </div>

    {(working||progress>0||error||result) && <div className="progress-card">
      <div className="progress-top"><div><strong>{error?'Falha na comparação':result?'Comparação concluída':'Analisando PDFs'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{width:`${progress}%`}}/></div>
      {error&&<div className="error-box"><Info size={22}/><span><strong>Não foi possível concluir.</strong> {error}</span></div>}
      {result&&<div className="success-box"><CheckCircle2 size={22}/><span>{result.summary.totalDifferences===0?'Os documentos são equivalentes nos critérios analisados.':`${result.summary.totalDifferences} diferença(s) encontrada(s).`}</span></div>}
    </div>}

    {result&&<>
      <div className="compare-summary-grid">
        <div><span>Páginas original</span><strong>{result.original.pageCount}</strong></div>
        <div><span>Páginas revisado</span><strong>{result.revised.pageCount}</strong></div>
        <div className="summary-modified"><span>Modificadas</span><strong>{result.summary.modified}</strong></div>
        <div className="summary-added"><span>Adicionadas</span><strong>{result.summary.added}</strong></div>
        <div className="summary-removed"><span>Removidas</span><strong>{result.summary.removed}</strong></div>
        <div><span>Sem alteração</span><strong>{result.summary.unchanged}</strong></div>
      </div>

      <div className="compare-redline-card workspace-card">
        <div>
          <strong>PDF Redline</strong>
          <span>Gere uma nova cópia marcada: <b className="redline-blue-text">azul</b> para conteúdo adicionado, <b className="redline-red-text">vermelho tachado</b> para conteúdo removido e <b className="redline-amber-text">laranja</b> para alteração apenas visual.</span>
        </div>
        <button className="primary-btn redline-download-btn" type="button" onClick={downloadRedline} disabled={redlineWorking}>
          <Download size={17}/>{redlineWorking?' Gerando PDF marcado…':' Baixar PDF marcado'}
        </button>
        {redlineStatus&&<small className="redline-status">{redlineStatus}</small>}
      </div>

      <div className="compare-results-toolbar">
        <div className="compare-filters">
          {([['all','Todas'],['modified','Modificadas'],['added','Adicionadas'],['removed','Removidas']] as [Filter,string][]).map(([value,label])=><button key={value} type="button" className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}
        </div>
        <div className="compare-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nas diferenças…"/></div>
        <button className="secondary-btn" type="button" onClick={downloadReport}><Download size={17}/> Relatório PDF</button>
        <button className="secondary-btn redline-toolbar-btn" type="button" onClick={downloadRedline} disabled={redlineWorking}><Download size={17}/> {redlineWorking?'Gerando…':'PDF marcado'}</button>
      </div>

      <div className="compare-main-grid">
        <aside className="compare-diff-list workspace-card">
          <div className="compare-list-head"><strong>Mapa de alterações</strong><span>{visible.length} item(ns)</span></div>
          {visible.length===0?<div className="compare-empty">Nenhum item neste filtro.</div>:visible.map(item=><button type="button" key={item.id} onClick={()=>setSelectedId(item.id)} className={`compare-diff-row ${selected?.id===item.id?'active':''}`}>
            <div className={`compare-status-dot ${item.status}`}/>
            <div><strong>{labels[item.status]}</strong><span>{item.status==='added'?`Revisado p. ${item.revisedPage}`:item.status==='removed'?`Original p. ${item.originalPage}`:`Original p. ${item.originalPage} → Revisado p. ${item.revisedPage}`}</span>{item.visualDifference!==null&&<small>Diferença visual: {item.visualDifference.toFixed(1)}%</small>}</div>
          </button>)}
        </aside>

        <div className="compare-detail">
          {selected&&<>
            <div className="compare-detail-head">
              <div><span className={`status-badge ${selected.status}`}>{labels[selected.status]}</span><h2>{selected.status==='added'?`Página ${selected.revisedPage} adicionada`:selected.status==='removed'?`Página ${selected.originalPage} removida`:`Página ${selected.originalPage} × ${selected.revisedPage}`}</h2></div>
              <div className="compare-metrics"><span>Texto <strong>{selected.textChanged?'alterado':'igual'}</strong></span>{selected.visualDifference!==null&&<span>Visual <strong>{selected.visualDifference.toFixed(2)}%</strong></span>}</div>
            </div>
            <div className="compare-preview-grid">
              <div className={`compare-preview-panel ${!selected.originalPage?'missing':''}`}><div className="compare-preview-head"><strong>Original</strong><span>{selected.originalPage?`Página ${selected.originalPage}`:'Sem página correspondente'}</span></div>{selected.originalPage?<div className="compare-canvas-wrap"><canvas ref={originalCanvas}/></div>:<div className="compare-missing-page">Página inexistente no original</div>}</div>
              <div className={`compare-preview-panel ${!selected.revisedPage?'missing':''}`}><div className="compare-preview-head"><strong>Revisado</strong><span>{selected.revisedPage?`Página ${selected.revisedPage}`:'Sem página correspondente'}</span></div>{selected.revisedPage?<div className="compare-canvas-wrap"><canvas ref={revisedCanvas}/></div>:<div className="compare-missing-page">Página inexistente no revisado</div>}</div>
            </div>
            <div className="compare-text-report workspace-card">
              <div className="compare-text-title"><strong>Relatório desta página</strong><span>{selected.originalWords} → {selected.revisedWords} palavras</span></div>
              {selected.textChange.removedWords>0&&<div className="text-change removed"><strong>− {selected.textChange.removedWords} palavra(s) removida(s)</strong><p>{selected.textChange.removedSnippet||'Conteúdo removido detectado.'}</p></div>}
              {selected.textChange.addedWords>0&&<div className="text-change added"><strong>+ {selected.textChange.addedWords} palavra(s) adicionada(s)</strong><p>{selected.textChange.addedSnippet||'Conteúdo adicionado detectado.'}</p></div>}
              {!selected.textChange.addedWords&&!selected.textChange.removedWords&&selected.status==='modified'&&<div className="analysis-box"><Info size={17}/><span>A alteração é predominantemente visual ou estrutural; não foi detectada mudança relevante na camada de texto.</span></div>}
              {selected.status==='unchanged'&&<div className="analysis-box"><CheckCircle2 size={17}/><span>Nenhuma diferença relevante foi encontrada nesta página.</span></div>}
            </div>
          </>}
        </div>
      </div>
    </>}
  </section>
}
