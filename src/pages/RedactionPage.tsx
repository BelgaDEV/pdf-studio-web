import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Download, EyeOff, Info, LockKeyhole, RotateCcw, ShieldAlert, Trash2, Undo2, UploadCloud, ZoomIn, ZoomOut } from 'lucide-react'
import { tools } from '../lib/tools'
import { downloadBlob, humanSize, stem } from '../lib/files'
import { loadPdfForRedaction, permanentlyRedactPdf, renderRedactionPreview, type RedactionMap, type RedactionRect } from '../lib/redaction'

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function rectFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): RedactionRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    id: crypto.randomUUID(),
    x: clamp(x),
    y: clamp(y),
    width: clamp(Math.abs(end.x - start.x), 0, 1 - x),
    height: clamp(Math.abs(end.y - start.y), 0, 1 - y),
  }
}

export default function RedactionPage() {
  const tool = tools.find(item => item.id === 'redact')!
  const inputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfRef = useRef<any>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1.05)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [redactions, setRedactions] = useState<RedactionMap>({})
  const [draft, setDraft] = useState<RedactionRect | null>(null)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Selecione um PDF para começar.')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [dpi, setDpi] = useState(200)

  const currentRects = redactions[pageNumber] || []
  const redactionCount = useMemo(() => Object.values(redactions).reduce((sum, items) => sum + items.length, 0), [redactions])
  const redactedPages = useMemo(() => Object.values(redactions).filter(items => items.length > 0).length, [redactions])

  useEffect(() => () => { pdfRef.current?.destroy?.().catch?.(() => {}) }, [])

  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current || !pageNumber) return
    let cancelled = false
    setLoading(true)
    renderRedactionPreview(pdfRef.current, pageNumber, canvasRef.current, zoom)
      .then(size => { if (!cancelled) setCanvasSize(size) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao renderizar a página.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pageNumber, zoom, file])

  async function selectFile(next: File | null) {
    if (!next) return
    setLoading(true)
    setError('')
    setSuccess('')
    setProgress(0)
    setRedactions({})
    setDraft(null)
    setPageNumber(1)
    try {
      await pdfRef.current?.destroy?.().catch?.(() => {})
      const pdf = await loadPdfForRedaction(next)
      pdfRef.current = pdf
      setFile(next)
      setPageCount(pdf.numPages)
      setStatus(`${pdf.numPages} página(s) pronta(s). Arraste sobre o conteúdo sensível para marcar a redação.`)
      requestAnimationFrame(async () => {
        if (!canvasRef.current) return
        try {
          const size = await renderRedactionPreview(pdf, 1, canvasRef.current, zoom)
          setCanvasSize(size)
        } catch {}
      })
    } catch (err) {
      setFile(null)
      setPageCount(0)
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o PDF.')
    } finally {
      setLoading(false)
    }
  }

  function normalizedPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width)),
      y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height)),
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (working || !file || event.button !== 0) return
    const start = normalizedPoint(event)
    startRef.current = start
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraft({ id: 'draft', x: start.x, y: start.y, width: 0, height: 0 })
    setSuccess('')
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return
    const next = rectFromPoints(startRef.current, normalizedPoint(event))
    setDraft({ ...next, id: 'draft' })
  }

  function finishSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return
    const next = rectFromPoints(startRef.current, normalizedPoint(event))
    startRef.current = null
    setDraft(null)
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
    if (next.width < 0.008 || next.height < 0.006) return
    setRedactions(current => ({ ...current, [pageNumber]: [...(current[pageNumber] || []), next] }))
  }

  function removeRect(id: string) {
    setRedactions(current => ({ ...current, [pageNumber]: (current[pageNumber] || []).filter(rect => rect.id !== id) }))
  }

  function undoCurrent() {
    setRedactions(current => ({ ...current, [pageNumber]: (current[pageNumber] || []).slice(0, -1) }))
  }

  function clearCurrent() {
    setRedactions(current => ({ ...current, [pageNumber]: [] }))
  }

  function goToPage(next: number) {
    setPageNumber(Math.max(1, Math.min(pageCount, next)))
    setDraft(null)
    startRef.current = null
  }

  async function run() {
    if (!file || redactionCount === 0) return
    setWorking(true)
    setSuccess('')
    setError('')
    setProgress(0)
    try {
      const result = await permanentlyRedactPdf(file, redactions, { dpi }, (value, message) => {
        setProgress(value)
        setStatus(message)
      })
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${stem(file.name)}_redigido.pdf`)
      setSuccess(`${result.redactionCount} área(s) removida(s) permanentemente em ${result.redactedPages} página(s). ${result.verifiedPages} página(s) foram verificadas sem camada de texto extraível.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar a redação permanente.')
      setProgress(0)
    } finally {
      setWorking(false)
    }
  }

  return <section className="tool-page redaction-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><EyeOff size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Redação processada somente no seu dispositivo</div>
    </div>

    {!file ? <div className="redaction-empty workspace-card">
      <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0] || null) }} onClick={() => inputRef.current?.click()}>
        <UploadCloud size={48}/><strong>Arraste o PDF que contém dados sensíveis</strong><span>ou clique para selecionar</span><button className="primary-btn small" type="button">Selecionar PDF</button>
        <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={event => selectFile(event.target.files?.[0] || null)}/>
      </div>
      <div className="redaction-security-box"><ShieldAlert size={20}/><div><strong>Redação permanente, não apenas uma tarja visual</strong><span>As páginas que recebem redações são reconstruídas sem o conteúdo original. O texto escondido atrás da área preta não é carregado para a página final.</span></div></div>
    </div> : <>
      <div className="redaction-toolbar workspace-card">
        <div className="redaction-file-meta"><EyeOff size={20}/><div><strong>{file.name}</strong><span>{humanSize(file.size)} • {pageCount} página(s) • {redactionCount} área(s) marcada(s)</span></div></div>
        <div className="redaction-nav">
          <button type="button" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1 || working}><ArrowLeft size={16}/></button>
          <label>Página <input type="number" min="1" max={pageCount} value={pageNumber} onChange={event => goToPage(Number(event.target.value) || 1)}/> de {pageCount}</label>
          <button type="button" onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= pageCount || working}><ArrowRight size={16}/></button>
        </div>
        <div className="redaction-actions">
          <button type="button" title="Diminuir zoom" onClick={() => setZoom(value => Math.max(.7, Number((value - .15).toFixed(2))))} disabled={working}><ZoomOut size={16}/></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" title="Aumentar zoom" onClick={() => setZoom(value => Math.min(1.8, Number((value + .15).toFixed(2))))} disabled={working}><ZoomIn size={16}/></button>
          <button type="button" title="Desfazer última marcação da página" onClick={undoCurrent} disabled={!currentRects.length || working}><Undo2 size={16}/></button>
          <button type="button" title="Limpar marcações desta página" onClick={clearCurrent} disabled={!currentRects.length || working}><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="redaction-layout">
        <div className="redaction-preview-card workspace-card">
          <div className="redaction-instruction"><Info size={17}/><span><strong>Arraste sobre qualquer informação sensível.</strong> As áreas pretas são apenas a prévia; a remoção real acontece ao gerar o PDF redigido.</span></div>
          <div className="redaction-stage-shell">
            <div className={`redaction-stage ${loading ? 'loading' : ''}`} style={{ width: canvasSize.width || undefined, maxWidth: '100%' }}>
              <canvas ref={canvasRef}/>
              <div className="redaction-overlay" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishSelection} onPointerCancel={() => { startRef.current = null; setDraft(null) }}>
                {currentRects.map((rect, index) => <div key={rect.id} className="redaction-box" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}>
                  <span>{index + 1}</span>
                  <button type="button" aria-label="Remover esta redação" title="Remover esta redação" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); removeRect(rect.id) }}>×</button>
                </div>)}
                {draft && <div className="redaction-box draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }}/>} 
              </div>
            </div>
          </div>
        </div>

        <aside className="workspace-card redaction-options-card">
          <h3>Redação segura</h3>
          <div className="redaction-summary"><div><strong>{redactionCount}</strong><span>áreas</span></div><div><strong>{redactedPages}</strong><span>páginas</span></div><div><strong>{pageCount}</strong><span>total</span></div></div>
          <label className="field-label">Qualidade das páginas redigidas</label>
          <select value={dpi} onChange={event => setDpi(Number(event.target.value))} disabled={working}>
            <option value="150">Compacta — 150 DPI</option>
            <option value="200">Recomendada — 200 DPI</option>
            <option value="300">Alta — 300 DPI</option>
          </select>
          <div className="redaction-rule"><CheckCircle2 size={18}/><div><strong>O conteúdo original é descartado</strong><span>Somente as páginas com redação são rasterizadas e reconstruídas. As demais páginas são preservadas.</span></div></div>
          <div className="redaction-rule"><CheckCircle2 size={18}/><div><strong>Verificação automática</strong><span>Antes do download, o PDF Studio confirma que páginas redigidas não possuem camada de texto extraível.</span></div></div>
          <div className="redaction-warning"><ShieldAlert size={18}/><div><strong>Atenção</strong><span>Páginas redigidas perdem texto selecionável, links, campos de formulário e anotações. Isso é intencional para impedir recuperação do conteúdo removido.</span></div></div>
          <button className="primary-btn wide run-btn" onClick={run} disabled={!redactionCount || working}>{working ? 'Aplicando redação permanente…' : 'Aplicar redações permanentemente'}</button>
          <button className="secondary-btn wide" type="button" onClick={() => inputRef.current?.click()} disabled={working}><RotateCcw size={16}/> Trocar PDF</button>
          <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={event => selectFile(event.target.files?.[0] || null)}/>
        </aside>
      </div>
    </>}

    {(working || progress > 0 || success || error) && <div className="progress-card redaction-progress-card">
      <div className="progress-top"><div><strong>{success ? 'Redação concluída' : error ? 'Não foi possível concluir' : 'Aplicando redação permanente'}</strong><span>{error || status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>
      {success && <div className="success-box"><Download size={20}/><span>{success}</span></div>}
      {error && <div className="error-box"><ShieldAlert size={20}/><span>{error}</span></div>}
    </div>}
  </section>
}
