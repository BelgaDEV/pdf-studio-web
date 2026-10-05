import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export type CompareProgress = (value:number, message:string)=>void
export type CompareStatus = 'unchanged'|'modified'|'added'|'removed'

export interface PdfPageSnapshot {
  pageNumber:number
  text:string
  normalizedText:string
  wordCount:number
  width:number
  height:number
}

export interface PdfSnapshot {
  fileName:string
  size:number
  pageCount:number
  pages:PdfPageSnapshot[]
}

export interface TextChangeSummary {
  addedWords:number
  removedWords:number
  addedSnippet:string
  removedSnippet:string
}

export interface PageComparison {
  id:string
  status:CompareStatus
  originalPage?:number
  revisedPage?:number
  originalWords:number
  revisedWords:number
  textChanged:boolean
  visualDifference:number|null
  textChange:TextChangeSummary
}

export interface PdfComparisonResult {
  original:PdfSnapshot
  revised:PdfSnapshot
  pages:PageComparison[]
  summary:{
    unchanged:number
    modified:number
    added:number
    removed:number
    totalDifferences:number
  }
  visualCompared:boolean
  durationMs:number
}

function normalizeText(value:string){
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function tokenize(value:string){
  return normalizeText(value).match(/[\p{L}\p{N}]+(?:[.,:/_-][\p{L}\p{N}]+)*|[^\s]/gu) || []
}

function buildTextFromContent(content:any):string{
  const lines:string[]=[]
  let current=''
  for(const item of content.items || []){
    if(!item || typeof item.str!=='string') continue
    const token=item.str
    if(token){
      if(current && !current.endsWith(' ')) current+=' '
      current+=token
    }
    if(item.hasEOL){
      const line=current.trim()
      if(line) lines.push(line)
      current=''
    }
  }
  const tail=current.trim()
  if(tail) lines.push(tail)
  return lines.join('\n')
}

async function loadPdf(file:File){
  const data=new Uint8Array(await file.arrayBuffer())
  return pdfjsLib.getDocument({data}).promise
}

export async function inspectPdfForComparison(file:File,onProgress?:CompareProgress,progressStart=0,progressEnd=40):Promise<PdfSnapshot>{
  const pdf=await loadPdf(file)
  const pages:PdfPageSnapshot[]=[]
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i)
    const viewport=page.getViewport({scale:1})
    const content=await page.getTextContent()
    const text=buildTextFromContent(content)
    const normalizedText=normalizeText(text)
    pages.push({
      pageNumber:i,
      text,
      normalizedText,
      wordCount:tokenize(text).length,
      width:viewport.width,
      height:viewport.height,
    })
    if(onProgress){
      const ratio=i/Math.max(1,pdf.numPages)
      onProgress(Math.round(progressStart+(progressEnd-progressStart)*ratio),`Lendo ${file.name}: página ${i}/${pdf.numPages}…`)
    }
    if(i%8===0) await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
  }
  return {fileName:file.name,size:file.size,pageCount:pdf.numPages,pages}
}

function pageSignature(page:PdfPageSnapshot){
  if(!page.normalizedText || page.normalizedText.length<8) return ''
  return page.normalizedText
}

function exactAnchorPairs(a:PdfPageSnapshot[],b:PdfPageSnapshot[]):Array<[number,number]>{
  const n=a.length,m=b.length
  if(n===0||m===0) return []
  const product=n*m
  if(product>2_000_000){
    const result:Array<[number,number]>=[]
    const limit=Math.min(n,m)
    for(let i=0;i<limit;i++){
      const sa=pageSignature(a[i]), sb=pageSignature(b[i])
      if(sa && sa===sb) result.push([i,i])
    }
    return result
  }
  const width=m+1
  const matrix=new Uint16Array((n+1)*width)
  for(let i=1;i<=n;i++){
    const sa=pageSignature(a[i-1])
    for(let j=1;j<=m;j++){
      const sb=pageSignature(b[j-1])
      const idx=i*width+j
      if(sa && sb && sa===sb) matrix[idx]=matrix[(i-1)*width+j-1]+1
      else matrix[idx]=Math.max(matrix[(i-1)*width+j],matrix[i*width+j-1])
    }
  }
  const anchors:Array<[number,number]>=[]
  let i=n,j=m
  while(i>0&&j>0){
    const sa=pageSignature(a[i-1]), sb=pageSignature(b[j-1])
    if(sa && sb && sa===sb){ anchors.push([i-1,j-1]); i--; j--; }
    else if(matrix[(i-1)*width+j]>=matrix[i*width+j-1]) i--
    else j--
  }
  anchors.reverse()
  return anchors
}

