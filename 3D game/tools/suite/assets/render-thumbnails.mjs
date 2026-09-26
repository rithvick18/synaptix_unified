#!/usr/bin/env node
/**
 * Renders every asset in public/suite/assets/manifest.json to
 * public/suite/assets/thumbs/<id>.webp (256 px, WebP q80), using the real procedural
 * builders in headless Chrome (tools/suite/assets/thumbs.html, served by vite on 5191).
 *
 *   node tools/suite/assets/render-thumbnails.mjs
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const out = path.join(root, 'public', 'suite', 'assets', 'thumbs')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const vite = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['--port', '5191', '--strictPort'], { cwd: root, stdio: 'ignore' })
const profile = mkdtempSync(path.join(tmpdir(), 'thumbs-chrome-'))
const work = mkdtempSync(path.join(tmpdir(), 'thumbs-png-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9232', `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' })
try {
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try { target = (await (await fetch('http://127.0.0.1:9232/json')).json()).find((t) => t.type === 'page') } catch { /* starting */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) pending.get(m.id)?.(m) })
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'threw')
    return r.result.result.value
  }
  for (let i = 0; i < 40; i++) { try { await fetch('http://localhost:5191/'); break } catch { await sleep(250) } }
  await send('Page.navigate', { url: 'http://localhost:5191/tools/suite/assets/thumbs.html' })
  for (let i = 0; i < 120; i++) { if (await evaluate('typeof window.thumbIds === "function"').catch(() => false)) break; await sleep(250) }
  const ids = await evaluate('window.thumbIds()')
  for (const assetId of ids) {
    const url = await evaluate(`window.renderThumb(${JSON.stringify(assetId)})`)
    const png = path.join(work, `${assetId}.png`)
    writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'))
    const dest = path.join(out, `${assetId}.webp`)
    const r = spawnSync('cwebp', ['-quiet', '-q', '80', png, '-o', dest])
    if (r.status !== 0) throw new Error(`cwebp failed for ${assetId}`)
    console.log(`  ${assetId.padEnd(22)} ${(statSync(dest).size / 1024).toFixed(1)} KB`)
  }
  ws.close()
} finally {
  chrome.kill(); vite.kill()
  await sleep(500) // Chrome may still be writing its profile as it exits
  for (const dir of [profile, work]) { try { rmSync(dir, { recursive: true, force: true }) } catch { /* temp dir; the OS cleans it */ } }
}
