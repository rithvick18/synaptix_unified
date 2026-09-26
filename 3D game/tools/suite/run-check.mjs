#!/usr/bin/env node
/**
 * Bundles and runs ONE check file under node, without the project-wide typecheck that
 * `npm run check` does first. For working on one suite module while other modules are
 * still being written; `npm run check` remains the gate.
 *
 *   node tools/suite/run-check.mjs tools/checks/suite-assets.check.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const file = process.argv[2]
if (!file) { console.error('usage: node tools/suite/run-check.mjs <check.ts>'); process.exit(2) }
const out = mkdtempSync(path.join(tmpdir(), 'memoria-suite-check-'))
const bundle = path.join(out, 'check.mjs')
try {
  const build = spawnSync(path.join(root, 'node_modules', '.bin', 'esbuild'), [
    path.resolve(file), '--bundle', '--format=esm', '--platform=node', '--log-level=warning',
    `--alias:three/examples=${path.join(root, 'node_modules', 'three', 'examples')}`,
    `--alias:three=${path.join(root, 'node_modules', 'three', 'build', 'three.module.js')}`,
    `--outfile=${bundle}`
  ], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(1)
  const run = spawnSync(process.execPath, [bundle], { stdio: 'inherit', env: { ...process.env, MEMORIA_ROOT: root } })
  process.exitCode = run.status ?? 1
} finally {
  rmSync(out, { recursive: true, force: true })
}
