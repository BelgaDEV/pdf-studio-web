import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
} from 'pdf-lib'
import { nextFrame } from './files'

/**
 * Conversão PDF/A nível b sem Ghostscript (somente pdf-lib, MIT).
 *
 * Aplica as exigências estruturais do PDF/A-1b/2b/3b: OutputIntent sRGB com
 * perfil ICC incorporado, metadados XMP com identificação PDF/A e coerentes
 * com o dicionário Info, /ID no trailer, remoção de JavaScript e ações
 * automáticas, e flag de impressão nas anotações.
 *
 * Limitações honestas (retornadas em `warnings`): não incorpora fontes que
 * não estejam incorporadas no original, não converte CMYK/cores especiais e
 * não achata transparência no PDF/A-1. Nesses casos o arquivo é gerado, mas
 * a conformidade não é garantida e a interface avisa o usuário.
 */

export type PdfaVersion = 1 | 2 | 3
export type PdfaProgressFn = (value: number, message: string) => void

// ---------- Perfil ICC sRGB mínimo (v2, matriz + curva), gerado em código ----------

function s15Fixed16(value: number): number {
  return Math.round(value * 65536) | 0
}

function buildSrgbIccProfile(): Uint8Array {
  const enc = new TextEncoder()
  type Tag = { sig: string; data: Uint8Array }

  const xyz = (x: number, y: number, z: number) => {
    const b = new DataView(new ArrayBuffer(20))
    b.setUint32(0, 0x58595a20) // 'XYZ '
    b.setInt32(8, s15Fixed16(x)); b.setInt32(12, s15Fixed16(y)); b.setInt32(16, s15Fixed16(z))
    return new Uint8Array(b.buffer)
  }
  const desc = (text: string) => {
    const ascii = enc.encode(text)
    const size = 12 + ascii.length + 1 + 4 + 4 + 2 + 1 + 67
    const b = new DataView(new ArrayBuffer(size))
    b.setUint32(0, 0x64657363) // 'desc'
    b.setUint32(8, ascii.length + 1)
    new Uint8Array(b.buffer).set(ascii, 12)
    return new Uint8Array(b.buffer)
  }
  const text = (value: string) => {
    const ascii = enc.encode(value)
    const out = new Uint8Array(8 + ascii.length + 1)
    new DataView(out.buffer).setUint32(0, 0x74657874) // 'text'
    out.set(ascii, 8)
    return out
  }
  const curve = () => {
    const b = new DataView(new ArrayBuffer(14))
    b.setUint32(0, 0x63757276) // 'curv'
    b.setUint32(8, 1)
    b.setUint16(12, 0x0233) // gama 2.2 em u8Fixed8
    return new Uint8Array(b.buffer)
  }

  const trc = curve()
  const tags: Tag[] = [
    { sig: 'desc', data: desc('sRGB IEC61966-2.1') },
    { sig: 'cprt', data: text('No copyright, use freely') },
    { sig: 'wtpt', data: xyz(0.9642, 1.0, 0.8249) },
    { sig: 'rXYZ', data: xyz(0.4361, 0.2225, 0.0139) },
    { sig: 'gXYZ', data: xyz(0.3851, 0.7169, 0.0971) },
    { sig: 'bXYZ', data: xyz(0.1431, 0.0606, 0.7141) },
    { sig: 'rTRC', data: trc },
    { sig: 'gTRC', data: trc },
    { sig: 'bTRC', data: trc },
  ]

  const align = (n: number) => (n + 3) & ~3
  let offset = 128 + 4 + tags.length * 12
  const offsets = new Map<Uint8Array, number>()
  const entries = tags.map(tag => {
    if (!offsets.has(tag.data)) {
      offsets.set(tag.data, offset)
      offset = align(offset + tag.data.length)
    }
    return { sig: tag.sig, offset: offsets.get(tag.data)!, size: tag.data.length }
  })
  const total = offset
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  const sig = (pos: number, value: string) => out.set(enc.encode(value), pos)

  view.setUint32(0, total)
  view.setUint32(8, 0x02100000)
  sig(12, 'mntr'); sig(16, 'RGB '); sig(20, 'XYZ ')
  view.setUint16(24, 2024); view.setUint16(26, 1); view.setUint16(28, 1)
  sig(36, 'acsp')
  view.setInt32(68, s15Fixed16(0.9642)); view.setInt32(72, s15Fixed16(1.0)); view.setInt32(76, s15Fixed16(0.8249))

  view.setUint32(128, tags.length)
  entries.forEach((entry, i) => {
    const pos = 132 + i * 12
    sig(pos, entry.sig)
    view.setUint32(pos + 4, entry.offset)
    view.setUint32(pos + 8, entry.size)
  })
  for (const [data, pos] of offsets) out.set(data, pos)
  return out
}

