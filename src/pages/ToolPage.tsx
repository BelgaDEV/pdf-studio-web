import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, File, Info, LockKeyhole, UploadCloud, X } from 'lucide-react'
import { tools, type ToolId } from '../lib/tools'
import { compressPdf, extractPdfText, imagesToPdf, inspectPdf, mergePdfs, pdfToImagesZip, renderFirstPage, splitPdfBySize, type CompressionMode } from '../lib/pdf'
import { pdfToWord, wordToPdf } from '../lib/word'
import { downloadBlob, humanSize, stem } from '../lib/files'
import JSZip from 'jszip'

const pdfOnly = new Set<ToolId>(['compress','split','pdf-word','pdf-jpg','pdf-png','pdf-txt'])
const multiPdf = new Set<ToolId>(['merge'])

export default function ToolPage(){
  const { id } = useParams()
  const tool = tools.find(t=>t.id===id) || tools[0]
  const toolId = tool.id as ToolId
  const [files,setFiles] = useState<File[]>([])
  const [progress,setProgress] = useState(0)
  const [status,setStatus] = useState('Pronto.')
  const [working,setWorking] = useState(false)
  const [success,setSuccess] = useState('')
  const [mode,setMode] = useState<CompressionMode>('smart')
  const [splitMb,setSplitMb] = useState(10)
  const [dpi,setDpi] = useState(150)
  const [analysis,setAnalysis] = useState<{pages:number,recommended:CompressionMode}|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const inputRef = useRef<HTMLInputElement|null>(null)
  const Icon = tool.icon

  const accept = useMemo(()=> toolId==='word-pdf' ? '.docx' : toolId==='images-pdf' ? 'image/jpeg,image/png' : '.pdf',[toolId])
  const multiple = multiPdf.has(toolId) || toolId==='images-pdf'

  useEffect(()=>{ setFiles([]); setProgress(0); setStatus('Pronto.'); setSuccess(''); setAnalysis(null) },[toolId])
  useEffect(()=>{
    const file=files[0]
    if(file && file.type==='application/pdf' && canvasRef.current){
      renderFirstPage(file,canvasRef.current).catch(()=>{})
      inspectPdf(file).then(i=>setAnalysis({pages:i.pages,recommended:i.recommended})).catch(()=>{})
    }
  },[files])

  function addFiles(list: FileList | null){
    if(!list) return
    const incoming=Array.from(list)
    if(multiple) setFiles(prev=>[...prev,...incoming])
    else setFiles(incoming.slice(0,1))
    setProgress(0); setSuccess('')
  }

  function removeFile(index:number){ setFiles(f=>f.filter((_,i)=>i!==index)) }
  function update(v:number,m:string){ setProgress(Math.max(0,Math.min(100,v))); setStatus(m) }

  async function run(){
    if(files.length===0) return
    setWorking(true); setSuccess(''); setProgress(0)
    try{
      if(toolId==='compress'){
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
      } else if(toolId==='merge'){
        if(files.length<2) throw new Error('Selecione pelo menos 2 PDFs.')
        const bytes=await mergePdfs(files,update)
        downloadBlob(new Blob([bytes],{type:'application/pdf'}),'pdf-studio-mesclado.pdf')
        setSuccess(`${files.length} PDFs mesclados com sucesso.`)
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
      setStatus(message); setProgress(0)
    }finally{setWorking(false)}
  }

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
        {files.length>0 && <div className="file-list">{files.map((f,i)=><div className="file-row" key={`${f.name}-${i}`}><File size={18}/><div><strong>{f.name}</strong><span>{humanSize(f.size)}</span></div><button onClick={()=>removeFile(i)} title="Remover"><X size={17}/></button></div>)}</div>}
      </div>

      <aside className="workspace-card options-card">
        <h3>Configurações</h3>
        {toolId==='compress' && <>
          <label className="field-label">Nível de compressão</label>
          <div className="mode-grid">{(['smart','basic','medium','high','maximum'] as CompressionMode[]).map(m=><button key={m} className={`mode-btn ${mode===m?'active':''}`} onClick={()=>setMode(m)}>{m==='smart'?'Inteligente':m==='basic'?'Básico':m==='medium'?'Médio':m==='high'?'Alto':'Máximo'}</button>)}</div>
          {analysis && <div className="analysis-box"><Info size={17}/><span>{analysis.pages} página(s). Recomendado: <strong>{analysis.recommended}</strong>.</span></div>}
          <p className="warning-text">Médio e Alto usam Ghostscript WebAssembly para recomprimir imagens preservando texto/vetores. Máximo usa o mesmo motor e só rasteriza como último recurso quando o PDF já está muito otimizado.</p>
        </>}
        {toolId==='split' && <><label className="field-label">Tamanho máximo por parte</label><div className="number-field"><input type="number" min="0.5" max="500" step="0.5" value={splitMb} onChange={e=>setSplitMb(Number(e.target.value))}/><span>MB</span></div></>}
        {(toolId==='pdf-jpg'||toolId==='pdf-png') && <><label className="field-label">Resolução</label><select value={dpi} onChange={e=>setDpi(Number(e.target.value))}><option value="96">96 DPI</option><option value="150">150 DPI</option><option value="200">200 DPI</option><option value="300">300 DPI</option></select></>}
        {(toolId==='pdf-word'||toolId==='word-pdf') && <div className="beta-note"><strong>Conversão Beta</strong><span>Funciona 100% no navegador. Layouts complexos podem sofrer alterações.</span></div>}
        <button className="primary-btn wide run-btn" onClick={run} disabled={working||files.length===0}>{working?'Processando…':'Executar agora'}</button>
      </aside>
    </div>

    {(progress>0||working||success) && <div className="progress-card">
      <div className="progress-top"><div><strong>{success?'Processamento concluído':'Processando'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{width:`${progress}%`}}/></div>
      {success && <div className="success-box"><CheckCircle2 size={22}/><span>{success}</span><Download size={19}/></div>}
    </div>}

    {files[0]?.type==='application/pdf' && <div className="preview-card"><div><h3>Pré-visualização</h3><p>Primeira página renderizada localmente.</p></div><div className="canvas-wrap"><canvas ref={canvasRef}/></div></div>}
  </section>
}
