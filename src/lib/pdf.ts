import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getClientLimits } from './pdfLimits'

// PDF.js is bundled as a lazy feature chunk; its worker is only fetched when a PDF needs rendering.
;(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type DownloadItem = { blob: Blob; filename: string; label?: string }
export type ProgressCallback = (progress: number, message?: string) => void

const cleanName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) || 'document'
const bytesOf = async (file: File) => new Uint8Array(await file.arrayBuffer())

export function enforcePageCount(pageCount: number) {
  const { maxPdfPages } = getClientLimits()
  if (pageCount > maxPdfPages) throw new Error(`This browser tool supports PDFs with up to ${maxPdfPages} pages.`)
}

export async function assertPdf(file: File): Promise<void> {
  const { maxFileMb } = getClientLimits()
  if (file.size > maxFileMb * 1024 * 1024) throw new Error(`This browser tool supports files up to ${maxFileMb} MB.`)
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const header = new TextDecoder('latin1').decode(bytes)
  if (!header.includes('%PDF-')) throw new Error('This file does not contain a valid PDF header. Choose a PDF document and try again.')
}

export function parsePageSelection(input: string, total: number): number[] {
  const value = input.trim()
  if (!value) return Array.from({ length: total }, (_, index) => index)
  const result = new Set<number>()
  for (const raw of value.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
    if (!match) throw new Error(`“${part}” is not a valid page or range. Try 1-3,5,8-10.`)
    const first = Number(match[1])
    const last = Number(match[2] || match[1])
    if (first < 1 || last < first || last > total) throw new Error(`Page ranges must be between 1 and ${total}.`)
    for (let n = first; n <= last; n += 1) result.add(n - 1)
  }
  if (result.size === 0) throw new Error('Enter at least one page number.')
  return [...result].sort((a, b) => a - b)
}

export async function inspectPdf(file: File) {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const pageCount = pdf.getPageCount()
  enforcePageCount(pageCount)
  return {
    pages: pageCount,
    title: pdf.getTitle() || '',
    author: pdf.getAuthor() || '',
    subject: pdf.getSubject() || '',
    keywords: pdf.getKeywords() || '',
    creator: pdf.getCreator() || '',
    producer: pdf.getProducer() || '',
    creationDate: pdf.getCreationDate()?.toISOString() || '',
    modificationDate: pdf.getModificationDate()?.toISOString() || '',
    size: file.size,
    dimensions: pdf.getPages().map((page) => ({ width: Math.round(page.getWidth()), height: Math.round(page.getHeight()) })),
  }
}

export async function mergePdfs(files: File[], onProgress?: ProgressCallback): Promise<DownloadItem> {
  if (files.length < 2) throw new Error('Choose at least two PDF files to merge.')
  const output = await PDFDocument.create()
  for (let i = 0; i < files.length; i += 1) {
    await assertPdf(files[i])
    const source = await PDFDocument.load(await bytesOf(files[i]))
  enforcePageCount(source.getPageCount())
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page) => output.addPage(page))
    onProgress?.((i + 1) / files.length, `Adding ${files[i].name}`)
  }
  const result = await output.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: 'merged-document.pdf' }
}

async function makePdfFromPageOrder(file: File, order: number[], filename: string): Promise<DownloadItem> {
  await assertPdf(file)
  if (!order.length) throw new Error('The result would have no pages. Choose at least one page.')
  const source = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(source.getPageCount())
  const total = source.getPageCount()
  if (order.some((page) => !Number.isInteger(page) || page < 0 || page >= total)) throw new Error('A page number is outside this document.')
  const output = await PDFDocument.create()
  const copied = await output.copyPages(source, order)
  copied.forEach((page) => output.addPage(page))
  const bytes = await output.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename }
}

export async function extractPdfPages(file: File, selection: string): Promise<DownloadItem> {
  const info = await inspectPdf(file)
  const pages = parsePageSelection(selection, info.pages)
  return makePdfFromPageOrder(file, pages, `${cleanName(file.name)}-pages.pdf`)
}

export async function deletePdfPages(file: File, selection: string): Promise<DownloadItem> {
  const info = await inspectPdf(file)
  const remove = new Set(parsePageSelection(selection, info.pages))
  const keep = Array.from({ length: info.pages }, (_, index) => index).filter((index) => !remove.has(index))
  if (!keep.length) throw new Error('You cannot delete every page in a PDF.')
  return makePdfFromPageOrder(file, keep, `${cleanName(file.name)}-edited.pdf`)
}

