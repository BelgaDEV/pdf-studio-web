import { nextFrame } from './files'

/**
 * PDF → Word preservando o layout.
 *
 * Para cada página:
 * 1. Renderiza a página (PDF.js) e lê a posição, o tamanho e a fonte de cada
 *    trecho de texto.
 * 2. Renderiza a página de novo SEM o texto. Sobram caixas, linhas,
 *    sublinhados, cores, logotipos e QR codes. Se algum texto for desenhado
 *    como forma (fontes especiais), aquela área é apagada com a cor do fundo.
 * 3. Monta uma seção do Word do mesmo tamanho da página: essa imagem vai atrás
 *    do texto, e cada linha de texto vira um quadro editável na posição
 *    original, com tamanho, cor, negrito e itálico próximos do original. O
 *    espaçamento entre letras é ajustado para cada trecho ocupar a mesma
 *    largura do PDF, o que mantém o alinhamento de textos justificados.
 *
 * Resultado: visual muito próximo do PDF e texto editável no Word.
 */

type ProgressFn = (value: number, message: string) => void

const RENDER_SCALE = 2 // 144 DPI: nítido e com tamanho de arquivo razoável
const PT_TO_TWIP = 20
const PT_TO_PX = 96 / 72

type TextLine = {
  text: string
  x: number // pt, a partir da esquerda
  top: number // pt, topo da linha
  width: number // pt
  size: number // pt
  font: string
  bold: boolean
  italic: boolean
  color: string // hex sem #
  spacing: number // twips entre letras, para igualar a largura do PDF
}

type RawItem = {
  str: string
  x: number
  baseline: number
  width: number
  size: number
  fontName: string
}

function fontInfo(page: any, fontName: string, styles: Record<string, { fontFamily?: string }>) {
  let name = ''
  try { name = String(page.commonObjs.get(fontName)?.name ?? '') } catch { /* fonte ainda não carregada */ }
  const lower = `${name} ${styles[fontName]?.fontFamily ?? ''}`.toLowerCase()
  const bold = /bold|black|heavy|semibold|demi/.test(lower)
  const italic = /italic|oblique/.test(lower)
  let font = 'Arial'
  if (/times|serif(?!-)|georgia|garamond|cambria|roman/.test(lower) && !/sans/.test(lower)) font = 'Times New Roman'
  if (/courier|mono/.test(lower)) font = 'Courier New'
  if (/calibri/.test(lower)) font = 'Calibri'
  if (/verdana/.test(lower)) font = 'Verdana'
  if (/tahoma/.test(lower)) font = 'Tahoma'
  return { font, bold, italic }
}

function toHex(r: number, g: number, b: number) {
  return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/** Cor de fundo mais frequente na borda externa de um retângulo. */
function sampleBackground(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number): [number, number, number] {
  const counts = new Map<string, { n: number; rgb: [number, number, number] }>()
  const take = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]]
    const key = rgb.map(v => v >> 3).join(',')
    const entry = counts.get(key)
    if (entry) entry.n++
    else counts.set(key, { n: 1, rgb })
  }
  const steps = 12
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps)
    const y = Math.round(y0 + ((y1 - y0) * s) / steps)
    take(x, y0 - 2); take(x, y1 + 2); take(x0 - 2, y); take(x1 + 2, y)
  }
  let best: { n: number; rgb: [number, number, number] } = { n: 0, rgb: [255, 255, 255] }
  for (const entry of counts.values()) if (entry.n > best.n) best = entry
  return best.rgb
}

/** Cor do texto: o pixel dentro da caixa mais distante da cor de fundo. */
function sampleTextColor(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number, bg: [number, number, number]): string {
  let bestDist = -1
  let best: [number, number, number] = [0, 0, 0]
  const stepX = Math.max(1, Math.floor((x1 - x0) / 60))
  const stepY = Math.max(1, Math.floor((y1 - y0) / 12))
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y += stepY) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x += stepX) {
      const i = (y * w + x) * 4
      const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2])
      if (d > bestDist) { bestDist = d; best = [data[i], data[i + 1], data[i + 2]] }
    }
  }
  return bestDist < 60 ? '000000' : toHex(...best)
}

