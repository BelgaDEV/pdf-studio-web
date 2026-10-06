import type { PrepareDocumentOptions } from './prepareDocument'

export type SavedWorkflow = {
  id: string
  name: string
  description: string
  builtIn: boolean
  generateTrustReport: boolean
  createdAt?: number
  updatedAt?: number
  lastUsedAt?: number
  settings: PrepareDocumentOptions
}

const CUSTOM_KEY = 'pdfstudio:workflows:v1'
const PENDING_KEY = 'pdfstudio:prepare-workflow:v1'

export function workflowBaseSettings(): PrepareDocumentOptions {
  return {
    removeBlank: true,
    blankSensitivity: 'normal',
    compressionMode: 'smart',
    targetMb: 10,
    ocr: false,
    ocrLanguage: 'por',
    ocrDpi: 180,
    ocrSkipPagesWithText: true,
    removeMetadata: true,
    watermark: false,
    watermarkText: 'CONFIDENCIAL',
    watermarkOpacity: .18,
    watermarkFontSize: 46,
    watermarkRotation: -35,
    watermarkPosition: 'center',
    pageNumbers: false,
    pageNumberStart: 1,
    pageNumberFontSize: 10,
    pageNumberPosition: 'bottom-center',
    pageNumberShowTotal: true,
    pageNumberPrefix: 'Página ',
    pdfa: false,
    pdfaVersion: 2,
  }
}

export const builtInWorkflows: SavedWorkflow[] = [
  {
    id: 'workflow-protocolo-juridico',
    name: 'Protocolo jurídico',
    description: 'Limpa, torna pesquisável, reduz o tamanho e gera Trust Report antes do protocolo.',
    builtIn: true,
    generateTrustReport: true,
    settings: { ...workflowBaseSettings(), compressionMode: 'target', targetMb: 9.7, ocr: true, removeBlank: true, removeMetadata: true },
  },
  {
    id: 'workflow-arquivo-pesquisavel',
    name: 'Arquivo pesquisável',
    description: 'OCR + limpeza de metadados + PDF/A-2b para arquivamento e pesquisa.',
    builtIn: true,
    generateTrustReport: true,
    settings: { ...workflowBaseSettings(), compressionMode: 'smart', ocr: true, pdfa: true, pdfaVersion: 2 },
  },
  {
    id: 'workflow-compartilhamento-seguro',
    name: 'Compartilhamento seguro',
    description: 'Remove metadados, comprime e adiciona marca d’água antes de compartilhar.',
    builtIn: true,
    generateTrustReport: true,
    settings: { ...workflowBaseSettings(), removeBlank: false, compressionMode: 'smart', removeMetadata: true, watermark: true, watermarkText: 'CONFIDENCIAL' },
  },
  {
    id: 'workflow-processo-numerado',
    name: 'Processo numerado',
    description: 'Remove folhas vazias, aplica OCR, limpa metadados e numera as páginas.',
    builtIn: true,
    generateTrustReport: true,
    settings: { ...workflowBaseSettings(), ocr: true, pageNumbers: true, pageNumberPosition: 'bottom-right' },
  },
]

export function createBlankWorkflow(): SavedWorkflow {
  const now = Date.now()
  return {
    id: `workflow-custom-${now}`,
    name: 'Meu workflow',
    description: 'Fluxo personalizado salvo somente neste navegador.',
    builtIn: false,
    generateTrustReport: true,
    createdAt: now,
    updatedAt: now,
    settings: workflowBaseSettings(),
  }
}

export function loadCustomWorkflows(): SavedWorkflow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(item => item && typeof item.id === 'string' && item.settings)
  } catch {
    return []
  }
}

export function saveCustomWorkflows(workflows: SavedWorkflow[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(workflows.filter(item => !item.builtIn)))
}

export function saveWorkflowFromPrepare(name: string, settings: PrepareDocumentOptions, generateTrustReport: boolean): SavedWorkflow {
  const now = Date.now()
  const workflow: SavedWorkflow = {
    id: `workflow-custom-${now}`,
    name: name.trim() || 'Meu workflow',
    description: 'Workflow criado a partir do Preparar documento.',
    builtIn: false,
    generateTrustReport,
    createdAt: now,
    updatedAt: now,
    settings: { ...settings },
  }
  const next = [...loadCustomWorkflows(), workflow]
  saveCustomWorkflows(next)
  return workflow
}

export function queuePrepareWorkflow(workflow: SavedWorkflow) {
  const payload = { ...workflow, lastUsedAt: Date.now() }
  localStorage.setItem(PENDING_KEY, JSON.stringify(payload))
  if (!workflow.builtIn) {
    const next = loadCustomWorkflows().map(item => item.id === workflow.id ? { ...item, lastUsedAt: payload.lastUsedAt } : item)
    saveCustomWorkflows(next)
  }
}

export function consumePrepareWorkflow(): SavedWorkflow | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_KEY)
    const parsed = JSON.parse(raw) as SavedWorkflow
    if (!parsed?.settings || typeof parsed.name !== 'string') return null
    return parsed
  } catch {
    localStorage.removeItem(PENDING_KEY)
    return null
  }
}
