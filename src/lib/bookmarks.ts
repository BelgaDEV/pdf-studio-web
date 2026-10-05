import { PDFDocument, PDFHexString, PDFName, PDFNumber, type PDFDict, type PDFRef } from 'pdf-lib'

export interface PdfBookmarkSpec {
  title: string
  pageIndex: number
  category?: string
  root?: boolean
}

export interface PdfBookmarkResult {
  totalCreated: number
  documentBookmarksCreated: number
  categoryBookmarksCreated: number
}

function cleanTitle(title: string, fallbackIndex: number): string {
  const normalized = title.replace(/\.pdf$/i, '').trim()
  return normalized || `Documento ${fallbackIndex + 1}`
}

function cleanCategory(category?: string): string {
  return (category || '').trim()
}

function wireSiblings(dicts: PDFDict[], refs: PDFRef[]): void {
  for (let index = 0; index < dicts.length; index++) {
    if (index > 0) dicts[index].set(PDFName.of('Prev'), refs[index - 1])
    if (index < refs.length - 1) dicts[index].set(PDFName.of('Next'), refs[index + 1])
  }
}

function destinationForPage(pdfDoc: PDFDocument, pageIndex: number) {
  const page = pdfDoc.getPages()[pageIndex]
  return pdfDoc.context.obj([page.ref, PDFName.of('Fit')])
}

/**
 * Cria outlines de primeiro nível no PDF.
 * Cada marcador aponta para a primeira página do documento de origem.
 */
export function addPdfBookmarks(
  pdfDoc: PDFDocument,
  specs: PdfBookmarkSpec[],
  openPanel = true,
): number {
  const pages = pdfDoc.getPages()
  const valid = specs
    .map((spec, index) => ({
      title: cleanTitle(spec.title, index),
      pageIndex: Math.trunc(spec.pageIndex),
    }))
    .filter(spec => spec.pageIndex >= 0 && spec.pageIndex < pages.length)

  if (valid.length === 0) return 0

  const { context, catalog } = pdfDoc
  const outlineRoot = context.obj({ Type: PDFName.of('Outlines') }) as PDFDict
  const outlineRootRef = context.register(outlineRoot)

  const itemDicts: PDFDict[] = []
  const itemRefs: PDFRef[] = []

  for (const item of valid) {
    const dict = context.obj({
      Title: PDFHexString.fromText(item.title),
      Parent: outlineRootRef,
      Dest: destinationForPage(pdfDoc, item.pageIndex),
    }) as PDFDict
    itemDicts.push(dict)
    itemRefs.push(context.register(dict))
  }

  wireSiblings(itemDicts, itemRefs)
  outlineRoot.set(PDFName.of('First'), itemRefs[0])
  outlineRoot.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1])
  outlineRoot.set(PDFName.of('Count'), PDFNumber.of(itemRefs.length))

  catalog.set(PDFName.of('Outlines'), outlineRootRef)
  if (openPanel) catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))

  return itemRefs.length
}

/**
 * Cria bookmarks hierárquicos. Documentos com `category` são agrupados como
 * filhos de uma categoria; documentos sem categoria permanecem no primeiro nível.
 * Specs marcados com `root: true` também ficam sempre no primeiro nível (ex.: índice).
 *
 * A ordem das categorias segue a primeira aparição na lista de documentos.
 */
