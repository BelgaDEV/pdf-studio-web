import { nextFrame } from './files'

/**
 * Word → PDF preservando o layout, 100% no navegador.
 *
 * 1. docx-preview (Apache-2.0) monta o documento página por página, com
 *    tamanho de página, margens, cabeçalho/rodapé, tabelas, imagens, formas e
 *    caixas de texto. As quebras de página seguem as que o Word salvou.
 * 2. Cada página é capturada como imagem (html2canvas) e vira uma página do PDF
 *    com o mesmo tamanho.
 * 3. Por cima vai uma camada de texto invisível na posição de cada palavra:
 *    o PDF fica pesquisável e o texto pode ser selecionado e copiado.
 */

type ProgressFn = (value: number, message: string) => void

const CAPTURE_SCALE = 2
const PX_TO_PT = 72 / 96

function lengthToPx(value: string): number | null {
  const match = /^([\d.]+)(pt|px|cm|mm|in)?$/.exec(value.trim())
  if (!match) return null
  const n = parseFloat(match[1])
  switch (match[2]) {
    case 'pt': return n * 96 / 72
    case 'cm': return n * 96 / 2.54
    case 'mm': return n * 96 / 25.4
    case 'in': return n * 96
    default: return n
  }
}

/** Remove qualquer coisa ativa que um DOCX malicioso pudesse trazer. */
function neutralize(root: HTMLElement) {
  root.querySelectorAll('script, iframe, object, embed, link[rel="import"]').forEach(el => el.remove())
  root.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
      if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
}

type WordBox = { text: string; x: number; y: number; w: number; h: number }

/** Posição de cada palavra visível da página, relativa ao topo da página. */
function collectWords(page: HTMLElement, origin: DOMRect): WordBox[] {
  const words: WordBox[] = []
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? ''
    if (!text.trim()) continue
    const parent = node.parentElement
    if (parent) {
      const style = getComputedStyle(parent)
      if (style.visibility === 'hidden' || style.display === 'none') continue
    }
    const re = /\S+/g
    for (let m = re.exec(text); m; m = re.exec(text)) {
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      const rect = range.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      words.push({ text: m[0], x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height })
    }
  }
  return words
}

/**
 * O docx-preview usa variáveis CSS para as fontes do tema do Word, que o
 * html2canvas não resolve (o texto cairia em Times). Gravamos a fonte final.
 */
function inlineFonts(root: HTMLElement, fontStack: (font: string) => string) {
  root.querySelectorAll<HTMLElement>('*').forEach(el => {
    const family = getComputedStyle(el).fontFamily
    if (!family) return
    // Mantém a fonte pedida pelo documento e acrescenta reservas parecidas.
    const first = family.split(',')[0].trim().replace(/^["']|["']$/g, '')
    el.style.fontFamily = /sans-serif|serif|monospace/.test(family) ? family : fontStack(first)
  })
}

/** Página só com cabeçalho/rodapé (quebra de página duplicada) é descartada. */
function hasContent(page: HTMLElement): boolean {
  const article = page.querySelector('article') ?? page
  if ((article.textContent ?? '').replace(/\s/g, '').length > 0) return true
  if (article.querySelector('img, svg, table, .lauda-shape')) return true
  return page.querySelector(':scope > .lauda-shape') !== null
}

/** Junta palavras da mesma linha, para copiar/colar sair com espaços. */
function groupLines(words: WordBox[]): WordBox[] {
  const sorted = [...words].sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.4 ? a.x - b.x : a.y - b.y))
  const lines: WordBox[] = []
  for (const w of sorted) {
    const last = lines[lines.length - 1]
    const gap = last ? w.x - (last.x + last.w) : Infinity
    if (last && Math.abs(last.y - w.y) < Math.min(last.h, w.h) * 0.4 && gap > -2 && gap < w.h * 1.6) {
      const right = Math.max(last.x + last.w, w.x + w.w)
      last.text += ' ' + w.text
      last.y = Math.min(last.y, w.y)
      last.h = Math.max(last.h, w.h)
      last.w = right - last.x
    } else {
      lines.push({ ...w })
    }
  }
  return lines
}

