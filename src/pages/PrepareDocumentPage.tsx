import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, Download, File, FileJson2, Fingerprint, Info, LockKeyhole, Save, Search, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tools } from '../lib/tools'
import { downloadBlob, humanSize, stem } from '../lib/files'
import { renderFirstPage } from '../lib/pdfPreview'
import { prepareDocument, type PrepareCompressionMode, type PrepareDocumentResult, type PrepareStepKey, type PrepareStepState } from '../lib/prepareDocument'
import type { BlankSensitivity, NumberPosition, PdfaVersion, WatermarkPosition } from '../lib/documentTools'
import type { OcrLanguage } from '../lib/ocr'
import { consumePreparePreset } from '../lib/tribunalPresets'
import { consumePrepareWorkflow, saveWorkflowFromPrepare } from '../lib/workflows'
import { createDocumentTrustReport, trustReportJsonBlob, trustReportPdfBlob, type DocumentTrustReport } from '../lib/trustReport'

const orderedSteps: Array<{ key: PrepareStepKey; label: string }> = [
  { key: 'remove-blank', label: 'Remover páginas em branco' },
  { key: 'compress', label: 'Comprimir' },
  { key: 'ocr', label: 'OCR pesquisável' },
  { key: 'remove-metadata', label: 'Remover metadados' },
  { key: 'watermark', label: 'Marca d’água' },
  { key: 'page-numbers', label: 'Numeração de páginas' },
  { key: 'pdfa', label: 'Converter para PDF/A' },
]

type StepUi = { state: PrepareStepState; message: string }

function freshStepState(): Record<PrepareStepKey, StepUi> {
  return {
    'remove-blank': { state: 'pending', message: '' },
    compress: { state: 'pending', message: '' },
    ocr: { state: 'pending', message: '' },
    'remove-metadata': { state: 'pending', message: '' },
    watermark: { state: 'pending', message: '' },
    'page-numbers': { state: 'pending', message: '' },
    pdfa: { state: 'pending', message: '' },
  }
}

