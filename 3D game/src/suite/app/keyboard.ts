/**
 * The suite's keyboard map. Pure: `keyAction` decides, the app acts.
 *
 * Tab / Shift+Tab are left to the browser (they move focus through the object list and
 * the panel's buttons). Enter and Space on a focused button are the button's own click.
 */

export type KeyAction =
  | 'focus-next-object'
  | 'focus-prev-object'
  | 'select-focused'
  | 'replay'
  | 'pause-toggle'
  | 'escape'
  | 'zoom-in'
  | 'zoom-out'
  | 'walk'

export interface KeyInput {
  code: string
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

export interface KeyContext {
  screen: 'home' | 'place' | 'activity' | 'explore' | 'summary' | 'hidden'
  /** Focus is in a text field, select or contenteditable. */
  typing: boolean
  /** Focus is on a button, link or other control that handles Enter/Space itself. */
  onControl: boolean
  /** Focus is inside the object list. */
  inObjectList: boolean
  walkMode: boolean
  closeupOpen: boolean
  /** A modal of the suite's own (settings, pause, exit question) is open. */
  modalOpen: boolean
  /** A foreign editor or sheet is open (caregiver setup, camera sheet, #profile-editor). */
  blocked: boolean
}

export const WALK_CODES: ReadonlySet<string> = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
])

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function keyAction(e: KeyInput, ctx: KeyContext): KeyAction | null {
  if (ctx.blocked || ctx.screen === 'hidden') return null
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  if (e.code === 'Escape') return 'escape'
  if (ctx.typing) return null

  if (ctx.closeupOpen) {
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return 'zoom-in'
    if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') return 'zoom-out'
    if (e.code === 'Space' && !ctx.onControl) return 'replay'
    return null
  }
  if (ctx.screen !== 'explore' || ctx.modalOpen) return null

  if (e.code === 'KeyP') return 'pause-toggle'
  if (e.code === 'Space' && !ctx.onControl) return 'replay'
  if (e.code === 'Enter' && !ctx.onControl) return 'select-focused'

  if (ARROWS.has(e.code)) {
    // In walk mode the arrows walk, unless focus is in the object list.
    if (ctx.walkMode && !ctx.inObjectList) return 'walk'
    return e.code === 'ArrowRight' || e.code === 'ArrowDown' ? 'focus-next-object' : 'focus-prev-object'
  }
  if (ctx.walkMode && WALK_CODES.has(e.code)) return 'walk'
  return null
}

/** Selectors of foreign full-screen editors the suite must not steal keys from. */
export const BLOCKING_SELECTORS = ['#profile-editor', '#suite-setup', '#camera-setup:not([hidden])']

/** Is a foreign editor open? `extra` is the caregiver-setup host (open when it has children). */
export function keysBlocked(doc: Pick<Document, 'querySelector'>, extra?: Element | null): boolean {
  for (const sel of BLOCKING_SELECTORS) {
    const el = doc.querySelector(sel)
    if (!el) continue
    if (sel === '#profile-editor' && 'open' in el && (el as HTMLDialogElement).open === false) continue
    return true
  }
  return !!extra && extra.childElementCount > 0
}
