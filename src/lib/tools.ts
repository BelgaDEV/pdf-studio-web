import { Combine, FileArchive, FileImage, FileText, Images, Minimize2, Scissors, FileType2 } from 'lucide-react'

export const tools = [
  { id:'compress', title:'Comprimir PDF', desc:'Reduza o tamanho do PDF diretamente no navegador.', icon:Minimize2, color:'#ff5b66' },
  { id:'merge', title:'Mesclar PDF', desc:'Una vários PDFs em um único arquivo.', icon:Combine, color:'#8d5bff' },
  { id:'split', title:'Dividir PDF', desc:'Divida por tamanho máximo em MB.', icon:Scissors, color:'#ff7a39' },
  { id:'pdf-word', title:'PDF para Word', desc:'Converta texto do PDF para DOCX. Beta.', icon:FileType2, color:'#2e7df6' },
  { id:'word-pdf', title:'Word para PDF', desc:'Converta DOCX para PDF localmente. Beta.', icon:FileText, color:'#3a8dff' },
  { id:'pdf-jpg', title:'PDF para JPG', desc:'Exporte as páginas como imagens JPG.', icon:FileImage, color:'#f8b32b' },
  { id:'pdf-png', title:'PDF para PNG', desc:'Exporte as páginas como imagens PNG.', icon:FileImage, color:'#2fcb72' },
  { id:'images-pdf', title:'Imagens para PDF', desc:'Transforme JPG/PNG em um único PDF.', icon:Images, color:'#ae5cff' },
  { id:'pdf-txt', title:'PDF para TXT', desc:'Extraia texto pesquisável do documento.', icon:FileArchive, color:'#24c3a3' },
] as const

export type ToolId = typeof tools[number]['id']
