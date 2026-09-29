/**
 * Runs monocular depth estimation off the main thread. The photo never leaves the device:
 * only the model weights are fetched. Message in: an image Blob. Message out: a depth map.
 */
import { pipeline, env, RawImage } from '@huggingface/transformers'

const MODEL = 'onnx-community/depth-anything-v2-small'
// Spike: weights come from the Hugging Face hub. Before shipping, self-host them under
// public/ and set env.allowRemoteModels = false so the offline check holds.
env.allowLocalModels = false

type Estimator = (image: RawImage) => Promise<{ predicted_depth: { data: Float32Array; dims: number[] } }>
let estimator: Promise<Estimator> | null = null

function load(): Promise<Estimator> {
  estimator ??= (async () => {
    const device = 'gpu' in navigator ? 'webgpu' : 'wasm'
    try {
      return (await pipeline('depth-estimation', MODEL, { device, dtype: device === 'webgpu' ? 'fp16' : 'q8' })) as unknown as Estimator
    } catch {
      return (await pipeline('depth-estimation', MODEL, { device: 'wasm', dtype: 'q8' })) as unknown as Estimator
    }
  })()
  return estimator
}

self.onmessage = async (e: MessageEvent<{ id: number; image: Blob }>) => {
  const { id, image } = e.data
  try {
    const t0 = performance.now()
    const est = await load()
    const out = await est(await RawImage.fromBlob(image))
    const dims = out.predicted_depth.dims
    const height = dims[dims.length - 2], width = dims[dims.length - 1]
    const data = new Float32Array(out.predicted_depth.data)
    ;(self as unknown as Worker).postMessage({ id, width, height, data, ms: performance.now() - t0 }, [data.buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