export function parsePageOrder(input: string, total: number, requireAll = false): number[] {
  const raw = input.split(',').map((part) => part.trim()).filter(Boolean)
  if (!raw.length) throw new Error('Enter the page numbers in the order you want, for example 3,1,2.')
  const order: number[] = []
  for (const part of raw) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error(`“${part}” is not a valid page number.`)
    const first = Number(match[1])
    const last = Number(match[2] || match[1])
    if (first < 1 || last < first || last > total) throw new Error(`Page numbers must be between 1 and ${total}.`)
    for (let page = first; page <= last; page += 1) order.push(page - 1)
  }
  if (requireAll && (order.length !== total || new Set(order).size !== total)) throw new Error(`Enter every page from 1 to ${total} exactly once in the desired order, for example 3,1,2.`)
  return order
}

export async function reorderPdfPages(file: File, sequence: string): Promise<DownloadItem> {
  const info = await inspectPdf(file)
  const order = parsePageOrder(sequence, info.pages, true)
  return makePdfFromPageOrder(file, order, `${cleanName(file.name)}-reordered.pdf`)
}

export async function duplicatePdfPages(file: File, sequence: string): Promise<DownloadItem> {
  const info = await inspectPdf(file)
  const order = parsePageOrder(sequence, info.pages)
  return makePdfFromPageOrder(file, order, `${cleanName(file.name)}-pages.pdf`)
}

export async function splitPdf(file: File, ranges: string, onProgress?: ProgressCallback): Promise<DownloadItem> {
  const info = await inspectPdf(file)
  const source = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(source.getPageCount())
  const groups = ranges.trim()
    ? ranges.split(';').map((range) => parsePageSelection(range, info.pages))
    : Array.from({ length: info.pages }, (_, index) => [index])
  if (groups.length === 1) return makePdfFromPageOrder(file, groups[0], `${cleanName(file.name)}-split.pdf`)
  const zip = new JSZip()
  for (let i = 0; i < groups.length; i += 1) {
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(source, groups[i])
    pages.forEach((page) => doc.addPage(page))
    zip.file(`${cleanName(file.name)}-part-${i + 1}.pdf`, await doc.save({ useObjectStreams: true }))
    onProgress?.((i + 1) / groups.length, `Preparing part ${i + 1} of ${groups.length}`)
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: `${cleanName(file.name)}-split.zip` }
}

export async function rotatePdf(file: File, selection: string, rotation: number): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const indices = parsePageSelection(selection, pdf.getPageCount())
  for (const index of indices) {
    const page = pdf.getPage(index)
    page.setRotation(degrees((page.getRotation().angle + rotation + 360) % 360))
  }
  const result = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-rotated.pdf` }
}

export async function optimizePdf(file: File): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const result = await pdf.save({ useObjectStreams: true, objectsPerTick: 50 })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-optimized.pdf` }
}

async function openPdfJs(file: File) {
  await assertPdf(file)
  const bytes = await bytesOf(file)
  const document = await (pdfjsLib as unknown as { getDocument: (options: { data: Uint8Array; useSystemFonts?: boolean }) => { promise: Promise<any> } }).getDocument({ data: bytes, useSystemFonts: true }).promise
  const { maxPdfPages } = getClientLimits()
  if (document.numPages > maxPdfPages) { await document.destroy(); throw new Error(`This browser tool supports PDFs with up to ${maxPdfPages} pages.`) }
  return document
}

export async function extractPdfText(file: File, onProgress?: ProgressCallback): Promise<string> {
  const pdf = await openPdfJs(file)
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item: { str?: string }) => item.str || '').join(' ').replace(/[ \t]+/g, ' ').trim()
    pages.push(text ? `--- Page ${i} ---\n${text}` : `--- Page ${i} ---\n`)
    onProgress?.(i / pdf.numPages, `Reading page ${i} of ${pdf.numPages}`)
  }
  return pages.join('\n\n').trim()
}

