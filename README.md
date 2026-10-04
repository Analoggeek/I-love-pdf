# All in One PDF Tools

A responsive React + TypeScript PDF workspace with browser-first processing and two deployable backend adapters: Cloudflare Workers, or a self-contained Node.js app for ByteHost cPanel. The application distinguishes operations that work locally from features that require a backend provider. It does not return renamed files as conversions, fabricate AI answers, or claim unsupported security features work.

## Architecture and scaling

```text
Browser
  ├─ local PDF.js / pdf-lib / Tesseract work (source file stays on device)
  ├─ Cloudflare Pages + Worker (edge/D1/R2/Queues deployment)
  └─ ByteHost cPanel Node.js App (single-origin Passenger deployment)
        ├─ same-origin /api/* → bundled Worker API through a Node adapter
        ├─ private SQLite metadata + persistent local job queue
        └─ private server directory for temporary conversion source/results
```

Cloudflare deployments use D1, Queues and R2; the ByteHost adapter reuses the same API with a private SQLite file, durable local queue and non-public local temporary directory. They are separate deployment targets, not shared bindings.

The normal PDF path is client-side to reduce latency, backend load and transfer cost. The backend does not receive PDFs for merge, split, page edits, image conversions, text extraction or browser OCR. Gemini is used only by AI features; ordinary PDF tasks never go to Gemini.

For independent frontend/backend releases, deploy `dist/` to Cloudflare Pages and deploy the Worker API separately from `wrangler.api.example.toml`. Route `your-domain.example/api/*` to that Worker so the frontend, APIs and secure session cookie remain same-origin. Cloudflare Pages serves static files through Cloudflare's CDN; the API Worker and Queue consumer scale separately. `wrangler.toml` remains available for a combined Worker + Assets local/compact deployment.

Static hashed assets may be cached by a CDN. API responses and job downloads are `no-store`. Conversion uploads are accepted only when a real provider is configured; the source is removed after conversion success/failure. A completed output is deleted two minutes after its download stream finishes. An output never downloaded expires after one hour by default (configurable up to 24 hours). The database stores account, job and usage metadata, not PDF contents.

### Queued conversion lifecycle

The conversion interface creates a persistent job with status `queued`, stores a validated source in private temporary storage and publishes the job ID to an asynchronous queue. The consumer updates it to `processing`, invokes the configured conversion provider, and stores a signature-checked result in private temporary storage. Cloudflare uses D1/R2/Queues; the ByteHost adapter uses SQLite, a file-backed queue and a private local directory. The UI polls `GET /api/jobs/:id`; the job can be `queued`, `processing`, `completed` or `failed`. Completed results are downloadable only until `expires_at`. After the response stream completes, the API records the download and schedules result deletion for two minutes later. Scheduled cleanup also removes expired objects/job rows; configure an R2 lifecycle rule for `temporary/conversions/` on Cloudflare as a second safety net. The cPanel adapter persists jobs and delayed cleanup messages in its private SQLite database so they survive an application restart.

No conversion provider is supplied in this repository. Without `CONVERSION_API_URL`, the conversion UI reports that the backend is unavailable and the API returns a structured `503`; it does not create a fake job or file. Once configured, the provider must implement the HTTP contract below. The Worker never fetches a browser-supplied provider URL.

**Provider contract** (set the base URL as a Cloudflare Worker variable or cPanel backend environment variable; store any bearer token as a backend secret/environment variable):

- `POST {base}/convert`: multipart fields `file`, `toolId`, and `outputFormat`; includes an `Idempotency-Key` header. Return either `200` with the converted binary body, or `202` with `{"jobId":"provider-job-id"}`.
- For `202`, `GET {base}/jobs/{jobId}` returns JSON such as `{"status":"processing","progress":42}`. Valid statuses are `queued`, `pending`, `processing`, `running`, `completed`, and `failed`.
- After `completed`, `GET {base}/jobs/{jobId}/download` returns the converted binary body. All provider calls use the configured HTTPS origin and optional `Authorization: Bearer ...` token.

