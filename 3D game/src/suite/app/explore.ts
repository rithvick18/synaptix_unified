/**
 * The Explore screen's DOM: the activity panel (side panel from 768 px, bottom sheet
 * below), the object strip, the caregiver panel, and the photo close-up lightbox.
 *
 * Elements are built once and updated in place, so the aria-live prompt and cue regions
 * announce changes and keyboard focus is never lost to a re-render.
 */
import type { ActivityItem, DisplayPhoto } from '../contracts'
import type { Prepared, Run, SuiteController } from './app'
import { append, button, clear, h, trapFocus } from './dom'

type ActionName = 'replay' | 'previous' | 'next' | 'skip' | 'closeup' | 'sound' | 'pause' | 'exit' | 'assist'

export class ExploreView {
  readonly el: HTMLElement
  private readonly panel: HTMLElement
  private readonly kicker: HTMLElement
  private readonly title: HTMLElement
  private readonly badge: HTMLElement
  private readonly prompt: HTMLElement
  private readonly promptHidden: HTMLElement
  private readonly cue: HTMLElement
  private readonly freeHint: HTMLElement
  private readonly notice: HTMLElement
  private readonly caption: HTMLElement
  private readonly info: HTMLElement
  private readonly buttons: Record<ActionName, HTMLButtonElement>
  private readonly strip: HTMLUListElement
  private readonly stripTitle: HTMLElement
  private readonly caregiver: HTMLElement
  private readonly moveHint: HTMLElement
  private readonly cameraLine: HTMLElement
  private readonly navPad: HTMLElement
  private readonly chatInput: HTMLTextAreaElement
  private readonly chatTitle: HTMLElement
  private readonly chatStatus: HTMLElement
  private readonly chatReply: HTMLElement
  private readonly chatListen: HTMLButtonElement
  private readonly chatSetup: HTMLButtonElement
  private chatBusy = false
  private recorder: MediaRecorder | null = null
  private recordingStream: MediaStream | null = null
  private recordingChunks: BlobPart[] = []
  private recordingTimer: ReturnType<typeof setTimeout> | null = null
  private readonly chatHistory: { role: 'user' | 'assistant'; text: string }[] = []
  private chatPhotoId = ''
  private readonly navButtons: { button: HTMLButtonElement; labelKey: string }[] = []
  private stripButtons = new Map<string, HTMLButtonElement>()
  private itemButtons = new Map<string, HTMLButtonElement>()
  private lightbox: Lightbox | null = null
  private infoKey = ''

