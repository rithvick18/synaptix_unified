/**
 * Camera support UI — the setup sheet, the HUD chip with its settings panel, and the
 * developer details. Styled with the game's own palette (ui.ts): dark sheets, the warm
 * #ffd98a accent, no colour-coded judgement.
 *
 * Only presentation lives here. It reads `CameraSnapshot`s and calls the callbacks it was
 * given; it never touches the adapter, the policy or the game.
 *
 * The video element is created once and never moved in the DOM (moving a playing <video>
 * pauses it). "Hiding" the preview shrinks it to a speck instead of `display: none`, so
 * the browser keeps delivering frames to the camera pipeline.
 */

import type { AdaptationRecord } from './AdaptationPolicy'
import type { CameraGesture, CameraSnapshot } from './types'

export interface CameraUICallbacks {
  onEnable(): void
  onStop(): void
  onCalibrate(): void
  onSetAdaptation(enabled: boolean): void
  /** "Start playing" on the setup sheet. */
  onPlay(): void
  /** The setup sheet closed (any way). */
  onSheetClosed?(): void
}

const STYLE = `
#camera-setup { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
  padding: 24px; background: rgba(8,9,11,.72); backdrop-filter: blur(2px); color: #f2efe9;
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
#camera-setup[hidden] { display: none; }
#camera-setup .sheet { width: min(560px, 100%); max-height: 92vh; overflow: auto; padding: 24px 24px 18px;
  border-radius: 18px; background: rgba(20,22,26,.97); border: 1px solid rgba(255,255,255,.13);
  box-shadow: 0 24px 70px rgba(0,0,0,.5); }
#camera-setup h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; letter-spacing: -.01em; }
#camera-setup p { margin: 0 0 8px; color: #b5b0a6; }
#camera-setup ul.facts { margin: 10px 0 14px; padding-left: 18px; color: #b5b0a6; font-size: 13px; }
#camera-setup ul.facts li { margin: 3px 0; }
#camera-setup .steps { margin: 12px 0 0; display: flex; flex-direction: column; gap: 6px; }
#camera-setup .steps div { display: flex; justify-content: space-between; gap: 14px; padding: 7px 12px;
  border-radius: 9px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
  font-size: 13px; color: #8d8880; }
#camera-setup .steps div.active { color: #f2efe9; border-color: rgba(255,217,138,.35); background: rgba(255,217,138,.09); }
#camera-setup .steps div.done { color: #b5b0a6; }
#camera-setup .steps div.failed { color: #f2efe9; border-color: rgba(224,138,107,.5); }
#camera-setup .steps .note { color: #8d8880; font-size: 12.5px; text-align: right; }
#camera-setup .message { margin: 12px 0 0; min-height: 1.45em; color: #ffe7b4; }
#camera-setup .actions { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
#camera-setup button, #camera-dock button { padding: 8px 16px; border-radius: 10px; font: inherit; cursor: pointer;
  border: 1px solid rgba(255,255,255,.18); background: transparent; color: #b5b0a6; }
#camera-setup button:hover, #camera-dock button:hover { color: #f2efe9; border-color: rgba(255,255,255,.35); }
#camera-setup button.primary, #camera-dock button.primary { background: #ffd98a; border-color: #ffd98a;
  color: #14161a; font-weight: 600; }
#camera-setup button[hidden], #camera-dock [hidden] { display: none !important; }

#camera-dock { position: fixed; right: 14px; bottom: 14px; z-index: 41; display: flex; flex-direction: column;
  align-items: flex-end; gap: 8px; color: #f2efe9; font: 12.5px/1.4 ui-sans-serif, system-ui, sans-serif; }
#camera-dock .chip { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px;
  background: rgba(16,17,20,.82); border: 1px solid rgba(255,255,255,.14); color: #f2efe9; }
#camera-dock .dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #8d8880; }
#camera-dock .dot.on { background: #ffd98a; border-color: #ffd98a; }
#camera-dock .dot.held { border-color: #ffd98a; }
#camera-dock .dot.err { background: #e08a6b; border-color: #e08a6b; }
#camera-dock .panel { width: 250px; padding: 10px; border-radius: 12px; background: rgba(20,22,26,.95);
  border: 1px solid rgba(255,255,255,.14); display: flex; flex-direction: column; gap: 8px; }
#camera-dock .view { position: relative; width: 228px; height: 171px; border-radius: 8px; overflow: hidden;
  background: #000; transition: width .15s ease, height .15s ease; }
#camera-dock .view.collapsed { width: 2px; height: 2px; opacity: .02; }
#camera-dock video, #camera-dock canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
#camera-dock .status { color: #b5b0a6; min-height: 2.8em; }
#camera-dock .row { display: flex; gap: 6px; flex-wrap: wrap; }
#camera-dock .row button { padding: 5px 10px; font-size: 12px; }
#camera-dock label.switch { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #f2efe9; }
#camera-dock details { color: #8d8880; }
#camera-dock details summary { cursor: pointer; }
#camera-dock pre { margin: 6px 0 0; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word;
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #b5b0a6; }
`

