/**
 * Main-thread side of depth estimation: prepares the photo, asks the worker for a depth
 * map, and packs the result (see depthStore.ts) into the small blob stored with a photo.
 */
import type { PhotoDepth } from '../contracts'
import type { DepthMap } from './depthMesh'
import { packDepth } from './depthStore'

/** Longest side of the image handed to the model. */
const PROBE_EDGE = 1024
const MODEL_FILE = 'depth-anything-v2-small/onnx/model_quantized.onnx'

export type DepthFailure = 'not-installed' | 'unsupported' | 'failed'
export class DepthError extends Error {
  constructor(public readonly reason: DepthFailure, message: string) { super(message); this.name = 'DepthError' }
}

const baseUrl = (): string => new URL('depth-models/', document.baseURI).href

/** True when the model files are served by this site. Never throws. */
export async function depthModelInstalled(): Promise<boolean> {
  try { return (await fetch(baseUrl() + MODEL_FILE, { method: 'HEAD' })).ok } catch { return false }
}

let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker {
  worker ??= new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

/** Frees the worker and the model's memory (call when the caregiver editor closes). */
export function releaseDepthWorker(): void {
  worker?.terminate()
  worker = null
}

async function probe(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' })
  const scale = Math.min(1, PROBE_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
}

function run(image: Blob): Promise<DepthMap> {
  const w = getWorker(), id = nextId++
  return new Promise((resolve, reject) => {
    const cleanup = (): void => { w.removeEventListener('message', onMessage); w.removeEventListener('error', onError) }
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.id !== id) return
      cleanup()
      if (e.data.error) reject(new DepthError('failed', String(e.data.error)))
      else resolve({ width: e.data.width, height: e.data.height, data: e.data.data })
    }
    const onError = (): void => { cleanup(); releaseDepthWorker(); reject(new DepthError('failed', 'the depth worker stopped')) }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ id, image, base: baseUrl() })
  })
}

/** Estimates depth for a photo, on this device. */
export async function estimateDepth(photo: Blob): Promise<PhotoDepth> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new DepthError('unsupported', 'this browser cannot run depth estimation')
  }
  if (!(await depthModelInstalled())) throw new DepthError('not-installed', 'the depth model is not installed')
  return packDepth(await run(await probe(photo)))
}