interface AlignmentItem{originalIndex?:number;revisedIndex?:number}

function alignPages(a:PdfPageSnapshot[],b:PdfPageSnapshot[]):AlignmentItem[]{
  const anchors=exactAnchorPairs(a,b)
  const result:AlignmentItem[]=[]
  let ai=0,bi=0
  const flushGap=(aEnd:number,bEnd:number)=>{
    const aCount=aEnd-ai,bCount=bEnd-bi
    const paired=Math.min(aCount,bCount)
    for(let k=0;k<paired;k++) result.push({originalIndex:ai+k,revisedIndex:bi+k})
    for(let k=paired;k<aCount;k++) result.push({originalIndex:ai+k})
    for(let k=paired;k<bCount;k++) result.push({revisedIndex:bi+k})
    ai=aEnd; bi=bEnd
  }
  for(const [anchorA,anchorB] of anchors){
    flushGap(anchorA,anchorB)
    result.push({originalIndex:anchorA,revisedIndex:anchorB})
    ai=anchorA+1; bi=anchorB+1
  }
  flushGap(a.length,b.length)
  return result
}

function wordDelta(original:string,revised:string):TextChangeSummary{
  const a=tokenize(original), b=tokenize(revised)
  const countsA=new Map<string,number>(), countsB=new Map<string,number>()
  for(const token of a){const key=token.toLocaleLowerCase('pt-BR');countsA.set(key,(countsA.get(key)||0)+1)}
  for(const token of b){const key=token.toLocaleLowerCase('pt-BR');countsB.set(key,(countsB.get(key)||0)+1)}
  let removedWords=0,addedWords=0
  const removedTokens:string[]=[],addedTokens:string[]=[]
  for(const token of a){
    const key=token.toLocaleLowerCase('pt-BR')
    const used=Math.min(countsA.get(key)||0,countsB.get(key)||0)
    if((countsA.get(key)||0)>used){
      const remaining=(countsA.get(key)||0)-used
      countsA.set(key,used)
      for(let i=0;i<remaining;i++){removedWords++;if(removedTokens.length<28) removedTokens.push(token)}
    }
  }
  for(const token of b){
    const key=token.toLocaleLowerCase('pt-BR')
    const common=Math.min((countsB.get(key)||0),(countsA.get(key)||0))
    if((countsB.get(key)||0)>common){
      const remaining=(countsB.get(key)||0)-common
      countsB.set(key,common)
      for(let i=0;i<remaining;i++){addedWords++;if(addedTokens.length<28) addedTokens.push(token)}
    }
  }
  return {
    addedWords,
    removedWords,
    addedSnippet:addedTokens.join(' '),
    removedSnippet:removedTokens.join(' '),
  }
}

async function renderPageData(pdf:any,pageNumber:number,maxWidth=420):Promise<ImageData>{
  const page=await pdf.getPage(pageNumber)
  const base=page.getViewport({scale:1})
  const scale=Math.max(0.2,Math.min(1.5,maxWidth/base.width))
  const viewport=page.getViewport({scale})
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(viewport.width))
  canvas.height=Math.max(1,Math.round(viewport.height))
  const ctx=canvas.getContext('2d',{alpha:false})!
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)
  await page.render({canvasContext:ctx,viewport,canvas}).promise
  return ctx.getImageData(0,0,canvas.width,canvas.height)
}

