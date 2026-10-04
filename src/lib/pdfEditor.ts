import { degrees, PDFDocument, rgb } from 'pdf-lib'
import { assertPdf, enforcePageCount } from './pdf'
import type { DownloadItem } from './pdf'

export type AnnotationKind = 'highlight' | 'underline' | 'draw' | 'rectangle' | 'circle' | 'arrow'

function hexColor(value: string) {
  const match = value.match(/^#?([0-9a-f]{6})$/i)
  const hex = match?.[1] || 'e7c34d'
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255)
}
function safePercent(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)) }

export async function addAnnotation(file: File, kind: AnnotationKind, pageSelection: string, xPercent: number, yPercent: number, widthPercent: number, heightPercent: number, colorHex = '#f0c75e', opacity = 0.35): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  enforcePageCount(pdf.getPageCount())
  const total = pdf.getPageCount()
  const selection = pageSelection.trim() || '1'
  const { parsePageSelection } = await import('./pdf')
  const indices = parsePageSelection(selection, total)
  const color = hexColor(colorHex)
  const alpha = safePercent(opacity, 0.05, 1)
  for (const index of indices) {
    const page = pdf.getPage(index)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const width = pageWidth * safePercent(widthPercent, 2, 95) / 100
    const height = pageHeight * safePercent(heightPercent, 1, 95) / 100
    const left = pageWidth * safePercent(xPercent, 0, 100) / 100
    const top = pageHeight * safePercent(yPercent, 0, 100) / 100
    const x = Math.min(left, pageWidth - width)
    const y = Math.max(0, pageHeight - top - height)
    if (kind === 'highlight') {
      page.drawRectangle({ x, y, width, height, color, opacity: alpha, borderWidth: 0 })
    } else if (kind === 'underline') {
      page.drawLine({ start: { x, y: y + 2 }, end: { x: x + width, y: y + 2 }, thickness: Math.max(1.5, height * 0.12), color, opacity: alpha })
    } else if (kind === 'draw') {
      page.drawLine({ start: { x, y }, end: { x: Math.min(pageWidth, x + width), y: Math.max(0, y - height) }, thickness: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.004), color, opacity: alpha })
    } else if (kind === 'rectangle') {
      page.drawRectangle({ x, y, width, height, borderColor: color, borderWidth: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.003), borderOpacity: alpha })
    } else if (kind === 'circle') {
      page.drawEllipse({ x: x + width / 2, y: y + height / 2, xScale: width / 2, yScale: height / 2, borderColor: color, borderWidth: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.003), borderOpacity: alpha })
    } else if (kind === 'arrow') {
      const start = { x, y }
      const end = { x: Math.min(pageWidth, x + width), y: Math.max(0, y + height) }
      page.drawLine({ start, end, thickness: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.003), color, opacity: alpha })
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const head = Math.min(width, height) * 0.23
      const wing1 = { x: end.x - head * Math.cos(angle - Math.PI / 6), y: end.y - head * Math.sin(angle - Math.PI / 6) }
      const wing2 = { x: end.x - head * Math.cos(angle + Math.PI / 6), y: end.y - head * Math.sin(angle + Math.PI / 6) }
      page.drawLine({ start: end, end: wing1, thickness: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.003), color, opacity: alpha })
      page.drawLine({ start: end, end: wing2, thickness: Math.max(1.5, Math.min(pageWidth, pageHeight) * 0.003), color, opacity: alpha })
    }
  }
  const bytes = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${file.name.replace(/\.pdf$/i, '')}-${kind}.pdf` }
}

export async function cropPdf(file: File, pageSelection: string, leftPercent: number, rightPercent: number, topPercent: number, bottomPercent: number): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  enforcePageCount(pdf.getPageCount())
  const { parsePageSelection } = await import('./pdf')
  const indices = parsePageSelection(pageSelection, pdf.getPageCount())
  const margins = [leftPercent, rightPercent, topPercent, bottomPercent].map((value) => safePercent(value, 0, 45))
  if (margins[0] + margins[1] >= 90 || margins[2] + margins[3] >= 90) throw new Error('Combined crop margins must leave at least 10% of the page visible.')
  for (const index of indices) {
    const page = pdf.getPage(index)
    const width = page.getWidth()
    const height = page.getHeight()
    const left = width * margins[0] / 100
    const right = width * margins[1] / 100
    const bottom = height * margins[3] / 100
    const top = height * margins[2] / 100
    page.setCropBox(left, bottom, width - left - right, height - top - bottom)
  }
  const bytes = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${file.name.replace(/\.pdf$/i, '')}-cropped.pdf` }
}