export function addPdfBookmarksHierarchical(
  pdfDoc: PDFDocument,
  specs: PdfBookmarkSpec[],
  openPanel = true,
): PdfBookmarkResult {
  const pages = pdfDoc.getPages()
  const valid = specs
    .map((spec, index) => ({
      title: cleanTitle(spec.title, index),
      pageIndex: Math.trunc(spec.pageIndex),
      category: cleanCategory(spec.category),
      root: Boolean(spec.root),
      sourceIndex: index,
    }))
    .filter(spec => spec.pageIndex >= 0 && spec.pageIndex < pages.length)

  if (valid.length === 0) return { totalCreated: 0, documentBookmarksCreated: 0, categoryBookmarksCreated: 0 }

  const hasCategories = valid.some(spec => spec.category && !spec.root)
  if (!hasCategories) {
    const total = addPdfBookmarks(pdfDoc, valid, openPanel)
    return { totalCreated: total, documentBookmarksCreated: total, categoryBookmarksCreated: 0 }
  }

  const { context, catalog } = pdfDoc
  const outlineRoot = context.obj({ Type: PDFName.of('Outlines') }) as PDFDict
  const outlineRootRef = context.register(outlineRoot)

  type ValidItem = (typeof valid)[number]
  type TopNode =
    | { kind: 'leaf'; item: ValidItem }
    | { kind: 'category'; title: string; items: ValidItem[] }

  const categoryMap = new Map<string, ValidItem[]>()
  for (const item of valid) {
    if (item.category && !item.root) {
      const bucket = categoryMap.get(item.category) || []
      bucket.push(item)
      categoryMap.set(item.category, bucket)
    }
  }

  const seenCategories = new Set<string>()
  const topNodes: TopNode[] = []
  for (const item of valid) {
    if (item.category && !item.root) {
      if (!seenCategories.has(item.category)) {
        seenCategories.add(item.category)
        topNodes.push({ kind: 'category', title: item.category, items: categoryMap.get(item.category) || [item] })
      }
    } else {
      topNodes.push({ kind: 'leaf', item })
    }
  }

  const topDicts: PDFDict[] = []
  const topRefs: PDFRef[] = []
  let documentBookmarksCreated = 0
  let categoryBookmarksCreated = 0

  for (const node of topNodes) {
    if (node.kind === 'leaf') {
      const dict = context.obj({
        Title: PDFHexString.fromText(node.item.title),
        Parent: outlineRootRef,
        Dest: destinationForPage(pdfDoc, node.item.pageIndex),
      }) as PDFDict
      topDicts.push(dict)
      topRefs.push(context.register(dict))
      documentBookmarksCreated++
      continue
    }

    const firstChild = node.items[0]
    const categoryDict = context.obj({
      Title: PDFHexString.fromText(node.title),
      Parent: outlineRootRef,
      Dest: destinationForPage(pdfDoc, firstChild.pageIndex),
    }) as PDFDict
    const categoryRef = context.register(categoryDict)

    const childDicts: PDFDict[] = []
    const childRefs: PDFRef[] = []
    for (const item of node.items) {
      const child = context.obj({
        Title: PDFHexString.fromText(item.title),
        Parent: categoryRef,
        Dest: destinationForPage(pdfDoc, item.pageIndex),
      }) as PDFDict
      childDicts.push(child)
      childRefs.push(context.register(child))
      documentBookmarksCreated++
    }

    wireSiblings(childDicts, childRefs)
    categoryDict.set(PDFName.of('First'), childRefs[0])
    categoryDict.set(PDFName.of('Last'), childRefs[childRefs.length - 1])
    // Count positivo mantém a categoria expandida em leitores compatíveis.
    categoryDict.set(PDFName.of('Count'), PDFNumber.of(childRefs.length))

    topDicts.push(categoryDict)
    topRefs.push(categoryRef)
    categoryBookmarksCreated++
  }

  wireSiblings(topDicts, topRefs)
  outlineRoot.set(PDFName.of('First'), topRefs[0])
  outlineRoot.set(PDFName.of('Last'), topRefs[topRefs.length - 1])
  outlineRoot.set(PDFName.of('Count'), PDFNumber.of(documentBookmarksCreated + categoryBookmarksCreated))

  catalog.set(PDFName.of('Outlines'), outlineRootRef)
  if (openPanel) catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))

  return {
    totalCreated: documentBookmarksCreated + categoryBookmarksCreated,
    documentBookmarksCreated,
    categoryBookmarksCreated,
  }
}
