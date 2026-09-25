/**
 * Optional camera support — the wiring between Memoria and the camera application.
 *
 *   CameraAdapter  (camera lifecycle + transport + schema translation)   CameraAdapter.ts
 *   VisionBridge   (gameplay telemetry → service game events)            VisionBridge.ts
 *   AdaptationPolicy (service suggestions → game decisions)              AdaptationPolicy.ts
 *   CameraUI       (setup sheet, HUD chip, settings, developer panel)    CameraUI.ts
 *
 * OFF by default, and only ever turned on by a person pressing "Turn on camera". While
 * off, this module holds a few variables and nothing else: no network request, no camera,
 * no worker, no model download, and none of the camera application's code is loaded.
 * The telemetry listener main.ts installed runs first and unchanged.
 *
 * Every failure (service not running, permission denied, model failure, tracking lost,
 * service disconnected) leaves the game exactly as playable as with the camera off; the
 * chip says what happened and vision-driven adaptation holds.
 */

import type { MissionRunner } from '../Missions'
import type { State } from '../State'
import type { Event, Telemetry } from '../Telemetry'
import type { ObservationBody } from './app'
import { AdaptationPolicy, type AdaptationConfig, type AdaptationRecord, type GameContext } from './AdaptationPolicy'
import { CameraAdapter } from './CameraAdapter'
import { CameraUI, describeSnapshot } from './CameraUI'
import { buildSnapshot } from './snapshot'
import type { CameraSnapshot } from './types'
import { InstructionHold, VisionBridge } from './VisionBridge'

const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8765'
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])
const PREF_ADAPT = 'memoria-camera-adaptation-v1'
const POLICY_TICK_MS = 250
/** Game-side input that counts as activity: walking, looking, clicking. */
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

type Env = Record<string, string | undefined>
const env = (): Env => (import.meta as ImportMeta & { env?: Env }).env ?? {}

/** `VITE_OBSERVATION_URL` may move the port; anything not on this computer is refused. */
export function serviceUrl(raw: string | undefined = env().VITE_OBSERVATION_URL): string | null {
  try {
    const url = new URL(raw || DEFAULT_SERVICE_URL)
    if (!LOOPBACK.has(url.hostname) || (url.protocol !== 'http:' && url.protocol !== 'https:')) return null
    return url.origin
  } catch {
    return null
  }
}

function readAdaptPref(): boolean {
  try {
    return localStorage.getItem(PREF_ADAPT) !== '0'
  } catch {
    return true
  }
}

function writeAdaptPref(on: boolean): void {
  try {
    localStorage.setItem(PREF_ADAPT, on ? '1' : '0')
  } catch {
    /* lasts for this page only */
  }
}

export interface CameraIntegrationDeps {
  state: State
  telemetry: Telemetry
  /** Current attempt id (main.ts's `attemptId`), for the adaptation log. */
  attemptId: () => string
  /** "Start playing" on the setup sheet. */
  onPlay: () => void
  /** Called whenever the one-line status changes, so the level list can redraw. */
  onStatusChange?: () => void
  /**
   * TEST ONLY — set from `?camera=inject` in dev builds. The camera is not opened;
   * `inject()` sends labelled synthetic observations through the real producer socket.
   */
  injectMode?: boolean
  adaptationConfig?: Partial<AdaptationConfig>
}

export interface CameraIntegration {
  /** Opens the setup sheet (level list button). */
  openSetup(): void
  /** Called with each new MissionRunner, before `start()`. */
  attach(runner: MissionRunner): void
  /** For the level list: whether the camera is on, and one short status line. */
  summary(): { on: boolean; status: string | null }
  /** Debug handle (window.__memoria.camera). */
  debug: Record<string, unknown>
}

