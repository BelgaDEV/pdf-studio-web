import { nextFrame } from './files'

export type WasmProgressFn = (value: number, message: string) => void
export type { NativeCompressionProfile } from './imageRecompression'
export { recompressPdfImages } from './imageRecompression'

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