/** Junta trechos vizinhos na mesma linha com a mesma fonte. */
function mergeItems(items: RawItem[]): RawItem[] {
  const sorted = [...items].sort((a, b) => (Math.abs(a.baseline - b.baseline) < Math.max(a.size, b.size) * 0.35 ? a.x - b.x : a.baseline - b.baseline))
  const out: RawItem[] = []
  for (const original of sorted) {
    // Texto com letras espaçadas ("E S C R I T Ó R I O"): o PDF.js insere espaços
    // entre as letras; removemos, e o espaçamento volta pelo ajuste de largura.
    const item = /^(\S ){2,}\S$/.test(original.str) ? { ...original, str: original.str.replace(/ /g, '') } : original
    const last = out[out.length - 1]
    if (last
      && last.fontName === item.fontName
      && Math.abs(last.size - item.size) < 0.5
      && Math.abs(last.baseline - item.baseline) < item.size * 0.35) {
      const gap = item.x - (last.x + last.width)
      if (gap > -item.size * 0.3 && gap < item.size * 0.9) {
        const needsSpace = gap > item.size * 0.12 && !last.str.endsWith(' ') && !item.str.startsWith(' ')
        last.str += (needsSpace ? ' ' : '') + item.str
        last.width = item.x + item.width - last.x
        continue
      }
    }
    out.push({ ...item })
  }
  return out
}

const fontAvailability = new Map<string, boolean>()
let measureCtx: CanvasRenderingContext2D | null = null

function measurer(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!
  return measureCtx
}

/** A fonte existe neste computador? (Compara com a largura da fonte genérica.) */
function fontInstalled(font: string): boolean {
  const cached = fontAvailability.get(font)
  if (cached !== undefined) return cached
  const ctx = measurer()
  const sample = 'mmmmmmmmmmlliWWW 0123456789'
  let installed = false
  for (const generic of ['monospace', 'serif']) {
    ctx.font = `40px ${generic}`
    const base = ctx.measureText(sample).width
    ctx.font = `40px "${font}", ${generic}`
    if (Math.abs(ctx.measureText(sample).width - base) > 0.5) { installed = true; break }
  }
  fontAvailability.set(font, installed)
  return installed
}

