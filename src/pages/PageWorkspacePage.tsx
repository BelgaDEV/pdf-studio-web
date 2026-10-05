import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckSquare2, Copy, Download, GripVertical, LockKeyhole, RotateCcw, RotateCw, Square, Trash2, UploadCloud } from 'lucide-react'
import { tools } from '../lib/tools'
import { buildPdfFromPagePlan, renderPdfThumbnails, revokeThumbnails, type PagePlanItem, type PageThumbnail } from '../lib/pageEditor'
import { downloadBlob, humanSize, stem } from '../lib/files'

export type PageWorkspaceMode = 'organize' | 'edit-pages'

function newId(sourceIndex: number) {
  return `${sourceIndex}-${crypto.randomUUID()}`
}

export default function PageWorkspacePage({ mode }: { mode: PageWorkspaceMode }) {
  const tool = tools.find(item => item.id === mode)!
  const Icon = tool.icon
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<PageThumbnail[]>([])
  const [plan, setPlan] = useState<PagePlanItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Selecione um PDF.')
  const [success, setSuccess] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => () => revokeThumbnails(thumbs), [thumbs])

  const thumbMap = useMemo(() => new Map(thumbs.map(thumb => [thumb.sourceIndex, thumb])), [thumbs])

  async function selectFile(next: File | null) {
    if (!next) return
    revokeThumbnails(thumbs)
    setThumbs([])
    setPlan([])
    setSelectedIds(new Set())
    setFile(next)
    setLoading(true)
    setSuccess('')
    setProgress(0)
    try {
      const rendered = await renderPdfThumbnails(next, (value, message) => {
        setProgress(value)
        setStatus(message)
      })
      setThumbs(rendered)
      setPlan(rendered.map(thumb => ({ id: newId(thumb.sourceIndex), sourceIndex: thumb.sourceIndex, rotation: 0 })))
      setProgress(100)
      setStatus(`${rendered.length} página(s) pronta(s) para edição.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível abrir o PDF.')
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  function moveItem(fromId: string, toId: string) {
    if (fromId === toId) return
    setPlan(current => {
      const from = current.findIndex(item => item.id === fromId)
      const to = current.findIndex(item => item.id === toId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSuccess('')
  }

  function onDragStart(id: string, event: DragEvent<HTMLDivElement>) {
    if (working) return
    setDragId(id)
    setDragOverId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  function onDragOver(id: string, event: DragEvent<HTMLDivElement>) {
    if (working || !dragId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  function onDrop(id: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const from = dragId || event.dataTransfer.getData('text/plain')
    if (from) moveItem(from, id)
    setDragId(null)
    setDragOverId(null)
  }

  function shiftItem(id: string, delta: number) {
    setPlan(current => {
      const index = current.findIndex(item => item.id === id)
      const nextIndex = index + delta
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  function rotateItem(id: string, delta: number) {
    setPlan(current => current.map(item => item.id === id ? { ...item, rotation: item.rotation + delta } : item))
  }

  function deleteItem(id: string) {
    setPlan(current => current.filter(item => item.id !== id))
    setSelectedIds(current => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  function duplicateItem(id: string) {
    setPlan(current => {
      const index = current.findIndex(item => item.id === id)
      if (index < 0) return current
      const original = current[index]
      const next = [...current]
      next.splice(index + 1, 0, { ...original, id: newId(original.sourceIndex) })
      return next
    })
  }

  function toggleSelection(id: string) {
    setSelectedIds(current => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(plan.map(item => item.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function exportPlan(items: PagePlanItem[], suffix: string) {
    if (!file || items.length === 0) return
    setWorking(true)
    setSuccess('')
    setProgress(0)
    try {
      const bytes = await buildPdfFromPagePlan(file, items, (value, message) => {
        setProgress(value)
        setStatus(message)
      })
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${stem(file.name)}_${suffix}.pdf`)
      setSuccess(`${items.length} página(s) exportada(s) com sucesso.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao gerar o PDF.')
      setProgress(0)
    } finally {
      setWorking(false)
    }
  }

  const selectedPlan = plan.filter(item => selectedIds.has(item.id))

  return <section className="tool-page page-studio-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    {!file && <div className="workspace-card page-file-picker">
      <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0] || null) }} onClick={() => inputRef.current?.click()}>
        <UploadCloud size={48}/><strong>Arraste um PDF aqui</strong><span>ou clique para selecionar</span><button type="button" className="primary-btn small">Selecionar PDF</button>
        <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={event => selectFile(event.target.files?.[0] || null)}/>
      </div>
    </div>}

    {file && <>
      <div className="page-studio-toolbar workspace-card">
        <div className="page-studio-file"><strong>{file.name}</strong><span>{humanSize(file.size)} • {plan.length} página(s) no resultado</span></div>
        <div className="page-toolbar-actions">
          {mode === 'organize' && <>
            <button className="secondary-btn compact" type="button" onClick={selectAll} disabled={working || plan.length === 0}><CheckSquare2 size={16}/> Selecionar tudo</button>
            <button className="secondary-btn compact" type="button" onClick={clearSelection} disabled={working || selectedIds.size === 0}><Square size={16}/> Limpar</button>
            <button className="secondary-btn compact" type="button" onClick={() => exportPlan(selectedPlan, 'paginas_selecionadas')} disabled={working || selectedPlan.length === 0}><Download size={16}/> Extrair ({selectedPlan.length})</button>
          </>}
          <button className="primary-btn compact" type="button" onClick={() => exportPlan(plan, mode === 'organize' ? 'organizado' : 'editado')} disabled={working || plan.length === 0}>{working ? 'Gerando…' : mode === 'organize' ? 'Baixar PDF organizado' : 'Baixar PDF editado'}</button>
          <button className="secondary-btn compact" type="button" onClick={() => { setFile(null); revokeThumbnails(thumbs); setThumbs([]); setPlan([]); setSelectedIds(new Set()); setProgress(0); setSuccess('') }} disabled={working}>Trocar arquivo</button>
        </div>
      </div>

      <div className="page-studio-tip">
        <GripVertical size={18}/><div><strong>{mode === 'organize' ? 'Arraste para mudar a ordem' : 'Editor básico de páginas'}</strong><span>{mode === 'organize' ? 'Selecione páginas para extrair, remova as que não quer e use as setas no celular.' : 'Gire, duplique, exclua e reorganize páginas antes de baixar.'}</span></div>
      </div>

      <div className="page-thumb-grid">
        {plan.map((item, index) => {
          const thumb = thumbMap.get(item.sourceIndex)
          const selected = selectedIds.has(item.id)
          return <div
            key={item.id}
            className={`page-thumb-card ${selected ? 'selected' : ''} ${dragId === item.id ? 'dragging' : ''} ${dragOverId === item.id && dragId !== item.id ? 'drag-over' : ''}`}
            draggable={!working}
            onDragStart={event => onDragStart(item.id, event)}
            onDragOver={event => onDragOver(item.id, event)}
            onDrop={event => onDrop(item.id, event)}
            onDragEnd={() => { setDragId(null); setDragOverId(null) }}
          >
            <div className="page-thumb-top"><span className="page-position">{index + 1}</span><span>Pág. original {item.sourceIndex + 1}</span><GripVertical size={16}/></div>
            <div className="page-thumb-image-wrap" onClick={() => mode === 'organize' && toggleSelection(item.id)}>
              {thumb ? <img src={thumb.url} alt={`Página ${item.sourceIndex + 1}`} style={{ transform: `rotate(${item.rotation}deg)` }}/> : <div className="thumb-placeholder">Carregando…</div>}
              {mode === 'organize' && <div className={`page-checkbox ${selected ? 'active' : ''}`}>{selected ? '✓' : ''}</div>}
            </div>
            <div className="page-card-actions">
              <button type="button" title="Mover para a esquerda" disabled={working || index === 0} onClick={() => shiftItem(item.id, -1)}><ArrowLeft size={15}/></button>
              <button type="button" title="Mover para a direita" disabled={working || index === plan.length - 1} onClick={() => shiftItem(item.id, 1)}><ArrowRight size={15}/></button>
              {mode === 'edit-pages' && <>
                <button type="button" title="Girar 90° à esquerda" disabled={working} onClick={() => rotateItem(item.id, -90)}><RotateCcw size={15}/></button>
                <button type="button" title="Girar 90° à direita" disabled={working} onClick={() => rotateItem(item.id, 90)}><RotateCw size={15}/></button>
                <button type="button" title="Duplicar página" disabled={working} onClick={() => duplicateItem(item.id)}><Copy size={15}/></button>
              </>}
              <button type="button" className="danger-icon-btn" title="Excluir página" disabled={working || plan.length <= 1} onClick={() => deleteItem(item.id)}><Trash2 size={15}/></button>
            </div>
          </div>
        })}
      </div>
    </>}

    {(loading || working || progress > 0 || success) && <div className="progress-card">
      <div className="progress-top"><div><strong>{success ? 'Concluído' : loading ? 'Preparando páginas' : working ? 'Gerando PDF' : 'Pronto'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>
      {success && <div className="success-box"><Download size={20}/><span>{success}</span></div>}
    </div>}
  </section>
}
