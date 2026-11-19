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
const TWIPS_PER_PX = 15
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const MARK_START = ''
const MARK_END = ''

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; sizePt: number | null; color: string | null; font: string | null; letterSpacingPx?: number; br?: boolean }
type Para = { align: string; runs: Run[]; lineHeightPx?: number }

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
  /** Quadro de texto (w:framePr): sem quebra de linha quando cabe numa linha só. */
  frame?: { noWrap: boolean }
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
  const spacing = parseInt(attr(child(rPr, 'spacing'), 'val') ?? '', 10)
  const base = {
    letterSpacingPx: Number.isFinite(spacing) && spacing ? spacing / TWIPS_PER_PX : undefined,
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
  return children(container, 'p').map(parseParagraph)
}

function parseParagraph(p: Element): Para {
  {
    const jc = attr(child(child(p, 'pPr'), 'jc'), 'val') ?? 'left'
    const runs: Run[] = []
    for (const c of Array.from(p.children)) {
      if (c.localName === 'r') runs.push(...parseRun(c))
      else if (c.localName === 'hyperlink') children(c, 'r').forEach(r => runs.push(...parseRun(r)))
    }
    const spacing = child(child(p, 'pPr'), 'spacing')
    const line = parseInt(attr(spacing, 'line') ?? '', 10)
    const lineHeightPx = attr(spacing, 'lineRule') === 'exact' && Number.isFinite(line) ? line / TWIPS_PER_PX : undefined
    return { lineHeightPx, align: jc === 'both' ? 'justify' : jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : 'left', runs }
  }
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
  const multiSection = (xml.match(/<w:sectPr[\s>]/g)?.length ?? 0) > 1
  if (!multiSection && !/wps:wsp|<wps:|framePr/.test(xml)) return { buffer, shapes: [], fonts }

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
    const t = doc.createElementNS(W_NS, 'w:t')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = `${MARK_START}${spec.id}${MARK_END}`
    target.parentNode?.replaceChild(t, target)
  }

  extractFrames(doc, shapes)
  const breaks = markSectionBreaks(doc)

  if (!shapes.length && !breaks) return { buffer, shapes, fonts }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))
  return { buffer: await zip.generateAsync({ type: 'arraybuffer' }), shapes, fonts }
}

function twips(el: Element | null, name: string): number | null {
  const n = parseInt(attr(el, name) ?? '', 10)
  return Number.isFinite(n) ? n / TWIPS_PER_PX : null
}

/**
 * Parágrafos em quadro (w:framePr) ficam numa posição fixa da página. O
 * docx-preview ignora o quadro e empilha o texto no topo; então cada quadro
 * vira uma "forma" sem fundo nem borda, desenhada na posição certa. É o
 * formato que o PDF → Word da Lauda (e outros conversores) usa.
 */
function extractFrames(doc: Document, shapes: ShapeSpec[]) {
  const frames = Array.from(doc.getElementsByTagNameNS('*', 'framePr'))
    .filter(f => f.parentElement?.localName === 'pPr' && f.parentElement.parentElement?.localName === 'p')
    // Capitulares (dropCap) acompanham o texto e ficam como estão.
    .filter(f => !attr(f, 'dropCap') || attr(f, 'dropCap') === 'none')
  for (const framePr of frames) {
    const p = framePr.parentElement!.parentElement!
    // Só parágrafos soltos no corpo (não dentro de tabela ou caixa de texto).
    if (p.parentElement?.localName !== 'body') continue
    const para = parseParagraph(p)
    if (!para.runs.some(r => r.text.trim())) continue
    const rel = (anchor: string | null, fallback: string) => anchor === 'page' ? 'page' : anchor === 'margin' ? 'margin' : fallback
    const xAlign = attr(framePr, 'xAlign')
    const yAlign = attr(framePr, 'yAlign')
    const widthPx = twips(framePr, 'w') ?? 0
    const heightPx = twips(framePr, 'h') ?? 0
    const line = para.lineHeightPx
    const spec: ShapeSpec = {
      id: shapes.length,
      widthPx,
      heightPx,
      hRelative: rel(attr(framePr, 'hAnchor'), 'column'),
      hOffsetPx: xAlign ? null : twips(framePr, 'x') ?? 0,
      hAlign: xAlign,
      vRelative: rel(attr(framePr, 'vAnchor'), 'paragraph'),
      vOffsetPx: yAlign ? null : twips(framePr, 'y') ?? 0,
      vAlign: yAlign,
      behind: false,
      inline: false,
      fill: null,
      stroke: null,
      strokePx: 0,
      radiusPx: 0,
      paragraphs: [para],
      insets: [0, 0, 0, 0],
      vAnchor: 'top',
      rotation: 0,
      z: Number.MAX_SAFE_INTEGER,
      // Uma linha exata do tamanho do quadro: o texto foi feito para caber numa linha só.
      frame: { noWrap: !widthPx || (!!line && heightPx > 0 && heightPx <= line * 1.5) },
    }
    shapes.push(spec)

    // O parágrafo vira um marcador que não ocupa altura no fluxo da página.
    const el = (name: string, attrs: Record<string, string> = {}) => {
      const e = doc.createElementNS(W_NS, name)
      for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W_NS, k, v)
      return e
    }
    const marker = el('w:p')
    const pPr = el('w:pPr')
    pPr.appendChild(el('w:spacing', { 'w:before': '0', 'w:after': '0', 'w:line': '1', 'w:lineRule': 'exact' }))
    // O último parágrafo de cada seção guarda a quebra de seção (página): mantém.
    const sectPr = child(framePr.parentElement, 'sectPr')
    if (sectPr) pPr.appendChild(sectPr)
    const r = el('w:r')
    const rPr = el('w:rPr')
    rPr.appendChild(el('w:sz', { 'w:val': '2' }))
    const t = el('w:t')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = `${MARK_START}${spec.id}${MARK_END}`
    r.append(rPr, t)
    marker.append(pPr, r)
    p.parentNode!.replaceChild(marker, p)
  }
}

