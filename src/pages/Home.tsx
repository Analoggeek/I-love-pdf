import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, BadgeCheck, ChevronDown, CircleHelp, LockKeyhole, Search, ShieldCheck, Sparkles, WandSparkles, Zap } from 'lucide-react'
import { AdSlot, CategoryPill, ToolCard, ToolIcon } from '../components'
import { categories, searchTools, tools } from '../data/tools'

const faqs = [
  ['What is an online PDF tool?', 'An online PDF tool helps you work with PDF documents in a web browser, without installing a desktop application. On this site, supported page operations run locally in your browser so your document does not need to be uploaded.'],
  ['How do I merge PDF files?', 'Open Merge PDF, choose two or more PDFs, arrange them in the order you want, then select Merge PDF. The resulting document is prepared in your browser and downloaded to your device.'],
  ['How do I split PDF pages?', 'Choose Split PDF and enter one or more page ranges. Use commas inside a range selection and semicolons between separate output files, for example 1-3; 5; 8-10. Leave the field blank to make one PDF per page.'],
  ['How can I compress PDF size?', 'Use Compress PDF and choose structural optimization to keep text selectable, or a raster compression preset to make a smaller image-based PDF. Raster compression can reduce sharpness and removes selectable text; compare the actual file size before sharing.'],
  ['Can I edit a PDF online?', 'You can add text overlays, page numbers, watermarks, or an electronic signature with the available tools. Existing text objects are not edited in place; for complex layout changes, edit the original source document.'],
  ['Can I convert PDF to JPG?', 'Yes. PDF to JPG renders selected PDF pages as JPEG images in your browser. Choose the page range and resolution; multiple images are packaged into a ZIP.'],
  ['Can I create a PDF with AI?', 'The AI PDF Maker can turn a prompt into a structured draft and a downloadable PDF when a Gemini API is configured by the site operator. You can review and edit the generated text before exporting.'],
  ['Can I ask AI questions about a PDF?', 'Yes, for selectable text. The browser extracts PDF text locally and sends only the text and your question to the configured AI backend. Scanned documents need OCR first.'],
  ['Are my files stored?', 'Browser-based tools process documents on your device and do not upload the source. Advanced conversions are unavailable until a real provider is configured. If enabled, only a file you explicitly submit for conversion is placed in private temporary storage; the source is removed after the job, and the result is removed two minutes after the download finishes. If you never download it, the result expires after one hour by default. Account history stores filenames and tool status, not file contents. The server cannot delete a copy saved on your device.'], 
  ['Can I use the website on Android?', 'Yes. The layout and file picker are designed for mobile browsers. Larger PDFs may take longer or use more memory on a phone.'],
  ['Can I use it on iPhone?', 'Yes. Use Safari or another modern iOS browser. Some browsers may require you to save the result through the share sheet or Files app.'],
  ['How does OCR work?', 'OCR renders each PDF page to an image and uses optical character recognition to identify text. This browser build uses Tesseract.js and processes pages one at a time. Recognition quality depends on scan resolution, contrast, and language.'],
  ['How can I sign a PDF?', 'Use Sign PDF to draw a signature on a canvas, choose a page and placement, then download the signed document. This creates an electronic signature image, not a qualified digital signature.'],
  ['How can I add a watermark?', 'Open Watermark PDF, choose text or an image, set its opacity, size, position, rotation and page range, then apply it. The tool writes the watermark into the downloaded PDF.'],
  ['Can I password-protect or unlock a PDF?', 'Those tools are not enabled in this deployment because a vetted PDF encryption service is not configured. We do not rename or return a file while claiming it has been secured.'],
  ['Will PDF to Word preserve the original layout?', 'PDF to Word conversion requires a dedicated document conversion engine and is not currently enabled. PDF layouts can be difficult to reconstruct, so even genuine conversion can require manual review.'],
  ['Does PDF compression always make a smaller file?', 'No. Already-optimized PDFs may not shrink. Structural optimization preserves page content; raster compression can shrink image-heavy documents but changes selectable text into page images. The result panel reports the actual sizes.'],
  ['Can I process a password-protected PDF?', 'This browser build does not remove PDF passwords. If you know the password, save an unlocked copy using a trusted PDF application before using browser tools.'],
  ['How do I remove a file from processing history?', 'Sign in, open My workspace, and remove individual history entries. The application records tool, filename, date and status; it does not retain the source file.'],
  ['Are the tools free?', 'The client-side PDF tools are available without a subscription in this build. AI requests, accounts, analytics and any future premium features depend on the site operator configuring the backend.'],
  ['Are my documents safe?', 'For the browser-based tools, document bytes remain on your device. AI analysis is optional and sends extracted text to the site backend and then to Google Gemini when configured. Avoid sending highly sensitive material to an AI service unless you have reviewed its privacy terms.'],
  ['What file size can I use?', 'The browser processing layer currently caps each PDF at 100 MB. Practical limits are lower on some mobile devices because rendering and editing use device memory.'],
]