  constructor(
    private readonly c: SuiteController,
    private readonly run: Run,
    private readonly prep: Prepared
  ) {
    this.kicker = h('p', { class: 's-muted s-small' })
    this.title = h('h2', { id: 's-item-title', tabindex: -1 })
    this.badge = h('span', { class: 's-badge' })
    this.prompt = h('p', { class: 's-prompt', 'aria-live': 'polite' })
    this.promptHidden = h('p', { class: 's-muted s-small' })
    this.cue = h('p', { class: 's-cue', 'aria-live': 'polite' })
    this.freeHint = h('p', { class: 's-muted' })
    this.notice = h('p', { class: 's-notice s-small' })
    this.caption = h('p', { class: 's-small' })
    this.info = h('div', { class: 's-card' })
    const act = (name: ActionName, fn: () => void, primary = false): HTMLButtonElement =>
      button('', fn, { 'data-k': `act-${name}`, class: primary ? 's-primary' : undefined })
    this.buttons = {
      replay: act('replay', () => c.replay(), true),
      previous: act('previous', () => c.previous()),
      next: act('next', () => c.next()),
      skip: act('skip', () => c.skip()),
      closeup: act('closeup', () => c.openCloseup()),
      sound: act('sound', () => c.toggleSound()),
      pause: act('pause', () => c.togglePause()),
      exit: act('exit', () => c.askExit()),
      assist: act('assist', () => c.updateSettings({ caregiverAssist: !run.assist }))
    }
    this.stripTitle = h('h3', { id: 's-objects-title' })
    this.strip = h('ul', { class: 's-strip', 'data-object-list': true, 'aria-labelledby': 's-objects-title' })
    this.caregiver = h('section', { class: 's-caregiver', 'aria-labelledby': 's-cg-title' })
    this.moveHint = h('p', { class: 's-muted s-small' })
    this.cameraLine = h('p', { class: 's-muted s-small', 'data-camera-line': 'hide-off', role: 'status' })
    this.chatInput = h('textarea', { rows: 2, 'data-k': 'chat-input', placeholder: c.t('app.explore.chat.placeholder') })
    this.chatTitle = h('h3', { id: 's-chat-title', text: c.t('app.explore.chat.title') })
    this.chatStatus = h('p', { class: 's-muted s-small', role: 'status', 'aria-live': 'polite' })
    this.chatReply = h('p', { class: 's-chat-reply', 'aria-live': 'polite' })
    this.chatListen = button(c.t('app.explore.chat.listen'), () => this.startListening(), { 'data-k': 'chat-listen' })
    const chatAsk = button(c.t('app.explore.chat.ask'), () => { void this.sendChat() }, { class: 's-primary', 'data-k': 'chat-ask' })
    this.chatSetup = button(c.t('app.explore.chat.setup'), () => c.openAiSetup(), { 'data-k': 'chat-setup' })
    const chat = h('section', { class: 's-chat', 'aria-labelledby': 's-chat-title' },
      this.chatTitle,
      h('p', { class: 's-muted s-small', text: c.t('app.explore.chat.hint') }),
      this.chatInput, h('div', { class: 's-row' }, this.chatListen, chatAsk, this.chatSetup), this.chatStatus, this.chatReply)

    const directionButton = (labelKey: string, symbol: string, move: { x: number; z: number }): HTMLButtonElement => {
      const b = button(symbol, () => undefined, { class: 's-nav-key', 'aria-label': c.t(labelKey), 'data-k': `nav-${labelKey.split('.').at(-1)}` })
      this.navButtons.push({ button: b, labelKey })
      const start = (e: PointerEvent): void => {
        e.preventDefault()
        b.setPointerCapture?.(e.pointerId)
        c.setTouchMove(move)
      }
      const stop = (e: PointerEvent): void => {
        if (b.hasPointerCapture?.(e.pointerId)) b.releasePointerCapture(e.pointerId)
        c.setTouchMove(null)
      }
      b.addEventListener('pointerdown', start)
      b.addEventListener('pointerup', stop)
      b.addEventListener('pointercancel', stop)
      b.addEventListener('lostpointercapture', () => c.setTouchMove(null))
      return b
    }
    const forward = directionButton('app.explore.moveForward', '↑', { x: 0, z: 1 })
    const backward = directionButton('app.explore.moveBackward', '↓', { x: 0, z: -1 })
    const left = directionButton('app.explore.moveLeft', '←', { x: -1, z: 0 })
    const right = directionButton('app.explore.moveRight', '→', { x: 1, z: 0 })
    this.navPad = h('div', { class: 's-navpad', role: 'group', 'aria-label': c.t('app.explore.moveControls') },
      h('div', { class: 's-navpad-row s-navpad-top' }, forward),
      h('div', { class: 's-navpad-row' }, left, backward, right))

    const body = h('div', { class: 's-panel-body' },
      h('header', { class: 's-row' }, h('div', { style: 'flex: 1 1 12em; min-width: 0' }, this.kicker, this.title), this.badge),
      this.prompt, this.promptHidden, this.cue, this.freeHint, this.notice, this.caption,
      h('div', { class: 's-actions' }, this.buttons.replay, this.buttons.previous, this.buttons.next, this.buttons.skip,
        this.buttons.closeup, this.buttons.sound),
      this.info,
      chat,
      h('section', { class: 's-objects' }, this.stripTitle, this.strip, this.moveHint),
      this.caregiver,
      h('div', { class: 's-row' }, this.buttons.assist),
      this.cameraLine)
    const foot = h('div', { class: 's-panel-foot' }, this.buttons.pause, this.buttons.exit)
    this.panel = h('aside', { class: 's-panel', 'aria-labelledby': 's-item-title' }, body, foot)
    this.el = h('div', { class: 's-explore-root' }, this.panel,
      h('div', { class: 's-navigation-tools' },
        h('div', { class: 's-nav-toggle', role: 'group', 'aria-label': c.t('app.explore.navigationMode') },
          button(c.t('app.explore.seatedMode'), () => c.updateSettings({ navigation: 'seated' }), { class: 's-nav-choice', 'data-k': 'nav-seated' }),
          button(c.t('app.explore.walkMode'), () => c.updateSettings({ navigation: 'walk' }), { class: 's-nav-choice', 'data-k': 'nav-walk' })), this.navPad))
    this.rebuild()
  }

