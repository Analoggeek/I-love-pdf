import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent, RefObject } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clipboard, Download, FileCheck2, FileQuestion, Info, LoaderCircle, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { AdSlot, CategoryPill, FileDropzone, FileList, ToolCard, ToolIcon } from '../components'
import { categories, toolById, tools } from '../data/tools'
import { apiRequest, reportToolUse, saveHistory } from '../lib/api'
import { getClientLimits, setClientLimits } from '../lib/pdfLimits'
import { documentToPdf } from '../lib/document'
import type { DocumentDraft } from '../lib/document'

type Progress = { value: number; message: string }
type ExportResult = { blob: Blob; filename: string; label?: string }
type AsyncConversionJob = { id: string; status: 'queued' | 'processing' | 'completed' | 'failed'; progress: number; message: string; filename: string; outputFilename: string; expiresAt: string; downloadUrl: string | null }
const ASYNC_CONVERSION_TOOL_IDS = ['pdf-to-word', 'word-to-pdf', 'pdf-to-excel', 'excel-to-pdf', 'pdf-to-ppt', 'ppt-to-pdf']

function useToolMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} — All in One PDF Tools`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', description)
    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', `${window.location.origin}${window.location.pathname.endsWith('/') && window.location.pathname !== '/' ? window.location.pathname.slice(0, -1) : window.location.pathname}`)
    if (!canonical.parentNode) document.head.appendChild(canonical)
    const schema = document.getElementById('tool-structured-data') || document.createElement('script')
    schema.id = 'tool-structured-data'
    schema.setAttribute('type', 'application/ld+json')
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebApplication', name: `All in One PDF Tools — ${title}`, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', description, url: `${window.location.origin}${window.location.pathname}` }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${window.location.origin}/` }, { '@type': 'ListItem', position: 2, name: 'PDF tools', item: `${window.location.origin}/#all-tools` }, { '@type': 'ListItem', position: 3, name: title, item: `${window.location.origin}${window.location.pathname}` }] }] })
    if (!schema.parentNode) document.head.appendChild(schema)
    return () => { schema.remove() }
  }, [title, description])
}

export default function ToolPage() {
  const { toolId = '' } = useParams()
  const tool = toolById(toolId)
  useToolMeta(tool?.title || 'PDF tools', tool?.description || 'Online PDF tools for your documents.')
  useEffect(() => {
    void apiRequest<{ settings: { maxFileMb: number; maxPdfPages: number } }>('/api/settings/public')
      .then(({ settings }) => setClientLimits(Number(settings.maxFileMb), Number(settings.maxPdfPages)))
      .catch(() => undefined)
  }, [])
  if (!tool) return <div className="wrap not-found-tool"><FileQuestion size={34} /><h1>We couldn’t find that tool.</h1><p>Try searching the full PDF toolkit instead.</p><Link className="button button-primary" to="/#tools">Browse PDF tools <ArrowRight size={16} /></Link></div>
  const related = tools.filter((item) => item.category === tool.category && item.id !== tool.id && item.status !== 'service-required').slice(0, 3)
  return (
    <>
      <AdSlot slot="tool-top-banner" format="banner" className="ad-slot-tool-top" />
      <section className="tool-page-hero"><div className="wrap tool-hero-inner"><div className="breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/#all-tools">PDF tools</Link><span>/</span><span>{tool.shortTitle}</span></div><div className="tool-heading-row"><span className={`tool-hero-icon icon-${tool.category}`}><ToolIconForTool tool={tool} /></span><div><CategoryPill id={tool.category} /><h1>{tool.title}</h1><p>{tool.description}</p></div></div></div></section>
      <section className="tool-work-section"><div className="wrap tool-work-layout"><div className="tool-work-main">{tool.status === 'service-required' ? (ASYNC_CONVERSION_TOOL_IDS.includes(tool.id) ? <ConversionJobTool key={tool.id} toolId={tool.id} accept={tool.accept} /> : <ServiceUnavailable toolId={tool.id} />) : tool.category === 'ai' && ['ai-pdf-generator', 'ai-resume', 'ai-report-generator'].includes(tool.id) ? <AiGenerator key={tool.id} toolId={tool.id} /> : tool.category === 'ai' ? <AiPdfWorkspace key={tool.id} toolId={tool.id} accept={tool.accept} /> : <PdfProcessor key={tool.id} tool={tool} />}</div><aside className="tool-side-note"><div className="privacy-card"><span className="privacy-card-icon"><ShieldCheck size={19} /></span><strong>{ASYNC_CONVERSION_TOOL_IDS.includes(tool.id) ? 'Temporary provider processing' : tool.category === 'ai' ? 'Your original stays local' : 'Your file stays yours'}</strong><p>{ASYNC_CONVERSION_TOOL_IDS.includes(tool.id) ? 'When enabled, this job sends only the selected document to the configured conversion provider and private temporary storage. The source is deleted after the job; the result is deleted two minutes after its download finishes (or expires after one hour if not downloaded).' : tool.category === 'ai' ? 'The original PDF stays in your browser; extracted text and your prompt are sent to the configured AI backend and Gemini.' : 'This browser tool processes your file on your device. The original PDF is not uploaded for processing.'}</p><Link to="/privacy">Read our privacy approach <ArrowRight size={14} /></Link></div><div className="tool-tip-card"><span><Info size={16} /> A helpful note</span><p>{tool.id === 'pdf-editor' ? 'This is an overlay editor. It adds new objects; it does not directly change existing text objects in the PDF.' : tool.id === 'sign-pdf' ? 'An electronic signature image is not a qualified or government-certified digital signature.' : 'Keep an original copy until you have checked the downloaded result.'}</p></div></aside></div></section>
      <AdSlot slot="tool-native" format="native" className="ad-slot-tool-native" />
      {related.length > 0 && <section className="section related-section"><div className="wrap"><div className="section-heading section-heading-row"><div><span className="section-kicker">KEEP YOUR MOMENTUM</span><h2>Related tools</h2></div><Link to="/#all-tools" className="text-link">All tools <ArrowRight size={16} /></Link></div><div className="related-grid">{related.map((item) => <ToolCard tool={item} key={item.id} />)}</div></div></section>}
      <ToolSeoFooter tool={tool} />
    </>
  )
}

function ToolIconForTool({ tool }: { tool: NonNullable<ReturnType<typeof toolById>> }) {
  return <ToolIcon name={tool.icon} size={22} />
}

function ServiceUnavailable({ toolId }: { toolId: string }) {
  const messages: Record<string, string> = {
    'pdf-to-word': 'PDF to Word conversion is temporarily unavailable. A genuine, layout-aware conversion engine is not connected, so no file will be renamed or returned as a fake conversion.',
    'word-to-pdf': 'Word to PDF conversion is temporarily unavailable because this deployment has no document conversion engine configured.',
    'pdf-to-excel': 'PDF to Excel requires reliable table extraction. No table conversion service is configured for this deployment.',
    'excel-to-pdf': 'Excel to PDF conversion is temporarily unavailable because this deployment has no spreadsheet conversion engine configured.',
    'pdf-to-ppt': 'PDF to PowerPoint conversion is temporarily unavailable because this deployment has no presentation conversion engine configured.',
    'ppt-to-pdf': 'PowerPoint to PDF conversion is temporarily unavailable because this deployment has no presentation conversion engine configured.',
    'protect-pdf': 'Password encryption is not enabled here. We will not claim a PDF is protected without a vetted encryption engine.',
    'unlock-pdf': 'Password removal is not enabled here. Use a trusted PDF application and only remove protection from a file you are authorized to access.',
    'redact-pdf': 'Secure redaction is not enabled in this browser build. We do not provide a black-box overlay that leaves the original text recoverable.',
  }
  return <div className="service-unavailable"><span className="service-illustration"><FileQuestion size={29} /></span><span className="section-kicker">SERVICE NOT CONFIGURED</span><h2>This tool isn’t available yet</h2><p>{messages[toolId] || 'This feature requires a secure conversion service that is not configured in this deployment.'}</p><div className="service-checklist"><span><Check size={15} /> No fake file conversion</span><span><Check size={15} /> Your original is never altered</span><span><Check size={15} /> Other browser tools are ready to use</span></div><Link className="button button-outline" to="/#tools">Explore available tools <ArrowRight size={16} /></Link></div>
}

