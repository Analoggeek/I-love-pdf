# GitHub + Cloudflare par deploy karne ki guide

Is project ke liye **Cloudflare Workers + Assets** use karein. GitHub code rakhega; Cloudflare app, API aur static site host karega. Is route mein cPanel Node.js/PHP ki zaroorat nahi.

> **Note:** is session ki branch `arena/01a10774-i-love-pdf` hai. Deploy automation usi mein add hui hai — pehle `main` mein merge karein, phir deploy hoga.

## 0. Secrets ki safety (sabse pehle)

- Gemini key ya Cloudflare API token **chat mein na bhejein**. Jo key pehle chat mein ja chuki hai use **revoke** karke nayi banayein.
- API token, `SESSION_SECRET`, `GEMINI_API_KEY`, `.env`, `.dev.vars` — inme se kuch bhi GitHub repo mein commit na karein. `.gitignore` in sab ko ignore karta hai.
- Sab secrets GitHub repo secrets ya Cloudflare Worker secrets mein rakhein.
- Cloudflare API token ko **repo-wide secret** banayein, code/text file mein nahi.

## 1. Sabse tez tareeka: GitHub Actions se auto-deploy (recommended)

Repo mein workflow pehle se hai: [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml). Ye `main` par har push pe build karta hai, Cloudflare resources banata/reuse karta hai, D1 migrations lagata hai, Worker deploy karta hai aur health check chalata hai.

### 1.1 Cloudflare API token banayein

Cloudflare Dashboard → **My Profile → API Tokens → Create Token → Custom token**:

| Permission | Level |
| --- | --- |
| Workers Scripts | Edit |
| D1 | Edit |
| Workers R2 Storage | Edit |
| Queues | Edit |
| Account Settings | Read |

Account ID Dashboard ke URL ya **Workers & Pages → Overview** se milta hai.

### 1.2 GitHub repo secrets add karein

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**. Sirf pehla wala **zaroori** hai, baaki workflow khud sambhal leta hai:

| Secret | Zaroori? | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | **Haan** | Upar wala token |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | Set na ho to workflow token se khud resolve karta hai (multi-account ho to set karein) |
| `SESSION_SECRET` | Optional | Set na ho to pehli deploy par 32-byte random secret generate karke Worker par set ho jaata hai |
| `ADMIN_EMAIL` | Optional | Default: repo owner ka email |
| `GEMINI_API_KEY` | Optional | AI features ke liye (nayi rotated key) |
| `TURNSTILE_SECRET` | Optional | Bot protection ke liye |

Optional: **Settings → Secrets and variables → Actions → Variables** mein `SITE_URL` (jaise `https://tools.example.com`) — isse sitemap/SEO tags sahi origin ke banenge.

### 1.3 Deploy chalao

1. Is branch ka PR `main` mein merge karein (ya direct `main` par push karein).
2. GitHub → **Actions → Deploy to Cloudflare Workers** → run hone dein (ya `Run workflow` dabayein).
3. Workflow ka kaam: token verify → resources (D1/R2/Queues) create/reuse → D1 migrations → build → deploy → Worker secrets → health check.
4. Log ke aakhir mein aur **Summary** tab mein live URL milega: `https://<worker-name>.<subdomain>.workers.dev`.
5. `https://<worker-name>.<subdomain>.workers.dev/api/health` → `databaseConfigured`, `sessionConfigured`, `queueConfigured`, `storageConfigured` sab `true` hone chahiye.

`SESSION_SECRET` na dene par bhi account features chalu ho jaate hain (workflow generate karta hai). Uske baad SESSION_SECRET badalne par existing logins invalid ho jaate hain — isliye ek baar set karke rakhna behtar hai.

## 2. Manual (Wrangler CLI se) deploy

Apne computer par Node.js 22+ ke saath:

```bash
npm install -g wrangler       # ya npx use karein
npx wrangler login            # browser se Cloudflare authorize
npm ci
node scripts/cloudflare-bootstrap.mjs   # D1 + R2 + Queues banata/reuse karta hai, D1 id wrangler.toml mein likhta hai
```

Bootstrap ke baad ek hi command se poora deploy:

```bash
npm run deploy
# = npm run build && bootstrap && D1 migrations apply --remote && wrangler deploy
```

Pehli baar alag-alag chalana ho to:

```bash
npx wrangler d1 migrations apply all-in-one-pdf-tools --remote --config wrangler.toml
npx wrangler deploy --config wrangler.toml
```

`cloudflare-bootstrap.mjs` **idempotent** hai — dobara chalane par existing resources reuse hote hain, duplicate nahi bante.

Chhoti trick: `npm run deploy` se pehle `SITE_URL` set karein, jaise
`SITE_URL=https://tools.example.com npm run deploy`.

## 3. Worker secrets set karein

Cloudflare Dashboard → **Workers & Pages → all-in-one-pdf-tools → Settings → Variables and Secrets**:

- `SESSION_SECRET` → **Secret**, 32+ random characters (isake bina account/privacy features `503` dete hain).
- `ADMIN_EMAIL` → apna admin email; usi email se account register karein.
- `GEMINI_API_KEY` → optional, AI features ke liye (nayi rotated key).
- `TURNSTILE_SECRET` → optional.

Wrangler se:

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.toml
npx wrangler secret put ADMIN_EMAIL --config wrangler.toml
npx wrangler secret put GEMINI_API_KEY --config wrangler.toml
```

CLI prompt par value paste karein; command ke andar literal key na likhein.

## 4. Vercel/Nitro jaisa GitHub build (optional)

Cloudflare Workers Builds GitHub repo se bhi deploy kar sakta hai: **Workers & Pages → Worker → Settings → Builds → Connect**, production branch `main`, root `/`, build command `npm ci && npm run build`, deploy command `npx wrangler deploy --config wrangler.toml`.

⚠️ GitHub Actions aur Workers Builds dono ek saath rakhne par **double deploy** hoga. Ek path chunein.

## 5. Live URL aur test

1. Pehle `workers.dev` URL test karein. Custom domain ke liye domain Cloudflare zone/DNS mein hone chahiye, phir **Worker → Settings → Domains & Routes** mein add karein.
2. `https://YOUR-WORKER-URL/api/health` — sab `configured` flags `true` check karein.
3. Home aur `/merge-pdf` (ya `/merge-pdf/`) kholkar browser PDF tools test karein.
4. Chhote, non-sensitive prompt se AI feature test karein.
5. `robots.txt`, `sitemap.xml` aur (agar custom domain laga ho) canonical URLs verify karein.
6. Ads: consent dialog mein **Ads only** ya **Allow all** choose karein; ad na aaye to browser extension/ad blocker ya provider no-fill/CSP check karein.

## Jo abhi bhi provider ke bina unavailable rahega

- PDF ↔ Word/Excel/PowerPoint conversions ke liye alag genuine conversion provider (`CONVERSION_API_URL`, `CONVERSION_API_TOKEN`) chahiye. Gemini key is conversion ko enable nahi karti.
- Secure PDF protect/unlock/redaction, password-reset email aur payments tab tak active nahi jab tak unke providers configure na hon.
- GitHub par code push karne se deployment apne-aap complete nahi hota: D1 id/migrations, R2/Queues bindings, Worker secrets aur successful build zaroori hain.
