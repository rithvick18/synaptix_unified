#!/usr/bin/env node
/**
 * Puts the on-device depth model where the memory room expects it, so photos are never
 * sent anywhere and the feature works offline:
 *
 *   npm run setup:depth                 # depth only
 *   npm run setup:room-models           # depth + optional object proposals
 *
 * Downloads Depth Anything V2 Small (int8, ~26 MB) from Hugging Face into
 * public/depth-models/, and copies the ONNX runtime's WebAssembly files from node_modules.
 * Both are git-ignored. A deploy that should offer the memory room runs this before
 * `npm run build`; without it the caregiver editor says the feature is not installed and
 * everything else works unchanged.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'depth-models')
const MODEL = 'depth-anything-v2-small'
const REPO = 'onnx-community/depth-anything-v2-small'
const FILES = ['config.json', 'preprocessor_config.json', 'onnx/model_quantized.onnx']
const OBJECT_MODEL = 'Xenova/yolos-tiny'
const OBJECT_FILES = process.argv.includes('--objects') ? ['config.json', 'preprocessor_config.json', 'onnx/config.json', 'onnx/model_quantized.onnx'] : []

for (const file of FILES) {
  const dest = path.join(out, MODEL, file)
  if (existsSync(dest) && statSync(dest).size > 0) { console.log('have', file); continue }
  mkdirSync(path.dirname(dest), { recursive: true })
  const res = await fetch(`https://huggingface.co/${REPO}/resolve/main/${file}`)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('downloaded', file, `${(statSync(dest).size / 1048576).toFixed(1)} MB`)
}

// Optional household object suggestions use the same locally served runtime. COCO labels
// are only proposals; caregivers review and edit them in setup before they are displayed.
for (const file of OBJECT_FILES) {
  const dest = path.join(root, 'public', 'object-models', OBJECT_MODEL, file)
  if (existsSync(dest) && statSync(dest).size > 0) { console.log('have object model', file); continue }
  mkdirSync(path.dirname(dest), { recursive: true })
  const res = await fetch(`https://huggingface.co/${OBJECT_MODEL}/resolve/main/${file}`)
  if (!res.ok) throw new Error(`object model ${file}: HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('downloaded object model', file, `${(statSync(dest).size / 1048576).toFixed(1)} MB`)
}

const ort = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')
mkdirSync(path.join(out, 'ort'), { recursive: true })
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  copyFileSync(path.join(ort, file), path.join(out, 'ort', file))
  console.log('copied', file)
}
