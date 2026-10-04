import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  AlignLeft, ArrowLeftRight, ArrowRight, BadgeCheck, BookOpenCheck, BriefcaseBusiness,
  ChartNoAxesCombined, Check, ChevronDown, ChevronRight, CircleHelp, Combine, Copy,
  CopyPlus, FileImage, FileMinus2, FilePenLine, FileSearch, FileText, Files, GraduationCap,
  Hash, Image, ImagePlus, Info, Layers3, ListChecks, ListOrdered, LockKeyhole, Menu,
  MessageCircleQuestion, Minimize2, Moon, NotebookPen, PanelTop, PenLine, Presentation,
  RotateCw, ScanSearch, ScanText, Scissors, Search, Settings2, ShieldCheck, Sheet,
  Signature, Sparkles, Stamp, Sun, Text, TextCursorInput, Upload, WholeWord, X, EyeOff,
  UnlockKeyhole, PanelsTopLeft, type LucideIcon,
} from 'lucide-react'
import { categories } from './data/tools'
import type { Tool } from './data/tools'

const iconMap: Record<string, LucideIcon> = {
  AlignLeft, ArrowLeftRight, BadgeCheck, BookOpenCheck, BriefcaseBusiness, ChartNoAxesCombined,
  Combine, Copy, CopyPlus, FileImage, FileMinus2, FilePenLine, FileSearch, FileText, Files,
  GraduationCap, Hash, Image, ImagePlus, Info, Layers3, ListChecks, ListOrdered,
  LockKeyhole, Minimize2, MessageCircleQuestion, NotebookPen, PanelsTopLeft, PanelTop,
  PenLine, Presentation, RotateCw, ScanSearch, ScanText, Scissors, Search, Settings2,
  ShieldCheck, Sheet, Signature, Sparkles, Stamp, Text, TextCursorInput, WholeWord, EyeOff,
  UnlockKeyhole,
}

export function ToolIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = iconMap[name] || FileText
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="All in One PDF Tools home">
      <span className="brand-mark" aria-hidden="true">
        <svg width="34" height="36" viewBox="0 0 34 36" fill="none">
          <path d="M7.2 2.5h12.3l7.8 7.8v21.2a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2v-27a2 2 0 0 1 2-2Z" fill="#fff" stroke="#203047" strokeWidth="1.7" />
          <path d="M19.5 2.5v6a1.8 1.8 0 0 0 1.8 1.8h6" stroke="#203047" strokeWidth="1.7" />
          <path d="M10 17h12M10 21h12M10 25h8" stroke="#d14b4c" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 29h6" stroke="#718096" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && <span className="brand-copy"><strong>All in One PDF Tools</strong><small>Every PDF tool you need in one place</small></span>}
    </Link>
  )
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem('a1pt-theme')
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  })
  useEffect(() => {
    localStorage.setItem('a1pt-theme', theme)
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  }, [theme])
  const cycleTheme = () => setTheme((current) => current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light')
  const closeMenu = () => setMenuOpen(false)
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Brand />
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/#tools" onClick={closeMenu}>PDF tools</NavLink>
          <NavLink to="/#ai-tools" onClick={closeMenu}>AI tools</NavLink>
          <NavLink to="/about" onClick={closeMenu}>About</NavLink>
          <NavLink to="/login" className="nav-mobile-account" onClick={closeMenu}>My workspace</NavLink>
        </nav>
        <div className="header-actions">
          <button className="icon-button theme-toggle" onClick={cycleTheme} aria-label={`Color theme: ${theme}. Change theme`} title={`Color theme: ${theme}`}>
            {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <Link className="button button-outline button-small account-link" to="/login">My workspace <ArrowRight size={14} /></Link>
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
    </header>
  )
}

export function CategoryPill({ id }: { id: string }) {
  const category = categories.find((item) => item.id === id)
  if (!category) return null
  return <span className="category-pill"><ToolIcon name={category.icon} size={12} />{category.title}</span>
}

export function ToolCard({ tool, featured = false }: { tool: Tool; featured?: boolean }) {
  const needsService = tool.status === 'service-required'
  return (
    <Link className={`tool-card ${featured ? 'tool-card-featured' : ''}`} to={`/${tool.id}`}>
      <span className={`tool-card-icon icon-${tool.category}`}><ToolIcon name={tool.icon} size={20} /></span>
      <span className="tool-card-content"><strong>{tool.shortTitle}</strong><small>{tool.description}</small></span>
      <ArrowRight className="tool-card-arrow" size={16} aria-hidden="true" />
      {needsService && <span className="service-dot" title="Requires a service that is not configured" aria-label="Requires an external service" />}
    </Link>
  )
}

