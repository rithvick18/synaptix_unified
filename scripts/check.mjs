#!/usr/bin/env node
/**
 * Every check, from the workspace root: `npm run check` (add `-- --full` for the slower
 * browser checks each project already had). Each project's checks run with its own tooling,
 * unchanged. Stop `npm run dev` first: some checks start their own service on port 8765.
 *
 *   camera service   pytest                                  (CAMERA/service)
 *   camera web       tsc --noEmit · vitest · integration-check (real service, synthetic data)
 *   game             npm run check (tsc + headless suites, incl. camera.check.ts) · npm run build
 *   integrated       scripts/camera-e2e.mjs (headless Chrome, real service + game dev server)
 *   --full           + game check:offline · camera web check:browser
 *                    (+ camera web check:demo when DEMO_VIDEO=<face.y4m> is set — it needs a real face video)
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.join(ROOT, '3D game')
const WEB = path.join(ROOT, 'CAMERA', 'web')
const SERVICE = path.join(ROOT, 'CAMERA', 'service')
const full = process.argv.includes('--full')

const steps = [
  ['camera service · pytest', path.join(SERVICE, '.venv', 'bin', 'python'), ['-m', 'pytest', '-q'], SERVICE],
  ['camera web · typecheck', 'npx', ['tsc', '--noEmit'], WEB],
  ['camera web · unit tests', 'npx', ['vitest', 'run'], WEB],
  ['camera web · transport/policy integration (synthetic)', 'node', ['--experimental-strip-types', 'scripts/integration-check.ts'], WEB],
  ['game · typecheck + headless suites', 'npm', ['run', 'check'], GAME],
  ['game · build', 'npm', ['run', 'build'], GAME],
  ['integrated · headless Chrome end to end', 'node', ['scripts/camera-e2e.mjs'], ROOT]
]
if (full) {
  steps.push(
    ['game · offline check (headless Chrome)', 'npm', ['run', 'check:offline'], GAME],
    ['camera web · browser check (fake camera)', 'npm', ['run', 'check:browser'], WEB],
  )
  // The demo check needs a real face video: `DEMO_VIDEO=/path/face.y4m npm run check -- --full`.
  if (process.env.DEMO_VIDEO) steps.push(['camera web · demo check (headless Chrome)', 'npm', ['run', 'check:demo', '--', '--video', process.env.DEMO_VIDEO], WEB])
  else console.log('(camera web demo check skipped: it needs DEMO_VIDEO=<face.y4m>)')
}

const results = []
for (const [label, cmd, args, cwd] of steps) {
  console.log(`\n━━ ${label} ━━`)
  const t = Date.now()
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  results.push([label, r.status === 0, ((Date.now() - t) / 1000).toFixed(1)])
}

console.log('\n━━ summary ━━')
for (const [label, ok, s] of results) console.log(`  ${ok ? '✓' : '✗'} ${label}  (${s}s)`)
process.exit(results.every(([, ok]) => ok) ? 0 : 1)
