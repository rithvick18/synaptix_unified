/**
 * Optional camera assistance — setup and teardown. Lives at `src/observation/observation.ts`.
 *
 * OFF by default. While off, this module holds a few variables and nothing else: no
 * network request, no camera, no worker, no model download, and none of the vendored
 * observation code is even loaded (it is imported dynamically on enable). The telemetry
 * listener main.ts installed runs first and unchanged; the chained call after it only
 * notes the current mission id.
 *
 * Turned on (from the level list), it:
 *  1. creates a session on the local observation service (loopback only — the same
 *     property SPEC §10.6 demands of the local model: video never leaves this computer,
 *     and only derived numbers reach the local service);
 *  2. connects a GameAdapter and feeds it the game's telemetry through VisionBridge;
 *  3. starts the camera (FaceObserver → ProducerConnection) with a small visible preview
 *     and a Calibrate button, and only then enables vision-based suggestions.
 *
 * Turned off, everything is stopped, the session is deleted and the preview removed.
 */

import type { MissionRunner } from '../Missions'
import type { State } from '../State'
import type { Event, Telemetry } from '../Telemetry'
import type { CameraAssistToggle } from '../ui'
import { InstructionHold, VisionBridge, readCameraAssist, writeCameraAssist } from './VisionBridge'
import type { GameAdapterApi, ProducerConnectionApi } from './vendor/transport/contracts.ts'
import type { FaceObserverApi, ProcessorStatus } from './vendor/vision/contracts.ts'

const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8765'
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** `VITE_OBSERVATION_URL` may move the port; anything not on this computer is refused. */
function serviceUrl(): string | null {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  try {
    const url = new URL(env?.VITE_OBSERVATION_URL || DEFAULT_SERVICE_URL)
    if (!LOOPBACK.has(url.hostname) || (url.protocol !== 'http:' && url.protocol !== 'https:')) return null
    return url.origin
  } catch {
    return null
  }
}

export interface Observation {
  /** The level-list switch. `redraw` re-renders the level list when the status changes. */
  toggle(redraw: () => void): CameraAssistToggle
  /** Called with each new MissionRunner, before `start()`. */
  attach(runner: MissionRunner): void
}

interface Running {
  session: { id: string; consumerToken: string }
  adapter: GameAdapterApi
  bridge: VisionBridge
  producer: ProducerConnectionApi | null
  observer: FaceObserverApi | null
  panel: HTMLElement | null
  unsubscribe: (() => void)[]
}

const log = (message: string, detail?: unknown): void => {
  if (detail === undefined) console.info(`[memoria] camera assistance · ${message}`)
  else console.info(`[memoria] camera assistance · ${message}`, detail)
}

