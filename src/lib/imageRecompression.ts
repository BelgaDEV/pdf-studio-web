import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from 'pdf-lib'
import { nextFrame } from './files'
import { loadPdfDocument } from './pdfOpen'

/**
 * Motor de recompressão de imagens 100% com licenças permissivas
 * (pdf-lib MIT + APIs nativas do navegador). Substitui o Ghostscript (AGPL).
 *
 * O que faz: percorre os XObjects de imagem do PDF, decodifica os formatos
 * seguros (JPEG/DCT e Flate 8 bits em Gray/RGB), reduz a resolução para o
 * DPI do perfil e recodifica como JPEG. Texto, vetores, fontes, anotações,
 * links e marcadores ficam intactos, pois só os streams de imagem mudam.
 *
 * O que NÃO toca (mantém o original): imagens 1 bit, máscaras, CMYK/Lab,
 * Indexed, JPEG2000, JBIG2, CCITT, máscaras por cor (/Mask array) e /Decode
 * personalizado. Isso evita alterar cores ou transparências.
 */

export type NativeCompressionProfile = 'medium' | 'high' | 'maximum' | 'extreme'
type ProgressFn = (value: number, message: string) => void

export const IMAGE_PROFILES: Record<NativeCompressionProfile, { dpi: number; quality: number; forceReencode: boolean }> = {
  medium: { dpi: 170, quality: 0.80, forceReencode: false },
  high: { dpi: 120, quality: 0.62, forceReencode: true },
  maximum: { dpi: 96, quality: 0.48, forceReencode: true },
  extreme: { dpi: 72, quality: 0.35, forceReencode: true },
}

/** Só aceitamos a imagem nova se ela economizar pelo menos isso. */
const MIN_GAIN = 0.92
/** Mesmo limiar do Ghostscript: só reduz se passar 20% do DPI alvo. */
const DOWNSAMPLE_THRESHOLD = 1.2

function nameOf(dict: PDFDict, key: string): string | undefined {
  const value = dict.lookup(PDFName.of(key))
  return value instanceof PDFName ? value.decodeText() : undefined
}

function numberOf(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(PDFName.of(key))
  return value instanceof PDFNumber ? value.asNumber() : undefined
}

function singleFilter(dict: PDFDict): string | null | undefined {
  const value = dict.lookup(PDFName.of('Filter'))
  if (value === undefined) return null
  if (value instanceof PDFName) return value.decodeText()
  if (value instanceof PDFArray) {
    if (value.size() === 0) return null
    if (value.size() !== 1) return undefined
    const first = value.lookup(0)
    return first instanceof PDFName ? first.decodeText() : undefined
  }
  return undefined
}

/** Número de componentes de cor suportado (1 = cinza, 3 = RGB) ou null. */
function colorComponents(dict: PDFDict): 1 | 3 | null {
  const cs = dict.lookup(PDFName.of('ColorSpace'))
  if (cs instanceof PDFName) {
    const name = cs.decodeText()
    if (name === 'DeviceGray' || name === 'CalGray') return 1
    if (name === 'DeviceRGB' || name === 'CalRGB') return 3
    return null
  }
  if (cs instanceof PDFArray && cs.size() >= 1) {
    const family = cs.lookup(0)
    if (!(family instanceof PDFName)) return null
    const name = family.decodeText()
    if (name === 'CalGray') return 1
    if (name === 'CalRGB') return 3
    if (name === 'ICCBased') {
      const profile = cs.lookup(1)
      const n = profile instanceof PDFRawStream ? numberOf(profile.dict, 'N') : undefined
      return n === 1 ? 1 : n === 3 ? 3 : null
    }
  }
  return null
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream indisponível')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Desfaz o preditor PNG (Predictor 10–15) usado em streams Flate. */
function undoPngPredictor(data: Uint8Array, rowBytes: number, bpp: number): Uint8Array {
  const stride = rowBytes + 1
  const rows = Math.floor(data.length / stride)
  const out = new Uint8Array(rows * rowBytes)
  for (let r = 0; r < rows; r++) {
    const type = data[r * stride]
    const src = r * stride + 1
    const dst = r * rowBytes
    const prev = dst - rowBytes
    for (let i = 0; i < rowBytes; i++) {
      const raw = data[src + i]
      const left = i >= bpp ? out[dst + i - bpp] : 0
      const up = r > 0 ? out[prev + i] : 0
      const upLeft = r > 0 && i >= bpp ? out[prev + i - bpp] : 0
      let value: number
      switch (type) {
        case 0: value = raw; break
        case 1: value = raw + left; break
        case 2: value = raw + up; break
        case 3: value = raw + ((left + up) >> 1); break
        case 4: {
          const p = left + up - upLeft
          const pa = Math.abs(p - left)
          const pb = Math.abs(p - up)
          const pc = Math.abs(p - upLeft)
          value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
          break
        }
        default: throw new Error(`Preditor PNG desconhecido: ${type}`)
      }
      out[dst + i] = value & 0xff
    }
  }
  return out
}

type DecodedImage = { source: CanvasImageSource & { close?: () => void }; width: number; height: number }

async function decodeImage(stream: PDFRawStream, filter: string, comps: 1 | 3, width: number, height: number): Promise<DecodedImage> {
  if (filter === 'DCTDecode') {
    const bitmap = await createImageBitmap(new Blob([stream.contents], { type: 'image/jpeg' }))
    return { source: bitmap, width: bitmap.width, height: bitmap.height }
  }

  // FlateDecode 8 bits
  let raw = await inflate(stream.contents)
  const parms = stream.dict.lookup(PDFName.of('DecodeParms'))
  const parmsDict = parms instanceof PDFDict ? parms : parms instanceof PDFArray ? parms.lookup(0) : undefined
  const predictor = parmsDict instanceof PDFDict ? numberOf(parmsDict, 'Predictor') ?? 1 : 1
  if (predictor >= 10) raw = undoPngPredictor(raw, width * comps, comps)
  else if (predictor !== 1) throw new Error(`Preditor ${predictor} não suportado`)

  const expected = width * height * comps
  if (raw.length < expected) throw new Error('Dados de imagem incompletos')
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let p = 0, s = 0, d = 0; p < width * height; p++, d += 4) {
    if (comps === 1) {
      const v = raw[s++]
      rgba[d] = v; rgba[d + 1] = v; rgba[d + 2] = v
    } else {
      rgba[d] = raw[s++]; rgba[d + 1] = raw[s++]; rgba[d + 2] = raw[s++]
    }
    rgba[d + 3] = 255
  }
  const bitmap = await createImageBitmap(new ImageData(rgba, width, height))
  return { source: bitmap, width, height }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error('Falha ao gerar JPEG.'))
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, 'image/jpeg', quality))
}

