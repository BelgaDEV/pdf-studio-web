/**
 * Suporte a formas e caixas de texto do Word (DrawingML "wps") para o
 * conversor Word → PDF. O docx-preview não desenha essas formas, então:
 *
 * 1. extractShapes() lê cada forma ancorada do document.xml (posição,
 *    tamanho, preenchimento, borda e o texto de dentro) e troca a forma por
 *    um marcador invisível no mesmo parágrafo.
 * 2. Depois que as páginas são montadas, placeShapes() acha o marcador (e
 *    portanto a página e o parágrafo da âncora) e desenha a forma por cima
 *    da página na posição calculada como o Word faz.
 */

const EMU_PER_PX = 9525
const MARK_START = ''
const MARK_END = ''

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; sizePt: number | null; color: string | null; font: string | null; br?: boolean }
type Para = { align: string; runs: Run[] }

export type ShapeSpec = {
  id: number
  widthPx: number
  heightPx: number
  hRelative: string
  hOffsetPx: number | null
  hAlign: string | null
  vRelative: string
  vOffsetPx: number | null
  vAlign: string | null
  behind: boolean
  inline: boolean
  fill: string | null
  stroke: string | null
  strokePx: number
  radiusPx: number
  paragraphs: Para[]
  insets: [number, number, number, number] // top, right, bottom, left (px)
  vAnchor: 'top' | 'middle' | 'bottom'
  rotation: number
  /** Ordem de empilhamento do Word (maior = mais à frente). */
  z: number
}

function children(el: Element, local: string): Element[] {
  return Array.from(el.children).filter(c => c.localName === local)
}
function child(el: Element | null | undefined, local: string): Element | null {
  return el ? children(el, local)[0] ?? null : null
}
function desc(el: Element | null | undefined, local: string): Element | null {
  return el ? el.getElementsByTagNameNS('*', local)[0] ?? null : null
}
function attr(el: Element | null | undefined, local: string): string | null {
  if (!el) return null
  for (const a of Array.from(el.attributes)) if (a.localName === local) return a.value
  return null
}

type Theme = Record<string, string>

/** Fontes do tema (corpo e títulos), para resolver "+mn-lt" e "+mj-lt". */
export type ThemeFonts = { minor: string; major: string }

export function parseThemeFonts(xml: string | null): ThemeFonts {
  const minor = xml?.match(/<a:minorFont>\s*<a:latin typeface="([^"]*)"/)?.[1] || 'Calibri'
  const major = xml?.match(/<a:majorFont>\s*<a:latin typeface="([^"]*)"/)?.[1] || minor
  return { minor, major }
}

function parseTheme(xml: string | null): Theme {
  const theme: Theme = {}
  if (!xml) return theme
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const scheme = desc(doc.documentElement, 'clrScheme')
  if (!scheme) return theme
  for (const entry of Array.from(scheme.children)) {
    const srgb = desc(entry, 'srgbClr')
    const sys = desc(entry, 'sysClr')
    const value = attr(srgb, 'val') ?? attr(sys, 'lastClr')
    if (value) theme[entry.localName] = value
  }
  theme.tx1 = theme.dk1 ?? '000000'; theme.bg1 = theme.lt1 ?? 'FFFFFF'
  theme.tx2 = theme.dk2 ?? '44546A'; theme.bg2 = theme.lt2 ?? 'E7E6E6'
  return theme
}

