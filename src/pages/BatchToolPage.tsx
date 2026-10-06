import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, File, Files, LockKeyhole, Trash2, UploadCloud } from 'lucide-react'
import { tools } from '../lib/tools'
import { compressPdf, compressPdfToTarget, type CompressionMode } from '../lib/pdf'
import { downloadBlob, humanSize, stem } from '../lib/files'

type BatchStatus = { name: string; state: 'waiting' | 'working' | 'done' | 'error'; message: string }

type BatchMode = Exclude<CompressionMode, 'target'> | 'target'

export default function BatchToolPage() {
  const tool = tools.find(item => item.id === 'batch')!
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<BatchMode>('smart')
  const [targetMb, setTargetMb] = useState(10)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Pronto.')
  const [success, setSuccess] = useState('')
  const [fileStatuses, setFileStatuses] = useState<BatchStatus[]>([])

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    setFiles(current => [...current, ...incoming])
    setSuccess('')
    setProgress(0)
    setFileStatuses([])
  }

  function removeFile(index: number) {
    setFiles(current => current.filter((_, i) => i !== index))
    setFileStatuses([])
    setSuccess('')
  }

  function patchStatus(index: number, patch: Partial<BatchStatus>) {
    setFileStatuses(current => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function run() {
    if (files.length === 0) return
    setWorking(true)
    setSuccess('')
    setProgress(0)
    setFileStatuses(files.map(file => ({ name: file.name, state: 'waiting', message: 'Aguardando' })))
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const report: string[] = [`PDF Studio — Processamento em lote`, `Arquivos: ${files.length}`, `Modo: ${mode}`, '']
    let completed = 0
    let errors = 0

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        patchStatus(index, { state: 'working', message: 'Processando…' })
        setStatus(`Arquivo ${index + 1}/${files.length}: ${file.name}`)
        try {
          const localProgress = (value: number, message: string) => {
            const overall = Math.round(((index + Math.max(0, Math.min(100, value)) / 100) / files.length) * 94)
            setProgress(overall)
            setStatus(`${file.name}: ${message}`)
          }
          const alreadyBelowTarget = mode === 'target' && file.size <= targetMb * 1024 * 1024
          const result = alreadyBelowTarget
            ? { bytes: new Uint8Array(await file.arrayBuffer()) }
            : mode === 'target'
              ? await compressPdfToTarget(file, targetMb, localProgress)
              : await compressPdf(file, mode, localProgress)
          if (!result.bytes || result.bytes.byteLength < 100) throw new Error('Resultado vazio ou inválido.')
          const finalBytes = result.bytes.slice()
          const reduction = Math.max(0, (1 - finalBytes.byteLength / file.size) * 100)
          const suffix = mode === 'target' ? `_ate_${String(targetMb).replace('.', '_')}MB` : `_compactado_${mode}`
          zip.file(`${String(index + 1).padStart(3, '0')}-${stem(file.name)}${suffix}.pdf`, finalBytes)
          const message = alreadyBelowTarget
            ? `${humanSize(file.size)} • já estava abaixo da meta de ${targetMb.toFixed(1)} MB`
            : `${humanSize(file.size)} → ${humanSize(finalBytes.byteLength)} • ${reduction.toFixed(1)}% menor`
          patchStatus(index, { state: 'done', message })
          report.push(`OK | ${file.name} | ${message}`)
          completed++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro inesperado.'
          patchStatus(index, { state: 'error', message })
          report.push(`ERRO | ${file.name} | ${message}`)
          errors++
        }
      }

      setProgress(95)
      setStatus('Criando ZIP com os resultados…')
      zip.file('relatorio-processamento.txt', report.join('\n'))
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } }, metadata => {
        setProgress(95 + Math.round(metadata.percent * 0.05))
      })
      downloadBlob(blob, `pdf-studio-lote-${new Date().toISOString().slice(0, 10)}.zip`)
      setProgress(100)
      setStatus('Lote concluído.')
      setSuccess(`${completed} arquivo(s) processado(s) com sucesso${errors ? ` e ${errors} com erro` : ''}. ZIP e relatório gerados.`)
    } finally {
      setWorking(false)
    }
  }

  return <section className="tool-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><Files size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
          <UploadCloud size={45}/><strong>Arraste vários PDFs aqui</strong><span>Os arquivos serão processados um por vez para controlar o uso de memória.</span><button className="primary-btn small" type="button">Adicionar PDFs</button>
          <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" multiple onChange={event => addFiles(event.target.files)}/>
        </div>
        {files.length > 0 && <div className="file-list batch-file-list">{files.map((file, index) => <div className="file-row" key={`${file.name}-${file.size}-${index}`}>
          <File size={18}/><div><strong>{file.name}</strong><span>{humanSize(file.size)}</span></div><button type="button" onClick={() => removeFile(index)} disabled={working} title="Remover"><Trash2 size={16}/></button>
        </div>)}</div>}
        {files.length > 0 && <div className="batch-summary"><span><strong>{files.length}</strong> PDFs</span><span><strong>{humanSize(totalSize)}</strong> no total</span><span>Saída em <strong>ZIP</strong></span></div>}
      </div>

      <aside className="workspace-card options-card">
        <h3>Configurações do lote</h3>
        <label className="field-label">Modo de compressão</label>
        <select value={mode} onChange={event => setMode(event.target.value as BatchMode)}>
          <option value="smart">Inteligente</option>
          <option value="basic">Básico</option>
          <option value="medium">Médio</option>
          <option value="high">Alto</option>
          <option value="maximum">Máximo</option>
          <option value="target">Para X MB cada</option>
        </select>
        {mode === 'target' && <><label className="field-label">Meta por arquivo</label><div className="number-field"><input type="number" min="0.5" step="0.5" value={targetMb} onChange={event => setTargetMb(Number(event.target.value))}/><span>MB</span></div></>}
        <div className="beta-note"><strong>Fila sequencial</strong><span>Processa um PDF por vez para reduzir picos de RAM em lotes grandes.</span></div>
        <button className="primary-btn wide run-btn" onClick={run} disabled={working || files.length === 0}>{working ? 'Processando lote…' : `Processar ${files.length || ''} PDF${files.length === 1 ? '' : 's'}`}</button>
      </aside>
    </div>

    {fileStatuses.length > 0 && <div className="batch-status-panel workspace-card">
      <h3>Fila de processamento</h3>
      <div className="batch-status-list">{fileStatuses.map((item, index) => <div className={`batch-status-row ${item.state}`} key={`${item.name}-${index}`}><span className="batch-state-dot"/><div><strong>{item.name}</strong><span>{item.message}</span></div></div>)}</div>
    </div>}

    {(working || progress > 0 || success) && <div className="progress-card">
      <div className="progress-top"><div><strong>{success ? 'Lote concluído' : 'Processando lote'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>
      {success && <div className="success-box"><Download size={20}/><span>{success}</span></div>}
    </div>}
  </section>
}
