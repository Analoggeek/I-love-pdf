import { degrees, PDFDocument } from 'pdf-lib'
import { assertPdf, enforcePageCount, parsePageSelection } from './pdf'
import { getClientLimits } from './pdfLimits'
import type { DownloadItem } from './pdf'

async function embedImage(pdf: PDFDocument, imageFile: File) {
  const { maxFileMb } = getClientLimits()
  if (imageFile.size > maxFileMb * 1024 * 1024) throw new Error(`The image exceeds the ${maxFileMb} MB browser processing limit.`)
  const isJpeg = imageFile.type === 'image/jpeg' || /\.jpe?g$/i.test(imageFile.name)
  const isPng = imageFile.type === 'image/png' || /\.png$/i.test(imageFile.name)
  const isWebp = imageFile.type === 'image/webp' || /\.webp$/i.test(imageFile.name)
  if (!isJpeg && !isPng && !isWebp) throw new Error('Choose a PNG, JPEG or WebP image.')
  if (isJpeg) return pdf.embedJpg(await imageFile.arrayBuffer())
  if (isPng) return pdf.embedPng(await imageFile.arrayBuffer())
  const bitmap = await createImageBitmap(imageFile)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read image pixels in this browser.')
  context.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not convert this image.')), 'image/png'))
  bitmap.close()
  return pdf.embedPng(await blob.arrayBuffer())
}

export async function overlayImage(file: File, imageFile: File, pageNumber: number, xPercent: number, yPercent: number, widthPercent: number): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  enforcePageCount(pdf.getPageCount())
  if (!pageNumber || pageNumber > pdf.getPageCount()) throw new Error(`Choose a page between 1 and ${pdf.getPageCount()}.`)
  const image = await embedImage(pdf, imageFile)
  const page = pdf.getPage(pageNumber - 1)
  const width = page.getWidth() * Math.max(0.05, Math.min(0.9, widthPercent / 100))
  const height = width * image.height / image.width
  const x = (page.getWidth() - width) * Math.max(0, Math.min(1, xPercent / 100))
  const y = page.getHeight() * (1 - Math.max(0, Math.min(1, yPercent / 100))) - height
  page.drawImage(image, { x, y, width, height })
  const bytes = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${file.name.replace(/\.pdf$/i, '')}-image.pdf` }
}

export async function addImageWatermark(file: File, imageFile: File, selection: string, opacity: number, widthPercent: number, position: string, rotation: number): Promise<DownloadItem> {
  await assertPdf(file)
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  enforcePageCount(pdf.getPageCount())
  const image = await embedImage(pdf, imageFile)
  const indices = parsePageSelection(selection, pdf.getPageCount())
  for (const index of indices) {
    const page = pdf.getPage(index)
    const width = page.getWidth() * Math.max(0.05, Math.min(0.85, widthPercent / 100))
    const height = width * image.height / image.width
    const margin = 24
    const x = position.endsWith('left') ? margin : position.endsWith('right') ? page.getWidth() - width - margin : (page.getWidth() - width) / 2
    const y = position.startsWith('top') ? page.getHeight() - height - margin : position.startsWith('bottom') ? margin : (page.getHeight() - height) / 2
    page.drawImage(image, { x, y, width, height, opacity: Math.max(0.05, Math.min(0.9, opacity)), rotate: degrees(rotation) })
  }
  const bytes = await pdf.save({ useObjectStreams: true })
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: `${file.name.replace(/\.pdf$/i, '')}-watermarked.pdf` }
}
