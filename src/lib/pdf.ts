import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'
import { nextFrame } from './files'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export type CompressionMode = 'smart'|'basic'|'medium'|'high'|'maximum'
export type ProgressFn = (value: number, message: string) => void

const profiles = {
  medium: { dpi: 160, quality: 0.82 },
  high: { dpi: 120, quality: 0.68 },
  maximum: { dpi: 96, quality: 0.50 },
} as const

async function loadPdfJs(file: File | Uint8Array) {
  const data = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file
  return pdfjsLib.getDocument({ data }).promise
}

export async function inspectPdf(file: File) {
  const pdf = await loadPdfJs(file)
  const sample = Math.min(3, pdf.numPages)
  let textChars = 0
  for (let i=1;i<=sample;i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    textChars += text.items.reduce((acc: number, item: any) => acc + ('str' in item ? item.str.length : 0), 0)
  }
  const avgBytes = file.size / Math.max(pdf.numPages,1)
  let recommended: CompressionMode = 'medium'
  if (avgBytes < 140_000 && textChars > 500) recommended = 'basic'
  else if (avgBytes > 700_000 && textChars < 250) recommended = 'maximum'
  else if (avgBytes > 380_000) recommended = 'high'
  return { pages: pdf.numPages, textChars, avgBytesPerPage: avgBytes, recommended }
}

export async function renderFirstPage(file: File, canvas: HTMLCanvasElement) {
  const pdf = await loadPdfJs(file)
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const maxWidth = Math.min(520, canvas.parentElement?.clientWidth || 520)
  const scale = Math.max(0.5, maxWidth / base.width)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d', { alpha: false })!
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Falha ao converter página em JPEG.')), 'image/jpeg', quality))
}

export async function compressPdf(file: File, mode: CompressionMode, onProgress: ProgressFn) {
  onProgress(2, 'Analisando o documento…')
  let selected = mode
  if (mode === 'smart') {
    const info = await inspectPdf(file)
    selected = info.recommended
    onProgress(6, `Modo Inteligente escolheu: ${selected === 'basic' ? 'Básico' : selected === 'medium' ? 'Médio' : selected === 'high' ? 'Alto' : 'Máximo'}`)
  }

  const original = new Uint8Array(await file.arrayBuffer())
  if (selected === 'basic') {
    const doc = await PDFDocument.load(original, { updateMetadata: false })
    onProgress(55, 'Reorganizando estruturas do PDF…')
    await nextFrame()
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
    onProgress(100, 'Concluído.')
    return { bytes: bytes.length < original.length ? bytes : original, mode: selected }
  }

  const profile = profiles[selected as keyof typeof profiles]
  const source = await loadPdfJs(original)
  const output = await PDFDocument.create()

  for (let i=1;i<=source.numPages;i++) {
    const page = await source.getPage(i)
    const ptViewport = page.getViewport({ scale: 1 })
    const scale = profile.dpi / 72
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0,0,canvas.width,canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const jpgBlob = await canvasToJpeg(canvas, profile.quality)
    const jpg = await output.embedJpg(await jpgBlob.arrayBuffer())
    const newPage = output.addPage([ptViewport.width, ptViewport.height])
    newPage.drawImage(jpg, { x:0, y:0, width:ptViewport.width, height:ptViewport.height })
    canvas.width = 1; canvas.height = 1
    onProgress(8 + Math.round((i/source.numPages)*87), `Comprimindo página ${i} de ${source.numPages}…`)
    await nextFrame()
  }

  onProgress(96, 'Finalizando o PDF…')
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 25 })
  onProgress(100, 'Concluído.')
  return { bytes: bytes.length < original.length ? bytes : original, mode: selected }
}

export async function mergePdfs(files: File[], onProgress: ProgressFn) {
  const out = await PDFDocument.create()
  let done = 0
  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer())
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach(p => out.addPage(p))
    done++
    onProgress(Math.round(done/files.length*90), `Adicionando ${file.name}…`)
    await nextFrame()
  }
  onProgress(96, 'Finalizando arquivo mesclado…')
  const bytes = await out.save({ useObjectStreams:true })
  onProgress(100, 'Concluído.')
  return bytes
}

export async function splitPdfBySize(file: File, maxMb: number, onProgress: ProgressFn) {
  const source = await PDFDocument.load(await file.arrayBuffer())
  const target = Math.max(100_000, Math.floor(maxMb * 1024 * 1024))
  const parts: Uint8Array[] = []
  let start = 0
  while (start < source.getPageCount()) {
    let end = start
    let best: Uint8Array | null = null
    while (end < source.getPageCount()) {
      const trial = await PDFDocument.create()
      const copied = await trial.copyPages(source, Array.from({length:end-start+1},(_,k)=>start+k))
      copied.forEach(p=>trial.addPage(p))
      const bytes = await trial.save({ useObjectStreams:true })
      if (bytes.length <= target || end === start) {
        best = bytes
        end++
      } else break
      onProgress(Math.min(92, Math.round((end/source.getPageCount())*92)), `Calculando partes: página ${end} de ${source.getPageCount()}…`)
      await nextFrame()
    }
    if (!best) throw new Error('Não foi possível criar uma parte do PDF.')
    parts.push(best)
    start = end
  }
  onProgress(100, `PDF dividido com sucesso em ${parts.length} parte(s).`)
  return parts
}

export async function extractPdfText(file: File, onProgress: ProgressFn) {
  const pdf = await loadPdfJs(file)
  const pages: string[] = []
  for(let i=1;i<=pdf.numPages;i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((x:any)=>('str' in x ? x.str : '')).join(' ')
    pages.push(text)
    onProgress(Math.round(i/pdf.numPages*100), `Extraindo texto: página ${i}/${pdf.numPages}`)
  }
  return pages
}

export async function pdfToImagesZip(file: File, format: 'jpeg'|'png', dpi: number, onProgress: ProgressFn) {
  const pdf = await loadPdfJs(file)
  const zip = new JSZip()
  for(let i=1;i<=pdf.numPages;i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: dpi/72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d', {alpha:false})!
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height)
    await page.render({canvasContext:ctx,viewport,canvas}).promise
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const blob: Blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao renderizar imagem.')),mime,0.9))
    zip.file(`pagina-${String(i).padStart(3,'0')}.${format==='jpeg'?'jpg':'png'}`,blob)
    onProgress(Math.round(i/pdf.numPages*90), `Renderizando página ${i}/${pdf.numPages}…`)
    canvas.width=1; canvas.height=1
    await nextFrame()
  }
  onProgress(94,'Compactando imagens em ZIP…')
  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>onProgress(94+Math.round(m.percent*.06),'Finalizando ZIP…'))
  onProgress(100,'Concluído.')
  return blob
}

export async function imagesToPdf(files: File[], onProgress: ProgressFn) {
  const pdf = await PDFDocument.create()
  for(let i=0;i<files.length;i++) {
    const file = files[i]
    const buffer = await file.arrayBuffer()
    const image = file.type === 'image/png' ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer)
    const maxW = 595.28, maxH = 841.89
    const ratio = Math.min(maxW/image.width, maxH/image.height, 1)
    const w = image.width*ratio, h=image.height*ratio
    const page = pdf.addPage([maxW,maxH])
    page.drawImage(image,{x:(maxW-w)/2,y:(maxH-h)/2,width:w,height:h})
    onProgress(Math.round((i+1)/files.length*90),`Adicionando imagem ${i+1}/${files.length}…`)
    await nextFrame()
  }
  const bytes = await pdf.save({useObjectStreams:true})
  onProgress(100,'Concluído.')
  return bytes
}
