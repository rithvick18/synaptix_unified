/**
 * Runs monocular depth estimation off the main thread, entirely on this device: the model
 * and the ONNX runtime are read from the site itself (see tools/setup-depth-model.mjs),
 * never from the network, and the photo is never sent anywhere.
 *
 * In:  { id, image: Blob, base: string }  — `base` is the absolute URL of depth-models/.
 * Out: { id, width, height, data: Float32Array, ms } or { id, error }.
 */
import { AutoModelForDepthEstimation, AutoProcessor, env, RawImage } from '@huggingface/transformers'

const MODEL = 'depth-anything-v2-small'

type Estimator = (image: RawImage) => Promise<{ data: Float32Array; dims: number[] }>
let estimator: Promise<Estimator> | null = null

// The model and its preprocessor are loaded directly rather than through `pipeline()`,
// which asks the Hugging Face hub for a file list and skips the preprocessor when it cannot.
function load(base: string): Promise<Estimator> {
  estimator ??= (async () => {
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = base
    const wasm = env.backends.onnx.wasm
    if (wasm) {
      wasm.wasmPaths = { mjs: `${base}ort/ort-wasm-simd-threaded.mjs`, wasm: `${base}ort/ort-wasm-simd-threaded.wasm` }
      wasm.numThreads = 1 // multi-threading needs cross-origin isolation, which the site does not set
    }
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(MODEL),
      AutoModelForDepthEstimation.from_pretrained(MODEL, { device: 'wasm', dtype: 'q8' })
    ])
    return async (image: RawImage) => {
      const inputs = await processor(image)
      const { predicted_depth } = await model(inputs)
      return predicted_depth as { data: Float32Array; dims: number[] }
    }
  })()
  estimator.catch(() => { estimator = null }) // let a later attempt retry
  return estimator
}

self.onmessage = async (e: MessageEvent<{ id: number; image: Blob; base: string }>) => {
  const { id, image, base } = e.data
  try {
    const t0 = performance.now()
    const est = await load(base)
    const out = await est(await RawImage.fromBlob(image))
    const dims = out.dims
    const height = dims[dims.length - 2], width = dims[dims.length - 1]
    const data = new Float32Array(out.data)
    ;(self as unknown as Worker).postMessage({ id, width, height, data, ms: performance.now() - t0 }, [data.buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
