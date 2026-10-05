import { useState, useRef } from 'react'
import { ArrowLeft, CheckCircle2, Copy, File as FileIcon, FileJson2, Fingerprint, Info, LockKeyhole, SearchCheck, ShieldAlert, ShieldCheck, UploadCloud, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tools } from '../lib/tools'
import { humanSize } from '../lib/files'
import { inspectTrustFile, parseTrustReport, verifyTrustReport, type DocumentTrustReport, type TrustFileSnapshot, type TrustVerificationResult } from '../lib/trustReport'

function hashLabel(value: string) { return `${value.slice(0, 16)}…${value.slice(-16)}` }

export default function TrustReportPage(){
  const tool = tools.find(item=>item.id==='trust-report') || tools[0]
  const Icon = tool.icon
  const pdfInput = useRef<HTMLInputElement|null>(null)
  const reportInput = useRef<HTMLInputElement|null>(null)
  const [pdf,setPdf] = useState<File|null>(null)
  const [reportFile,setReportFile] = useState<File|null>(null)
  const [report,setReport] = useState<DocumentTrustReport|null>(null)
  const [snapshot,setSnapshot] = useState<TrustFileSnapshot|null>(null)
  const [verification,setVerification] = useState<TrustVerificationResult|null>(null)
  const [working,setWorking] = useState(false)
  const [error,setError] = useState('')

  async function choosePdf(file:File|null){
    setPdf(file);setSnapshot(null);setVerification(null);setError('')
  }
  async function chooseReport(file:File|null){
    setReportFile(file);setReport(null);setVerification(null);setError('')
    if(!file) return
    try{ setReport(parseTrustReport(await file.text())) }catch(e){ setError(e instanceof Error?e.message:'Trust Report inválido.') }
  }
  async function inspect(){
    if(!pdf) return
    setWorking(true);setError('');setVerification(null)
    try{ setSnapshot(await inspectTrustFile(pdf)) }catch(e){ setError(e instanceof Error?e.message:'Não foi possível analisar o PDF.') }finally{setWorking(false)}
  }
  async function verify(){
    if(!pdf||!report) return
    setWorking(true);setError('')
    try{ const result=await verifyTrustReport(pdf,report);setVerification(result);setSnapshot(result.snapshot) }catch(e){ setError(e instanceof Error?e.message:'Não foi possível verificar o relatório.') }finally{setWorking(false)}
  }
  async function copyHash(){ if(snapshot) await navigator.clipboard?.writeText(snapshot.sha256) }

  return <section className="tool-page trust-report-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{background:tool.color}}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Hashes calculados localmente</div>
    </div>

    <div className="trust-intro-card"><ShieldCheck size={23}/><div><strong>Verifique a integridade sem enviar o documento.</strong><span>O PDF Studio recalcula SHA-256, tamanho e páginas e compara com o Trust Report JSON gerado no processamento.</span></div></div>

    <div className="trust-verify-grid">
      <div className="workspace-card trust-upload-card">
        <div className="trust-card-kicker">1 • DOCUMENTO</div><h3>PDF a verificar</h3><p>Selecione o arquivo final ou qualquer PDF para gerar sua impressão técnica.</p>
        <button className="trust-drop-mini" type="button" onClick={()=>pdfInput.current?.click()}><UploadCloud size={28}/>{pdf?<><strong>{pdf.name}</strong><span>{humanSize(pdf.size)}</span></>:<><strong>Selecionar PDF</strong><span>O arquivo permanece no navegador</span></>}</button>
        <input ref={pdfInput} hidden type="file" accept=".pdf,application/pdf" onChange={e=>choosePdf(e.target.files?.[0]||null)}/>
      </div>
      <div className="workspace-card trust-upload-card">
        <div className="trust-card-kicker">2 • RELATÓRIO</div><h3>Trust Report JSON</h3><p>Opcional para inspeção; obrigatório para confirmar se o PDF corresponde a um relatório existente.</p>
        <button className="trust-drop-mini" type="button" onClick={()=>reportInput.current?.click()}><FileJson2 size={28}/>{reportFile?<><strong>{reportFile.name}</strong><span>{report?.reportId||'Lendo relatório…'}</span></>:<><strong>Selecionar JSON</strong><span>pdf-studio-trust/v1</span></>}</button>
        <input ref={reportInput} hidden type="file" accept=".json,application/json" onChange={e=>chooseReport(e.target.files?.[0]||null)}/>
      </div>
    </div>

    <div className="trust-actions">
      <button className="secondary-btn" type="button" disabled={!pdf||working} onClick={inspect}><Fingerprint size={17}/> {working?'Analisando…':'Gerar fingerprint'}</button>
      <button className="primary-btn" type="button" disabled={!pdf||!report||working} onClick={verify}><SearchCheck size={18}/> {working?'Verificando…':'Verificar Trust Report'}</button>
    </div>

    {error&&<div className="error-box trust-error"><Info size={20}/><span>{error}</span></div>}

    {snapshot&&<div className="workspace-card trust-fingerprint-card">
      <div className="trust-section-head"><div><span className="trust-card-kicker">DOCUMENT FINGERPRINT</span><h2>{snapshot.name}</h2></div><button className="icon-action-btn" type="button" onClick={copyHash} title="Copiar SHA-256"><Copy size={16}/></button></div>
      <div className="trust-fingerprint-grid"><div><span>Tamanho</span><strong>{humanSize(snapshot.sizeBytes)}</strong><small>{snapshot.sizeBytes.toLocaleString('pt-BR')} bytes</small></div><div><span>Páginas</span><strong>{snapshot.pages}</strong><small>PDF aberto com sucesso</small></div><div className="hash-cell"><span>SHA-256</span><strong>{hashLabel(snapshot.sha256)}</strong><small>{snapshot.sha256}</small></div></div>
    </div>}

    {verification&&report&&<div className={`workspace-card trust-verification ${verification.matched?'matched':'mismatch'}`}>
      <div className="trust-verdict">{verification.matched?<CheckCircle2 size={30}/>:<ShieldAlert size={30}/>}<div><span className="trust-card-kicker">RESULTADO DA VERIFICAÇÃO</span><h2>{verification.matched?'Documento corresponde ao Trust Report':'Documento NÃO corresponde ao Trust Report'}</h2><p>Relatório {report.reportId} • criado em {new Date(report.createdAt).toLocaleString('pt-BR')}</p></div></div>
      <div className="trust-check-list">{verification.checks.map(check=><div key={check.key} className={check.ok?'ok':'fail'}>{check.ok?<CheckCircle2 size={18}/>:<XCircle size={18}/>}<div><strong>{check.label}</strong><span>{check.ok?'Correspondência confirmada.':`Esperado: ${check.expected} • Atual: ${check.actual}`}</span></div></div>)}</div>
      <div className="trust-caveat"><Info size={16}/><span>Esta verificação confirma que o PDF corresponde aos dados técnicos gravados no JSON. Nesta versão, o JSON não possui assinatura de uma autoridade externa; portanto, isso não prova a autenticidade de quem criou o relatório.</span></div>
    </div>}

    {report&&<div className="workspace-card trust-report-summary">
      <div className="trust-section-head"><div><span className="trust-card-kicker">RELATÓRIO CARREGADO</span><h2>{report.reportId}</h2></div><ShieldCheck size={25}/></div>
      <div className="trust-summary-grid"><div><span>Original</span><strong>{report.source.name}</strong><small>{humanSize(report.source.sizeBytes)} • {report.source.pages} páginas</small></div><div><span>Resultado</span><strong>{report.output.name}</strong><small>{humanSize(report.output.sizeBytes)} • {report.output.pages} páginas</small></div><div><span>Etapas</span><strong>{report.operations.length}</strong><small>{report.operations.map(o=>o.label).join(' • ')||'Nenhuma etapa registrada'}</small></div><div><span>Hash do relatório</span><strong>{hashLabel(report.reportSha256)}</strong><small>SHA-256 interno do payload JSON</small></div></div>
    </div>}

    <div className="trust-legal-note"><FileIcon size={18}/><div><strong>Escopo técnico</strong><span>Document Trust Report é um registro de integridade e processamento. Não substitui assinatura digital ICP-Brasil, carimbo do tempo, perícia, certificação judicial ou validação formal de PDF/A.</span></div></div>
  </section>
}
