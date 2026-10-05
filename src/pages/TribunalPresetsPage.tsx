import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, FileCheck2, Gavel, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { tools } from '../lib/tools'
import {
  builtInTribunalPresets,
  createBlankTribunalPreset,
  loadCustomTribunalPresets,
  queuePreparePreset,
  saveCustomTribunalPresets,
  type TribunalPreset,
} from '../lib/tribunalPresets'
import type { PrepareCompressionMode } from '../lib/prepareDocument'
import type { BlankSensitivity, PdfaVersion } from '../lib/documentTools'
import type { OcrLanguage } from '../lib/ocr'

function clonePreset(preset: TribunalPreset): TribunalPreset {
  return {
    ...preset,
    settings: { ...preset.settings },
  }
}

export default function TribunalPresetsPage() {
  const navigate = useNavigate()
  const tool = tools.find(item => item.id === 'tribunal-presets') || tools[0]
  const Icon = tool.icon
  const [customPresets, setCustomPresets] = useState<TribunalPreset[]>(() => loadCustomTribunalPresets())
  const allPresets = useMemo(() => [...builtInTribunalPresets, ...customPresets], [customPresets])
  const [selectedId, setSelectedId] = useState(allPresets[0]?.id || '')
  const selectedSource = allPresets.find(item => item.id === selectedId) || allPresets[0]
  const [draft, setDraft] = useState<TribunalPreset>(() => clonePreset(selectedSource))
  const [savedMessage, setSavedMessage] = useState('')

  function choosePreset(preset: TribunalPreset) {
    setSelectedId(preset.id)
    setDraft(clonePreset(preset))
    setSavedMessage('')
  }

  function updateSettings<K extends keyof TribunalPreset['settings']>(key: K, value: TribunalPreset['settings'][K]) {
    setDraft(previous => ({ ...previous, settings: { ...previous.settings, [key]: value } }))
  }

  function newPreset() {
    const preset = createBlankTribunalPreset()
    setSelectedId(preset.id)
    setDraft(preset)
    setSavedMessage('Novo preset. Ajuste as opções e clique em Salvar.')
  }

  function saveDraft() {
    const safeName = draft.name.trim() || 'Meu preset'
    const safeCourt = draft.court.trim() || 'Personalizado'
    const saved: TribunalPreset = {
      ...draft,
      id: draft.builtIn ? `custom-${Date.now()}` : draft.id,
      name: safeName,
      court: safeCourt,
      system: draft.system.trim() || 'Personalizado',
      description: draft.description.trim() || 'Preset personalizado salvo neste navegador.',
      builtIn: false,
      sourceLabel: undefined,
      sourceUrl: undefined,
      verifiedAt: undefined,
      warning: 'Preset personalizado. Confirme as exigências do sistema de destino antes do protocolo.',
      settings: { ...draft.settings },
    }
    const next = [...customPresets.filter(item => item.id !== saved.id), saved]
    setCustomPresets(next)
    saveCustomTribunalPresets(next)
    setSelectedId(saved.id)
    setDraft(clonePreset(saved))
    setSavedMessage('Preset salvo neste navegador.')
  }

  function duplicateDraft() {
    const duplicated: TribunalPreset = {
      ...draft,
      id: `custom-${Date.now()}`,
      name: `${draft.name} — cópia`,
      builtIn: false,
      sourceLabel: undefined,
      sourceUrl: undefined,
      verifiedAt: undefined,
      warning: 'Cópia editável. Confirme as exigências do sistema de destino antes do protocolo.',
      settings: { ...draft.settings },
    }
    setSelectedId(duplicated.id)
    setDraft(duplicated)
    setSavedMessage('Cópia criada. Ajuste e salve.')
  }

  function deleteDraft() {
    if (draft.builtIn) return
    const next = customPresets.filter(item => item.id !== draft.id)
    setCustomPresets(next)
    saveCustomTribunalPresets(next)
    const fallback = builtInTribunalPresets[0]
    setSelectedId(fallback.id)
    setDraft(clonePreset(fallback))
    setSavedMessage('Preset personalizado removido.')
  }

  function usePreset() {
    queuePreparePreset(draft)
    navigate('/tool/prepare-document')
  }

  const activeSummary = [
    draft.settings.removeBlank ? 'Páginas em branco' : '',
    draft.settings.compressionMode !== 'off' ? (draft.settings.compressionMode === 'target' ? `≤ ${draft.settings.targetMb.toLocaleString('pt-BR')} MB` : 'Compressão') : '',
    draft.settings.ocr ? 'OCR' : '',
    draft.settings.removeMetadata ? 'Metadados' : '',
    draft.settings.pageNumbers ? 'Numeração' : '',
    draft.settings.pdfa ? `PDF/A-${draft.settings.pdfaVersion}b` : '',
  ].filter(Boolean)

  return <section className="tool-page tribunal-presets-page">
    <div className="tool-page-head">
      <Link to="/" className="back-link"><ArrowLeft size={17}/> Voltar</Link>
      <div className="tool-heading"><div className="tool-icon large" style={{ background: tool.color }}><Icon size={28}/></div><div><h1>{tool.title}</h1><p>{tool.desc}</p></div></div>
      <div className="local-pill"><ShieldCheck size={15}/> Regras ficam no seu navegador</div>
    </div>

    <div className="tribunal-warning">
      <Gavel size={21}/><div><strong>Presets são atalhos, não substituem a regra do tribunal.</strong><span>Limites e exigências podem mudar por tribunal, instalação, classe processual ou tipo de documento. Presets oficiais mostram fonte e data de verificação; confirme a tela do sistema antes do protocolo.</span></div>
    </div>

    <div className="tribunal-layout">
      <aside className="workspace-card tribunal-library">
        <div className="tribunal-library-head"><div><span className="kicker">PRESETS</span><h3>Biblioteca</h3></div><button className="icon-action-btn" type="button" onClick={newPreset} title="Novo preset"><Plus size={18}/></button></div>
        <div className="tribunal-preset-list">
          {allPresets.map(preset => <button key={preset.id} className={`tribunal-preset-card ${selectedId === preset.id ? 'active' : ''}`} type="button" onClick={() => choosePreset(preset)}>
            <div className="tribunal-preset-card-top"><strong>{preset.name}</strong><span>{preset.builtIn ? 'REFERÊNCIA' : 'MEU'}</span></div>
            <small>{preset.court} • {preset.system}</small>
            <div className="tribunal-mini-tags">
              {preset.settings.compressionMode === 'target' && <em>≤ {preset.settings.targetMb.toLocaleString('pt-BR')} MB</em>}
              {preset.settings.ocr && <em>OCR</em>}
              {preset.settings.pdfa && <em>PDF/A</em>}
            </div>
          </button>)}
        </div>
      </aside>

      <div className="workspace-card tribunal-editor">
        <div className="tribunal-editor-head">
          <div><span className="kicker">CONFIGURAÇÃO</span><h2>{draft.name}</h2><p>{draft.description}</p></div>
          <div className="tribunal-editor-actions">
            <button className="secondary-btn small" type="button" onClick={duplicateDraft}><Copy size={15}/> Duplicar</button>
            {!draft.builtIn && <button className="danger-outline-btn" type="button" onClick={deleteDraft}><Trash2 size={15}/> Excluir</button>}
          </div>
        </div>

        <div className="tribunal-identity-grid">
          <label><span>Nome do preset</span><input className="text-input" value={draft.name} onChange={e=>setDraft(previous=>({...previous,name:e.target.value}))}/></label>
          <label><span>Tribunal / destino</span><input className="text-input" value={draft.court} onChange={e=>setDraft(previous=>({...previous,court:e.target.value}))}/></label>
          <label><span>Sistema</span><input className="text-input" value={draft.system} onChange={e=>setDraft(previous=>({...previous,system:e.target.value}))}/></label>
        </div>

        {(draft.sourceUrl || draft.warning) && <div className="tribunal-source-card">
          <div><strong>{draft.sourceLabel || 'Observação'}</strong>{draft.verifiedAt && <span>Verificado em {draft.verifiedAt}</span>}</div>
          {draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte oficial <ExternalLink size={14}/></a>}
          {draft.warning && <p>{draft.warning}</p>}
        </div>}

        <div className="tribunal-settings-grid">
          <div className="tribunal-setting-card">
            <label className="prepare-toggle"><input type="checkbox" checked={draft.settings.removeBlank} onChange={e=>updateSettings('removeBlank',e.target.checked)}/><span><strong>Remover páginas em branco</strong><small>Evita protocolar folhas vazias ou scans inúteis.</small></span></label>
            {draft.settings.removeBlank && <select value={draft.settings.blankSensitivity} onChange={e=>updateSettings('blankSensitivity',e.target.value as BlankSensitivity)}><option value="conservative">Conservadora</option><option value="normal">Normal</option><option value="aggressive">Agressiva</option></select>}
          </div>

          <div className="tribunal-setting-card">
            <label><span>Compressão</span><select value={draft.settings.compressionMode} onChange={e=>updateSettings('compressionMode',e.target.value as PrepareCompressionMode)}><option value="off">Desligada</option><option value="smart">Inteligente</option><option value="basic">Básico</option><option value="medium">Médio</option><option value="high">Alto</option><option value="maximum">Máximo</option><option value="target">Para X MB</option></select></label>
            {draft.settings.compressionMode === 'target' && <label><span>Meta de tamanho</span><div className="number-field"><input type="number" min="0.3" step="0.1" value={draft.settings.targetMb} onChange={e=>updateSettings('targetMb',Math.max(.3,Number(e.target.value) || .3))}/><span>MB</span></div></label>}
          </div>

          <div className="tribunal-setting-card">
            <label className="prepare-toggle"><input type="checkbox" checked={draft.settings.ocr} onChange={e=>updateSettings('ocr',e.target.checked)}/><span><strong>OCR pesquisável</strong><small>Útil para documentos digitalizados e pesquisa no processo.</small></span></label>
            {draft.settings.ocr && <div className="two-fields"><label><span>Idioma</span><select value={draft.settings.ocrLanguage} onChange={e=>updateSettings('ocrLanguage',e.target.value as OcrLanguage)}><option value="por">Português</option><option value="eng">Inglês</option><option value="por+eng">PT + EN</option></select></label><label><span>DPI</span><select value={draft.settings.ocrDpi} onChange={e=>updateSettings('ocrDpi',Number(e.target.value))}><option value="150">150</option><option value="180">180</option><option value="220">220</option></select></label></div>}
          </div>

          <div className="tribunal-setting-card compact-block"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.removeMetadata} onChange={e=>updateSettings('removeMetadata',e.target.checked)}/><span><strong>Remover metadados</strong><small>Limpa autor, software e informações documentais.</small></span></label></div>

          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.pageNumbers} onChange={e=>updateSettings('pageNumbers',e.target.checked)}/><span><strong>Numerar páginas</strong><small>Opcional para dossiês e peças preparadas.</small></span></label></div>

          <div className="tribunal-setting-card">
            <label className="prepare-toggle"><input type="checkbox" checked={draft.settings.pdfa} onChange={e=>updateSettings('pdfa',e.target.checked)}/><span><strong>Converter para PDF/A</strong><small>Use somente quando o destino exigir ou seu fluxo arquivístico pedir.</small></span></label>
            {draft.settings.pdfa && <select value={draft.settings.pdfaVersion} onChange={e=>updateSettings('pdfaVersion',Number(e.target.value) as PdfaVersion)}><option value="1">PDF/A-1b</option><option value="2">PDF/A-2b</option><option value="3">PDF/A-3b</option></select>}
          </div>
        </div>

        <div className="tribunal-summary-card">
          <div><FileCheck2 size={20}/><span><strong>Fluxo resultante</strong><small>{activeSummary.length ? activeSummary.join(' • ') : 'Nenhuma etapa selecionada'}</small></span></div>
          <div className="tribunal-summary-actions">
            <button className="secondary-btn" type="button" onClick={saveDraft}><Save size={16}/> {draft.builtIn ? 'Salvar como meu preset' : 'Salvar alterações'}</button>
            <button className="primary-btn" type="button" onClick={usePreset}><CheckCircle2 size={16}/> Usar no Preparar documento</button>
          </div>
        </div>
        {savedMessage && <div className="success-inline"><CheckCircle2 size={16}/>{savedMessage}</div>}
      </div>
    </div>
  </section>
}