export async function renderPdfPages(file: File, scale = 1.5, format: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/png', quality = 0.88, selected?: string, onProgress?: ProgressCallback): Promise<DownloadItem[]> {
  const pdf = await openPdfJs(file)
  const indices = selected ? parsePageSelection(selected, pdf.numPages) : Array.from({ length: pdf.numPages }, (_, index) => index)
  const outputs: DownloadItem[] = []
  const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png'
  for (let i = 0; i < indices.length; i += 1) {
    const pageNumber = indices[i] + 1
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d', { alpha: format !== 'image/jpeg' })
    if (!context) throw new Error('Your browser could not create a canvas for PDF rendering.')
    if (format === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    await page.render({ canvasContext: context, viewport, canvas }).promise
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not export this page as an image.')), format, quality))
    outputs.push({ blob, filename: `${cleanName(file.name)}-page-${String(pageNumber).padStart(3, '0')}.${extension}` })
    canvas.width = 1
    canvas.height = 1
    onProgress?.((i + 1) / indices.length, `Rendering page ${i + 1} of ${indices.length}`)
  }
  return outputs
}

export async function imageFilesToPdf(files: File[], pageSize = 'a4', orientation = 'portrait', marginMm = 10): Promise<DownloadItem> {
  if (!files.length) throw new Error('Choose one or more images.')
  const output = await PDFDocument.create()
  const sizeMap: Record<string, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }
  for (const file of files) {
    const { maxFileMb } = getClientLimits()
    if (file.size > maxFileMb * 1024 * 1024) throw new Error(`${file.name} exceeds the ${maxFileMb} MB browser processing limit.`)
    const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
    const isWebp = file.type === 'image/webp' || /\.webp$/i.test(file.name)
    if (!isJpeg && !isPng && !isWebp) throw new Error(`${file.name} is not a supported JPG, PNG or WebP image.`)
    const bytes = await bytesOf(file)
    let image
    if (isJpeg) {
      image = await output.embedJpg(bytes)
    } else if (isPng) {
      image = await output.embedPng(bytes)
    } else {
      const decoded = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = decoded.width
      canvas.height = decoded.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not read image pixels in this browser.')
      context.drawImage(decoded, 0, 0)
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not convert this image.')), 'image/png'))
      image = await output.embedPng(await png.arrayBuffer())
      decoded.close()
    }
    let [pageWidth, pageHeight] = pageSize === 'original'
      ? [image.width * 0.75, image.height * 0.75]
      : sizeMap[pageSize] || sizeMap.a4
    if (orientation === 'landscape' && pageHeight > pageWidth) [pageWidth, pageHeight] = [pageHeight, pageWidth]
    if (orientation === 'portrait' && pageWidth > pageHeight && pageSize !== 'original') [pageWidth, pageHeight] = [pageHeight, pageWidth]
    const margin = pageSize === 'original' ? 0 : Math.max(0, marginMm) * 72 / 25.4
    const maxWidth = Math.max(1, pageWidth - margin * 2)
    const maxHeight = Math.max(1, pageHeight - margin * 2)
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    const page = output.addPage([pageWidth, pageHeight])
    page.drawImage(image, { x: (pageWidth - drawWidth) / 2, y: (pageHeight - drawHeight) / 2, width: drawWidth, height: drawHeight })
  }
  const bytes = await output.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'images-to-pdf.pdf' }
}

export async function imagesToZip(images: DownloadItem[], filename: string): Promise<DownloadItem> {
  if (images.length === 1) return images[0]
  const zip = new JSZip()
  images.forEach((item) => zip.file(item.filename, item.blob))
  return { blob: await zip.generateAsync({ type: 'blob' }), filename }
}

export async function addTextOverlay(file: File, text: string, selection: string, position: 'top' | 'center' | 'bottom' = 'center'): Promise<DownloadItem> {
  await assertPdf(file)
  if (!text.trim()) throw new Error('Enter the text you want to add.')
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const indices = parsePageSelection(selection, pdf.getPageCount())
  const safeText = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-')
  for (const index of indices) {
    const page = pdf.getPage(index)
    const size = 18
    const y = position === 'top' ? page.getHeight() - 54 : position === 'bottom' ? 40 : page.getHeight() / 2
    page.drawText(safeText, { x: 48, y, size, font, color: rgb(0.12, 0.16, 0.23), maxWidth: page.getWidth() - 96, lineHeight: size * 1.3 })
  }
  const result = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-with-text.pdf` }
}

export async function addWatermark(file: File, text: string, selection: string, opacity: number, fontSize: number, rotation: number, position = 'center'): Promise<DownloadItem> {
  await assertPdf(file)
  if (!text.trim()) throw new Error('Enter watermark text.')
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const indices = parsePageSelection(selection, pdf.getPageCount())
  const safeText = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-')
  for (const index of indices) {
    const page = pdf.getPage(index)
    const size = Math.max(8, Math.min(fontSize, 120))
    const width = font.widthOfTextAtSize(safeText, size)
    const margin = 32
    const x = position.endsWith('left') ? margin : position.endsWith('right') ? page.getWidth() - width - margin : (page.getWidth() - width) / 2
    const y = position.startsWith('top') ? page.getHeight() - margin - size : position.startsWith('bottom') ? margin : page.getHeight() / 2
    page.drawText(safeText, { x, y, size, font, color: rgb(0.48, 0.52, 0.58), opacity: Math.max(0.05, Math.min(0.85, opacity)), rotate: degrees(rotation), maxWidth: page.getWidth() - 40 })
  }
  const result = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-watermarked.pdf` }
}

