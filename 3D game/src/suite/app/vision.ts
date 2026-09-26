/**
 * The summary's separate camera block. It describes how the camera's tracking behaved
 * during a session and what the timing support did — never the person. Pure.
 */
import type { SessionEvent, VisionSessionNote } from '../contracts'

export interface VisionSample {
  /** Camera support was on at this second. */
  on: boolean
  /** The snapshot's `visionUsable` flag. */
  usable: boolean
}

export interface AdaptationLike {
  action: string
  decision: 'applied' | 'rejected'
  decidedAt: number
}

/** Collects about one sample per second while a session runs (pauses excluded). */
export class VisionSampler {
  readonly samples: VisionSample[] = []
  private acc = 0

  constructor(private readonly intervalS = 1) {}

  /** Advance by `dt` seconds; calls `read` whenever a sample is due. */
  tick(dt: number, read: () => VisionSample): void {
    this.acc += dt
    if (this.acc < this.intervalS) return
    this.acc %= this.intervalS
    try {
      this.samples.push(read())
    } catch {
      /* a missing camera port is simply "not sampled" */
    }
  }
}

/**
 * The vision note, or null when the camera was never on during the session.
 * `window` is on the same clock as `AdaptationRecord.decidedAt` (performance.now()).
 */
export function computeVisionNote(input: {
  samples: readonly VisionSample[]
  records: readonly AdaptationLike[]
  window: { start: number; end: number }
  log: readonly SessionEvent[]
  label: string
}): VisionSessionNote | null {
  const on = input.samples.filter((s) => s.on)
  if (on.length === 0) return null
  const usable = on.filter((s) => s.usable).length
  const held = input.records.filter(
    (r) => r.action === 'delay_instruction' && r.decision === 'applied' && r.decidedAt >= input.window.start && r.decidedAt <= input.window.end
  ).length
  return {
    label: input.label,
    gentleCuesShown: input.log.filter((e) => e.kind === 'gentle_cue').length,
    promptSpeechHeld: held,
    trackingAvailableShare: on.length > 0 ? usable / on.length : null,
    samples: on.length
  }
}
