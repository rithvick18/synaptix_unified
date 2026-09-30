import type { PhotoObject } from '../contracts'

export type ObjectFailure = 'not-installed' | 'unsupported' | 'failed'
export class ObjectDetectionError extends Error {
  constructor(public readonly reason: ObjectFailure, message: string) { super(message); this.name = 'ObjectDetectionError' }
}

const baseUrl = (): string => new URL('object-models/', document.baseURI).href
const MODEL_FILE = 'Xenova/yolos-tiny/onnx/model_quantized.onnx'
const ROOM_LABELS = new Set(['chair', 'couch', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'potted plant', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'])
export async function objectModelInstalled(): Promise<boolean> {
  try { return (await fetch(baseUrl() + MODEL_FILE, { method: 'HEAD' })).ok } catch { return false }
}

let worker: Worker | null = null
let nextId = 1
let generation = 0
const pending = new Set<(error: ObjectDetectionError) => void>()
function getWorker(): Worker { worker ??= new Worker(new URL('./object.worker.ts', import.meta.url), { type: 'module' }); return worker }
export function releaseObjectWorker(): void {
  generation++
  worker?.terminate(); worker = null
  for (const reject of [...pending]) reject(new ObjectDetectionError('failed', 'Object analysis was cancelled.'))
  pending.clear()
}

async function prepare(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
  } finally { bitmap.close() }
}

export async function detectPhotoObjects(blob: Blob): Promise<PhotoObject[]> {
  const runGeneration = generation
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') throw new ObjectDetectionError('unsupported', 'This browser cannot run object detection.')
  if (!(await objectModelInstalled())) throw new ObjectDetectionError('not-installed', 'The object model is not installed.')
  const image = await prepare(blob)
  if (runGeneration !== generation) throw new ObjectDetectionError('failed', 'Object analysis was cancelled.')
  const w = getWorker(), id = nextId++
  const raw = await new Promise<Array<{ label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }>>((resolve, reject) => {
    const cancel = (error: ObjectDetectionError): void => { cleanup(); reject(error) }
    const cleanup = (): void => { pending.delete(cancel); w.removeEventListener('message', onMessage); w.removeEventListener('error', onError) }
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.id !== id) return
      cleanup()
      if (e.data.error) reject(new ObjectDetectionError('failed', String(e.data.error)))
      else resolve(e.data.results)
    }
    const onError = (): void => { cleanup(); releaseObjectWorker(); reject(new ObjectDetectionError('failed', 'The object worker stopped.')) }
    pending.add(cancel)
    w.addEventListener('message', onMessage); w.addEventListener('error', onError)
    w.postMessage({ id, image, base: baseUrl() })
  })
  const bitmap = await createImageBitmap(image)
  const width = bitmap.width, height = bitmap.height
  bitmap.close()
  return raw.filter(o => Number.isFinite(o.score) && o.score >= 0.25 && o.box && ROOM_LABELS.has(o.label.toLowerCase())).slice(0, 80).map((o, i) => {
    const x = Math.max(0, Math.min(1, o.box.xmin / width)), y = Math.max(0, Math.min(1, o.box.ymin / height))
    const right = Math.max(x, Math.min(1, o.box.xmax / width)), bottom = Math.max(y, Math.min(1, o.box.ymax / height))
    return { id: `det-${id}-${i}`, label: o.label.slice(0, 120), confidence: Math.max(0, Math.min(1, o.score)), box: { x, y, width: right - x, height: bottom - y }, included: false }
  }).filter(o => o.box.width > 0.005 && o.box.height > 0.005)
}