function applyMods(hex: string, el: Element): string {
  let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const mod = (name: string) => { const v = attr(child(el, name), 'val'); return v ? parseInt(v, 10) / 100000 : null }
  const lumMod = mod('lumMod'); const lumOff = mod('lumOff'); const tint = mod('tint'); const shade = mod('shade')
  if (lumMod !== null || lumOff !== null) {
    // Ajuste de luminosidade aproximado no espaço RGB.
    const m = lumMod ?? 1; const o = lumOff ?? 0
    ;[r, g, b] = [r, g, b].map(c => Math.min(1, c * m + o))
  }
  if (tint !== null) [r, g, b] = [r, g, b].map(c => 1 - (1 - c) * tint)
  if (shade !== null) [r, g, b] = [r, g, b].map(c => c * shade)
  return [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
}

function colorOf(fillHolder: Element | null, theme: Theme): string | null {
  if (!fillHolder) return null
  const solid = fillHolder.localName === 'solidFill' ? fillHolder : child(fillHolder, 'solidFill')
  if (!solid) return null
  const srgb = child(solid, 'srgbClr')
  if (srgb) return '#' + applyMods(attr(srgb, 'val') ?? '000000', srgb)
  const scheme = child(solid, 'schemeClr')
  if (scheme) {
    const base = theme[attr(scheme, 'val') ?? ''] ?? '000000'
    return '#' + applyMods(base, scheme)
  }
  return null
}

function parseRun(r: Element): Run[] {
  const rPr = child(r, 'rPr')
  const on = (name: string) => { const e = child(rPr, name); return !!e && attr(e, 'val') !== '0' && attr(e, 'val') !== 'false' }
  const sz = attr(child(rPr, 'sz'), 'val')
  const color = attr(child(rPr, 'color'), 'val')
  const font = attr(child(rPr, 'rFonts'), 'ascii')
  const base = {
    bold: on('b'), italic: on('i'),
    underline: !!child(rPr, 'u') && attr(child(rPr, 'u'), 'val') !== 'none',
    sizePt: sz ? parseInt(sz, 10) / 2 : null,
    color: color && color !== 'auto' ? '#' + color : null,
    font,
  }
  const out: Run[] = []
  for (const c of Array.from(r.children)) {
    if (c.localName === 't') out.push({ ...base, text: c.textContent ?? '' })
    else if (c.localName === 'tab') out.push({ ...base, text: ' ' })
    else if (c.localName === 'br') out.push({ ...base, text: '', br: true })
  }
  return out
}

function parseParagraphs(container: Element): Para[] {
  return children(container, 'p').map(p => {
    const jc = attr(child(child(p, 'pPr'), 'jc'), 'val') ?? 'left'
    const runs: Run[] = []
    for (const c of Array.from(p.children)) {
      if (c.localName === 'r') runs.push(...parseRun(c))
      else if (c.localName === 'hyperlink') children(c, 'r').forEach(r => runs.push(...parseRun(r)))
    }
    return { align: jc === 'both' ? 'justify' : jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : 'left', runs }
  })
}

function emuToPx(value: string | null): number | null {
  if (value === null) return null
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n / EMU_PER_PX : null
}

/** Lê as formas, troca por marcadores e devolve o DOCX modificado. */
export async function extractShapes(buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; shapes: ShapeSpec[]; fonts: ThemeFonts }> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const docFile = zip.file('word/document.xml')
  const themeXml = await zip.file('word/theme/theme1.xml')?.async('string') ?? null
  const fonts = parseThemeFonts(themeXml)
  if (!docFile) return { buffer, shapes: [], fonts }
  const xml = await docFile.async('string')
  if (!/wps:wsp|<wps:/.test(xml)) return { buffer, shapes: [], fonts }

  const theme = parseTheme(themeXml)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return { buffer, shapes: [], fonts }

  const shapes: ShapeSpec[] = []
  const drawings = Array.from(doc.getElementsByTagNameNS('*', 'drawing'))
  for (const drawing of drawings) {
    const holder = child(drawing, 'anchor') ?? child(drawing, 'inline')
    const wsp = desc(holder, 'wsp')
    // Só formas simples (não imagens, não grupos dentro de tabelas aninhadas complexas).
    if (!holder || !wsp || desc(holder, 'pic')) continue

    const extent = child(holder, 'extent')
    const posH = child(holder, 'positionH')
    const posV = child(holder, 'positionV')
    const spPr = child(wsp, 'spPr')
    const geom = attr(child(spPr, 'prstGeom'), 'prst') ?? 'rect'
    const ln = child(spPr, 'ln')
    const bodyPr = child(wsp, 'bodyPr')
    const txbx = child(wsp, 'txbx')
    const content = desc(txbx, 'txbxContent')
    const xfrm = child(spPr, 'xfrm')
    const noFill = !!child(spPr, 'noFill')
    const insetPx = (name: string, fallback: number) => emuToPx(attr(bodyPr, name)) ?? fallback
    const anchorV = attr(bodyPr, 'anchor')

    const spec: ShapeSpec = {
      id: shapes.length,
      widthPx: emuToPx(attr(extent, 'cx')) ?? 0,
      heightPx: emuToPx(attr(extent, 'cy')) ?? 0,
      hRelative: attr(posH, 'relativeFrom') ?? 'column',
      hOffsetPx: emuToPx(child(posH, 'posOffset')?.textContent ?? null),
      hAlign: child(posH, 'align')?.textContent ?? null,
      vRelative: attr(posV, 'relativeFrom') ?? 'paragraph',
      vOffsetPx: emuToPx(child(posV, 'posOffset')?.textContent ?? null),
      vAlign: child(posV, 'align')?.textContent ?? null,
      behind: attr(holder, 'behindDoc') === '1' || attr(holder, 'behindDoc') === 'true',
      inline: holder.localName === 'inline',
      fill: noFill ? null : colorOf(spPr, theme) ?? colorOf(desc(child(wsp, 'style'), 'fillRef'), theme),
      stroke: child(ln, 'noFill') ? null : colorOf(ln, theme) ?? (ln ? null : colorOf(desc(child(wsp, 'style'), 'lnRef'), theme)),
      strokePx: (emuToPx(attr(ln, 'w')) ?? 1),
      radiusPx: geom === 'roundRect' ? 10 : geom === 'ellipse' ? 9999 : 0,
      paragraphs: content ? parseParagraphs(content) : [],
      insets: [insetPx('tIns', 4.8), insetPx('rIns', 9.6), insetPx('bIns', 4.8), insetPx('lIns', 9.6)],
      vAnchor: anchorV === 'ctr' ? 'middle' : anchorV === 'b' ? 'bottom' : 'top',
      rotation: (parseInt(attr(xfrm, 'rot') ?? '0', 10) || 0) / 60000,
      z: parseInt(attr(holder, 'relativeHeight') ?? '0', 10) || 0,
    }
    shapes.push(spec)

    // Troca a forma (ou o bloco AlternateContent que a contém) por um marcador.
    let target: Element = drawing
    for (let e = drawing.parentElement; e; e = e.parentElement) {
      if (e.localName === 'AlternateContent') { target = e; break }
      if (e.localName === 'p') break
    }
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    const t = doc.createElementNS(W, 'w:t')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = `${MARK_START}${spec.id}${MARK_END}`
    target.parentNode?.replaceChild(t, target)
  }

  if (!shapes.length) return { buffer, shapes, fonts }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))
  return { buffer: await zip.generateAsync({ type: 'arraybuffer' }), shapes, fonts }
}

