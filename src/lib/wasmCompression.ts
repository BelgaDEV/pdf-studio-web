import { nextFrame } from './files'

export type WasmProgressFn = (value: number, message: string) => void
export type NativeCompressionProfile = 'medium' | 'high' | 'maximum' | 'extreme'

interface WasmOutputFile {
  name?: string
  data: Uint8Array | ArrayBuffer
}

interface WasmExecResult {
  files?: WasmOutputFile[]
  stdout?: string
  stderr?: string
  code?: number
}

const PROFILES: Record<NativeCompressionProfile, {
  colorDpi: number
  grayDpi: number
  monoDpi: number
  jpegQuality: number
  pdfSettings: '/ebook' | '/screen'
  forceReencode: boolean
}> = {
  medium: {
    colorDpi: 170,
    grayDpi: 170,
    monoDpi: 300,
    jpegQuality: 80,
    pdfSettings: '/ebook',
    forceReencode: false,
  },
  high: {
    colorDpi: 120,
    grayDpi: 120,
    monoDpi: 240,
    jpegQuality: 62,
    pdfSettings: '/ebook',
    forceReencode: true,
  },
  maximum: {
    colorDpi: 96,
    grayDpi: 96,
    monoDpi: 200,
    jpegQuality: 48,
    pdfSettings: '/screen',
    forceReencode: true,
  },
  extreme: {
    colorDpi: 72,
    grayDpi: 72,
    monoDpi: 150,
    jpegQuality: 35,
    pdfSettings: '/screen',
    forceReencode: true,
  },
}

function toUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data)
}

function outputBytes(result: WasmExecResult, label: string): Uint8Array {
  const file = result.files?.[0]
  if (!file?.data) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(-1500)
    throw new Error(`${label} não gerou um arquivo de saída.${details ? `\n${details}` : ''}`)
  }
  return toUint8Array(file.data)
}

export async function qpdfOptimizeWasm(input: Uint8Array, onProgress: WasmProgressFn): Promise<Uint8Array> {
  onProgress(12, 'Carregando qpdf WebAssembly…')
  await nextFrame()
  const { load } = await import('@wasm-zoo/qpdf')
  const qpdf = await load()
  try {
    onProgress(18, 'Otimizando streams, objetos e estrutura do PDF…')
    await nextFrame()
    const result = await qpdf.exec([
      '--compress-streams=y',
      '--decode-level=generalized',
      '--recompress-flate',
      '--compression-level=9',
      '--object-streams=generate',
      '--remove-unreferenced-resources=auto',
      '--warning-exit-0',
      '--',
      '/input.pdf',
      '/output.pdf',
    ], {
      files: [{ name: '/input.pdf', data: new Uint8Array(input) }],
      outputs: ['/output.pdf'],
    }) as WasmExecResult
    onProgress(94, 'Estrutura PDF otimizada.')
    return outputBytes(result, 'qpdf')
  } finally {
    qpdf.dispose()
  }
}

export async function ghostscriptCompressWasm(
  input: Uint8Array,
  profileName: NativeCompressionProfile,
  onProgress: WasmProgressFn,
  progressStart = 15,
  progressEnd = 82,
): Promise<Uint8Array> {
  const profile = PROFILES[profileName]
  onProgress(progressStart, 'Carregando motor Ghostscript WebAssembly…')
  await nextFrame()

  const { load } = await import('@wasm-zoo/ghostscript')
  const gs = await load()
  try {
    const args = [
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.7',
      `-dPDFSETTINGS=${profile.pdfSettings}`,
      '-dAutoRotatePages=/None',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dEmbedAllFonts=true',
      '-dPreserveAnnots=true',
      '-dPreserveMarkedContent=true',
      '-dDownsampleColorImages=true',
      '-dColorImageDownsampleType=/Bicubic',
      `-dColorImageResolution=${profile.colorDpi}`,
      '-dColorImageDownsampleThreshold=1.20',
      '-dEncodeColorImages=true',
      '-dColorImageFilter=/DCTEncode',
      '-dDownsampleGrayImages=true',
      '-dGrayImageDownsampleType=/Bicubic',
      `-dGrayImageResolution=${profile.grayDpi}`,
      '-dGrayImageDownsampleThreshold=1.20',
      '-dEncodeGrayImages=true',
      '-dGrayImageFilter=/DCTEncode',
      '-dDownsampleMonoImages=true',
      '-dMonoImageDownsampleType=/Subsample',
      `-dMonoImageResolution=${profile.monoDpi}`,
      '-dMonoImageDownsampleThreshold=1.20',
      '-dEncodeMonoImages=true',
      '-dMonoImageFilter=/CCITTFaxEncode',
      `-dJPEGQ=${profile.jpegQuality}`,
    ]

    if (profile.forceReencode) {
      args.push('-dPassThroughJPEGImages=false', '-dPassThroughJPXImages=false')
    }

    args.push('-sOutputFile=/output.pdf', '/input.pdf')

    onProgress(progressStart + 5, `Ghostscript processando o PDF (${profile.colorDpi} DPI)…`)
    await nextFrame()
    const result = await gs.exec(args, {
      files: [{ name: '/input.pdf', data: new Uint8Array(input) }],
      outputs: ['/output.pdf'],
    }) as WasmExecResult
    onProgress(progressEnd, 'Recompressão avançada concluída.')
    return outputBytes(result, 'Ghostscript')
  } finally {
    gs.dispose()
  }
}
