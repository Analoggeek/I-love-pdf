export type ToolStatus = 'ready' | 'service-required' | 'limited'
export type CategoryId = 'organize' | 'compress' | 'convert' | 'edit' | 'secure' | 'analyze' | 'ai'

export type Tool = {
  id: string
  title: string
  shortTitle: string
  description: string
  category: CategoryId
  status: ToolStatus
  icon: string
  keywords: string[]
  accept?: string
  multiple?: boolean
}

export const categories: { id: CategoryId; title: string; subtitle: string; icon: string }[] = [
  { id: 'organize', title: 'Organize PDF', subtitle: 'Put every page in its place.', icon: 'Layers3' },
  { id: 'compress', title: 'Compress PDF', subtitle: 'Make large documents easier to share.', icon: 'Minimize2' },
  { id: 'convert', title: 'Convert PDF', subtitle: 'Move between PDF and popular formats.', icon: 'ArrowLeftRight' },
  { id: 'edit', title: 'Edit PDF', subtitle: 'Add the finishing touches to a document.', icon: 'PenLine' },
  { id: 'secure', title: 'Sign & protect', subtitle: 'Review, sign and prepare documents.', icon: 'ShieldCheck' },
  { id: 'analyze', title: 'Analyze PDF', subtitle: 'Get text and useful document details.', icon: 'ScanText' },
  { id: 'ai', title: 'AI document tools', subtitle: 'Turn documents and ideas into useful work.', icon: 'Sparkles' },
]

