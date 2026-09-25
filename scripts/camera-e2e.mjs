#!/usr/bin/env node
/**
 * End-to-end check of the integrated game + camera app, in headless Chrome, against a
 * private instance of the real observation service and the real game dev server.
 *
 *   npm run check:e2e            (from the workspace root; needs `npm run setup` and Chrome)
 *
 * Three scenarios, each labelled for what it does and does not prove:
 *
 *  A. CAMERA OFF — the game is played with camera support never enabled: no request to
 *     the service, no getUserMedia, none of the camera code or model downloaded.
 *  B. INJECTED OBSERVATIONS (synthetic, `simulated: true`) — `?camera=inject` replaces the
 *     webcam with scripted observations sent through the REAL ProducerConnection → service
 *     → GameAdapter → CameraAdapter → AdaptationPolicy → MissionRunner path. Proves
 *     transport, lifecycle, gating and adaptations end to end. Says NOTHING about vision.
 *  C. FAKE CAMERA DEVICE — Chrome's built-in fake webcam (a test pattern, no face) through
 *     the REAL FaceObserver / MediaPipe worker. Proves the camera pipeline starts inside
 *     the game, its outputs reach the game through the service, and it stops cleanly. A
 *     test pattern has no face, so tracking and calibration are NOT validated here.
 *
 * Live-webcam behaviour (a real face, calibration quality, head-away detection) is not
 * covered by any automated check — see INTEGRATION.md → "Manual webcam check".
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.join(ROOT, '3D game')
const SERVICE = path.join(ROOT, 'CAMERA', 'service')
const PYTHON = path.join(SERVICE, '.venv', 'bin', 'python')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const want = (s) => only.length === 0 || only.includes(s)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

for (const [label, p] of [['service venv', PYTHON], ['game node_modules', path.join(GAME, 'node_modules', '.bin', 'vite')], ['Chrome', CHROME]]) {
  if (!existsSync(p)) {
    console.error(`Missing ${label} (${p}). Run \`npm run setup\`; set CHROME=/path/to/chrome if needed.`)
    process.exit(1)
  }
}

// --- Results -------------------------------------------------------------------------

let passed = 0
const failed = []
function ok(cond, label, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed.push(label)
    console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`)
  }
}

// --- Processes -------------------------------------------------------------------------

const procs = []
function launch(name, cmd, args, opts) {
  const child = spawn(cmd, args, { ...opts, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.log = ''
  child.stdout.on('data', (c) => (child.log += c))
  child.stderr.on('data', (c) => (child.log += c))
  procs.push(child)
  return child
}
function kill(child, signal = 'SIGTERM') {
  try {
    process.kill(-child.pid, signal)
  } catch {
    /* gone */
  }
}
async function waitHttp(url, ms, headers = {}) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(1000) })
      if (r.status < 500) return r
    } catch {
      /* not yet */
    }
    await sleep(250)
  }
  return null
}

const SERVICE_PORT = await freePort()
const GAME_PORT = await freePort()
const CDP_PORT = await freePort()
const GAME_ORIGIN = `http://localhost:${GAME_PORT}`
const SERVICE_URL = `http://127.0.0.1:${SERVICE_PORT}`

function startService() {
  return launch('service', PYTHON, ['-m', 'app'], {
    cwd: SERVICE,
    env: {
      ...process.env,
      OBS_HOST: '127.0.0.1',
      OBS_PORT: String(SERVICE_PORT),
      OBS_ALLOWED_ORIGINS: JSON.stringify([GAME_ORIGIN, `http://127.0.0.1:${GAME_PORT}`])
    }
  })
}
let service = startService()
const game = launch('game', path.join(GAME, 'node_modules', '.bin', 'vite'), ['--port', String(GAME_PORT), '--strictPort'], {
  cwd: GAME,
  env: { ...process.env, VITE_OBSERVATION_URL: SERVICE_URL }
})

const profile = mkdtempSync(path.join(tmpdir(), 'memoria-e2e-'))
const chrome = launch('chrome', CHROME, [
  '--headless',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  // Nothing but this machine resolves: the game's optional CDN downloads fail fast.
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  '--window-size=1280,800',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank'
])

