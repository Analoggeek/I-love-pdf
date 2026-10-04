import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync, rmSync, statSync } from 'node:fs'
import { readdir, mkdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import initSqlJs from 'sql.js'
import worker from './worker.node.mjs'

const require = createRequire(import.meta.url)
const APP_DIR = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(APP_DIR, 'dist')
const MIGRATIONS_DIR = path.join(APP_DIR, 'db', 'migrations')
const HOME = process.env.HOME || os.homedir()
const DATA_DIR = path.resolve(process.env.A1PT_DATA_DIR || path.join(HOME, '.a1pt-private'))
const DB_FILE = path.join(DATA_DIR, 'app.sqlite')
const OBJECTS_DIR = path.join(DATA_DIR, 'objects')
const PORT = Number(process.env.PORT || 3000)

function log(level, message, error) {
  const detail = error ? ` ${error?.stack || error}` : ''
  console[level](`[a1pt] ${new Date().toISOString()} ${message}${detail}`)
}

function ensurePrivateDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  try { chmodSync(directory, 0o700) } catch {}
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

if (!existsSync(DIST_DIR)) throw new Error(`Built frontend not found at ${DIST_DIR}. Upload the complete ByteHost deployment package.`)
const PUBLIC_HTML = path.join(HOME, 'public_html')
if (isWithin(PUBLIC_HTML, APP_DIR)) throw new Error('For security, the Node application root must be outside public_html.')
if (isWithin(PUBLIC_HTML, DATA_DIR) || isWithin(APP_DIR, DATA_DIR) || isWithin(DIST_DIR, DATA_DIR)) throw new Error('A1PT_DATA_DIR must be a private directory outside public_html and the application root.')
ensurePrivateDirectory(DATA_DIR)
ensurePrivateDirectory(OBJECTS_DIR)

const SQL = await initSqlJs({ locateFile: (filename) => require.resolve(`sql.js/dist/${filename}`) })
const DB_LOCK_DIR = `${DB_FILE}.lock`
let sqlDatabase = openDatabase()
let persistSequence = 0

function openDatabase() {
  const bytes = existsSync(DB_FILE) ? new Uint8Array(readFileSync(DB_FILE)) : undefined
  const database = new SQL.Database(bytes)
  database.run('PRAGMA foreign_keys = ON')
  return database
}

function reloadDatabase() {
  const previous = sqlDatabase
  sqlDatabase = openDatabase()
  try { previous?.close() } catch {}
}

function persistDatabase() {
  const temporary = `${DB_FILE}.tmp-${process.pid}-${persistSequence++}`
  writeFileSync(temporary, Buffer.from(sqlDatabase.export()), { mode: 0o600 })
  try { chmodSync(temporary, 0o600) } catch {}
  renameSync(temporary, DB_FILE)
  try { chmodSync(DB_FILE, 0o600) } catch {}
}

function lockIsActive() {
  let lockStat
  try { lockStat = statSync(DB_LOCK_DIR) }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error }
  try {
    const owner = JSON.parse(readFileSync(path.join(DB_LOCK_DIR, 'owner'), 'utf8'))
    if (owner.hostname && owner.hostname !== os.hostname()) return Date.now() - lockStat.mtimeMs < 120_000
    try { process.kill(Number(owner.pid), 0); return true }
    catch (error) { return error?.code !== 'ESRCH' }
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return Date.now() - lockStat.mtimeMs < 5_000
    throw error
  }
}

