#!/usr/bin/env node
/**
 * Starts everything the integrated game needs, from the workspace root:
 *
 *   npm run dev                      # observation service + Memoria 3D (camera support built in)
 *   npm run dev -- --with-camera-app # also the standalone camera app, for debugging
 *
 * Uses each project's own tooling: the service's virtualenv (`python -m app`) and each
 * web project's own Vite. Ctrl+C stops all of them; nothing is left running.
 *
 * Configuration comes from the environment, or from `.env` in this folder (see
 * .env.example). Values already in the environment win over `.env`.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.join(ROOT, '3D game')
const CAMERA_WEB = path.join(ROOT, 'CAMERA', 'web')
const SERVICE = path.join(ROOT, 'CAMERA', 'service')
const PYTHON = path.join(SERVICE, '.venv', 'bin', 'python')

// --- Configuration ---------------------------------------------------------------------

function loadDotEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    let value = m[2]
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}
loadDotEnv(path.join(ROOT, '.env'))

const withCameraApp = process.argv.includes('--with-camera-app') || process.env.MEMORIA_WITH_CAMERA_APP === '1'
const GAME_PORT = Number(process.env.MEMORIA_GAME_PORT ?? 5173)
const CAMERA_APP_PORT = 5174 // fixed by CAMERA/web/vite.config.ts (strictPort)
const OBS_HOST = process.env.OBS_HOST ?? '127.0.0.1'
const OBS_PORT = Number(process.env.OBS_PORT ?? 8765)
const SERVICE_URL = process.env.VITE_OBSERVATION_URL ?? `http://${OBS_HOST}:${OBS_PORT}`
// Exact origins only — the game's and the standalone camera app's. No wildcards.
const ALLOWED =
  process.env.OBS_ALLOWED_ORIGINS ??
  JSON.stringify([
    `http://localhost:${GAME_PORT}`,
    `http://127.0.0.1:${GAME_PORT}`,
    `http://localhost:${CAMERA_APP_PORT}`,
    `http://127.0.0.1:${CAMERA_APP_PORT}`
  ])

// --- Preflight ---------------------------------------------------------------------------

const problems = []
if (!existsSync(PYTHON)) problems.push('CAMERA/service/.venv is missing')
if (!existsSync(path.join(GAME, 'node_modules', '.bin', 'vite'))) problems.push('3D game/node_modules is missing')
if (!existsSync(path.join(CAMERA_WEB, 'node_modules', '@mediapipe'))) problems.push('CAMERA/web/node_modules is missing')
if (problems.length) {
  console.error(`Not set up yet: ${problems.join('; ')}.\nRun \`npm run setup\` in ${ROOT} first.`)
  process.exit(1)
}
if (!existsSync(path.join(CAMERA_WEB, 'public', 'models', 'face_landmarker.task'))) {
  console.warn('[dev] Face model missing (CAMERA/web/public/models). The game runs; camera support will fail until `npm run setup`.')
}

function portFree(port, host) {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, host, () => srv.close(() => resolve(true)))
  })
}

const busy = []
if (!(await portFree(OBS_PORT, OBS_HOST))) busy.push(`${OBS_HOST}:${OBS_PORT} (service)`)
// Vite also runs with --strictPort, so a port taken on another interface still fails loudly.
if (!(await portFree(GAME_PORT, '127.0.0.1'))) busy.push(`${GAME_PORT} (game)`)
if (withCameraApp && !(await portFree(CAMERA_APP_PORT, '127.0.0.1'))) busy.push(`${CAMERA_APP_PORT} (camera app)`)
if (busy.length) {
  console.error(`Port(s) already in use: ${busy.join(', ')}. Stop whatever is using them, or set MEMORIA_GAME_PORT / OBS_PORT.`)
  process.exit(1)
}

// --- Processes ---------------------------------------------------------------------------

const children = []
let stopping = false

function start(name, cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter((l) => l.length)
      .map((l) => `[${name}] ${l}`)
      .join('\n') + '\n'
  child.stdout.on('data', (c) => process.stdout.write(prefix(c)))
  child.stderr.on('data', (c) => process.stderr.write(prefix(c)))
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev] ${name} exited (${signal ?? code}); stopping the rest.`)
      shutdown(code ?? 1)
    }
  })
  children.push({ name, child })
  return child
}

function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  console.log('\n[dev] stopping…')
  for (const { child } of children) {
    try {
      process.kill(-child.pid, 'SIGTERM') // the whole process group (vite, uvicorn and their children)
    } catch {
      /* already gone */
    }
  }
  const deadline = setTimeout(() => {
    for (const { child } of children) {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* gone */
      }
    }
    process.exit(code)
  }, 5000)
  let left = children.filter(({ child }) => child.exitCode === null && child.signalCode === null).length
  if (left === 0) process.exit(code)
  for (const { child } of children) {
    child.once('exit', () => {
      if (--left <= 0) {
        clearTimeout(deadline)
        console.log('[dev] all stopped.')
        process.exit(code)
      }
    })
  }
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('service', PYTHON, ['-m', 'app'], SERVICE, {
  OBS_HOST,
  OBS_PORT: String(OBS_PORT),
  OBS_ALLOWED_ORIGINS: ALLOWED
})
start('game', path.join(GAME, 'node_modules', '.bin', 'vite'), ['--port', String(GAME_PORT), '--strictPort'], GAME, {
  VITE_OBSERVATION_URL: SERVICE_URL
})
if (withCameraApp) start('camera', path.join(CAMERA_WEB, 'node_modules', '.bin', 'vite'), [], CAMERA_WEB, {})

// --- Ready -------------------------------------------------------------------------------

async function waitFor(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end && !stopping) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (res.ok || res.status < 500) return true
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

const serviceOk = await waitFor(`${SERVICE_URL}/health`, 20_000)
const gameOk = await waitFor(`http://localhost:${GAME_PORT}/`, 30_000)
if (!stopping) {
  console.log(
    '\n' +
      '──────────────────────────────────────────────────────────────\n' +
      ` Memoria 3D (play here):   http://localhost:${GAME_PORT}/   ${gameOk ? '' : '(not answering yet)'}\n` +
      ` Observation service:      ${SERVICE_URL}   ${serviceOk ? '(healthy)' : '(not answering yet)'}\n` +
      (withCameraApp ? ` Standalone camera app:    http://127.0.0.1:${CAMERA_APP_PORT}/  (debugging)\n` : '') +
      ' Camera support: on the level list, press "Camera support (optional)".\n' +
      ' Ctrl+C stops everything.\n' +
      '──────────────────────────────────────────────────────────────\n'
  )
}
