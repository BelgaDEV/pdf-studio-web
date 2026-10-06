import { Combine, Eraser, EyeOff, FileArchive, FileCheck2, FileImage, FileMinus2, FileText, Files, Fingerprint, Gavel, Images, LayoutGrid, ListOrdered, LockKeyhole, Minimize2, Pencil, ScanText, Scissors, ShieldCheck, Stamp, FileType2 } from 'lucide-react'

export type ToolCategory = 'legal' | 'essential' | 'document' | 'automation' | 'convert'

export const tools = [
  { id:'trust-report', title:'Document Trust Report', desc:'Comprove integridade com SHA-256 e verifique se um PDF corresponde ao relatório técnico.', icon:Fingerprint, color:'#39ef88', badge:'TRUST', category:'legal' },
  { id:'tribunal-presets', title:'Presets Tribunal', desc:'Salve e aplique regras de preparação por tribunal, sistema ou fluxo de protocolo.', icon:Gavel, color:'#e2b04a', badge:'LEGAL', category:'legal' },
  { id:'prepare-document', title:'Preparar documento', desc:'Encadeie limpeza, compressão, OCR, privacidade e PDF/A em um único fluxo.', icon:FileCheck2, color:'#39ef88', badge:'LEGAL', category:'legal' },
  { id:'compress', title:'Comprimir PDF', desc:'Reduza o tamanho do PDF diretamente no navegador.', icon:Minimize2, color:'#ff5b66', category:'essential' },
  { id:'merge', title:'Mesclar PDF', desc:'Una PDFs com índice clicável e bookmarks Pro hierárquicos por categoria.', icon:Combine, color:'#8d5bff', badge:'LEGAL', category:'legal' },
  { id:'redact', title:'Redação permanente', desc:'Remova visualmente dados sensíveis sem deixar conteúdo recuperável por baixo da tarja.', icon:EyeOff, color:'#e44f62', badge:'LEGAL', category:'legal' },
  { id:'compare', title:'Comparar PDFs', desc:'Compare duas versões, gere relatório e um PDF Redline com alterações marcadas.', icon:Files, color:'#5d7cff', badge:'LEGAL', category:'legal' },
  { id:'watermark', title:'Marca d’água', desc:'Adicione texto de marca d’água a todas as páginas.', icon:Stamp, color:'#27c2a4', category:'document' },
  { id:'page-numbers', title:'Numeração de páginas', desc:'Numere páginas com posição e formato personalizados.', icon:ListOrdered, color:'#4da3ff', category:'document' },
  { id:'remove-blank', title:'Remover páginas em branco', desc:'Detecte e remova páginas vazias automaticamente.', icon:FileMinus2, color:'#ff9d4d', category:'document' },
  { id:'remove-metadata', title:'Remover metadados', desc:'Limpe autor, título, XMP e informações ocultas do PDF.', icon:Eraser, color:'#e5729a', category:'document' },
  { id:'protect', title:'Proteger com senha', desc:'Criptografe o PDF localmente com senha.', icon:ShieldCheck, color:'#55d27b', category:'document' },
  { id:'extract-images', title:'Extrair imagens', desc:'Extraia imagens incorporadas e baixe tudo em ZIP.', icon:FileImage, color:'#f6b83f', category:'document' },
  { id:'pdfa', title:'PDF para PDF/A', desc:'Converta para PDF/A-1b, 2b ou 3b para arquivamento.', icon:FileCheck2, color:'#62c6e8', category:'document' },
  { id:'organize', title:'Organizar páginas', desc:'Reordene visualmente, remova e extraia páginas.', icon:LayoutGrid, color:'#38d77d', category:'essential' },
  { id:'edit-pages', title:'Editar páginas', desc:'Gire, duplique, exclua e reorganize páginas.', icon:Pencil, color:'#f39a45', category:'essential' },
  { id:'ocr', title:'OCR pesquisável', desc:'Transforme PDFs escaneados em documentos pesquisáveis.', icon:ScanText, color:'#20b8d8', category:'automation' },
  { id:'batch', title:'Processamento em lote', desc:'Comprima vários PDFs e baixe tudo em ZIP.', icon:Files, color:'#7c75ff', category:'automation' },
  { id:'split', title:'Dividir PDF', desc:'Divida por tamanho máximo em MB.', icon:Scissors, color:'#ff7a39', category:'essential' },
  { id:'pdf-word', title:'PDF para Word', desc:'Converta texto do PDF para DOCX. Beta.', icon:FileType2, color:'#2e7df6', badge:'BETA', category:'convert' },
  { id:'word-pdf', title:'Word para PDF', desc:'Converta DOCX para PDF localmente. Beta.', icon:FileText, color:'#3a8dff', badge:'BETA', category:'convert' },
  { id:'pdf-jpg', title:'PDF para JPG', desc:'Exporte as páginas como imagens JPG.', icon:FileImage, color:'#f8b32b', category:'convert' },
  { id:'pdf-png', title:'PDF para PNG', desc:'Exporte as páginas como imagens PNG.', icon:FileImage, color:'#2fcb72', category:'convert' },
  { id:'images-pdf', title:'Imagens para PDF', desc:'Transforme JPG/PNG em um único PDF.', icon:Images, color:'#ae5cff', category:'convert' },
  { id:'pdf-txt', title:'PDF para TXT', desc:'Extraia texto pesquisável do documento.', icon:FileArchive, color:'#24c3a3', category:'convert' },
] as const

export type ToolId = typeof tools[number]['id']
