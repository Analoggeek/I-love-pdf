# GitHub + Cloudflare par deploy karne ki guide

Is project ke liye **Cloudflare Workers + Assets** use karein. GitHub code rakhega; Cloudflare app, API aur static site host karega. Is route mein cPanel Node.js/PHP ki zaroorat nahi. Cloudflare deploy se pehle Cloudflare account, resources aur secrets set karne honge.

## 0. Gemini key ki safety

- Chat mein pehle bheji gayi Gemini key ko **revoke** karke nayi key banayein. Purani key use na karein.
- Gemini key, `SESSION_SECRET`, Cloudflare API token, `.env` ya `.dev.vars` ko GitHub repo mein kabhi upload na karein.
- Nayi Gemini key Cloudflare Worker ke **Secret** mein hi set karein. `.gitignore` `.env`, `.dev.vars`, `node_modules/` aur build output ko ignore karta hai.

## 1. GitHub repo taiyar karein

1. GitHub par **New repository** banayein; `Private` rakhna behtar hai.
2. Is ZIP ko apne computer par extract karein. Repo mein ZIP file upload karne ke bajay extracted project files upload/push karein.
3. Project ke root level par `package.json`, `package-lock.json`, `wrangler.toml`, `src/`, `worker/`, `db/`, `public/` aur `README-Cloudflare-HI.md` hone chahiye.
4. `node_modules/`, `.env`, `.dev.vars`, aur Gemini key upload na karein. Cloudflare build `npm ci` se dependencies install karega.

## 2. Cloudflare resources banayein

Cloudflare Dashboard mein ya apne computer par Node.js 22+ ke saath Wrangler CLI se resources banayein. Wrangler CLI route:

```bash
npm install -g wrangler
npx wrangler login
npx wrangler d1 create all-in-one-pdf-tools
npx wrangler r2 bucket create all-in-one-pdf-tools-temporary
npx wrangler queues create all-in-one-pdf-jobs
npx wrangler queues create all-in-one-pdf-jobs-dlq
```

D1 command jo `database_id` de, use `wrangler.toml` mein `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID` ki jagah paste karein. R2/Queue names config mein pehle se set hain. File save karke GitHub par commit/push karein.

D1 tables banane ke liye project folder se migration chalayein:

```bash
npx wrangler d1 migrations apply all-in-one-pdf-tools --remote --config wrangler.toml
```

## 3. Gemini aur session secrets set karein

Secrets Cloudflare Worker settings mein set karein—GitHub build variables ya repo files mein nahi:

1. Cloudflare Dashboard → **Workers & Pages** → `all-in-one-pdf-tools` Worker → **Settings** → **Variables and Secrets**.
2. `SESSION_SECRET` ko **Secret** ke roop mein add karein; random, kam-se-kam 32-character secret banayein.
3. `GEMINI_API_KEY` mein **nayi rotated key** set karein.
4. `ADMIN_EMAIL` mein apna admin email set karein (Worker secret/variable). Us email se account register karein.

Chahein to Wrangler CLI se bhi secrets set ho sakte hain:

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.toml
npx wrangler secret put GEMINI_API_KEY --config wrangler.toml
npx wrangler secret put ADMIN_EMAIL --config wrangler.toml
```

CLI secret prompt par value paste karein; command line ke andar literal key na likhein.

## 4. Cloudflare ko GitHub se connect karein

Cloudflare Workers Builds GitHub repository se commit push hote hi build/deploy kar sakta hai. Dashboard mein:

1. **Workers & Pages → Create application → Import a repository**.
2. GitHub authorize karein, apna private repo aur production branch (`main`) select karein.
3. Root directory `/`, Node.js version `22`, build command `npm ci && npm run build` set karein.
4. Deploy command `npx wrangler deploy --config wrangler.toml` set karein.
5. `SITE_URL` build variable mein apna final HTTPS origin dein, jaise `https://tools.example.com`.
6. Save/Deploy karein. Pehle deploy par Cloudflare logs mein build/deploy success check karein.

Agar GitHub repo ko existing Worker se connect kar rahe hain: **Workers & Pages → Worker → Settings → Builds → Connect**. Worker ka naam `wrangler.toml` ke `name = "all-in-one-pdf-tools"` se match hona chahiye.

## 5. URL aur live test

1. Pehle Cloudflare ka `workers.dev` URL kholkar test karein. Custom domain ke liye domain ko Cloudflare zone/DNS mein connect karein, phir Worker ke **Settings → Domains & Routes** mein domain add karein.
2. `https://YOUR-WORKER-URL/api/health` kholen. `databaseConfigured`, `storageConfigured`, `queueConfigured` aur `sessionConfigured` `true` hone chahiye. Gemini secret sahi ho to `aiConfigured: true` aana chahiye.
3. Home page aur `/merge-pdf` kholkar browser PDF tools test karein. AI feature ek chhote, non-sensitive prompt se test karein.
4. Ads ko test karne ke liye consent dialog mein **Ads only** ya **Allow all** choose karein. Browser extension/ad blocker ya provider no-fill ki wajah se ad na dikhe to vendor/CSP network error check karein.

## Jo abhi bhi provider ke bina unavailable rahega

- PDF ↔ Word/Excel/PowerPoint conversions ke liye alag genuine conversion provider configure karna hoga. Gemini key is conversion ko enable nahi karti.
- Secure PDF protect/unlock/redaction, password reset email aur payments tab tak active nahi honge jab tak unke providers/integrations configure na hon.
- GitHub code upload karne se deployment apne-aap complete nahi hota: D1 ID/migrations, R2/Queues bindings, Worker secrets aur successful Cloudflare build zaroori hain.
