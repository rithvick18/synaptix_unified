/**
 * Browser helpers for the caregiver editor: sound duration by decoding, and microphone
 * recording. The microphone is requested only inside `Recorder.start()`, which the
 * editor calls only from an explicit "Record" button press — never on open, never to
 * probe for support.
 */
import { SUITE_LIMITS } from './model'

type AudioContextCtor = typeof AudioContext

/** Measures a sound's duration in ms by decoding it. Rejects when it cannot be decoded. */
export class DurationMeter {
  private context: AudioContext | null = null

  async measure(blob: Blob): Promise<number> {
    const Ctor: AudioContextCtor | undefined = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    if (Ctor) {
      try {
        this.context ??= new Ctor()
        const data = await blob.arrayBuffer()
        const buffer = await this.context.decodeAudioData(data)
        if (Number.isFinite(buffer.duration) && buffer.duration > 0) return Math.round(buffer.duration * 1000)
      } catch { /* fall through to the media element */ }
    }
    return mediaElementDuration(blob)
  }

  close(): void {
    void this.context?.close().catch(() => undefined)
    this.context = null
  }
}

function mediaElementDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof Audio === 'undefined') { reject(new Error('no audio element')); return }
    const audio = new Audio()
    const url = URL.createObjectURL(blob)
    const done = (ms: number | null) => {
      clearTimeout(timer); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url)
      if (ms === null) reject(new Error('undecodable')); else resolve(ms)
    }
    const timer = setTimeout(() => done(null), 15000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : null)
    audio.onerror = () => done(null)
    audio.src = url
  })
}

export type RecorderFailure = 'unsupported' | 'denied'

/** One microphone recording. Tracks are stopped as soon as recording ends. */
export class Recorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private limitTimer: ReturnType<typeof setTimeout> | undefined
  private finished: ((blob: Blob | null) => void) | null = null
  startedAt = 0

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!globalThis.navigator?.mediaDevices?.getUserMedia
  }

  get active(): boolean { return this.recorder?.state === 'recording' }

  /** Asks for the microphone (the browser shows its own prompt) and starts recording.
   *  Resolves with the recording when `stop()` is called or the time limit is reached. */
  async start(): Promise<{ ok: true; result: Promise<Blob | null> } | { ok: false; reason: RecorderFailure }> {
    if (!Recorder.supported()) return { ok: false, reason: 'unsupported' }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return { ok: false, reason: 'denied' }
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find(t => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t))
    try {
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    } catch {
      this.release()
      return { ok: false, reason: 'unsupported' }
    }
    this.chunks = []
    const result = new Promise<Blob | null>(resolve => { this.finished = resolve })
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data) }
    this.recorder.onstop = () => {
      const type = (this.recorder?.mimeType || mimeType || 'audio/webm').split(';')[0]
      const blob = this.chunks.length ? new Blob(this.chunks, { type }) : null
      this.release()
      this.finished?.(blob); this.finished = null
    }
    this.recorder.start(1000)
    this.startedAt = performance.now()
    this.limitTimer = setTimeout(() => this.stop(), SUITE_LIMITS.audioMs - 1000)
    return { ok: true, result }
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    else this.release()
  }

  /** Stops without keeping anything (the editor is closing). */
  cancel(): void {
    this.chunks = []
    this.finished?.(null); this.finished = null
    if (this.recorder && this.recorder.state !== 'inactive') { this.recorder.onstop = () => this.release(); this.recorder.stop() }
    this.release()
  }

  private release(): void {
    clearTimeout(this.limitTimer)
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}

/** m:ss */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