/** Espaçamento (twips) para o texto ocupar `targetWidth` pt na fonte do Word. */
function fitSpacing(text: string, font: string, size: number, bold: boolean, italic: boolean, targetWidth: number): number {
  if (text.length < 2 || !fontInstalled(font)) return 0
  // Sem fonte equivalente no computador, não dá para medir com segurança.
  const ctx = measurer()
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px "${font}"`
  const measured = ctx.measureText(text).width
  const twips = Math.round(((targetWidth - measured) / text.length) * 20)
  return Math.max(Math.round(-size * 3), Math.min(Math.round(size * 12), twips))
}

/** Faz o contexto ignorar desenho de texto (para obter só o fundo da página). */
function suppressText(ctx: CanvasRenderingContext2D) {
  const noop = () => {}
  Object.defineProperty(ctx, 'fillText', { value: noop, configurable: true, writable: true })
  Object.defineProperty(ctx, 'strokeText', { value: noop, configurable: true, writable: true })
}

/** Fração da caixa que ainda parece texto (pixels diferentes do fundo). */
function inkRatio(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number, bg: [number, number, number]): number {
  let ink = 0
  let total = 0
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y += 2) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x += 2) {
      const i = (y * w + x) * 4
      total++
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 90) ink++
    }
  }
  return total ? ink / total : 0
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async blob => {
    if (!blob) return reject(new Error('Falha ao gerar a imagem da página.'))
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, 'image/jpeg', 0.9))
}

export async function pdfToWordLayout(file: File, onProgress: ProgressFn): Promise<Blob> {
  onProgress(3, 'Carregando conversor Word…')
  const [docx, { loadPdfJsDocument, destroyPdfJsDocument, pdfjsLib }] = await Promise.all([
    import('docx'),
    import('./pdfjsSecure'),
  ])
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, FrameAnchorType,
    HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, LineRuleType,
  } = docx

  const pdf = await loadPdfJsDocument(file)
  const sections: any[] = []
  let textChars = 0
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress(5 + Math.round(((pageNumber - 1) / pdf.numPages) * 85), `Analisando página ${pageNumber}/${pdf.numPages}…`)
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: RENDER_SCALE })

      const newCanvas = () => {
        const c = document.createElement('canvas')
        c.width = Math.ceil(viewport.width)
        c.height = Math.ceil(viewport.height)
        const context = c.getContext('2d', { willReadFrequently: true })!
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, c.width, c.height)
        return { c, context }
      }
      // Página completa: usada para descobrir a cor de cada texto.
      const full = newCanvas()
      await page.render({ canvasContext: full.context, viewport, canvas: full.c } as any).promise
      // Página sem texto: vira o fundo do Word (preserva sublinhados e linhas).
      const { c: canvas, context: ctx } = newCanvas()
      suppressText(ctx)
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise

      const content = await page.getTextContent()
      const raw: RawItem[] = []
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue
        const t = pdfjsLib.Util.transform(base.transform, item.transform)
        // Texto girado fica só na imagem de fundo.
        if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue
        const size = Math.hypot(t[2], t[3]) || Math.abs(t[0])
        if (size < 2) continue
        raw.push({ str: item.str, x: t[4], baseline: t[5], width: item.width, size, fontName: item.fontName })
      }

      const fullImage = full.context.getImageData(0, 0, canvas.width, canvas.height)
      const bareImage = ctx.getImageData(0, 0, canvas.width, canvas.height)
      full.c.width = 1
      full.c.height = 1
      const lines: TextLine[] = []
      for (const item of mergeItems(raw)) {
        const s = RENDER_SCALE
        const x0 = Math.floor(item.x * s) - 1
        const y0 = Math.floor((item.baseline - item.size * 0.9) * s) - 1
        const x1 = Math.ceil((item.x + item.width) * s) + 1
        // Vai só um pouco abaixo da linha de base: não alcança sublinhados.
        const yGlyph = Math.ceil((item.baseline + item.size * 0.08) * s)
        const bg = sampleBackground(bareImage.data, canvas.width, canvas.height, x0, y0, x1, yGlyph)
        const color = sampleTextColor(fullImage.data, canvas.width, canvas.height, x0, y0, x1, yGlyph, bg)
        // Texto desenhado como forma (não foi suprimido): apaga só a área dos glifos.
        if (inkRatio(bareImage.data, canvas.width, canvas.height, x0, y0, x1, yGlyph, bg) > 0.08) {
          ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`
          ctx.fillRect(x0, y0, x1 - x0, yGlyph - y0)
        }
        const info = fontInfo(page, item.fontName, content.styles as any)
        const text = item.str.replace(/\s+/g, ' ')
        lines.push({
          text,
          x: item.x,
          top: item.baseline - item.size * 0.9,
          width: item.width,
          size: item.size,
          color,
          // Pequena folga: a fonte do Word costuma sair um pouco mais larga.
          spacing: fitSpacing(text, info.font, item.size, info.bold, info.italic, item.width - item.size * 0.1),
          ...info,
        })
        textChars += item.str.length
      }

      const background = await canvasToJpeg(canvas)
      canvas.width = 1
      canvas.height = 1

      const children: any[] = [
        new Paragraph({
          spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
          children: [new ImageRun({
            type: 'jpg',
            data: background,
            transformation: { width: Math.round(base.width * PT_TO_PX), height: Math.round(base.height * PT_TO_PX) },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
              behindDocument: true,
              allowOverlap: true,
            },
          })],
        }),
      ]

      for (const line of lines) {
        const lineHeight = Math.round(line.size * 1.2 * PT_TO_TWIP)
        children.push(new Paragraph({
          frame: {
            type: 'absolute',
            position: { x: Math.round(line.x * PT_TO_TWIP), y: Math.round(line.top * PT_TO_TWIP) },
            // Folga para diferenças de métrica entre a fonte do PDF e a do Word.
            width: Math.round((line.width + line.size * 0.6 + (line.spacing === 0 ? line.width * 0.12 : 0)) * PT_TO_TWIP),
            height: lineHeight,
            anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
          },
          spacing: { before: 0, after: 0, line: lineHeight, lineRule: LineRuleType.EXACT },
          children: [new TextRun({
            text: line.text,
            size: Math.max(2, Math.round(line.size * 2)),
            font: line.font,
            bold: line.bold,
            italics: line.italic,
            color: line.color,
            characterSpacing: line.spacing || undefined,
          })],
        }))
      }

      sections.push({
        properties: {
          page: {
            size: { width: Math.round(base.width * PT_TO_TWIP), height: Math.round(base.height * PT_TO_TWIP) },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children,
      })
      await nextFrame()
    }
  } finally {
    await destroyPdfJsDocument(pdf)
  }

  onProgress(92, 'Montando documento Word…')
  const doc = new Document({ sections })
  const blob = await Packer.toBlob(doc)
  onProgress(100, textChars > 0 ? 'DOCX criado preservando o layout.' : 'DOCX criado. O PDF não tem texto selecionável; use o OCR antes para poder editar o texto.')
  return blob
}