function visualDifferencePercent(a:ImageData,b:ImageData){
  if(a.width!==b.width || a.height!==b.height){
    const ratioA=a.width/a.height,ratioB=b.width/b.height
    if(Math.abs(ratioA-ratioB)>0.01) return 100
  }
  const width=Math.min(a.width,b.width),height=Math.min(a.height,b.height)
  if(width===0||height===0) return 100
  let changed=0,samples=0
  const step=Math.max(1,Math.floor(Math.sqrt((width*height)/120_000)))
  for(let y=0;y<height;y+=step){
    for(let x=0;x<width;x+=step){
      const ia=(y*a.width+x)*4, ib=(y*b.width+x)*4
      const delta=(Math.abs(a.data[ia]-b.data[ib])+Math.abs(a.data[ia+1]-b.data[ib+1])+Math.abs(a.data[ia+2]-b.data[ib+2]))/3
      if(delta>22) changed++
      samples++
    }
  }
  return samples?changed/samples*100:0
}

export async function comparePdfFiles(originalFile:File,revisedFile:File,options:{visual:boolean},onProgress:CompareProgress):Promise<PdfComparisonResult>{
  const started=performance.now()
  onProgress(2,'Lendo o PDF original…')
  const original=await inspectPdfForComparison(originalFile,onProgress,2,23)
  onProgress(24,'Lendo o PDF revisado…')
  const revised=await inspectPdfForComparison(revisedFile,onProgress,24,45)
  onProgress(46,'Alinhando páginas e identificando inserções/remoções…')
  const alignment=alignPages(original.pages,revised.pages)
  const pages:PageComparison[]=alignment.map((item,index)=>{
    const a=item.originalIndex!==undefined?original.pages[item.originalIndex]:undefined
    const b=item.revisedIndex!==undefined?revised.pages[item.revisedIndex]:undefined
    if(!a && b){
      return {id:`added-${index}`,status:'added',revisedPage:b.pageNumber,originalWords:0,revisedWords:b.wordCount,textChanged:true,visualDifference:null,textChange:{addedWords:b.wordCount,removedWords:0,addedSnippet:tokenize(b.text).slice(0,28).join(' '),removedSnippet:''}}
    }
    if(a && !b){
      return {id:`removed-${index}`,status:'removed',originalPage:a.pageNumber,originalWords:a.wordCount,revisedWords:0,textChanged:true,visualDifference:null,textChange:{addedWords:0,removedWords:a.wordCount,addedSnippet:'',removedSnippet:tokenize(a.text).slice(0,28).join(' ')}}
    }
    const textChanged=a!.normalizedText!==b!.normalizedText
    return {id:`pair-${index}`,status:textChanged?'modified':'unchanged',originalPage:a!.pageNumber,revisedPage:b!.pageNumber,originalWords:a!.wordCount,revisedWords:b!.wordCount,textChanged,visualDifference:null,textChange:textChanged?wordDelta(a!.text,b!.text):{addedWords:0,removedWords:0,addedSnippet:'',removedSnippet:''}}
  })

  if(options.visual){
    const originalPdf=await loadPdf(originalFile)
    const revisedPdf=await loadPdf(revisedFile)
    const paired=pages.filter(p=>p.originalPage&&p.revisedPage)
    for(let i=0;i<paired.length;i++){
      const entry=paired[i]
      const [aPixels,bPixels]=await Promise.all([
        renderPageData(originalPdf,entry.originalPage!),
        renderPageData(revisedPdf,entry.revisedPage!),
      ])
      const diff=visualDifferencePercent(aPixels,bPixels)
      entry.visualDifference=diff
      if(diff>=0.8 && entry.status==='unchanged') entry.status='modified'
      const mapped=48+Math.round((i+1)/Math.max(1,paired.length)*45)
      onProgress(mapped,`Comparando visualmente: ${i+1}/${paired.length} página(s)…`)
      if(i%3===0) await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    }
  }else{
    onProgress(92,'Comparação textual concluída.')
  }

  const summary={unchanged:0,modified:0,added:0,removed:0,totalDifferences:0}
  for(const page of pages) summary[page.status]++
  summary.totalDifferences=summary.modified+summary.added+summary.removed
  onProgress(100,summary.totalDifferences===0?'Os PDFs são equivalentes nos critérios analisados.':`${summary.totalDifferences} diferença(s) encontrada(s).`)
  return {original,revised,pages,summary,visualCompared:options.visual,durationMs:performance.now()-started}
}