export function createObservation(deps: { state: State; telemetry: Telemetry }): Observation {
  const { state, telemetry } = deps

  let enabled = false
  let status: string | null = null
  let redraw: (() => void) | null = null
  let runner: MissionRunner | null = null
  let missionId: string | null = null
  let running: Running | null = null
  /** Bumped by every enable/disable, so a slow enable that was overtaken cleans itself up. */
  let generation = 0
  const hold = new InstructionHold()

  // Chain onto the seam — never replace what main.ts put there.
  const previous = telemetry.onEvent
  telemetry.onEvent = (event: Event) => {
    previous?.(event)
    if (event.kind === 'mission_start') missionId = event.id
    running?.bridge.handleEvent(event)
  }

  // The level list resets the runner without a telemetry event; close the task here.
  state.onChange((next) => {
    if (next !== 'completed' || !running) return
    running.bridge.endOpenTask()
    hold.cancel()
  })

  /** The level-list line. Redraws the list, so it changes only on start/stop/failure. */
  const setStatus = (text: string | null): void => {
    if (text === status) return
    status = text
    redraw?.()
  }
  /** The preview's own line — calibration and face-in-view, updated in place. */
  const setPanelStatus = (text: string): void => {
    const line = running?.panel?.querySelector<HTMLElement>('.status')
    if (line && line.textContent !== text) line.textContent = text
  }

  const gate = (speakNow: () => void): void => hold.gate(speakNow)

  async function enable(): Promise<void> {
    const gen = ++generation
    const baseUrl = serviceUrl()
    if (!baseUrl) {
      setStatus('Only a helper on this computer can be used.')
      return
    }
    setStatus('Starting…')

    let session: Running['session'] | null = null
    try {
      const [{ createSession, deleteSession }, { GameAdapter }] = await Promise.all([
        import('./vendor/transport/session.ts'),
        import('./vendor/transport/GameAdapter.ts')
      ])
      const created = await createSession(baseUrl, { label: 'memoria' })
      session = { id: created.session_id, consumerToken: created.consumer_token }
      if (gen !== generation) {
        void deleteSession(baseUrl, session.id, session.consumerToken).catch(() => {})
        return
      }

      const adapter = new GameAdapter({
        baseUrl,
        sessionId: created.session_id,
        consumerToken: created.consumer_token,
        sourceId: 'memoria',
        visionAdaptationEnabled: false
      })
      const bridge = new VisionBridge({
        adapter,
        clock: () => state.elapsed(),
        visionAdaptationEnabled: false,
        log,
        callbacks: {
          // The bridge decides whether; these decide what — and only via the runner's
          // own public methods, which keep the ladder and §4.3 scoring as they are.
          onOfferHint: () => { runner?.requestHint() },
          onGentleCue: () => { runner?.gentleCue() },
          onDelayInstruction: (s) => hold.open(s.maxDelayMs),
          onIncreaseDifficulty: (s) => log('a harder setting was suggested; Memoria has none, so nothing changed', s)
        }
      })
      const r: Running = { session, adapter, bridge, producer: null, observer: null, panel: null, unsubscribe: [] }
      running = r
      r.unsubscribe.push(
        adapter.onState((s) => {
          // Head back (or no trustworthy state): nothing is held any longer.
          if (!s.state || s.stale || !s.state.policy.hold_new_instructions) hold.release()
        })
      )
      if (runner) runner.instructionGate = gate
      const step = runner?.active ? runner.current : null
      if (runner && step && missionId) bridge.adoptTask(missionId, runner.stepIndex, step.type)

      await adapter.connect()
      if (gen !== generation) return
      setStatus('Starting the camera…')

      const [{ FaceObserver }, { ProducerConnection }] = await Promise.all([
        import('./vendor/vision/FaceObserver.ts'),
        import('./vendor/transport/ProducerConnection.ts')
      ])
      if (gen !== generation) return
      const panel = createPanel(() => r.observer?.startCalibration())
      r.panel = panel
      const producer = new ProducerConnection({
        baseUrl,
        sessionId: created.session_id,
        producerToken: created.producer_token,
        producerId: 'memoria-camera'
      })
      r.producer = producer
      await producer.connect()
      if (gen !== generation) return

      const observer = new FaceObserver({
        video: panel.querySelector('video')!,
        overlay: panel.querySelector('canvas'),
        wasmBaseUrl: 'mediapipe/wasm',
        modelUrl: 'models/face_landmarker.task'
      })
      r.observer = observer
      r.unsubscribe.push(
        observer.onObservation((body) => producer.submit(body)),
        observer.onProcessorStatus((s) => setPanelStatus(describeCalibration(s)))
      )
      try {
        await observer.start()
      } catch {
        /* reported through observerStatus below */
      }
      if (gen !== generation) return
      const s = observer.observerStatus
      if (s.kind === 'error') {
        observer.stop()
        r.observer = null
        panel.remove()
        r.panel = null
        setStatus(describeCameraError(s.code))
        return
      }
      bridge.setVisionAdaptationEnabled(true)
      setStatus('On. The camera preview is in the corner.')
    } catch (error) {
      log('could not start', error)
      if (gen !== generation) return
      teardown()
      setStatus('The helper program on this computer is not running.')
    }
  }

  function teardown(): void {
    const r = running
    running = null
    hold.cancel()
    if (runner) runner.instructionGate = null
    if (!r) return
    r.bridge.endOpenTask()
    r.bridge.dispose()
    for (const off of r.unsubscribe) off()
    r.observer?.stop()
    r.producer?.disconnect()
    r.panel?.remove()
    const baseUrl = serviceUrl()
    // Give the task_skipped a moment to leave before the session goes away.
    setTimeout(() => {
      r.adapter.disconnect()
      if (!baseUrl) return
      void import('./vendor/transport/session.ts')
        .then(({ deleteSession }) => deleteSession(baseUrl, r.session.id, r.session.consumerToken))
        .catch(() => {})
    }, 250)
  }

  function disable(): void {
    generation++
    teardown()
    setStatus(null)
  }

  const onPageHide = (): void => {
    if (!enabled) return
    generation++
    teardown()
  }

  function setEnabled(on: boolean): void {
    if (on === enabled) return
    enabled = on
    writeCameraAssist(on)
    if (on) {
      window.addEventListener('pagehide', onPageHide)
      void enable()
    } else {
      window.removeEventListener('pagehide', onPageHide)
      disable()
    }
  }

  // Remembered from last time in this browser — and still only ever turned on by a person.
  if (readCameraAssist()) setEnabled(true)

  return {
    toggle(next: () => void): CameraAssistToggle {
      redraw = next
      return { on: enabled, status, onToggle: () => { setEnabled(!enabled); redraw?.() } }
    },
    attach(next: MissionRunner): void {
      runner = next
      hold.cancel()
      if (running) runner.instructionGate = gate
    }
  }
}

