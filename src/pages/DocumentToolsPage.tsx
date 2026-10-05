import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, Eye, EyeOff, File, Info, LockKeyhole, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tools, type ToolId } from '../lib/tools'
import { downloadBlob, humanSize, stem } from '../lib/files'
import { renderFirstPage } from '../lib/pdf'
import {
  addPageNumbers,
  addWatermark,
  convertToPdfA,
  extractEmbeddedImages,
  protectPdfWithPassword,
  removeBlankPages,
  removePdfMetadata,
  type BlankSensitivity,
  type NumberPosition,
  type PdfaVersion,
  type WatermarkPosition,
} from '../lib/documentTools'

export type DocumentToolId = 'watermark'|'page-numbers'|'remove-blank'|'remove-metadata'|'protect'|'extract-images'|'pdfa'

export const documentToolIds = new Set<DocumentToolId>(['watermark','page-numbers','remove-blank','remove-metadata','protect','extract-images','pdfa'])

export default function DocumentToolsPage({ toolId }: { toolId: DocumentToolId }) {
  const tool = tools.find(t => t.id === toolId) || tools[0]
  const Icon = tool.icon
  const inputRef = useRef<HTMLInputElement|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const [file, setFile] = useState<File|null>(null)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Pronto.')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [watermarkText, setWatermarkText] = useState('CONFIDENCIAL')
  const [watermarkOpacity, setWatermarkOpacity] = useState(18)
  const [watermarkSize, setWatermarkSize] = useState(46)
  const [watermarkRotation, setWatermarkRotation] = useState(-35)
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('center')

  const [numberStart, setNumberStart] = useState(1)
  const [numberSize, setNumberSize] = useState(10)
  const [numberPosition, setNumberPosition] = useState<NumberPosition>('bottom-center')
  const [numberTotal, setNumberTotal] = useState(true)
  const [numberPrefix, setNumberPrefix] = useState('Página ')

  const [blankSensitivity, setBlankSensitivity] = useState<BlankSensitivity>('normal')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [minImageDimension, setMinImageDimension] = useState(32)
  const [pdfaVersion, setPdfaVersion] = useState<PdfaVersion>(2)

  useEffect(() => {
    setFile(null); setWorking(false); setProgress(0); setStatus('Pronto.'); setSuccess(''); setError('')
  }, [toolId])

  useEffect(() => {
    if (file && canvasRef.current) renderFirstPage(file, canvasRef.current).catch(() => {})
  }, [file])

  function selectFile(next: File|null) {
    setFile(next)
    setProgress(0); setStatus('Pronto.'); setSuccess(''); setError('')
  }

  function update(value: number, message: string) {
    setProgress(Math.max(0, Math.min(100, value)))
    setStatus(message)
  }

  async function run() {
    if (!file || working) return
    setWorking(true); setProgress(1); setStatus('Preparando processamento…'); setSuccess(''); setError('')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    try {
      if (toolId === 'watermark') {
        const bytes = await addWatermark(file, {
          text: watermarkText,
          opacity: watermarkOpacity / 100,
          fontSize: watermarkSize,
          rotation: watermarkRotation,
          position: watermarkPosition,
        }, update)
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${stem(file.name)}_marca_dagua.pdf`)
        setSuccess(`Marca d’água aplicada em ${humanSize(file.size)} de forma 100% local.`)
      } else if (toolId === 'page-numbers') {
        const bytes = await addPageNumbers(file, {
          startAt: numberStart,
          fontSize: numberSize,
          position: numberPosition,
          showTotal: numberTotal,
          prefix: numberPrefix,
        }, update)
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${stem(file.name)}_numerado.pdf`)
        setSuccess('Numeração adicionada ao PDF com sucesso.')
      } else if (toolId === 'remove-blank') {
        const result = await removeBlankPages(file, blankSensitivity, update)
        if (result.removedPages.length) {
          downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${stem(file.name)}_sem_paginas_em_branco.pdf`)
          setSuccess(`${result.removedPages.length} página(s) em branco removida(s): ${result.removedPages.slice(0, 20).join(', ')}${result.removedPages.length > 20 ? '…' : ''}`)
        } else {
          setSuccess('Nenhuma página em branco foi encontrada; o arquivo original foi preservado.')
        }
      } else if (toolId === 'remove-metadata') {
        const result = await removePdfMetadata(file, update)
        downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${stem(file.name)}_sem_metadados.pdf`)
        setSuccess(`Metadados removidos. Motor: ${result.engine === 'qpdf' ? 'qpdf WebAssembly' : 'compatibilidade pdf-lib'}.`)
      } else if (toolId === 'protect') {
        if (password !== passwordConfirm) throw new Error('As senhas digitadas não são iguais.')
        const bytes = await protectPdfWithPassword(file, password, update)
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${stem(file.name)}_protegido.pdf`)
        setSuccess('PDF protegido com senha usando criptografia AES-256. Guarde a senha: não armazenamos uma cópia.')
      } else if (toolId === 'extract-images') {
        const result = await extractEmbeddedImages(file, { minDimension: minImageDimension }, update)
        downloadBlob(result.zip, `${stem(file.name)}_imagens.zip`)
        setSuccess(`${result.count} imagem(ns) incorporada(s) extraída(s) e empacotada(s) em ZIP.`)
      } else if (toolId === 'pdfa') {
        const bytes = await convertToPdfA(file, pdfaVersion, update)
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${stem(file.name)}_PDFA-${pdfaVersion}b.pdf`)
        setSuccess(`PDF/A-${pdfaVersion}b criado com Ghostscript WebAssembly. Para uso regulatório, faça validação formal de conformidade antes de arquivar.`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro inesperado.'
      setError(message); setStatus(message); setProgress(0)
    } finally { setWorking(false) }
  }

  return <section className="tool-page document-tools-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{background:tool.color}}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><LockKeyhole size={15}/> Processamento 100% local</div>
    </div>

    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();selectFile(e.dataTransfer.files?.[0] || null)}} onClick={()=>inputRef.current?.click()}>
          <UploadCloud size={45}/><strong>Arraste seu PDF aqui</strong><span>ou clique para selecionar</span><button className="primary-btn small" type="button">Selecionar arquivo</button>
          <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf" onChange={e=>selectFile(e.target.files?.[0] || null)}/>
        </div>
        {file && <div className="file-list"><div className="file-row"><File size={18}/><div className="file-row-info"><strong>{file.name}</strong><span>{humanSize(file.size)}</span></div><button className="remove-file-btn" type="button" onClick={()=>selectFile(null)} disabled={working}><X size={17}/></button></div></div>}
      </div>

      <aside className="workspace-card options-card document-options-card">
        <h3>Configurações</h3>

        {toolId === 'watermark' && <div className="doc-fields">
          <label className="field-label">Texto da marca d’água</label>
          <input className="text-input" value={watermarkText} onChange={e=>setWatermarkText(e.target.value)} maxLength={90}/>
          <div className="two-fields"><label><span>Opacidade</span><div className="range-value"><input type="range" min="5" max="70" value={watermarkOpacity} onChange={e=>setWatermarkOpacity(Number(e.target.value))}/><b>{watermarkOpacity}%</b></div></label><label><span>Tamanho</span><div className="number-field"><input type="number" min="10" max="160" value={watermarkSize} onChange={e=>setWatermarkSize(Number(e.target.value))}/><span>pt</span></div></label></div>
          <div className="two-fields"><label><span>Rotação</span><div className="number-field"><input type="number" min="-90" max="90" value={watermarkRotation} onChange={e=>setWatermarkRotation(Number(e.target.value))}/><span>°</span></div></label><label><span>Posição</span><select value={watermarkPosition} onChange={e=>setWatermarkPosition(e.target.value as WatermarkPosition)}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Rodapé</option></select></label></div>
        </div>}

        {toolId === 'page-numbers' && <div className="doc-fields">
          <div className="two-fields"><label><span>Começar em</span><input className="text-input" type="number" min="1" value={numberStart} onChange={e=>setNumberStart(Number(e.target.value))}/></label><label><span>Tamanho</span><div className="number-field"><input type="number" min="7" max="32" value={numberSize} onChange={e=>setNumberSize(Number(e.target.value))}/><span>pt</span></div></label></div>
          <label><span>Posição</span><select value={numberPosition} onChange={e=>setNumberPosition(e.target.value as NumberPosition)}><option value="bottom-center">Rodapé central</option><option value="bottom-right">Rodapé direito</option><option value="top-center">Topo central</option></select></label>
          <label><span>Prefixo</span><input className="text-input" value={numberPrefix} onChange={e=>setNumberPrefix(e.target.value)} placeholder="Página "/></label>
          <label className="toggle-row"><input type="checkbox" checked={numberTotal} onChange={e=>setNumberTotal(e.target.checked)}/><span><strong>Mostrar total de páginas</strong><small>Ex.: Página 3 de 20.</small></span></label>
        </div>}

        {toolId === 'remove-blank' && <div className="doc-fields">
          <label><span>Sensibilidade</span><select value={blankSensitivity} onChange={e=>setBlankSensitivity(e.target.value as BlankSensitivity)}><option value="conservative">Conservadora — remove somente páginas quase totalmente vazias</option><option value="normal">Normal — recomendado</option><option value="aggressive">Agressiva — tolera mais ruído de scanner</option></select></label>
          <div className="doc-info-box"><Info size={17}/><span>O detector verifica texto e também analisa visualmente páginas sem texto. Use Agressiva apenas quando scans vazios tiverem sombras ou ruído.</span></div>
        </div>}

        {toolId === 'remove-metadata' && <div className="doc-info-box"><Info size={17}/><span>Remove metadados XMP e informações como autor, título, assunto, aplicativo criador e outros dados documentais quando presentes. O conteúdo visível do PDF não é alterado.</span></div>}

        {toolId === 'protect' && <div className="doc-fields">
          <label><span>Senha para abrir o PDF</span><div className="password-input"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} title={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          <label><span>Confirmar senha</span><input className="text-input" type={showPassword?'text':'password'} value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} autoComplete="new-password"/></label>
          <div className="doc-info-box security"><LockKeyhole size={17}/><span>A senha é usada apenas localmente para criar o arquivo criptografado e não é enviada nem armazenada pelo PDF Studio.</span></div>
        </div>}

        {toolId === 'extract-images' && <div className="doc-fields">
          <label><span>Ignorar imagens menores que</span><div className="number-field"><input type="number" min="1" max="500" value={minImageDimension} onChange={e=>setMinImageDimension(Number(e.target.value))}/><span>px</span></div></label>
          <div className="doc-info-box"><Info size={17}/><span>Extrai imagens raster incorporadas ao PDF e entrega tudo em ZIP como PNG. Textos e gráficos vetoriais não são convertidos em imagens.</span></div>
        </div>}

        {toolId === 'pdfa' && <div className="doc-fields">
          <label><span>Versão de arquivamento</span><select value={pdfaVersion} onChange={e=>setPdfaVersion(Number(e.target.value) as PdfaVersion)}><option value="1">PDF/A-1b — maior compatibilidade</option><option value="2">PDF/A-2b — recomendado</option><option value="3">PDF/A-3b — permite recursos mais modernos</option></select></label>
          <div className="doc-info-box warning"><Info size={17}/><span>O Ghostscript cria conformidade nível b. Para protocolo, preservação permanente ou exigência normativa, valide o arquivo final com um validador PDF/A dedicado antes do uso oficial.</span></div>
        </div>}

        <button type="button" className="primary-btn wide run-btn" onClick={run} disabled={working||!file}>{working?'Processando…':'Executar agora'}</button>
      </aside>
    </div>

    {(progress>0||working||success||error) && <div className="progress-card">
      <div className="progress-top"><div><strong>{error?'Falha no processamento':success?'Processamento concluído':'Processando'}</strong><span>{status}</span></div><b>{progress}%</b></div>
      <div className="progress-track"><div style={{width:`${progress}%`}}/></div>
      {success && <div className="success-box"><CheckCircle2 size={22}/><span>{success}</span><Download size={19}/></div>}
      {error && <div className="error-box"><Info size={22}/><span><strong>Não foi possível concluir.</strong> {error}</span></div>}
    </div>}

    {file && <div className="preview-card"><div><h3>Pré-visualização</h3><p>Primeira página renderizada localmente.</p></div><div className="canvas-wrap"><canvas ref={canvasRef}/></div></div>}
  </section>
}
