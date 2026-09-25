#!/usr/bin/env node
/**
 * Copies the MediaPipe tasks-vision WASM runtime into public/ and fetches the pinned
 * face_landmarker.task model, verifying its SHA-256. Fails loudly (exit 1) on any mismatch
 * or network failure — the app never falls back to a simulated tracker.
 *
 *   npm run setup:assets
 *   FACE_MODEL_PATH=/path/to/face_landmarker.task npm run setup:assets   # offline copy
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
const MODEL_BYTES = 3_758_596

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(webRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDst = join(webRoot, 'public', 'mediapipe', 'wasm')
const modelDst = join(webRoot, 'public', 'models', 'face_landmarker.task')

function fail(msg) {
  console.error(`\n[setup-assets] ERROR: ${msg}\n`)
  process.exit(1)
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function copyWasm() {
  if (!(await exists(wasmSrc))) {
    fail(`${wasmSrc} not found. Run \`npm install\` first (needs @mediapipe/tasks-vision).`)
  }
  await mkdir(wasmDst, { recursive: true })
  const files = (await readdir(wasmSrc)).filter((f) => /\.(js|wasm)$/.test(f))
  if (files.length === 0) fail(`no WASM files in ${wasmSrc}`)
  for (const f of files) await copyFile(join(wasmSrc, f), join(wasmDst, f))
  console.log(`[setup-assets] copied ${files.length} WASM runtime files -> ${wasmDst}`)
}

function verify(buf, origin) {
  const hash = sha256(buf)
  if (hash !== MODEL_SHA256 || buf.length !== MODEL_BYTES) {
    fail(
      `model from ${origin} failed verification.\n` +
        `  expected sha256 ${MODEL_SHA256} (${MODEL_BYTES} bytes)\n` +
        `  got      sha256 ${hash} (${buf.length} bytes)\n` +
        `Refusing to install an unverified model.`
    )
  }
}

async function installModel() {
  await mkdir(dirname(modelDst), { recursive: true })

  if (await exists(modelDst)) {
    const cur = await readFile(modelDst)
    if (sha256(cur) === MODEL_SHA256) {
      console.log(`[setup-assets] model already present and verified: ${modelDst}`)
      return
    }
    console.warn('[setup-assets] existing model hash mismatch; replacing it')
  }

  let buf
  let origin
  const local = process.env.FACE_MODEL_PATH
  if (local) {
    origin = resolve(local)
    try {
      buf = await readFile(origin)
    } catch (e) {
      fail(`FACE_MODEL_PATH=${origin} could not be read: ${e.message}`)
    }
  } else {
    origin = MODEL_URL
    console.log(`[setup-assets] downloading ${MODEL_URL}`)
    let res
    try {
      res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(120_000) })
    } catch (e) {
      fail(
        `download failed (${e.cause?.code ?? e.name}: ${e.message}).\n` +
          `Retry, or download the model manually and run with FACE_MODEL_PATH=<file>.`
      )
    }
    if (!res.ok) fail(`download failed: HTTP ${res.status} ${res.statusText} from ${MODEL_URL}`)
    buf = Buffer.from(await res.arrayBuffer())
  }

  verify(buf, origin)
  const tmp = `${modelDst}.tmp-${process.pid}`
  await writeFile(tmp, buf)
  await rename(tmp, modelDst).catch(async (e) => {
    await rm(tmp, { force: true })
    throw e
  })
  console.log(`[setup-assets] model verified (sha256 ${MODEL_SHA256}) -> ${modelDst}`)
}

await copyWasm()
await installModel()
console.log('[setup-assets] done')