  get lightboxOpen(): boolean {
    return this.lightbox !== null
  }

  focusTitle(): void {
    this.title.focus({ preventScroll: true })
  }

  focusAction(name: ActionName): void {
    const b = this.buttons[name]
    if (b && !b.hidden && !b.disabled) b.focus()
    else this.focusTitle()
  }

  focusCloseup(): void {
    this.info.querySelector<HTMLElement>('button')?.focus()
  }

  /** Rebuilds the parts that depend on language or object labels, then updates. */
  rebuild(): void {
    const c = this.c
    this.stripTitle.textContent = c.t('app.explore.objects')
    clear(this.strip)
    this.stripButtons.clear()
    for (const obj of this.prep.scene.objects) {
      if (!obj.object.visible) continue
      const b = button(obj.label, () => c.selectObject(obj.id), { 'data-k': `obj-${obj.id}`, 'data-object-id': obj.id })
      b.addEventListener('focus', () => c.setFocusedObject(obj))
      b.addEventListener('blur', () => { if (c.focusedObject === obj) c.setFocusedObject(null) })
      b.addEventListener('pointerenter', () => c.setFocusedObject(obj))
      b.addEventListener('pointerleave', () => { if (document.activeElement !== b && c.focusedObject === obj) c.setFocusedObject(null) })
      this.stripButtons.set(obj.id, b)
      this.strip.append(h('li', {}, b))
    }
    this.buildCaregiver()
    this.infoKey = ''
    this.update()
  }

  private buildCaregiver(): void {
    const c = this.c
    const run = this.run
    clear(this.caregiver)
    this.itemButtons.clear()
    const status = h('p', { class: 's-muted s-small', role: 'status' })
    const notes = h('textarea', { id: 's-note', 'data-k': 'note', rows: 3, placeholder: c.t('app.explore.caregiver.notePlaceholder') })
    notes.value = run.noteDraft
    notes.addEventListener('input', () => { run.noteDraft = notes.value })
    const add = button(c.t('app.explore.caregiver.addNote'), () => {
      if (c.addNote(notes.value)) {
        notes.value = ''
        status.textContent = c.t('app.explore.caregiver.noteAdded')
      }
    }, { 'data-k': 'add-note' })
    const items = h('ul', { class: 's-items' })
    for (const item of run.session.items) {
      const b = button(itemLabel(c, item), () => c.goToItem(item.id), { 'data-k': `item-${item.id}` })
      this.itemButtons.set(item.id, b)
      items.append(h('li', {}, b))
    }
    append(this.caregiver, [
      h('h3', { id: 's-cg-title', text: c.t('app.explore.caregiver.title') }),
      h('p', { class: 's-muted s-small', text: c.t('app.explore.caregiver.tip') }),
      h('label', { for: 's-note', text: c.t('app.explore.caregiver.notes') }),
      notes,
      h('div', { class: 's-row' }, add),
      status,
      run.session.items.length ? h('h3', { text: c.t('app.explore.caregiver.items') }) : null,
      run.session.items.length ? items : null])
  }