/** Família com reservas: Aptos e outras fontes novas do Office não existem no navegador. */
export function fontStack(font: string): string {
  const serif = /times|georgia|garamond|cambria|book antiqua|palatino|serif/i.test(font) && !/sans/i.test(font)
  return serif
    ? `"${font}", "Times New Roman", Tinos, Georgia, serif`
    : `"${font}", Aptos, Calibri, Carlito, "Segoe UI", Arial, sans-serif`
}

function pxStyle(value: number) { return `${Math.round(value * 100) / 100}px` }

function resolveFont(font: string | null, fonts: ThemeFonts): string {
  if (!font || font === '+mn-lt' || font.startsWith('+mn')) return fonts.minor
  if (font === '+mj-lt' || font.startsWith('+mj')) return fonts.major
  return font
}

function renderShape(spec: ShapeSpec, fonts: ThemeFonts): HTMLElement {
  const box = document.createElement('div')
  box.className = 'lauda-shape'
  Object.assign(box.style, {
    position: 'absolute',
    width: pxStyle(spec.widthPx),
    height: pxStyle(spec.heightPx),
    boxSizing: 'border-box',
    background: spec.fill ?? 'transparent',
    border: spec.stroke ? `${Math.max(0.75, spec.strokePx)}px solid ${spec.stroke}` : 'none',
    borderRadius: spec.radiusPx ? pxStyle(Math.min(spec.radiusPx, spec.heightPx / 2, spec.widthPx / 2)) : '0',
    padding: spec.insets.map(pxStyle).join(' '),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: spec.vAnchor === 'middle' ? 'center' : spec.vAnchor === 'bottom' ? 'flex-end' : 'flex-start',
    overflow: 'hidden',
    zIndex: spec.behind ? '-1' : '2',
    transform: spec.rotation ? `rotate(${spec.rotation}deg)` : '',
    fontFamily: fontStack(fonts.minor),
    fontSize: '11pt',
    lineHeight: '1.15',
    color: '#000',
  } as Partial<CSSStyleDeclaration>)
  for (const para of spec.paragraphs) {
    const p = document.createElement('div')
    p.style.textAlign = para.align
    p.style.minHeight = '1em'
    for (const run of para.runs) {
      if (run.br) { p.appendChild(document.createElement('br')); continue }
      const span = document.createElement('span')
      span.textContent = run.text
      if (run.bold) span.style.fontWeight = '700'
      if (run.italic) span.style.fontStyle = 'italic'
      if (run.underline) span.style.textDecoration = 'underline'
      if (run.sizePt) span.style.fontSize = `${run.sizePt}pt`
      if (run.color) span.style.color = run.color
      if (run.font) span.style.fontFamily = fontStack(resolveFont(run.font, fonts))
      p.appendChild(span)
    }
    box.appendChild(p)
  }
  return box
}

