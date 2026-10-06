import { CheckCircle2, Copy, FileCheck2, Play, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PrepareCompressionMode } from '../lib/prepareDocument'
import type { BlankSensitivity, PdfaVersion } from '../lib/documentTools'
import type { OcrLanguage } from '../lib/ocr'
import {
  builtInWorkflows,
  createBlankWorkflow,
  loadCustomWorkflows,
  queuePrepareWorkflow,
  saveCustomWorkflows,
  type SavedWorkflow,
} from '../lib/workflows'

function cloneWorkflow(workflow: SavedWorkflow): SavedWorkflow {
  return { ...workflow, settings: { ...workflow.settings } }
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [custom, setCustom] = useState<SavedWorkflow[]>(() => loadCustomWorkflows())
  const all = useMemo(() => [...builtInWorkflows, ...custom], [custom])
  const [selectedId, setSelectedId] = useState(all[0]?.id || '')
  const selected = all.find(item => item.id === selectedId) || all[0]
  const [draft, setDraft] = useState<SavedWorkflow>(() => cloneWorkflow(selected))
  const [message, setMessage] = useState('')

  function choose(workflow: SavedWorkflow) {
    setSelectedId(workflow.id)
    setDraft(cloneWorkflow(workflow))
    setMessage('')
  }

  function updateSetting<K extends keyof SavedWorkflow['settings']>(key: K, value: SavedWorkflow['settings'][K]) {
    setDraft(previous => ({ ...previous, settings: { ...previous.settings, [key]: value } }))
  }

  function newWorkflow() {
    const workflow = createBlankWorkflow()
    setSelectedId(workflow.id)
    setDraft(workflow)
    setMessage('Novo workflow. Ajuste as etapas e clique em Salvar.')
  }

  function saveDraft() {
    const now = Date.now()
    const saved: SavedWorkflow = {
      ...draft,
      id: draft.builtIn ? `workflow-custom-${now}` : draft.id,
      name: draft.name.trim() || 'Meu workflow',
      description: draft.description.trim() || 'Workflow personalizado salvo neste navegador.',
      builtIn: false,
      createdAt: draft.createdAt || now,
      updatedAt: now,
      settings: { ...draft.settings },
    }
    const next = [...custom.filter(item => item.id !== saved.id), saved]
    setCustom(next)
    saveCustomWorkflows(next)
    setSelectedId(saved.id)
    setDraft(cloneWorkflow(saved))
    setMessage('Workflow salvo neste navegador.')
  }

  function duplicate() {
    const now = Date.now()
    const duplicated: SavedWorkflow = {
      ...draft,
      id: `workflow-custom-${now}`,
      name: `${draft.name} — cópia`,
      builtIn: false,
      createdAt: now,
      updatedAt: now,
      settings: { ...draft.settings },
    }
    setSelectedId(duplicated.id)
    setDraft(duplicated)
    setMessage('Cópia criada. Ajuste e salve.')
  }

  function remove() {
    if (draft.builtIn) return
    const next = custom.filter(item => item.id !== draft.id)
    setCustom(next)
    saveCustomWorkflows(next)
    const fallback = builtInWorkflows[0]
    setSelectedId(fallback.id)
    setDraft(cloneWorkflow(fallback))
    setMessage('Workflow removido.')
  }

  function runWorkflow() {
    queuePrepareWorkflow(draft)
    navigate('/tool/prepare-document')
  }

  const active = [
    draft.settings.removeBlank ? 'Limpar páginas vazias' : '',
    draft.settings.compressionMode !== 'off' ? (draft.settings.compressionMode === 'target' ? `≤ ${draft.settings.targetMb.toLocaleString('pt-BR')} MB` : 'Compressão') : '',
    draft.settings.ocr ? 'OCR' : '',
    draft.settings.removeMetadata ? 'Metadados' : '',
    draft.settings.watermark ? 'Marca d’água' : '',
    draft.settings.pageNumbers ? 'Numeração' : '',
    draft.settings.pdfa ? `PDF/A-${draft.settings.pdfaVersion}b` : '',
    draft.generateTrustReport ? 'Trust Report' : '',
  ].filter(Boolean)

  return <div className="info-page workflows-page">
    <section className="info-hero workflow-hero">
      <div className="info-hero-icon"><Sparkles size={28}/></div>
      <div><p className="kicker">AUTOMAÇÃO</p><h1>Workflows salvos</h1><p>Salve sequências de preparação e reaplique o mesmo padrão em novos documentos com um clique. Tudo fica somente neste navegador.</p></div>
    </section>

    <div className="tribunal-layout workflow-layout">
      <aside className="workspace-card tribunal-library">
        <div className="tribunal-library-head"><div><span className="kicker">WORKFLOWS</span><h3>Biblioteca</h3></div><button className="icon-action-btn" type="button" onClick={newWorkflow} title="Novo workflow"><Plus size={18}/></button></div>
        <div className="tribunal-preset-list">
          {all.map(workflow => <button key={workflow.id} className={`tribunal-preset-card ${selectedId===workflow.id?'active':''}`} type="button" onClick={()=>choose(workflow)}>
            <div className="tribunal-preset-card-top"><strong>{workflow.name}</strong><span>{workflow.builtIn?'MODELO':'MEU'}</span></div>
            <small>{workflow.description}</small>
            <div className="tribunal-mini-tags">{workflow.settings.ocr&&<em>OCR</em>}{workflow.settings.compressionMode!=='off'&&<em>Compressão</em>}{workflow.generateTrustReport&&<em>TRUST</em>}</div>
          </button>)}
        </div>
      </aside>

      <div className="workspace-card tribunal-editor workflow-editor">
        <div className="tribunal-editor-head">
          <div><span className="kicker">CONFIGURAÇÃO</span><h2>{draft.name}</h2><p>{draft.description}</p></div>
          <div className="tribunal-editor-actions"><button className="secondary-btn small" type="button" onClick={duplicate}><Copy size={15}/> Duplicar</button>{!draft.builtIn&&<button className="danger-outline-btn" type="button" onClick={remove}><Trash2 size={15}/> Excluir</button>}</div>
        </div>

        <div className="tribunal-identity-grid workflow-identity-grid">
          <label><span>Nome</span><input className="text-input" value={draft.name} onChange={e=>setDraft(previous=>({...previous,name:e.target.value}))}/></label>
          <label className="workflow-description-field"><span>Descrição</span><input className="text-input" value={draft.description} onChange={e=>setDraft(previous=>({...previous,description:e.target.value}))}/></label>
        </div>

        <div className="tribunal-settings-grid">
          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.removeBlank} onChange={e=>updateSetting('removeBlank',e.target.checked)}/><span><strong>Remover páginas em branco</strong><small>Limpeza inicial do documento.</small></span></label>{draft.settings.removeBlank&&<select value={draft.settings.blankSensitivity} onChange={e=>updateSetting('blankSensitivity',e.target.value as BlankSensitivity)}><option value="conservative">Conservadora</option><option value="normal">Normal</option><option value="aggressive">Agressiva</option></select>}</div>

          <div className="tribunal-setting-card"><label><span>Compressão</span><select value={draft.settings.compressionMode} onChange={e=>updateSetting('compressionMode',e.target.value as PrepareCompressionMode)}><option value="off">Desligada</option><option value="smart">Inteligente</option><option value="basic">Básico</option><option value="medium">Médio</option><option value="high">Alto</option><option value="maximum">Máximo</option><option value="target">Para X MB</option></select></label>{draft.settings.compressionMode==='target'&&<label><span>Meta</span><div className="number-field"><input type="number" min=".3" step=".1" value={draft.settings.targetMb} onChange={e=>updateSetting('targetMb',Math.max(.3,Number(e.target.value)||.3))}/><span>MB</span></div></label>}</div>

          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.ocr} onChange={e=>updateSetting('ocr',e.target.checked)}/><span><strong>OCR pesquisável</strong><small>Reconhece texto em páginas escaneadas.</small></span></label>{draft.settings.ocr&&<div className="two-fields"><label><span>Idioma</span><select value={draft.settings.ocrLanguage} onChange={e=>updateSetting('ocrLanguage',e.target.value as OcrLanguage)}><option value="por">Português</option><option value="eng">Inglês</option><option value="por+eng">PT + EN</option></select></label><label><span>DPI</span><select value={draft.settings.ocrDpi} onChange={e=>updateSetting('ocrDpi',Number(e.target.value))}><option value="150">150</option><option value="180">180</option><option value="220">220</option></select></label></div>}</div>

          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.removeMetadata} onChange={e=>updateSetting('removeMetadata',e.target.checked)}/><span><strong>Remover metadados</strong><small>Limpa informações documentais conhecidas.</small></span></label></div>
          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.watermark} onChange={e=>updateSetting('watermark',e.target.checked)}/><span><strong>Marca d’água</strong><small>Aplica “{draft.settings.watermarkText}”.</small></span></label>{draft.settings.watermark&&<input className="text-input" value={draft.settings.watermarkText} onChange={e=>updateSetting('watermarkText',e.target.value)} maxLength={90}/>}</div>
          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.pageNumbers} onChange={e=>updateSetting('pageNumbers',e.target.checked)}/><span><strong>Numeração de páginas</strong><small>Adiciona numeração ao resultado.</small></span></label></div>
          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.settings.pdfa} onChange={e=>updateSetting('pdfa',e.target.checked)}/><span><strong>PDF/A</strong><small>Converte no final do fluxo.</small></span></label>{draft.settings.pdfa&&<select value={draft.settings.pdfaVersion} onChange={e=>updateSetting('pdfaVersion',Number(e.target.value) as PdfaVersion)}><option value="1">PDF/A-1b</option><option value="2">PDF/A-2b</option><option value="3">PDF/A-3b</option></select>}</div>
          <div className="tribunal-setting-card"><label className="prepare-toggle"><input type="checkbox" checked={draft.generateTrustReport} onChange={e=>setDraft(previous=>({...previous,generateTrustReport:e.target.checked}))}/><span><strong>Document Trust Report</strong><small>Registra hashes e validações ao final.</small></span></label></div>
        </div>

        <div className="tribunal-summary-card workflow-summary-card"><div><FileCheck2 size={20}/><span><strong>Fluxo</strong><small>{active.length?active.join(' → '):'Nenhuma etapa selecionada'}</small></span></div><div className="tribunal-summary-actions"><button className="secondary-btn" type="button" onClick={saveDraft}><Save size={16}/> {draft.builtIn?'Salvar como meu workflow':'Salvar alterações'}</button><button className="primary-btn" type="button" onClick={runWorkflow}><Play size={16}/> Usar workflow</button></div></div>
        {message&&<div className="success-inline"><CheckCircle2 size={16}/>{message}</div>}
      </div>
    </div>
  </div>
}
