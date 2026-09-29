#!/usr/bin/env node
/**
 * Dev-only: screenshots every starter environment (and optionally some close-ups) through
 * tools/suite/assets/preview.html, for a person to compare looks before and after a change.
 *
 *   node tools/suite/assets/screenshot-environments.mjs <out-dir> [pack/env | shell:<shellId> ...]
 *        [--views=seat,<placement id>,look:<yaw>,<pitch>[,<fov>],all] [--quality=low] [--ao=0]
 *        [--grid=1] [--slots=1] [--probe=1] [--yaw=<deg>] [--pitch=<deg>] [--fov=<deg>]
 *
 * `shell:<id>` previews a bare shell with no placements (a new panorama with no preset
 * yet). `look:yaw,pitch[,fov]` (degrees) points the camera from the seat; `all` is the seat
 * and every object's viewpoint. The overlay flags are preview.ts's own (see its comment):
 * for placing a photo room's slots, `--grid=1 --slots=1 --views=look:0,-25,look:90,-25,…`.
 *
 * Uses the machine's GPU; set SWIFTSHADER=1 to render on the CPU like the checks do.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 5193
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const args = process.argv.slice(2)
const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? mkdtempSync(path.join(tmpdir(), 'suite-look-')))
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const wanted = args.filter((a) => !a.startsWith('--')).slice(1)
const ENVS = wanted.length ? wanted : [
  'everyday-home/photo-living-demo', 'everyday-home/photo-combination', 'everyday-home/photo-kiara',
  'everyday-home/photo-chinese-garden', 'everyday-home/photo-green-point-park', 'everyday-home/photo-mondello-beach'
]
// look:yaw,pitch[,fov] carries commas of its own: split only before a new view name.
const views = (flags.views ?? 'seat').split(/,(?=[a-z])/i)
/** Flags handed to preview.html unchanged. */
const PASSED = ['quality', 'ao', 'grid', 'slots', 'probe', 'yaw', 'pitch', 'fov', 'reflect']
mkdirSync(out, { recursive: true })

const vite = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
const profile = mkdtempSync(path.join(tmpdir(), 'look-chrome-'))
const gpu = process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist']
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9233', `--user-data-dir=${profile}`, '--no-first-run',
  '--window-size=1280,800', ...gpu, 'about:blank'], { stdio: 'ignore' })
try {
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try { target = (await (await fetch('http://127.0.0.1:9233/json')).json()).find((t) => t.type === 'page') } catch { /* starting */ }
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${PORT}/`); break } catch { await sleep(250) } }
  for (const entry of ENVS) {
    const shell = entry.startsWith('shell:') ? entry.slice(6) : null
    const [pack, env] = shell ? ['shell', shell] : entry.split('/')
    const passed = Object.fromEntries(PASSED.filter((k) => flags[k] !== undefined).map((k) => [k, flags[k]]))
    const q = new URLSearchParams({ ...(shell ? { shell } : { pack, env }), ...passed })
    await send('Page.navigate', { url: `http://localhost:${PORT}/tools/suite/assets/preview.html?${q}` })
    let ready = false
    for (let i = 0; i < 240 && !ready; i++) {
      await sleep(250)
      const err = await evaluate('window.previewError ?? null').catch(() => null)
      if (err) throw new Error(`${entry}: ${err}`)
      ready = await evaluate('window.previewReady === true').catch(() => false)
    }
    if (!ready) throw new Error(`${entry}: preview never became ready`)
    const report = await evaluate('window.previewReport()')
    const ids = await evaluate('window.previewObjects()')
    const shots = views.flatMap((v) => (v === 'all' ? ['seat', ...ids] : [v]))
    for (const v of shots) {
      if (v !== 'seat' && !v.startsWith('look:') && !ids.includes(v)) continue
      await evaluate(`window.previewView(${JSON.stringify(v)})`)
      await sleep(300)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const file = path.join(out, `${pack}__${env}__${v.replace(/[:,]/g, '_')}.png`)
      writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
    }
    console.log(`  ${entry.padEnd(34)} tris ${String(report.triangles).padStart(7)}  meshes ${String(report.meshes).padStart(4)}  calls ${String(report.calls).padStart(4)}  texKB ${String(report.textureKB).padStart(6)}  fallbacks ${report.fallbacksUsed.length}  hdri ${report.hdri}${report.photo ? '  photo room' : ''}`)
    for (const w of report.warnings ?? []) console.log(`    ${w.severity}: ${w.message}`)
    for (const r of report.rejectedPlacements ?? []) console.log(`    rejected ${r.placement}: ${r.reason}`)
  }
  console.log(`screenshots: ${out}`)
  ws.close()
} finally {
  chrome.kill(); vite.kill()
  await sleep(500)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* temp dir */ }
}
