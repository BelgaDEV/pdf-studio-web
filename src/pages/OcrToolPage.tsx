import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Info, LockKeyhole, ScanText, UploadCloud } from 'lucide-react'
import { tools } from '../lib/tools'
import { downloadBlob, humanSize, stem } from '../lib/files'
import { ocrPdfToSearchable, type OcrLanguage } from '../lib/ocr'

export default function OcrToolPage() {
  const tool = tools.find(item => item.id === 'ocr')!
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<OcrLanguage>('por')
  const [dpi, setDpi] = useState(180)
  const [skipTextPages, setSkipTextPages] = useState(true)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Pronto.')
  const [success, setSuccess] = useState('')

  async function run() {
    if (!file) return
    setWorking(true)
    setSuccess('')
    setProgress(0)
    try {
      const result = await ocrPdfToSearchable(file, language, dpi, skipTextPages, (value, message) => {
        setProgress(value)
        setStatus(message)
      })
      const blob = new Blob([result.bytes], { type: 'application/pdf' })
      downloadBlob(blob, `${stem(file.name)}_ocr_pesquisavel.pdf`)
      setSuccess(`PDF pesquisável criado. ${result.recognizedPages} página(s) passaram por OCR, ${result.skippedPages} já tinham texto e foram preservadas. ${result.characters.toLocaleString('pt-BR')} caracteres detectados.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha durante o OCR.')
      setProgress(0)
    } finally {
      setWorking(false)
    }
  }

  return <section className="tool-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><ScanText size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Documento processado no seu navegador</div>
    </div>

    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files?.[0] || null); setSuccess(''); setProgress(0) }} onClick={() => inputRef.current?.click()}>
          <UploadCloud size={45}/><strong>{file ? file.name : 'Arraste um PDF escaneado aqui'}</strong><span>{file ? humanSize(file.size) : 'ou clique para selecionar'}</span><button className="primary-btn small" type="button">{file ? 'Trocar PDF' : 'Selecionar PDF'}</button>
          <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] || null); setSuccess(''); setProgress(0) }}/>
        </div>
        <div className="ocr-explainer"><Info size={18}/><div><strong>O que o OCR faz?</strong><span>Reconhece texto em páginas escaneadas e adiciona uma camada invisível pesquisável ao PDF original. O visual do documento é preservado.</span></div></div>
      </div>

      <aside className="workspace-card options-card">
        <h3>Configurações do OCR</h3>
        <label className="field-label">Idioma</label>
        <select value={language} onChange={event => setLanguage(event.target.value as OcrLanguage)}>
          <option value="por">Português</option>
          <option value="eng">Inglês</option>
          <option value="por+eng">Português + Inglês</option>
        </select>
        <label className="field-label">Qualidade da leitura</label>
        <select value={dpi} onChange={event => setDpi(Number(event.target.value))}>
          <option value="150">Rápido — 150 DPI</option>
          <option value="180">Equilibrado — 180 DPI</option>
          <option value="220">Alta precisão — 220 DPI</option>
        </select>
        <label className="toggle-row"><input type="checkbox" checked={skipTextPages} onChange={event => setSkipTextPages(event.target.checked)}/><span><strong>Pular páginas que já têm texto</strong><small>Evita OCR desnecessário em PDFs mistos.</small></span></label>
        <div className="beta-note"><strong>Primeiro uso</strong><span>O navegador baixa o modelo de idioma do Tesseract. O PDF não é enviado para o serviço de OCR; o reconhecimento ocorre localmente.</span></div>
        <button className="primary-btn wide run-btn" onClick={run} disabled={!file || working}>{working ? 'Reconhecendo texto…' : 'Criar PDF pesquisável'}</button>
      </aside>
    </div>

    {(working || progress > 0 || success) && <div className="progress-card">
      <div className="progress-top"><div><strong>{success ? 'OCR concluído' : 'Executando OCR'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>
      {success && <div className="success-box"><Download size={20}/><span>{success}</span></div>}
    </div>}
  </section>
}
