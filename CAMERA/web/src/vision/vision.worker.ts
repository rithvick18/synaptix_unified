/**
 * Module Web Worker running MediaPipe FaceLandmarker off the main thread.
 * Frames arrive as transferred ImageBitmaps and never leave this browser.
 *
 *   init  {wasmBaseUrl, modelUrl, delegate}  -> ready {delegate} | init_error {message}
 *   frame {id, t, bitmap, includeLandmarks}  -> result {...}     | frame_error {id, message}
 *   close                                    -> closed (landmarker released)
 */

import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { createLandmarker, extractFaces, WARMUP_TIMESTAMP_MS, type WorkerRequest, type WorkerResponse } from './landmarker.ts'

// The project compiles against the DOM lib; describe just the worker surface we use.
interface WorkerScope {
  postMessage(msg: unknown, transfer: Transferable[]): void
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null
}
const scope = self as unknown as WorkerScope

let landmarker: FaceLandmarker | null = null
let initializing = false
let lastTs = -Infinity

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(msg, transfer)
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message || e.name : String(e)
}

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  switch (msg.type) {
    case 'init': {
      if (landmarker || initializing) {
        post({ type: 'init_error', message: 'already initialised' })
        return
      }
      initializing = true
      try {
        const created = await createLandmarker({
          wasmBaseUrl: msg.wasmBaseUrl,
          modelUrl: msg.modelUrl,
          delegate: msg.delegate,
          numFaces: msg.numFaces,
          canvas: new OffscreenCanvas(1, 1),
          useModule: true
        })
        landmarker = created.landmarker
        lastTs = WARMUP_TIMESTAMP_MS
        post({ type: 'ready', delegate: created.delegate, warnings: created.warnings, warmupMs: created.warmupMs })
      } catch (e) {
        post({ type: 'init_error', message: errMsg(e) })
      } finally {
        initializing = false
      }
      return
    }
    case 'frame': {
      const { id, t, bitmap } = msg
      try {
        if (!landmarker) throw new Error('landmarker not ready')
        if (!(t > lastTs)) throw new Error(`non-increasing timestamp ${t} <= ${lastTs}`)
        lastTs = t
        const width = bitmap.width
        const height = bitmap.height
        const t0 = performance.now()
        const result = landmarker.detectForVideo(bitmap, t)
        const inferenceMs = performance.now() - t0
        const faces = extractFaces(result, width, height, msg.includeLandmarks)
        const transfer: Transferable[] = []
        for (const f of faces) if (f.landmarks) transfer.push(f.landmarks.buffer)
        post({ type: 'result', id, t, width, height, inferenceMs, faces }, transfer)
      } catch (e) {
        post({ type: 'frame_error', id, message: errMsg(e) })
      } finally {
        bitmap.close()
      }
      return
    }
    case 'close': {
      try {
        landmarker?.close()
      } catch {
        // already torn down
      }
      landmarker = null
      post({ type: 'closed' })
      return
    }
  }
}