/** Maior lado de página do documento, em polegadas (limite seguro para DPI). */
function maxPageInches(doc: PDFDocument): number {
  let max = 0
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    max = Math.max(max, width, height)
  }
  return (max || 842) / 72
}

export type ImageRecompressionStats = { images: number; recompressed: number; skipped: number; savedBytes: number }

export async function recompressPdfImages(
  input: Uint8Array,
  profileName: NativeCompressionProfile,
  onProgress: ProgressFn,
  progressStart = 15,
  progressEnd = 82,
): Promise<Uint8Array> {
  const { bytes } = await recompressPdfImagesWithStats(input, profileName, onProgress, progressStart, progressEnd)
  return bytes
}

export async function recompressPdfImagesWithStats(
  input: Uint8Array,
  profileName: NativeCompressionProfile,
  onProgress: ProgressFn,
  progressStart = 15,
  progressEnd = 82,
): Promise<{ bytes: Uint8Array; stats: ImageRecompressionStats }> {
  const profile = IMAGE_PROFILES[profileName]
  onProgress(progressStart, 'Analisando imagens do PDF…')
  await nextFrame()

  const doc = await loadPdfDocument(input, { updateMetadata: false })
  const context = doc.context
  const maxPixels = Math.ceil(maxPageInches(doc) * profile.dpi)

  const images: Array<[PDFRef, PDFRawStream]> = []
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && nameOf(obj.dict, 'Subtype') === 'Image') images.push([ref, obj])
  }

  const stats: ImageRecompressionStats = { images: images.length, recompressed: 0, skipped: 0, savedBytes: 0 }

  for (let index = 0; index < images.length; index++) {
    const [ref, stream] = images[index]
    const dict = stream.dict
    const percent = progressStart + Math.round(((index + 1) / Math.max(1, images.length)) * (progressEnd - progressStart - 4))
    try {
      const filter = singleFilter(dict)
      const width = numberOf(dict, 'Width') ?? 0
      const height = numberOf(dict, 'Height') ?? 0
      const comps = colorComponents(dict)
      const bpc = numberOf(dict, 'BitsPerComponent')
      const unsupported =
        !comps || bpc !== 8 || width < 16 || height < 16
        || (filter !== 'DCTDecode' && filter !== 'FlateDecode')
        || dict.lookup(PDFName.of('Mask')) instanceof PDFArray
        || dict.lookup(PDFName.of('Decode')) !== undefined
        || dict.lookup(PDFName.of('SMaskInData')) !== undefined

      if (unsupported) { stats.skipped++; continue }

      const scale = Math.min(1, maxPixels / Math.max(width, height))
      const needsDownsample = Math.max(width, height) > maxPixels * DOWNSAMPLE_THRESHOLD
      // JPEG que já está na resolução certa só é recodificado nos perfis fortes.
      if (filter === 'DCTDecode' && !needsDownsample && !profile.forceReencode) { stats.skipped++; continue }

      const decoded = await decodeImage(stream, filter, comps, width, height)
      const targetW = Math.max(1, Math.round(width * (needsDownsample ? scale : 1)))
      const targetH = Math.max(1, Math.round(height * (needsDownsample ? scale : 1)))
      const canvas = makeCanvas(targetW, targetH)
      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(decoded.source, 0, 0, targetW, targetH)
      decoded.source.close?.()
      const jpeg = await canvasJpeg(canvas, profile.quality)
      canvas.width = 1
      canvas.height = 1

      if (jpeg.byteLength >= stream.contents.byteLength * MIN_GAIN) { stats.skipped++; continue }

      const newDict = dict.clone(context)
      newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
      newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
      newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
      newDict.set(PDFName.of('Width'), PDFNumber.of(targetW))
      newDict.set(PDFName.of('Height'), PDFNumber.of(targetH))
      newDict.set(PDFName.of('Length'), PDFNumber.of(jpeg.byteLength))
      newDict.delete(PDFName.of('DecodeParms'))
      context.assign(ref, PDFRawStream.of(newDict, jpeg))
      stats.recompressed++
      stats.savedBytes += stream.contents.byteLength - jpeg.byteLength
    } catch (error) {
      console.warn('Imagem mantida sem alteração.', error)
      stats.skipped++
    }
    if (index % 3 === 0 || index === images.length - 1) {
      onProgress(percent, `Recomprimindo imagens: ${index + 1}/${images.length} (${profile.dpi} DPI)…`)
      await nextFrame()
    }
  }

  onProgress(progressEnd - 2, 'Montando PDF recomprimido…')
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 })
  onProgress(progressEnd, `Recompressão concluída: ${stats.recompressed} de ${stats.images} imagem(ns) otimizada(s).`)
  return { bytes: out, stats }
}