function ConversionJobTool({ toolId, accept }: { toolId: string; accept?: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [job, setJob] = useState<AsyncConversionJob | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [maxFileMb, setMaxFileMb] = useState(100)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const activeJobId = useRef<string | null>(null)
  const pollTimer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    void apiRequest<{ settings: { conversionConfigured?: boolean; maxFileMb?: number } }>('/api/settings/public')
      .then(({ settings }) => { if (alive) { setConfigured(Boolean(settings.conversionConfigured)); setMaxFileMb(Number(settings.maxFileMb) || 100) } })
      .catch(() => { if (alive) setConfigured(false) })
    return () => { alive = false; if (pollTimer.current !== null) window.clearTimeout(pollTimer.current); activeJobId.current = null }
  }, [])

  const poll = async (jobId: string, attempt = 0) => {
    if (activeJobId.current !== jobId) return
    try {
      const response = await apiRequest<{ job: AsyncConversionJob }>(`/api/jobs/${jobId}`)
      if (activeJobId.current !== jobId) return
      setJob(response.job)
      setError('')
      if (response.job.status === 'completed' || response.job.status === 'failed') { activeJobId.current = null; return }
    } catch (cause) {
      const status = Number((cause as { status?: number })?.status || 0)
      if (status >= 400 && status < 500) { activeJobId.current = null; setError(errorMessage(cause)); return }
      setError('Connection interrupted. We’ll keep checking the job status.')
    }
    const delay = Math.min(8000, Math.round(1200 * Math.pow(1.5, Math.min(attempt, 5))))
    pollTimer.current = window.setTimeout(() => void poll(jobId, attempt + 1), delay)
  }

  const start = async (event: FormEvent) => {
    event.preventDefault()
    if (!files[0]) { setError('Choose one document to convert.'); return }
    setBusy(true); setError('')
    try {
      const body = new FormData()
      body.set('file', files[0])
      body.set('toolId', toolId)
      const response = await apiRequest<{ job: AsyncConversionJob }>('/api/jobs', { method: 'POST', body })
      setJob(response.job)
      activeJobId.current = response.job.id
      void poll(response.job.id)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  const reset = () => {
    activeJobId.current = null
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current)
    pollTimer.current = null
    setJob(null); setFiles([]); setError('')
  }

  const download = async () => {
    if (!job?.downloadUrl) return
    setDownloading(true); setError('')
    try {
      const response = await fetch(job.downloadUrl, { credentials: 'same-origin', referrerPolicy: 'no-referrer' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error?.message || 'The temporary result could not be downloaded.')
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl; anchor.download = job.outputFilename || 'converted-document'; anchor.rel = 'noopener'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      reportToolUse(toolId, anchor.download)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setDownloading(false) }
  }

  if (configured !== true) return <div className="service-unavailable"><span className="service-illustration"><FileQuestion size={29} /></span><span className="section-kicker">{configured === false ? 'CONVERSION BACKEND NOT CONFIGURED' : 'CHECKING CONVERSION SERVICE'}</span><h2>{configured === false ? 'This tool isn’t available yet' : 'Checking availability…'}</h2><p>{configured === false ? 'This conversion needs a real document-conversion provider, a background job queue, and private temporary storage. No file will be uploaded until those services are configured.' : 'Checking whether the asynchronous conversion service is ready.'}</p><div className="service-checklist"><span><Check size={15} /> Browser-first tools stay available</span><span><Check size={15} /> No fake file conversion</span></div><Link className="button button-outline" to="/#tools">Explore available tools <ArrowRight size={16} /></Link></div>

  return <div className="processor-card conversion-job-card"><div className="processor-heading"><div><span className="section-kicker"><FileCheck2 size={13} /> ASYNC CONVERSION</span><h2>{job ? 'Conversion job' : 'Convert your document'}</h2><p>Heavy conversion runs in a background queue; this page checks its status without holding the upload request open.</p></div><span className="local-badge"><ShieldCheck size={14} /> Temporary storage</span></div>
    {!job && <form className="conversion-job-form" onSubmit={start}><FileDropzone accept={accept} files={files} multiple={false} onFiles={setFiles} title="Choose a document to convert" subtitle="Only this submitted conversion file uses private temporary server storage" privacyFootnote={`Upload limit: ${maxFileMb} MB · results are deleted two minutes after download`} /><FileList files={files} onRemove={() => setFiles([])} /><div className="ai-disclosure"><Info size={15} /><span>Simple PDF tools remain in your browser. This upload is sent only to the configured conversion worker and provider, not Gemini. The source is deleted after conversion; the result is removed two minutes after its download finishes, or after one hour if never downloaded.</span></div>{error && <div className="inline-feedback" role="alert"><CircleAlert size={16} />{error}</div>}<button className="button button-primary button-process" type="submit" disabled={busy || !files.length}>{busy ? <><LoaderCircle className="spin" size={17} /> Queueing job…</> : <>Start conversion <ArrowRight size={17} /></>}</button></form>}
    {job && <div className="conversion-job-status"><div className="job-status-top"><div><span className={`status-badge status-${job.status}`}>{job.status}</span><h3>{job.status === 'completed' ? 'Your file is ready' : job.status === 'failed' ? 'Conversion didn’t finish' : 'Your file is being processed…'}</h3><p>{job.message}</p></div><span className="job-progress-number">{job.status === 'failed' ? '—' : `${job.progress}%`}</span></div>{(job.status === 'queued' || job.status === 'processing') && <div className="processing-progress" role="status"><div className="progress-line"><span className={job.status === 'queued' ? 'progress-indeterminate' : ''} style={job.status === 'queued' ? undefined : { width: `${job.progress}%` }} /></div><div className="progress-caption"><LoaderCircle className="spin" size={14} />{job.status === 'queued' ? 'Queued. Your file will be picked up shortly.' : 'Working in the background. You can leave this tab open.'}</div></div>}{job.status === 'completed' && <div className="job-complete-panel"><Check size={17} /><span><strong>{job.outputFilename}</strong><small>Download before {new Date(job.expiresAt).toLocaleString()}.</small></span><button className="button button-primary" onClick={() => void download()} disabled={downloading}>{downloading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} {downloading ? 'Preparing…' : 'Download'}</button></div>}{job.status === 'failed' && <div className="inline-feedback" role="status"><CircleAlert size={16} />{job.message || 'The conversion failed. Check the input file and try again.'}</div>}{error && <div className="inline-feedback" role="alert"><CircleAlert size={16} />{error}</div>}{(job.status === 'failed' || job.status === 'completed') && <button className="text-button" type="button" onClick={reset}><RefreshCw size={14} /> Start another conversion</button>}</div>}
  </div>
}

function PdfProcessor({ tool }: { tool: NonNullable<ReturnType<typeof toolById>> }) {
  const [files, setFiles] = useState<File[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExportResult | null>(null)
  const [textOutput, setTextOutput] = useState('')
  const [detailOutput, setDetailOutput] = useState<any>(null)
  const [pageRange, setPageRange] = useState('')
  const [sequence, setSequence] = useState('')
  const [compression, setCompression] = useState<'optimize' | 'medium' | 'high'>('optimize')
  const [resolution, setResolution] = useState('1.5')
  const [ocrLanguage, setOcrLanguage] = useState('eng')
  const [imageQuality, setImageQuality] = useState('0.88')
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [watermarkMode, setWatermarkMode] = useState<'text' | 'image'>('text')
  const [watermarkImageWidth, setWatermarkImageWidth] = useState('24')
  const [opacity, setOpacity] = useState('0.18')
  const [watermarkSize, setWatermarkSize] = useState('44')
  const [watermarkPosition, setWatermarkPosition] = useState('center')
  const [rotation, setRotation] = useState('30')
  const [textOverlay, setTextOverlay] = useState('')
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center')
  const [annotationX, setAnnotationX] = useState('15')
  const [annotationY, setAnnotationY] = useState('22')
  const [annotationWidth, setAnnotationWidth] = useState('48')
  const [annotationHeight, setAnnotationHeight] = useState('8')
  const [annotationColor, setAnnotationColor] = useState('#f0c75e')
  const [annotationOpacity, setAnnotationOpacity] = useState('0.35')
  const [shapeType, setShapeType] = useState<'rectangle' | 'circle' | 'arrow'>('rectangle')
  const [cropLeft, setCropLeft] = useState('0')
  const [cropRight, setCropRight] = useState('0')
  const [cropTop, setCropTop] = useState('0')
  const [cropBottom, setCropBottom] = useState('0')
  const [numberPosition, setNumberPosition] = useState('bottom-center')
  const [numberFormat, setNumberFormat] = useState('plain')
  const [numberStart, setNumberStart] = useState('1')
  const [imagePageSize, setImagePageSize] = useState('a4')
  const [imageOrientation, setImageOrientation] = useState('portrait')
  const [imageMargin, setImageMargin] = useState('10')
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('draw')
  const [signatureType, setSignatureType] = useState('Your signature')
  const [signatureUpload, setSignatureUpload] = useState<File | null>(null)
  const [signPage, setSignPage] = useState('1')
  const [signX, setSignX] = useState('10')
  const [signY, setSignY] = useState('70')
  const [signWidth, setSignWidth] = useState('32')
  const [signRotation, setSignRotation] = useState('0')
  const [metadata, setMetadata] = useState<any>(null)
  const [metadataTitle, setMetadataTitle] = useState('')
  const [metadataAuthor, setMetadataAuthor] = useState('')
  const [metadataSubject, setMetadataSubject] = useState('')
  const [metadataKeywords, setMetadataKeywords] = useState('')
  const [thumbnails, setThumbnails] = useState<{ page: number; url: string }[]>([])
  const [thumbLoading, setThumbLoading] = useState(false)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [orderedPages, setOrderedPages] = useState<number[]>([])
  const [presetInfo, setPresetInfo] = useState<{ original: number; output: number } | null>(null)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const selectedFile = files[0]
  const multiple = tool.multiple || tool.id === 'merge-pdf' || ['jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf'].includes(tool.id)
  const isImageToPdf = ['jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf'].includes(tool.id)
  const isPageManager = ['extract-pages', 'delete-pages', 'reorder-pages', 'duplicate-pages', 'rotate-pdf', 'highlight-pdf', 'underline-pdf', 'draw-pdf', 'shapes-pdf', 'crop-pdf', 'watermark'].includes(tool.id)
  const isTextOutput = ['extract-text', 'pdf-to-txt', 'word-counter', 'character-counter', 'pdf-ocr'].includes(tool.id)
  const allowPdfSelection = !isImageToPdf

  useEffect(() => {
    setResult(null); setTextOutput(''); setDetailOutput(null); setError(''); setMetadata(null); setPresetInfo(null)
  }, [tool.id])

  useEffect(() => {
    if (!selectedFile || !isPageManager) { setThumbnails([]); setSelectedPages([]); setOrderedPages([]); return }
    let cancelled = false
    setThumbLoading(true)
    setThumbnails([])
    void import('../lib/pdf').then(({ renderPdfThumbnails }) => renderPdfThumbnails(selectedFile, 50, (value, message) => { if (!cancelled) setProgress({ value, message: message || '' }) })).then((items) => {
      if (cancelled) return
      setThumbnails(items)
      const all = items.map((item) => item.page)
      setOrderedPages(all)
      setSequence(all.join(','))
      setProgress(null)
    }).catch((cause) => { if (!cancelled) setError(errorMessage(cause)) }).finally(() => { if (!cancelled) setThumbLoading(false) })
    return () => { cancelled = true }
  }, [selectedFile, isPageManager])

  const addFiles = (next: File[]) => {
    setError(''); setResult(null); setTextOutput(''); setDetailOutput(null); setMetadata(null)
    const { maxFileMb } = getClientLimits()
    const over = next.find((file) => file.size > maxFileMb * 1024 * 1024)
    if (over) { setError(`${over.name} exceeds the ${maxFileMb} MB browser processing limit.`); return }
    setFiles(next)
    setSelectedPages([])
    setOrderedPages([])
    if (next.length === 1 && tool.id === 'reorder-pages') setSequence('')
  }
  const removeFile = (index: number) => setFiles((current) => current.filter((_, i) => i !== index))
  const moveFile = (index: number, direction: number) => setFiles((current) => {
    const updated = [...current]; const target = index + direction
    if (target < 0 || target >= updated.length) return updated
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    return updated
  })
  const togglePage = (page: number) => setSelectedPages((current) => {
    const next = current.includes(page) ? current.filter((value) => value !== page) : [...current, page].sort((a, b) => a - b)
    setPageRange(next.join(','))
    return next
  })
  const movePage = (index: number, direction: number) => setOrderedPages((current) => {
    const next = [...current]; const target = index + direction
    if (target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    setSequence(next.join(','))
    return next
  })

  const process = async (event?: FormEvent) => {
    event?.preventDefault()
    setError(''); setResult(null); setTextOutput(''); setDetailOutput(null); setPresetInfo(null)
    if (!files.length && !isImageToPdf) { setError('Choose a file to get started.'); return }
    if (isImageToPdf && !files.length) { setError('Choose at least one image to make a PDF.'); return }
    setBusy(true); setProgress({ value: 0, message: 'Preparing your file…' })
    const reportProgress = (value: number, message?: string) => setProgress({ value: Math.max(0, Math.min(1, value)), message: message || 'Working on your PDF…' })
    try {
      const pdf = await import('../lib/pdf')
      const first = files[0]
      let output: ExportResult | null = null
      const selection = pageRange.trim() || selectedPages.join(',')
      switch (tool.id) {
        case 'merge-pdf':
          output = await pdf.mergePdfs(files, reportProgress); break
        case 'split-pdf':
          output = await pdf.splitPdf(first, pageRange, reportProgress); break
        case 'extract-pages':
          output = await pdf.extractPdfPages(first, selection); break
        case 'delete-pages':
          if (!selection) throw new Error('Choose the pages you want to delete.')
          output = await pdf.deletePdfPages(first, selection); break
        case 'reorder-pages':
          output = await pdf.reorderPdfPages(first, sequence); break
        case 'duplicate-pages':
          output = await pdf.duplicatePdfPages(first, sequence); break
        case 'rotate-pdf':
          output = await pdf.rotatePdf(first, selection, Number(rotation) || 90); break
        case 'compress-pdf': {
          const originalSize = first.size
          output = compression === 'optimize' ? await pdf.optimizePdf(first) : await pdf.rasterCompressPdf(first, compression, reportProgress)
          setPresetInfo({ original: originalSize, output: output.blob.size })
          break
        }
        case 'pdf-to-jpg': case 'pdf-to-png': case 'pdf-to-webp': {
          const format = tool.id === 'pdf-to-jpg' ? 'image/jpeg' : tool.id === 'pdf-to-webp' ? 'image/webp' : 'image/png'
          const images = await pdf.renderPdfPages(first, Number(resolution), format, Number(imageQuality), pageRange, reportProgress)
          output = await pdf.imagesToZip(images, `${first.name.replace(/\.pdf$/i, '')}-${tool.id.replace('pdf-to-', '')}.zip`)
          break
        }
        case 'jpg-to-pdf': case 'png-to-pdf': case 'webp-to-pdf':
          output = await pdf.imageFilesToPdf(files, imagePageSize, imageOrientation, Number(imageMargin)); break
        case 'pdf-to-txt': case 'extract-text': case 'word-counter': case 'character-counter': {
          const text = await pdf.extractPdfText(first, reportProgress)
          setTextOutput(text)
          if (!text.trim()) setDetailOutput({ scanned: true, message: 'This PDF appears to be image-based. Try OCR PDF to recognize text.' })
          if (tool.id === 'word-counter') setDetailOutput({ words: text.trim() ? text.trim().split(/\s+/).length : 0, characters: text.length, pages: (text.match(/--- Page /g) || []).length })
          if (tool.id === 'character-counter') setDetailOutput({ characters: text.length, charactersNoSpaces: text.replace(/\s/g, '').length, pages: (text.match(/--- Page /g) || []).length })
          output = { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${first.name.replace(/\.pdf$/i, '')}.txt` }
          break
        }
        case 'pdf-ocr': {
          const text = await pdf.runOcr(first, ocrLanguage, reportProgress)
          setTextOutput(text)
          output = { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${first.name.replace(/\.pdf$/i, '')}-ocr.txt` }
          break
        }
        case 'page-counter': case 'metadata-viewer': {
          const info = await pdf.inspectPdf(first)
          setMetadata(info); setMetadataTitle(info.title); setMetadataAuthor(info.author); setMetadataSubject(info.subject); setMetadataKeywords(info.keywords)
          setDetailOutput(info)
          break
        }
        case 'highlight-pdf': case 'underline-pdf': case 'draw-pdf': case 'shapes-pdf': {
          const { addAnnotation } = await import('../lib/pdfEditor')
          const kind = tool.id === 'shapes-pdf' ? shapeType : tool.id === 'highlight-pdf' ? 'highlight' : tool.id === 'underline-pdf' ? 'underline' : 'draw'
          output = await addAnnotation(first, kind, selection, Number(annotationX), Number(annotationY), Number(annotationWidth), Number(annotationHeight), annotationColor, Number(annotationOpacity))
          break
        }
        case 'crop-pdf': {
          const { cropPdf } = await import('../lib/pdfEditor')
          output = await cropPdf(first, selection, Number(cropLeft), Number(cropRight), Number(cropTop), Number(cropBottom))
          break
        }
        case 'watermark':
          if (watermarkMode === 'image') {
            if (!imageFile) throw new Error('Choose the image to use as a watermark.')
            const { addImageWatermark } = await import('../lib/imageOverlay')
            output = await addImageWatermark(first, imageFile, selection, Number(opacity), Number(watermarkImageWidth), watermarkPosition, Number(rotation))
          } else output = await pdf.addWatermark(first, watermark, selection, Number(opacity), Number(watermarkSize), Number(rotation), watermarkPosition)
          break
        case 'page-numbers':
          output = await pdf.addPageNumbers(first, numberPosition, numberFormat, Number(numberStart) || 1); break
        case 'add-text': case 'pdf-editor':
          output = await pdf.addTextOverlay(first, textOverlay, selection, textPosition); break
        case 'add-image': {
          if (!imageFile) throw new Error('Choose the image you want to place on your PDF.')
          const { overlayImage } = await import('../lib/imageOverlay')
          output = await overlayImage(first, imageFile, Number(signPage) || 1, Number(signX), Number(signY), Number(signWidth))
          break
        }
        case 'sign-pdf': {
          const signature = await createSignatureBlob(signatureMode, signatureCanvasRef.current, signatureType, signatureUpload)
          const signatureFile = await pdf.addSignature(first, signature, Number(signPage), Number(signX), Number(signY), Number(signWidth), Number(signRotation))
          output = signatureFile
          break
        }
        default: throw new Error('This tool is not available in the current browser build.')
      }
      if (output) {
        setResult(output)
        reportToolUse(tool.id, first?.name || files.map((file) => file.name).join(', '))
        await saveHistory(tool.id, first?.name || files.map((file) => file.name).join(', '))
      }
      setProgress(null)
    } catch (cause) {
      setError(errorMessage(cause))
      setProgress(null)
    } finally {
      setBusy(false)
    }
  }

  const downloadResult = async () => {
    if (!result) return
    const { triggerDownload } = await import('../lib/pdf')
    triggerDownload(result)
  }
  const copyText = async () => {
    try { await navigator.clipboard.writeText(textOutput); setError('Text copied to clipboard.') }
    catch { setError('Clipboard access is unavailable. Select the text and copy it manually.') }
  }
  const reset = () => { setFiles([]); setResult(null); setTextOutput(''); setError(''); setProgress(null); setDetailOutput(null); setMetadata(null); setThumbnails([]); setSelectedPages([]); setPageRange('') }

  return <div className="processor-card">
    <div className="processor-heading"><div><span className="section-kicker">{isImageToPdf ? 'IMAGE CONVERSION' : tool.category === 'analyze' ? 'DOCUMENT ANALYSIS' : tool.category === 'secure' ? 'SIGNATURE WORKFLOW' : 'BROWSER PROCESSING'}</span><h2>{result ? 'Your result is ready' : 'Set up your file'}</h2><p>{result ? 'Download the processed copy. Your original is unchanged.' : tool.id === 'merge-pdf' ? 'Add PDFs, arrange the order, and create one combined file.' : tool.id === 'sign-pdf' ? 'Create an electronic signature and place it on the page you choose.' : 'Choose a file and adjust the options below.'}</p></div><span className="local-badge"><ShieldCheck size={14} /> On your device</span></div>
    {!result && <form onSubmit={process}>
      <FileDropzone accept={tool.accept} multiple={multiple} files={files} onFiles={addFiles} title={isImageToPdf ? 'Drop your images here' : multiple ? 'Drop your files here' : 'Drop your PDF here'} subtitle={isImageToPdf ? 'JPG, PNG or WebP images' : 'or choose from your device'} />
      <FileList files={files} onRemove={removeFile} onMove={multiple ? moveFile : undefined} multiple={multiple} />

      {isPageManager && thumbnails.length > 0 && <PagePicker toolId={tool.id} thumbnails={thumbnails} selected={selectedPages} onToggle={togglePage} order={orderedPages} onMove={movePage} />}
      {thumbLoading && <div className="mini-progress"><span className="spinner spinner-small" /> Preparing page thumbnails…</div>}

      {tool.id === 'split-pdf' && <div className="field-group"><label htmlFor="split-ranges">Page ranges <span className="optional-label">Optional</span></label><input id="split-ranges" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="Blank = one PDF per page; e.g. 1-3; 5; 8-10" /><small>Use commas within each output, semicolons to create separate PDFs. Separate PDFs are packaged as a ZIP.</small></div>}
      {['extract-pages', 'delete-pages', 'rotate-pdf', 'watermark', 'highlight-pdf', 'underline-pdf', 'draw-pdf', 'shapes-pdf', 'crop-pdf'].includes(tool.id) && <div className="field-group"><label htmlFor="page-range">Pages <span className="optional-label">{tool.id === 'delete-pages' ? 'Required' : ['highlight-pdf', 'underline-pdf', 'draw-pdf', 'shapes-pdf'].includes(tool.id) ? 'Optional — defaults to page 1' : 'Optional — defaults to all'}</span></label><input id="page-range" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="For example: 1-3,5,8-10" /><small>Select thumbnails above or enter page numbers and ranges separated by commas.</small></div>}
      {['reorder-pages', 'duplicate-pages'].includes(tool.id) && <div className="field-group"><label htmlFor="page-order">Page order</label><input id="page-order" value={sequence} onChange={(event) => setSequence(event.target.value)} placeholder="For example: 3,1,2" /><small>{tool.id === 'reorder-pages' ? 'Enter every page number once in the order you want.' : 'List any pages in order. Repeat a number to duplicate that page.'}</small></div>}
      {tool.id === 'rotate-pdf' && <div className="field-group"><label htmlFor="rotate-degrees">Rotation</label><select id="rotate-degrees" value={rotation} onChange={(event) => setRotation(event.target.value)}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° counter-clockwise</option></select></div>}
      {tool.id === 'pdf-ocr' && <div className="field-group"><label htmlFor="ocr-language">Recognition language</label><select id="ocr-language" value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)}><option value="eng">English</option><option value="hin">Hindi</option><option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="por">Portuguese</option></select><small>OCR language data is downloaded on demand by Tesseract.js.</small></div>}
      {tool.id === 'compress-pdf' && <div className="field-group"><label>Compression approach</label><div className="choice-cards">
        <button type="button" className={`choice-card ${compression === 'optimize' ? 'choice-selected' : ''}`} onClick={() => setCompression('optimize')}><span className="choice-radio" /><strong>Best quality</strong><small>Optimize PDF structure; preserves selectable text where possible.</small><em>Start here</em></button>
        <button type="button" className={`choice-card ${compression === 'medium' ? 'choice-selected' : ''}`} onClick={() => setCompression('medium')}><span className="choice-radio" /><strong>Recommended</strong><small>Rasterizes pages at moderate resolution. Text becomes image content.</small><em>Medium</em></button>
        <button type="button" className={`choice-card ${compression === 'high' ? 'choice-selected' : ''}`} onClick={() => setCompression('high')}><span className="choice-radio" /><strong>Smallest size</strong><small>Rasterizes pages with lower image quality; review fine details.</small><em>High compression</em></button>
      </div><div className="inline-note"><Info size={15} /> The final size depends on your source. Compression may not reduce an already-optimized file.</div></div>}
      {['pdf-to-jpg', 'pdf-to-png', 'pdf-to-webp'].includes(tool.id) && <div className="form-grid"><div className="field-group"><label htmlFor="image-resolution">Resolution</label><select id="image-resolution" value={resolution} onChange={(event) => setResolution(event.target.value)}><option value="1">Standard — 72 DPI</option><option value="1.5">High — 108 DPI</option><option value="2">Print — 144 DPI</option></select></div><div className="field-group"><label htmlFor="image-quality">JPEG / WebP quality</label><select id="image-quality" value={imageQuality} onChange={(event) => setImageQuality(event.target.value)}><option value="0.72">Smaller file</option><option value="0.88">Balanced</option><option value="0.96">Highest quality</option></select></div><div className="field-group form-span"><label htmlFor="image-pages">Pages <span className="optional-label">Optional — default all</span></label><input id="image-pages" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="For example: 1-3,5" /></div></div>}
      {isImageToPdf && <div className="form-grid"><div className="field-group"><label htmlFor="image-page-size">Page size</label><select id="image-page-size" value={imagePageSize} onChange={(event) => setImagePageSize(event.target.value)}><option value="a4">A4</option><option value="letter">Letter</option><option value="original">Original image size</option></select></div><div className="field-group"><label htmlFor="image-orientation">Orientation</label><select id="image-orientation" value={imageOrientation} onChange={(event) => setImageOrientation(event.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><div className="field-group"><label htmlFor="image-margin">Margin (mm)</label><input id="image-margin" type="number" min="0" max="40" value={imageMargin} onChange={(event) => setImageMargin(event.target.value)} /></div><div className="inline-note form-span"><Info size={15} /> Images are fitted and centered on each page. WebP images are converted to PNG before embedding.</div></div>}
      {['highlight-pdf', 'underline-pdf', 'draw-pdf', 'shapes-pdf'].includes(tool.id) && <div className="form-grid"><div className="field-group"><label htmlFor="annotation-x">Left position (%)</label><input id="annotation-x" type="number" min="0" max="100" value={annotationX} onChange={(event) => setAnnotationX(event.target.value)} /></div><div className="field-group"><label htmlFor="annotation-y">Top position (%)</label><input id="annotation-y" type="number" min="0" max="100" value={annotationY} onChange={(event) => setAnnotationY(event.target.value)} /></div><div className="field-group"><label htmlFor="annotation-width">Width (% of page)</label><input id="annotation-width" type="number" min="2" max="95" value={annotationWidth} onChange={(event) => setAnnotationWidth(event.target.value)} /></div><div className="field-group"><label htmlFor="annotation-height">Height (% of page)</label><input id="annotation-height" type="number" min="1" max="95" value={annotationHeight} onChange={(event) => setAnnotationHeight(event.target.value)} /></div><div className="field-group"><label htmlFor="annotation-color">Mark color</label><input id="annotation-color" type="color" value={annotationColor} onChange={(event) => setAnnotationColor(event.target.value)} /></div><div className="field-group"><label htmlFor="annotation-opacity">Opacity <span>{Math.round(Number(annotationOpacity) * 100)}%</span></label><input id="annotation-opacity" type="range" min="0.1" max="1" step="0.05" value={annotationOpacity} onChange={(event) => setAnnotationOpacity(event.target.value)} /></div>{tool.id === 'shapes-pdf' && <div className="field-group"><label htmlFor="shape-kind">Shape</label><select id="shape-kind" value={shapeType} onChange={(event) => setShapeType(event.target.value as any)}><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="arrow">Arrow</option></select></div>}<div className="inline-note form-span"><Info size={15} /> Placement uses percentages of the page (from the left and top). Review the downloaded PDF; marks are added as overlays.</div></div>}
      {tool.id === 'crop-pdf' && <div className="form-grid crop-grid"><div className="field-group"><label htmlFor="crop-left">Left margin (%)</label><input id="crop-left" type="number" min="0" max="45" value={cropLeft} onChange={(event) => setCropLeft(event.target.value)} /></div><div className="field-group"><label htmlFor="crop-right">Right margin (%)</label><input id="crop-right" type="number" min="0" max="45" value={cropRight} onChange={(event) => setCropRight(event.target.value)} /></div><div className="field-group"><label htmlFor="crop-top">Top margin (%)</label><input id="crop-top" type="number" min="0" max="45" value={cropTop} onChange={(event) => setCropTop(event.target.value)} /></div><div className="field-group"><label htmlFor="crop-bottom">Bottom margin (%)</label><input id="crop-bottom" type="number" min="0" max="45" value={cropBottom} onChange={(event) => setCropBottom(event.target.value)} /></div><div className="inline-note form-span"><Info size={15} /> Cropping changes the visible page area only. It does not securely erase data outside the crop box.</div></div>}
      {tool.id === 'watermark' && <div className="form-grid"><div className="field-group form-span"><label htmlFor="watermark-mode">Watermark type</label><select id="watermark-mode" value={watermarkMode} onChange={(event) => setWatermarkMode(event.target.value as 'text' | 'image')}><option value="text">Text watermark</option><option value="image">Image watermark</option></select></div>{watermarkMode === 'text' ? <div className="field-group form-span"><label htmlFor="watermark-text">Watermark text</label><input id="watermark-text" value={watermark} onChange={(event) => setWatermark(event.target.value)} maxLength={80} /></div> : <div className="form-span secondary-upload"><FileDropzone accept="image/png,image/jpeg,image/webp" files={imageFile ? [imageFile] : []} onFiles={(next) => setImageFile(next[0] || null)} title="Choose a watermark image" subtitle="Transparent PNG works well" /><FileList files={imageFile ? [imageFile] : []} onRemove={() => setImageFile(null)} /></div>}<div className="field-group"><label htmlFor="watermark-opacity">Opacity <span>{Math.round(Number(opacity) * 100)}%</span></label><input id="watermark-opacity" type="range" min="0.05" max="0.85" step="0.01" value={opacity} onChange={(event) => setOpacity(event.target.value)} /></div><div className="field-group"><label htmlFor="watermark-size">{watermarkMode === 'text' ? 'Text size' : 'Image width (% of page)'}</label>{watermarkMode === 'text' ? <input id="watermark-size" type="number" min="12" max="96" value={watermarkSize} onChange={(event) => setWatermarkSize(event.target.value)} /> : <input id="watermark-size" type="number" min="5" max="85" value={watermarkImageWidth} onChange={(event) => setWatermarkImageWidth(event.target.value)} />}</div><div className="field-group"><label htmlFor="watermark-position">Position</label><select id="watermark-position" value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value)}><option value="center">Center</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></div><div className="field-group"><label htmlFor="watermark-angle">Rotation</label><select id="watermark-angle" value={rotation} onChange={(event) => setRotation(event.target.value)}><option value="0">0°</option><option value="30">30°</option><option value="-30">-30°</option><option value="45">45°</option></select></div></div>}
      {tool.id === 'page-numbers' && <div className="form-grid"><div className="field-group"><label htmlFor="number-position">Position</label><select id="number-position" value={numberPosition} onChange={(event) => setNumberPosition(event.target.value)}>{['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((item) => <option key={item} value={item}>{item.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</option>)}</select></div><div className="field-group"><label htmlFor="number-format">Format</label><select id="number-format" value={numberFormat} onChange={(event) => setNumberFormat(event.target.value)}><option value="plain">1</option><option value="page">Page 1</option><option value="page-of">Page 1 of 10</option></select></div><div className="field-group"><label htmlFor="number-start">Start at</label><input id="number-start" type="number" min="1" max="9999" value={numberStart} onChange={(event) => setNumberStart(event.target.value)} /></div></div>}
      {['add-text', 'pdf-editor'].includes(tool.id) && <div className="form-grid"><div className="field-group form-span"><label htmlFor="overlay-text">Text to add</label><textarea id="overlay-text" value={textOverlay} onChange={(event) => setTextOverlay(event.target.value)} placeholder="Type the text overlay…" rows={3} maxLength={600} /><small>This adds new text on top of the page. It does not edit existing PDF text.</small></div><div className="field-group"><label htmlFor="overlay-position">Vertical placement</label><select id="overlay-position" value={textPosition} onChange={(event) => setTextPosition(event.target.value as any)}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></div><div className="field-group"><label htmlFor="overlay-pages">Pages <span className="optional-label">Optional</span></label><input id="overlay-pages" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="Blank = all pages" /></div></div>}
      {tool.id === 'add-image' && <><div className="secondary-upload"><FileDropzone accept="image/png,image/jpeg,image/webp" files={imageFile ? [imageFile] : []} onFiles={(next) => setImageFile(next[0] || null)} title="Choose an image overlay" subtitle="PNG, JPEG or WebP" /><FileList files={imageFile ? [imageFile] : []} onRemove={() => setImageFile(null)} /></div><PlacementFields page={signPage} setPage={setSignPage} x={signX} setX={setSignX} y={signY} setY={setSignY} width={signWidth} setWidth={setSignWidth} /> <p className="helper-copy">Position values use percentages of the page. The placement is applied to one page.</p></>}
      {tool.id === 'sign-pdf' && <div className="signature-editor"><div className="signature-tabs" role="tablist" aria-label="Signature input type">{(['draw', 'type', 'upload'] as const).map((mode) => <button type="button" key={mode} className={signatureMode === mode ? 'signature-tab active' : 'signature-tab'} onClick={() => setSignatureMode(mode)} role="tab" aria-selected={signatureMode === mode}>{mode === 'draw' ? 'Draw' : mode === 'type' ? 'Type' : 'Upload'}</button>)}</div>{signatureMode === 'draw' && <SignatureCanvas refCanvas={signatureCanvasRef} />} {signatureMode === 'type' && <div className="typed-sign-wrap"><input value={signatureType} onChange={(event) => setSignatureType(event.target.value)} maxLength={50} aria-label="Typed signature" /><div className="typed-sign-preview">{signatureType || 'Your signature'}</div></div>} {signatureMode === 'upload' && <div className="signature-upload"><label className="button button-outline" htmlFor="signature-image">Choose signature image</label><input id="signature-image" className="visually-hidden" type="file" accept="image/png,image/jpeg" onChange={(event) => setSignatureUpload(event.currentTarget.files?.[0] || null)} /><span>{signatureUpload?.name || 'Transparent PNG works best'}</span></div>}<PlacementFields page={signPage} setPage={setSignPage} x={signX} setX={setSignX} y={signY} setY={setSignY} width={signWidth} setWidth={setSignWidth} /><div className="field-group"><label htmlFor="signature-rotation">Signature rotation <span>{signRotation}°</span></label><input id="signature-rotation" type="range" min="-45" max="45" value={signRotation} onChange={(event) => setSignRotation(event.target.value)} /></div><div className="legal-note"><Info size={16} /><span>This creates an electronic signature image. It does not automatically create a qualified digital signature or a government-certified signature.</span></div></div>}
      {tool.id === 'metadata-viewer' && metadata && <MetadataEditor metadata={metadata} values={{ metadataTitle, setMetadataTitle, metadataAuthor, setMetadataAuthor, metadataSubject, setMetadataSubject, metadataKeywords, setMetadataKeywords }} onSave={async () => {
        if (!selectedFile) return
        setBusy(true); setError(''); try { const { updatePdfMetadata } = await import('../lib/pdf'); const output = await updatePdfMetadata(selectedFile, { title: metadataTitle, author: metadataAuthor, subject: metadataSubject, keywords: metadataKeywords }); setResult(output); setProgress(null) } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
      }} />}

      {error && <div className={`inline-feedback ${error.startsWith('Text copied') ? 'feedback-success' : ''}`} role="alert"><CircleAlert size={16} />{error}</div>}
      {progress && <div className="processing-progress" role="status"><div className="progress-line"><span style={{ width: `${Math.max(4, progress.value * 100)}%` }} /></div><div className="progress-caption"><span className="spinner spinner-small" />{progress.message || 'Processing…'}<span>{Math.round(progress.value * 100)}%</span></div></div>}
      <button className="button button-primary button-process" type="submit" disabled={busy || (!files.length && !isImageToPdf)}>{busy ? <><LoaderCircle className="spin" size={17} /> Working…</> : <>{tool.id === 'merge-pdf' ? 'Merge PDF' : tool.id === 'sign-pdf' ? 'Apply signature' : tool.id === 'compress-pdf' ? 'Compress PDF' : tool.id === 'pdf-to-txt' || tool.id === 'extract-text' ? 'Extract text' : tool.id === 'page-counter' ? 'Count pages' : isImageToPdf ? 'Create PDF' : 'Process PDF'} <ArrowRight size={17} /></>}</button>
      {tool.id === 'sign-pdf' && <p className="below-button-note">By selecting Apply signature, you confirm you have the right to use this signature.</p>}
    </form>}
    {result && <div className="result-area"><div className="success-banner"><span className="success-icon"><Check size={19} /></span><div><strong>Processing complete</strong><p>Your new file is ready to download.</p></div></div><div className="result-file"><span className="result-file-icon"><FileCheck2 size={21} /></span><div className="result-file-name"><strong>{result.filename}</strong><small>{formatBytes(result.blob.size)}</small></div><button className="button button-primary" onClick={() => void downloadResult()}><Download size={16} /> Download</button></div>{presetInfo && <CompressionSummary original={presetInfo.original} output={presetInfo.output} />}<div className="result-actions"><button className="button button-outline" onClick={reset}><RefreshCw size={15} /> Process another file</button><Link className="text-link" to="/#all-tools">Explore related tools <ArrowRight size={15} /></Link></div></div>}
    {textOutput && <div className="text-output-block"><div className="output-heading"><div><strong>{tool.id === 'pdf-ocr' ? 'Recognized text' : 'Extracted text'}</strong><small>{textOutput.length.toLocaleString()} characters</small></div><button className="button button-small button-outline" onClick={() => void copyText()}><Clipboard size={14} /> Copy</button></div><textarea value={textOutput} readOnly aria-label="Extracted PDF text" rows={10} />{detailOutput?.scanned && <div className="inline-note"><Info size={15} />This PDF appears to be image-based. Try <Link to="/pdf-ocr">OCR PDF</Link>.</div>}</div>}
    {detailOutput && tool.id !== 'metadata-viewer' && <DetailOutput toolId={tool.id} details={detailOutput} />}
    {metadata && tool.id === 'metadata-viewer' && !result && <div className="metadata-read"><span className="success-icon"><Check size={18} /></span><div><strong>Document details loaded</strong><p>{metadata.pages} pages · {formatBytes(metadata.size)}</p></div></div>}
  </div>
}

function PagePicker({ toolId, thumbnails, selected, onToggle, order, onMove }: { toolId: string; thumbnails: { page: number; url: string }[]; selected: number[]; onToggle: (page: number) => void; order: number[]; onMove: (index: number, direction: number) => void }) {
  return <div className="page-picker"><div className="page-picker-heading"><div><strong>Page overview</strong><small>{thumbnails.length} pages · select pages to update the range</small></div>{toolId === 'reorder-pages' && <span>Use arrows to arrange</span>}</div><div className="page-thumb-grid">{toolId === 'reorder-pages' ? order.map((pageNo, index) => { const thumb = thumbnails.find((item) => item.page === pageNo); return <div className="page-thumb" key={`${pageNo}-${index}`}><button className="page-thumb-image" type="button" onClick={() => onToggle(pageNo)}><img src={thumb?.url} alt={`Preview of page ${pageNo}`} /><span className="page-thumb-number">{pageNo}</span></button><div className="thumb-order-controls"><span>Position {index + 1}</span><button disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move page ${pageNo} earlier`}><ChevronDown className="rotate-up" size={15} /></button><button disabled={index === order.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move page ${pageNo} later`}><ChevronDown size={15} /></button></div></div> }) : thumbnails.map((thumb) => <button type="button" className={`page-thumb-image ${selected.includes(thumb.page) ? 'page-thumb-selected' : ''}`} key={thumb.page} onClick={() => onToggle(thumb.page)} aria-pressed={selected.includes(thumb.page)}><img src={thumb.url} alt={`Preview of page ${thumb.page}`} /><span className="page-thumb-number">{thumb.page}</span>{selected.includes(thumb.page) && <span className="thumb-check"><Check size={13} /></span>}</button>)}</div>{toolId === 'delete-pages' && <small className="helper-copy">Selected pages will be removed. You can also enter page numbers manually below.</small>}</div>
}

function MetadataEditor({ metadata, values, onSave }: { metadata: any; values: any; onSave: () => void }) {
  return <div className="metadata-editor"><div className="metadata-header"><div><strong>Document metadata</strong><small>{metadata.pages} pages · {formatBytes(metadata.size)}</small></div><span>Read in your browser</span></div><div className="metadata-grid"><MetadataField label="Title" value={values.metadataTitle} onChange={values.setMetadataTitle} /><MetadataField label="Author" value={values.metadataAuthor} onChange={values.setMetadataAuthor} /><MetadataField label="Subject" value={values.metadataSubject} onChange={values.setMetadataSubject} /><MetadataField label="Keywords (comma separated)" value={values.metadataKeywords} onChange={values.setMetadataKeywords} /><div className="metadata-readonly"><span>Creator</span><strong>{metadata.creator || 'Not set'}</strong></div><div className="metadata-readonly"><span>Producer</span><strong>{metadata.producer || 'Not set'}</strong></div><div className="metadata-readonly"><span>Created</span><strong>{metadata.creationDate || 'Not set'}</strong></div><div className="metadata-readonly"><span>Modified</span><strong>{metadata.modificationDate || 'Not set'}</strong></div></div><button className="button button-outline metadata-save" type="button" onClick={onSave}><Check size={15} /> Save metadata to a copy</button></div>
}
function MetadataField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="field-group"><label>{label}</label><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={250} /></div> }

function DetailOutput({ toolId, details }: { toolId: string; details: any }) {
  if (toolId === 'word-counter' || toolId === 'character-counter') return <div className="detail-stat-grid">{Object.entries(details).map(([label, value]) => <div className="detail-stat" key={label}><span>{label.replace(/([A-Z])/g, ' $1')}</span><strong>{Number(value).toLocaleString()}</strong></div>)}</div>
  if (toolId === 'page-counter') return <div className="detail-stat-grid"><div className="detail-stat"><span>Pages</span><strong>{details.pages}</strong></div><div className="detail-stat"><span>File size</span><strong>{formatBytes(details.size)}</strong></div><div className="detail-stat"><span>First page</span><strong>{details.dimensions?.[0]?.width} × {details.dimensions?.[0]?.height} pt</strong></div></div>
  return null
}

function CompressionSummary({ original, output }: { original: number; output: number }) {
  const change = original ? Math.round((1 - output / original) * 100) : 0
  return <div className="compression-summary"><div><span>Original size</span><strong>{formatBytes(original)}</strong></div><div><span>Final size</span><strong>{formatBytes(output)}</strong></div><div><span>{change >= 0 ? 'Saved' : 'Size change'}</span><strong className={change > 0 ? 'positive-saving' : ''}>{change >= 0 ? `${change}%` : `+${Math.abs(change)}%`}</strong></div>{change <= 0 && <p>This file did not get smaller with the chosen method. Keep the original if its quality is better.</p>}</div>
}

function PlacementFields({ page, setPage, x, setX, y, setY, width, setWidth }: { page: string; setPage: (value: string) => void; x: string; setX: (value: string) => void; y: string; setY: (value: string) => void; width: string; setWidth: (value: string) => void }) {
  return <div className="form-grid placement-fields"><div className="field-group"><label>Page number</label><input type="number" min="1" value={page} onChange={(event) => setPage(event.target.value)} /></div><div className="field-group"><label>Horizontal position (%)</label><input type="number" min="0" max="100" value={x} onChange={(event) => setX(event.target.value)} /></div><div className="field-group"><label>Vertical position (%)</label><input type="number" min="0" max="100" value={y} onChange={(event) => setY(event.target.value)} /></div><div className="field-group"><label>Width (% of page)</label><input type="number" min="5" max="90" value={width} onChange={(event) => setWidth(event.target.value)} /></div></div>
}

function SignatureCanvas({ refCanvas }: { refCanvas: RefObject<HTMLCanvasElement> }) {
  const drawing = useRef(false)
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget; const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height
    ctx.beginPath(); ctx.moveTo((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY); ctx.strokeStyle = '#243148'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    drawing.current = true; canvas.setPointerCapture(event.pointerId)
  }
  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const canvas = event.currentTarget; const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect(); ctx.lineTo((event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height)); ctx.stroke()
  }
  const finish = (event: PointerEvent<HTMLCanvasElement>) => { drawing.current = false; try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {} }
  const clear = () => { const canvas = refCanvas.current; if (!canvas) return; canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height) }
  return <div className="signature-canvas-wrap"><canvas ref={refCanvas} width={720} height={210} className="signature-canvas" onPointerDown={start} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish} aria-label="Draw your signature here" /><div className="signature-canvas-bottom"><span>Draw with your finger, mouse or trackpad</span><button type="button" className="text-button" onClick={clear}><Trash2 size={13} /> Clear</button></div></div>
}
async function createSignatureBlob(mode: 'draw' | 'type' | 'upload', canvas: HTMLCanvasElement | null, typed: string, upload: File | null): Promise<Blob> {
  if (mode === 'upload') {
    if (!upload) throw new Error('Choose a signature image.')
    if (upload.size > 10 * 1024 * 1024) throw new Error('Signature images must be 10 MB or smaller.')
    const bitmap = await createImageBitmap(upload)
    const canvasEl = document.createElement('canvas'); canvasEl.width = bitmap.width; canvasEl.height = bitmap.height
    canvasEl.getContext('2d')?.drawImage(bitmap, 0, 0); bitmap.close()
    return await new Promise((resolve, reject) => canvasEl.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not read the signature image.')), 'image/png'))
  }
  if (mode === 'type') {
    if (!typed.trim()) throw new Error('Enter the signature text first.')
    const out = document.createElement('canvas'); out.width = 720; out.height = 210
    const ctx = out.getContext('2d'); if (!ctx) throw new Error('Could not create the signature image.')
    ctx.fillStyle = '#26364c'; ctx.font = 'italic 62px cursive'; ctx.textBaseline = 'middle'; ctx.fillText(typed, 24, 105, 670)
    return await new Promise((resolve, reject) => out.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the signature image.')), 'image/png'))
  }
  if (!canvas) throw new Error('The signature canvas is not ready.')
  const blank = document.createElement('canvas'); blank.width = canvas.width; blank.height = canvas.height
  if (canvas.toDataURL() === blank.toDataURL()) throw new Error('Draw your signature before applying it.')
  return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the signature image.')), 'image/png'))
}

function AiGenerator({ toolId }: { toolId: string }) {
  const [topic, setTopic] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [resumeTemplate, setResumeTemplate] = useState('modern')
  const [instructions, setInstructions] = useState('')
  const [documentType, setDocumentType] = useState(toolId === 'ai-resume' ? 'Resume' : toolId === 'ai-report-generator' ? 'Report' : 'Study Notes')
  const [language, setLanguage] = useState('English')
  const [length, setLength] = useState('Standard')
  const [tone, setTone] = useState('Clear and professional')
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4')
  const [name, setName] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [education, setEducation] = useState('')
  const [projects, setProjects] = useState('')
  const [certifications, setCertifications] = useState('')
  const [purpose, setPurpose] = useState('')
  const [audience, setAudience] = useState('')
  const [draft, setDraft] = useState<DocumentDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const profile = toolId === 'ai-resume' ? { name, targetRole, skills, experience, education, projects, certifications, template: resumeTemplate } : toolId === 'ai-report-generator' ? { purpose, audience } : {}
    const fullTopic = toolId === 'ai-resume' ? `Resume for ${name || 'the applicant'} targeting ${targetRole || 'a suitable role'}` : topic
    try {
      const data = await apiRequest<{ document: DocumentDraft }>('/api/ai/generate', { method: 'POST', body: JSON.stringify({ topic: fullTopic, instructions, documentType, language, length, tone, pageSize, profile, title: customTitle || (name ? `${name} — Resume` : undefined) }) })
      const generated = normalizeDraft(data.document)
      setDraft(generated)
      reportToolUse(toolId, `${documentType} draft`)
      await saveHistory(toolId, `${documentType} draft`)
    } catch (cause) { setError(errorMessage(cause)); setNotice(errorMessage(cause).includes('not configured') ? 'Add the Gemini secret to the backend and deploy the Worker to enable document generation.' : '') }
    finally { setBusy(false) }
  }
  const exportPdf = async () => {
    if (!draft) return
    setExporting(true); setError('')
    try {
      const { triggerDownload } = await import('../lib/pdf')
      triggerDownload(await documentToPdf(draft, pageSize, resumeMode ? resumeTemplate as 'classic' | 'modern' | 'compact' : 'classic'))
      reportToolUse(toolId, `${draft.title}.pdf`)
      await saveHistory(toolId, `${draft.title}.pdf`)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setExporting(false) }
  }
  const addSection = () => setDraft((current) => current ? { ...current, sections: [...current.sections, { heading: 'New section', paragraphs: ['Add your content here.'], bullets: [] }] } : current)
  const updateSection = (index: number, patch: Partial<DocumentDraft['sections'][number]>) => setDraft((current) => current ? { ...current, sections: current.sections.map((section, i) => i === index ? { ...section, ...patch } : section) } : current)
  const resumeMode = toolId === 'ai-resume'
  const reportMode = toolId === 'ai-report-generator'
  const title = resumeMode ? 'Build a resume draft' : reportMode ? 'Draft a report' : 'Create your document'
  const unicodeFallback = Boolean(draft && /[^\u0000-\u00ff]/.test([draft.title, draft.subtitle || '', ...draft.sections.flatMap((section) => [section.heading || '', ...(section.paragraphs || []), ...(section.bullets || [])])].join(' ').replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026]/g, '')))

  return <div className="processor-card ai-maker-card"><div className="processor-heading"><div><span className="section-kicker"><Sparkles size={13} /> GEMINI-POWERED DRAFTING</span><h2>{draft ? 'Review your draft' : title}</h2><p>AI output is a starting point. Review every fact before you share or publish it.</p></div><span className="local-badge"><ShieldCheck size={14} /> Private PDF export</span></div>
    {!draft && <form className="ai-form" onSubmit={submit}>
      {resumeMode ? <div className="form-grid"><div className="field-group"><label htmlFor="resume-name">Full name</label><input id="resume-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={120} /></div><div className="field-group"><label htmlFor="resume-role">Target role</label><input id="resume-role" required value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product designer" maxLength={120} /></div><div className="field-group form-span"><label htmlFor="resume-title">Resume title <span className="optional-label">Optional</span></label><input id="resume-title" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Defaults to your name and Resume" maxLength={250} /></div><div className="field-group form-span"><label htmlFor="resume-education">Education</label><textarea id="resume-education" value={education} onChange={(event) => setEducation(event.target.value)} placeholder="Degree, institution, graduation year" rows={2} maxLength={1500} /></div><div className="field-group form-span"><label htmlFor="resume-experience">Experience</label><textarea id="resume-experience" value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="Roles, dates, achievements and measurable impact" rows={3} maxLength={4000} /></div><div className="field-group"><label htmlFor="resume-skills">Skills</label><textarea id="resume-skills" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Relevant skills, separated by commas" rows={3} maxLength={1800} /></div><div className="field-group"><label htmlFor="resume-projects">Projects</label><textarea id="resume-projects" value={projects} onChange={(event) => setProjects(event.target.value)} placeholder="Relevant projects and outcomes" rows={3} maxLength={1800} /></div><div className="field-group form-span"><label htmlFor="resume-certifications">Certifications</label><textarea id="resume-certifications" value={certifications} onChange={(event) => setCertifications(event.target.value)} placeholder="Courses, certifications, awards" rows={2} maxLength={1200} /></div></div> : <div className="form-grid"><div className="field-group form-span"><label htmlFor="ai-topic">{reportMode ? 'Report topic' : 'What should your document be about?'}</label><textarea id="ai-topic" required value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={reportMode ? 'For example: quarterly customer support trends' : 'For example: a beginner’s guide to renewable energy'} rows={3} maxLength={500} /></div><div className="field-group form-span"><label htmlFor="ai-document-title">Document title <span className="optional-label">Optional</span></label><input id="ai-document-title" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Use a clear title, or let AI suggest one" maxLength={250} /></div>{reportMode && <><div className="field-group"><label htmlFor="report-purpose">Purpose</label><input id="report-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Inform, recommend, evaluate…" maxLength={250} /></div><div className="field-group"><label htmlFor="report-audience">Audience</label><input id="report-audience" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Who will read this?" maxLength={250} /></div></>}</div>}
      <div className="form-grid ai-options"><div className="field-group"><label htmlFor="document-type">Document type</label><select id="document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{['Ebook', 'Study Notes', 'Resume', 'CV', 'Report', 'Assignment', 'Business Proposal', 'Invoice', 'Cover Letter', 'Letter', 'Meeting Notes', 'Research Summary', 'Planner', 'Checklist', 'Study Guide'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field-group"><label htmlFor="ai-language">Language</label><select id="ai-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field-group"><label htmlFor="ai-length">Length</label><select id="ai-length" value={length} onChange={(event) => setLength(event.target.value)}><option>Short</option><option>Standard</option><option>Detailed</option></select></div><div className="field-group"><label htmlFor="ai-tone">Tone</label><select id="ai-tone" value={tone} onChange={(event) => setTone(event.target.value)}><option>Clear and professional</option><option>Friendly and conversational</option><option>Academic</option><option>Concise</option></select></div><div className="field-group"><label htmlFor="ai-page-size">PDF page size</label><select id="ai-page-size" value={pageSize} onChange={(event) => setPageSize(event.target.value as any)}><option value="A4">A4</option><option value="Letter">Letter</option></select></div>{resumeMode && <div className="field-group"><label htmlFor="resume-template">Resume template</label><select id="resume-template" value={resumeTemplate} onChange={(event) => setResumeTemplate(event.target.value)}><option value="modern">Modern</option><option value="classic">Classic</option><option value="compact">Compact</option></select></div>}<div className="field-group"><label htmlFor="ai-instructions">Additional instructions</label><input id="ai-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Optional" maxLength={500} /></div></div>
      <div className="ai-disclosure"><Info size={15} /><span>Your prompt goes to the site’s backend and Google Gemini when configured. Do not submit sensitive personal or confidential data without checking the site’s AI privacy terms.</span></div>
      {error && <div className="inline-feedback" role="alert"><CircleAlert size={16} />{error}</div>}{notice && <div className="backend-note">{notice}</div>}
      <button className="button button-primary button-process" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Creating draft…</> : <><Sparkles size={17} /> Generate draft <ArrowRight size={17} /></>}</button>
    </form>}
    {draft && <div className="draft-editor"><div className="draft-editor-top"><div><span className="draft-ready"><Check size={14} /> DRAFT READY TO EDIT</span><p>Everything below is editable. Check facts, figures, names and dates.</p></div><button className="text-button" onClick={() => setDraft(null)}><RefreshCw size={14} /> Start over</button></div>{unicodeFallback && <div className="backend-note">This draft includes non-Latin characters. To preserve the glyphs, the PDF export uses page images; its text may not be selectable or searchable.</div>}<div className="field-group"><label htmlFor="draft-title">Document title</label><input id="draft-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={250} /></div><div className="field-group"><label htmlFor="draft-subtitle">Subtitle</label><input id="draft-subtitle" value={draft.subtitle || ''} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} maxLength={250} /></div>{draft.sections.map((section, index) => <section className="draft-section" key={index}><div className="draft-section-toolbar"><span>Section {index + 1}</span><button className="text-button danger-text" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, sectionIndex) => sectionIndex !== index) })}><Trash2 size={13} /> Remove</button></div><div className="field-group"><label>Heading</label><input value={section.heading || ''} onChange={(event) => updateSection(index, { heading: event.target.value })} maxLength={150} /></div><div className="field-group"><label>Paragraphs</label><textarea value={(section.paragraphs || []).join('\n\n')} rows={Math.max(4, Math.min(12, (section.paragraphs || []).length * 3))} onChange={(event) => updateSection(index, { paragraphs: event.target.value.split(/\n{2,}/) })} maxLength={8000} /></div><div className="field-group"><label>Bullets <span className="optional-label">One per line</span></label><textarea value={(section.bullets || []).join('\n')} rows={2} onChange={(event) => updateSection(index, { bullets: event.target.value.split('\n') })} maxLength={3000} /></div></section>)}<button className="button button-outline add-section-button" onClick={addSection}><Plus size={16} /> Add section</button>{error && <div className="inline-feedback" role="alert"><CircleAlert size={16} />{error}</div>}<div className="draft-footer"><span><ShieldCheck size={15} /> PDF is generated in your browser</span><button className="button button-primary" onClick={() => void exportPdf()} disabled={exporting}>{exporting ? <LoaderCircle className="spin" size={17} /> : <Download size={16} />} {exporting ? 'Preparing PDF…' : 'Generate PDF'}</button></div></div>}
  </div>
}

