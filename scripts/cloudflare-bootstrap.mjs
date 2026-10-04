#!/usr/bin/env node
/**
 * Idempotent Cloudflare bootstrap for "All in One PDF Tools".
 *
 * Creates the resources that wrangler.toml references, only if they are
 * missing, and writes the real D1 database id into wrangler.toml so that
 * `wrangler d1 migrations apply` and `wrangler deploy` work.
 *
 *   D1 database : all-in-one-pdf-tools
 *   R2 bucket   : all-in-one-pdf-tools-temporary
 *   Queues      : all-in-one-pdf-jobs, all-in-one-pdf-jobs-dlq
 *
 * Run it after either `npx wrangler login` (local, OAuth) or by exporting
 * CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (CI).
 *
 * Safe to run again and again: existing resources are detected and reused.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configPath = path.join(root, 'wrangler.toml')

const DB_NAME = 'all-in-one-pdf-tools'
const BUCKET_NAME = 'all-in-one-pdf-tools-temporary'
const QUEUE_NAMES = ['all-in-one-pdf-jobs', 'all-in-one-pdf-jobs-dlq']

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function wrangler(args) {
  try {
    const output = execFileSync(npx, ['wrangler', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    return { ok: true, output }
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    return { ok: false, output }
  }
}

function alreadyExists(output) {
  return /already exists|already own|already created|code:\s*1001|10004|10013/i.test(output)
}

function fatal(message, output) {
  console.error(`\n✗ ${message}`)
  if (output) console.error(output.trim().split('\n').slice(-12).join('\n'))
  console.error(
    '\nAuth check: pehle `npx wrangler login` chalao (ya CI mein CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID set karo).',
  )
  process.exit(1)
}

function findDatabaseId() {
  const list = wrangler(['d1', 'list', '--json'])
  if (!list.ok) return null
  try {
    const databases = JSON.parse(list.output)
    const match = databases.find((database) => database.name === DB_NAME)
    return match?.uuid ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- D1 database
let databaseId = findDatabaseId()
if (databaseId) {
  console.log(`• D1 database already exists : ${DB_NAME} (${databaseId})`)
} else {
  const created = wrangler(['d1', 'create', DB_NAME])
  databaseId = created.output.match(/database_id\s*=\s*"([^"]+)"/)?.[1] ?? null
  if (!created.ok && !alreadyExists(created.output)) fatal(`D1 database create fail hua: ${DB_NAME}`, created.output)
  databaseId = databaseId ?? findDatabaseId()
  if (!databaseId) fatal(`D1 database ka id nahi mila: ${DB_NAME}`, created.output)
  console.log(`✓ D1 database created      : ${DB_NAME} (${databaseId})`)
}

// Write the real database id into wrangler.toml (both the placeholder and any
// older id get replaced, so the file always matches the account).
const config = readFileSync(configPath, 'utf8')
const patched = config.replace(/(database_id\s*=\s*)"[^"]*"/, `$1"${databaseId}"`)
if (patched !== config) {
  writeFileSync(configPath, patched)
  console.log(`✓ wrangler.toml updated    : database_id = "${databaseId}"`)
} else {
  console.log('• wrangler.toml already has the correct database_id')
}

// ------------------------------------------------------------------ R2 bucket
const bucket = wrangler(['r2', 'bucket', 'create', BUCKET_NAME])
if (bucket.ok) console.log(`✓ R2 bucket created        : ${BUCKET_NAME}`)
else if (alreadyExists(bucket.output)) console.log(`• R2 bucket already exists : ${BUCKET_NAME}`)
else fatal(`R2 bucket create fail hua: ${BUCKET_NAME}`, bucket.output)

// --------------------------------------------------------------------- Queues
for (const queue of QUEUE_NAMES) {
  const result = wrangler(['queues', 'create', queue])
  if (result.ok) console.log(`✓ Queue created            : ${queue}`)
  else if (alreadyExists(result.output)) console.log(`• Queue already exists     : ${queue}`)
  else fatal(`Queue create fail hua: ${queue}`, result.output)
}

console.log(`
──────────────────────────────────────────────────────────
Cloudflare resources ready ✔
──────────────────────────────────────────────────────────
Ab ye do commands chalao (ya push karo, GitHub Action khud chalayega):

  npx wrangler d1 migrations apply ${DB_NAME} --remote --config wrangler.toml
  npx wrangler deploy --config wrangler.toml

Worker secrets alag se set hote hain (repo mein kabhi na daalein):

  npx wrangler secret put SESSION_SECRET --config wrangler.toml
  npx wrangler secret put ADMIN_EMAIL    --config wrangler.toml
  npx wrangler secret put GEMINI_API_KEY --config wrangler.toml   # optional
`)