async function cleanup() {
  for (const p of procs) kill(p)
  await sleep(500)
  for (const p of procs) kill(p, 'SIGKILL')
  rmSync(profile, { recursive: true, force: true })
}
process.on('SIGINT', async () => {
  await cleanup()
  process.exit(130)
})

// --- CDP -------------------------------------------------------------------------------

class CDP {
  #id = 0
  #pending = new Map()
  handlers = new Map()
  constructor(ws) {
    this.ws = ws
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined) {
        const entry = this.#pending.get(msg.id)
        this.#pending.delete(msg.id)
        if (!entry) return
        if (msg.error) entry.reject(new Error(`${msg.error.message} (${entry.method})`))
        else entry.resolve(msg.result)
        return
      }
      this.handlers.get(msg.method)?.forEach((fn) => fn(msg.params))
    })
  }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    return new CDP(ws)
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(fn)
  }
  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  async until(expression, ms, step = 200) {
    const end = Date.now() + ms
    let last
    while (Date.now() < end) {
      try {
        last = await this.eval(expression)
        if (last) return last
      } catch (e) {
        last = String(e)
      }
      await sleep(step)
    }
    return false
  }
}

/** Instrumentation installed before any page script: counts getUserMedia calls. */
const INSTRUMENT = `
  window.__gum = 0
  const md = navigator.mediaDevices
  if (md && md.getUserMedia) {
    const real = md.getUserMedia.bind(md)
    md.getUserMedia = (c) => { window.__gum++; return real(c) }
  }
`

/** Scripted observations, labelled simulated. Modes: toward | away | noface. */
const INJECTOR = `
  window.__e2e = (() => {
    const u = (r) => ({ value: null, reason: r })
    const v = (x) => ({ value: x, reason: null })
    let mode = 'toward', awayStart = null, episode = 0, timer = null, sent = 0, errors = 0
    function obs() {
      const now = performance.now()
      const valid = mode !== 'noface'
      if (mode === 'away') { if (awayStart === null) { awayStart = now; episode++ } } else awayStart = null
      const away = mode === 'away'
      const n = (x) => valid ? v(x) : u('no_face')
      return {
        capture_ts_ms: now,
        tracking: valid
          ? { status: 'tracking', valid: true, reason: null, face_count: 1, multiple_faces_visible: false, quality: v(0.9) }
          : { status: 'no_face', valid: false, reason: 'no_face', face_count: 0, multiple_faces_visible: false, quality: u('no_face') },
        calibration: { status: 'calibrated', reason: null, progress: null },
        measurements: {
          head_yaw_deg: n(away ? 35 : 2), head_pitch_deg: n(0), head_roll_deg: n(0),
          head_facing_score: n(away ? 0.1 : 0.95),
          head_orientation: n(away ? 'away' : 'toward'),
          head_away_ms: n(away ? now - awayStart : 0),
          head_away_episode: episode || null,
          eye_openness_left: n(1), eye_openness_right: n(1),
          eye_blink_coefficient_left: n(0.05), eye_blink_coefficient_right: n(0.05),
          eyes_closed: n(false), eyes_closed_ms: n(0)
        },
        gestures: [], perf: null, simulated: true
      }
    }
    return {
      start() { if (!timer) timer = setInterval(() => { sent++; __memoria.camera.inject(obs()).catch(() => errors++) }, 100) },
      stop() { clearInterval(timer); timer = null },
      set(m) { mode = m },
      get stats() { return { sent, errors, mode } }
    }
  })()
`

