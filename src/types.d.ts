declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<{ value: string; messages: unknown[] }>
    extractRawText(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<{ value: string; messages: unknown[] }>
  }
  export default mammoth
}

declare module '@wasm-zoo/ghostscript' {
  export function load(): Promise<{
    exec(args: string[], options: {
      files?: Array<{ name: string; data: Uint8Array | ArrayBuffer }>
      dirs?: string[]
      outputs?: string[]
    }): Promise<{
      files?: Array<{ name?: string; data: Uint8Array | ArrayBuffer }>
      stdout?: string
      stderr?: string
      code?: number
    }>
    dispose(): void
  }>
}

declare module '@wasm-zoo/qpdf' {
  export function load(): Promise<{
    exec(args: string[], options: {
      files?: Array<{ name: string; data: Uint8Array | ArrayBuffer }>
      outputs?: string[]
    }): Promise<{
      files?: Array<{ name?: string; data: Uint8Array | ArrayBuffer }>
      stdout?: string
      stderr?: string
      code?: number
    }>
    dispose(): void
  }>
}