export default function PrepareDocumentPage() {
  const tool = tools.find(item => item.id === 'prepare-document') || tools[0]
  const Icon = tool.icon
  const inputRef = useRef<HTMLInputElement|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const [file, setFile] = useState<File|null>(null)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Escolha as etapas e prepare o documento em um único fluxo.')
  const [error, setError] = useState('')
  const [result, setResult] = useState<PrepareDocumentResult|null>(null)
  const [trustReport, setTrustReport] = useState<DocumentTrustReport|null>(null)
  const [trustError, setTrustError] = useState('')
  const [generateTrustReport, setGenerateTrustReport] = useState(true)
  const [stepUi, setStepUi] = useState(freshStepState)

  const [removeBlank, setRemoveBlank] = useState(true)
  const [blankSensitivity, setBlankSensitivity] = useState<BlankSensitivity>('normal')
  const [compressionMode, setCompressionMode] = useState<PrepareCompressionMode>('smart')
  const [targetMb, setTargetMb] = useState(10)
  const [ocr, setOcr] = useState(false)
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('por')
  const [ocrDpi, setOcrDpi] = useState(180)
  const [removeMetadata, setRemoveMetadata] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [watermarkText, setWatermarkText] = useState('CONFIDENCIAL')
  const [watermarkOpacity, setWatermarkOpacity] = useState(18)
  const [watermarkSize, setWatermarkSize] = useState(46)
  const [watermarkRotation, setWatermarkRotation] = useState(-35)
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('center')
  const [pageNumbers, setPageNumbers] = useState(false)
  const [pageNumberStart, setPageNumberStart] = useState(1)
  const [pageNumberSize, setPageNumberSize] = useState(10)
  const [pageNumberPosition, setPageNumberPosition] = useState<NumberPosition>('bottom-center')
  const [pageNumberShowTotal, setPageNumberShowTotal] = useState(true)
  const [pageNumberPrefix, setPageNumberPrefix] = useState('Página ')
  const [pdfa, setPdfa] = useState(false)
  const [pdfaVersion, setPdfaVersion] = useState<PdfaVersion>(2)
  const [appliedPreset, setAppliedPreset] = useState<string|null>(null)
  const [appliedWorkflow, setAppliedWorkflow] = useState<string|null>(null)
  const [showWorkflowSave, setShowWorkflowSave] = useState(false)
  const [workflowName, setWorkflowName] = useState('')
  const [workflowSavedMessage, setWorkflowSavedMessage] = useState('')

  useEffect(() => {
    const workflow = consumePrepareWorkflow()
    const preset = workflow ? null : consumePreparePreset()
    const pending = workflow || preset
    if (!pending) return
    const o = pending.settings
    setRemoveBlank(o.removeBlank)
    setBlankSensitivity(o.blankSensitivity)
    setCompressionMode(o.compressionMode)
    setTargetMb(o.targetMb)
    setOcr(o.ocr)
    setOcrLanguage(o.ocrLanguage)
    setOcrDpi(o.ocrDpi)
    setRemoveMetadata(o.removeMetadata)
    setWatermark(o.watermark)
    setWatermarkText(o.watermarkText)
    setWatermarkOpacity(Math.round(o.watermarkOpacity * 100))
    setWatermarkSize(o.watermarkFontSize)
    setWatermarkRotation(o.watermarkRotation)
    setWatermarkPosition(o.watermarkPosition)
    setPageNumbers(o.pageNumbers)
    setPageNumberStart(o.pageNumberStart)
    setPageNumberSize(o.pageNumberFontSize)
    setPageNumberPosition(o.pageNumberPosition)
    setPageNumberShowTotal(o.pageNumberShowTotal)
    setPageNumberPrefix(o.pageNumberPrefix)
    setPdfa(o.pdfa)
    setPdfaVersion(o.pdfaVersion)
    if (workflow) {
      setGenerateTrustReport(workflow.generateTrustReport)
      setAppliedWorkflow(workflow.name)
      setAppliedPreset(null)
      setStatus(`Workflow “${workflow.name}” aplicado. Selecione o PDF e revise as etapas antes de executar.`)
    } else if (preset) {
      setAppliedPreset(`${preset.name} • ${preset.court}`)
      setAppliedWorkflow(null)
      setStatus(`Preset “${preset.name}” aplicado. Selecione o PDF e revise as etapas antes de executar.`)
    }
  }, [])

  useEffect(() => {
    if (file && canvasRef.current) renderFirstPage(file, canvasRef.current).catch(() => {})
    if (file) {
      const mb = file.size / (1024 * 1024)
      if (targetMb >= mb) setTargetMb(Math.max(0.5, Math.round(mb * 0.65 * 10) / 10))
    }
  }, [file])

  const enabled = useMemo<Record<PrepareStepKey, boolean>>(() => ({
    'remove-blank': removeBlank,
    compress: compressionMode !== 'off',
    ocr,
    'remove-metadata': removeMetadata,
    watermark,
    'page-numbers': pageNumbers,
    pdfa,
  }), [removeBlank, compressionMode, ocr, removeMetadata, watermark, pageNumbers, pdfa])

  const enabledCount = Object.values(enabled).filter(Boolean).length

  function selectFile(next: File|null) {
    setFile(next)
    setProgress(0); setResult(null); setTrustReport(null); setTrustError(''); setError(''); setStepUi(freshStepState())
    setStatus('Escolha as etapas e prepare o documento em um único fluxo.')
  }

  function toggleState(key: PrepareStepKey, value: boolean) {
    if (key === 'remove-blank') setRemoveBlank(value)
    if (key === 'ocr') setOcr(value)
    if (key === 'remove-metadata') setRemoveMetadata(value)
    if (key === 'watermark') setWatermark(value)
    if (key === 'page-numbers') setPageNumbers(value)
    if (key === 'pdfa') setPdfa(value)
  }

  function currentPrepareOptions() {
    return {
      removeBlank, blankSensitivity, compressionMode, targetMb, ocr, ocrLanguage, ocrDpi, ocrSkipPagesWithText: true,
      removeMetadata, watermark, watermarkText, watermarkOpacity: watermarkOpacity / 100, watermarkFontSize: watermarkSize,
      watermarkRotation, watermarkPosition, pageNumbers, pageNumberStart, pageNumberFontSize: pageNumberSize,
      pageNumberPosition, pageNumberShowTotal, pageNumberPrefix, pdfa, pdfaVersion,
    }
  }

  function saveCurrentWorkflow() {
    const saved = saveWorkflowFromPrepare(workflowName || 'Meu workflow', currentPrepareOptions(), generateTrustReport)
    setWorkflowName(saved.name)
    setWorkflowSavedMessage(`Workflow “${saved.name}” salvo neste navegador.`)
    setShowWorkflowSave(false)
  }

  async function run() {
    if (!file || working || enabledCount === 0) return
    setWorking(true); setProgress(1); setError(''); setResult(null); setStepUi(freshStepState())
    setStatus(`Preparando fluxo com ${enabledCount} etapa(s)…`)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    try {
      const prepareOptions = currentPrepareOptions()
      const prepared = await prepareDocument(file, prepareOptions, (overall, message, step, state) => {
        setProgress(overall)
        setStatus(message)
        setStepUi(previous => ({ ...previous, [step]: { state, message } }))
      })
      const outputName = `${stem(file.name)}_preparado.pdf`
      setResult(prepared)
      setTrustReport(null)
      setTrustError('')
      setProgress(100)
      if (generateTrustReport) {
        setStatus('Documento pronto. Calculando SHA-256 e gerando Document Trust Report…')
        try {
          const report = await createDocumentTrustReport(file, prepared, prepareOptions, outputName, appliedPreset || (appliedWorkflow ? `Workflow: ${appliedWorkflow}` : undefined))
          setTrustReport(report)
          setStatus('Documento preparado, validado e acompanhado de Trust Report.')
        } catch (trustFailure) {
          const trustMessage = trustFailure instanceof Error ? trustFailure.message : 'Não foi possível gerar o Trust Report.'
          setTrustError(trustMessage)
          setStatus('Documento preparado. Trust Report não pôde ser gerado.')
        }
      } else {
        setStatus('Documento preparado e validado.')
      }
      downloadBlob(new Blob([prepared.bytes], { type: 'application/pdf' }), outputName)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro inesperado durante a preparação.'
      setError(message); setStatus(message)
    } finally {
      setWorking(false)
    }
  }

  const reduction = result && result.originalBytes > 0
    ? Math.max(0, (1 - result.finalBytes / result.originalBytes) * 100)
    : 0

  return <section className="tool-page prepare-document-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    <div className="prepare-intro-card">
      <Sparkles size={21}/><div><strong>Um arquivo, várias etapas, um único resultado.</strong><span>A ordem foi pensada para preservar o documento: limpeza → compressão → OCR → privacidade → acabamento → PDF/A.</span></div>
    </div>

    {appliedPreset && <div className="preset-applied-banner"><CheckCircle2 size={18}/><div><strong>Preset aplicado: {appliedPreset}</strong><span>As opções abaixo foram carregadas automaticamente. Revise antes de protocolar.</span></div><Link to="/tool/tribunal-presets" className="secondary-btn small">Trocar preset</Link></div>}
    {appliedWorkflow && <div className="preset-applied-banner workflow-applied-banner"><Sparkles size={18}/><div><strong>Workflow aplicado: {appliedWorkflow}</strong><span>As etapas salvas foram carregadas. Selecione o PDF e execute quando estiver pronto.</span></div><Link to="/workflows" className="secondary-btn small">Trocar workflow</Link></div>}

    <div className="prepare-workflow-toolbar">
      <div><strong>Reutilizar esta configuração</strong><span>Salve as etapas atuais como workflow para usar novamente.</span></div>
      <button type="button" className="secondary-btn small" onClick={()=>{setShowWorkflowSave(v=>!v);setWorkflowSavedMessage('')}}><Save size={15}/> Salvar como workflow</button>
    </div>
    {showWorkflowSave && <div className="prepare-workflow-save"><input className="text-input" value={workflowName} onChange={e=>setWorkflowName(e.target.value)} placeholder="Ex.: Protocolo cliente X" maxLength={70}/><button type="button" className="primary-btn small" onClick={saveCurrentWorkflow}><Save size={15}/> Salvar</button></div>}
    {workflowSavedMessage && <div className="success-inline workflow-save-success"><CheckCircle2 size={16}/>{workflowSavedMessage}<Link to="/workflows">Gerenciar workflows</Link></div>}

    <div className="workspace-grid prepare-grid">
      <div className="workspace-card">
        <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); selectFile(e.dataTransfer.files?.[0] || null) }} onClick={()=>inputRef.current?.click()}>
          <UploadCloud size={45}/><strong>Arraste seu PDF aqui</strong><span>ou clique para selecionar</span><button className="primary-btn small" type="button">Selecionar arquivo</button>
          <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={e=>selectFile(e.target.files?.[0] || null)}/>
        </div>
        {file && <div className="file-list"><div className="file-row"><File size={18}/><div className="file-row-info"><strong>{file.name}</strong><span>{humanSize(file.size)}</span></div><button className="remove-file-btn" type="button" onClick={()=>selectFile(null)} disabled={working}><X size={17}/></button></div></div>}

        <div className="pipeline-card">
          <div className="pipeline-head"><div><strong>Pipeline do documento</strong><span>{enabledCount} de {orderedSteps.length} etapas selecionadas</span></div><span className="pipeline-badge">LEGAL / BUSINESS</span></div>
          <div className="pipeline-list">
            {orderedSteps.map((item, index) => {
              const active = enabled[item.key]
              const ui = stepUi[item.key]
              return <div key={item.key} className={`pipeline-step ${active ? 'enabled' : 'disabled'} ${ui.state}`}>
                <div className="pipeline-index">{ui.state === 'done' ? <Check size={15}/> : index + 1}</div>
                <div><strong>{item.label}</strong><span>{!active ? 'Desativada' : ui.message || 'Aguardando'}</span></div>
                <div className="pipeline-state">{ui.state === 'working' ? 'EXECUTANDO' : ui.state === 'done' ? 'OK' : ui.state === 'error' ? 'ERRO' : active ? 'ATIVA' : 'OFF'}</div>
              </div>
            })}
          </div>
        </div>
      </div>

      <aside className="workspace-card options-card prepare-options-card">
        <div className="prepare-options-head"><div><h3>Preparação</h3><p>Ative somente o que deseja aplicar.</p></div><Search size={19}/></div>

        <div className="prepare-option-block">
          <label className="prepare-toggle"><input type="checkbox" checked={removeBlank} onChange={e=>toggleState('remove-blank', e.target.checked)} disabled={working}/><span><strong>Remover páginas em branco</strong><small>Analisa texto e ruído visual.</small></span></label>
          {removeBlank && <select value={blankSensitivity} onChange={e=>setBlankSensitivity(e.target.value as BlankSensitivity)} disabled={working}><option value="conservative">Conservadora</option><option value="normal">Normal — recomendado</option><option value="aggressive">Agressiva para scans</option></select>}
        </div>

        <div className="prepare-option-block">
          <div className="prepare-toggle"><input type="checkbox" checked={compressionMode !== 'off'} onChange={e=>setCompressionMode(e.target.checked ? 'smart' : 'off')} disabled={working}/><span><strong>Comprimir</strong><small>Executado antes do OCR para preservar a camada pesquisável final.</small></span></div>
          {compressionMode !== 'off' && <><select value={compressionMode} onChange={e=>setCompressionMode(e.target.value as PrepareCompressionMode)} disabled={working}><option value="smart">Inteligente</option><option value="basic">Básico</option><option value="medium">Médio</option><option value="high">Alto</option><option value="maximum">Máximo</option><option value="target">Para X MB</option></select>{compressionMode === 'target' && <div className="number-field"><input type="number" min="0.5" step="0.5" value={targetMb} onChange={e=>setTargetMb(Number(e.target.value))} disabled={working}/><span>MB</span></div>}</>}
        </div>

        <div className="prepare-option-block">
          <label className="prepare-toggle"><input type="checkbox" checked={ocr} onChange={e=>toggleState('ocr', e.target.checked)} disabled={working}/><span><strong>OCR pesquisável</strong><small>Pula automaticamente páginas que já possuem texto.</small></span></label>
          {ocr && <div className="two-fields"><label><span>Idioma</span><select value={ocrLanguage} onChange={e=>setOcrLanguage(e.target.value as OcrLanguage)} disabled={working}><option value="por">Português</option><option value="eng">Inglês</option><option value="por+eng">Português + Inglês</option></select></label><label><span>Resolução</span><select value={ocrDpi} onChange={e=>setOcrDpi(Number(e.target.value))} disabled={working}><option value="150">150 DPI</option><option value="180">180 DPI</option><option value="220">220 DPI</option></select></label></div>}
        </div>

        <div className="prepare-option-block compact-block"><label className="prepare-toggle"><input type="checkbox" checked={removeMetadata} onChange={e=>toggleState('remove-metadata', e.target.checked)} disabled={working}/><span><strong>Remover metadados</strong><small>Limpa autor, software, XMP e informações documentais.</small></span></label></div>

        <div className="prepare-option-block">
          <label className="prepare-toggle"><input type="checkbox" checked={watermark} onChange={e=>toggleState('watermark', e.target.checked)} disabled={working}/><span><strong>Marca d’água</strong><small>Aplica texto visual em todas as páginas.</small></span></label>
          {watermark && <div className="prepare-subfields"><input className="text-input" value={watermarkText} onChange={e=>setWatermarkText(e.target.value)} maxLength={90} disabled={working}/><div className="two-fields"><label><span>Opacidade</span><div className="number-field"><input type="number" min="5" max="70" value={watermarkOpacity} onChange={e=>setWatermarkOpacity(Number(e.target.value))}/><span>%</span></div></label><label><span>Tamanho</span><div className="number-field"><input type="number" min="10" max="160" value={watermarkSize} onChange={e=>setWatermarkSize(Number(e.target.value))}/><span>pt</span></div></label></div><div className="two-fields"><label><span>Rotação</span><div className="number-field"><input type="number" min="-90" max="90" value={watermarkRotation} onChange={e=>setWatermarkRotation(Number(e.target.value))}/><span>°</span></div></label><label><span>Posição</span><select value={watermarkPosition} onChange={e=>setWatermarkPosition(e.target.value as WatermarkPosition)}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Rodapé</option></select></label></div></div>}
        </div>

        <div className="prepare-option-block">
          <label className="prepare-toggle"><input type="checkbox" checked={pageNumbers} onChange={e=>toggleState('page-numbers', e.target.checked)} disabled={working}/><span><strong>Numerar páginas</strong><small>Adiciona numeração depois do OCR e da marca d’água.</small></span></label>
          {pageNumbers && <div className="prepare-subfields"><div className="two-fields"><label><span>Começar em</span><input className="text-input" type="number" min="1" value={pageNumberStart} onChange={e=>setPageNumberStart(Number(e.target.value))}/></label><label><span>Tamanho</span><div className="number-field"><input type="number" min="7" max="32" value={pageNumberSize} onChange={e=>setPageNumberSize(Number(e.target.value))}/><span>pt</span></div></label></div><label><span>Posição</span><select value={pageNumberPosition} onChange={e=>setPageNumberPosition(e.target.value as NumberPosition)}><option value="bottom-center">Rodapé central</option><option value="bottom-right">Rodapé direito</option><option value="top-center">Topo central</option></select></label><label><span>Prefixo</span><input className="text-input" value={pageNumberPrefix} onChange={e=>setPageNumberPrefix(e.target.value)}/></label><label className="mini-check"><input type="checkbox" checked={pageNumberShowTotal} onChange={e=>setPageNumberShowTotal(e.target.checked)}/> Mostrar “X de Y”</label></div>}
        </div>

        <div className="prepare-option-block">
          <label className="prepare-toggle"><input type="checkbox" checked={pdfa} onChange={e=>toggleState('pdfa', e.target.checked)} disabled={working}/><span><strong>Converter para PDF/A</strong><small>Última etapa para preservar a conformidade do arquivo final.</small></span></label>
          {pdfa && <select value={pdfaVersion} onChange={e=>setPdfaVersion(Number(e.target.value) as PdfaVersion)} disabled={working}><option value="1">PDF/A-1b</option><option value="2">PDF/A-2b — recomendado</option><option value="3">PDF/A-3b</option></select>}
        </div>

        <div className="prepare-option-block trust-toggle-block">
          <label className="prepare-toggle"><input type="checkbox" checked={generateTrustReport} onChange={e=>setGenerateTrustReport(e.target.checked)} disabled={working}/><span><strong>Gerar Document Trust Report</strong><small>Calcula SHA-256 do original e do resultado e cria um relatório técnico verificável.</small></span></label>
        </div>

        <div className="prepare-action-bar">
          <button type="button" className="primary-btn wide run-btn" onClick={run} disabled={working || !file || enabledCount === 0}>{working ? `Preparando… ${progress}%` : `Preparar documento • ${enabledCount} etapa${enabledCount === 1 ? '' : 's'}`}</button>
          {!file && <span className="prepare-action-hint">Selecione um PDF para habilitar a execução.</span>}
        </div>
      </aside>
    </div>

    {(working || progress > 0 || result || error) && <div className="progress-card prepare-progress-card">
      <div className="progress-top"><div><strong>{error ? 'Falha na preparação' : result ? 'Documento pronto' : 'Preparando documento'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>
      {error && <div className="error-box"><Info size={22}/><span><strong>Não foi possível concluir.</strong> {error}</span></div>}
      {result && <>
        <div className="prepare-result-hero"><CheckCircle2 size={27}/><div><strong>Documento preparado com sucesso</strong><span>{humanSize(result.originalBytes)} → {humanSize(result.finalBytes)}{result.finalBytes < result.originalBytes ? ` • ${reduction.toFixed(1)}% menor` : ''} • {result.originalPages} → {result.finalPages} página(s)</span></div><button type="button" className="icon-action-btn" title="Baixar PDF novamente" onClick={()=>file&&downloadBlob(new Blob([result.bytes],{type:'application/pdf'}),`${stem(file.name)}_preparado.pdf`)}><Download size={19}/></button></div>
        <div className="prepare-report-grid">{result.reports.map(report=><div key={report.key}><CheckCircle2 size={17}/><span><strong>{report.label}</strong><small>{report.detail}</small></span></div>)}</div>
        {trustError && <div className="trust-inline-warning"><Info size={17}/><span><strong>Trust Report indisponível.</strong> {trustError}</span></div>}
        {trustReport && <div className="trust-inline-card">
          <div className="trust-inline-head"><div className="trust-shield"><ShieldCheck size={23}/></div><div><span>DOCUMENT TRUST REPORT</span><strong>{trustReport.reportId}</strong><small>SHA-256 do original e resultado registrados • {trustReport.validations.filter(v=>v.status==='passed').length} validações técnicas concluídas</small></div></div>
          <div className="trust-inline-hashes"><div><Fingerprint size={16}/><span><small>Original</small><code>{trustReport.source.sha256.slice(0,18)}…{trustReport.source.sha256.slice(-12)}</code></span></div><div><Fingerprint size={16}/><span><small>Resultado</small><code>{trustReport.output.sha256.slice(0,18)}…{trustReport.output.sha256.slice(-12)}</code></span></div></div>
          <div className="trust-inline-actions"><button type="button" className="secondary-btn small" onClick={()=>downloadBlob(trustReportPdfBlob(trustReport),`${stem(file?.name||'documento')}_trust-report.pdf`)}><Download size={15}/> Relatório PDF</button><button type="button" className="secondary-btn small" onClick={()=>downloadBlob(trustReportJsonBlob(trustReport),`${stem(file?.name||'documento')}_trust-report.json`)}><FileJson2 size={15}/> JSON verificável</button><Link className="secondary-btn small" to="/tool/trust-report"><Search size={15}/> Verificar relatório</Link></div>
        </div>}
      </>}
    </div>}

    {file && <div className="preview-card"><div><h3>Pré-visualização</h3><p>Primeira página do arquivo original. O documento final é baixado somente após todas as etapas selecionadas serem validadas.</p></div><div className="canvas-wrap"><canvas ref={canvasRef}/></div></div>}
  </section>
}