export function FileDropzone({ accept, multiple = false, files, onFiles, title, subtitle, privacyFootnote }: {
  accept?: string
  multiple?: boolean
  files: File[]
  onFiles: (files: File[]) => void
  title?: string
  subtitle?: string
  privacyFootnote?: string
}) {
  const [dragging, setDragging] = useState(false)
  const fileInputId = `file-input-${useId()}`
  const addFiles = (source: FileList | File[]) => {
    const selected = Array.from(source)
    if (selected.length) onFiles(selected)
  }
  return (
    <div className={`dropzone ${dragging ? 'dropzone-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}>
      <input id={fileInputId} className="visually-hidden" type="file" accept={accept} multiple={multiple} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = '' }} />
      <div className="dropzone-icon"><Upload size={22} /></div>
      <div className="dropzone-heading">{title || 'Drop your file here'}</div>
      <p>{subtitle || 'or choose a file from your device'}</p>
      <label className="button button-primary browse-button" htmlFor={fileInputId}>Choose {multiple ? 'files' : 'file'}</label>
      <div className="dropzone-foot"><ShieldCheck size={14} /> {privacyFootnote || 'Files are processed in your browser for this tool'}</div>
    </div>
  )
}

export function FileList({ files, onRemove, onMove, multiple = false }: { files: File[]; onRemove: (index: number) => void; onMove?: (index: number, direction: number) => void; multiple?: boolean }) {
  if (!files.length) return null
  return (
    <div className="file-list" aria-label="Selected files">
      {files.map((file, index) => (
        <div className="file-row" key={`${file.name}-${file.size}-${index}`}>
          <span className="file-type-icon"><FileText size={17} /></span>
          <span className="file-row-details"><strong title={file.name}>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 2 : 1)} MB</small></span>
          {multiple && onMove && <div className="file-reorder"><button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${file.name} up`}><ChevronDown size={15} className="rotate-up" /></button><button type="button" disabled={index === files.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${file.name} down`}><ChevronDown size={15} /></button></div>}
          <button type="button" className="icon-button file-remove" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

const BANNER_AD_KEY = '38f4aa197c0d3b64ada3b383e7a023c9'
const NATIVE_AD_ID = '0c3b14ea951c85f0da33e554e8d179be'

type BannerOptions = { key: string; format: 'iframe'; height: number; width: number; params: Record<string, never> }

declare global {
  interface Window { atOptions?: BannerOptions }
}

type ActiveAdScript = { script: HTMLScriptElement; container: HTMLDivElement; refs: number; cleanupTimer: number | null; bannerOptions?: BannerOptions }
const activeAdScripts = new Map<string, ActiveAdScript>()

function mountAdScript(slot: string, format: 'banner' | 'native', container: HTMLDivElement) {
  let entry = activeAdScripts.get(slot)
  if (entry) {
    if (entry.cleanupTimer !== null) window.clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = null
    entry.refs += 1
    if (entry.container !== container) {
      entry.container.replaceChildren()
      entry.container = container
      container.appendChild(entry.script)
    }
    delete container.dataset.adLoad
  } else {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    let bannerOptions: BannerOptions | undefined
    if (format === 'banner') {
      bannerOptions = { key: BANNER_AD_KEY, format: 'iframe', height: 90, width: 728, params: {} }
      window.atOptions = bannerOptions
      script.src = `https://www.highrevenueformat.com/${BANNER_AD_KEY}/invoke.js`
    } else {
      script.dataset.cfasync = 'false'
      script.src = `https://pl31655159.profitableratecpmnetwork.com/${NATIVE_AD_ID}/invoke.js`
    }
    entry = { script, container, refs: 1, cleanupTimer: null, bannerOptions }
    script.onerror = () => { const current = activeAdScripts.get(slot); if (current && current.refs > 0) current.container.dataset.adLoad = 'failed' }
    activeAdScripts.set(slot, entry)
    container.appendChild(script)
  }

  const mountedEntry = entry
  return () => {
    mountedEntry.refs = Math.max(0, mountedEntry.refs - 1)
    if (mountedEntry.refs !== 0 || mountedEntry.cleanupTimer !== null) return
    mountedEntry.cleanupTimer = window.setTimeout(() => {
      mountedEntry.cleanupTimer = null
      if (mountedEntry.refs !== 0) return
      mountedEntry.script.remove()
      mountedEntry.container.replaceChildren()
      delete mountedEntry.container.dataset.adLoad
      if (mountedEntry.bannerOptions && window.atOptions === mountedEntry.bannerOptions) delete window.atOptions
      if (activeAdScripts.get(slot) === mountedEntry) activeAdScripts.delete(slot)
    }, 0)
  }
}

