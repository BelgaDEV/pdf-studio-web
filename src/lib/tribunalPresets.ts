import type { PrepareDocumentOptions } from './prepareDocument'

export type TribunalPresetSettings = PrepareDocumentOptions

export type TribunalPreset = {
  id: string
  name: string
  system: string
  court: string
  description: string
  builtIn: boolean
  sourceLabel?: string
  sourceUrl?: string
  verifiedAt?: string
  warning?: string
  settings: TribunalPresetSettings
}

const CUSTOM_KEY = 'pdfstudio:tribunal-presets:v1'
const PENDING_KEY = 'pdfstudio:prepare-preset:v1'

function baseSettings(): TribunalPresetSettings {
  return {
    removeBlank: true,
    blankSensitivity: 'normal',
    compressionMode: 'target',
    targetMb: 10,
    ocr: true,
    ocrLanguage: 'por',
    ocrDpi: 180,
    ocrSkipPagesWithText: true,
    removeMetadata: true,
    watermark: false,
    watermarkText: 'CONFIDENCIAL',
    watermarkOpacity: 0.18,
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

export const builtInTribunalPresets: TribunalPreset[] = [
  {
    id: 'pje-cnj-ref-3mb',
    name: 'PJe CNJ — referência 3 MB',
    system: 'PJe',
    court: 'Referência CNJ',
    description: 'Preset conservador para anexos PDF em instalações que seguem a referência documentada do PJe/CNJ. Usa margem abaixo de 3 MB.',
    builtIn: true,
    sourceLabel: 'Documentação oficial PJe/CNJ',
    sourceUrl: 'https://docs.pje.jus.br/manuais-de-uso/Manual%20do%20usuario%20sem%20representa%C3%A7%C3%A3o/',
    verifiedAt: '05/10/2026',
    warning: 'O PJe permite configuração por instalação. Confirme o limite exibido pelo tribunal antes do protocolo.',
    settings: { ...baseSettings(), targetMb: 2.8, pdfa: false, pageNumbers: false },
  },
  {
    id: 'tjrj-pje-ref-15mb',
    name: 'TJRJ PJe — referência 1,5 MB',
    system: 'PJe',
    court: 'TJRJ',
    description: 'Preset de margem para o limite de 1,5 MB indicado no manual externo do TJRJ consultado na criação desta versão.',
    builtIn: true,
    sourceLabel: 'Manual de usuário externo — TJRJ',
    sourceUrl: 'https://www.tjrj.jus.br/documents/d/guest/manual_do_usuario_usuario_externo_advgoado_parte_pje_v_1-3',
    verifiedAt: '05/10/2026',
    warning: 'Regras podem variar por fluxo, versão e classe processual. O sistema de destino é sempre a fonte final.',
    settings: { ...baseSettings(), targetMb: 1.4, ocrDpi: 150, pdfa: false, pageNumbers: false },
  },
  {
    id: 'protocolo-5mb',
    name: 'Protocolo leve — até 5 MB',
    system: 'Genérico',
    court: 'Personalizável',
    description: 'Modelo genérico para portais que exigem anexos pequenos. Não representa regra oficial de um tribunal específico.',
    builtIn: true,
    warning: 'Modelo genérico. Ajuste o limite para o sistema em que fará o protocolo.',
    settings: { ...baseSettings(), targetMb: 4.8, pdfa: false },
  },
  {
    id: 'protocolo-10mb',
    name: 'Protocolo profissional — até 10 MB',
    system: 'Genérico',
    court: 'Personalizável',
    description: 'Preset equilibrado para preparar documento pesquisável, limpo e abaixo de aproximadamente 10 MB.',
    builtIn: true,
    warning: 'Modelo genérico. Confirme requisitos e tamanho máximo no portal de destino.',
    settings: { ...baseSettings(), targetMb: 9.7, pdfa: false },
  },
  {
    id: 'arquivo-pdfa-2b',
    name: 'Arquivamento — OCR + PDF/A-2b',
    system: 'Arquivo',
    court: 'Legal / Business',
    description: 'Fluxo para documento pesquisável, sem metadados e convertido para PDF/A-2b. Não impõe meta rígida de tamanho.',
    builtIn: true,
    settings: { ...baseSettings(), compressionMode: 'smart', targetMb: 10, pdfa: true, pdfaVersion: 2 },
  },
]

export function createBlankTribunalPreset(): TribunalPreset {
  return {
    id: `custom-${Date.now()}`,
    name: 'Meu preset',
    system: 'Personalizado',
    court: 'Meu tribunal / sistema',
    description: 'Preset personalizado salvo apenas neste navegador.',
    builtIn: false,
    settings: baseSettings(),
  }
}

export function loadCustomTribunalPresets(): TribunalPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(item => item && typeof item.id === 'string' && item.settings)
  } catch {
    return []
  }
}

export function saveCustomTribunalPresets(presets: TribunalPreset[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(presets.filter(item => !item.builtIn)))
}

export function queuePreparePreset(preset: TribunalPreset) {
  localStorage.setItem(PENDING_KEY, JSON.stringify({
    name: preset.name,
    court: preset.court,
    system: preset.system,
    settings: preset.settings,
    queuedAt: Date.now(),
  }))
}

export type PendingPreparePreset = {
  name: string
  court: string
  system: string
  settings: TribunalPresetSettings
  queuedAt: number
}

export function consumePreparePreset(): PendingPreparePreset | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_KEY)
    const parsed = JSON.parse(raw) as PendingPreparePreset
    if (!parsed?.settings || typeof parsed.name !== 'string') return null
    return parsed
  } catch {
    localStorage.removeItem(PENDING_KEY)
    return null
  }
}
