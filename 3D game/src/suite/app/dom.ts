/** Small DOM helpers for the suite's screens. Text is always set as text, never as HTML. */

type Child = Node | string | number | null | undefined | false
type AttrValue = string | number | boolean | null | undefined | ((event: never) => void)

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (typeof value === 'function') {
      el.addEventListener(name.replace(/^on/, '').toLowerCase(), value as EventListener)
    } else if (name === 'class') {
      el.className = String(value)
    } else if (name === 'text') {
      el.textContent = String(value)
    } else if (value === true) {
      el.setAttribute(name, '')
    } else {
      el.setAttribute(name, String(value))
    }
  }
  append(el, children)
  return el
}

export function append(el: Element, children: (Child | Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    el.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child)
  }
}

export function button(label: string, onClick: () => void, attrs: Record<string, AttrValue> = {}): HTMLButtonElement {
  return h('button', { type: 'button', ...attrs, onclick: (e: MouseEvent) => { e.stopPropagation(); onClick() } }, label)
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab inside `root` while it is open. Returns the remover. */
export function trapFocus(root: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  root.addEventListener('keydown', onKey)
  return () => root.removeEventListener('keydown', onKey)
}

export function focusFirst(root: HTMLElement): void {
  const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE)
  target?.focus({ preventScroll: true })
}

/** Is the element a text entry field? */
export function isTyping(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(type)
  }
  return (el as HTMLElement).isContentEditable === true
}

export function isControl(el: Element | null): boolean {
  if (!el) return false
  return ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(el.tagName) || el.getAttribute('role') === 'button'
}