export function createCameraIntegration(deps: CameraIntegrationDeps): CameraIntegration {
  const { state, telemetry } = deps
  const log = (message: string, detail?: unknown): void => {
    if (detail === undefined) console.info(`[memoria] camera · ${message}`)
    else console.info(`[memoria] camera · ${message}`, detail)
  }

  let runner: MissionRunner | null = null
  let missionId: string | null = null
  let adapter: CameraAdapter | null = null
  let bridge: VisionBridge | null = null
  let offs: (() => void)[] = []
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let lastSummary = ''
  let adaptationEnabled = readAdaptPref()
  /** The service's last hold_new_instructions, for edge-triggered release. */
  let serviceHolding = false
  /** Bumped by every enable/disable, so a slow enable that was overtaken cleans itself up. */
  let generation = 0
  const hold = new InstructionHold()
  const gate = (speakNow: () => void): void => hold.gate(speakNow)

  const offSnapshot = (): CameraSnapshot =>
    buildSnapshot({
      at: performance.now(),
      sessionId: null,
      adapter: null,
      serviceReason: null,
      observer: null,
      processor: null,
      perf: null,
      adaptationEnabled,
      pending: null,
      error: null
    })
  let lastSnapshot: CameraSnapshot = offSnapshot()
  const snapshot = (): CameraSnapshot => (adapter && !adapter.isDisposed ? adapter.getLatestState() : lastSnapshot)

  const context = (): GameContext => {
    const task = bridge?.currentTask ?? null
    const elapsed = state.elapsed()
    return {
      now: performance.now(),
      gameState: state.current,
      attemptId: deps.attemptId(),
      taskId: task?.id ?? null,
      stepIndex: task?.step ?? null,
      stepAgeMs: runner?.stepAgeMs ?? null,
      msSinceAnswer: task?.lastAnswerAt !== null && task?.lastAnswerAt !== undefined ? elapsed - task.lastAnswerAt : null,
      hintLevel: runner?.level ?? 0
    }
  }

  // The game is the authority; these are the only three things the policy can ask for.
  const policy = new AdaptationPolicy(
    {
      holdInstruction: (ms) => hold.open(ms),
      gentleCue: () => runner?.gentleCue() ?? false,
      requestHint: () => runner?.requestHint() ?? false
    },
    { config: deps.adaptationConfig, sessionId: () => adapter?.sessionId ?? null }
  )
  policy.onRecord((r: AdaptationRecord) => {
    log(`adaptation ${r.action} [${r.source}] → ${r.decision}${r.reason ? ` (${r.reason})` : ''}`, r)
  })

  const ui = new CameraUI({
    onEnable: () => void enable(),
    onStop: () => disable('camera_stopped'),
    onCalibrate: () => {
      ui.clearGestures()
      adapter?.calibrate()
    },
    onSetAdaptation: (on) => setAdaptation(on),
    onPlay: () => deps.onPlay()
  })
  ui.setRecords(policy.records)
  ui.setDiagnostics(() => adapter?.diagnostics() ?? null)

  /** The player's adaptation switch. Off: nothing adapts, and the service stops suggesting from vision. */
  function setAdaptation(on: boolean): void {
    adaptationEnabled = on
    writeAdaptPref(on)
    adapter?.setAdaptationEnabled(on)
    if (!on) {
      hold.release()
      policy.clearPending('adaptation_disabled', context(), snapshot())
    }
    render(snapshot())
  }

  const render = (s: CameraSnapshot): void => {
    lastSnapshot = s
    ui.update(s)
    // The level list shows on/off and the lifecycle phase, so it redraws on those — not
    // on every tracking flicker.
    const line = `${s.phase}|${s.error?.code ?? ''}`
    if (line !== lastSummary) {
      lastSummary = line
      deps.onStatusChange?.()
    }
  }

  // --- The telemetry seam: chain, never replace what main.ts put there. ---------------
  const previous = telemetry.onEvent
  telemetry.onEvent = (event: Event) => {
    previous?.(event)
    if (event.kind === 'mission_start') missionId = event.id
    bridge?.handleEvent(event)
    if (event.kind === 'step_start' || event.kind === 'restart') policy.clearPending('task_changed', context(), snapshot())
  }

  // Leaving gameplay (level list, summary): close the task, drop anything held or pending.
  state.onChange((next) => {
    if (next !== 'completed') return
    bridge?.endOpenTask()
    hold.cancel()
    policy.clearPending('left_gameplay', context(), snapshot())
  })

  // --- Enable / disable -----------------------------------------------------------------

  async function enable(): Promise<void> {
    if (adapter && !adapter.isDisposed) {
      if (adapter.sessionId) {
        // Connected already: a retry after a camera error only restarts the camera.
        if (!adapter.getLatestState().camera.running && !deps.injectMode) await startCamera(adapter, generation)
        return
      }
      disable('retry') // the service was unreachable: start again from nothing
    }
    const gen = ++generation
    ui.openSheet()
    ui.clearGestures()
    const baseUrl = serviceUrl()
    if (!baseUrl) {
      render({ ...offSnapshot(), phase: 'error', error: { code: 'service_url_refused', message: 'VITE_OBSERVATION_URL is not a loopback origin' } })
      return
    }

    const a = new CameraAdapter({
      baseUrl,
      label: 'memoria',
      adaptationEnabled,
      allowInjection: deps.injectMode === true,
      log
    })
    adapter = a
    offs.push(
      a.onState((s) => {
        render(s)
        // Release a held instruction when the service *stops* holding (head back), or the
        // moment vision stops being trustworthy. Edge-triggered: the suggestion can arrive
        // a few ms before the state message that confirms the hold, and must not be
        // cancelled by the older state. An unconfirmed hold still ends at its time cap.
        const holding = s.visionUsable && s.policy?.holdNewInstructions === true
        if (!s.visionUsable || (serviceHolding && !holding)) hold.release()
        serviceHolding = holding
      }),
      a.onGesture((g) => ui.addGesture(g)), // heuristic only; never an answer
      a.onSuggestion((s) => {
        policy.consider(s, context(), a.getLatestState())
        syncTick()
      })
    )
    ui.expand()

    try {
      await a.connect()
    } catch {
      if (gen === generation) render(a.getLatestState())
      return
    }
    if (gen !== generation) return

    const b = new VisionBridge({ sink: a, clock: () => state.elapsed(), log })
    bridge = b
    if (runner) runner.instructionGate = gate
    const step = runner?.active ? runner.current : null
    if (runner && step && missionId && state.timersRunning) b.adoptTask(missionId, runner.stepIndex, step.type)
    if (state.current === 'paused') b.handleEvent({ t: Math.round(state.elapsed()), kind: 'pause' })
    if (document.hidden) b.expectedIdle(true)
    installInputListeners(b)

    if (deps.injectMode) {
      log('TEST MODE: camera not opened; use __memoria.camera.inject(observation)')
      render(a.getLatestState())
      return
    }
    await startCamera(a, gen)
  }

  async function startCamera(a: CameraAdapter, gen: number): Promise<void> {
    try {
      await a.startCamera(ui.video, ui.overlay)
    } catch (e) {
      log('camera did not start', e) // the snapshot carries the error for the UI
    }
    if (gen !== generation) return
    render(a.getLatestState())
  }

  function disable(reason: string): void {
    generation++
    const a = adapter
    const b = bridge
    adapter = null
    bridge = null
    for (const off of offs.splice(0)) off()
    serviceHolding = false
    syncTick(true)
    policy.clearPending(reason, context(), a ? a.getLatestState() : lastSnapshot)
    hold.cancel()
    if (runner) runner.instructionGate = null
    if (b) {
      b.endOpenTask() // one task_skipped so the service does not keep a task open
      b.dispose()
    }
    ui.reset()
    render(offSnapshot())
    if (a) void a.dispose()
  }

  // --- Lifecycle hooks the service must hear about ------------------------------------

  const onVisibility = (): void => bridge?.expectedIdle(document.hidden)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', () => disable('page_closed'))

  function installInputListeners(b: VisionBridge): void {
    const active = (): boolean => state.timersRunning
    const onKey = (e: KeyboardEvent): void => {
      if (active() && MOVEMENT_KEYS.has(e.code)) b.activity('moved')
    }
    const onMouse = (e: MouseEvent): void => {
      // With pointer lock, mouse movement is looking around.
      if (active() && document.pointerLockElement && (e.movementX || e.movementY)) b.activity('looked')
    }
    const onPointer = (): void => {
      if (active()) b.activity('clicked')
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousemove', onMouse)
    document.addEventListener('pointerdown', onPointer)
    offs.push(() => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousemove', onMouse)
      document.removeEventListener('pointerdown', onPointer)
    })
  }

  /** Runs the policy tick only while something is deferred. */
  function syncTick(stop = false): void {
    const want = !stop && policy.pendingCount > 0
    if (want && tickTimer === null) {
      tickTimer = setInterval(() => {
        policy.tick(context(), snapshot())
        if (policy.pendingCount === 0) syncTick(true)
      }, POLICY_TICK_MS)
    } else if (!want && tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  return {
    openSetup(): void {
      ui.openSheet()
    },
    attach(next: MissionRunner): void {
      runner = next
      hold.cancel()
      policy.clearPending('level_changed', context(), snapshot())
      if (adapter) runner.instructionGate = gate
    },
    summary() {
      const s = snapshot()
      return { on: s.phase !== 'off', status: s.phase === 'off' && !s.error ? null : describeSnapshot(s).text }
    },
    debug: {
      get state(): CameraSnapshot {
        return snapshot()
      },
      get adaptations(): readonly AdaptationRecord[] {
        return policy.records
      },
      get eventsSent(): Record<string, number> | null {
        return bridge ? { ...bridge.sent } : null
      },
      get holdPending(): boolean {
        return hold.hasPending
      },
      get holding(): boolean {
        return hold.holding
      },
      policy,
      enable: () => enable(),
      disable: () => disable('camera_stopped'),
      calibrate: () => adapter?.calibrate(),
      setAdaptation,
      /** TEST ONLY (?camera=inject in dev): a labelled synthetic observation. */
      inject: (body: ObservationBody) => {
        if (!adapter) throw new Error('camera is off')
        return adapter.injectObservation(body)
      }
    }
  }
}
