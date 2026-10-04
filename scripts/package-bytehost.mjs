import { createWriteStream } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const archiver = require('archiver')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'bytehost-upload')
const archivePath = path.join(root, 'All-in-One-PDF-Tools-ByteHost.zip')
await rm(output, { recursive: true, force: true })
await mkdir(path.join(output, 'db', 'migrations'), { recursive: true })
await cp(path.join(root, 'bytehost', 'app.js'), path.join(output, 'app.js'))
await cp(path.join(root, 'bytehost', 'package.json'), path.join(output, 'package.json'))
await cp(path.join(root, 'bytehost', 'package-lock.json'), path.join(output, 'package-lock.json'))
await cp(path.join(root, 'bytehost', '.env.example'), path.join(output, '.env.example'))
await cp(path.join(root, 'bytehost', 'README-cpanel.md'), path.join(output, 'README-cpanel.md'))
await cp(path.join(root, 'bytehost', 'worker.node.mjs'), path.join(output, 'worker.node.mjs'))
await cp(path.join(root, 'dist'), path.join(output, 'dist'), { recursive: true })

for (const filename of (await readdir(path.join(root, 'db', 'migrations'))).filter((name) => name.endsWith('.sql'))) {
  await cp(path.join(root, 'db', 'migrations', filename), path.join(output, 'db', 'migrations', filename))
}

const projectVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version
const runtimePackage = JSON.parse(await readFile(path.join(output, 'package.json'), 'utf8'))
runtimePackage.version = projectVersion
await writeFile(path.join(output, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`)
const runtimeLock = JSON.parse(await readFile(path.join(output, 'package-lock.json'), 'utf8'))
runtimeLock.version = projectVersion
if (runtimeLock.packages?.['']) runtimeLock.packages[''].version = projectVersion
await writeFile(path.join(output, 'package-lock.json'), `${JSON.stringify(runtimeLock, null, 2)}\n`)
await rm(archivePath, { force: true })

await new Promise((resolve, reject) => {
  const destination = createWriteStream(archivePath)
  const archive = new archiver.ZipArchive({ zlib: { level: 9 } })
  destination.on('close', resolve)
  destination.on('error', reject)
  archive.on('error', reject)
  archive.pipe(destination)
  // Place the package contents at the archive root so cPanel extraction into
  // the configured application root is one step (no duplicate nested folder).
  archive.directory(output, false)
  archive.finalize().catch(reject)
})

console.log(`ByteHost deployment directory: ${output}`)
console.log(`Ready-to-upload archive: ${archivePath}`)