export const tools: Tool[] = [
  { id: 'merge-pdf', title: 'Merge PDF', shortTitle: 'Merge PDF', description: 'Combine multiple PDFs into one document, in the order you choose.', category: 'organize', status: 'ready', icon: 'Combine', keywords: ['join', 'combine', 'files', 'pdf merger'], accept: '.pdf,application/pdf', multiple: true },
  { id: 'split-pdf', title: 'Split PDF', shortTitle: 'Split PDF', description: 'Extract page ranges into separate PDFs. Multiple results are delivered as a ZIP.', category: 'organize', status: 'ready', icon: 'Scissors', keywords: ['separate', 'range', 'pages'], accept: '.pdf,application/pdf' },
  { id: 'extract-pages', title: 'Extract PDF Pages', shortTitle: 'Extract pages', description: 'Save only the pages you need as a new PDF.', category: 'organize', status: 'ready', icon: 'Files', keywords: ['select', 'pages', 'subset'], accept: '.pdf,application/pdf' },
  { id: 'delete-pages', title: 'Delete PDF Pages', shortTitle: 'Delete pages', description: 'Remove selected pages and download a cleaned-up PDF.', category: 'organize', status: 'ready', icon: 'FileMinus2', keywords: ['remove', 'page manager'], accept: '.pdf,application/pdf' },
  { id: 'reorder-pages', title: 'Reorder PDF Pages', shortTitle: 'Reorder pages', description: 'Arrange pages in a new order using a simple page sequence.', category: 'organize', status: 'ready', icon: 'ListOrdered', keywords: ['sort', 'arrange', 'move'], accept: '.pdf,application/pdf' },
  { id: 'rotate-pdf', title: 'Rotate PDF', shortTitle: 'Rotate PDF', description: 'Rotate every page or selected pages by 90, 180 or 270 degrees.', category: 'organize', status: 'ready', icon: 'RotateCw', keywords: ['turn', 'orientation'], accept: '.pdf,application/pdf' },
  { id: 'duplicate-pages', title: 'Duplicate PDF Pages', shortTitle: 'Duplicate pages', description: 'Choose a page order to repeat or duplicate pages in your PDF.', category: 'organize', status: 'ready', icon: 'CopyPlus', keywords: ['copy', 'repeat'], accept: '.pdf,application/pdf' },

  { id: 'compress-pdf', title: 'Compress PDF', shortTitle: 'Compress PDF', description: 'Optimize PDF structure or rasterize pages for a smaller, image-based file.', category: 'compress', status: 'ready', icon: 'Minimize2', keywords: ['reduce', 'shrink', 'size', 'optimize'], accept: '.pdf,application/pdf' },

  { id: 'pdf-to-jpg', title: 'PDF to JPG', shortTitle: 'PDF to JPG', description: 'Render PDF pages as JPEG images at a resolution you choose.', category: 'convert', status: 'ready', icon: 'Image', keywords: ['jpeg', 'images', 'convert'], accept: '.pdf,application/pdf' },
  { id: 'pdf-to-png', title: 'PDF to PNG', shortTitle: 'PDF to PNG', description: 'Render PDF pages as crisp PNG images, individually or in a ZIP.', category: 'convert', status: 'ready', icon: 'Image', keywords: ['images', 'convert'], accept: '.pdf,application/pdf' },
  { id: 'pdf-to-webp', title: 'PDF to WebP', shortTitle: 'PDF to WebP', description: 'Render PDF pages as compact WebP images in your browser.', category: 'convert', status: 'ready', icon: 'Image', keywords: ['images', 'convert'], accept: '.pdf,application/pdf' },
  { id: 'pdf-to-txt', title: 'PDF to TXT', shortTitle: 'PDF to TXT', description: 'Extract selectable text from a PDF and save it as a text file.', category: 'convert', status: 'ready', icon: 'Text', keywords: ['word', 'plain text', 'convert'], accept: '.pdf,application/pdf' },
  { id: 'jpg-to-pdf', title: 'JPG to PDF', shortTitle: 'JPG to PDF', description: 'Turn JPEG images into a single PDF. Reorder images before creating it.', category: 'convert', status: 'ready', icon: 'FileImage', keywords: ['jpeg', 'images', 'convert'], accept: 'image/jpeg,.jpg,.jpeg', multiple: true },
  { id: 'png-to-pdf', title: 'PNG to PDF', shortTitle: 'PNG to PDF', description: 'Place PNG images into a tidy PDF document.', category: 'convert', status: 'ready', icon: 'FileImage', keywords: ['images', 'convert'], accept: 'image/png,.png', multiple: true },
  { id: 'webp-to-pdf', title: 'WebP to PDF', shortTitle: 'WebP to PDF', description: 'Convert WebP images to PDF pages in your browser.', category: 'convert', status: 'ready', icon: 'FileImage', keywords: ['images', 'convert'], accept: 'image/webp,.webp', multiple: true },
  { id: 'pdf-to-word', title: 'PDF to Word', shortTitle: 'PDF to Word', description: 'Convert PDF documents to editable Word files with a document conversion engine.', category: 'convert', status: 'service-required', icon: 'FileText', keywords: ['doc', 'docx', 'word'], accept: '.pdf,application/pdf' },
  { id: 'word-to-pdf', title: 'Word to PDF', shortTitle: 'Word to PDF', description: 'Convert Word documents to PDF with layout-aware document conversion.', category: 'convert', status: 'service-required', icon: 'FileType2', keywords: ['doc', 'docx', 'word'], accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'pdf-to-excel', title: 'PDF to Excel', shortTitle: 'PDF to Excel', description: 'Extract reliable tables from PDFs into an Excel workbook.', category: 'convert', status: 'service-required', icon: 'Sheet', keywords: ['xls', 'xlsx', 'spreadsheet', 'table'], accept: '.pdf,application/pdf' },
  { id: 'excel-to-pdf', title: 'Excel to PDF', shortTitle: 'Excel to PDF', description: 'Convert spreadsheets to PDF while preserving print layout.', category: 'convert', status: 'service-required', icon: 'Sheet', keywords: ['xls', 'xlsx', 'spreadsheet'], accept: '.xls,.xlsx' },
  { id: 'pdf-to-ppt', title: 'PDF to PowerPoint', shortTitle: 'PDF to PPT', description: 'Create a PowerPoint from PDF pages using a genuine conversion service.', category: 'convert', status: 'service-required', icon: 'Presentation', keywords: ['ppt', 'pptx', 'slides'], accept: '.pdf,application/pdf' },
  { id: 'ppt-to-pdf', title: 'PowerPoint to PDF', shortTitle: 'PPT to PDF', description: 'Convert presentation slides to PDF with a document conversion engine.', category: 'convert', status: 'service-required', icon: 'Presentation', keywords: ['ppt', 'pptx', 'slides'], accept: '.ppt,.pptx' },

  { id: 'pdf-editor', title: 'PDF Editor', shortTitle: 'PDF Editor', description: 'Add text overlays, signatures, watermarks and page numbers. Existing PDF text is not edited in place.', category: 'edit', status: 'limited', icon: 'FilePenLine', keywords: ['edit', 'annotation', 'overlay'], accept: '.pdf,application/pdf' },
  { id: 'add-text', title: 'Add Text to PDF', shortTitle: 'Add text', description: 'Add a text overlay to each page or a selected page in your PDF.', category: 'edit', status: 'ready', icon: 'TextCursorInput', keywords: ['write', 'edit', 'overlay'], accept: '.pdf,application/pdf' },
  { id: 'add-image', title: 'Add Image to PDF', shortTitle: 'Add image', description: 'Place a PNG or JPEG overlay onto a PDF page.', category: 'edit', status: 'limited', icon: 'ImagePlus', keywords: ['photo', 'logo', 'edit'], accept: '.pdf,application/pdf' },
  { id: 'highlight-pdf', title: 'Highlight PDF', shortTitle: 'Highlight', description: 'Add a translucent highlight mark over a selected area of a PDF page.', category: 'edit', status: 'ready', icon: 'PenLine', keywords: ['mark', 'annotation', 'color'], accept: '.pdf,application/pdf' },
  { id: 'underline-pdf', title: 'Underline PDF Text', shortTitle: 'Underline', description: 'Add an underline annotation to a selected area of a PDF page.', category: 'edit', status: 'ready', icon: 'PenLine', keywords: ['mark', 'annotation'], accept: '.pdf,application/pdf' },
  { id: 'draw-pdf', title: 'Draw on PDF', shortTitle: 'Draw', description: 'Add a freehand-style line mark to a PDF page using page-relative placement controls.', category: 'edit', status: 'ready', icon: 'PenLine', keywords: ['ink', 'annotation'], accept: '.pdf,application/pdf' },
  { id: 'shapes-pdf', title: 'Add Shapes to PDF', shortTitle: 'Shapes', description: 'Add a rectangle, circle or arrow overlay to a selected area of a PDF page.', category: 'edit', status: 'ready', icon: 'PenLine', keywords: ['circle', 'rectangle', 'arrow', 'annotation'], accept: '.pdf,application/pdf' },
  { id: 'crop-pdf', title: 'Crop PDF Pages', shortTitle: 'Crop PDF', description: 'Adjust the visible crop box on selected PDF pages by setting page margins.', category: 'edit', status: 'ready', icon: 'FilePenLine', keywords: ['trim', 'remove margins', 'page size'], accept: '.pdf,application/pdf' },
  { id: 'watermark', title: 'Watermark PDF', shortTitle: 'Watermark', description: 'Add a text or image watermark with page selection, opacity, size, position and rotation controls.', category: 'edit', status: 'ready', icon: 'Stamp', keywords: ['stamp', 'brand', 'protect'], accept: '.pdf,application/pdf' },
  { id: 'page-numbers', title: 'Add Page Numbers', shortTitle: 'Page numbers', description: 'Add page numbers in a position and format you choose.', category: 'edit', status: 'ready', icon: 'ListOrdered', keywords: ['footer', 'header', 'pagination'], accept: '.pdf,application/pdf' },
  { id: 'redact-pdf', title: 'Redact PDF', shortTitle: 'Redact PDF', description: 'Redaction is not enabled in this build. Never use a visual black overlay as redaction.', category: 'edit', status: 'service-required', icon: 'EyeOff', keywords: ['remove sensitive data', 'privacy'], accept: '.pdf,application/pdf' },

  { id: 'sign-pdf', title: 'Sign PDF', shortTitle: 'Sign PDF', description: 'Draw, type or upload an electronic signature and embed it on a PDF page.', category: 'secure', status: 'ready', icon: 'Signature', keywords: ['signature', 'esign', 'e-sign'], accept: '.pdf,application/pdf' },
  { id: 'protect-pdf', title: 'Password Protect PDF', shortTitle: 'Protect PDF', description: 'Password encryption requires a vetted server-side PDF engine and is not enabled here.', category: 'secure', status: 'service-required', icon: 'LockKeyhole', keywords: ['encrypt', 'password', 'secure'], accept: '.pdf,application/pdf' },
  { id: 'unlock-pdf', title: 'Unlock PDF', shortTitle: 'Unlock PDF', description: 'Password removal requires proof of access and a server-side PDF engine; it is not enabled here.', category: 'secure', status: 'service-required', icon: 'UnlockKeyhole', keywords: ['remove password', 'unlock'], accept: '.pdf,application/pdf' },

  { id: 'extract-text', title: 'Extract Text from PDF', shortTitle: 'Extract text', description: 'Copy or download selectable text from your PDF. Scanned pages need OCR.', category: 'analyze', status: 'ready', icon: 'ScanText', keywords: ['text extraction', 'copy', 'words'], accept: '.pdf,application/pdf' },
  { id: 'pdf-ocr', title: 'OCR PDF', shortTitle: 'OCR PDF', description: 'Recognize text in scanned pages using Tesseract in your browser.', category: 'analyze', status: 'ready', icon: 'ScanSearch', keywords: ['scanned', 'recognition', 'hindi', 'image text'], accept: '.pdf,application/pdf' },
  { id: 'word-counter', title: 'PDF Word Counter', shortTitle: 'Word counter', description: 'Count words and pages from text that can be selected in a PDF.', category: 'analyze', status: 'ready', icon: 'WholeWord', keywords: ['words', 'count', 'statistics'], accept: '.pdf,application/pdf' },
  { id: 'character-counter', title: 'PDF Character Counter', shortTitle: 'Character counter', description: 'Count characters and pages from extractable PDF text.', category: 'analyze', status: 'ready', icon: 'Hash', keywords: ['characters', 'count'], accept: '.pdf,application/pdf' },
  { id: 'page-counter', title: 'PDF Page Counter', shortTitle: 'Page counter', description: 'Check the page count and basic dimensions of a PDF.', category: 'analyze', status: 'ready', icon: 'BookOpenCheck', keywords: ['pages', 'count'], accept: '.pdf,application/pdf' },
  { id: 'metadata-viewer', title: 'PDF Metadata Viewer', shortTitle: 'Metadata viewer', description: 'View supported document metadata and optionally update the title and author.', category: 'analyze', status: 'ready', icon: 'Info', keywords: ['title', 'author', 'properties'], accept: '.pdf,application/pdf' },

  { id: 'ai-pdf-generator', title: 'AI PDF Maker', shortTitle: 'AI PDF Maker', description: 'Draft a structured document with Gemini, edit the draft, then generate a real PDF.', category: 'ai', status: 'ready', icon: 'Sparkles', keywords: ['generate', 'ebook', 'study notes', 'create pdf', 'ai'], accept: undefined },
  { id: 'ask-pdf', title: 'Ask AI About a PDF', shortTitle: 'Ask AI', description: 'Extract text locally and ask Gemini to explain, summarize or answer questions about it.', category: 'ai', status: 'ready', icon: 'MessageCircleQuestion', keywords: ['question', 'chat', 'analyze', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'pdf-summary', title: 'PDF Summary', shortTitle: 'PDF Summary', description: 'Create a concise AI summary from selectable PDF text.', category: 'ai', status: 'ready', icon: 'AlignLeft', keywords: ['summarize', 'notes', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'pdf-notes', title: 'PDF Notes', shortTitle: 'PDF Notes', description: 'Turn a document into organized notes with key ideas and headings.', category: 'ai', status: 'ready', icon: 'NotebookPen', keywords: ['study notes', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'pdf-mcq', title: 'PDF MCQ Generator', shortTitle: 'MCQ generator', description: 'Generate practice multiple-choice questions from your document.', category: 'ai', status: 'ready', icon: 'ListChecks', keywords: ['quiz', 'questions', 'study', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'pdf-flashcards', title: 'PDF Flashcards', shortTitle: 'Flashcards', description: 'Generate question-and-answer flashcards from a document.', category: 'ai', status: 'ready', icon: 'PanelsTopLeft', keywords: ['study', 'cards', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'pdf-study-guide', title: 'PDF Study Guide', shortTitle: 'Study guide', description: 'Create a structured study guide based on your PDF.', category: 'ai', status: 'ready', icon: 'GraduationCap', keywords: ['study', 'learn', 'ai'], accept: '.pdf,application/pdf' },
  { id: 'ai-resume', title: 'AI Resume Builder', shortTitle: 'AI Resume', description: 'Draft a resume for a target role, review the content and download a PDF.', category: 'ai', status: 'ready', icon: 'BriefcaseBusiness', keywords: ['cv', 'job', 'career', 'ai'], accept: undefined },
  { id: 'ai-report-generator', title: 'AI Report Generator', shortTitle: 'AI Report', description: 'Generate an editable report draft from a topic, audience and purpose.', category: 'ai', status: 'ready', icon: 'ChartNoAxesCombined', keywords: ['business', 'assignment', 'ai'], accept: undefined },
]

export const toolById = (id: string) => tools.find((tool) => tool.id === id)
export const readyTools = tools.filter((tool) => tool.status === 'ready' || tool.status === 'limited')

export function searchTools(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return tools.filter((tool) => [tool.title, tool.shortTitle, tool.description, ...tool.keywords].join(' ').toLowerCase().includes(normalized)).slice(0, 10)
}