export async function renderPdfPageToCanvas(file:File,pageNumber:number,canvas:HTMLCanvasElement,maxWidth=760){
  const pdf=await loadPdf(file)
  if(pageNumber<1||pageNumber>pdf.numPages) throw new Error('Página fora do intervalo do PDF.')
  const page=await pdf.getPage(pageNumber)
  const base=page.getViewport({scale:1})
  const scale=Math.max(0.25,Math.min(2,maxWidth/base.width))
  const viewport=page.getViewport({scale})
  canvas.width=Math.max(1,Math.floor(viewport.width))
  canvas.height=Math.max(1,Math.floor(viewport.height))
  const ctx=canvas.getContext('2d',{alpha:false})!
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)
  await page.render({canvasContext:ctx,viewport,canvas}).promise
}

function safeReportText(value:string){
  return value.replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?')
}

function wrapText(text:string,maxChars=94){
  const words=safeReportText(text).split(/\s+/).filter(Boolean)
  const lines:string[]=[]
  let line=''
  for(const word of words){
    if(!line){line=word;continue}
    if((line+' '+word).length<=maxChars) line+=' '+word
    else{lines.push(line);line=word}
  }
  if(line) lines.push(line)
  return lines.length?lines:['']
}

export async function buildComparisonReportPdf(result:PdfComparisonResult):Promise<Uint8Array>{
  const doc=await PDFDocument.create()
  const regular=await doc.embedFont(StandardFonts.Helvetica)
  const bold=await doc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth=595.28,pageHeight=841.89,margin=48
  let page=doc.addPage([pageWidth,pageHeight])
  let y=pageHeight-margin
  const newPage=()=>{page=doc.addPage([pageWidth,pageHeight]);y=pageHeight-margin}
  const ensure=(height:number)=>{if(y-height<margin) newPage()}
  const line=(text:string,size=9,font=regular,indent=0)=>{
    const lines=wrapText(text,Math.max(36,94-Math.floor(indent/5)))
    for(const item of lines){ensure(size+6);page.drawText(item,{x:margin+indent,y:y-size,size,font,color:rgb(.10,.13,.18)});y-=size+5}
  }
  page.drawText('PDF Studio - Relatorio de Comparacao',{x:margin,y:y-22,size:20,font:bold,color:rgb(.08,.22,.16)});y-=42
  line(`Original: ${result.original.fileName}`,10,bold)
  line(`Revisado: ${result.revised.fileName}`,10,bold)
  line(`Paginas: ${result.original.pageCount} -> ${result.revised.pageCount}`)
  line(`Diferencas: ${result.summary.totalDifferences} | Modificadas: ${result.summary.modified} | Adicionadas: ${result.summary.added} | Removidas: ${result.summary.removed} | Sem alteracao: ${result.summary.unchanged}`)
  line(`Comparacao visual: ${result.visualCompared?'sim':'nao'} | Tempo: ${(result.durationMs/1000).toFixed(1)} s`)
  y-=8
  page.drawText('Detalhes',{x:margin,y:y-15,size:14,font:bold,color:rgb(.08,.22,.16)});y-=30
  const differences=result.pages.filter(item=>item.status!=='unchanged')
  if(differences.length===0) line('Nenhuma diferenca encontrada nos criterios analisados.',10)
  for(const item of differences){
    ensure(78)
    const pageLabel=item.status==='added'
      ? `ADICIONADA - revisado p. ${item.revisedPage}`
      : item.status==='removed'
        ? `REMOVIDA - original p. ${item.originalPage}`
        : `MODIFICADA - original p. ${item.originalPage} -> revisado p. ${item.revisedPage}`
    line(pageLabel,10,bold)
    if(item.visualDifference!==null) line(`Diferenca visual estimada: ${item.visualDifference.toFixed(2)}%`,9,regular,10)
    if(item.textChange.addedWords||item.textChange.removedWords) line(`Texto: +${item.textChange.addedWords} palavra(s), -${item.textChange.removedWords} palavra(s)`,9,regular,10)
    if(item.textChange.removedSnippet) line(`Removido: ${item.textChange.removedSnippet}`,8,regular,10)
    if(item.textChange.addedSnippet) line(`Adicionado: ${item.textChange.addedSnippet}`,8,regular,10)
    y-=5
  }
  return doc.save({useObjectStreams:true})
}