// ---------- XMP ----------

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isoDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function buildXmp(info: { version: PdfaVersion; title?: string; author?: string; subject?: string; producer: string; creator: string; created: Date; modified: Date }): Uint8Array {
  const dc = [
    info.title ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(info.title)}</rdf:li></rdf:Alt></dc:title>` : '',
    info.author ? `<dc:creator><rdf:Seq><rdf:li>${xmlEscape(info.author)}</rdf:li></rdf:Seq></dc:creator>` : '',
    info.subject ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(info.subject)}</rdf:li></rdf:Alt></dc:description>` : '',
  ].join('')
  const xml = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
 xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:xmp="http://ns.adobe.com/xap/1.0/"
 xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdfaid:part>${info.version}</pdfaid:part>
<pdfaid:conformance>B</pdfaid:conformance>
${dc}
<xmp:CreateDate>${isoDate(info.created)}</xmp:CreateDate>
<xmp:ModifyDate>${isoDate(info.modified)}</xmp:ModifyDate>
<xmp:MetadataDate>${isoDate(info.modified)}</xmp:MetadataDate>
<xmp:CreatorTool>${xmlEscape(info.creator)}</xmp:CreatorTool>
<pdf:Producer>${xmlEscape(info.producer)}</pdf:Producer>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
  return new TextEncoder().encode(xml)
}

// ---------- Inspeção ----------

function fontIsEmbedded(font: PDFDict): boolean {
  const subtype = font.lookup(PDFName.of('Subtype'))
  if (subtype instanceof PDFName && subtype.decodeText() === 'Type3') return true
  if (subtype instanceof PDFName && subtype.decodeText() === 'Type0') {
    const descendants = font.lookup(PDFName.of('DescendantFonts'))
    const first = descendants instanceof PDFArray ? descendants.lookup(0) : undefined
    return first instanceof PDFDict ? fontIsEmbedded(first) : false
  }
  const descriptor = font.lookup(PDFName.of('FontDescriptor'))
  if (!(descriptor instanceof PDFDict)) return false
  return ['FontFile', 'FontFile2', 'FontFile3'].some(key => descriptor.lookup(PDFName.of(key)) !== undefined)
}

function inspect(doc: PDFDocument) {
  const missingFonts = new Set<string>()
  let transparency = false
  let cmyk = false
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : undefined
    if (!dict) continue
    const type = dict.lookup(PDFName.of('Type'))
    if (type instanceof PDFName && type.decodeText() === 'Font' && !fontIsEmbedded(dict)) {
      const base = dict.lookup(PDFName.of('BaseFont'))
      missingFonts.add(base instanceof PDFName ? base.decodeText() : 'sem nome')
    }
    if (dict.lookup(PDFName.of('SMask')) instanceof PDFRawStream) transparency = true
    const group = dict.lookup(PDFName.of('Group'))
    if (group instanceof PDFDict && String(group.lookup(PDFName.of('S'))) === '/Transparency') transparency = true
    const cs = dict.lookup(PDFName.of('ColorSpace'))
    if (cs instanceof PDFName && cs.decodeText() === 'DeviceCMYK') cmyk = true
  }
  return { missingFonts: [...missingFonts], transparency, cmyk }
}