/** Desenha as formas nas páginas já montadas pelo docx-preview. */
export function placeShapes(body: HTMLElement, shapes: ShapeSpec[], fonts: ThemeFonts) {
  if (!shapes.length) return
  const byId = new Map(shapes.map(s => [s.id, s]))
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const markers: Array<{ node: Text; index: number; id: number }> = []
  const re = new RegExp(`${MARK_START}(\\d+)${MARK_END}`, 'g')
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const value = n.nodeValue ?? ''
    if (!value.includes(MARK_START)) continue
    re.lastIndex = 0
    for (let m = re.exec(value); m; m = re.exec(value)) markers.push({ node: n, index: m.index, id: parseInt(m[1], 10) })
  }

  type Placement = { spec: ShapeSpec; page: HTMLElement; anchorRect: DOMRect; paraRect: DOMRect }
  const placements: Placement[] = []
  const range = document.createRange()
  for (const marker of markers) {
    const spec = byId.get(marker.id)
    const page = marker.node.parentElement?.closest('section.docx') as HTMLElement | null
    if (!spec || !page) continue
    range.setStart(marker.node, marker.index)
    range.setEnd(marker.node, marker.index + 1)
    const anchorRect = range.getBoundingClientRect()
    const para = marker.node.parentElement?.closest('p') ?? marker.node.parentElement!
    placements.push({ spec, page, anchorRect, paraRect: para.getBoundingClientRect() })
  }

  // Remove os marcadores antes de desenhar (não podem aparecer no PDF).
  for (const node of new Set(markers.map(m => m.node))) node.nodeValue = (node.nodeValue ?? '').replace(re, '')

  // Desenha na ordem de empilhamento do Word: quem vem depois fica na frente.
  placements.sort((a, b) => a.spec.z - b.spec.z)
  for (const { spec, page, anchorRect, paraRect } of placements) {
    const pageRect = page.getBoundingClientRect()
    const cs = getComputedStyle(page)
    const margin = { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0, top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
    const pageW = pageRect.width
    const pageH = parseFloat(page.style.minHeight) ? page.getBoundingClientRect().height : pageRect.height

    const hBase = (() => {
      switch (spec.hRelative) {
        case 'page': return { start: 0, size: pageW }
        case 'leftMargin': return { start: 0, size: margin.left }
        case 'rightMargin': return { start: pageW - margin.right, size: margin.right }
        case 'character': return { start: anchorRect.left - pageRect.left, size: pageW - margin.left - margin.right }
        default: return { start: margin.left, size: pageW - margin.left - margin.right } // margin, column
      }
    })()
    const vBase = (() => {
      switch (spec.vRelative) {
        case 'page': return { start: 0, size: pageH }
        case 'topMargin': return { start: 0, size: margin.top }
        case 'bottomMargin': return { start: pageH - margin.bottom, size: margin.bottom }
        case 'margin': return { start: margin.top, size: pageH - margin.top - margin.bottom }
        case 'line': return { start: anchorRect.top - pageRect.top, size: anchorRect.height }
        default: return { start: paraRect.top - pageRect.top, size: paraRect.height } // paragraph
      }
    })()

    let left: number
    if (spec.inline) left = anchorRect.left - pageRect.left
    else if (spec.hOffsetPx !== null) left = hBase.start + spec.hOffsetPx
    else if (spec.hAlign === 'center') left = hBase.start + (hBase.size - spec.widthPx) / 2
    else if (spec.hAlign === 'right' || spec.hAlign === 'outside') left = hBase.start + hBase.size - spec.widthPx
    else left = hBase.start

    let top: number
    if (spec.inline) top = anchorRect.top - pageRect.top
    else if (spec.vOffsetPx !== null) top = vBase.start + spec.vOffsetPx
    else if (spec.vAlign === 'center') top = vBase.start + (vBase.size - spec.heightPx) / 2
    else if (spec.vAlign === 'bottom' || spec.vAlign === 'outside') top = vBase.start + vBase.size - spec.heightPx
    else top = vBase.start

    const el = renderShape(spec, fonts)
    el.style.left = pxStyle(left)
    el.style.top = pxStyle(top)
    // A página vira um contexto de empilhamento: formas "atrás do texto" (z-index -1)
    // ficam acima do fundo branco da página, mas abaixo do texto.
    if (getComputedStyle(page).position === 'static') page.style.position = 'relative'
    page.style.isolation = 'isolate'
    if (spec.behind) page.insertBefore(el, page.firstChild)
    else page.appendChild(el)
  }
}