async function openPage(url) {
  const created = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const cdp = await CDP.connect(created.webSocketDebuggerUrl)
  cdp.targetId = created.id
  cdp.requests = []
  // Only the observation service's sockets are counted (Vite's HMR socket is not ours).
  cdp.sockets = { created: 0, closed: 0, urls: [], ids: new Set() }
  cdp.consoleErrors = []
  cdp.on('Network.requestWillBeSent', (p) => cdp.requests.push(p.request.url))
  cdp.on('Network.webSocketCreated', (p) => {
    if (!p.url.includes(`:${SERVICE_PORT}/`)) return
    cdp.sockets.created++
    cdp.sockets.urls.push(p.url)
    cdp.sockets.ids.add(p.requestId)
  })
  cdp.on('Network.webSocketClosed', (p) => {
    if (cdp.sockets.ids.has(p.requestId)) cdp.sockets.closed++
  })
  cdp.navigations = 0
  cdp.on('Page.frameNavigated', (p) => { if (!p.frame.parentId) cdp.navigations++ })
  cdp.console = []
  cdp.on('Runtime.consoleAPICalled', (p) => cdp.console.push(`${p.type}: ${p.args.map((x) => x.value ?? x.description ?? '').join(' ')}`.slice(0, 300)))
  cdp.on('Runtime.exceptionThrown', (p) => cdp.consoleErrors.push(p.exceptionDetails?.exception?.description ?? 'exception'))
  await cdp.send('Network.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT })
  await cdp.send('Page.navigate', { url })
  const booted = await cdp.until('!!(window.__memoria && window.__memoria.camera && window.__memoria.levels)', 90_000, 500)
  if (!booted) throw new Error(`game did not boot at ${url}`)
  return cdp
}
async function closePage(cdp) {
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${cdp.targetId}`).catch(() => {})
  cdp.ws.close()
}
const health = async () => (await (await fetch(`${SERVICE_URL}/health`)).json()).sessions

// --- Run -------------------------------------------------------------------------------

try {
  console.log(`service ${SERVICE_URL} · game ${GAME_ORIGIN}`)
  if (!(await waitHttp(`${SERVICE_URL}/health`, 20_000))) throw new Error(`service did not start:\n${service.log}`)
  if (!(await waitHttp(`${GAME_ORIGIN}/`, 30_000))) throw new Error(`game dev server did not start:\n${game.log}`)
  if (!(await waitHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, 20_000))) throw new Error('Chrome did not start')

  // ── A ────────────────────────────────────────────────────────────────────────────────
  if (want('A')) {
    console.log('\nA. Camera OFF — the game as it was')
    const cdp = await openPage(`${GAME_ORIGIN}/`)
    ok((await cdp.eval('__memoria.camera.state.phase')) === 'off', 'camera support is off by default')
    ok(await cdp.eval(`!!document.querySelector('#overlay button[data-act="camera"]')`), 'level list offers "Camera support (optional)"')
    await cdp.eval('__memoria.debug.startLevel(0)')
    for (let i = 0; i < 3; i++) await cdp.eval('__memoria.runner.skip()')
    await sleep(300)
    ok(await cdp.eval(`__memoria.summary().completed === true`), 'a level plays through to its summary with the camera off')
    ok(!cdp.requests.some((u) => u.startsWith(SERVICE_URL)), 'no request reached the observation service')
    ok(!cdp.requests.some((u) => /mediapipe|face_landmarker|camera\/runtime|FaceObserver/.test(u)), 'no camera code, WASM or model was downloaded')
    ok((await cdp.eval('window.__gum')) === 0, 'getUserMedia was never called')
    ok(cdp.sockets.created === 0, 'no service WebSocket opened')
    await closePage(cdp)
  }

  // ── B ────────────────────────────────────────────────────────────────────────────────
  if (want('B')) {
    console.log('\nB. INJECTED OBSERVATIONS (synthetic, labelled simulated) through the real service')
    const cdp = await openPage(`${GAME_ORIGIN}/?camera=inject`)
    await cdp.eval(INJECTOR)
    await cdp.eval('__memoria.camera.policy.config.allowSimulatedVision = true') // explicit test opt-in
    await cdp.eval('__memoria.camera.enable()')
    const s0 = await cdp.eval('__memoria.camera.state')
    ok(s0.service.status === 'open' && !!s0.service.sessionId, 'enable → session created, consumer socket open', JSON.stringify({ phase: s0.phase, error: s0.error, service: s0.service, console: cdp.console.slice(-8) }))
    ok((await health()) === 1, 'exactly one service session exists')

    await cdp.eval('__memoria.debug.startLevel(0)')
    ok(!!(await cdp.until(`__memoria.camera.state.gameplay?.currentTaskId === 'water:0'`, 5000)),
      'gameplay events reach the service (its state shows task water:0)')

    await cdp.eval('__e2e.start()')
    ok(!!(await cdp.until('__memoria.camera.state.visionUsable', 6000)), 'observations → service → game: vision gate opens (calibrated, tracking, fresh)')
    ok((await cdp.eval('__memoria.camera.state.vision.simulated')) === true, 'the game sees these observations labelled simulated')
    ok(cdp.sockets.created === 2, 'two WebSockets: one consumer, one producer', `created ${cdp.sockets.created}`)

    await cdp.eval('__memoria.state.pause()')
    ok(!!(await cdp.until('__memoria.camera.state.gameplay?.paused === true', 3000)), 'pause reaches the service')
    await cdp.eval('__memoria.state.resume()')
    ok(!!(await cdp.until('__memoria.camera.state.gameplay?.paused === false', 3000)), 'resume reaches the service')

    // delay_instruction: head away → service suggests → game holds the next spoken instruction.
    await cdp.eval(`__e2e.set('away')`)
    const delay = await cdp.until(`__memoria.camera.adaptations.find(r => r.action === 'delay_instruction' && r.decision === 'applied')`, 6000)
    ok(!!delay, 'sustained head-away → delay_instruction applied by the game', JSON.stringify(await cdp.eval('__memoria.camera.adaptations')))
    ok(delay && delay.source === 'vision' && delay.vision.simulated === true && typeof delay.evidence.head_away_ms === 'number',
      'the adaptation record keeps trigger, evidence, source and the simulated label')
    await cdp.eval('__memoria.runner.skip()') // a NEW instruction arrives while the head is away
    ok(await cdp.eval('__memoria.camera.holdPending'), 'the new step’s spoken instruction is held (its text is on screen)')
    ok((await cdp.eval(`document.querySelector('#instruction')?.textContent ?? ''`)).length > 0, 'the instruction text is shown immediately')
    await cdp.eval(`__e2e.set('toward')`)
    ok(!!(await cdp.until('!__memoria.camera.holdPending', 4000)), 'head back → the held instruction is released (spoken)')

    // gentle_cue: head away + no gameplay input for a sustained period.
    await cdp.eval(`__e2e.set('away')`)
    const cue = await cdp.until(`__memoria.camera.adaptations.find(r => r.action === 'gentle_cue')`, 20_000, 500)
    ok(cue && cue.decision === 'applied', 'head away + inactivity → one gentle cue applied', JSON.stringify(cue))
    const repeat = await cdp.eval(`__memoria.pack.missions[0].steps[1].hints.repeat`)
    ok((await cdp.eval(`document.querySelector('#hint')?.textContent`)) === repeat, 'the cue shows the pack’s own words for this step')
    ok((await cdp.eval('__memoria.runner.level')) === 0, 'a gentle cue is not a hint level (scoring unchanged)')
    await cdp.eval(`__e2e.set('toward')`)

    // offer_hint: gameplay evidence only — repeated wrong answers with slowing responses.
    await cdp.eval('__memoria.runner.skip()') // → recall step
    await cdp.until(`!!document.querySelector('#answer:not([hidden]) button.choice')`, 3000)
    const answer = await cdp.eval('__memoria.pack.missions[0].steps[2].answer')
    const clickWrong = `(() => { const b = [...document.querySelectorAll('#answer button.choice')].find(b => b.dataset.id !== ${JSON.stringify(answer)}); b.click(); return b.dataset.id })()`
    await sleep(1000); await cdp.eval(clickWrong)
    await sleep(1000); await cdp.eval(clickWrong)
    await sleep(2600); await cdp.eval(clickWrong)
    const hint = await cdp.until(`__memoria.camera.adaptations.find(r => r.action === 'offer_hint')`, 5000)
    ok(hint && hint.decision === 'applied' && hint.source === 'gameplay', 'repeated errors + slowing answers → offer_hint applied', JSON.stringify(hint))
    ok(hint && hint.deferredMs >= 1000, 'the hint waited for a safe point after the answer', `${hint?.deferredMs} ms`)
    ok((await cdp.eval('__memoria.runner.level')) >= 1, 'the game’s own hint ladder advanced')
    ok((await cdp.eval(`__memoria.recorder.log.some(e => e.kind === 'hint_shown' && e.level === 1)`)), 'hint_shown is in the game’s own telemetry, as usual')
    ok((await cdp.eval('__memoria.camera.state.gameplay?.answersTotal')) >= 3, 'answers reached the service with correctness')

    // Adaptation switched off while the camera stays on.
    const applied = async () => cdp.eval(`__memoria.camera.adaptations.filter(r => r.decision === 'applied').length`)
    await cdp.eval('__memoria.camera.setAdaptation(false)')
    const before = await applied()
    await cdp.eval(`__e2e.set('away')`)
    await sleep(3500)
    ok((await applied()) === before, 'adaptation off → head-away changes nothing')
    ok((await cdp.eval('__memoria.camera.state.visionBlockedReason')) === 'adaptation_disabled', 'the gate reports adaptation_disabled')
    await cdp.eval(`__e2e.set('toward')`)
    await cdp.eval('__memoria.camera.setAdaptation(true)')

    // Level changes and restarts: no new sockets, no second pipeline, events keep flowing.
    const socketsBefore = cdp.sockets.created
    await cdp.eval('__memoria.debug.startLevel(1)')
    await cdp.eval('__memoria.debug.restart()')
    await cdp.eval('__memoria.debug.showLevels()')
    await cdp.eval('__memoria.debug.startLevel(0)')
    ok(!!(await cdp.until(`__memoria.camera.state.gameplay?.currentTaskId === 'water:0'`, 4000)), 'after level switches and a restart the service follows the current task')
    ok(cdp.sockets.created === socketsBefore, 'level switches and restarts open no new sockets', `${cdp.sockets.created - socketsBefore} new`)
    ok((await health()) === 1, 'still exactly one service session')

    // Stale input: stop the observations. Vision must stop counting.
    await cdp.eval(`__e2e.set('away')`)
    await cdp.eval('__e2e.stop()')
    ok(!!(await cdp.until('!__memoria.camera.state.visionUsable', 4000)), 'observations stop → vision gate closes (stale)')
    const n1 = await applied()
    await sleep(3000)
    ok((await applied()) === n1, 'stale vision triggers no adaptation')

    // Tracking loss: face gone → gate closes, no away time carried across the gap.
    await cdp.eval(`__e2e.set('noface')`)
    await cdp.eval('__e2e.start()')
    ok(!!(await cdp.until(`__memoria.camera.state.visionBlockedReason === 'tracking_no_face'`, 4000)), 'face lost → adaptation held with reason tracking_no_face')
    ok((await cdp.eval('__memoria.camera.state.vision.headAwayMs.value')) === null, 'head-away time is unknown (null), not carried over')
    await cdp.eval(`__e2e.set('toward')`)

    // Duplicates: a consumer reconnect replays buffered suggestions; nothing applies twice.
    const recordsBefore = await cdp.eval('__memoria.camera.adaptations.length')
    const appliedIds = await cdp.eval(`__memoria.camera.adaptations.filter(r => r.decision === 'applied').map(r => r.suggestionId)`)
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    const dropped = await cdp.until(`__memoria.camera.state.service.status !== 'open' || !__memoria.camera.state.visionUsable`, 9000)
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    ok(!!dropped, 'network drop → service link reported down / adaptation held')
    ok(!!(await cdp.until(`__memoria.camera.state.service.status === 'open' && __memoria.camera.state.visionUsable`, 15_000)), 'link recovers by itself and vision resumes')
    const appliedAfter = await cdp.eval(`__memoria.camera.adaptations.filter(r => r.decision === 'applied').map(r => r.suggestionId)`)
    ok(appliedAfter.length === new Set(appliedAfter).size && appliedIds.every((id) => appliedAfter.includes(id)), 'no suggestion applied twice across the reconnect')
    console.log(`    (records ${recordsBefore} → ${await cdp.eval('__memoria.camera.adaptations.length')})`)

    // Stop entirely.
    await cdp.eval('__e2e.stop()')
    await cdp.eval('__memoria.camera.disable()')
    ok(!!(await cdp.until(`__memoria.camera.state.phase === 'off'`, 2000)), 'Stop camera → phase off')
    await sleep(800)
    ok(cdp.sockets.closed >= cdp.sockets.created, 'every WebSocket was closed', `${cdp.sockets.closed}/${cdp.sockets.created}`)
    ok((await health()) === 0, 'the service session was deleted')
    await cdp.eval('__memoria.runner.skip()')
    ok((await cdp.eval('__memoria.runner.stepIndex')) >= 1, 'the game keeps playing after the camera stops')

    // Service killed mid-session: the game stays playable, adaptation holds.
    await cdp.eval('__memoria.camera.enable()')
    await cdp.eval('__e2e.start()')
    await cdp.until('__memoria.camera.state.visionUsable', 6000)
    kill(service)
    const down = await cdp.until(`__memoria.camera.state.service.status !== 'open'`, 10_000)
    ok(!!down, 'service killed → link reported down', String(down))
    ok(!(await cdp.eval('__memoria.camera.state.visionUsable')), 'service down → vision adaptation held')
    const chip = await cdp.eval(`document.querySelector('#camera-dock .chip')?.textContent`)
    ok(/not connected|held|Waiting/.test(chip ?? ''), 'the HUD chip says so', chip)
    const step = await cdp.eval('__memoria.runner.stepIndex')
    await cdp.eval('__memoria.runner.skip()')
    ok((await cdp.eval('__memoria.runner.stepIndex')) !== step || (await cdp.eval('__memoria.summary().completed')), 'the game remains playable with the service down')
    await cdp.eval('__e2e.stop()')
    await cdp.eval('__memoria.camera.disable()')
    ok((await cdp.eval('__memoria.camera.state.phase')) === 'off', 'camera can be turned off cleanly while the service is down')
    ok(cdp.consoleErrors.length === 0, 'no uncaught exceptions in the page', cdp.consoleErrors.join(' | '))
    service = startService()
    await waitHttp(`${SERVICE_URL}/health`, 20_000)
    await closePage(cdp)
  }

  // ── C ────────────────────────────────────────────────────────────────────────────────
  if (want('C')) {
    console.log('\nC. FAKE CAMERA DEVICE through the real FaceObserver / MediaPipe worker (no face in the test pattern)')
    const cdp = await openPage(`${GAME_ORIGIN}/`)
    await cdp.eval(`document.querySelector('#overlay button[data-act="camera"]').click()`)
    ok(await cdp.eval(`!document.querySelector('#camera-setup').hidden`), 'the level-list button opens the camera setup sheet')
    await cdp.eval(`document.querySelector('#camera-setup button[data-act="enable"]').click()`)
    const running = await cdp.until(`__memoria.camera.state.camera.running && __memoria.camera.state.camera.backend`, 90_000, 500)
    ok(!!running, 'camera opened and face model loaded inside the game', JSON.stringify(await cdp.eval('__memoria.camera.state')))
    const st = await cdp.eval('__memoria.camera.state')
    console.log(`    backend ${st.camera.backend}/${st.camera.delegate} · tracking ${st.camera.tracking} · calibration ${st.camera.calibration}`)
    ok((await cdp.eval('window.__gum')) === 1, 'exactly one getUserMedia call')
    ok(cdp.navigations === 1, 'turning the camera on never reloads the page', `${cdp.navigations} navigations`)
    ok(!!(await cdp.until('__memoria.camera.state.vision?.fresh === true && __memoria.camera.state.vision.simulated === false', 15_000)),
      'real FaceObserver observations reach the service and come back to the game (fresh, not simulated)')
    // The worker fetches these (a separate target, invisible to the page's network log),
    // so the game server's route is checked directly.
    const model = await fetch(`${GAME_ORIGIN}/models/face_landmarker.task`)
    const wasm = await fetch(`${GAME_ORIGIN}/mediapipe/wasm/vision_wasm_internal.wasm`)
    ok(model.ok && wasm.ok && wasm.headers.get('content-type') === 'application/wasm',
      'the game server itself serves the MediaPipe runtime and model (no separate camera tab)')
    const sneaky = await (await fetch(`${GAME_ORIGIN}/mediapipe/wasm/..%2f..%2f..%2fpackage.json`)).text()
    ok(!sneaky.includes('"setup:assets"'), 'the asset route does not serve files outside its folder')
    ok(!(await cdp.eval('__memoria.camera.state.visionUsable')), 'no face / not calibrated → adaptation held', await cdp.eval('__memoria.camera.state.visionBlockedReason'))
    ok(await cdp.eval(`/Needs calibration|Face not in view|held/.test(document.querySelector('#camera-dock .chip').textContent)`), 'the chip shows why')
    ok(await cdp.eval(`!document.querySelector('#camera-setup button[data-act="calibrate"]').hidden`), 'the setup sheet offers Calibrate')
    await cdp.eval(`document.querySelector('#camera-setup button[data-act="calibrate"]').click()`)
    await sleep(4000)
    const cal = await cdp.eval('__memoria.camera.state')
    console.log(`    after Calibrate with no face: calibration ${cal.camera.calibration} (${cal.camera.calibrationReason ?? '—'}) · tracking ${cal.camera.tracking}`)
    ok(cal.camera.calibration !== 'calibrated' && !cal.visionUsable, 'Calibrate runs the camera app’s own flow; with no face it does not pass and adaptation stays held')
    await cdp.eval('__memoria.debug.startLevel(0)')
    await cdp.eval('__memoria.debug.startLevel(1)')
    ok((await cdp.eval('window.__gum')) === 1, 'level switches do not reopen the camera')

    // Hide the tab (another tab in front), then restore it.
    const other = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${other.id}`)
    const hidden = await cdp.until(`document.visibilityState === 'hidden'`, 3000)
    if (!hidden) {
      console.log('    (headless Chrome kept this tab visible — hide/restore not verifiable here; see the manual check)')
    } else {
      ok(!!(await cdp.until('__memoria.camera.state.camera.suspended', 4000)), 'tab hidden → camera pipeline suspends itself')
      ok(!!(await cdp.until('__memoria.camera.state.gameplay?.expectedIdle === true', 4000)), 'tab hidden → the service is told it is an expected idle (not inactivity)')
      await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${cdp.targetId}`)
      ok(!!(await cdp.until(`document.visibilityState === 'visible' && !__memoria.camera.state.camera.suspended`, 5000)), 'tab restored → camera resumes')
      ok(!!(await cdp.until('__memoria.camera.state.gameplay?.expectedIdle === false', 4000)), 'tab restored → expected idle ends')
      ok((await cdp.eval('window.__gum')) === 1, 'restoring the tab does not reopen the camera')
    }
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${other.id}`).catch(() => {})
    await cdp.eval('__memoria.camera.disable()')
    await sleep(800)
    ok(await cdp.eval(`(() => { const v = document.querySelector('#camera-dock video'); const s = v && v.srcObject; return !s || s.getTracks().every(t => t.readyState === 'ended') })()`),
      'Stop camera ends every camera track')
    ok((await health()) === 0, 'the service session was deleted')
    ok(cdp.consoleErrors.length === 0, 'no uncaught exceptions in the page', cdp.consoleErrors.join(' | '))
    await closePage(cdp)
  }
} catch (e) {
  failed.push(`harness: ${e.message}`)
  console.error(`\nHARNESS ERROR: ${e.stack ?? e}`)
} finally {
  await cleanup()
}

console.log(`\n${passed} passed, ${failed.length} failed`)
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f}`)
  process.exit(1)
}