The provider must be a real licensed conversion service or a properly operated conversion engine. Configure limits, retention, data-processing terms and timeouts before enabling it.

## What works in this repository

### Browser-first PDF tools

- Merge and split PDFs; extract, delete, reorder, duplicate and rotate pages
- Structural optimization and raster compression with explicit text-quality trade-offs and actual before/after size reporting
- PDF to JPG, PNG or WebP; image to PDF; selected page ranges, resolution, quality, orientation and fit controls
- Selectable-text extraction, TXT export, word/character/page counters, metadata viewer/editor
- Sequential browser OCR with Tesseract.js; OCR language data is downloaded from the configured asset host
- Text/image overlays, text or image watermarks, page numbers, annotations, crop boxes and an electronic-signature-image workflow
- AI draft editing, AI result editing and real browser-generated PDF export; Modern/Classic/Compact resume layouts

Browser PDF operations do not upload the source. The default file-size limit is 100 MB and the default PDF page limit is 500; the Worker can publish adjusted limits through `/api/settings/public`. Device memory may impose lower practical limits, especially on mobile.

### Cloudflare Worker API

Implemented API groups include health/public settings, account registration/login/logout/profile/history, consent-gated analytics, Gemini generation and analysis, admin overview/users/settings, and asynchronous conversion jobs. Conversion jobs use `POST /api/jobs`, `GET /api/jobs/:id`, and `GET /api/jobs/:id/download`; `/api/pdf/convert` is a compatibility alias for job creation.

The Gemini key and conversion-provider token are server-side secrets. AI PDF analysis sends browser-extracted text and a prompt; it does not upload the original PDF. On Cloudflare, D1 stores account/session/job metadata and R2 is used only for temporary asynchronous jobs; ordinary browser tools do not use R2. On cPanel, the same data is stored in a private local SQLite database and only explicitly submitted conversion files are written to its private temporary directory.

## Important availability and launch limitations

- PDF ↔ Word, Excel and PowerPoint require a genuine conversion provider. The job pipeline is implemented, but conversion remains unavailable until a real provider URL/token is configured. For Cloudflare, also provision the Queue, R2 and D1 migration; the ByteHost adapter supplies private local equivalents.
- Secure PDF encryption/password removal and irreversible redaction are not implemented; those pages stay explicitly unavailable. A black overlay is not treated as redaction.
- Password reset/email verification, payment processing, Turnstile verification and a support inbox are not configured. Do not advertise these as live workflows until their provider integrations are ready.
- The supplied banner and native ad tags are integrated at the requested fixed placements and load only after explicit advertising consent. Their live fill, provider compliance and revenue reporting still require verification on the deployed domain; the admin UI does not execute arbitrary editable scripts.
- No production secrets, Cloudflare resources, conversion provider or custom domain have been supplied. This project has not been deployed or independently security-reviewed. Configure services, run the test checklist, review legal/provider obligations, and conduct a security/accessibility review before launch.

## Local development

Use Node.js 22+ for Wrangler 4. Vite can run on Node 20+, but the Worker tooling requires 22.

```bash
npm ci
npm run dev
```

This runs the Vite frontend on `http://localhost:5173`; browser-first tools work without a backend. To exercise the combined Worker + Assets application locally:

```bash
npx wrangler d1 create all-in-one-pdf-tools
npx wrangler r2 bucket create all-in-one-pdf-tools-temporary
npx wrangler queues create all-in-one-pdf-jobs
npx wrangler queues create all-in-one-pdf-jobs-dlq
```

Replace the D1 ID/bucket name in `wrangler.toml`, then:

```bash
npx wrangler d1 migrations apply all-in-one-pdf-tools --local --config wrangler.toml
cp .dev.vars.example .dev.vars
# Set a random SESSION_SECRET (32+ bytes). Add Gemini/provider values only if configured.
npm run build
npx wrangler dev --config wrangler.toml --local --ip 0.0.0.0 --port 8787
```

The local Worker serves frontend and API together on port 8787. Without a real provider, conversion jobs intentionally return `503 CONVERSION_NOT_CONFIGURED`. Do not test conversions by substituting a renamed input or a fabricated output.

