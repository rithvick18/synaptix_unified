#!/usr/bin/env node
/**
 * Reminiscence Therapy Suite — browser check against the built app (`npm run build` first).
 *
 * Serves dist/ with `vite preview`, drives headless Chrome over CDP and asserts:
 *   - the suite home is the first screen; `?start=tasks` still opens the guided tasks
 *   - every starter environment of both packs builds in the browser with no missing asset
 *   - every activity starts in the generic demo; next / skip / replay / pause / resume /
 *     close-up / note / finish work, and the summary is factual (no score fields)
 *   - scene transitions release GPU geometries and textures
 *   - Hindi switches the UI script; no horizontal scroll at 360 px or 1280 px
 *   - no uncaught exception on the page
 * Screenshots go to $SUITE_SHOTS (default: a temp directory) for a person to look at.
 *
 *   node tools/suite/browser-check.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 4199
const ORIGIN = `http://localhost:${PORT}`
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SHOTS = process.env.SUITE_SHOTS ?? mkdtempSync(path.join(tmpdir(), 'suite-shots-'))
mkdirSync(SHOTS, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let checks = 0
const failures = []
const ok = (c, label, detail = '') => { checks++; if (!c) failures.push(label + (detail ? `\n     ${detail}` : '')) }

const server = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
const profile = mkdtempSync(path.join(tmpdir(), 'suite-chrome-'))
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9231', `--user-data-dir=${profile}`, '--no-first-run',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', 'about:blank'
], { stdio: 'ignore' })

try {
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try { target = (await (await fetch('http://127.0.0.1:9231/json')).json()).find((t) => t.type === 'page') } catch { /* starting */ }
  }
  if (!target) throw new Error('Chrome did not start')
  for (let i = 0; i < 40; i++) { try { await fetch(ORIGIN); break } catch { await sleep(250) } }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  const exceptions = []
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails?.exception?.description ?? 'exception')
  })
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)} → ${r.result.exceptionDetails.exception?.description ?? 'threw'}`)
    return r.result?.result?.value
  }
  const until = async (expression, ms = 60_000) => {
    const end = Date.now() + ms
    while (Date.now() < end) { if (await evaluate(expression).catch(() => false)) return true; await sleep(250) }
    return false
  }
  const viewport = (width, height, mobile = false) =>
    send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    if (r.result?.data) writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64'))
  }
  const noHorizontalScroll = () => evaluate('document.documentElement.scrollWidth <= innerWidth + 1 && (document.querySelector("#suite")?.scrollWidth ?? 0) <= innerWidth + 1')

  await send('Runtime.enable')
  await send('Page.enable')
  await viewport(1280, 800)

  // --- first screen ------------------------------------------------------------------
  await send('Page.navigate', { url: `${ORIGIN}/` })
  ok(await until('!!window.__memoria?.suite && window.__memoria.suite.screen === "home"'), 'the suite home is the first screen')
  // A fresh browser profile gets the existing first-run model-setup screen (src/agent/);
  // choose "Decide later", as a person who only wants to play would.
  await until('[...document.querySelectorAll("[role=dialog] button")].some(b => /Decide later/.test(b.textContent))', 5000)
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b => /Decide later/.test(b.textContent))?.click(); true')
  await sleep(300)
  ok(await evaluate('window.__memoria.suiteActive === true && !document.querySelector("#suite").hidden'), 'the suite has the screen')
  const homeText = await evaluate('document.querySelector("#suite").innerText')
  ok(/Reminiscence Therapy Suite/i.test(homeText), 'home shows the branding')
  ok(/not a medical treatment/i.test(homeText), 'home shows the not-a-medical-treatment disclaimer', homeText.slice(0, 300))
  ok(/demo/i.test(homeText), 'home offers the generic demo, labelled as demo')
  ok(await noHorizontalScroll(), 'home: no horizontal scroll at 1280 px')
  await shot('home-1280')

  // --- every environment builds in the browser -----------------------------------------
  const envs = [
    ['everyday-home', 'living-room'], ['everyday-home', 'kitchen-dining'], ['everyday-home', 'courtyard-veranda'],
    ['everyday-home', 'photo-living-demo'], ['northeast-home', 'ne-living-room'], ['northeast-home', 'ne-veranda']
  ]
  const memory = () => evaluate('JSON.stringify(window.__memoria.renderer.renderer.info.memory)').then(JSON.parse)
  const baseline = await memory()
  for (const [pack, env] of envs) {
    await evaluate(`window.__memoria.suite.start(${JSON.stringify(pack)}, ${JSON.stringify(env)}, 'space', 'demo').then(() => true)`)
    const report = await evaluate('JSON.stringify(window.__memoria.suite.sceneReport)').then(JSON.parse)
    ok(report && report.missingAssets.length === 0 && report.rejectedPlacements.length === 0, `${pack}/${env}: builds in the browser with every asset`, JSON.stringify(report))
    await sleep(400)
    await shot(`env-${env}`)
    await evaluate('window.__memoria.suite.exit()')
  }
  await evaluate('window.__memoria.suite.showHome()')
  await sleep(500)
  const after = await memory()
  ok(after.geometries <= baseline.geometries + 5 && after.textures <= baseline.textures + 5,
    `${envs.length} scene builds and exits release their geometries and textures`, `before ${JSON.stringify(baseline)} after ${JSON.stringify(after)}`)

  // --- every activity in the generic demo --------------------------------------------
  for (const activity of ['photo', 'object', 'sound', 'space', 'sequence']) {
    const s = await evaluate(`window.__memoria.suite.start('everyday-home', 'living-room', ${JSON.stringify(activity)}, 'demo').then(s => JSON.stringify(s))`).then(JSON.parse)
    ok(s && s.items.length > 0 && s.current, `${activity}: starts with items in the generic demo (${s?.items.length})`)
    ok(s.items.every((i) => !i.personal), `${activity}: demo items are never marked personal`)
    ok(await evaluate('window.__memoria.state.current === "exploring"'), `${activity}: game state is exploring while the activity runs`)
    if (activity === 'photo') {
      await evaluate('window.__memoria.suite.closeup()')
      await sleep(300)
      ok(await evaluate('!!document.querySelector("#suite img") && getComputedStyle(document.querySelector("#suite img")).objectFit === "contain"'), 'photo: the close-up keeps the whole picture (object-fit: contain)')
      await shot('photo-closeup')
      await evaluate('window.__memoria.suite.closeCloseup()')
    }
    await evaluate('window.__memoria.suite.replay()')
    await evaluate('window.__memoria.suite.skip()')
    await evaluate('window.__memoria.suite.pause()')
    ok(await evaluate('window.__memoria.suite.session.paused && window.__memoria.state.current === "paused"'), `${activity}: pause pauses the session and the game clock`)
    await evaluate('window.__memoria.suite.resume()')
    await evaluate('window.__memoria.suite.note("Enjoyed looking at this.")')
    if (activity === 'object') { await shot('explore-object-1280') }
    const summary = await evaluate('JSON.stringify(window.__memoria.suite.finish())').then(JSON.parse)
    ok(summary && summary.skips >= 1 && summary.promptsReplayed >= 1 && summary.caregiverNotes.length === 1, `${activity}: the summary counts the skip, the replay and the note`, JSON.stringify(summary)?.slice(0, 200))
    ok(summary && !/score|correct|accuracy/i.test(Object.keys(summary).join(' ')), `${activity}: the summary has no score fields`)
    ok(summary?.vision === null, `${activity}: no camera block when the camera was off`)
    ok(await evaluate('window.__memoria.state.current === "completed"'), `${activity}: the game clock stops after the summary`)
  }
  await shot('summary-1280')

  // --- Hindi and phone width ----------------------------------------------------------
  await evaluate('window.__memoria.suite.showHome()')
  await evaluate('window.__memoria.suite.setLanguage("hi")')
  await sleep(600)
  ok(await evaluate('document.querySelector("#suite").lang === "hi" && /[\\u0900-\\u097F]/.test(document.querySelector("#suite").innerText)'), 'Hindi: the UI switches to Devanagari')
  await viewport(360, 740, true)
  await sleep(400)
  ok(await noHorizontalScroll(), 'Hindi home: no horizontal scroll at 360 px')
  await shot('home-hi-360')
  await evaluate(`window.__memoria.suite.start('everyday-home', 'kitchen-dining', 'object', 'demo').then(() => true)`)
  await sleep(500)
  ok(await noHorizontalScroll(), 'Hindi explore: no horizontal scroll at 360 px')
  await shot('explore-hi-360')
  await evaluate('window.__memoria.suite.exit()')
  await evaluate('window.__memoria.suite.setLanguage("en")')
  await viewport(1280, 800)

  // --- guided tasks unchanged and reachable ------------------------------------------
  await send('Page.navigate', { url: `${ORIGIN}/?start=tasks` })
  ok(await until('!!document.querySelector("#overlay .card.levels")'), '?start=tasks opens the guided tasks')
  ok(await evaluate('document.querySelectorAll("#overlay button[data-level]").length === 3'), 'the guided tasks still offer three levels')
  await evaluate('document.querySelector(\'#overlay button[data-act="suite"]\').click()')
  ok(await until('window.__memoria.suite.screen === "home" && window.__memoria.suiteActive'), 'the level list leads back to the suite')

  // --- a saved room photograph stays visible in the main view -----------------------
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 240
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#c48151'; ctx.fillRect(0, 0, 320, 240)
    ctx.fillStyle = '#385c62'; ctx.fillRect(115, 65, 90, 125)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const photo = { id: 'room-fixture', original: blob, runtime: blob, thumbnail: blob,
      width: 320, height: 240, crop: { x: .5, y: .5, zoom: 1 } }
    const p = { version: 1, id: 'browser-room-fixture', name: 'Browser room fixture',
      quality: 2048, skipRecall: true, wallId: 'wall-fixture', eventId: 'event-fixture',
      caption: '', templateId: 'hallway', mirrored: false, people: [], questions: [],
      suite: { version: 1, language: 'en', packId: null, environmentId: null,
        objects: {}, objectPrompts: {}, sounds: [], topics: { include: [], avoid: [] },
        mode: 'open', sequence: [], caregiverAssist: true,
        photos: [{ id: 'room-fixture', photo, caption: 'Test room', people: [],
          objects: [{ id: 'chair-fixture', label: 'Chair', description: 'Blue chair', confidence: .9,
            box: { x: .36, y: .27, width: .28, height: .52 }, included: true }] }] } }
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('memoria-caregiver-v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('profiles')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readwrite')
      tx.objectStore('profiles').put(p, 'local')
      tx.objectStore('profiles').put(p.id, 'selected')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return true
  })()`)
  await send('Page.navigate', { url: `${ORIGIN}/` })
  ok(await until('window.__memoria?.suite?.profileMode === "saved" && !!document.querySelector("#suite [data-k=start-photo]")'),
    'saved room profile offers photo exploration')
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b => /Decide later/.test(b.textContent))?.click(); true')
  await evaluate('document.querySelector("#suite [data-k=start-photo]").click(); true')
  ok(await until('window.__memoria?.suite?.screen === "explore" && document.querySelector("#suite .s-custom-photo img")?.naturalWidth === 320'),
    'saved room photo loads in the main view')
  ok(await evaluate('(() => { const el = document.querySelector("#suite .s-custom-photo"); const r = el?.getBoundingClientRect(); return !!r && r.width > 200 && r.height > 200 && getComputedStyle(el).display !== "none" })()'),
    'saved room photo has a visible viewport')
  ok(await evaluate('document.querySelectorAll("#suite .s-custom-photo-hotspots button").length === 1 && document.querySelector("#suite .s-navigation-tools").hidden'),
    'approved room object is selectable and unsupported navigation is hidden')
  await shot('saved-room-photo-1280')

  ok(exceptions.length === 0, 'no uncaught exception on the page', exceptions.slice(0, 3).join('\n     '))
  ws.close()
} finally {
  chrome.kill()
  server.kill()
  rmSync(profile, { recursive: true, force: true })
}

console.log(`  screenshots: ${SHOTS}`)
if (failures.length) {
  console.log(`${failures.length} of ${checks} browser checks FAILED:`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`SUITE BROWSER CHECK PASSED (${checks})`)
