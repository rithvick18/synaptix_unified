#!/usr/bin/env node
/**
 * One-time setup, from the workspace root: `npm run setup`. Idempotent — each step is
 * skipped when its result is already there. Uses each project's own tooling:
 *
 *   CAMERA/service   python3 -m venv .venv && pip install -r requirements.txt -r requirements-dev.txt
 *   CAMERA/web       npm install && npm run setup:assets   (MediaPipe WASM + verified face model)
 *   3D game          npm install
 *
 * Needs network access the first time (packages, and the face model from Google's CDN).
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.join(ROOT, '3D game')
const CAMERA_WEB = path.join(ROOT, 'CAMERA', 'web')
const SERVICE = path.join(ROOT, 'CAMERA', 'service')
const force = process.argv.includes('--force')

function run(label, cmd, args, cwd) {
  console.log(`\n[setup] ${label}\n        $ ${[cmd, ...args].join(' ')}   (in ${path.relative(ROOT, cwd) || '.'})`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`[setup] FAILED: ${label}`)
    process.exit(r.status ?? 1)
  }
}

const venvPython = path.join(SERVICE, '.venv', 'bin', 'python')
if (force || !existsSync(venvPython)) run('service virtualenv', 'python3', ['-m', 'venv', '.venv'], SERVICE)
if (force || spawnSync(venvPython, ['-c', 'import fastapi, uvicorn, pydantic_settings, pytest'], { cwd: SERVICE }).status !== 0) {
  run('service packages', venvPython, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt', '-r', 'requirements-dev.txt'], SERVICE)
}

if (force || !existsSync(path.join(CAMERA_WEB, 'node_modules', '@mediapipe', 'tasks-vision'))) run('camera app packages', 'npm', ['install'], CAMERA_WEB)
if (force || !existsSync(path.join(CAMERA_WEB, 'public', 'models', 'face_landmarker.task'))) {
  run('MediaPipe runtime and face model', 'npm', ['run', 'setup:assets'], CAMERA_WEB)
}

if (force || !existsSync(path.join(GAME, 'node_modules', '.bin', 'vite'))) run('game packages', 'npm', ['install'], GAME)

console.log('\n[setup] done. Start everything with:  npm run dev')
