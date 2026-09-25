/**
 * Interactive demo: one page playing both roles through separate connections —
 * the camera producer (FaceObserver -> ProducerConnection) and a game consumer
 * (GameAdapter). A real game would usually only embed the GameAdapter side.
 */

import type {
  AdapterState,
  ConnectionStatusEvent
} from '../transport/contracts.ts'
import type {
  CreateSessionResponse,
  GameEventInput,
  GestureEventMessage,
  Measurement,
  ObservationBody,
  SuggestedActionMessage
} from '../protocol/types.ts'
import type { ObserverStatus, ProcessorStatus } from '../vision/contracts.ts'
import { createSession, deleteSession } from '../transport/session.ts'
import { GameAdapter } from '../transport/GameAdapter.ts'
import { ProducerConnection } from '../transport/ProducerConnection.ts'
import { FaceObserver } from '../vision/FaceObserver.ts'
import { SignalProcessor } from '../vision/signals.ts'
import { SimulatedFaceSource } from './simulation.ts'

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}
const setText = (id: string, text: string, cls?: 'ok' | 'bad' | '') => {
  const el = $(id)
  el.textContent = text
  if (cls !== undefined) el.className = cls
}
const fmt = (m: Measurement<number>, digits = 1, unit = ''): string =>
  m.value === null ? `null (${m.reason})` : `${m.value.toFixed(digits)}${unit}`