  update(): void {
    const c = this.c
    const run = this.run
    const s = run.session
    const cur = s.current
    const t = (k: string, v?: Record<string, string | number>): string => c.t(k, v)
    const def = c.deps.ACTIVITIES[run.kind]
    const roomContext = !!this.prep.scene.roomContextImageUrl
    this.chatTitle.textContent = t(roomContext ? 'app.explore.chat.roomTitle' : 'app.explore.chat.title')
    this.chatInput.placeholder = t(roomContext ? 'app.explore.chat.roomPlaceholder' : 'app.explore.chat.placeholder')

    this.kicker.textContent = def ? t(def.nameKey) : ''
    const focusObj = run.objectCloseup ?? (cur ? c.objectForItem(cur) : null) ?? run.selected
    this.title.textContent = cur?.title ?? run.selected?.label ?? t('app.explore.freeTitle')

    if (cur) {
      const kind = cur.personal ? 'personal' : c.profileMode === 'demo' ? 'demo' : 'general'
      this.badge.hidden = false
      this.badge.className = `s-badge ${kind === 'personal' ? 's-personal' : 's-demo'}`
      this.badge.textContent = t(`app.badge.${kind}`)
    } else this.badge.hidden = true

    // Prompt: always shown unless subtitles are off — and even then when it was not spoken.
    const text = cur?.prompt?.text ?? ''
    const lastVia = [...s.log].reverse().find((e) => e.kind === 'prompt_played' && e.itemId === cur?.id)
    const textOnly = lastVia?.kind === 'prompt_played' && lastVia.via === 'text-only'
    const showPrompt = !!text && (c.settings.subtitles || textOnly)
    setText(this.prompt, showPrompt ? text : '')
    this.prompt.hidden = !showPrompt
    if (cur?.prompt) {
      this.prompt.lang = cur.prompt.lang
    }
    this.promptHidden.hidden = !(text && !showPrompt)
    this.promptHidden.textContent = t('app.explore.subtitlesOff')

    const cueOn = !!cur && run.cueFor === cur.id
    setText(this.cue, cueOn ? t('app.explore.gentleCue') : '')
    this.cue.hidden = !cueOn

    this.freeHint.hidden = !!cur
    this.freeHint.textContent = t('app.explore.freeHint')

    // Notices: demo pictures, synthesized sounds.
    let notice = ''
    let caption = ''
    if (cur?.kind === 'photo') {
      if (!cur.photo.personal) notice = cur.photo.notice || t('app.explore.demoPicture')
      caption = cur.photo.caption
    } else if (cur?.kind === 'sound') {
      caption = cur.sound.description ?? ''
      if (cur.sound.synthesized) notice = t('app.explore.synthesized')
    }
    this.notice.hidden = !notice
    this.notice.textContent = notice
    this.caption.hidden = !caption
    this.caption.textContent = caption

    // Buttons
    const b = this.buttons
    const hasItems = s.items.length > 0
    b.replay.textContent = t('app.explore.replay')
    b.replay.hidden = !cur?.prompt
    b.previous.textContent = t('app.explore.previous')
    b.previous.hidden = !hasItems
    // From a free choice (index −1) the session goes back to the list; at the first item there is nothing before.
    b.previous.disabled = s.index === 0 || (s.index < 0 && !cur)
    b.next.textContent = c.isLastItem() ? t('app.explore.finish') : t('app.explore.next')
    b.next.hidden = !hasItems
    b.skip.textContent = t('app.explore.skip')
    b.skip.hidden = !hasItems || !cur
    b.closeup.textContent = t('app.explore.closeup')
    b.closeup.hidden = !c.canCloseup() || !!run.objectCloseup
    b.sound.hidden = cur?.kind !== 'sound'
    b.sound.textContent = run.audio.playing.sounds ? t('app.explore.stopSound') : t('app.explore.playSound')
    b.pause.textContent = s.paused ? t('app.explore.resume') : t('app.explore.pause')
    b.exit.textContent = t('app.explore.exit')
    b.assist.textContent = run.assist ? t('app.explore.caregiver.hide') : t('app.explore.caregiver.show')
    b.assist.setAttribute('aria-expanded', String(run.assist))
    this.caregiver.hidden = !run.assist

    // Object info: close-up, or a person's own choice outside the current item.
    const infoObj = run.objectCloseup ?? (run.selected && (!cur || focusObj === run.selected) ? run.selected : null)
    const key = infoObj ? `${infoObj.id}|${run.objectCloseup ? 'c' : 's'}|${c.i18n?.language}` : ''
    if (key !== this.infoKey) {
      this.infoKey = key
      clear(this.info)
      if (infoObj) {
        append(this.info, [
          run.objectCloseup ? h('p', { class: 's-muted s-small', text: t('app.closeup.title') }) : null,
          h('h3', { text: infoObj.label }),
          infoObj.description ? h('p', { text: infoObj.description }) : null,
          h('div', { class: 's-row' },
            run.objectCloseup
              ? button(t('app.closeup.back'), () => c.closeObjectCloseup(), { 'data-k': 'closeup-back' })
              : null,
            button(t('app.explore.backToRoom'), () => c.backToRoom(), { 'data-k': 'back-room' }))])
      }
    }
    this.info.hidden = !infoObj

    // Object strip
    for (const [id, btn] of this.stripButtons) {
      const on = focusObj?.id === id
      btn.classList.toggle('s-current', on)
      if (on) btn.setAttribute('aria-current', 'true')
      else btn.removeAttribute('aria-current')
    }
    for (const [id, btn] of this.itemButtons) {
      const on = cur?.id === id
      btn.classList.toggle('s-current', on)
      if (on) btn.setAttribute('aria-current', 'step')
      else btn.removeAttribute('aria-current')
    }
    this.moveHint.textContent = c.settings.navigation === 'walk' ? t('app.explore.walkHint') : t('app.explore.lookHint')
    const navToggle = this.el.querySelector<HTMLElement>('.s-nav-toggle')
    navToggle?.setAttribute('aria-label', t('app.explore.navigationMode'))
    const seated = navToggle?.querySelector<HTMLButtonElement>('[data-k="nav-seated"]')
    const walk = navToggle?.querySelector<HTMLButtonElement>('[data-k="nav-walk"]')
    if (seated) seated.setAttribute('aria-pressed', String(c.settings.navigation === 'seated'))
    if (walk) walk.setAttribute('aria-pressed', String(c.settings.navigation === 'walk'))
    this.navPad.setAttribute('aria-label', t('app.explore.moveControls'))
    for (const { button: b, labelKey } of this.navButtons) b.setAttribute('aria-label', t(labelKey))
    this.navPad.hidden = c.settings.navigation !== 'walk'

    const camOn = c.cameraOn()
    this.cameraLine.hidden = !camOn
    if (camOn) this.cameraLine.textContent = c.cameraLine()

    this.lightbox?.update()
  }

