# All in One PDF Tools — ByteHost cPanel deployment

This is the **Node.js App** deployment, not a Blogger/PHP site. The browser-first React build and the API run as one cPanel Passenger application. Browser-capable PDF tools continue to process files locally. Conversion jobs that require an external engine stay disabled until a real HTTPS conversion provider is configured.

## Before uploading

- Confirm your ByteHost plan's cPanel **Setup Node.js App** offers Node.js **20 or newer** (Node 22 is recommended). This package uses `sql.js` (WebAssembly) and does not require native npm modules or a separate MySQL database.
- Choose a domain or subdomain that can use HTTPS. Set up the application at the domain root (or a dedicated subdomain), not a nested path.
- Keep the application root outside `public_html`, for example `/home/CPANEL_USER/all-in-one-pdf-tools`. The app rejects an application/data path inside `public_html`; set `A1PT_DATA_DIR` to a writable private directory outside both the application root and web root (for example `/home/CPANEL_USER/.a1pt-private`). The app creates its SQLite database and temporary object directory there.

## Upload and start in cPanel

1. Download and extract `All-in-One-PDF-Tools-ByteHost.zip` in cPanel File Manager into the application root. The extracted directory must contain `app.js`, `package.json`, `worker.node.mjs`, `dist/`, and `db/migrations/` at its top level; do not leave an extra nested `bytehost-upload/bytehost-upload/` directory.
2. In cPanel, open **Setup Node.js App** (sometimes listed as **Application Manager**). Create an application with Node.js 20+ (prefer 22), **Production** mode, the application root above, application URL set to your domain root/subdomain, and startup file `app.js`.
3. Add the environment variables below in the cPanel application form. Use your real domain and cPanel username. The `PORT` value is supplied by Passenger; do not hard-code it.
4. Click **Run NPM Install** (or the equivalent in your cPanel screen). This package has one small pure-JavaScript/WebAssembly runtime dependency and no native compilation step.
5. Click **Start/Restart Application**. Use the cPanel-provided application URL over HTTPS.
6. Visit `/api/health`. A fresh setup should report `databaseConfigured: true`, `storageConfigured: true`, and `queueConfigured: true`. `sessionConfigured` is true only after you set `SESSION_SECRET`. `aiConfigured` and `conversionConfigured` remain false until their respective services are configured.

## Environment variables

Required for production accounts/sessions:

| Name | Value |
|---|---|
| `PUBLIC_ORIGIN` | Exact HTTPS origin, e.g. `https://tools.example.com` (no trailing path). This also makes same-origin checks reliable behind Passenger. |
| `A1PT_DATA_DIR` | Private writable directory **outside `public_html`**, e.g. `/home/CPANEL_USER/.a1pt-private`. The application creates it with owner-only permissions. |
| `SESSION_SECRET` | A unique random secret with at least 32 characters. Generate one in cPanel Terminal with `openssl rand -base64 48`, then paste it into the cPanel environment form. Never commit or share it. |
| `NODE_ENV` | `production` |

Optional:

| Name | Purpose |
|---|---|
| `ADMIN_EMAIL` | Email address that should have administrator access. Register that address in the app; a restart also promotes an already-registered matching account. Keep this setting private to the backend. |
| `GEMINI_API_KEY` | Backend-only Gemini API key. AI features remain unavailable when unset. |
| `GEMINI_MODEL` | Optional model override; defaults to `gemini-2.5-flash`. |
| `CONVERSION_API_URL` | Base URL of a real compatible conversion provider. Must be HTTPS and must not include credentials in the URL. Leave unset until a provider is ready. |
| `CONVERSION_API_TOKEN` | Optional provider bearer token; backend-only. |
| `MAX_FILE_MB` | Server-side conversion upload cap, 1–500 MB; defaults to 100. cPanel request/body/time limits may require a lower value. |
| `AI_GUEST_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT` | Optional AI usage limits; default to 3 and 10. |

Do **not** put Gemini/provider secrets in `VITE_*` variables or upload real secrets in `.env` files. Set them in cPanel's Node.js application environment settings.

## Data handling and limitations

- Merge, split, editing, compression, signing, and other supported browser tools stay browser-first; their PDFs are not uploaded just to perform local work.
- Only an explicitly submitted server conversion job is stored in the private temporary object folder. It is not inside `dist` or `public_html`. The source is removed after conversion succeeds or fails. A completed result is removed two minutes after the download stream finishes; a durable local job queue and periodic expiry cleanup provide restart-safe cleanup. A result that is never downloaded expires under the configured temporary-retention fallback (one hour by default).
- The server cannot delete a copy already downloaded to a user's device.
- PDF-to-Word/Excel/PowerPoint and office-to-PDF conversions stay unavailable until a real provider is configured; the app does not fake those conversions.
- AI requests go from the backend to Gemini only when a key is configured. Review the provider's data handling and configure your privacy notice accordingly.
- This cPanel adapter uses a private local SQLite file with serialized, restart-safe writes and local temporary storage. Keep `A1PT_DATA_DIR` writable and outside the web root, include it in secure backups if you need account/history recovery, and use one data directory per application/deployment. It is single-host storage, not a shared database for separate servers.
- Advertising is optional and consent-gated. The supplied 728×90 banner is placed at the top of Home and tool pages; a native placement appears below the tool work area. No ad script is requested until a visitor chooses “Ads only” or “Allow all.” The third-party scripts can access page context and may receive request/device/page data; keep the Privacy and Cookie policies aligned with the vendors and applicable consent law. The in-app preview has no external network access, so live ad fill must be verified on the HTTPS deployment.

## Rebuild the deployment archive

From the source project on a development machine with Node.js 22 and npm:

```sh
npm ci
npm run build:bytehost
```

The ready-to-upload package is written to `All-in-One-PDF-Tools-ByteHost.zip`. Re-upload the new archive and repeat **Run NPM Install** after runtime dependency changes.