export async function wordToPdfLayout(file: File, onProgress: ProgressFn): Promise<Blob> {
  onProgress(4, 'Carregando conversor Word…')
  const [{ renderAsync }, { default: html2canvas }, { PDFDocument, StandardFonts }] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
    import('pdf-lib'),
  ])

  onProgress(10, 'Montando as páginas do documento…')
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', background: '#fff' })
  const styleHost = document.createElement('div')
  host.appendChild(styleHost)
  const body = document.createElement('div')
  host.appendChild(body)
  document.body.appendChild(host)

  try {
    const { extractShapes, placeShapes, fontStack } = await import('./docxShapes')
    const { buffer, shapes, fonts } = await extractShapes(await file.arrayBuffer())
    await renderAsync(buffer, body, styleHost, {
      inWrapper: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderChanges: false,
      renderComments: false,
      renderAltChunks: false,
      useBase64URL: true,
    })
    neutralize(body)
    placeShapes(body, shapes, fonts)
    if (document.fonts?.ready) await document.fonts.ready
    inlineFonts(body, fontStack)
    // Espera as imagens embutidas decodificarem antes de capturar.
    await Promise.all(Array.from(body.querySelectorAll('img')).map(img => img.decode().catch(() => {})))
    await nextFrame()

    const pages = Array.from(body.querySelectorAll<HTMLElement>('section.docx')).filter(hasContent)
    if (pages.length === 0) throw new Error('Não foi possível montar as páginas deste documento.')

    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)

    for (let index = 0; index < pages.length; index++) {
      const page = pages[index]
      onProgress(15 + Math.round((index / pages.length) * 78), `Criando PDF: página ${index + 1}/${pages.length}…`)
      const rect = page.getBoundingClientRect()
      const pageWidthPx = rect.width
      const declaredHeight = lengthToPx(page.style.minHeight || '') ?? pageWidthPx * 297 / 210
      const pageHeightPx = Math.max(1, declaredHeight)
      const contentHeightPx = Math.max(pageHeightPx, rect.height)

      const canvas = await html2canvas(page, {
        scale: CAPTURE_SCALE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: Math.ceil(pageWidthPx),
        height: Math.ceil(contentHeightPx),
        windowWidth: Math.ceil(pageWidthPx) + 200,
      })
      const words = groupLines(collectWords(page, rect))

      // Se o conteúdo passou da altura da página (documento sem quebras salvas),
      // divide em quantas páginas forem necessárias.
      const slices = Math.max(1, Math.ceil(contentHeightPx / pageHeightPx - 0.02))
      for (let s = 0; s < slices; s++) {
        const top = s * pageHeightPx
        const sliceHeightPx = Math.min(pageHeightPx, contentHeightPx - top)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = Math.ceil(pageHeightPx * CAPTURE_SCALE)
        const ctx = slice.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, slice.width, slice.height)
        ctx.drawImage(canvas, 0, Math.round(top * CAPTURE_SCALE), canvas.width, Math.round(sliceHeightPx * CAPTURE_SCALE), 0, 0, canvas.width, Math.round(sliceHeightPx * CAPTURE_SCALE))
        const jpeg = await new Promise<Uint8Array>((resolve, reject) => slice.toBlob(async blob => {
          if (!blob) return reject(new Error('Falha ao gerar a imagem da página.'))
          resolve(new Uint8Array(await blob.arrayBuffer()))
        }, 'image/jpeg', 0.92))
        slice.width = 1
        slice.height = 1

        const widthPt = pageWidthPx * PX_TO_PT
        const heightPt = pageHeightPx * PX_TO_PT
        const pdfPage = pdf.addPage([widthPt, heightPt])
        pdfPage.drawImage(await pdf.embedJpg(jpeg), { x: 0, y: 0, width: widthPt, height: heightPt })

        // Camada de texto invisível (seleção e busca).
        for (const word of words) {
          if (word.y + word.h <= top || word.y >= top + pageHeightPx) continue
          let text = word.text
          try { font.encodeText(text) } catch { text = text.replace(/[^\x20-\x7E -ÿ]/g, '?') }
          const base = font.widthOfTextAtSize(text, 1)
          if (!base) continue
          const size = Math.min((word.h * PX_TO_PT) * 0.8, (word.w * PX_TO_PT) / base)
          if (!(size > 0.5)) continue
          try {
            pdfPage.drawText(text, {
              x: word.x * PX_TO_PT,
              y: heightPt - (word.y - top + word.h * 0.8) * PX_TO_PT,
              size,
              font,
              opacity: 0,
            })
          } catch { /* caractere sem suporte na fonte padrão: fica só na imagem */ }
        }
      }
      canvas.width = 1
      canvas.height = 1
      await nextFrame()
    }

    onProgress(96, 'Finalizando PDF…')
    const bytes = await pdf.save({ useObjectStreams: true })
    onProgress(100, 'Concluído.')
    return new Blob([bytes], { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}