export async function addPageNumbers(file: File, position: string, format: string, start = 1): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const [vertical, horizontal] = position.split('-')
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i]
    const current = i + start
    const label = format === 'page-of' ? `Page ${current} of ${pages.length + start - 1}` : format === 'page' ? `Page ${current}` : String(current)
    const size = 10
    const width = font.widthOfTextAtSize(label, size)
    const margin = 28
    const x = horizontal === 'left' ? margin : horizontal === 'right' ? page.getWidth() - width - margin : (page.getWidth() - width) / 2
    const y = vertical === 'top' ? page.getHeight() - margin - size : margin
    page.drawText(label, { x, y, size, font, color: rgb(0.22, 0.25, 0.3) })
  }
  const result = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-numbered.pdf` }
}

export async function addSignature(file: File, signature: Blob, pageNumber: number, xPercent: number, yPercent: number, widthPercent: number, rotation = 0): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  if (!pageNumber || pageNumber > pdf.getPageCount()) throw new Error(`Choose a page between 1 and ${pdf.getPageCount()}.`)
  const bytes = new Uint8Array(await signature.arrayBuffer())
  const image = await pdf.embedPng(bytes)
  const page = pdf.getPage(pageNumber - 1)
  const width = page.getWidth() * Math.max(0.05, Math.min(0.9, widthPercent / 100))
  const height = width * image.height / image.width
  const x = (page.getWidth() - width) * Math.max(0, Math.min(1, xPercent / 100))
  const yFromTop = page.getHeight() * Math.max(0, Math.min(1, yPercent / 100))
  page.drawImage(image, { x, y: page.getHeight() - yFromTop - height, width, height, rotate: degrees(rotation) })
  const result = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([result], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-signed.pdf` }
}

export async function updatePdfMetadata(file: File, fields: { title?: string; author?: string; subject?: string; keywords?: string }): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await bytesOf(file))
  enforcePageCount(pdf.getPageCount())
  if (fields.title !== undefined) pdf.setTitle(fields.title)
  if (fields.author !== undefined) pdf.setAuthor(fields.author)
  if (fields.subject !== undefined) pdf.setSubject(fields.subject)
  if (fields.keywords !== undefined) pdf.setKeywords(fields.keywords.split(',').map((value) => value.trim()).filter(Boolean))
  const bytes = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-metadata.pdf` }
}

export async function runOcr(file: File, language = 'eng', onProgress?: ProgressCallback): Promise<string> {
  const pdf = await openPdfJs(file)
  const tesseract = await import('tesseract.js')
  const worker = await tesseract.createWorker(language, 1, { logger: (message: { status?: string; progress?: number }) => {
    if (message.status === 'recognizing text') onProgress?.(message.progress || 0, 'Recognizing text on the current page')
  } })
  const result: string[] = []
  try {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.65 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not create an OCR canvas.')
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      const recognized = await worker.recognize(canvas)
      result.push(`--- Page ${i} ---\n${recognized.data.text.trim()}`)
      onProgress?.(i / pdf.numPages, `Recognized page ${i} of ${pdf.numPages}`)
      canvas.width = 1
      canvas.height = 1
    }
  } finally {
    await worker.terminate()
  }
  return result.join('\n\n').trim()
}

export async function rasterCompressPdf(file: File, preset: 'medium' | 'high', onProgress?: ProgressCallback): Promise<DownloadItem> {
  const pdf = await openPdfJs(file)
  const output = await PDFDocument.create()
  const scale = preset === 'high' ? 1.05 : 1.45
  const quality = preset === 'high' ? 0.58 : 0.78
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not render this page for compression.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport, canvas }).promise
    const imageBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode this page.')), 'image/jpeg', quality))
    const image = await output.embedJpg(await imageBlob.arrayBuffer())
    const outputPage = output.addPage([baseViewport.width, baseViewport.height])
    outputPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })
    canvas.width = 1
    canvas.height = 1
    onProgress?.(i / pdf.numPages, `Rebuilding page ${i} of ${pdf.numPages}`)
  }
  const bytes = await output.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${cleanName(file.name)}-compressed.pdf` }
}

export async function renderPdfThumbnails(file: File, maxPages = 50, onProgress?: ProgressCallback): Promise<{ page: number; url: string }[]> {
  const pdf = await openPdfJs(file)
  if (pdf.numPages > maxPages) throw new Error(`Page thumbnails are limited to ${maxPages} pages in this browser. You can still use the page range field.`)
  const output: { page: number; url: string }[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 0.32 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create page thumbnails.')
    await page.render({ canvasContext: context, viewport, canvas }).promise
    output.push({ page: pageNumber, url: canvas.toDataURL('image/jpeg', 0.72) })
    canvas.width = 1
    canvas.height = 1
    onProgress?.(pageNumber / pdf.numPages, `Preparing thumbnail ${pageNumber} of ${pdf.numPages}`)
  }
  return output
}

export function triggerDownload(item: DownloadItem) {
  const url = URL.createObjectURL(item.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = item.filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`
}
