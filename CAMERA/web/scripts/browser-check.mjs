#!/usr/bin/env node
/**
 * Headless-Chrome check of the real FaceObserver pipeline (verify.html), driven over the
 * Chrome DevTools Protocol. Uses ONLY Chrome's fake capture device — never a physical
 * webcam — optionally fed from a .y4m file.
 *
 *   npm run check:browser                              # synthetic fake camera (no face)
 *   npm run check:browser -- --video face.y4m --calibrate --duration 40
 *   npm run check:browser -- --query worker=0          # force the main-thread fallback
 *
 * Options: --video <y4m>  --duration <s> (default 15)  --calibrate  --query <k=v&..>
 *          --json-out <file>  --chrome <path>  --headed  --extra-flag <flag> (repeatable)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VITE_ORIGIN = 'http://127.0.0.1:5174'

function parseArgs(argv) {
  const o = { duration: 15, calibrate: false, query: '', video: null, jsonOut: null, headed: false, extra: [] }
  o.chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--video') o.video = resolve(next())
    else if (a === '--duration') o.duration = Number(next())
    else if (a === '--calibrate') o.calibrate = true
    else if (a === '--query') o.query = next()
    else if (a === '--json-out') o.jsonOut = resolve(next())
    else if (a === '--chrome') o.chrome = next()
    else if (a === '--headed') o.headed = true
    else if (a === '--extra-flag') o.extra.push(next())
    else throw new Error(`unknown option ${a}`)
  }
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[browser-check]', ...a)

async function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
    s.on('error', rej)
  })
}

async function httpOk(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch {
    return false
  }
}

async function ensureVite(children) {
  if (await httpOk(`${VITE_ORIGIN}/verify.html`)) {
    log('reusing running vite dev server on', VITE_ORIGIN, '(HMR reloads from concurrent edits will be detected)')
    return
  }
  log('starting vite dev server (HMR + file watching disabled so concurrent edits cannot reload the page)')
  const { createServer: createViteServer } = await import('vite')
  const server = await createViteServer({
    root: webRoot,
    configFile: join(webRoot, 'vite.config.ts'),
    logLevel: 'warn',
    server: { host: '127.0.0.1', port: 5174, strictPort: true, hmr: false, watch: null }
  })
  await server.listen()
  children.push({ name: 'vite', close: () => server.close() })
}

async function launchChrome(opts, children) {
  if (!existsSync(opts.chrome)) throw new Error(`Chrome not found at ${opts.chrome}`)
  const port = await freePort()
  const userDataDir = mkdtempSync(join(tmpdir(), 'face-check-chrome-'))
  const flags = [
    ...(opts.headed ? [] : ['--headless=new']),
    // Fake capture only: the physical webcam is never enumerated or opened.
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    ...(opts.video ? [`--use-file-for-fake-video-capture=${opts.video}`] : []),
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1000,900',
    ...opts.extra,
    'about:blank'
  ]
  const chrome = spawn(opts.chrome, flags, { stdio: ['ignore', 'ignore', 'pipe'] })
  children.push({ name: 'chrome', proc: chrome, userDataDir })
  let stderr = ''
  chrome.stderr.on('data', (d) => (stderr += d))
  for (let i = 0; i < 60; i++) {
    if (chrome.exitCode !== null) throw new Error(`chrome exited early:\n${stderr.slice(-2000)}`)
    if (await httpOk(`http://127.0.0.1:${port}/json/version`)) return { port, flags }
    await sleep(250)
  }
  throw new Error(`chrome DevTools endpoint not ready:\n${stderr.slice(-2000)}`)
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.console = []
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? rej(new Error(`${m.error.message} ${m.error.data ?? ''}`)) : res(m.result)
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const text = m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')
        this.console.push(`${m.params.type}: ${text}`)
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails
        this.console.push(`exception: ${d.exception?.description ?? d.text}`)
      } else if (m.method === 'Log.entryAdded') {
        this.console.push(`log.${m.params.entry.level}: ${m.params.entry.text}`)
      }
    })
  }
  static async connect(url) {
    const ws = new WebSocket(url, { perMessageDeflate: false })
    await new Promise((res, rej) => {
      ws.once('open', res)
      ws.once('error', rej)
    })
    return new Cdp(ws)
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  close() {
    this.ws.close()
  }
}

async function openPage(port, url) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  if (!r.ok) throw new Error(`json/new failed: HTTP ${r.status}`)
  const t = await r.json()
  return Cdp.connect(t.webSocketDebuggerUrl)
}

const SNAPSHOT = `(() => {
  const v = window.__verify
  if (!v) return null
  const b = v.lastBody
  return {
    status: v.status, perf: v.perf, bodies: v.bodies, errors: v.errors,
    tracking: b && b.tracking, calibration: b && b.calibration,
    roll: b && b.measurements.head_roll_deg, diagnostics: v.diagnostics,
    processorStatus: v.processorStatus, timelineLength: v.timeline.length,
    cameraFrameIntervals: v.cameraFrameIntervals
  }
})()`

function summarise(timeline) {
  const counts = {}
  const transitions = []
  let prev = null
  for (const e of timeline) {
    counts[e.status] = (counts[e.status] ?? 0) + 1
    if (e.status !== prev) transitions.push({ t: e.t, status: e.status, faces: e.faces, inFrame: e.inFrame })
    prev = e.status
  }
  const bucket = (pred) => {
    const xs = timeline.filter(pred)
    const stat = (k) => {
      const v = xs.map((e) => e[k]).filter((x) => x !== null)
      if (!v.length) return null
      const mean = v.reduce((a, b) => a + b, 0) / v.length
      return { n: v.length, mean: Math.round(mean * 10) / 10, min: Math.min(...v), max: Math.max(...v) }
    }
    return { frames: xs.length, rawRoll: stat('rawRoll'), roll: stat('roll'), rawYaw: stat('rawYaw'), rawPitch: stat('rawPitch') }
  }
  const inf = timeline.map((e) => e.inferenceMs).sort((a, b) => a - b)
  const pct = (p) => (inf.length ? inf[Math.min(inf.length - 1, Math.floor(p * inf.length))] : null)
  return {
    frames: timeline.length,
    statusCounts: counts,
    transitions: transitions.slice(0, 80),
    rollBuckets: {
      rawRollAbove10: bucket((e) => e.rawRoll !== null && e.rawRoll > 10),
      rawRollBelowMinus10: bucket((e) => e.rawRoll !== null && e.rawRoll < -10),
      rawRollNear0: bucket((e) => e.rawRoll !== null && Math.abs(e.rawRoll) < 3)
    },
    inferenceMs: { p50: pct(0.5), p90: pct(0.9), max: inf.length ? inf[inf.length - 1] : null },
    processedSpanMs: timeline.length > 1 ? timeline[timeline.length - 1].t - timeline[0].t : 0
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const children = []
  let cdp = null
  let exitCode = 0
  const cleanup = () => {
    try {
      cdp?.close()
    } catch {}
    for (const c of children.reverse()) {
      try {
        if (c.close) c.close()
        else c.proc.kill('SIGTERM')
      } catch {}
    }
  }
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  try {
    await ensureVite(children)
    const { port, flags } = await launchChrome(opts, children)
    log('chrome flags:', flags.filter((f) => !f.startsWith('--user-data-dir')).join(' '))
    const url = `${VITE_ORIGIN}/verify.html${opts.query ? `?${opts.query}` : ''}`
    cdp = await openPage(port, url)
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    log('opened', url)

    await sleep(300)
    const origin0 = await cdp.eval('performance.timeOrigin')
    let reloads = 0
    const t0 = Date.now()
    let calAttempts = 0
    let calState = 'none'
    const calibrations = []
    let last = null
    while (Date.now() - t0 < opts.duration * 1000) {
      await sleep(1000)
      const origin = await cdp.eval('performance.timeOrigin').catch(() => null)
      if (origin !== null && origin !== origin0 && origin !== last?.origin) {
        reloads++
        log('WARNING: page reloaded (HMR?) — results after this point come from a fresh page')
      }
      last = await cdp.eval(SNAPSHOT).catch((e) => ({ evalError: e.message }))
      if (last) last.origin = origin
      const s = last?.status
      log(
        `${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s`,
        s ? s.kind + (s.backend ? `/${s.backend}/${s.delegate}` : '') + (s.code ? `:${s.code}` : '') : 'no-page-state',
        '| tracking', last?.tracking?.status ?? '-',
        '| cal', last?.calibration?.status ?? '-',
        '| perf', last?.perf ? `${last.perf.inference_ms}ms ${last.perf.processed_fps}fps dropped=${last.perf.dropped_frames}` : '-'
      )
      if (s?.kind === 'error') break
      if (opts.calibrate && s?.kind === 'running') {
        const cal = last.calibration?.status
        if (calState === 'running' && (cal === 'calibrated' || cal === 'failed')) {
          calibrations.push({ attempt: calAttempts, result: cal, reason: last.calibration.reason })
          log(`calibration attempt ${calAttempts}: ${cal}${last.calibration.reason ? ` (${last.calibration.reason})` : ''}`)
          calState = cal === 'calibrated' ? 'done' : 'none'
        }
        if (calState === 'none' && calAttempts < 5) {
          // Start only during a still, frontal stretch (last ~1 s of raw roll near 0).
          const still = await cdp.eval(`(() => {
            const tl = window.__verify.timeline.slice(-12)
            return tl.length >= 12 && tl.every(e => e.status === 'tracking' && e.rawRoll !== null && Math.abs(e.rawRoll) < 3)
          })()`)
          if (still) {
            calAttempts++
            calState = 'running'
            await cdp.eval('window.__verify.calibrate()')
            log(`calibration attempt ${calAttempts} started`)
          }
        }
      }
    }

    const timeline = await cdp.eval('window.__verify ? window.__verify.timeline : []')
    const final = await cdp.eval(SNAPSHOT)
    // Exercise stop(): camera must be released.
    const stopCheck = await cdp.eval(`(() => {
      const v = document.getElementById('video')
      const tracks = v.srcObject ? v.srcObject.getTracks() : []
      const before = tracks.map(t => t.readyState)
      window.__verify.stop()
      return { before, after: tracks.map(t => t.readyState),
               srcObjectCleared: v.srcObject === null, status: window.__verify.status.kind }
    })()`)
    const summary = summarise(timeline ?? [])
    const report = { url, options: { ...opts, chrome: undefined }, reloads, final, calibrations, stopCheck, summary, console: cdp.console.slice(-60) }
    console.log(JSON.stringify({ reloads, final, calibrations, stopCheck, summary }, null, 2))
    if (cdp.console.length) log('page console (last 20):\n  ' + cdp.console.slice(-20).join('\n  '))
    if (opts.jsonOut) {
      writeFileSync(opts.jsonOut, JSON.stringify({ ...report, timeline }, null, 1))
      log('wrote', opts.jsonOut)
    }
    if (!final || final.status.kind === 'error' || !(final.bodies > 0)) exitCode = 1
  } catch (e) {
    console.error('[browser-check] FAILED:', e.message)
    exitCode = 1
  } finally {
    cleanup()
    await sleep(500)
    for (const c of children) {
      if (c.userDataDir) {
        try {
          rmSync(c.userDataDir, { recursive: true, force: true })
        } catch {}
      }
    }
  }
  process.exit(exitCode)
}

main()
