import { tools, type ToolId } from './tools'

const FAVORITES_KEY = 'pdfstudio:favorites:v1'
const RECENTS_KEY = 'pdfstudio:recent-tools:v1'
const EVENT_NAME = 'pdfstudio:productivity-change'

function validToolIds(values: unknown): ToolId[] {
  if (!Array.isArray(values)) return []
  const allowed = new Set(tools.map(tool => tool.id))
  return values.filter((value): value is ToolId => typeof value === 'string' && allowed.has(value as ToolId))
}

function read(key: string): ToolId[] {
  try {
    return validToolIds(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return []
  }
}

function write(key: string, values: ToolId[]) {
  localStorage.setItem(key, JSON.stringify(values))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function loadFavoriteToolIds(): ToolId[] {
  return read(FAVORITES_KEY)
}

export function isFavoriteTool(id: ToolId) {
  return loadFavoriteToolIds().includes(id)
}

export function toggleFavoriteTool(id: ToolId): ToolId[] {
  const current = loadFavoriteToolIds()
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current].slice(0, 12)
  write(FAVORITES_KEY, next)
  return next
}

export function loadRecentToolIds(): ToolId[] {
  return read(RECENTS_KEY)
}

export function recordRecentTool(id: ToolId): ToolId[] {
  const next = [id, ...loadRecentToolIds().filter(item => item !== id)].slice(0, 8)
  write(RECENTS_KEY, next)
  return next
}

export function clearRecentTools() {
  write(RECENTS_KEY, [])
}

export function subscribeProductivity(listener: () => void) {
  window.addEventListener(EVENT_NAME, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT_NAME, listener)
    window.removeEventListener('storage', listener)
  }
}