export function AdSlot({ slot, format = 'banner', className = '' }: { slot: string; format?: 'banner' | 'native'; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [adsAllowed, setAdsAllowed] = useState(() => localStorage.getItem('a1pt-ads-consent') === 'yes')

  useEffect(() => {
    const updateConsent = () => setAdsAllowed(localStorage.getItem('a1pt-ads-consent') === 'yes')
    window.addEventListener('a1pt-consent-change', updateConsent)
    return () => window.removeEventListener('a1pt-consent-change', updateConsent)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!adsAllowed || !container) return
    return mountAdScript(slot, format, container)
  }, [adsAllowed, format, slot])

  if (!adsAllowed) return null
  return (
    <aside className={`ad-slot ad-slot-${format} ${className}`} aria-label="Advertisement" data-ad-slot={slot}>
      <span className="ad-slot-label">Advertisement</span>
      <div ref={containerRef} className="ad-slot-content" id={format === 'native' ? NATIVE_AD_ID : undefined} data-ad-format={format} />
    </aside>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner wrap">
        <div className="footer-brand-column">
          <Brand />
          <p>Every PDF tool you need in one place.<br />Made for calm, quick document work.</p>
          <div className="footer-privacy"><ShieldCheck size={16} /> Private by design</div>
        </div>
        <div className="footer-column"><strong>PDF tools</strong><Link to="/merge-pdf">Merge PDF</Link><Link to="/split-pdf">Split PDF</Link><Link to="/compress-pdf">Compress PDF</Link><Link to="/pdf-editor">PDF Editor</Link><Link to="/pdf-to-jpg">PDF Converter</Link></div>
        <div className="footer-column"><strong>AI tools</strong><Link to="/ai-pdf-generator">AI PDF Maker</Link><Link to="/pdf-summary">PDF Summary</Link><Link to="/pdf-notes">PDF Notes</Link><Link to="/ai-resume">AI Resume</Link><Link to="/ai-report-generator">AI Report</Link></div>
        <div className="footer-column"><strong>Company</strong><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/disclaimer">Disclaimer</Link><Link to="/cookies">Cookie policy</Link></div>
      </div>
      <div className="footer-bottom wrap"><span>© {new Date().getFullYear()} All in One PDF Tools</span><span>Documents first. Distractions last.</span><button type="button" className="footer-privacy-button" onClick={() => window.dispatchEvent(new Event('a1pt-open-consent'))}>Privacy choices</button><Link to="/admin">Admin</Link></div>
    </footer>
  )
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(() => !['yes', 'no'].includes(localStorage.getItem('a1pt-ads-consent') || ''))

  useEffect(() => {
    const openChoices = () => setVisible(true)
    window.addEventListener('a1pt-open-consent', openChoices)
    return () => window.removeEventListener('a1pt-open-consent', openChoices)
  }, [])

  const choose = (value: 'essential' | 'analytics' | 'ads' | 'all') => {
    const analyticsAllowed = value === 'analytics' || value === 'all'
    const adsAllowed = value === 'ads' || value === 'all'
    localStorage.setItem('a1pt-consent', analyticsAllowed ? 'analytics' : 'essential')
    localStorage.setItem('a1pt-ads-consent', adsAllowed ? 'yes' : 'no')
    window.dispatchEvent(new Event('a1pt-consent-change'))
    setVisible(false)
    if (analyticsAllowed) {
      void fetch('/api/analytics', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'page_view', consent: 'analytics', path: `${window.location.pathname}${window.location.search}`.slice(0, 300) }) }).catch(() => undefined)
    }
  }

  if (!visible) return null
  return (
    <div className="consent-banner" role="dialog" aria-label="Privacy choices">
      <div className="consent-copy"><strong>Your privacy choices</strong><p>Essential storage keeps the app working. Analytics and advertising are optional and controlled separately. Ad scripts load only if you allow ads; providers may receive request, device and page data. The app does not attach selected PDF bytes to ad requests, but ad scripts run with access to the page. See our <Link to="/privacy">Privacy</Link> and <Link to="/cookies">Cookie</Link> policies.</p></div>
      <div className="consent-actions"><button className="button button-quiet" onClick={() => choose('essential')}>Essential only</button><button className="button button-quiet" onClick={() => choose('analytics')}>Analytics only</button><button className="button button-quiet" onClick={() => choose('ads')}>Ads only</button><button className="button button-primary" onClick={() => choose('all')}>Allow all</button></div>
    </div>
  )
}

export function PageLoader() {
  return <div className="page-loader" role="status"><span className="spinner" /><span>Loading workspace…</span></div>
}