function setMeta(title: string, description: string) {
  document.title = title
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', description)
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const results = useMemo(() => searchTools(query), [query])
  useEffect(() => {
    setMeta('All in One PDF Tools — Every PDF Tool You Need in One Place', 'Merge, split, compress, convert, edit and sign PDFs online. Private, easy-to-use PDF tools plus AI document helpers.')
    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', `${window.location.origin}/`)
    if (!canonical.parentNode) document.head.appendChild(canonical)
    const schema = document.createElement('script')
    schema.id = 'home-structured-data'
    schema.type = 'application/ld+json'
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'All in One PDF Tools', url: window.location.origin, description: 'Every PDF tool you need in one place.' },
        { '@type': 'Organization', name: 'All in One PDF Tools', url: window.location.origin },
        { '@type': 'FAQPage', mainEntity: faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
      ],
    })
    document.head.appendChild(schema)
    return () => schema.remove()
  }, [])
  const popular = ['merge-pdf', 'compress-pdf', 'split-pdf', 'pdf-to-jpg', 'sign-pdf', 'pdf-ocr'].map((id) => tools.find((tool) => tool.id === id)!).filter(Boolean)

  return (
    <>
      <AdSlot slot="home-top-banner" format="banner" className="ad-slot-home-top" />
      <section className="hero-section">
        <div className="hero-backdrop hero-backdrop-one" /><div className="hero-backdrop hero-backdrop-two" />
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A thoughtful workspace for every PDF</div>
            <h1>Every PDF tool you need.<br /><span>All in one place.</span></h1>
            <p className="hero-lede">Merge, split, compress, convert, edit and sign PDFs online. Plus powerful AI tools for your documents.</p>
            <div className="hero-search-wrap">
              <label className="hero-search" htmlFor="tool-search">
                <Search size={20} aria-hidden="true" />
                <input id="tool-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools..." autoComplete="off" aria-label="Search PDF tools" />
                <kbd>⌘ K</kbd>
              </label>
              {query.trim() && <div className="search-results" role="listbox" aria-label="Search results">
                {results.length ? results.map((tool) => <Link role="option" aria-selected="false" key={tool.id} to={`/${tool.id}`} onClick={() => setQuery('')}><span className={`search-result-icon icon-${tool.category}`}><ToolIcon name={tool.icon} size={17} /></span><span><strong>{tool.title}</strong><small>{tool.description}</small></span><ArrowRight size={16} /></Link>) : <div className="search-empty">No tools found for “{query}”. Try “merge”, “JPG”, “OCR” or “AI”.</div>}
              </div>}
            </div>
            <div className="hero-actions"><a href="#tools" className="button button-primary button-large">Explore PDF tools <ArrowRight size={17} /></a><Link to="/ai-pdf-generator" className="button button-soft button-large"><Sparkles size={17} /> Create PDF with AI</Link></div>
            <div className="hero-proof"><span><ShieldCheck size={16} /> Private browser processing</span><i /> <span><Zap size={15} /> No install required</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="floating-chip chip-private"><span className="chip-check"><CheckIcon /></span> Private by design</div>
            <div className="hero-document">
              <div className="hero-document-top"><span className="doc-mini-mark">PDF</span><span className="doc-menu">•••</span></div>
              <div className="document-label">YOUR DOCUMENT</div>
              <div className="document-title-line" /><div className="document-title-line short" />
              <div className="document-lines"><i /><i /><i /><i /><i /><i /></div>
              <div className="document-highlight"><span /> Ready when you are</div>
              <div className="doc-page-number">01</div>
            </div>
            <div className="floating-chip chip-fast"><span className="chip-icon"><Zap size={14} fill="currentColor" /></span> Ready in a few clicks</div>
            <div className="tool-orbit-card orbit-merge"><span className="orbit-icon orbit-blue"><ToolIcon name="Combine" size={17} /></span><strong>Merge</strong></div>
            <div className="tool-orbit-card orbit-sign"><span className="orbit-icon orbit-peach"><ToolIcon name="Signature" size={17} /></span><strong>Sign</strong></div>
            <div className="tool-orbit-card orbit-ai"><span className="orbit-icon orbit-violet"><Sparkles size={16} /></span><strong>AI draft</strong></div>
            <div className="hero-sparkle sparkle-a">✳</div><div className="hero-sparkle sparkle-b">✦</div>
          </div>
        </div>
        <div className="hero-bottom-wrap wrap"><div className="hero-bottom"><span><BadgeCheck size={17} /> Your files stay with you</span><span>Made for busy students, teams &amp; everyday work</span><span>Lightweight. Clear. Useful.</span></div></div>
      </section>

      <section className="section popular-section" id="tools">
        <div className="wrap">
          <div className="section-heading section-heading-row"><div><span className="section-kicker">START WITH THE ESSENTIALS</span><h2>Popular PDF tools</h2><p>The everyday PDF tasks, without the busywork.</p></div><a href="#all-tools" className="text-link">Browse all tools <ArrowRight size={16} /></a></div>
          <div className="popular-grid">{popular.map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}</div>
        </div>
      </section>

      <section className="section categories-section" id="all-tools">
        <div className="wrap">
          <div className="section-heading"><span className="section-kicker">A TOOL FOR THE NEXT STEP</span><h2>Your whole PDF toolkit</h2><p>Choose a task or find a tool by name. Your workflow can stay simple.</p></div>
          <div className="category-grid">
            {categories.map((category) => {
              const categoryTools = tools.filter((tool) => tool.category === category.id)
              return <article className={`category-panel category-${category.id}`} key={category.id} id={category.id === 'ai' ? 'ai-tools' : undefined}>
                <div className="category-heading"><span className={`category-large-icon icon-${category.id}`}><ToolIcon name={category.icon} size={21} /></span><div><h3>{category.title}</h3><p>{category.subtitle}</p></div><span className="category-count">{categoryTools.length}</span></div>
                <div className="category-tool-list">{categoryTools.map((tool) => <Link key={tool.id} to={`/${tool.id}`} className="category-tool-link"><span>{tool.shortTitle}</span><ArrowRight size={15} /></Link>)}</div>
              </article>
            })}
          </div>
        </div>
      </section>

      <section className="section how-section" id="how-it-works">
        <div className="wrap how-layout">
          <div className="how-copy"><span className="section-kicker">SIMPLE BY DESIGN</span><h2>Good tools should<br />get out of your way.</h2><p>Pick a tool, make your change, keep your file. For supported tasks, processing takes place locally in your browser—without sending the original document to a server.</p><Link to="/privacy" className="text-link">How we handle your files <ArrowRight size={16} /></Link></div>
          <div className="how-steps">
            <div className="how-step"><div className="step-number">01</div><div className="step-visual"><Search size={20} /></div><div><strong>Choose a task</strong><p>Search or browse a focused set of PDF tools.</p></div></div>
            <div className="step-connector" />
            <div className="how-step"><div className="step-number">02</div><div className="step-visual"><WandSparkles size={20} /></div><div><strong>Make it yours</strong><p>Adjust the options, arrange pages, or review an AI draft.</p></div></div>
            <div className="step-connector" />
            <div className="how-step"><div className="step-number">03</div><div className="step-visual step-download"><ArrowDown size={20} /></div><div><strong>Save and move on</strong><p>Download your result. Your original stays untouched.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section guide-section">
        <div className="wrap guide-wrap">
          <div className="guide-heading"><span className="section-kicker">THE PRACTICAL GUIDE</span><h2>All in One PDF Tools –<br />Complete Guide to Online PDF Tools</h2><p>A clearer way to choose a tool, protect your documents, and get work done.</p></div>
          <div className="guide-content">
            <article><h3>PDF work, without the scavenger hunt</h3><p>A PDF is often the last-mile format for a document: it is convenient to share, prints consistently, and can be opened on almost any device. The work around a PDF, however, can be surprisingly fragmented. You might need to combine a few invoices, remove an extra page from a form, prepare images for a presentation, or add a signature before a deadline. A well-designed online PDF toolkit puts those common jobs in one calm workspace rather than asking you to install a different utility for every small task.</p><p>All in One PDF Tools is organized around the job you want to finish. Search for a tool such as merge PDF, split PDF, compress PDF, PDF to JPG, OCR, watermark, or page numbers; open the task; choose the file; and review what will happen before you download. For browser-supported operations, the document is processed on your device. That approach can reduce waiting and avoid uploading a source file just to rearrange its pages. It also means processing speed depends partly on your device and the size of your PDF.</p></article>
            <article><h3>Organize, combine, and split pages</h3><p>Merge PDF is useful when separate statements, scans, application pages, or project documents need to become one ordered file. Add the source PDFs, arrange them, and check the list before merging. Split PDF does the opposite: it creates separate documents from ranges or individual pages. Extracting pages is useful when you need a short excerpt, while deleting pages can remove blank or irrelevant pages from a copy. Reordering helps repair scans or combine pages in a presentation-friendly sequence.</p><p>Always keep the original until you have checked the result. Page operations can preserve the visible pages while changing the document structure; they do not decide whether your sequence is legally or administratively correct. For confidential workflows, review the final page count and open the downloaded file before sending it onward.</p></article>
            <article><h3>Compress PDF files with the right trade-off</h3><p>A PDF compressor can make a document easier to email or upload, but compression is not magic. A text-heavy file that has already been optimized may barely change. Structural optimization keeps selectable text and vector artwork intact. A more aggressive, image-based compression can reduce the size of a scan, but it rasterizes the pages: text is no longer selectable, small type may become less clear, and accessibility or search can be lost. The right choice depends on whether size or editability matters more.</p><p>Compare the reported original and final sizes rather than relying on a promised percentage. If the output is larger, keep the original. For a scanned document, a lower image quality or resolution can reduce size, but check fine print, diagrams, QR codes, and signatures at normal viewing size before using the compressed copy.</p></article>
            <article><h3>Convert PDF pages and images thoughtfully</h3><p>PDF to JPG, PNG, and WebP creates images from rendered PDF pages. JPEG is a practical choice for photographs and smaller files; PNG is useful for crisp diagrams and screenshots; WebP can be compact when the destination supports it. A resolution setting controls pixel dimensions and sharpness. Large pages rendered at high resolution can use substantial memory, especially on phones. If you only need a few pages, select those pages instead of rendering the entire file.</p><p>JPG to PDF and other image-to-PDF tools place images onto pages so they are easier to print, archive, or share as one document. Page size, orientation, fit, and margin affect the result. Image-to-PDF is not the same as optical character recognition: text within a photograph remains an image until OCR is run.</p></article>
            <article><h3>PDF to Word and other document conversions</h3><p>Converting a PDF to Word is more complex than changing a file extension. A PDF records positioned text and graphics, while a word-processing file stores paragraphs, styles, and editable layout rules. A true conversion engine must infer that structure. Tables, columns, scanned pages, forms, unusual fonts, and footnotes can make that inference difficult. A good service must use a real conversion pipeline and should never return the original bytes under a new filename.</p><p>When a reliable conversion engine is not configured, this site says so instead of pretending. For a clean conversion, the original Word, Excel, or PowerPoint source is usually the best starting point. PDF-to-Excel is especially dependent on whether the page contains a real table or a scanned image of one.</p></article>
            <article><h3>OCR for scans and image-only documents</h3><p>PDF OCR recognizes characters from page images. It can make a scan searchable, help extract text from a receipt, or prepare content for an AI summary. Results depend on image quality, language, contrast, skew, and handwriting. OCR is not a perfect transcription: review names, amounts, dates, citations, and other high-impact details against the scan. If the page already contains a text layer, ordinary text extraction is faster and often more accurate.</p><p>Browser OCR can be resource-intensive. This application processes pages sequentially to limit peak memory. Choose the correct language where possible, and start with a small selection if your document is long. For multilingual or confidential projects, verify how the OCR language data and application assets are delivered in your deployment.</p></article>
            <article><h3>Sign, watermark, and add page numbers</h3><p>An electronic signature tool can place a drawn, typed, or uploaded signature image on a chosen page. That is useful for simple review and approval workflows, but it is not automatically a qualified digital signature or a government-certified identity check. A signature image does not provide the cryptographic verification or certificate chain associated with many digital-signature systems. Confirm the rules that apply to your document before relying on it.</p><p>A watermark can label a document as a draft, add a department name, or discourage casual reuse. Use restrained opacity and verify the text does not obscure important content. Page numbers help readers navigate longer files; options such as “Page 2 of 12” make extracted pages easier to understand. Neither a watermark nor a page number provides encryption or access control.</p></article>
            <article><h3>AI PDF maker and document study tools</h3><p>An AI PDF generator can help create a first draft of study notes, a report, a checklist, a cover letter, or a resume from instructions. The workflow is most useful when you treat the result as a draft: provide accurate source facts, specify your audience and tone, inspect claims, and edit names, dates, calculations, and citations. AI can confidently make mistakes and should not be treated as a substitute for professional review.</p><p>For AI PDF analysis, selectable text can be extracted locally and sent to a configured backend for processing by Google Gemini. That is a separate data flow from local PDF operations. Avoid sending confidential or regulated content unless you have permission and have reviewed the operator's AI-provider and retention settings. A summary is a reading aid, not a substitute for the complete contract, policy, paper, or report.</p></article>
            <article><h3>PDF tools for students, businesses, and offices</h3><p>Students can merge lecture handouts, extract a reading section, use OCR on a scan, and draft practice questions or flashcards. Study tools work best when you compare generated notes with the original material and use questions to test understanding rather than memorize a generated answer key. Organizing class notes by subject and date also makes files easier to retrieve later.</p><p>Businesses and offices use PDFs for proposals, invoices, forms, reports, agendas, and records. Consistent naming, page order, version control, and a careful review before signing help reduce mistakes. A digital document workflow should also consider accessibility: scanned pages may need OCR, logical reading order, tagged structure, and human checks. Page tools are helpful, but they do not automatically make a document accessible.</p></article>
            <article><h3>Privacy and PDF security</h3><p>File privacy depends on how a tool processes data. In this application, merge, split, page manipulation, image rendering, text extraction, and the basic overlay tools run in the browser. They do not need the source PDF to be uploaded. Optional AI features send extracted text to the application's backend and onward to Gemini when the operator has configured the service. Accounts and history are optional and are designed to retain tool metadata, not file content.</p><p>Security tools deserve particular care. Password encryption, password removal, and irreversible redaction are not exposed as working browser actions in this deployment. A black rectangle drawn over text is not secure redaction—the original words can remain selectable or recoverable. Always use a verified redaction method that removes the underlying content, then inspect the final file and test for hidden text before sharing it.</p></article>
            <article><h3>Choosing a safe workflow</h3><p>Start from a copy if the document matters. Choose a tool that matches the task, select only the pages you need, and review the output with a PDF reader. Check page count, orientation, visual quality, extracted text, and metadata where relevant. Keep an unmodified source until you are confident that the output is correct. On mobile, close other large applications if a multi-page render or OCR job runs out of memory.</p><p>A dependable PDF platform is clear about what it can do locally, what requires an external service, and what is not available yet. It should not promise a conversion that has not run, claim a file is secure when it is not, or invent statistics. This guide and the tool pages distinguish browser-based features from service-dependent conversions so you can make an informed choice.</p></article>
          </div>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <div className="wrap faq-layout"><div className="faq-intro"><span className="section-kicker">GOOD TO KNOW</span><h2>Questions, answered.</h2><p>Clear answers about working with PDFs, privacy, and what these tools can—and cannot—do.</p><div className="faq-intro-icon"><CircleHelp size={28} /></div></div>
          <div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${faqOpen === index ? 'faq-open' : ''}`} key={question}><button onClick={() => setFaqOpen(faqOpen === index ? null : index)} aria-expanded={faqOpen === index}><span>{question}</span><ChevronDown size={18} /></button>{faqOpen === index && <p>{answer}</p>}</div>)}</div>
        </div>
      </section>
      <section className="closing-cta"><div className="wrap closing-inner"><div className="closing-badge"><LockKeyhole size={15} /> YOUR WORKFLOW, MADE LIGHTER</div><h2>Ready for the next document?</h2><p>Pick a tool and get back to what matters.</p><a className="button button-white button-large" href="#tools">Explore the tools <ArrowRight size={17} /></a></div></section>
    </>
  )
}

function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.2 6.2 2.4 2.3 5.2-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> }