// ---------------------------------------------------------------------------
// The preview. Always visible while the camera is on: a person can see that it is on.
// ---------------------------------------------------------------------------

const PANEL_STYLE = `
#camera-assist { position: fixed; right: 14px; bottom: 14px; z-index: 30; width: 180px;
  padding: 8px; border-radius: 12px; background: rgba(16,17,20,.86);
  border: 1px solid rgba(255,255,255,.14); color: #f2efe9; font: 12px/1.4 system-ui, sans-serif; }
#camera-assist .view { position: relative; width: 164px; height: 123px; border-radius: 8px;
  overflow: hidden; background: #000; }
#camera-assist video, #camera-assist canvas { position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; }
#camera-assist .status { margin: 6px 0; color: #b5b0a6; min-height: 2.8em; }
#camera-assist button { width: 100%; padding: 6px 0; border-radius: 8px; font: inherit; cursor: pointer;
  border: 1px solid #ffd98a; background: #ffd98a; color: #14161a; font-weight: 600; }
`

function createPanel(onCalibrate: () => void): HTMLElement {
  if (!document.getElementById('camera-assist-style')) {
    const style = document.createElement('style')
    style.id = 'camera-assist-style'
    style.textContent = PANEL_STYLE
    document.head.appendChild(style)
  }
  const panel = document.createElement('div')
  panel.id = 'camera-assist'
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', 'Camera assistance')
  panel.innerHTML =
    `<div class="view"><video muted playsinline autoplay></video><canvas></canvas></div>` +
    `<div class="status" role="status">Camera on. Video stays on this computer.</div>` +
    `<button type="button">Calibrate</button>`
  // Clicks here must not reach the game's document handler (which grabs the pointer).
  for (const kind of ['click', 'mousedown', 'pointerdown'] as const) {
    panel.addEventListener(kind, (e) => e.stopPropagation())
  }
  panel.querySelector('button')!.addEventListener('click', () => onCalibrate())
  document.body.appendChild(panel)
  return panel
}

function describeCalibration(s: ProcessorStatus): string {
  switch (s.calibration) {
    case 'calibrating':
      return 'Hold still and look at the screen…'
    case 'calibrated':
      return s.tracking === 'tracking' || s.tracking === 'recovering' ? 'On. Ready.' : 'On. Face not in view.'
    case 'failed':
      return 'Not settled yet. Look at the screen and press Calibrate again.'
    default:
      return 'On. Look at the screen and press Calibrate.'
  }
}

function describeCameraError(code: string): string {
  switch (code) {
    case 'permission_denied':
      return 'The camera was not allowed. Hints work as usual.'
    case 'no_camera':
      return 'No camera was found. Hints work as usual.'
    case 'camera_in_use':
      return 'The camera is busy in another program. Hints work as usual.'
    default:
      return 'The camera could not start. Hints work as usual.'
  }
}