## Deployment option C: ByteHost cPanel Node.js App

A ready-to-upload archive is produced with `npm run build:bytehost`. Extract its contents directly into a cPanel application root outside `public_html`, select Node.js 20+ (Node 22 recommended), set startup file `app.js`, set a `PUBLIC_ORIGIN`, private `A1PT_DATA_DIR`, and 32+ character `SESSION_SECRET`, then run **NPM Install** and start/restart the app in cPanel's **Setup Node.js App** interface. The deployment uses a private SQLite database and local file-backed queue; it does not require Cloudflare D1/R2/Queues or a separate MySQL database. Full upload, environment, health-check and cleanup instructions are in [`bytehost/README-cpanel.md`](bytehost/README-cpanel.md).

The generated archive contains the built React site, bundled API, runtime package metadata and versioned SQLite migrations. `GEMINI_API_KEY` and conversion-provider settings remain optional backend environment variables. Without them, their dependent features remain unavailable. Browser-first PDF tools continue working without uploading PDFs.

## Deployment option A: combined Worker + Assets

1. Create a Cloudflare account and authenticate with `npx wrangler login`.
2. Create D1, R2 and both queues (`all-in-one-pdf-jobs` and `all-in-one-pdf-jobs-dlq`). Update resource IDs/names in `wrangler.toml`.
3. Apply versioned migrations: `npx wrangler d1 migrations apply all-in-one-pdf-tools --remote --config wrangler.toml`.
4. Add secrets with Wrangler; never put credentials in Git or `VITE_*` variables:
   ```bash
   npx wrangler secret put SESSION_SECRET --config wrangler.toml
   npx wrangler secret put ADMIN_EMAIL --config wrangler.toml
   npx wrangler secret put GEMINI_API_KEY --config wrangler.toml
   npx wrangler secret put CONVERSION_API_TOKEN --config wrangler.toml
   ```
   `CONVERSION_API_TOKEN` is needed only if the configured provider requires it. Set `CONVERSION_API_URL` as a Worker variable only after the provider contract and retention have been reviewed.
5. Build with the public origin and deploy:
   ```bash
   SITE_URL=https://your-domain.example npm run build
   npx wrangler deploy --config wrangler.toml
   ```
6. Attach a Cloudflare custom domain, force HTTPS, and verify `/api/health`, `/robots.txt`, `/sitemap.xml` and the public tool routes.
7. Set the backend-only `ADMIN_EMAIL` Worker variable/secret before registration, then create an account with that exact email. Registration grants admin access only to that configured address. For an already registered account, promote it through a secured database migration/console and populate `admin_users` as needed.

## Deployment option B: independent Cloudflare Pages frontend + Worker API

1. Push the repository to GitHub. In Cloudflare, create a **Workers & Pages → Pages** project connected to that repository.
2. Set Node version 22, build command `npm ci && npm run build`, output directory `dist`, and build environment `SITE_URL=https://your-domain.example`. Pages serves static content at the edge/CDN; no API secret belongs in Pages build variables.
3. Copy `wrangler.api.example.toml` to `wrangler.api.toml`, replace the D1 ID and R2 bucket name, create the two queues, apply migrations and set Worker secrets as in option A.
4. Deploy the API Worker: `npx wrangler deploy --config wrangler.api.toml`.
5. In the Cloudflare dashboard, attach the Worker to the custom-domain route `your-domain.example/api/*`. Keep the Pages site and Worker API on the same hostname so relative `/api/...` calls and `SameSite=Lax` session cookies remain same-origin. Do not point the public frontend at `localhost` or enable wildcard CORS for production.
6. Bind the custom domain to Pages, verify routing precedence for `/api/*`, run the test checklist and check Worker/D1/Queue/R2 logs. Deploy the frontend and API independently thereafter.

## Configuration, privacy and costs