function log(listId: string, text: string, limit = 40): void {
  const list = $(listId)
  const li = document.createElement('li')
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`
  list.prepend(li)
  while (list.children.length > limit) list.lastElementChild?.remove()
}

// --- State ---------------------------------------------------------------------------

let session: CreateSessionResponse | null = null
let baseUrl = ''
let adapter: GameAdapter | null = null
let producer: ProducerConnection | null = null
let observer: FaceObserver | null = null
let simulation: SimulatedFaceSource | null = null
const unsubscribers: Array<() => void> = []

let taskCounter = 0
let currentTask: string | null = null
let paused = false
let idle = false

// --- Session -------------------------------------------------------------------------

$('btn-session').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('btn-session')
  button.disabled = true
  baseUrl = $<HTMLInputElement>('base-url').value.replace(/\/+$/, '')
  try {
    session = await createSession(baseUrl, { label: 'demo' })
    setText('session-id', session.session_id)

    adapter = new GameAdapter({
      baseUrl,
      sessionId: session.session_id,
      consumerToken: session.consumer_token,
      sourceId: 'demo-game',
      visionAdaptationEnabled: $<HTMLInputElement>('chk-adaptation').checked
    })
    unsubscribers.push(
      adapter.onConnectionStatus((e) => showConnection('adapter-status', e)),
      adapter.onState(renderState),
      adapter.onGesture(renderGesture),
      adapter.onSuggestedAction(renderAction)
    )
    await adapter.connect()

    producer = new ProducerConnection({
      baseUrl,
      sessionId: session.session_id,
      producerToken: session.producer_token,
      producerId: 'demo-camera-' + Math.random().toString(36).slice(2, 8),
      transport: $<HTMLSelectElement>('transport').value as 'websocket' | 'http'
    })
    unsubscribers.push(
      producer.onStatus((e) => showConnection('producer-status', e)),
      producer.onError((e) => log('event-log', `service error on camera link: ${e.code} — ${e.message}`))
    )
    await producer.connect()

    $<HTMLButtonElement>('btn-end-session').disabled = false
    $<HTMLSelectElement>('transport').disabled = true
    setCameraButtons()
  } catch (err) {
    setText('session-id', `failed: ${(err as Error).message}`, 'bad')
    await endSession()
  }
})

$('btn-end-session').addEventListener('click', () => void endSession())

async function endSession(): Promise<void> {
  stopCamera()
  stopSimulation()
  producer?.disconnect()
  producer = null
  if (session) {
    try {
      await deleteSession(baseUrl, session.session_id, session.consumer_token)
    } catch {
      // Already expired or the service is down; the local teardown below still runs.
    }
  }
  adapter?.disconnect()
  adapter = null
  while (unsubscribers.length) unsubscribers.pop()?.()
  session = null
  setText('session-id', '—')
  $<HTMLButtonElement>('btn-session').disabled = false
  $<HTMLButtonElement>('btn-end-session').disabled = true
  $<HTMLSelectElement>('transport').disabled = false
  setCameraButtons()
}

function showConnection(id: string, e: ConnectionStatusEvent): void {
  const text = e.reason ? `${e.status} (${e.reason})` : e.status
  setText(id, e.attempt > 0 ? `${text}, attempt ${e.attempt}` : text, e.status === 'open' ? 'ok' : e.status === 'failed' ? 'bad' : '')
}

// --- Camera --------------------------------------------------------------------------

function setCameraButtons(): void {
  const connected = session !== null
  const camOn = observer !== null
  const simOn = simulation?.running ?? false
  $<HTMLButtonElement>('btn-cam-start').disabled = !connected || camOn || simOn
  $<HTMLButtonElement>('btn-cam-stop').disabled = !camOn
  $<HTMLButtonElement>('btn-calibrate').disabled = !camOn
  $<HTMLButtonElement>('btn-sim-start').disabled = !connected || camOn || simOn
  for (const id of ['btn-sim-stop', 'btn-sim-calibrate', 'btn-sim-nod', 'btn-sim-shake', 'btn-sim-blink']) {
    $<HTMLButtonElement>(id).disabled = !simOn
  }
}

$('btn-cam-start').addEventListener('click', async () => {
  observer = new FaceObserver({
    video: $<HTMLVideoElement>('video'),
    overlay: $<HTMLCanvasElement>('overlay'),
    processor: new SignalProcessor(),
    overlayEnabled: $<HTMLInputElement>('chk-overlay').checked,
    mirrorPreview: $<HTMLInputElement>('chk-mirror').checked
  })
  observer.onObservation(onObservation)
  observer.onStatus(renderObserverStatus)
  observer.onProcessorStatus(renderProcessorStatus)
  setCameraButtons()
  try {
    await observer.start()
  } catch {
    // start() reports failures through onStatus; nothing is simulated in their place.
  }
  if (observer?.observerStatus.kind === 'error') {
    observer.stop()
    observer = null
  }
  setCameraButtons()
})

$('btn-cam-stop').addEventListener('click', () => stopCamera())
$('btn-calibrate').addEventListener('click', () => observer?.startCalibration())
$<HTMLInputElement>('chk-overlay').addEventListener('change', (e) =>
  observer?.setOverlayEnabled((e.target as HTMLInputElement).checked)
)
$<HTMLInputElement>('chk-mirror').addEventListener('change', (e) =>
  observer?.setMirrorPreview((e.target as HTMLInputElement).checked)
)

function stopCamera(): void {
  observer?.stop()
  observer = null
  $('calibration-guide').hidden = true
  setCameraButtons()
}

function onObservation(body: ObservationBody): void {
  renderSignals(body)
  producer?.submit(body)
}

function renderObserverStatus(s: ObserverStatus): void {
  switch (s.kind) {
    case 'running':
      setText('observer-status', `running`, 'ok')
      setText('perf-backend', `${s.backend === 'worker' ? 'Web Worker' : 'main thread (throttled fallback)'} · ${s.delegate ?? '?'}`)
      break
    case 'error':
      setText('observer-status', `error: ${s.code} — ${s.message}`, 'bad')
      break
    case 'suspended':
      setText('observer-status', 'suspended (tab hidden)')
      break
    default:
      setText('observer-status', s.kind, '')
  }
}

function renderProcessorStatus(s: ProcessorStatus): void {
  setText('tracking-status', s.tracking, s.tracking === 'tracking' ? 'ok' : '')
  setText(
    'calibration-status',
    s.calibrationReason ? `${s.calibration} (${s.calibrationReason})` : s.calibration,
    s.calibration === 'calibrated' ? 'ok' : s.calibration === 'failed' || s.calibration === 'required' ? 'bad' : ''
  )
  const guide = $('calibration-guide')
  guide.hidden = s.calibration !== 'calibrating'
  if (!guide.hidden) {
    setText(
      'calibration-text',
      s.calibrationPhase === 'settle'
        ? 'Get ready: look at the centre of the screen'
        : 'Hold still, looking at the centre of the screen'
    )
    $<HTMLProgressElement>('calibration-progress').value = s.calibrationProgress ?? 0
  }
}

function renderSignals(body: ObservationBody): void {
  const m = body.measurements
  setText('m-angles', `${fmt(m.head_yaw_deg, 1, '°')} / ${fmt(m.head_pitch_deg, 1, '°')} / ${fmt(m.head_roll_deg, 1, '°')}`)
  setText('m-facing', fmt(m.head_facing_score, 2))
  $<HTMLMeterElement>('m-facing-meter').value = m.head_facing_score.value ?? 0
  setText('m-orientation', m.head_orientation.value ?? `null (${m.head_orientation.reason})`)
  setText('m-away', fmt(m.head_away_ms, 0, ' ms'))
  setText('m-eyes', `${fmt(m.eye_openness_left, 2)} / ${fmt(m.eye_openness_right, 2)}`)
  setText('m-blink', `${fmt(m.eye_blink_coefficient_left, 2)} / ${fmt(m.eye_blink_coefficient_right, 2)}`)
  setText('m-closed', fmt(m.eyes_closed_ms, 0, ' ms'))
  setText('m-quality', fmt(body.tracking.quality, 2))
  if (body.perf) {
    setText('perf-inference', body.perf.inference_ms === null ? '—' : `${body.perf.inference_ms.toFixed(1)} ms`)
    setText('perf-fps', body.perf.processed_fps === null ? '—' : `${body.perf.processed_fps.toFixed(1)} frames/s`)
    setText('perf-dropped', String(body.perf.dropped_frames))
  }
  if (simulation?.running) {
    setText('tracking-status', `${body.tracking.status} (SIMULATED)`)
    setText('calibration-status', `${body.calibration.status} (SIMULATED)`)
  }
}

// --- Service state -------------------------------------------------------------------

function renderState(a: AdapterState): void {
  if (a.stale || !a.state) {
    setText('s-attention', 'no current state', 'bad')
    setText('s-reason', a.stale ? '(connection stale — nothing is assumed)' : '')
    return
  }
  const s = a.state
  setText('s-attention', s.attention_state, s.attention_state === 'HEAD_TOWARD_SCREEN' ? 'ok' : '')
  setText('s-reason', `(${s.attention_reason})`)
  const v = s.vision
  setText(
    's-vision',
    v.fresh
      ? `fresh, ${v.observation_age_ms?.toFixed(0)} ms old${v.simulated ? ' — SIMULATED' : ''}`
      : `not fresh${v.observation_age_ms !== null ? `, ${(v.observation_age_ms / 1000).toFixed(1)} s old` : ''}`
  )
  setText(
    's-adaptation',
    s.policy.vision_hold_reason ? `${s.policy.vision_adaptation} (${s.policy.vision_hold_reason})` : s.policy.vision_adaptation
  )
  setText('s-hold', `${s.policy.hold_new_instructions}${s.policy.hold_reason ? ` (${s.policy.hold_reason})` : ''}`)
  setText('s-inactivity', fmt(s.gameplay.inactivity_ms, 0, ' ms'))
  const e = s.task_engagement_score
  const parts = Object.entries(e.components)
    .map(([k, v]) => `${k}=${v === null ? 'null' : v.toFixed(2)}`)
    .join(', ')
  setText('s-engagement', e.value === null ? `null (${e.reason})` : `${e.value.toFixed(2)} [${parts}] — heuristic`)
}

function renderGesture(g: GestureEventMessage): void {
  const d = g.gesture
  const detail = d.amplitude_deg !== null ? `, ${d.amplitude_deg.toFixed(0)}°, ${d.swings} swings` : ''
  log('gesture-log', `${d.type}${detail} · id ${d.gesture_id.slice(0, 8)}`)
}

function renderAction(a: SuggestedActionMessage): void {
  const box = $('latest-action')
  box.replaceChildren()
  const h = document.createElement('h4')
  h.textContent = `${a.action}  (${a.source})`
  const p = document.createElement('p')
  p.textContent = a.reason
  const pre = document.createElement('pre')
  pre.textContent = JSON.stringify(a.evidence, null, 1)
  box.append(h, p, pre)
  log('action-log', `${a.action} · ${a.source}${a.task_id ? ` · task ${a.task_id}` : ''} · id ${a.action_id.slice(0, 8)}`)
}

$<HTMLInputElement>('chk-adaptation').addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked
  adapter?.setVisionAdaptationEnabled(enabled)
  log('event-log', `vision-based adaptation ${enabled ? 'enabled' : 'disabled'}`)
})

// --- Gameplay events -----------------------------------------------------------------

function send(input: GameEventInput, label: string): void {
  if (!adapter) {
    log('event-log', `(not connected) ${label}`)
    return
  }
  adapter.sendGameEvent(input)
  log('event-log', label)
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-ev]')) {
  button.addEventListener('click', () => {
    switch (button.dataset.ev) {
      case 'task_started':
        taskCounter += 1
        currentTask = `demo-task-${taskCounter}`
        setText('task-id', currentTask)
        send({ event_type: 'task_started', task_id: currentTask }, `task_started ${currentTask}`)
        break
      case 'answer_correct':
      case 'answer_wrong': {
        if (!currentTask) return log('event-log', 'start a task first')
        const correct = button.dataset.ev === 'answer_correct'
        send({ event_type: 'answer_submitted', task_id: currentTask, data: { correct } }, `answer_submitted correct=${correct}`)
        break
      }
      case 'hint_requested':
        if (!currentTask) return log('event-log', 'start a task first')
        send({ event_type: 'hint_requested', task_id: currentTask }, 'hint_requested')
        break
      case 'task_completed':
      case 'task_skipped':
        if (!currentTask) return log('event-log', 'start a task first')
        send(
          button.dataset.ev === 'task_completed'
            ? { event_type: 'task_completed', task_id: currentTask, data: { outcome: 'success' } }
            : { event_type: 'task_skipped', task_id: currentTask },
          `${button.dataset.ev} ${currentTask}`
        )
        currentTask = null
        setText('task-id', '—')
        break
      case 'player_activity':
        send({ event_type: 'player_activity', data: { activity: 'moved' } }, 'player_activity')
        break
      case 'pause':
        paused = !paused
        button.textContent = paused ? 'Resume' : 'Pause'
        send({ event_type: paused ? 'paused' : 'resumed' }, paused ? 'paused' : 'resumed')
        break
      case 'idle':
        idle = !idle
        button.textContent = idle ? 'End expected idle' : 'Start expected idle'
        send({ event_type: idle ? 'expected_idle_start' : 'expected_idle_end' }, idle ? 'expected_idle_start' : 'expected_idle_end')
        break
    }
  })
}

// --- Simulation (explicit only) --------------------------------------------------------

for (const id of ['sim-yaw', 'sim-pitch']) {
  $<HTMLInputElement>(id).addEventListener('input', (e) => setText(`${id}-v`, `${(e.target as HTMLInputElement).value}°`))
}

$('btn-sim-start').addEventListener('click', () => {
  if (observer) return
  simulation = new SimulatedFaceSource(
    new SignalProcessor(undefined, { simulated: true }),
    () => ({
      yawDeg: Number($<HTMLInputElement>('sim-yaw').value),
      pitchDeg: Number($<HTMLInputElement>('sim-pitch').value),
      facePresent: $<HTMLInputElement>('sim-face').checked,
      eyesClosed: $<HTMLInputElement>('sim-eyes').checked,
      secondFace: $<HTMLInputElement>('sim-second').checked
    }),
    onObservation
  )
  simulation.start()
  setText('observer-status', 'SIMULATION running — not camera data', 'bad')
  setCameraButtons()
})
$('btn-sim-stop').addEventListener('click', () => stopSimulation())
$('btn-sim-calibrate').addEventListener('click', () => simulation?.calibrate())
$('btn-sim-nod').addEventListener('click', () => simulation?.play('nod'))
$('btn-sim-shake').addEventListener('click', () => simulation?.play('shake'))
$('btn-sim-blink').addEventListener('click', () => simulation?.play('blink'))

function stopSimulation(): void {
  if (!simulation) return
  simulation.stop()
  simulation = null
  setText('observer-status', 'idle', '')
  setCameraButtons()
}

window.addEventListener('pagehide', () => {
  stopCamera()
  stopSimulation()
  producer?.disconnect()
  adapter?.disconnect()
})