  moveObjectFocus(dir: 1 | -1): void {
    const list = [...this.stripButtons.values()]
    if (list.length === 0) return
    const idx = list.indexOf(document.activeElement as HTMLButtonElement)
    const next = idx < 0 ? (dir > 0 ? 0 : list.length - 1) : (idx + dir + list.length) % list.length
    list[next].focus()
    list[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: this.c.settings.reducedMotion ? 'auto' : 'smooth' })
  }

  openLightbox(photo: DisplayPhoto, item: ActivityItem): void {
    this.closeLightbox(false)
    this.lightbox = new Lightbox(this.c, photo, item)
    this.el.append(this.lightbox.el)
    this.lightbox.focus()
  }

  closeLightbox(restoreFocus: boolean): void {
    if (!this.lightbox) return
    this.lightbox.destroy()
    this.lightbox = null
    if (restoreFocus) this.focusAction('closeup')
  }

  zoomBy(factor: number): void {
    this.lightbox?.zoomBy(factor)
  }

  destroy(): void {
    this.abortRecording()
    this.closeLightbox(false)
    this.el.remove()
  }

  private startListening(): void {
    void this.startRecording()
  }

  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.chatStatus.textContent = this.c.t('app.explore.chat.noMic')
      return
    }
    if (this.recorder) {
      this.chatStatus.textContent = this.c.t('app.explore.chat.processingVoice')
      this.recorder.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.recordingStream = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      this.recorder = recorder
      this.recordingChunks = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) this.recordingChunks.push(event.data) }
      recorder.onerror = () => {
        this.chatStatus.textContent = this.c.t('app.explore.chat.micError')
        this.abortRecording()
      }
      recorder.onstop = () => {
        const blob = new Blob(this.recordingChunks, { type: recorder.mimeType || 'audio/webm' })
        this.releaseRecorder()
        if (blob.size === 0) {
          this.chatStatus.textContent = this.c.t('app.explore.chat.noSpeech')
          this.chatListen.textContent = this.c.t('app.explore.chat.listen')
          return
        }
        void this.transcribeAndSend(blob)
      }
      recorder.start()
      this.chatStatus.textContent = this.c.t('app.explore.chat.listening')
      this.chatListen.textContent = this.c.t('app.explore.chat.stopAndSend')
      this.recordingTimer = setTimeout(() => {
        if (this.recorder === recorder && recorder.state === 'recording') {
          this.chatStatus.textContent = this.c.t('app.explore.chat.voiceLimit')
          recorder.stop()
        }
      }, 30_000)
    } catch (error) {
      this.abortRecording()
      this.chatListen.textContent = this.c.t('app.explore.chat.listen')
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      this.chatStatus.textContent = denied ? this.c.t('app.explore.chat.micPermission') : this.c.t('app.explore.chat.micError')
    }
  }

  private async transcribeAndSend(audio: Blob): Promise<void> {
    if (!this.c.transcribeSpeech) {
      this.chatStatus.textContent = this.c.t('app.explore.chat.noMic')
      return
    }
    this.chatStatus.textContent = this.c.t('app.explore.chat.processingVoice')
    try {
      const lang = this.c.i18n?.language?.split('-')[0]
      const text = await this.c.transcribeSpeech(audio, lang)
      if (!text) {
        this.chatStatus.textContent = this.c.t('app.explore.chat.noSpeech')
        return
      }
      this.chatInput.value = text
      await this.sendChat()
    } catch (err) {
      this.chatStatus.textContent = err instanceof Error ? err.message : this.c.t('app.explore.chat.micError')
    }
  }

  private releaseRecorder(): void {
    if (this.recordingTimer) clearTimeout(this.recordingTimer)
    this.recordingTimer = null
    for (const track of this.recordingStream?.getTracks() ?? []) track.stop()
    this.recordingStream = null
    this.recorder = null
    this.recordingChunks = []
    this.chatListen.textContent = this.c.t('app.explore.chat.listen')
  }

  private abortRecording(): void {
    const recorder = this.recorder
    if (recorder) {
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
    }
    this.releaseRecorder()
  }

  private async sendChat(): Promise<void> {
    const question = this.chatInput.value.trim()
    if (!question || this.chatBusy) return
    const current = this.run.session.current
    const picture = current?.kind === 'photo' ? current.photo : (() => {
      const object = this.run.objectCloseup ?? this.run.selected
      return object ? this.prep.photoOnObject.get(object.id) ?? null : null
    })()
    const roomImageUrl = this.prep.scene.roomContextImageUrl
    const imageUrl = roomImageUrl ?? picture?.url
    const contextKey = roomImageUrl ?? picture?.id
    if (!imageUrl || !contextKey) {
      this.chatStatus.textContent = this.c.t('app.explore.chat.selectPicture')
      return
    }
    if (this.chatPhotoId !== contextKey) {
      this.chatPhotoId = contextKey
      this.chatHistory.length = 0
      this.chatReply.textContent = ''
    }
    this.chatBusy = true
    this.chatInput.disabled = true
    this.chatStatus.textContent = this.c.t('app.explore.chat.thinking')
    try {
      const answer = await this.c.answerAboutPicture({ imageUrl, question, history: this.chatHistory.slice(-8), imageContext: roomImageUrl ? 'room' : 'picture' })
      this.chatHistory.push({ role: 'user', text: question }, { role: 'assistant', text: answer })
      this.chatReply.textContent = answer
      this.run.audio.speakText(answer, this.c.i18n?.language ?? 'en')
      this.chatStatus.textContent = ''
      this.chatInput.value = ''
    } catch (err) {
      this.chatStatus.textContent = err instanceof Error ? err.message : this.c.t('app.explore.chat.failed')
    } finally {
      this.chatBusy = false
      this.chatInput.disabled = false
      this.chatInput.focus({ preventScroll: true })
    }
  }
}


