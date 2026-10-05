import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageWorkspacePage from './PageWorkspacePage'
import OcrToolPage from './OcrToolPage'
import BatchToolPage from './BatchToolPage'
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Download, File, GripVertical, Info, LockKeyhole, UploadCloud, X } from 'lucide-react'
import { tools, type ToolId } from '../lib/tools'
import { compressPdf, compressPdfToTarget, extractPdfText, imagesToPdf, inspectPdf, mergePdfs, pdfToImagesZip, renderFirstPage, splitPdfBySize, type CompressionMode } from '../lib/pdf'
import { pdfToWord, wordToPdf } from '../lib/word'
import { downloadBlob, humanSize, stem } from '../lib/files'
import JSZip from 'jszip'

const pdfOnly = new Set<ToolId>(['compress','split','pdf-word','pdf-jpg','pdf-png','pdf-txt'])
const multiPdf = new Set<ToolId>(['merge'])

export default function ToolPage(){
  const { id } = useParams()
  if(id==='organize') return <PageWorkspacePage mode="organize"/>
  if(id==='edit-pages') return <PageWorkspacePage mode="edit-pages"/>
  if(id==='ocr') return <OcrToolPage/>
  if(id==='batch') return <BatchToolPage/>
  return <ClassicToolPage/>
}