type StepState = 'waiting' | 'active' | 'done' | 'failed'

const PREF_PREVIEW = 'memoria-camera-preview-v1'

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function writePref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* preference lasts for this page only */
  }
}

/** One plain-language line for the chip and the level list. */
export function describeSnapshot(s: CameraSnapshot | null): { text: string; tone: 'on' | 'held' | 'err' | 'off' } {
  if (!s || s.phase === 'off') return { text: 'Off', tone: 'off' }
  if (s.phase === 'error') return { text: `Off — ${describeError(s.error?.code)}`, tone: 'err' }
  if (s.phase === 'connecting') return { text: 'Connecting…', tone: 'held' }
  if (s.phase === 'starting_camera' || s.phase === 'loading_model') return { text: 'Starting the camera…', tone: 'held' }
  if (s.phase === 'needs_calibration') return { text: 'Needs calibration', tone: 'held' }
  if (s.phase === 'calibrating') return { text: 'Calibrating — look at the screen', tone: 'held' }
  if (s.visionUsable) return { text: 'On · adapting', tone: 'on' }
  return { text: describeHold(s.visionBlockedReason), tone: 'held' }
}

function describeHold(reason: string | null): string {
  const r = reason ?? ''
  if (r === 'adaptation_disabled') return 'On · adaptation off'
  if (r.startsWith('service_')) return r.startsWith('service_vision') ? 'On · adaptation held' : 'Helper program not connected · adaptation held'
  if (r === 'state_stale' || r === 'vision_stale') return 'Waiting for camera data · adaptation held'
  if (r === 'camera_suspended') return 'Paused while this tab is hidden'
  if (r === 'not_calibrated') return 'Needs calibration · adaptation held'
  if (r.startsWith('tracking_no_face') || r.startsWith('tracking_lost')) return 'Face not in view · adaptation held'
  if (r.startsWith('tracking_multiple')) return 'More than one face · adaptation held'
  if (r.startsWith('tracking_')) return 'Tracking unsure · adaptation held'
  return 'On · adaptation held'
}

export function describeError(code: string | undefined): string {
  switch (code) {
    case 'service_unreachable':
      return 'the helper program on this computer is not running'
    case 'service_url_refused':
      return 'only a helper on this computer can be used'
    case 'permission_denied':
      return 'the camera was not allowed'
    case 'no_camera':
      return 'no camera was found'
    case 'camera_in_use':
      return 'the camera is busy in another program'
    case 'camera_unsupported':
      return 'this browser cannot open the camera here'
    case 'model_load_failed':
      return 'the face model could not load'
    case 'inference_failed':
      return 'the face model stopped working'
    default:
      return 'the camera could not start'
  }
}