function itemLabel(c: SuiteController, item: ActivityItem): string {
  return item.personal ? `${item.title} (${c.t('app.badge.personal')})` : item.title
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

// ---------------------------------------------------------------------------------------- lightbox

const MIN_ZOOM = 1
const MAX_ZOOM = 5

/** Photo close-up: never cropped (object-fit: contain), zoom by buttons, wheel, pinch and +/-. */
class Lightbox {
  readonly el: HTMLElement
  private readonly stage: HTMLElement
  private readonly img: HTMLImageElement
  private readonly prompt: HTMLElement
  private readonly zoomLabel: HTMLElement
  private scale = 1
  private tx = 0
  private ty = 0
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinch: { dist: number; scale: number } | null = null
  private readonly untrap: () => void

  constructor(
    private readonly c: SuiteController,
    photo: DisplayPhoto,
    private readonly item: ActivityItem
  ) {
    const t = (k: string, v?: Record<string, string | number>): string => c.t(k, v)
    this.img = h('img', { src: photo.url, alt: photo.caption ? t('app.closeup.alt', { caption: photo.caption }) : t('app.closeup.altNone'), draggable: 'false' })
    this.stage = h('div', { class: 's-lightbox-stage' }, this.img)
    this.prompt = h('p', { class: 's-prompt', 'aria-live': 'polite' })
    this.zoomLabel = h('span', { class: 's-muted s-small', 'aria-live': 'polite' })
    const people = photo.people.filter((p) => p.name.trim())
    this.el = h('div', { class: 's-lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's-lightbox-title' },
      h('div', { class: 's-lightbox-bar' },
        h('h2', { id: 's-lightbox-title', text: item.title || t('app.closeup.title') }),
        button(t('app.closeup.zoomOut'), () => this.zoomBy(1 / 1.25), { 'data-k': 'zoom-out' }),
        button(t('app.closeup.zoomIn'), () => this.zoomBy(1.25), { 'data-k': 'zoom-in' }),
        button(t('app.closeup.fit'), () => this.reset(), { 'data-k': 'zoom-fit' }),
        this.zoomLabel,
        button(t('app.closeup.close'), () => c.closeLightbox(), { 'data-k': 'closeup-close', class: 's-primary', 'data-autofocus': true })),
      this.stage,
      h('div', { class: 's-lightbox-info' },
        photo.personal ? h('span', { class: 's-badge s-personal', text: t('app.badge.personal') }) : h('p', { class: 's-notice', text: photo.notice || t('app.closeup.demoNotice') }),
        photo.caption ? h('p', { text: photo.caption }) : null,
        people.length
          ? h('div', {}, h('h3', { text: t('app.closeup.people') }),
              h('ul', {}, people.map((p) => h('li', { text: p.relationship.trim() ? t('app.closeup.person', { name: p.name, relationship: p.relationship }) : p.name }))))
          : null,
        this.prompt,
        item.prompt ? h('div', { class: 's-row' }, button(t('app.explore.replay'), () => c.replay(), { 'data-k': 'closeup-replay' })) : null))
    this.untrap = trapFocus(this.el)
    this.bind()
    this.update()
    this.apply()
  }

  focus(): void {
    this.el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }

  update(): void {
    const text = this.item.prompt?.text ?? ''
    const show = !!text && this.c.settings.subtitles
    setText(this.prompt, show ? text : '')
    this.prompt.hidden = !show
    if (this.item.prompt) this.prompt.lang = this.item.prompt.lang
  }

  zoomBy(factor: number): void {
    this.setScale(this.scale * factor)
  }

  reset(): void {
    this.scale = 1
    this.tx = this.ty = 0
    this.apply()
  }

  destroy(): void {
    this.untrap()
    this.el.remove()
  }

  private setScale(s: number): void {
    this.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s))
    this.clampPan()
    this.apply()
  }

  private clampPan(): void {
    const r = this.stage.getBoundingClientRect()
    const mx = ((this.scale - 1) * r.width) / 2
    const my = ((this.scale - 1) * r.height) / 2
    this.tx = Math.min(mx, Math.max(-mx, this.tx))
    this.ty = Math.min(my, Math.max(-my, this.ty))
  }

  private apply(): void {
    this.img.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`
    this.stage.classList.toggle('s-zoomed', this.scale > 1.001)
    this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`
  }

  private bind(): void {
    const st = this.stage
    st.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }, { passive: false })
    st.addEventListener('pointerdown', (e) => {
      st.setPointerCapture?.(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: this.scale }
      }
    })
    st.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId)
      if (!prev) return
      const next = { x: e.clientX, y: e.clientY }
      this.pointers.set(e.pointerId, next)
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()]
        this.setScale(this.pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.dist))
      } else if (this.pointers.size === 1 && this.scale > 1) {
        this.tx += next.x - prev.x
        this.ty += next.y - prev.y
        this.clampPan()
        this.apply()
      }
    })
    const up = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
    }
    st.addEventListener('pointerup', up)
    st.addEventListener('pointercancel', up)
  }
}