function ClassicToolPage(){
  const { id } = useParams()
  const tool = tools.find(t=>t.id===id) || tools[0]
  const toolId = tool.id as ToolId
  const [files,setFiles] = useState<File[]>([])
  const [progress,setProgress] = useState(0)
  const [status,setStatus] = useState('Pronto.')
  const [working,setWorking] = useState(false)
  const [success,setSuccess] = useState('')
  const [errorMessage,setErrorMessage] = useState('')
  const [mode,setMode] = useState<CompressionMode>('smart')
  const [splitMb,setSplitMb] = useState(10)
  const [targetMb,setTargetMb] = useState(10)
  const [dpi,setDpi] = useState(150)
  const [analysis,setAnalysis] = useState<{pages:number,recommended:CompressionMode}|null>(null)
  const [dragIndex,setDragIndex] = useState<number|null>(null)
  const [dragOverIndex,setDragOverIndex] = useState<number|null>(null)
  const [showAllMergeFiles,setShowAllMergeFiles] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const inputRef = useRef<HTMLInputElement|null>(null)
  const Icon = tool.icon

  const accept = useMemo(()=> toolId==='word-pdf' ? '.docx' : toolId==='images-pdf' ? 'image/jpeg,image/png' : '.pdf',[toolId])
  const multiple = multiPdf.has(toolId) || toolId==='images-pdf'

  useEffect(()=>{ setFiles([]); setProgress(0); setStatus('Pronto.'); setSuccess(''); setErrorMessage(''); setAnalysis(null); setDragIndex(null); setDragOverIndex(null); setShowAllMergeFiles(false) },[toolId])
  useEffect(()=>{
    const file=files[0]
    if(file && file.type==='application/pdf' && canvasRef.current){
      renderFirstPage(file,canvasRef.current).catch(()=>{})
      inspectPdf(file).then(i=>setAnalysis({pages:i.pages,recommended:i.recommended})).catch(()=>{})
    }
  },[files])
  useEffect(()=>{
    const file=files[0]
    if(toolId==='compress' && file){
      const sizeMb=file.size/(1024*1024)
      if(targetMb>=sizeMb){
        setTargetMb(Math.max(0.5,Math.round(sizeMb*0.6*10)/10))
      }
    }
  },[files,toolId])

  function addFiles(list: FileList | null){
    if(!list) return
    const incoming=Array.from(list)
    if(multiple) setFiles(prev=>[...prev,...incoming])
    else setFiles(incoming.slice(0,1))
    setProgress(0); setSuccess(''); setErrorMessage(''); setShowAllMergeFiles(false)
  }

  function removeFile(index:number){ setFiles(f=>f.filter((_,i)=>i!==index)); setProgress(0); setSuccess(''); setErrorMessage('') }

  function moveFile(from:number,to:number){
    if(from===to || from<0 || to<0) return
    setFiles(prev=>{
      if(from>=prev.length || to>=prev.length) return prev
      const next=[...prev]
      const [moved]=next.splice(from,1)
      next.splice(to,0,moved)
      return next
    })
    setProgress(0); setSuccess(''); setErrorMessage('')
  }

  function onFileDragStart(index:number,e:DragEvent<HTMLDivElement>){
    if(toolId!=='merge' || working) return
    setDragIndex(index)
    setDragOverIndex(index)
    e.dataTransfer.effectAllowed='move'
    e.dataTransfer.setData('text/plain',String(index))
  }

  function onFileDragOver(index:number,e:DragEvent<HTMLDivElement>){
    if(toolId!=='merge' || dragIndex===null || working) return
    e.preventDefault()
    e.dataTransfer.dropEffect='move'
    setDragOverIndex(index)
  }

  function onFileDrop(index:number,e:DragEvent<HTMLDivElement>){
    if(toolId!=='merge' || working) return
    e.preventDefault()
    const raw=e.dataTransfer.getData('text/plain')
    const from=dragIndex ?? Number(raw)
    if(Number.isInteger(from)) moveFile(from,index)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function onFileDragEnd(){ setDragIndex(null); setDragOverIndex(null) }
  function update(v:number,m:string){ setProgress(Math.max(0,Math.min(100,v))); setStatus(m) }

  async function run(){
    if(files.length===0) return
    setWorking(true); setSuccess(''); setErrorMessage(''); setProgress(0)
    setStatus(toolId==='merge' ? `Preparando ${files.length.toLocaleString('pt-BR')} PDF(s)…` : 'Preparando processamento…')
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    try{
      if(toolId==='compress'){
        if(mode==='target'){
          const result=await compressPdfToTarget(files[0],targetMb,update)
          if(!result.bytes || result.bytes.byteLength<100){
            throw new Error('A compressão por tamanho gerou um resultado vazio ou inválido. O download foi bloqueado.')
          }
          const safeBytes=result.bytes.slice()
          const blob=new Blob([safeBytes],{type:'application/pdf'})
          if(blob.size<100) throw new Error('O PDF final ficou vazio. Nada foi baixado.')

          const reduction=Math.max(0,(1-blob.size/files[0].size)*100)
          const reduced=blob.size<files[0].size
          const targetLabel=`${targetMb.toFixed(1)} MB`
          const engineLabel=result.engine==='target-adaptive-raster'
            ? 'ajuste adaptativo por página'
            : result.engine==='qpdf-wasm'
              ? 'qpdf WebAssembly'
              : result.engine.includes('ghostscript')
                ? 'Ghostscript + qpdf WebAssembly'
                : result.engine
          const rasterNote=result.rasterized?' • páginas rasterizadas para alcançar a meta':''

          if(reduced){
            const targetToken=String(targetMb).replace('.','_')
            downloadBlob(blob,`${stem(files[0].name)}_ate_${targetToken}MB.pdf`)
          }

          if(result.targetReached){
            setStatus('Meta de tamanho atingida.')
            setSuccess(`Meta atingida. ${humanSize(files[0].size)} → ${humanSize(blob.size)} • alvo: até ${targetLabel} • ${reduction.toFixed(1)}% menor. Motor: ${engineLabel}${rasterNote}.`)
          }else if(reduced){
            setStatus('A meta exata não foi alcançada, mas este foi o menor resultado seguro produzido.')
            setSuccess(`Melhor resultado: ${humanSize(files[0].size)} → ${humanSize(blob.size)} • alvo: ${targetLabel} • ${reduction.toFixed(1)}% menor. Motor: ${engineLabel}${rasterNote}.`)
          }else{
            setStatus('Não foi possível reduzir o PDF para a meta escolhida sem gerar um resultado inválido.')
            setSuccess(`O original foi preservado: ${humanSize(files[0].size)}. Tente uma meta maior ou outro perfil.`)
          }
        }else{
          const result=await compressPdf(files[0],mode,update)
          if (!result.bytes || result.bytes.byteLength < 100) {
            throw new Error('A compressão gerou um resultado vazio ou inválido. O download foi bloqueado para proteger seu PDF.')
          }
          // Copiamos os bytes antes de criar o Blob para garantir que o buffer
          // usado pelo PDF.js/Web Worker não esteja detached.
          const safeBytes = result.bytes.slice()
          const blob=new Blob([safeBytes],{type:'application/pdf'})
          if (blob.size < 100) {
            throw new Error('O PDF final ficou vazio. Nada foi baixado. Tente novamente ou use o modo Básico.')
          }
          const reduction=Math.max(0,(1-blob.size/files[0].size)*100)
          const reduced = blob.size < files[0].size
          const reductionText = reduced
            ? `${reduction.toFixed(1)}% menor`
            : 'sem redução adicional'
          const engineLabel = result.engine === 'qpdf-wasm'
            ? 'qpdf WebAssembly'
            : result.engine === 'adaptive-raster'
              ? 'redução visual extrema'
              : result.engine === 'adaptive-raster-fallback'
                ? 'fallback adaptativo local'
                : result.engine === 'ghostscript-wasm + qpdf-wasm'
                  ? 'Ghostscript + qpdf WebAssembly'
                  : 'motor de compatibilidade'
          const rasterNote = result.rasterized ? ' • páginas rasterizadas para priorizar tamanho' : ''

          if (!reduced) {
            setStatus('O arquivo já estava muito otimizado e nenhum resultado menor foi produzido. O original foi preservado.')
            setSuccess(`Nenhum arquivo maior foi entregue. ${humanSize(files[0].size)} → ${humanSize(blob.size)} (${reductionText}). Motor: ${engineLabel}.`)
          } else {
            downloadBlob(blob,`${stem(files[0].name)}_compactado_${result.mode}.pdf`)
            setSuccess(`PDF processado com sucesso. ${humanSize(files[0].size)} → ${humanSize(blob.size)} (${reductionText}). Motor: ${engineLabel}${rasterNote}.`)
          }
        }
      } else if(toolId==='merge'){
        if(files.length<2) throw new Error('Selecione pelo menos 2 PDFs.')
        const result=await mergePdfs(files,update)
        if(!result.blob || result.blob.size<100) throw new Error('O PDF final ficou vazio e o download foi bloqueado.')
        downloadBlob(result.blob,'pdf-studio-mesclado.pdf')
        const engineLabel=result.engine==='pdf-lib'?'pdf-lib':result.engine==='qpdf-wasm-direct'?'qpdf WebAssembly massivo':'qpdf WebAssembly por blocos'
        const skipped=result.skippedFiles.length
        setSuccess(`${result.mergedFiles.toLocaleString('pt-BR')} PDFs mesclados com sucesso${skipped?` • ${skipped} arquivo(s) ignorado(s) por erro`:''}. Motor: ${engineLabel}.`)
        if(skipped){
          setStatus(`Concluído com avisos. Ignorados: ${result.skippedFiles.slice(0,8).join(', ')}${skipped>8?` e mais ${skipped-8}`:''}.`)
        }
      } else if(toolId==='split'){
        const parts=await splitPdfBySize(files[0],splitMb,update)
        const zip=new JSZip()
        parts.forEach((p,i)=>zip.file(`${stem(files[0].name)}_parte_${String(i+1).padStart(3,'0')}.pdf`,p))
        update(98,'Empacotando partes…')
        const blob=await zip.generateAsync({type:'blob'})
        downloadBlob(blob,`${stem(files[0].name)}_partes.zip`)
        update(100,'Concluído.')
        setSuccess(`PDF dividido com sucesso em ${parts.length} parte(s).`)
      } else if(toolId==='pdf-jpg' || toolId==='pdf-png'){
        const format=toolId==='pdf-jpg'?'jpeg':'png'
        const blob=await pdfToImagesZip(files[0],format,dpi,update)
        downloadBlob(blob,`${stem(files[0].name)}_${format}.zip`)
        setSuccess(`Páginas convertidas para ${format.toUpperCase()} com sucesso.`)
      } else if(toolId==='images-pdf'){
        const bytes=await imagesToPdf(files,update)
        downloadBlob(new Blob([bytes],{type:'application/pdf'}),'imagens_convertidas.pdf')
        setSuccess(`${files.length} imagem(ns) convertidas para PDF.`)
      } else if(toolId==='pdf-txt'){
        const pages=await extractPdfText(files[0],update)
        downloadBlob(new Blob([pages.join('\n\n--- PÁGINA ---\n\n')],{type:'text/plain;charset=utf-8'}),`${stem(files[0].name)}.txt`)
        setSuccess('Texto extraído com sucesso.')
      } else if(toolId==='pdf-word'){
        const blob=await pdfToWord(files[0],update)
        downloadBlob(blob,`${stem(files[0].name)}.docx`)
        setSuccess('DOCX criado. Conversão Beta: prioriza texto e pode simplificar layouts complexos.')
      } else if(toolId==='word-pdf'){
        const blob=await wordToPdf(files[0],update)
        downloadBlob(blob,`${stem(files[0].name)}.pdf`)
        setSuccess('PDF criado. Conversão Beta: documentos Word complexos podem ter diferenças visuais.')
      }
    }catch(err){
      const message=err instanceof Error?err.message:'Erro inesperado.'
      setStatus(message); setErrorMessage(message); setProgress(0)
    }finally{setWorking(false)}
  }

  const originalMb=files[0]?files[0].size/(1024*1024):0
  const estimatedMinTargetMb=analysis?Math.max(0.5,(analysis.pages*7000+120000)/(1024*1024)):0.5
  const targetReduction=originalMb>0?Math.max(0,(1-targetMb/originalMb)*100):0
  const targetPresets=[5,10,20,25,50].filter(value=>value<originalMb-0.05 && value>=estimatedMinTargetMb)
  const mergeTotalBytes=toolId==='merge'?files.reduce((sum,file)=>sum+file.size,0):0
  const mergeListIsCollapsed=toolId==='merge' && files.length>300 && !showAllMergeFiles
  const visibleFiles=mergeListIsCollapsed?files.slice(0,200):files

  return <section className="tool-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{background:tool.color}}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current?.click()}>
          <UploadCloud size={45}/><strong>{multiple?'Arraste seus arquivos aqui':'Arraste seu arquivo aqui'}</strong><span>ou clique para selecionar</span><button className="primary-btn small" type="button">Selecionar arquivo</button>
          <input ref={inputRef} hidden type="file" accept={accept} multiple={multiple} onChange={e=>addFiles(e.target.files)}/>
        </div>
        {files.length>0 && <>
          {toolId==='merge' && <div className="merge-order-hint"><GripVertical size={17}/><div><strong>Defina a ordem dos PDFs</strong><span>Arraste os arquivos. O item 1 será o primeiro no PDF final.</span></div></div>}
          <div className={`file-list ${toolId==='merge'?'sortable-file-list':''}`}>
            {visibleFiles.map((f,i)=>
              <div
                className={`file-row ${toolId==='merge'?'sortable-file-row':''} ${dragIndex===i?'dragging':''} ${dragOverIndex===i && dragIndex!==i?'drag-over':''}`}
                key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                draggable={toolId==='merge' && !working}
                onDragStart={e=>onFileDragStart(i,e)}
                onDragOver={e=>onFileDragOver(i,e)}
                onDrop={e=>onFileDrop(i,e)}
                onDragEnd={onFileDragEnd}
              >
                {toolId==='merge' ? <div className="order-cell"><GripVertical size={18}/><span className="order-number">{i+1}</span></div> : <File size={18}/>}
                <div className="file-row-info"><strong>{f.name}</strong><span>{humanSize(f.size)}{toolId==='merge'?` • posição ${i+1}`:''}</span></div>
                {toolId==='merge' && <div className="reorder-actions" aria-label={`Reordenar ${f.name}`}>
                  <button type="button" onClick={()=>moveFile(i,i-1)} disabled={i===0||working} title="Mover para cima"><ArrowUp size={16}/></button>
                  <button type="button" onClick={()=>moveFile(i,i+1)} disabled={i===files.length-1||working} title="Mover para baixo"><ArrowDown size={16}/></button>
                </div>}
                <button className="remove-file-btn" type="button" onClick={()=>removeFile(i)} disabled={working} title="Remover"><X size={17}/></button>
              </div>
            )}
          </div>
          {toolId==='merge' && files.length>300 && <div className="large-list-toolbar">
            <span>{mergeListIsCollapsed?`Exibindo os primeiros 200 de ${files.length.toLocaleString('pt-BR')} PDFs para manter a interface rápida.`:`Exibindo todos os ${files.length.toLocaleString('pt-BR')} PDFs.`}</span>
            <button type="button" onClick={()=>setShowAllMergeFiles(v=>!v)} disabled={working}>{mergeListIsCollapsed?'Mostrar todos':'Mostrar apenas 200'}</button>
          </div>}
        </>}
      </div>

      <aside className="workspace-card options-card">
        <h3>Configurações</h3>
        {toolId==='compress' && <>
          <label className="field-label">Nível de compressão</label>
          <div className="mode-grid">{(['smart','basic','medium','high','maximum','target'] as CompressionMode[]).map(m=><button key={m} className={`mode-btn ${mode===m?'active':''}`} onClick={()=>setMode(m)}>{m==='smart'?'Inteligente':m==='basic'?'Básico':m==='medium'?'Médio':m==='high'?'Alto':m==='maximum'?'Máximo':'Por tamanho'}</button>)}</div>
          {mode==='target' && <div className="target-size-card">
            <div className="target-size-head"><div><strong>Comprimir para um tamanho</strong><span>O app tenta chegar até a meta preservando qualidade primeiro.</span></div><span className="target-badge">ALVO</span></div>
            <label className="field-label">Quero o PDF com até</label>
            <div className="number-field target-number"><input type="number" min={Number(estimatedMinTargetMb.toFixed(1))} max={Math.max(0.5,Number((originalMb-0.1).toFixed(1)))} step="0.5" value={targetMb} onChange={e=>setTargetMb(Number(e.target.value))}/><span>MB</span></div>
            {targetPresets.length>0 && <div className="target-presets">{targetPresets.map(value=><button type="button" key={value} className={Math.abs(targetMb-value)<0.01?'active':''} onClick={()=>setTargetMb(value)}>{value} MB</button>)}</div>}
            {originalMb>0 && <div className="target-estimate"><span>Original <strong>{originalMb.toFixed(1)} MB</strong></span><span>Meta <strong>{targetMb.toFixed(1)} MB</strong></span><span>Redução necessária <strong>{targetReduction.toFixed(0)}%</strong></span></div>}
            {analysis && <p className="target-hint">Para {analysis.pages} páginas, o mínimo recomendado é ~{estimatedMinTargetMb.toFixed(1)} MB. Metas muito agressivas podem rasterizar páginas e afetar texto selecionável.</p>}
          </div>}
          {analysis && <div className="analysis-box"><Info size={17}/><span>{analysis.pages} página(s). Recomendado: <strong>{analysis.recommended}</strong>.</span></div>}
          <p className="warning-text">Médio e Alto usam Ghostscript WebAssembly para recomprimir imagens preservando texto/vetores. Máximo e Por tamanho só rasterizam como último recurso quando necessário para reduzir mais.</p>
        </>}
        {toolId==='split' && <><label className="field-label">Tamanho máximo por parte</label><div className="number-field"><input type="number" min="0.5" max="500" step="0.5" value={splitMb} onChange={e=>setSplitMb(Number(e.target.value))}/><span>MB</span></div></>}
        {(toolId==='pdf-jpg'||toolId==='pdf-png') && <><label className="field-label">Resolução</label><select value={dpi} onChange={e=>setDpi(Number(e.target.value))}><option value="96">96 DPI</option><option value="150">150 DPI</option><option value="200">200 DPI</option><option value="300">300 DPI</option></select></>}
        {(toolId==='pdf-word'||toolId==='word-pdf') && <div className="beta-note"><strong>Conversão Beta</strong><span>Funciona 100% no navegador. Layouts complexos podem sofrer alterações.</span></div>}
        {toolId==='merge' && <div className="merge-summary"><strong>Ordem final</strong><span>{files.length<2?'Adicione pelo menos 2 PDFs.':`${files.length.toLocaleString('pt-BR')} PDFs serão unidos de cima para baixo • ${humanSize(mergeTotalBytes)} no total.`}</span>{files.length>=100 && <span className="massive-merge-note">Modo de mesclagem massiva será ativado automaticamente.</span>}</div>}
        <button className="primary-btn wide run-btn" onClick={run} disabled={working||files.length===0}>{working?'Processando…':'Executar agora'}</button>
      </aside>
    </div>

    {(progress>0||working||success||errorMessage) && <div className="progress-card">
      <div className="progress-top"><div><strong>{errorMessage?'Falha no processamento':success?'Processamento concluído':'Processando'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{width:`${progress}%`}}/></div>
      {success && <div className="success-box"><CheckCircle2 size={22}/><span>{success}</span><Download size={19}/></div>}
      {errorMessage && <div className="error-box"><Info size={22}/><span><strong>Não foi possível concluir.</strong> {errorMessage}</span></div>}
    </div>}

    {files[0]?.type==='application/pdf' && <div className="preview-card"><div><h3>Pré-visualização</h3><p>Primeira página renderizada localmente.</p></div><div className="canvas-wrap"><canvas ref={canvasRef}/></div></div>}
  </section>
}