function normalizeDraft(input: any): DocumentDraft {
  if (!input || typeof input !== 'object') throw new Error('The AI service returned an invalid document. Try again.')
  const sections = Array.isArray(input.sections) ? input.sections.map((section: any) => ({ heading: String(section?.heading || ''), paragraphs: Array.isArray(section?.paragraphs) ? section.paragraphs.map(String) : section?.paragraph ? [String(section.paragraph)] : [], bullets: Array.isArray(section?.bullets) ? section.bullets.map(String) : [] })) : []
  return { title: String(input.title || 'Untitled document'), subtitle: String(input.subtitle || ''), sections: sections.length ? sections : [{ heading: 'Draft', paragraphs: [String(input.content || 'Review and edit this draft.')], bullets: [] }] }
}

function AiPdfWorkspace({ toolId, accept }: { toolId: string; accept?: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [question, setQuestion] = useState('')
  const [task, setTask] = useState(taskFromTool(toolId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [displayText, setDisplayText] = useState('')
  const [progress, setProgress] = useState('')
  const [saving, setSaving] = useState(false)
  const isAsk = toolId === 'ask-pdf'

  const analyze = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setResult(null); setDisplayText('')
    if (!files[0]) { setError('Choose a PDF to analyze.'); return }
    if (isAsk && !question.trim()) { setError('Add a question for the document.'); return }
    setBusy(true)
    try {
      setProgress('Extracting selectable text in your browser…')
      const { extractPdfText } = await import('../lib/pdf')
      const text = await extractPdfText(files[0], (value, message) => setProgress(message || `Reading ${Math.round(value * 100)}%`))
      if (text.trim().length < 40) throw new Error('This PDF appears to be image-based or contains very little selectable text. Try OCR PDF first.')
      setProgress('Sending extracted text to the AI service…')
      const response = await apiRequest<{ result: any }>('/api/ai/analyze', { method: 'POST', body: JSON.stringify({ task, text, question: question.trim(), language: 'English' }) })
      setResult(response.result)
      setDisplayText(typeof response.result === 'string' ? response.result : JSON.stringify(response.result, null, 2))
      reportToolUse(toolId, files[0].name)
      await saveHistory(toolId, files[0].name)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false); setProgress('') }
  }
  const saveAsPdf = async () => {
    if (!displayText) return
    setSaving(true); setError('')
    try {
      const { triggerDownload } = await import('../lib/pdf')
      let editableResult: any = null
      try { editableResult = JSON.parse(displayText) } catch { editableResult = null }
      const maybeDraft = editableResult && typeof editableResult === 'object' && Array.isArray(editableResult.sections) ? normalizeDraft(editableResult) : { title: toolById(toolId)?.title || 'PDF AI Result', sections: displayText.split(/\n{2,}/).filter(Boolean).map((paragraph) => ({ paragraphs: [paragraph] })) }
      triggerDownload(await documentToPdf(maybeDraft))
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return <div className="processor-card ai-analysis-card"><div className="processor-heading"><div><span className="section-kicker"><Sparkles size={13} /> AI DOCUMENT WORKSPACE</span><h2>{result ? 'Your document insights' : isAsk ? 'Ask your PDF a question' : `${toolById(toolId)?.title || 'AI PDF tool'}`}</h2><p>Text is extracted in your browser first. Only that text and your prompt are sent to the AI backend.</p></div><span className="local-badge"><ShieldCheck size={14} /> Original stays local</span></div>{!result && <form onSubmit={analyze}><FileDropzone accept={accept} files={files} multiple={false} onFiles={setFiles} title="Drop a PDF here" subtitle="Text extraction happens in your browser" privacyFootnote="Extracted text is sent to the configured AI service" /><FileList files={files} onRemove={() => setFiles([])} />{isAsk ? <><div className="field-group"><label htmlFor="ask-task">What would you like to do?</label><select id="ask-task" value={task} onChange={(event) => setTask(event.target.value)}><option value="explain">Explain the main idea</option><option value="summary">Summarize this PDF</option><option value="key-points">Extract key points</option><option value="notes">Create study notes</option><option value="mcq">Create multiple-choice questions</option><option value="flashcards">Create flashcards</option><option value="translate">Translate the key content</option><option value="ask">Ask a custom question</option></select></div><div className="field-group"><label htmlFor="ask-question">Your question or instructions</label><textarea id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask something specific about this document…" rows={3} maxLength={1500} /></div></> : <div className="field-group"><label htmlFor="analysis-task">AI task</label><select id="analysis-task" value={task} onChange={(event) => setTask(event.target.value)}><option value="summary">Summarize</option><option value="notes">Create notes</option><option value="mcq">Generate MCQs</option><option value="flashcards">Create flashcards</option><option value="study-guide">Create a study guide</option><option value="key-points">Extract key points</option></select></div>}<div className="ai-disclosure"><Info size={15} /><span>Only send documents you are authorized to share with the configured AI provider. Avoid sensitive personal information.</span></div>{error && <div className="inline-feedback" role="alert"><CircleAlert size={16} />{error}</div>}{busy && <div className="processing-progress"><div className="progress-line"><span className="progress-indeterminate" /></div><div className="progress-caption"><span className="spinner spinner-small" />{progress}</div></div>}<button className="button button-primary button-process" disabled={busy || !files.length}>{busy ? <><LoaderCircle className="spin" size={17} /> Working…</> : <><Sparkles size={17} /> {isAsk ? 'Analyze and answer' : 'Generate result'} <ArrowRight size={17} /></>}</button></form>}{result && <div className="ai-answer"><div className="ai-answer-top"><div><span className="draft-ready"><Check size={14} /> RESULT READY</span><p>Review AI-generated content against the source PDF.</p></div><button className="text-button" onClick={() => { setResult(null); setFiles([]); setError('') }}><RefreshCw size={14} /> New analysis</button></div><textarea className="ai-result-text" value={displayText} onChange={(event) => setDisplayText(event.target.value)} rows={18} aria-label="Editable AI result" />{error && <div className="inline-feedback" role="alert">{error}</div>}<div className="draft-footer"><span><Info size={15} /> AI output may be inaccurate</span><button className="button button-primary" onClick={() => void saveAsPdf()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Save result as PDF</button></div></div>}</div>
}

function taskFromTool(id: string) { if (id === 'pdf-summary') return 'summary'; if (id === 'pdf-notes') return 'notes'; if (id === 'pdf-mcq') return 'mcq'; if (id === 'pdf-flashcards') return 'flashcards'; if (id === 'pdf-study-guide') return 'study-guide'; return 'explain' }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : 'Something went wrong. Please try again.' }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; let value = bytes / 1024; const units = ['KB', 'MB', 'GB']; let index = 0; while (value >= 1024 && index < units.length - 1) { value /= 1024; index++ } return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}` }

function ToolSeoFooter({ tool }: { tool: NonNullable<ReturnType<typeof toolById>> }) {
  const category = categories.find((item) => item.id === tool.category)
  const related = tools.filter((item) => item.category !== tool.category && item.status !== 'service-required').slice(0, 4)
  return <section className="tool-seo"><div className="wrap tool-seo-inner"><div><span className="section-kicker">HOW IT WORKS</span><h2>Use {tool.title.toLowerCase()} in three steps</h2><ol><li><strong>Choose a file.</strong> Add a PDF or supported image from your device.</li><li><strong>Review the options.</strong> Set pages, order or output preferences before processing.</li><li><strong>Check your result.</strong> Download the new copy and open it to verify the content.</li></ol><p>{tool.description} This browser-based tool is part of the {category?.title.toLowerCase()} workspace. Your source file is left unchanged; if a feature needs a backend service, this page says so rather than pretending that the conversion ran.</p></div><div className="tool-seo-related"><strong>Try next</strong>{related.map((item) => <Link to={`/${item.id}`} key={item.id}>{item.shortTitle}<ArrowRight size={14} /></Link>)}</div></div></section>
}
