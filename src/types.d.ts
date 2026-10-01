declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<{ value: string; messages: unknown[] }>
    extractRawText(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<{ value: string; messages: unknown[] }>
  }
  export default mammoth
}
