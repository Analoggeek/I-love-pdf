import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { DownloadItem } from './pdf'

export type DocumentSection = { heading?: string; paragraphs?: string[]; bullets?: string[] }
export type DocumentDraft = { title: string; subtitle?: string; sections: DocumentSection[] }

function latinSafe(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...')
}

function needsUnicodeFallback(draft: DocumentDraft) {
  const text = [draft.title, draft.subtitle || '', ...draft.sections.flatMap((section) => [section.heading || '', ...(section.paragraphs || []), ...(section.bullets || [])])].map(latinSafe).join(' ')
  return /[^\u0000-\u00ff]/.test(text)
}

async function renderUnicodeDocument(draft: DocumentDraft, pageSize: 'A4' | 'Letter', template: 'classic' | 'modern' | 'compact'): Promise<DownloadItem> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(draft.title.slice(0, 250))
  pdf.setCreator('All in One PDF Tools')
  const [width, height] = pageSize === 'Letter' ? [612, 792] : [595.28, 841.89]
  const scale = 2
  const margin = 56 * scale
  const canvasPages: HTMLCanvasElement[] = []
  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let y = 0
  const newPage = () => {
    canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    canvasPages.push(canvas)
    y = margin
  }
  newPage()
  const nextPageIfNeeded = (heightNeeded: number) => { if (y + heightNeeded > canvas.height - margin) newPage() }
  const drawWrapped = (text: string, font: string, color: string, lineHeight: number, indent = 0) => {
    context.font = font
    context.fillStyle = color
    const maxWidth = canvas.width - margin * 2 - indent
    const words = text.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && context.measureText(candidate).width > maxWidth) {
        nextPageIfNeeded(lineHeight)
        context.font = font
        context.fillStyle = color
        context.fillText(line, margin + indent, y)
        y += lineHeight
        line = word
      } else line = candidate
    }
    if (line) {
      nextPageIfNeeded(lineHeight)
      context.font = font
      context.fillStyle = color
      context.fillText(line, margin + indent, y)
      y += lineHeight
    }
  }
  drawWrapped(draft.title, `700 ${46 * scale / 2}px system-ui, "Noto Sans", sans-serif`, '#1d2a3a', 30 * scale)
  y += 10 * scale
  if (draft.subtitle?.trim()) { drawWrapped(draft.subtitle, `400 ${24 * scale / 2}px system-ui, "Noto Sans", sans-serif`, '#667384', 17 * scale); y += 14 * scale }
  for (const section of draft.sections || []) {
    if (section.heading?.trim()) { y += 12 * scale; drawWrapped(section.heading, `700 ${30 * scale / 2}px system-ui, "Noto Sans", sans-serif`, '#315275', 21 * scale) }
    for (const paragraph of section.paragraphs || []) { if (paragraph.trim()) { drawWrapped(paragraph, `400 ${22 * scale / 2}px system-ui, "Noto Sans", sans-serif`, '#263448', 16 * scale); y += 7 * scale } }
    for (const bullet of section.bullets || []) { if (bullet.trim()) drawWrapped(`•  ${bullet}`, `400 ${22 * scale / 2}px system-ui, "Noto Sans", sans-serif`, '#263448', 16 * scale, 10 * scale) }
  }
  for (let index = 0; index < canvasPages.length; index += 1) {
    const pageCanvas = canvasPages[index]
    const ctx = pageCanvas.getContext('2d')!
    ctx.font = `400 ${18 * scale / 2}px system-ui, sans-serif`
    ctx.fillStyle = '#687485'
    ctx.textAlign = 'center'
    ctx.fillText(String(index + 1), pageCanvas.width / 2, pageCanvas.height - 24 * scale)
  }
  for (const pageCanvas of canvasPages) {
    const blob = await new Promise<Blob>((resolve, reject) => pageCanvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render the Unicode PDF page.')), 'image/png'))
    const image = await pdf.embedPng(await blob.arrayBuffer())
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
    pageCanvas.width = 1
    pageCanvas.height = 1
  }
  const bytes = await pdf.save({ useObjectStreams: true })
  const safeFilename = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document'
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${safeFilename}.pdf` }
}

export async function documentToPdf(draft: DocumentDraft, pageSize: 'A4' | 'Letter' = 'A4', template: 'classic' | 'modern' | 'compact' = 'classic'): Promise<DownloadItem> {
  if (!draft.title?.trim()) throw new Error('Add a title before creating the PDF.')
  if (needsUnicodeFallback(draft)) return renderUnicodeDocument(draft, pageSize, template)
  const pdf = await PDFDocument.create()
  pdf.setTitle(draft.title.slice(0, 250))
  pdf.setCreator('All in One PDF Tools')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const [width, height] = pageSize === 'Letter' ? [612, 792] : [595.28, 841.89]
  const marginX = template === 'compact' ? 42 : 54
  const marginTop = template === 'modern' ? 70 : 62
  const marginBottom = 54
  const lineHeight = template === 'compact' ? 13 : 15
  const titleSize = template === 'modern' ? 27 : template === 'compact' ? 21 : 24
  const bodySize = template === 'compact' ? 9.5 : 10.5
  let page = pdf.addPage([width, height])
  let y = height - marginTop
  let pageNumber = 1
  const ensureSpace = (needed: number) => {
    if (y - needed < marginBottom) {
      page = pdf.addPage([width, height])
      y = height - marginTop
      pageNumber += 1
    }
  }
  const wrap = (text: string, activeFont: typeof font, size: number) => {
    const words = latinSafe(text).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && activeFont.widthOfTextAtSize(next, size) > width - marginX * 2) {
        lines.push(line)
        line = word
      } else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  const drawTextBlock = (text: string, activeFont: typeof font, size: number, indent = 0, color = rgb(0.16, 0.2, 0.26)) => {
    for (const line of wrap(text, activeFont, size)) {
      ensureSpace(lineHeight)
      page.drawText(line, { x: marginX + indent, y: y - lineHeight, font: activeFont, size, color, maxWidth: width - marginX * 2 - indent })
      y -= lineHeight
    }
  }

  if (template === 'modern') page.drawRectangle({ x: marginX, y: height - marginTop + 42, width: 34, height: 4, color: rgb(0.82, 0.29, 0.3) })
  page.drawText(latinSafe(draft.title), { x: marginX, y: y - titleSize - 5, font: bold, size: titleSize, color: template === 'modern' ? rgb(0.15, 0.28, 0.43) : rgb(0.11, 0.16, 0.24), maxWidth: width - marginX * 2 })
  y -= titleSize + 20
  if (draft.subtitle?.trim()) {
    drawTextBlock(draft.subtitle, font, 12, 0, rgb(0.39, 0.43, 0.5))
    y -= 10
  }
  for (const section of draft.sections || []) {
    if (section.heading?.trim()) {
      ensureSpace(36)
      y -= 8
      drawTextBlock(section.heading, bold, template === 'compact' ? 12 : 15, 0, template === 'modern' ? rgb(0.77, 0.29, 0.29) : rgb(0.14, 0.28, 0.45))
      y -= 3
    }
    for (const paragraph of section.paragraphs || []) {
      if (paragraph.trim()) {
        drawTextBlock(paragraph, font, bodySize)
        y -= 5
      }
    }
    for (const bullet of section.bullets || []) {
      if (bullet.trim()) {
        drawTextBlock(`•  ${bullet}`, font, bodySize, 8)
        y -= 1
      }
    }
  }
  for (let i = 0; i < pdf.getPageCount(); i += 1) {
    const current = pdf.getPage(i)
    current.drawText(String(i + 1), { x: width / 2 - 3, y: 24, font, size: 9, color: rgb(0.47, 0.5, 0.56) })
  }
  const bytes = await pdf.save({ useObjectStreams: true })
  const safeFilename = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document'
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${safeFilename}.pdf` }
}