export class CameraUI {
  private readonly cb: CameraUICallbacks
  private readonly sheet: HTMLElement
  private readonly dock: HTMLElement
  private readonly chipText: HTMLElement
  private readonly dot: HTMLElement
  private readonly panel: HTMLElement
  private readonly view: HTMLElement
  readonly video: HTMLVideoElement
  readonly overlay: HTMLCanvasElement
  private readonly statusEl: HTMLElement
  private readonly adaptInput: HTMLInputElement
  private readonly previewButton: HTMLButtonElement
  private readonly devPre: HTMLPreElement
  private readonly devDetails: HTMLDetailsElement
  private snapshot: CameraSnapshot | null = null
  private previewOn = readPref(PREF_PREVIEW, true)
  private records: readonly AdaptationRecord[] = []
  private gestures: CameraGesture[] = []
  private diagnostics: () => unknown = () => null
  private devTimer: ReturnType<typeof setInterval> | null = null

  constructor(callbacks: CameraUICallbacks) {
    this.cb = callbacks
    if (!document.getElementById('camera-ui-style')) {
      const style = document.createElement('style')
      style.id = 'camera-ui-style'
      style.textContent = STYLE
      document.head.appendChild(style)
    }

    // --- Setup sheet ---
    this.sheet = document.createElement('div')
    this.sheet.id = 'camera-setup'
    this.sheet.hidden = true
    this.sheet.setAttribute('role', 'dialog')
    this.sheet.setAttribute('aria-label', 'Camera support')
    this.sheet.innerHTML =
      `<div class="sheet">` +
      `<h2>Camera support (optional)</h2>` +
      `<p>Memoria can use your webcam to adjust a few small things while you play. It waits to speak a new ` +
      `instruction until you turn back to the screen, and it can give one gentle reminder if you seem to have ` +
      `stepped away. Everything works the same without it.</p>` +
      `<ul class="facts">` +
      `<li>Video stays on this computer. Only numbers, such as the head angle, go to the helper program on this computer. Nothing is recorded.</li>` +
      `<li>It measures which way your head is turned. It does not track where your eyes look.</li>` +
      `<li>Extra hints still depend only on your answers. The camera never makes the game easier or harder.</li>` +
      `</ul>` +
      `<div class="steps"></div>` +
      `<p class="message" role="status"></p>` +
      `<div class="actions">` +
      `<button data-act="without">Continue without camera</button>` +
      `<button data-act="stop" hidden>Turn camera off</button>` +
      `<button data-act="calibrate" hidden>Calibrate</button>` +
      `<button data-act="enable" class="primary">Turn on camera</button>` +
      `<button data-act="play" class="primary" hidden>Start playing</button>` +
      `</div></div>`
    this.stopEvents(this.sheet)
    this.sheet.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act
      if (act === 'enable') this.cb.onEnable()
      else if (act === 'calibrate') this.cb.onCalibrate()
      else if (act === 'stop') this.cb.onStop()
      else if (act === 'without') {
        this.cb.onStop()
        this.closeSheet()
      } else if (act === 'play') {
        this.closeSheet()
        this.cb.onPlay()
      }
    })
    document.body.appendChild(this.sheet)

    // --- HUD dock: chip + settings panel ---
    this.dock = document.createElement('div')
    this.dock.id = 'camera-dock'
    this.dock.hidden = true
    this.dock.setAttribute('role', 'region')
    this.dock.setAttribute('aria-label', 'Camera support')
    this.dock.innerHTML =
      `<div class="panel" hidden>` +
      `<div class="view"><video muted playsinline autoplay></video><canvas></canvas></div>` +
      `<div class="status" role="status"></div>` +
      `<label class="switch">Adapt the game to the camera <input type="checkbox" data-act="adapt"></label>` +
      `<div class="row">` +
      `<button data-act="preview"></button>` +
      `<button data-act="calibrate">Recalibrate</button>` +
      `<button data-act="stop">Stop camera</button>` +
      `</div>` +
      `<details><summary>Developer details</summary><pre></pre></details>` +
      `</div>` +
      `<button class="chip" data-act="chip" aria-expanded="false"><span class="dot"></span><span class="label">Camera</span></button>`
    this.stopEvents(this.dock)
    this.panel = this.dock.querySelector('.panel')!
    this.view = this.dock.querySelector('.view')!
    this.video = this.dock.querySelector('video')!
    this.overlay = this.dock.querySelector('canvas')!
    this.statusEl = this.dock.querySelector('.status')!
    this.adaptInput = this.dock.querySelector('input[data-act="adapt"]')!
    this.previewButton = this.dock.querySelector('button[data-act="preview"]')!
    this.devPre = this.dock.querySelector('pre')!
    this.devDetails = this.dock.querySelector('details')!
    this.chipText = this.dock.querySelector('.chip .label')!
    this.dot = this.dock.querySelector('.chip .dot')!
    this.dock.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act
      if (act === 'chip') this.togglePanel()
      else if (act === 'calibrate') this.cb.onCalibrate()
      else if (act === 'stop') this.cb.onStop()
      else if (act === 'preview') this.setPreview(!this.previewOn)
    })
    this.adaptInput.addEventListener('change', () => this.cb.onSetAdaptation(this.adaptInput.checked))
    this.devDetails.addEventListener('toggle', () => this.syncDevTimer())
    document.body.appendChild(this.dock)
    this.setPreview(this.previewOn)
  }

  // --- Sheet -----------------------------------------------------------------------------

  openSheet(): void {
    this.sheet.hidden = false
    this.render()
  }

  closeSheet(): void {
    if (this.sheet.hidden) return
    this.sheet.hidden = true
    this.cb.onSheetClosed?.()
  }

  get sheetOpen(): boolean {
    return !this.sheet.hidden
  }

  // --- Data in ---------------------------------------------------------------------------

  update(s: CameraSnapshot): void {
    this.snapshot = s
    this.render()
  }

  setRecords(records: readonly AdaptationRecord[]): void {
    this.records = records
  }

  addGesture(g: CameraGesture): void {
    this.gestures.push(g)
    if (this.gestures.length > 8) this.gestures.shift()
  }

  /** Forget gesture history (camera stopped, recalibrated, new session). */
  clearGestures(): void {
    this.gestures = []
  }

  setDiagnostics(fn: () => unknown): void {
    this.diagnostics = fn
  }

  /** Removes the dock and sheet listeners' timers; the elements stay for reuse. */
  reset(): void {
    this.snapshot = null
    this.gestures = []
    this.panel.hidden = true
    this.dock.querySelector('.chip')!.setAttribute('aria-expanded', 'false')
    this.syncDevTimer()
    this.render()
  }

  // --- Rendering -------------------------------------------------------------------------

  private render(): void {
    const s = this.snapshot
    const phase = s?.phase ?? 'off'
    const d = describeSnapshot(s)

    // Dock: shown whenever the camera feature is doing anything.
    this.dock.hidden = phase === 'off' && !s?.error
    this.chipText.textContent = `Camera · ${d.text}`
    this.dot.className = `dot ${d.tone === 'off' ? '' : d.tone}`
    this.statusEl.textContent = this.statusLine(s)
    this.adaptInput.checked = s?.adaptationEnabled ?? true
    if (this.devDetails.open) this.renderDev()

    if (this.sheet.hidden) return
    const steps = this.stepStates(s)
    this.sheet.querySelector('.steps')!.innerHTML = steps
      .map(([label, state, note]) => `<div class="${state}"><span>${label}</span><span class="note">${note}</span></div>`)
      .join('')
    const message = this.sheet.querySelector<HTMLElement>('.message')!
    message.textContent =
      phase === 'error'
        ? `The camera is off: ${describeError(s?.error?.code)}. You can try again, or play without it.`
        : phase === 'needs_calibration'
          ? 'Sit as you will while playing, look at the middle of the screen, and press Calibrate. Hold still for about three seconds. The preview is in the bottom-right corner.'
          : phase === 'calibrating'
            ? 'Hold still and look at the screen…'
            : phase === 'ready'
              ? 'Ready. You can start playing. The camera button in the corner has Recalibrate and Stop.'
              : phase === 'off'
                ? ''
                : 'Starting… your browser may ask for permission to use the camera.'
    const show = (act: string, visible: boolean, label?: string): void => {
      const b = this.sheet.querySelector<HTMLButtonElement>(`button[data-act="${act}"]`)!
      b.hidden = !visible
      if (label) b.textContent = label
    }
    const busy = phase === 'connecting' || phase === 'starting_camera' || phase === 'loading_model'
    show('enable', phase === 'off' || phase === 'error', phase === 'error' ? 'Try again' : 'Turn on camera')
    show('calibrate', phase === 'needs_calibration' || phase === 'ready', phase === 'ready' ? 'Recalibrate' : 'Calibrate')
    show('stop', busy || phase === 'needs_calibration' || phase === 'calibrating' || phase === 'ready')
    show('play', phase === 'ready')
    show('without', phase !== 'ready')
  }

  private stepStates(s: CameraSnapshot | null): [string, StepState, string][] {
    const phase = s?.phase ?? 'off'
    const code = s?.error?.code
    const serviceFailed = code === 'service_unreachable' || code === 'service_url_refused'
    const cameraFailed = !!code && !serviceFailed && code !== 'model_load_failed' && code !== 'inference_failed'
    const modelFailed = code === 'model_load_failed' || code === 'inference_failed'
    const linked = s?.service.status === 'open'
    const running = s?.camera.running ?? false
    const cal = s?.camera.calibration ?? 'unknown'
    const service: StepState = serviceFailed ? 'failed' : phase === 'connecting' ? 'active' : linked || running ? 'done' : 'waiting'
    const camera: StepState = cameraFailed
      ? 'failed'
      : running
        ? 'done'
        : phase === 'starting_camera' || phase === 'loading_model'
          ? 'active'
          : 'waiting'
    const model: StepState = modelFailed
      ? 'failed'
      : running && s?.camera.backend
        ? 'done'
        : phase === 'loading_model'
          ? 'active'
          : 'waiting'
    const calibration: StepState =
      cal === 'calibrated' ? 'done' : cal === 'failed' ? 'failed' : phase === 'calibrating' || phase === 'needs_calibration' ? 'active' : 'waiting'
    const pct = s?.camera.calibrationProgress
    return [
      ['Helper program on this computer', service, s?.service.status === 'reconnecting' ? 'reconnecting…' : ''],
      ['Camera permission', camera, ''],
      ['Face model', model, s?.camera.backend ? (s.camera.backend === 'worker' ? 'background thread' : 'main thread') : ''],
      [
        'Calibration',
        calibration,
        cal === 'failed'
          ? 'not settled — try again'
          : pct !== null && pct !== undefined && phase === 'calibrating'
            ? `${Math.round(pct * 100)}%`
            : ''
      ]
    ]
  }

  private statusLine(s: CameraSnapshot | null): string {
    if (!s) return ''
    const d = describeSnapshot(s)
    const face =
      s.camera.running && s.camera.tracking !== 'unknown'
        ? s.camera.tracking === 'tracking'
          ? 'Face in view.'
          : s.camera.tracking === 'no_face' || s.camera.tracking === 'lost'
            ? 'Face not in view.'
            : `Tracking: ${s.camera.tracking.replace(/_/g, ' ')}.`
        : ''
    return `${d.text}. ${face} Video stays on this computer.`
  }

  private renderDev(): void {
    const s = this.snapshot
    const v = s?.vision
    const m = (x: { value: number | boolean | null; reason: string | null } | undefined, digits = 1, unit = ''): string =>
      !x ? '—' : x.value === null ? `null (${x.reason})` : typeof x.value === 'number' ? `${x.value.toFixed(digits)}${unit}` : String(x.value)
    const lines = [
      `phase ${s?.phase ?? 'off'} · session ${s?.service.sessionId ?? '—'}`,
      `service ${s?.service.status ?? '—'}${s?.service.stale ? ' (stale)' : ''}${s?.service.reason ? ` · ${s.service.reason}` : ''}`,
      `camera ${s?.camera.running ? 'running' : 'off'} · ${s?.camera.backend ?? '—'}/${s?.camera.delegate ?? '—'} · ` +
        `${s?.camera.processedFps?.toFixed(1) ?? '—'} fps · ${s?.camera.inferenceMs?.toFixed(1) ?? '—'} ms · dropped ${s?.camera.droppedFrames ?? 0}`,
      `local tracking ${s?.camera.tracking ?? '—'} · calibration ${s?.camera.calibration ?? '—'}`,
      `vision gate ${s?.visionUsable ? 'OPEN' : `held: ${s?.visionBlockedReason ?? '—'}`}`,
      v
        ? `attention ${v.attention} (${v.attentionReason}) · fresh ${v.fresh} · age ${v.observationAgeMs?.toFixed(0) ?? '—'} ms${v.simulated ? ' · SIMULATED' : ''}`
        : 'service vision: null (stale or none)',
      v ? `head yaw ${m(v.headYawDeg, 1, '°')} pitch ${m(v.headPitchDeg, 1, '°')} roll ${m(v.headRollDeg, 1, '°')}` : '',
      v ? `head-facing score (heuristic) ${m(v.headFacingScore, 2)} · head away ${m(v.headAwayMs, 0, ' ms')}` : '',
      v ? `tracking quality (heuristic) ${m(v.trackingQuality, 2)} · eyes closed ${m(v.eyesClosed)} ${m(v.eyesClosedMs, 0, ' ms')}` : '',
      s?.policy ? `service policy ${s.policy.visionAdaptation} · hold ${s.policy.holdNewInstructions} (${s.policy.holdReason ?? '—'})` : '',
      s?.gameplay
        ? `service gameplay: task ${s.gameplay.currentTaskId ?? '—'} · answers ${s.gameplay.answersTotal} · inactivity ${m(s.gameplay.inactivityMs, 0, ' ms')}` +
          `${s.gameplay.paused ? ' · paused' : ''}${s.gameplay.expectedIdle ? ' · expected idle' : ''}`
        : '',
      s?.engagement ? `engagement (heuristic, not used) ${m(s.engagement)}` : '',
      '',
      `gestures (heuristic; never answers): ${this.gestures.map((g) => g.type).join(', ') || '—'}`,
      '',
      'adaptations (newest first):',
      ...[...this.records].slice(-8).reverse().map(
        (r) => `#${r.seq} ${r.action} [${r.source}] → ${r.decision}${r.reason ? ` (${r.reason})` : ''}${r.deferredMs > 150 ? ` after ${r.deferredMs} ms` : ''}`
      ),
      '',
      JSON.stringify(this.diagnostics(), null, 1)
    ]
    this.devPre.textContent = lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
  }

  private syncDevTimer(): void {
    const want = this.devDetails.open && !this.panel.hidden
    if (want && this.devTimer === null) this.devTimer = setInterval(() => this.renderDev(), 500)
    if (!want && this.devTimer !== null) {
      clearInterval(this.devTimer)
      this.devTimer = null
    }
    if (want) this.renderDev()
  }

  private togglePanel(): void {
    this.panel.hidden = !this.panel.hidden
    this.dock.querySelector('.chip')!.setAttribute('aria-expanded', String(!this.panel.hidden))
    this.syncDevTimer()
  }

  /** Shows the panel (with preview) — used while setting up, so calibration can be seen. */
  expand(): void {
    if (this.panel.hidden) this.togglePanel()
  }

  private setPreview(on: boolean): void {
    this.previewOn = on
    writePref(PREF_PREVIEW, on)
    this.view.classList.toggle('collapsed', !on)
    this.previewButton.textContent = on ? 'Hide preview' : 'Show preview'
  }

  /** Clicks here must not reach the game's document handlers (pointer lock, resume). */
  private stopEvents(el: HTMLElement): void {
    for (const kind of ['click', 'mousedown', 'pointerdown', 'keydown'] as const) {
      el.addEventListener(kind, (e) => e.stopPropagation())
    }
  }
}