/**
 * Seção nova começa em página nova (padrão do Word), mas o docx-preview só
 * quebra a página quando o tamanho muda. Marca o primeiro parágrafo de cada
 * seção "próxima página" com pageBreakBefore. Devolve quantas quebras marcou.
 */
function markSectionBreaks(doc: Document): number {
  const body = desc(doc.documentElement, 'body')
  if (!body) return 0
  const blocks = Array.from(body.children)
  // sectPr de cada bloco que fecha uma seção (a última seção usa o sectPr do corpo).
  const ends = blocks
    .map((el, index) => ({ index, sectPr: el.localName === 'p' ? child(child(el, 'pPr'), 'sectPr') : null }))
    .filter(e => e.sectPr)
  const finalSect = child(body, 'sectPr')
  let count = 0
  ends.forEach((end, i) => {
    // O tipo da quebra fica no sectPr da seção que começa.
    const nextSect = ends[i + 1]?.sectPr ?? finalSect
    const type = attr(child(nextSect, 'type'), 'val') ?? 'nextPage'
    if (type === 'continuous') return
    const next = blocks.slice(end.index + 1).find(el => el.localName === 'p' || el.localName === 'tbl')
    if (!next || next.localName !== 'p') return
    let pPr = child(next, 'pPr')
    if (!pPr) { pPr = doc.createElementNS(W_NS, 'w:pPr'); next.insertBefore(pPr, next.firstChild) }
    if (child(pPr, 'pageBreakBefore')) return
    // pageBreakBefore vem logo depois de pStyle/keepNext/keepLines na ordem do schema.
    const pbb = doc.createElementNS(W_NS, 'w:pageBreakBefore')
    const after = Array.from(pPr.children).filter(c => ['pStyle', 'keepNext', 'keepLines'].includes(c.localName)).pop()
    pPr.insertBefore(pbb, after ? after.nextSibling : pPr.firstChild)
    count++
  })
  return count
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
    overflow: spec.frame ? 'visible' : 'hidden',
    whiteSpace: spec.frame?.noWrap ? 'pre' : 'pre-wrap',
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
    if (para.lineHeightPx) { p.style.lineHeight = pxStyle(para.lineHeightPx); p.style.minHeight = pxStyle(para.lineHeightPx) }
    for (const run of para.runs) {
      if (run.br) { p.appendChild(document.createElement('br')); continue }
      const span = document.createElement('span')
      span.textContent = run.text
      if (run.bold) span.style.fontWeight = '700'
      if (run.italic) span.style.fontStyle = 'italic'
      if (run.underline) span.style.textDecoration = 'underline'
      if (run.sizePt) span.style.fontSize = `${run.sizePt}pt`
      if (run.color) span.style.color = run.color
      if (run.letterSpacingPx) span.style.letterSpacing = pxStyle(run.letterSpacingPx)
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
