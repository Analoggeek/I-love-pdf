import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const shell = await readFile('dist/index.html', 'utf8')
const source = await readFile('src/data/tools.ts', 'utf8')
const toolSource = source.slice(source.indexOf('export const tools: Tool[]'))
const toolIds = [...toolSource.matchAll(/\{ id: '([a-z0-9-]+)'/g)].map((match) => match[1])
const staticRoutes = ['about', 'contact', 'privacy', 'terms', 'cookies', 'disclaimer']
const routes = [...new Set([...toolIds, ...staticRoutes])]
const titleFromSlug = (slug) => slug.split('-').map((part) => part === 'pdf' ? 'PDF' : part === 'ai' ? 'AI' : part.toUpperCase() === 'JPG' || part.toUpperCase() === 'PPT' ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)).join(' ')
const descriptionFor = (slug) => {
  const titles = {
    'merge-pdf': 'Merge PDF files online. Arrange multiple PDFs and combine them into one document in your browser.',
    'split-pdf': 'Split a PDF by page range or save separate pages. Your browser prepares the result without uploading the original.',
    'compress-pdf': 'Optimize a PDF in your browser and compare the actual before and after file sizes. No guaranteed compression claims.',
    'pdf-to-jpg': 'Convert PDF pages to JPG images in your browser. Choose selected pages and rendering resolution.',
    'jpg-to-pdf': 'Create a PDF from JPG images. Arrange files and choose page size, orientation and margins.',
    'pdf-editor': 'Add new text overlays, signatures, watermarks and page numbers to a PDF. Existing text is not edited in place.',
    'sign-pdf': 'Add an electronic signature image to a PDF page. This is not a qualified digital signature.',
    'pdf-ocr': 'Recognize text in scanned PDF pages with browser-based OCR. Review the extracted text before use.',
    'ai-pdf-generator': 'Create an editable document draft with Gemini and generate a PDF after reviewing the content.',
  }
  return titles[slug] || `Use ${titleFromSlug(slug)} in the All in One PDF Tools workspace. Check availability and process your document with clear, browser-first tools.`
}
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }
function buildHtml(route) {
  const title = route === '/' ? 'All in One PDF Tools — Every PDF Tool You Need in One Place' : `${titleFromSlug(route.slice(1))} — All in One PDF Tools`
  const description = route === '/' ? 'Merge, split, compress, convert, edit and sign PDFs online. Private, easy-to-use PDF tools plus AI document helpers.' : descriptionFor(route.slice(1))
  let html = shell.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
  html = html.replace('</head>', `  <link rel="canonical" href="__CANONICAL__" />\n  <meta property="og:title" content="${escapeHtml(title)}" />\n  <meta property="og:description" content="${escapeHtml(description)}" />\n  </head>`)
  return html
}

for (const route of routes) {
  const slugPath = `/${route}`
  const target = join('dist', route, 'index.html')
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, buildHtml(slugPath))
}
await writeFile('dist/index.html', buildHtml('/'))

const base = process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.CF_PAGES_URL
if (base) {
  const origin = new URL(base.startsWith('http') ? base : `https://${base}`).origin
  const urls = ['/', ...routes.map((route) => `/${route}`)]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${origin}${path}</loc><changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq></url>`).join('\n')}\n</urlset>\n`
  await writeFile('dist/sitemap.xml', sitemap)
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /login\nSitemap: ${origin}/sitemap.xml\n`)
}
console.log(`SEO shells generated for ${routes.length + 1} public routes. Set SITE_URL at build time for a static sitemap; the Worker also serves one from the request origin.`)
