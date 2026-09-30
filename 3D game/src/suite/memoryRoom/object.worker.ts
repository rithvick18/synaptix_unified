/** Private, on-device COCO object proposals. Results are suggestions; the caregiver decides what to keep. */
import { env, pipeline, RawImage } from '@huggingface/transformers'

type Detector = (image: RawImage) => Promise<Array<{ label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }>>
let detector: Promise<Detector> | null = null

function load(base: string): Promise<Detector> {
  detector ??= (async () => {
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = base
    const wasm = env.backends.onnx.wasm
    if (wasm) { wasm.wasmPaths = { mjs: `${base}ort/ort-wasm-simd-threaded.mjs`, wasm: `${base}ort/ort-wasm-simd-threaded.wasm` }; wasm.numThreads = 1 }
    return await pipeline('object-detection', 'Xenova/yolos-tiny', { device: 'wasm', dtype: 'q8' }) as unknown as Detector
  })()
  detector.catch(() => { detector = null })
  return detector
}

self.onmessage = async (e: MessageEvent<{ id: number; image: Blob; base: string }>) => {
  const { id, image, base } = e.data
  try {
    const detect = await load(base)
    const results = await detect(await RawImage.fromBlob(image))
    ;(self as unknown as Worker).postMessage({ id, results })
  } catch (error) {
    ;(self as unknown as Worker).postMessage({ id, error: String(error) })
  }
}