async function acquireDatabaseLock() {
  const deadline = Date.now() + 30_000
  while (true) {
    try {
      mkdirSync(DB_LOCK_DIR, { mode: 0o700 })
      const token = crypto.randomUUID()
      try {
        writeFileSync(path.join(DB_LOCK_DIR, 'owner'), JSON.stringify({ pid: process.pid, hostname: os.hostname(), token }), { flag: 'wx', mode: 0o600 })
      } catch (error) {
        rmSync(DB_LOCK_DIR, { recursive: true, force: true })
        throw error
      }
      return () => {
        try {
          const owner = JSON.parse(readFileSync(path.join(DB_LOCK_DIR, 'owner'), 'utf8'))
          if (owner.token === token) rmSync(DB_LOCK_DIR, { recursive: true, force: true })
        } catch (error) { if (error?.code !== 'ENOENT') throw error }
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      if (!lockIsActive()) { rmSync(DB_LOCK_DIR, { recursive: true, force: true }); continue }
      if (Date.now() >= deadline) throw new Error('The private local database is busy. Please retry the request.')
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
}

class LocalPreparedStatement {
  constructor(database, query) { this.database = database; this.query = query; this.values = [] }
  bind(...values) { this.values = values.map((value) => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value); return this }
  async first(columnName) {
    this.database.refresh()
    const statement = this.database.raw.prepare(this.query)
    try {
      statement.bind(this.values)
      const row = statement.step() ? statement.getAsObject() : null
      return columnName && row ? row[columnName] ?? null : row
    } finally { statement.free() }
  }
  async all() {
    this.database.refresh()
    const statement = this.database.raw.prepare(this.query)
    const results = []
    try {
      statement.bind(this.values)
      while (statement.step()) results.push(statement.getAsObject())
    } finally { statement.free() }
    return { results, success: true, meta: { duration: 0 } }
  }
  async run() {
    return this.database.withWriteLock((database) => {
      database.run(this.query, this.values)
      const changes = database.getRowsModified()
      if (changes > 0) persistDatabase()
      return { results: [], success: true, meta: { changes, duration: 0 } }
    })
  }
}

class LocalD1Database {
  get raw() { return sqlDatabase }
  refresh() { reloadDatabase() }
  prepare(query) { return new LocalPreparedStatement(this, query) }
  async withWriteLock(operation) {
    const release = await acquireDatabaseLock()
    try {
      reloadDatabase()
      return await operation(sqlDatabase)
    } finally { release() }
  }
  async exec(query) {
    return this.withWriteLock((database) => {
      database.run(query)
      persistDatabase()
      return { count: 0, duration: 0 }
    })
  }
  async batch(statements) {
    return this.withWriteLock((database) => {
      database.run('BEGIN')
      try {
        const results = []
        for (const statement of statements) {
          database.run(statement.query, statement.values)
          results.push({ results: [], success: true, meta: { changes: database.getRowsModified(), duration: 0 } })
        }
        database.run('COMMIT')
        persistDatabase()
        return results
      } catch (error) {
        database.run('ROLLBACK')
        persistDatabase()
        throw error
      }
    })
  }
}

const DB = new LocalD1Database()

async function applyMigrations() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((name) => /^\d+.*\.sql$/i.test(name)).sort()
  const migrations = await Promise.all(names.map(async (name) => ({ name, source: await readFile(path.join(MIGRATIONS_DIR, name), 'utf8') })))
  await DB.withWriteLock((database) => {
    database.run('CREATE TABLE IF NOT EXISTS a1pt_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
    for (const migration of migrations) {
      const existing = database.prepare('SELECT name FROM a1pt_migrations WHERE name = ?')
      existing.bind([migration.name])
      const applied = existing.step()
      existing.free()
      if (applied) continue
      database.run('BEGIN')
      try {
        database.run(migration.source)
        database.run('INSERT INTO a1pt_migrations (name, applied_at) VALUES (?, ?)', [migration.name, new Date().toISOString()])
        database.run('COMMIT')
        persistDatabase()
        log('log', `Applied database migration ${migration.name}`)
      } catch (error) {
        database.run('ROLLBACK')
        throw new Error(`Could not apply database migration ${migration.name}: ${error?.message || error}`)
      }
    }
    if (process.env.ADMIN_EMAIL) {
      const email = process.env.ADMIN_EMAIL.trim().toLowerCase()
      if (email) {
        database.run('UPDATE users SET is_admin = 1 WHERE lower(email) = ?', [email])
        database.run('INSERT OR IGNORE INTO admin_users (user_id, created_at) SELECT id, ? FROM users WHERE lower(email) = ?', [new Date().toISOString(), email])
        persistDatabase()
      }
    }
  })
}

await applyMigrations()
function safeObjectPath(key) {
  const raw = String(key || '').replaceAll('\\', '/')
  const parts = raw.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) throw new Error('Invalid temporary object key.')
  const destination = path.resolve(OBJECTS_DIR, ...parts)
  if (!isWithin(OBJECTS_DIR, destination)) throw new Error('Invalid temporary object key.')
  return destination
}

async function toBuffer(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  if (typeof value === 'string') return Buffer.from(value)
  if (value && typeof value.getReader === 'function') return Buffer.from(await new Response(value).arrayBuffer())
  if (value && typeof value.arrayBuffer === 'function') return Buffer.from(await value.arrayBuffer())
  throw new TypeError('Unsupported temporary object data.')
}

class LocalObjectStorage {
  async put(key, value) {
    const destination = safeObjectPath(key)
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
    const temporary = `${destination}.part-${process.pid}-${Date.now()}`
    const data = await toBuffer(value)
    await writeFile(temporary, data, { mode: 0o600 })
    await rename(temporary, destination)
    return { key: String(key), size: data.byteLength }
  }
  async get(key) {
    const destination = safeObjectPath(key)
    try {
      const metadata = await stat(destination)
      if (!metadata.isFile()) return null
      return {
        body: Readable.toWeb(createReadStream(destination)),
        size: metadata.size,
        arrayBuffer: async () => {
          const data = await readFile(destination)
          return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        },
      }
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const destination = safeObjectPath(key)
      try { await rm(destination, { force: true }) }
      catch (error) { if (error?.code !== 'ENOENT') throw error }
      let parent = path.dirname(destination)
      while (parent !== OBJECTS_DIR && isWithin(OBJECTS_DIR, parent)) {
        try { await rmdir(parent) }
        catch (error) { if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error; break }
        parent = path.dirname(parent)
      }
    }
  }
  async list(options = {}) {
    const prefix = String(options.prefix || '').replace(/^\/+|\/+$/g, '')
    const limit = Math.max(1, Math.min(1000, Number(options.limit || 1000)))
    const objects = []
    async function walk(folder, relative) {
      let entries
      try { entries = await readdir(folder, { withFileTypes: true }) }
      catch (error) { if (error?.code === 'ENOENT') return; throw error }
      for (const entry of entries) {
        const nextRelative = relative ? `${relative}/${entry.name}` : entry.name
        const absolute = path.join(folder, entry.name)
        if (entry.isDirectory()) await walk(absolute, nextRelative)
        else if (entry.isFile() && nextRelative.startsWith(prefix)) {
          const info = await stat(absolute)
          objects.push({ key: nextRelative, size: info.size, uploaded: new Date(info.mtimeMs).toISOString() })
          if (objects.length >= limit) return
        }
      }
    }
    await walk(OBJECTS_DIR, '')
    return { objects, truncated: objects.length >= limit }
  }
}

let wakeQueue = () => {}
class LocalQueueBinding {
  async send(body, options = {}) {
    const id = crypto.randomUUID()
    const delay = Math.max(0, Math.min(3600, Math.floor(Number(options.delaySeconds || 0))))
    await DB.prepare('INSERT INTO a1pt_queue_messages (id, body, attempts, available_at, processing, reserved_at, created_at) VALUES (?, ?, 0, ?, 0, NULL, ?)')
      .bind(id, JSON.stringify(body), Date.now() + delay * 1000, new Date().toISOString()).run()
    wakeQueue()
  }
}

await DB.exec(`CREATE TABLE IF NOT EXISTS a1pt_queue_messages (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  processing INTEGER NOT NULL DEFAULT 0,
  reserved_at INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_a1pt_queue_due ON a1pt_queue_messages(processing, available_at);`)
await DB.prepare('UPDATE a1pt_queue_messages SET processing = 0, reserved_at = NULL WHERE processing = 1').run()

const FILES = new LocalObjectStorage()
const PDF_JOBS = new LocalQueueBinding()
const env = {
  DB,
  FILES,
  PDF_JOBS,
  ASSETS: { fetch: serveStaticAsset },
  CONVERSION_API_URL: process.env.CONVERSION_API_URL || undefined,
  CONVERSION_API_TOKEN: process.env.CONVERSION_API_TOKEN || undefined,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
  GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
  SESSION_SECRET: process.env.SESSION_SECRET || undefined,
  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET || undefined,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || undefined,
  MAX_FILE_MB: process.env.MAX_FILE_MB || '100',
  AI_GUEST_DAILY_LIMIT: process.env.AI_GUEST_DAILY_LIMIT || '3',
  AI_USER_DAILY_LIMIT: process.env.AI_USER_DAILY_LIMIT || '10',
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
}

async function serveStaticAsset(request) {
  const url = new URL(request.url)
  let pathname
  try { pathname = decodeURIComponent(url.pathname) }
  catch { return new Response('Bad path', { status: 400 }) }
  const requested = path.resolve(DIST_DIR, `.${pathname}`)
  let target = requested
  if (!isWithin(DIST_DIR, target)) return new Response('Not found', { status: 404 })
  try {
    const metadata = await stat(target)
    if (metadata.isDirectory()) target = path.join(target, 'index.html')
    else if (!metadata.isFile()) target = path.join(DIST_DIR, 'index.html')
  } catch {
    target = path.join(DIST_DIR, 'index.html')
  }
  let metadata
  try { metadata = await stat(target) }
  catch { return new Response('Not found', { status: 404 }) }
  const extension = path.extname(target).toLowerCase()
  const headers = new Headers({
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Content-Length': String(metadata.size),
    'Last-Modified': metadata.mtime.toUTCString(),
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
  })
  if (request.method === 'HEAD') return new Response(null, { headers })
  return new Response(Readable.toWeb(createReadStream(target)), { headers })
}

let queueBusy = false
async function drainQueue() {
  if (queueBusy) return
  queueBusy = true
  try {
    const staleBefore = Date.now() - 5 * 60 * 1000
    await DB.prepare('UPDATE a1pt_queue_messages SET processing = 0, reserved_at = NULL WHERE processing = 1 AND reserved_at < ?').bind(staleBefore).run()
    const due = await DB.prepare('SELECT id, body, attempts FROM a1pt_queue_messages WHERE processing = 0 AND available_at <= ? ORDER BY available_at LIMIT 10').bind(Date.now()).all()
    const messages = []
    for (const row of due.results || []) {
      const claim = await DB.prepare('UPDATE a1pt_queue_messages SET processing = 1, attempts = attempts + 1, reserved_at = ? WHERE id = ? AND processing = 0')
        .bind(Date.now(), row.id).run()
      if (!claim.meta?.changes) continue
      messages.push({
        body: JSON.parse(row.body),
        attempts: Number(row.attempts || 0) + 1,
        ack() { void DB.prepare('DELETE FROM a1pt_queue_messages WHERE id = ?').bind(row.id).run().catch((error) => log('error', 'Queue acknowledgement failed.', error)) },
        retry(options = {}) {
          const delay = Math.max(1, Math.min(3600, Math.floor(Number(options.delaySeconds || 5))))
          void DB.prepare('UPDATE a1pt_queue_messages SET processing = 0, reserved_at = NULL, available_at = ? WHERE id = ?')
            .bind(Date.now() + delay * 1000, row.id).run().catch((error) => log('error', 'Queue retry scheduling failed.', error))
        },
      })
    }
    if (messages.length) await worker.queue({ queue: 'a1pt-local-pdf-jobs', messages }, env)
  } catch (error) {
    log('error', 'Background queue check failed.', error)
  } finally {
    queueBusy = false
  }
}

wakeQueue = () => { setImmediate(() => void drainQueue()) }
const queueTimer = setInterval(() => void drainQueue(), 1000)
queueTimer.unref()

async function runScheduledCleanup() {
  let cleanupPromise
  await worker.scheduled({}, env, { waitUntil(promise) { cleanupPromise = promise } })
  if (cleanupPromise) await cleanupPromise
}
const cleanupTimer = setInterval(() => { void runScheduledCleanup().catch((error) => log('error', 'Scheduled privacy cleanup failed.', error)) }, 60 * 1000)
cleanupTimer.unref()

function requestOrigin(incoming) {
  const configured = process.env.PUBLIC_ORIGIN?.trim()
  if (configured) return new URL(configured).origin
  const forwardedProto = String(incoming.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const secureForwarded = String(incoming.headers['x-forwarded-ssl'] || '').toLowerCase() === 'on'
  const protocol = forwardedProto || (secureForwarded || incoming.socket.encrypted ? 'https' : 'http')
  const forwardedHost = String(incoming.headers['x-forwarded-host'] || incoming.headers.host || 'localhost').split(',')[0].trim()
  return `${protocol}://${forwardedHost}`
}

function toFetchRequest(incoming) {
  const origin = requestOrigin(incoming)
  const requestUrl = new URL(incoming.url || '/', origin)
  const headers = new Headers()
  const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host'])
  for (const [name, raw] of Object.entries(incoming.headers)) {
    if (raw == null || hopByHop.has(name.toLowerCase())) continue
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw)
    try { headers.set(name, value) } catch {}
  }
  if (incoming.socket.remoteAddress) headers.set('X-Real-IP', incoming.socket.remoteAddress)
  const method = (incoming.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return new Request(requestUrl, { method, headers })
  const body = Readable.toWeb(incoming)
  return new Request(requestUrl, { method, headers, body, duplex: 'half' })
}

function writeResponse(outgoing, response) {
  outgoing.statusCode = response.status
  for (const [name, value] of response.headers) outgoing.setHeader(name, value)
  const cookies = response.headers.getSetCookie?.()
  if (cookies?.length) outgoing.setHeader('Set-Cookie', cookies)
  if (!response.body) { outgoing.end(); return }
  const stream = Readable.fromWeb(response.body)
  stream.on('error', (error) => {
    log('error', 'Response stream failed.', error)
    if (!outgoing.headersSent) outgoing.statusCode = 500
    outgoing.destroy(error)
  })
  stream.pipe(outgoing)
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const request = toFetchRequest(incoming)
    const pending = []
    const response = await worker.fetch(request, env, { waitUntil(promise) { pending.push(promise) } })
    for (const promise of pending) promise.catch((error) => log('error', 'Background request task failed.', error))
    writeResponse(outgoing, response)
  } catch (error) {
    log('error', 'HTTP request failed.', error)
    if (!outgoing.headersSent) {
      outgoing.statusCode = 500
      outgoing.setHeader('Content-Type', 'application/json; charset=utf-8')
      outgoing.setHeader('Cache-Control', 'no-store')
      outgoing.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed. Please try again later.' } }))
    } else outgoing.destroy(error)
  }
})

server.requestTimeout = 5 * 60 * 1000
server.headersTimeout = 65 * 1000
server.keepAliveTimeout = 5 * 1000
server.listen(PORT, '0.0.0.0', () => log('log', `All in One PDF Tools is listening on 0.0.0.0:${PORT}.`))

function shutdown(signal) {
  log('log', `Received ${signal}; stopping the HTTP server.`)
  clearInterval(queueTimer)
  clearInterval(cleanupTimer)
  server.close(() => {
    sqlDatabase.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