- `GEMINI_API_KEY` — Worker secret; used only by AI endpoints.
- `SESSION_SECRET` — Worker secret for sessions/rate-limit pseudonyms/analytics identifiers; use a cryptographically random 32+ byte value.
- `CONVERSION_API_URL` — non-secret Worker variable for the reviewed provider. `CONVERSION_API_TOKEN` — optional Worker secret.
- `DB`, `FILES`, `PDF_JOBS` — D1, temporary R2 and Queues bindings from Wrangler config.
- `MAX_FILE_MB` — hard server-side file cap; the protected admin setting may lower it. `AI_GUEST_DAILY_LIMIT` and `AI_USER_DAILY_LIMIT` — configured defaults that protected settings can adjust.
- `SITE_URL` — build-time public origin for static canonical/sitemap output. Without it, the combined Worker creates an origin-aware sitemap at request time.
- `file_retention_hours` defaults to 1 hour and controls results that are never downloaded; it is configurable in admin settings (bounded to 24 hours). A downloaded server result expires two minutes after its response stream completes. Queue jobs also expire automatically; add an R2 lifecycle rule for `temporary/conversions/` as a Cloudflare safety net. On cPanel, keep the local data directory outside the web root and protected by filesystem permissions.
- Analytics is opt-in. The design stores month-rotating HMAC pseudonyms instead of raw IPs; it does not send document contents. Static hashed files are cacheable; APIs, uploads and job downloads are not cached.
- Advertising: the fixed 728×90 banner and native tags load only after “Ads only” or “Allow all” consent. The frontend does not accept arbitrary admin-provided scripts. Review both vendor policies, confirm consent requirements for the deployment jurisdiction, test the CSP and responsive layouts, and verify the actual tag behavior on the live domain.
- For cost control, keep merges/splits/edits/OCR in the browser where feasible, cap upload size/pages, rate-limit AI and conversion job creation, use queues for provider-bound conversions, keep R2 objects temporary, and call Gemini only for explicitly requested AI work.

## Final test checklist

Use representative, non-sensitive fixtures and verify the downloaded bytes/content—not just the UI message.

- Browser PDF: merge, split, compress (including no-shrink cases), extract, delete, reorder, rotate, JPG/PNG/WebP export, image-to-PDF, text extraction, OCR, metadata, text/image watermark, page numbers, annotation, crop and electronic-signature placement.
- Backend integration: provider-unconfigured conversion returns a clear `503`; with a real provider on staging, verify `queued → processing → completed/failed`, progress polling, validated download, retry behavior and R2 expiry/deletion.
- AI: with a valid Gemini secret, test generation, summary, PDF Q&A, notes, MCQs, flashcards, resume and report; inspect rate limits/credits and validate AI output before export. With no key, confirm clear unavailable errors and no fabricated response.
- Accounts/admin: signup, login, logout, dashboard, history, admin overview/users/settings/credits, disabled-account protections, rate limits and session expiry. Password reset is not implemented and must not be marked as passing.
- Security: same-origin writes, CSP, MIME/signature validation, size/page limits, secret isolation, no-store API responses, guest job capability IDs, R2 TTL cleanup and privacy consent.
- SEO/mobile: route-specific title/description/canonical, sitemap, robots, structured data, internal links, keyboard/screen-reader checks and Android/iPhone/tablet/desktop layouts.
- Ads: before consent, confirm no publisher script requests occur; after “Ads only” or “Allow all,” verify one 728×90 banner at the top of Home, one at the top of tool pages and one native ad below the tool work area. Test opt-out/withdrawal, mobile layout and CSP/network errors. The in-app preview blocks external network access, so it cannot verify live ad fill.

The list above is a deployment checklist, not a claim that every external workflow has been end-to-end tested. The cPanel adapter can be smoke-tested locally with its bundled server after `npm run build:bytehost`; it has not been installed on the user’s ByteHost account, and the selected plan’s exact Node version/resource limits still need confirmation. In particular, no real conversion provider, Gemini key, production account secret, payment provider or email/password-reset provider is configured here. The two supplied publisher tags are wired behind explicit ad consent, but live serving/fill and provider-side compliance have not been verified from this workspace.