function stripActions(doc: PDFDocument) {
  const catalog = doc.catalog
  catalog.delete(PDFName.of('AA'))
  const open = catalog.lookup(PDFName.of('OpenAction'))
  if (open instanceof PDFDict) catalog.delete(PDFName.of('OpenAction'))
  const names = catalog.lookup(PDFName.of('Names'))
  if (names instanceof PDFDict) names.delete(PDFName.of('JavaScript'))

  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of('AA'))
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (!(annots instanceof PDFArray)) continue
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i)
      if (!(annot instanceof PDFDict)) continue
      annot.delete(PDFName.of('AA'))
      const action = annot.lookup(PDFName.of('A'))
      if (action instanceof PDFDict && String(action.lookup(PDFName.of('S'))) === '/JavaScript') annot.delete(PDFName.of('A'))
      const flags = annot.lookup(PDFName.of('F'))
      const current = flags instanceof PDFNumber ? flags.asNumber() : 0
      // Print = 4; Hidden(2), Invisible(1), NoView(32) são proibidos no PDF/A.
      annot.set(PDFName.of('F'), PDFNumber.of((current | 4) & ~(1 | 2 | 32)))
    }
  }
}

function randomHex(bytes = 16): string {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data, b => b.toString(16).padStart(2, '0')).join('')
}

export async function convertToPdfAWithReport(
  file: File,
  version: PdfaVersion,
  onProgress: PdfaProgressFn,
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  onProgress(7, 'Abrindo PDF…')
  await nextFrame()
  const input = new Uint8Array(await file.arrayBuffer())
  const doc = await PDFDocument.load(input, { updateMetadata: false }).catch((error) => {
    throw new Error(`Não foi possível abrir o PDF para PDF/A. Se ele tiver senha, remova a proteção antes. (${error instanceof Error ? error.message : error})`)
  })

  onProgress(25, 'Verificando fontes, cores e transparência…')
  await nextFrame()
  const report = inspect(doc)
  const warnings: string[] = []
  if (report.missingFonts.length) {
    warnings.push(`Fontes não incorporadas no original (${report.missingFonts.slice(0, 5).join(', ')}${report.missingFonts.length > 5 ? '…' : ''}). PDF/A exige fontes incorporadas.`)
  }
  if (report.cmyk) warnings.push('O documento usa cores CMYK; com OutputIntent sRGB isso pode não ser aceito por validadores estritos.')
  if (version === 1 && report.transparency) warnings.push('O documento tem transparência, que não é permitida no PDF/A-1. Prefira PDF/A-2b.')

  onProgress(45, 'Removendo JavaScript e ações automáticas…')
  stripActions(doc)
  if (version !== 3) {
    const names = doc.catalog.lookup(PDFName.of('Names'))
    if (names instanceof PDFDict && names.lookup(PDFName.of('EmbeddedFiles'))) {
      names.delete(PDFName.of('EmbeddedFiles'))
      warnings.push(`Arquivos anexos foram removidos (não permitidos no PDF/A-${version}).`)
    }
  }

  onProgress(60, 'Incorporando perfil de cor sRGB e OutputIntent…')
  const context = doc.context
  const icc = buildSrgbIccProfile()
  const iccRef = context.register(context.stream(icc, { N: 3, Length: icc.byteLength }))
  const intent = context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
    DestOutputProfile: iccRef,
  })
  doc.catalog.set(PDFName.of('OutputIntents'), context.obj([intent]))

  onProgress(72, 'Gravando metadados XMP de identificação PDF/A…')
  const now = new Date()
  const producer = 'PDF Studio'
  const creator = doc.getCreator() || 'PDF Studio'
  const created = doc.getCreationDate() || now
  doc.setProducer(producer)
  doc.setCreator(creator)
  doc.setCreationDate(created)
  doc.setModificationDate(now)
  const xmp = buildXmp({
    version,
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    producer,
    creator,
    created,
    modified: now,
  })
  const metadata = context.register(context.stream(xmp, { Type: 'Metadata', Subtype: 'XML', Length: xmp.byteLength }))
  doc.catalog.set(PDFName.of('Metadata'), metadata)

  const id = PDFHexString.of(randomHex())
  context.trailerInfo.ID = context.obj([id, id])

  onProgress(85, `Salvando PDF/A-${version}b…`)
  // PDF/A-1 é baseado em PDF 1.4, que não admite object streams.
  const bytes = await doc.save({ useObjectStreams: version !== 1, addDefaultPage: false, updateFieldAppearances: false })
  onProgress(100, `PDF/A-${version}b criado.`)
  return { bytes, warnings }
}
