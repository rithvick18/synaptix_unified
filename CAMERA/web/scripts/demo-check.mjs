#!/usr/bin/env node
/**
 * End-to-end check of the demo page (index.html) in headless Chrome: real service, real
 * Vite dev server, real MediaPipe worker, Chrome's FAKE camera fed from a .y4m face video.
 * It never touches a physical webcam. Needs a video containing one face:
 *
 *   npm run check:demo -- --video /path/to/face.y4m
 *
 * (Build one from a still portrait: ffmpeg -loop 1 -i face.jpg -t 20 -vf scale=640:480 -r 30 face.y4m)
 * Ports 8765, 5174 and 9333 must be free.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVICE = resolve(WEB, '../service')
const videoArg = process.argv.indexOf('--video')
const VIDEO = videoArg > 0 ? resolve(process.argv[videoArg + 1]) : null
if (!VIDEO || !existsSync(VIDEO)) {
  console.error('usage: npm run check:demo -- --video <face.y4m>   (a .y4m with one visible face)')
  process.exit(2)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const procs = []

// Refuse to run against servers that are already up (for example a dev session you are
// using): the check needs its own service with test thresholds on these ports.
async function portBusy(port) {
  const { createConnection } = await import('node:net')
  return new Promise((r) => {
    const c = createConnection({ host: '127.0.0.1', port }, () => { c.destroy(); r(true) })
    c.on('error', () => r(false))
  })
}
for (const port of [8765, 5174, 9333]) {
  if (await portBusy(port)) {
    console.error(`port ${port} is in use; stop the dev service/demo first (the check starts its own)`)
    process.exit(2)
  }
}

async function waitHttp(url, ms = 20000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return } catch {}
    await sleep(200)
  }
  throw new Error('timeout ' + url)
}

const svc = spawn(`${SERVICE}/.venv/bin/python`, ['-m', 'app'], { cwd: SERVICE, env: { ...process.env, OBS_PORT: '8765', OBS_POLICY__DELAY_INSTRUCTION_AFTER_MS: '1000' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
procs.push(svc)
let svcLog = ''
svc.stdout.on('data', (d) => (svcLog += d)); svc.stderr.on('data', (d) => (svcLog += d))
const vite = spawn('npx', ['vite', '--port', '5174', '--strictPort'], { cwd: WEB, stdio: 'ignore', detached: true })
procs.push(vite)
await waitHttp('http://127.0.0.1:8765/health')
await waitHttp('http://127.0.0.1:5174/')

const profile = mkdtempSync(join(tmpdir(), 'demo-e2e-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${VIDEO}`, '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'
], { stdio: 'ignore', detached: true })
procs.push(chrome)
await waitHttp('http://127.0.0.1:9333/json/version')
const targets = await (await fetch('http://127.0.0.1:9333/json')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))
let id = 0
const pending = new Map()
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } })
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const text = (idName) => ev(`document.getElementById(${JSON.stringify(idName)}).textContent`)
const click = (idName) => ev(`document.getElementById(${JSON.stringify(idName)}).click()`)
const clickEv = (name) => ev(`document.querySelector('[data-ev="${name}"]').click()`)
const snap = async (label) => {
  const ids = ['session-id', 'adapter-status', 'producer-status', 'observer-status', 'tracking-status', 'calibration-status', 'perf-backend', 'perf-inference', 'perf-fps', 'perf-dropped', 'm-angles', 'm-facing', 'm-orientation', 'm-away', 'm-eyes', 'm-quality', 's-attention', 's-reason', 's-vision', 's-adaptation', 's-hold', 's-inactivity', 's-engagement']
  const out = {}
  for (const i of ids) out[i] = await text(i)
  console.log(`\n== ${label}`)
  for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(18)} ${v}`)
  return out
}

const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

try {
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5174/' })
  await sleep(2500)
  await click('btn-session')
  await sleep(1500)
  let s = await snap('after session')
  check('session created and both links open', s['session-id'].startsWith('s_') && s['adapter-status'].startsWith('open') && s['producer-status'].startsWith('open'))

  await click('btn-cam-start')
  await sleep(4000)
  s = await snap('camera started (uncalibrated)')
  check('camera running on worker', s['observer-status'] === 'running' && s['perf-backend'].includes('Web Worker'), s['perf-backend'])
  check('uncalibrated angles are null with reason', s['m-angles'].includes('null (uncalibrated)'))
  check('service reports UNKNOWN before calibration', s['s-attention'] === 'UNKNOWN', s['s-reason'])

  await click('btn-calibrate')
  await sleep(1200)
  const mid = await text('calibration-status')
  const midAttention = await text('s-attention')
  check('CALIBRATING visible in producer and service', mid.startsWith('calibrating') && midAttention === 'CALIBRATING', `${mid} / ${midAttention}`)
  await sleep(3000)
  s = await snap('after calibration')
  check('calibrated and HEAD_TOWARD_SCREEN', s['calibration-status'] === 'calibrated' && s['s-attention'] === 'HEAD_TOWARD_SCREEN', s['s-attention'])
  check('vision fresh, not simulated', s['s-vision'].startsWith('fresh') && !s['s-vision'].includes('SIMULATED'), s['s-vision'])

  // Gameplay: slowing wrong answers -> offer_hint
  await clickEv('task_started'); await sleep(800)
  await clickEv('answer_wrong'); await sleep(900)
  await clickEv('answer_wrong'); await sleep(2500)
  await clickEv('answer_wrong'); await sleep(2600)
  const actions = await ev(`[...document.querySelectorAll('#action-log li')].map(l => l.textContent)`)
  console.log('actions:', actions)
  check('offer_hint suggested from gameplay', actions.some((a) => a.includes('offer_hint')))
  const latest = await text('latest-action')
  check('latest action shows reason and evidence', latest.includes('offer_hint') && latest.includes('slowdown_ratio'))

  // Toggle vision adaptation off -> service reports disabled
  await ev(`(() => { const c = document.getElementById('chk-adaptation'); c.checked = false; c.dispatchEvent(new Event('change')) })()`)
  await sleep(1200)
  check('adaptation disabled reaches the service', (await text('s-adaptation')).startsWith('disabled'), await text('s-adaptation'))

  // Stop camera -> stale -> UNKNOWN
  await click('btn-cam-stop')
  await sleep(2500)
  s = await snap('after camera stop')
  check('stopping camera makes state UNKNOWN', s['s-attention'] === 'UNKNOWN', s['s-reason'])
  const tracks = await ev(`(document.getElementById('video').srcObject === null)`)
  check('camera released (srcObject cleared)', tracks === true)

  await click('btn-end-session')
  await sleep(1200)
  s = await snap('after end session')
  check('session ended, adapter closed', s['session-id'] === '—' && /closed|failed/.test(s['adapter-status']), s['adapter-status'])
  const leaked = /Bearer|\btoken=|[A-Za-z0-9_-]{43}/.test(svcLog) // 32-byte urlsafe tokens are 43 chars
  check('service log contains no tokens', !leaked)
} catch (e) {
  console.error(e)
  results.push(false)
} finally {
  ws.close()
  // Each child leads its own process group (detached), so this also stops grandchildren:
  // npx -> vite, and macOS framework Python re-exec'ing itself.
  for (const p of procs.reverse()) { try { process.kill(-p.pid, 'SIGTERM') } catch {} }
  await sleep(500)
  rmSync(profile, { recursive: true, force: true })
  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} demo checks passed`)
  process.exit(passed === results.length ? 0 : 1)
}
