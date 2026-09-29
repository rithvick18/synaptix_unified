/**
 * The caregiver editor: a full-screen, keyboard- and touch-friendly layer for the suite
 * settings stored in the profile's `suite` field.
 *
 * Everything shown in a session from here is exactly what the caregiver typed or
 * uploaded. Nothing is recognised from photographs, nothing is filled in, and empty
 * fields stay empty. The microphone is requested only when a "Record" button is pressed.
 * Saving goes through the existing profileStore; Cancel discards; closing releases every
 * object URL, recording and audio element.
 */
import { TOPICS } from '../contracts'
import type { AssetDef, CaregiverAudio, CaregiverPrompt, EnvironmentPreset, LoadedContentPack, OpenCaregiverSetup, Placement, SequenceRef, SuitePhoto, SuiteSound } from '../contracts'
import { newId, newProfile, profileErrors, profileStore, type LocalProfile } from '../../LocalProfile'
import { importPhoto } from '../../PhotoMedia'
import { DepthError, estimateDepth, releaseDepthWorker } from '../memoryRoom/depthClient'
import { resolveUnder } from '../paths'
import { EDITOR_CSS, ROOT_ID } from './editorStyle'
import { clock, DurationMeter, Recorder } from './media'
import { envKey, normaliseSuite, objectPromptKey, SUITE_LIMITS, suiteOf, validateAudioFile, validatePhotoFile } from './model'

type Vars = Record<string, string | number>
type SectionName = 'profile' | 'language' | 'place' | 'mode' | 'topics' | 'objects' | 'photos' | 'sounds' | 'sequence'
const SECTIONS: SectionName[] = ['profile', 'language', 'place', 'mode', 'topics', 'objects', 'photos', 'sounds', 'sequence']
/** Caregiver setup is for the caregiver's own content. Choosing among the built-in demo places, and
 *  relabelling their objects, is not offered here; a place saved earlier is left as it was. */
const HIDDEN_SECTIONS: readonly SectionName[] = ['place', 'objects']
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.m4a,.mp4,.wav,.ogg,.oga,.opus,.webm'

export const openCaregiverSetup: OpenCaregiverSetup = (options) => {
  const { i18n, library, maxTextureSize } = options
  const base: LocalProfile = options.profile ?? newProfile()
  const isNew = !options.profile
  const suite = suiteOf(options.profile) // a fresh, normalised copy; the stored profile is untouched
  let name = base.name
  let dirty = false
  let busy = false
  let closed = false
  let confirmingDiscard = false
  let seq = 0
  const blobUrls = new Map<Blob, string>()
  const broken = new Set<string>()
  const recorders = new Set<Recorder>()
  const meter = new DurationMeter()
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const packs = options.packs.filter(p => !p.problems.some(x => x.severity === 'error'))

  const t = (key: string, vars?: Vars) => i18n.t(`setup.${key}`, vars)
  const c = (key: string, vars?: Vars) => i18n.t(`common.${key}`, vars)
  const uid = (p: string) => `scs-${p}-${++seq}`
  const changed = () => { dirty = true }
  const urlFor = (blob: Blob) => {
    let url = blobUrls.get(blob)
    if (!url) { url = URL.createObjectURL(blob); blobUrls.set(blob, url) }
    return url
  }

  // ---------------------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------------------
  function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue
      if (k === 'class') e.className = String(v)
      else if (k === 'text') e.textContent = String(v)
      else e.setAttribute(k, v === true ? '' : v)
    }
    e.append(...children)
    return e
  }
  function button(parent: Element, text: string, action: () => void, extra: { key?: string; label?: string; kind?: 'primary' | 'danger'; disabled?: boolean } = {}) {
    const b = h('button', { type: 'button', class: extra.kind ? `scs-${extra.kind}` : undefined, 'data-key': extra.key, 'aria-label': extra.label, text })
    b.disabled = !!extra.disabled
    b.addEventListener('click', action)
    parent.append(b)
    return b
  }
  function hint(parent: Element, text: string): string {
    const id = uid('hint'); parent.append(h('p', { class: 'scs-hint', id, text })); return id
  }
  function textField(parent: Element, o: { label: string; value: string; key: string; hint?: string; multiline?: boolean; max: number; placeholder?: string; required?: boolean; lang?: string; onInput: (v: string) => void }) {
    const wrap = h('div', { class: 'scs-field' })
    const id = uid('f')
    wrap.append(h('label', { for: id, text: o.required ? `${o.label} (${t('required')})` : o.label }))
    const input = o.multiline ? h('textarea', { id, rows: '3' }) : h('input', { id, type: 'text' })
    input.value = o.value
    input.maxLength = o.max
    input.dataset.key = o.key
    if (o.placeholder) input.placeholder = o.placeholder
    if (o.required) input.required = true
    input.autocomplete = 'off'
    input.addEventListener('input', () => { o.onInput(input.value); changed() })
    wrap.append(input)
    if (o.hint) input.setAttribute('aria-describedby', hint(wrap, o.hint))
    parent.append(wrap)
    return input
  }
  function selectField(parent: Element, o: { label: string; value: string; key: string; hint?: string; options: { value: string; label: string; group?: string }[]; onChange: (v: string) => void }) {
    const wrap = h('div', { class: 'scs-field' })
    const id = uid('s')
    wrap.append(h('label', { for: id, text: o.label }))
    const select = h('select', { id, 'data-key': o.key })
    const groups = new Map<string, HTMLOptGroupElement>()
    for (const opt of o.options) {
      const option = h('option', { value: opt.value, text: opt.label })
      if (opt.group) {
        let g = groups.get(opt.group)
        if (!g) { g = h('optgroup', { label: opt.group }); groups.set(opt.group, g); select.append(g) }
        g.append(option)
      } else select.append(option)
    }
    select.value = o.value
    select.addEventListener('change', () => { o.onChange(select.value); changed() })
    wrap.append(select)
    if (o.hint) select.setAttribute('aria-describedby', hint(wrap, o.hint))
    parent.append(wrap)
    return select
  }
  function checkField(parent: Element, o: { label: string; checked: boolean; key: string; hint?: string; onChange: (v: boolean) => void }) {
    const wrap = h('div', { class: 'scs-field' })
    const input = h('input', { type: 'checkbox', 'data-key': o.key })
    input.checked = o.checked
    input.addEventListener('change', () => { o.onChange(input.checked); changed() })
    wrap.append(h('label', { class: 'scs-check' }, input, o.label))
    if (o.hint) input.setAttribute('aria-describedby', hint(wrap, o.hint))
    parent.append(wrap)
    return input
  }
  function filePicker(parent: Element, o: { text: string; accept: string; multiple?: boolean; key: string; label?: string; onFiles: (files: File[]) => void }) {
    const input = h('input', { type: 'file', accept: o.accept, hidden: true, tabindex: '-1', 'aria-hidden': 'true' })
    input.multiple = !!o.multiple
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])]
      input.value = ''
      if (files.length) o.onFiles(files)
    })
    parent.append(input)
    return button(parent, o.text, () => { if (!busy) input.click() }, { key: o.key, label: o.label })
  }
  /** Stops any audio in a subtree before it is replaced, so nothing keeps playing detached. */
  function clear(container: Element) {
    container.querySelectorAll('audio').forEach(a => { a.pause(); a.removeAttribute('src'); a.load() })
    container.replaceChildren()
  }
  function image(o: { blob?: Blob; src?: string; alt: string; cls: string; brokenKey?: string; onBroken?: () => void }) {
    // Not lazy: a stored photo that cannot be decoded must be reported even while off-screen.
    const img = h('img', { class: o.cls, alt: o.alt, decoding: 'async' })
    img.addEventListener('error', () => {
      if (o.brokenKey) { broken.add(o.brokenKey); refreshErrors() }
      o.onBroken?.()
    })
    img.src = o.blob ? urlFor(o.blob) : o.src ?? ''
    return img
  }
  function audioPreview(parent: Element, audio: CaregiverAudio, brokenKey: string, label: string) {
    const el = h('audio', { controls: true, preload: 'metadata', 'aria-label': label })
    const problem = h('p', { class: 'scs-problem', role: 'status' })
    el.addEventListener('error', () => { problem.textContent = c('media.notPlayed'); broken.add(brokenKey); refreshErrors() })
    el.src = urlFor(audio.blob)
    parent.append(el, problem)
    if (audio.durationMs > 0) parent.append(h('p', { class: 'scs-hint', text: t('sounds.duration', { time: clock(audio.durationMs) }) }))
  }

  // ---------------------------------------------------------------------------------------
  // Media intake
  // ---------------------------------------------------------------------------------------
  async function audioFrom(file: Blob & { name?: string }): Promise<CaregiverAudio | string> {
    const first = validateAudioFile(file)
    if (!first.ok) return i18n.t(first.key, first.vars)
    let durationMs: number
    try { durationMs = await meter.measure(file) } catch { return c('media.decodeFailed') }
    const second = validateAudioFile(file, durationMs)
    if (!second.ok) return i18n.t(second.key, second.vars)
    return { blob: file.type === first.mime ? file : new Blob([file], { type: first.mime }), mime: first.mime, durationMs }
  }
  function recordControl(parent: Element, label: string, key: string, onAudio: (audio: CaregiverAudio) => void) {
    const wrap = h('div', { class: 'scs-record' })
    const time = h('p', { class: 'scs-hint', 'aria-hidden': 'true' })
    const message = h('p', { class: 'scs-hint', role: 'status' })
    let recorder: Recorder | null = null
    const press = async () => {
      if (recorder?.active) { recorder.stop(); return }
      if ([...recorders].some(r => r.active)) { message.textContent = t('record.oneAtATime'); return }
      message.textContent = ''
      const r = new Recorder(); recorder = r; recorders.add(r)
      const started = await r.start()
      if (!started.ok) {
        recorders.delete(r); recorder = null
        message.textContent = c(started.reason === 'denied' ? 'media.micUnavailable' : 'media.micUnsupported')
        return
      }
      if (closed) { r.cancel(); return }
      btn.textContent = t('record.stop')
      message.textContent = t('record.started')
      const ticker = setInterval(() => { time.textContent = t('record.elapsed', { time: clock(performance.now() - r.startedAt) }) }, 500)
      const blob = await started.result
      clearInterval(ticker)
      recorders.delete(r); recorder = null
      if (closed) return
      btn.textContent = label; time.textContent = ''
      if (!blob) { message.textContent = t('record.nothing'); return }
      message.textContent = t('record.processing')
      const audio = await audioFrom(blob)
      if (typeof audio === 'string') { message.textContent = audio; return }
      message.textContent = t('record.added')
      changed()
      onAudio(audio)
    }
    const btn = button(wrap, label, () => { void press() }, { key })
    btn.setAttribute('aria-describedby', hint(wrap, t('record.hint')))
    wrap.append(time, message)
    parent.append(wrap)
  }

  // ---------------------------------------------------------------------------------------
  // Packs, environments, objects
  // ---------------------------------------------------------------------------------------
  const currentPack = () => packs.find(p => p.meta.id === suite.packId)
  const currentEnv = () => currentPack()?.environments.find(e => e.id === suite.environmentId)
  const assetOf = (pack: LoadedContentPack, placement: Placement): AssetDef | undefined =>
    pack.assets.find(a => a.id === placement.asset) ?? library.get(placement.asset)
  const assetThumb = (pack: LoadedContentPack, asset: AssetDef | undefined) => {
    if (!asset?.thumbnail) return undefined
    return pack.assets.some(a => a.id === asset.id) ? library.url(asset.thumbnail, pack.baseUrl) : library.url(asset.thumbnail)
  }
  const defaultLabel = (pack: LoadedContentPack, placement: Placement) => i18n.text(placement.label ?? assetOf(pack, placement)?.label, placement.id)
  const defaultDescription = (pack: LoadedContentPack, placement: Placement) => i18n.text(placement.description ?? assetOf(pack, placement)?.description, '')
  const overrideOf = (pack: LoadedContentPack, env: EnvironmentPreset, placementId: string) => suite.objects[envKey(pack.meta.id, env.id)]?.[placementId]
  const objectLabel = (pack: LoadedContentPack, env: EnvironmentPreset, placement: Placement) =>
    overrideOf(pack, env, placement.id)?.label?.trim() || defaultLabel(pack, placement)
  const photoSurfaces = () => {
    const pack = currentPack(), env = currentEnv()
    if (!pack || !env) return []
    return env.placements.filter(p => assetOf(pack, p)?.photoSurface).map(p => ({ id: p.id, label: objectLabel(pack, env, p) }))
  }
  const findObject = (id: string) => {
    const [envId, placementId] = id.split('/')
    for (const pack of [currentPack(), ...packs].filter((p): p is LoadedContentPack => !!p)) {
      const env = pack.environments.find(e => e.id === envId)
      const placement = env?.placements.find(p => p.id === placementId)
      if (env && placement) return { pack, env, placement }
    }
    return undefined
  }

  // ---------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------
  const dialog = h('dialog', { id: ROOT_ID, 'aria-labelledby': `${ROOT_ID}-title`, 'aria-describedby': `${ROOT_ID}-intro` })
  const style = h('style', { text: EDITOR_CSS })
  const title = h('h2', { id: `${ROOT_ID}-title`, tabindex: '-1' })
  const intro = h('p', { id: `${ROOT_ID}-intro` })
  const header = h('header', { class: 'scs-header' }, h('div', { class: 'scs-inner' }, title, intro))
  const inner = h('div', { class: 'scs-inner' })
  const main = h('div', { class: 'scs-main' }, inner)
  const errors = h('ul', { class: 'scs-errors', role: 'alert' })
  const status = h('p', { class: 'scs-status', role: 'status', 'aria-live': 'polite' })
  const actions = h('div', { class: 'scs-actions' })
  const footer = h('footer', { class: 'scs-footer' }, h('div', { class: 'scs-inner' }, errors, status, actions))
  dialog.append(style, h('div', { class: 'scs-frame' }, header, main, footer))
  const sections = Object.fromEntries(SECTIONS.map(n => [n, h('section', { class: 'scs-section', 'aria-labelledby': `${ROOT_ID}-${n}` })])) as Record<SectionName, HTMLElement>
  const explanation = h('div', { class: 'scs-note' })
  inner.append(explanation, ...SECTIONS.filter(n => !HIDDEN_SECTIONS.includes(n)).map(n => sections[n]))

  let validationShown = false
  function setErrors(list: string[]) {
    errors.replaceChildren(...list.map(text => h('li', { text })))
  }
  function refreshErrors() {
    const v = validate()
    setErrors(validationShown ? [...v.blocking, ...v.notices] : v.notices)
  }
  function setBusy(on: boolean) {
    busy = on
    dialog.setAttribute('aria-busy', String(on))
    actions.querySelectorAll('button').forEach(b => { b.disabled = on })
  }

  function heading(section: SectionName, text: string) {
    const el = h('h3', { id: `${ROOT_ID}-${section}`, text })
    sections[section].append(el)
    return el
  }

  // ---------------------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------------------
  const renderers: Record<SectionName, () => void> = {
    profile() {
      const s = sections.profile
      heading('profile', t('profile.title'))
      if (isNew) s.append(h('p', { text: t('profile.newProfile') }))
      textField(s, { label: t('profile.name'), value: name, key: 'profile-name', hint: t('profile.nameHint'), max: SUITE_LIMITS.text.name, required: true,
        onInput: v => { name = v } })
      s.append(h('p', { class: 'scs-hint', text: t('profile.homePhotos') }))
    },

    language() {
      const s = sections.language
      heading('language', t('language.title'))
      const describe = (code: string) => {
        const info = i18n.info(code)
        return t('language.status', { status: c(`translation.${info.translation}`) })
      }
      const statusLine = h('p', { class: 'scs-hint', text: describe(suite.language) })
      selectField(s, {
        label: t('language.preferred'), value: suite.language, key: 'language', hint: t('language.preferredHint'),
        options: i18n.languages.map(l => ({ value: l.code, label: l.nativeName === l.name ? l.name : `${l.nativeName} (${l.name})` })),
        onChange: v => { suite.language = v; statusLine.textContent = describe(v) }
      })
      s.append(statusLine)
    },

    place() {
      const s = sections.place
      heading('place', t('place.title'))
      s.append(h('p', { text: t('place.intro') }))
      if (suite.packId && !currentPack()) s.append(h('p', { class: 'scs-problem', text: t('place.savedUnavailable') }))
      const radioName = uid('env')
      const option = (value: string, label: string, detail?: string, thumb?: string) => {
        const input = h('input', { type: 'radio', name: radioName, value, 'data-key': `env-${value}` })
        input.checked = value === (suite.packId && suite.environmentId ? `${suite.packId}/${suite.environmentId}` : '')
        input.addEventListener('change', () => {
          if (!input.checked) return
          const [packId, envId] = value ? value.split('/') : [null, null]
          suite.packId = packId; suite.environmentId = envId; changed()
          rerender(['objects', 'photos', 'sequence'])
        })
        const body = h('span', { class: 'scs-option-body' }, h('strong', { text: label }))
        if (detail) body.append(h('span', { class: 'scs-hint', text: detail }))
        if (thumb !== undefined) {
          if (thumb) {
            const empty = h('span', { class: 'scs-thumb scs-thumb-empty', text: t('place.noThumbnail'), hidden: true })
            const img: HTMLImageElement = image({ src: thumb, alt: '', cls: 'scs-thumb', onBroken: () => { img.hidden = true; empty.hidden = false } })
            body.append(img, empty)
          } else body.append(h('span', { class: 'scs-thumb scs-thumb-empty', text: t('place.noThumbnail') }))
        }
        return h('label', { class: 'scs-option' }, input, body)
      }
      const none = h('fieldset', {}, h('legend', { class: 'scs-sr', text: t('place.title') }))
      none.append(option('', t('place.noPreference')))
      s.append(none)
      if (!packs.length) { s.append(h('p', { text: t('place.noPacks') })); return }
      const group = (title: string, list: LoadedContentPack[], note?: string) => {
        if (!list.length) return
        s.append(h('h4', { text: title }))
        if (note) s.append(h('p', { class: 'scs-hint', text: note }))
        for (const pack of list) {
          const fs = h('fieldset', {}, h('legend', { text: i18n.text(pack.meta.name, pack.meta.id) }))
          fs.append(h('p', { class: 'scs-hint', text: i18n.text(pack.meta.description) }))
          if (pack.meta.regional || pack.meta.status === 'preview') fs.append(h('p', { class: 'scs-hint', text: i18n.text(pack.meta.coverageNote) }))
          if (pack.meta.status === 'preview') fs.append(h('p', { class: 'scs-problem', text: t('place.preview') }))
          const grid = h('div', { class: 'scs-grid' })
          for (const env of pack.environments.filter((e) => e.shell.startsWith('photo'))) {
            grid.append(option(`${pack.meta.id}/${env.id}`, i18n.text(env.name, env.id), i18n.text(env.description),
              env.thumbnail ? resolveUnder(pack.baseUrl, env.thumbnail) : ''))
          }
          fs.append(grid)
          s.append(fs)
        }
      }
      group(t('place.everyday'), packs.filter(p => !p.meta.regional && p.environments.some(e => e.shell.startsWith('photo'))))
      group(t('place.regional'), packs.filter(p => p.meta.regional && p.environments.some(e => e.shell.startsWith('photo'))), t('place.regionalNote'))
    },

    mode() {
      const s = sections.mode
      heading('mode', t('mode.title'))
      const fs = h('fieldset', {}, h('legend', { text: t('mode.choose') }))
      const radioName = uid('mode')
      for (const mode of ['open', 'guided'] as const) {
        const input = h('input', { type: 'radio', name: radioName, value: mode, 'data-key': `mode-${mode}` })
        input.checked = suite.mode === mode
        input.addEventListener('change', () => { if (input.checked) { suite.mode = mode; changed() } })
        fs.append(h('label', { class: 'scs-option' }, input, h('span', { class: 'scs-option-body' },
          h('strong', { text: t(`mode.${mode}`) }), h('span', { class: 'scs-hint', text: t(`mode.${mode}Hint`) }))))
      }
      s.append(fs)
      checkField(s, { label: t('mode.assist'), checked: suite.caregiverAssist, key: 'assist', hint: t('mode.assistHint'), onChange: v => { suite.caregiverAssist = v } })
    },

    topics() {
      const s = sections.topics
      heading('topics', t('topics.title'))
      s.append(h('p', { text: t('topics.intro') }))
      for (const list of ['include', 'avoid'] as const) {
        const labelId = uid('topics')
        s.append(h('h4', { id: labelId, text: t(`topics.${list}`) }))
        const chips = h('div', { class: 'scs-chips', role: 'group', 'aria-labelledby': labelId })
        for (const topic of TOPICS) {
          const pressed = suite.topics[list].includes(topic)
          const b = button(chips, c(`topics.${topic}`), () => {
            const other = list === 'include' ? 'avoid' : 'include'
            if (suite.topics[list].includes(topic)) suite.topics[list] = suite.topics[list].filter(x => x !== topic)
            else { suite.topics[list] = [...suite.topics[list], topic]; suite.topics[other] = suite.topics[other].filter(x => x !== topic) }
            changed()
            rerender(['topics'], `topic-${list}-${topic}`)
          }, { key: `topic-${list}-${topic}` })
          b.setAttribute('aria-pressed', String(pressed))
        }
        s.append(chips)
      }
    },

    objects() {
      const s = sections.objects
      heading('objects', t('objects.title'))
      const pack = currentPack(), env = currentEnv()
      if (!pack || !env) { s.append(h('p', { text: t('objects.choosePlace') })); return }
      s.append(h('p', { text: t('objects.intro') }))
      s.append(h('p', { class: 'scs-hint', text: t('objects.count', { count: env.placements.length }) }))
      const key = envKey(pack.meta.id, env.id)
      for (const placement of env.placements) {
        const asset = assetOf(pack, placement)
        const label = defaultLabel(pack, placement)
        const current = () => suite.objects[key]?.[placement.id] ?? {}
        const edit = (patch: { label?: string; description?: string; hidden?: boolean }) => {
          const table = (suite.objects[key] ??= {})
          const next = { ...current(), ...patch }
          if (!next.label) delete next.label
          if (!next.description) delete next.description
          if (!next.hidden) delete next.hidden
          if (Object.keys(next).length) table[placement.id] = next
          else delete table[placement.id]
          badges()
          // Sequence choices and labels depend on hidden state and names.
          rerender(['sequence'])
        }
        const details = h('details', { class: 'scs-object' })
        const summaryText = h('span', { text: current().label?.trim() || label })
        const badgeBox = h('span')
        const badges = () => {
          const o = current()
          summaryText.textContent = o.label?.trim() || label
          badgeBox.replaceChildren(
            ...(o.hidden ? [h('span', { class: 'scs-badge', text: t('objects.hidden') })] : []),
            ...(o.label || o.description || suite.objectPrompts[objectPromptKey(pack.meta.id, env.id, placement.id)] ? [h('span', { class: 'scs-badge', text: t('objects.edited') })] : []))
        }
        const thumb = assetThumb(pack, asset)
        const summary = h('summary', { 'data-key': `object-${placement.id}` })
        if (thumb) summary.append(image({ src: thumb, alt: '', cls: 'scs-mini', onBroken: () => undefined }))
        summary.append(summaryText, badgeBox)
        details.append(summary)
        const body = h('div')
        checkField(body, { label: t('objects.hide'), checked: !!current().hidden, key: `object-hide-${placement.id}`, onChange: v => edit({ hidden: v }) })
        const avoided = (asset?.tags?.topics ?? []).filter(x => suite.topics.avoid.includes(x))
        if (avoided.length) body.append(h('p', { class: 'scs-hint', text: t('objects.avoidedByTopic', { topics: avoided.map(x => c(`topics.${x}`)).join(', ') }) }))
        textField(body, { label: t('objects.label'), value: current().label ?? '', key: `object-label-${placement.id}`, max: SUITE_LIMITS.text.label,
          hint: t('objects.labelHint', { default: label }), onInput: v => edit({ label: v }) })
        const description = defaultDescription(pack, placement)
        textField(body, { label: t('objects.description'), value: current().description ?? '', key: `object-desc-${placement.id}`, max: SUITE_LIMITS.text.description, multiline: true,
          hint: description ? t('objects.descriptionHint', { default: description }) : t('objects.descriptionHintNone'), onInput: v => edit({ description: v }) })
        const promptKey = objectPromptKey(pack.meta.id, env.id, placement.id)
        promptEditor(body, `object-${placement.id}`, () => suite.objectPrompts[promptKey], p => {
          if (p) suite.objectPrompts[promptKey] = p; else delete suite.objectPrompts[promptKey]
          badges()
        })
        details.append(body)
        badges()
        s.append(details)
      }
    },

    photos() {
      const s = sections.photos
      heading('photos', t('photos.title'))
      s.append(h('p', { text: t('photos.intro', { maxMb: Math.round(SUITE_LIMITS.photoBytes / 1048576), max: SUITE_LIMITS.maxPhotos }) }))
      s.append(h('p', { class: 'scs-hint', text: t('photos.peopleHint') }))
      const problems = h('ul', { class: 'scs-errors', role: 'status' })
      const bar = h('div', { class: 'scs-actions' })
      filePicker(bar, { text: t('photos.add'), accept: PHOTO_ACCEPT, multiple: true, key: 'photos-add', onFiles: files => { void addPhotos(files) } })
      bar.append(h('span', { class: 'scs-hint', text: t('photos.count', { count: suite.photos.length, max: SUITE_LIMITS.maxPhotos }) }))
      s.append(bar, problems)
      if (!suite.photos.length) { s.append(h('p', { text: t('photos.empty') })); return }
      const grid = h('div', { class: 'scs-grid' })
      suite.photos.forEach((photo, index) => grid.append(photoCard(photo, index)))
      s.append(grid)
    },

    sounds() {
      const s = sections.sounds
      heading('sounds', t('sounds.title'))
      s.append(h('p', { text: t('sounds.intro', { maxMb: Math.round(SUITE_LIMITS.audioBytes / 1048576), maxMin: Math.round(SUITE_LIMITS.audioMs / 60000), max: SUITE_LIMITS.maxSounds }) }))
      const problems = h('ul', { class: 'scs-errors', role: 'status' })
      const bar = h('div', { class: 'scs-actions' })
      filePicker(bar, { text: t('sounds.add'), accept: AUDIO_ACCEPT, multiple: true, key: 'sounds-add', onFiles: files => { void addSounds(files) } })
      s.append(bar)
      if (suite.sounds.length < SUITE_LIMITS.maxSounds) {
        recordControl(s, t('sounds.record'), 'sounds-record', audio => {
          const sound: SuiteSound = { id: newId(), title: '', kind: 'voice-message', audio }
          suite.sounds.push(sound)
          rerender(['sounds', 'sequence'], `sound-title-${sound.id}`)
        })
      }
      s.append(h('p', { class: 'scs-hint', text: t('sounds.count', { count: suite.sounds.length, max: SUITE_LIMITS.maxSounds }) }), problems)
      if (!suite.sounds.length) { s.append(h('p', { text: t('sounds.empty') })); return }
      const grid = h('div', { class: 'scs-grid' })
      suite.sounds.forEach((sound, index) => grid.append(soundCard(sound, index)))
      s.append(grid)
    },

    sequence() {
      const s = sections.sequence
      heading('sequence', t('sequence.title'))
      s.append(h('p', { text: t('sequence.intro') }))
      const labelOf = (ref: SequenceRef): string => {
        if (ref.kind === 'photo') {
          const i = suite.photos.findIndex(p => p.id === ref.id)
          return i < 0 ? t('sequence.missing') : t('sequence.photo', { name: suite.photos[i].caption.trim() || t('photos.item', { n: i + 1 }) })
        }
        if (ref.kind === 'sound') {
          const i = suite.sounds.findIndex(p => p.id === ref.id)
          return i < 0 ? t('sequence.missing') : t('sequence.sound', { name: suite.sounds[i].title.trim() || t('sounds.item', { n: i + 1 }) })
        }
        const found = findObject(ref.id)
        if (!found) return t('sequence.missing')
        const label = t('sequence.object', { name: objectLabel(found.pack, found.env, found.placement) })
        return found.env.id === suite.environmentId && found.pack.meta.id === suite.packId ? label : t('sequence.otherPlace', { name: label })
      }
      if (!suite.sequence.length) s.append(h('p', { text: t('sequence.empty') }))
      else {
        const list = h('ol', { class: 'scs-sequence' })
        const total = suite.sequence.length
        suite.sequence.forEach((ref, index) => {
          const label = labelOf(ref)
          const li = h('li', {}, h('span', { class: 'scs-seq-num', 'aria-hidden': 'true', text: `${index + 1}.` }), h('span', { class: 'scs-seq-label', text: label }))
          const move = (to: number) => {
            const [item] = suite.sequence.splice(index, 1); suite.sequence.splice(to, 0, item); changed()
            rerender(['sequence'], `seq-${to < index ? 'up' : 'down'}-${to}`)
          }
          const where = { n: index + 1, total, name: label }
          button(li, t('sequence.up'), () => move(index - 1), { key: `seq-up-${index}`, label: t('sequence.upLabel', where), disabled: index === 0 })
          button(li, t('sequence.down'), () => move(index + 1), { key: `seq-down-${index}`, label: t('sequence.downLabel', where), disabled: index === total - 1 })
          button(li, c('actions.remove'), () => {
            suite.sequence.splice(index, 1); changed()
            rerender(['sequence'], suite.sequence.length ? `seq-remove-${Math.min(index, suite.sequence.length - 1)}` : 'seq-add')
          }, { key: `seq-remove-${index}`, label: t('sequence.removeLabel', where), kind: 'danger' })
          list.append(li)
        })
        s.append(list)
      }
      // Choices: everything not already in the sequence.
      const inSequence = new Set(suite.sequence.map(r => `${r.kind}:${r.id}`))
      const choices: { value: string; label: string; group: string }[] = []
      suite.photos.forEach((p, i) => choices.push({ value: `photo:${p.id}`, label: p.caption.trim() || t('photos.item', { n: i + 1 }), group: t('sequence.groupPhotos') }))
      const pack = currentPack(), env = currentEnv()
      if (pack && env) for (const placement of env.placements) {
        if (overrideOf(pack, env, placement.id)?.hidden) continue
        choices.push({ value: `object:${env.id}/${placement.id}`, label: objectLabel(pack, env, placement), group: t('sequence.groupObjects') })
      }
      suite.sounds.forEach((snd, i) => choices.push({ value: `sound:${snd.id}`, label: snd.title.trim() || t('sounds.item', { n: i + 1 }), group: t('sequence.groupSounds') }))
      const available = choices.filter(ch => !inSequence.has(ch.value))
      if (!available.length) { s.append(h('p', { class: 'scs-hint', text: t('sequence.nothingToAdd') })); return }
      const row = h('div', { class: 'scs-row' })
      let chosen = ''
      selectField(row, { label: t('sequence.choose'), value: '', key: 'seq-choice', options: [{ value: '', label: t('sequence.choosePlaceholder') }, ...available], onChange: v => { chosen = v } })
      button(row, t('sequence.add'), () => {
        if (!chosen) return
        const at = chosen.indexOf(':')
        suite.sequence.push({ kind: chosen.slice(0, at) as SequenceRef['kind'], id: chosen.slice(at + 1) }); changed()
        rerender(['sequence'], 'seq-choice')
      }, { key: 'seq-add' })
      s.append(row)
    }
  }

  // ---------------------------------------------------------------------------------------
  // Photo and sound cards
  // ---------------------------------------------------------------------------------------
  /** "Make explorable": works out a depth map on this device so the photo can be stepped into. */
  function depthControls(card: HTMLElement, photo: SuitePhoto, where: { n: number; total: number }) {
    const box = h('div', { class: 'scs-field' }, h('p', { class: 'scs-hint', text: t('photos.depthHint') }))
    const note = h('p', { class: 'scs-hint', role: 'status', text: photo.depth ? t('photos.depthHas') : '' })
    const bar = h('div', { class: 'scs-actions' })
    if (!photo.depth) {
      button(bar, t('photos.depthMake'), () => {
        void run(async () => {
          note.textContent = t('photos.depthWorking')
          try {
            const depth = await estimateDepth(photo.photo.runtime)
            if (closed) return
            photo.depth = depth; changed()
            rerender(['photos'], `photo-depth-remove-${photo.id}`)
            status.textContent = t('photos.depthReady')
          } catch (error) {
            note.textContent = t(error instanceof DepthError ? { 'not-installed': 'photos.depthNotInstalled', unsupported: 'photos.depthUnsupported', failed: 'photos.depthFailed' }[error.reason] : 'photos.depthFailed')
          }
        })
      }, { key: `photo-depth-make-${photo.id}`, label: t('photos.depthMakeLabel', where) })
    } else {
      button(bar, t('photos.depthRemove'), () => {
        delete photo.depth; changed()
        rerender(['photos'], `photo-depth-make-${photo.id}`)
      }, { key: `photo-depth-remove-${photo.id}`, label: t('photos.depthRemoveLabel', where) })
    }
    box.append(note, bar)
    card.append(box)
  }

  function photoCard(photo: SuitePhoto, index: number): HTMLElement {
    const headingId = uid('photo')
    const card = h('article', { class: 'scs-card', 'aria-labelledby': headingId })
    const itemName = t('photos.item', { n: index + 1 })
    card.append(h('h4', { id: headingId, text: itemName }))
    const problem = h('p', { class: 'scs-problem', role: 'status' })
    card.append(image({ blob: photo.photo.thumbnail, alt: photo.caption.trim() ? t('photos.thumbAltCaption', { caption: photo.caption }) : itemName, cls: 'scs-thumb',
      brokenKey: `photo:${photo.id}`, onBroken: () => { problem.textContent = c('media.notShown') } }), problem)
    if (photo.photo.width && photo.photo.height) card.append(h('p', { class: 'scs-hint', text: t('photos.size', { width: String(photo.photo.width), height: String(photo.photo.height) }) }))
    textField(card, { label: t('photos.caption'), value: photo.caption, key: `photo-caption-${photo.id}`, max: SUITE_LIMITS.text.caption, multiline: true, hint: t('photos.captionHint'),
      onInput: v => { photo.caption = v } })

    const people = h('fieldset', {}, h('legend', { text: t('photos.people') }))
    const drawPeople = (focusKey?: string) => {
      people.replaceChildren(h('legend', { text: t('photos.people') }))
      if (!photo.people.length) people.append(h('p', { class: 'scs-hint', text: t('photos.noPeople') }))
      photo.people.forEach((person, i) => {
        const row = h('div', { class: 'scs-row' })
        textField(row, { label: t('photos.personName', { n: i + 1 }), value: person.name, key: `photo-person-name-${photo.id}-${i}`, max: SUITE_LIMITS.text.person, onInput: v => { person.name = v } })
        textField(row, { label: t('photos.relationship', { n: i + 1 }), value: person.relationship, key: `photo-person-rel-${photo.id}-${i}`, max: SUITE_LIMITS.text.person, onInput: v => { person.relationship = v } })
        button(row, c('actions.remove'), () => {
          photo.people.splice(i, 1); changed()
          drawPeople(photo.people.length ? `photo-person-name-${photo.id}-${Math.min(i, photo.people.length - 1)}` : `photo-person-add-${photo.id}`)
        }, { key: `photo-person-remove-${photo.id}-${i}`, label: t('photos.removePerson', { n: i + 1 }), kind: 'danger' })
        people.append(row)
      })
      button(people, t('photos.addPerson'), () => {
        photo.people.push({ name: '', relationship: '' }); changed()
        drawPeople(`photo-person-name-${photo.id}-${photo.people.length - 1}`)
      }, { key: `photo-person-add-${photo.id}` })
      if (focusKey) people.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)?.focus()
    }
    drawPeople()
    card.append(people)

    promptEditor(card, `photo-${photo.id}`, () => photo.prompt, p => { if (p) photo.prompt = p; else delete photo.prompt })

    // Choosing a frame only makes sense once a place has been chosen, and that is not offered here.
    if (currentPack()) {
      const surfaces = photoSurfaces()
      const surfaceOptions = [{ value: '', label: t('photos.surfaceAny') }, ...surfaces.map(x => ({ value: x.id, label: x.label }))]
      if (photo.surface && !surfaces.some(x => x.id === photo.surface)) surfaceOptions.push({ value: photo.surface, label: t('photos.surfaceOther') })
      selectField(card, { label: t('photos.surface'), value: photo.surface ?? '', key: `photo-surface-${photo.id}`, options: surfaceOptions,
        hint: surfaces.length ? t('photos.surfaceHint') : t('photos.surfaceNone'),
        onChange: v => { if (v) photo.surface = v; else delete photo.surface } })
    }

    const where = { n: index + 1, total: suite.photos.length }
    depthControls(card, photo, where)

    const bar = h('div', { class: 'scs-actions' })
    const total = suite.photos.length
    const move = (to: number) => {
      const [item] = suite.photos.splice(index, 1); suite.photos.splice(to, 0, item); changed()
      rerender(['photos', 'sequence'], `photo-${to < index ? 'up' : 'down'}-${item.id}`)
    }
    button(bar, t('photos.up'), () => move(index - 1), { key: `photo-up-${photo.id}`, label: t('photos.upLabel', where), disabled: index === 0 })
    button(bar, t('photos.down'), () => move(index + 1), { key: `photo-down-${photo.id}`, label: t('photos.downLabel', where), disabled: index === total - 1 })
    filePicker(bar, { text: c('actions.replace'), accept: PHOTO_ACCEPT, key: `photo-replace-${photo.id}`, label: t('photos.replaceLabel', where), onFiles: ([file]) => {
      void run(async () => {
        const check = validatePhotoFile(file)
        if (!check.ok) { problem.textContent = i18n.t(check.key, check.vars); return }
        try {
          photo.photo = await importPhoto(file, base.quality, maxTextureSize, photo.photo)
          delete photo.depth // it described the old picture
          broken.delete(`photo:${photo.id}`); changed()
          rerender(['photos'], `photo-replace-${photo.id}`)
        } catch { problem.textContent = c('media.decodeFailed') }
      })
    } })
    button(bar, c('actions.remove'), () => {
      suite.photos.splice(index, 1)
      suite.sequence = suite.sequence.filter(r => !(r.kind === 'photo' && r.id === photo.id))
      broken.delete(`photo:${photo.id}`); changed(); refreshErrors()
      const next = suite.photos[Math.min(index, suite.photos.length - 1)]
      rerender(['photos', 'sequence'], next ? `photo-caption-${next.id}` : 'photos-add')
    }, { key: `photo-remove-${photo.id}`, label: t('photos.removeLabel', where), kind: 'danger' })
    card.append(bar)
    return card
  }

  function soundCard(sound: SuiteSound, index: number): HTMLElement {
    const headingId = uid('sound')
    const card = h('article', { class: 'scs-card', 'aria-labelledby': headingId })
    const itemName = t('sounds.item', { n: index + 1 })
    card.append(h('h4', { id: headingId, text: itemName }))
    audioPreview(card, sound.audio, `sound:${sound.id}`, sound.title.trim() || itemName)
    textField(card, { label: t('sounds.name'), value: sound.title, key: `sound-title-${sound.id}`, max: SUITE_LIMITS.text.title, required: true, onInput: v => { sound.title = v } })
    selectField(card, { label: t('sounds.kind'), value: sound.kind, key: `sound-kind-${sound.id}`,
      options: [{ value: 'familiar-sound', label: t('sounds.familiar') }, { value: 'voice-message', label: t('sounds.voice') }],
      onChange: v => { sound.kind = v === 'voice-message' ? 'voice-message' : 'familiar-sound' } })
    promptEditor(card, `sound-${sound.id}`, () => sound.prompt, p => { if (p) sound.prompt = p; else delete sound.prompt })
    const problem = h('p', { class: 'scs-problem', role: 'status' })
    const bar = h('div', { class: 'scs-actions' })
    const where = { n: index + 1, total: suite.sounds.length }
    filePicker(bar, { text: c('actions.replace'), accept: AUDIO_ACCEPT, key: `sound-replace-${sound.id}`, label: t('sounds.replaceLabel', where), onFiles: ([file]) => {
      void run(async () => {
        const audio = await audioFrom(file)
        if (typeof audio === 'string') { problem.textContent = audio; return }
        sound.audio = audio; broken.delete(`sound:${sound.id}`); changed(); refreshErrors()
        rerender(['sounds'], `sound-replace-${sound.id}`)
      })
    } })
    button(bar, c('actions.remove'), () => {
      suite.sounds.splice(index, 1)
      suite.sequence = suite.sequence.filter(r => !(r.kind === 'sound' && r.id === sound.id))
      broken.delete(`sound:${sound.id}`); changed(); refreshErrors()
      const next = suite.sounds[Math.min(index, suite.sounds.length - 1)]
      rerender(['sounds', 'sequence'], next ? `sound-title-${next.id}` : 'sounds-add')
    }, { key: `sound-remove-${sound.id}`, label: t('sounds.removeLabel', where), kind: 'danger' })
    card.append(problem, bar)
    return card
  }

  /** A caregiver prompt: text, the language it is written in, and an optional recording. */
  function promptEditor(parent: Element, key: string, get: () => CaregiverPrompt | undefined, set: (p: CaregiverPrompt | undefined) => void) {
    const fs = h('fieldset')
    parent.append(fs)
    const draft: CaregiverPrompt = get() ? { ...get()! } : { text: '', lang: suite.language }
    const commit = () => set(draft.text.trim() || draft.audio ? { ...draft } : undefined)
    const draw = (focusKey?: string) => {
      clear(fs)
      fs.append(h('legend', { text: t('prompt.title') }))
      textField(fs, { label: t('prompt.text'), value: draft.text, key: `prompt-text-${key}`, max: SUITE_LIMITS.text.prompt, multiline: true, hint: t('prompt.hint'),
        onInput: v => { draft.text = v; commit() } })
      if (i18n.languages.length > 1) {
        selectField(fs, { label: t('prompt.lang'), value: draft.lang, key: `prompt-lang-${key}`, hint: t('prompt.langHint'),
          options: i18n.languages.map(l => ({ value: l.code, label: l.nativeName === l.name ? l.name : `${l.nativeName} (${l.name})` })),
          onChange: v => { draft.lang = v; commit() } })
      }
      if (draft.audio) {
        fs.append(h('p', { class: 'scs-hint', text: t('prompt.hasRecording') }))
        audioPreview(fs, draft.audio, `prompt:${key}`, t('prompt.recordingLabel'))
        button(fs, t('prompt.removeRecording'), () => { delete draft.audio; broken.delete(`prompt:${key}`); commit(); changed(); refreshErrors(); draw(`prompt-record-${key}`) }, { key: `prompt-remove-${key}`, kind: 'danger' })
      } else {
        recordControl(fs, t('prompt.record'), `prompt-record-${key}`, audio => { draft.audio = audio; commit(); draw(`prompt-remove-${key}`) })
        const problem = h('p', { class: 'scs-problem', role: 'status' })
        filePicker(fs, { text: t('prompt.upload'), accept: AUDIO_ACCEPT, key: `prompt-upload-${key}`, onFiles: ([file]) => {
          void run(async () => {
            const audio = await audioFrom(file)
            if (typeof audio === 'string') { problem.textContent = audio; return }
            draft.audio = audio; commit(); changed(); draw(`prompt-remove-${key}`)
          })
        } })
        fs.append(problem)
      }
      if (focusKey) fs.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)?.focus()
    }
    draw()
  }

  // ---------------------------------------------------------------------------------------
  // Adding media
  // ---------------------------------------------------------------------------------------
  async function run(work: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await work() } finally { if (!closed) setBusy(false) }
  }
  function addPhotos(files: File[]) {
    return run(async () => {
      const messages: string[] = []
      let firstNew: string | undefined
      for (const [i, file] of files.entries()) {
        if (closed) return
        if (suite.photos.length >= SUITE_LIMITS.maxPhotos) { messages.push(c('media.tooManyPhotos', { max: SUITE_LIMITS.maxPhotos })); break }
        status.textContent = t('photos.adding', { done: i + 1, total: files.length })
        const check = validatePhotoFile(file)
        if (!check.ok) { messages.push(t('fileProblem', { file: file.name, message: i18n.t(check.key, check.vars) })); continue }
        try {
          const photo = await importPhoto(file, base.quality, maxTextureSize)
          const entry: SuitePhoto = { id: newId(), photo, caption: '', people: [] }
          suite.photos.push(entry); changed()
          firstNew ??= entry.id
        } catch { messages.push(t('fileProblem', { file: file.name, message: c('media.decodeFailed') })) }
      }
      if (closed) return
      rerender(['photos', 'sequence'], firstNew ? `photo-caption-${firstNew}` : 'photos-add')
      sections.photos.querySelector('.scs-errors')?.replaceChildren(...messages.map(text => h('li', { text })))
      status.textContent = firstNew ? t('photos.added') : ''
    })
  }
  function addSounds(files: File[]) {
    return run(async () => {
      const messages: string[] = []
      let firstNew: string | undefined
      for (const [i, file] of files.entries()) {
        if (closed) return
        if (suite.sounds.length >= SUITE_LIMITS.maxSounds) { messages.push(c('media.tooManySounds', { max: SUITE_LIMITS.maxSounds })); break }
        status.textContent = t('sounds.adding', { done: i + 1, total: files.length })
        const audio = await audioFrom(file)
        if (typeof audio === 'string') { messages.push(t('fileProblem', { file: file.name, message: audio })); continue }
        const sound: SuiteSound = { id: newId(), title: '', kind: 'familiar-sound', audio }
        suite.sounds.push(sound); changed()
        firstNew ??= sound.id
      }
      if (closed) return
      rerender(['sounds', 'sequence'], firstNew ? `sound-title-${firstNew}` : 'sounds-add')
      sections.sounds.querySelector('.scs-errors')?.replaceChildren(...messages.map(text => h('li', { text })))
      status.textContent = firstNew ? t('sounds.added') : ''
    })
  }

  // ---------------------------------------------------------------------------------------
  // Validation, save, close
  // ---------------------------------------------------------------------------------------
  /** Blocking problems stop a save; notices (media that could not be shown) do not:
   *  such items are kept until the caregiver replaces or removes them. */
  function validate(): { blocking: string[]; notices: string[]; focus?: string } {
    const blocking: string[] = []
    let focus: string | undefined
    if (!name.trim()) { blocking.push(t('validation.needsName')); focus = 'profile-name' }
    suite.sounds.forEach((s, i) => {
      if (s.title.trim()) return
      blocking.push(t('validation.soundTitle', { n: i + 1 })); focus ??= `sound-title-${s.id}`
    })
    return { blocking, notices: broken.size ? [t('validation.brokenMedia', { count: broken.size })] : [], focus }
  }

  async function save() {
    if (busy) return
    validationShown = true
    const check = validate()
    setErrors([...check.blocking, ...check.notices])
    if (check.blocking.length) {
      if (check.focus) dialog.querySelector<HTMLElement>(`[data-key="${CSS.escape(check.focus)}"]`)?.focus()
      return
    }
    setBusy(true)
    status.textContent = t('actions.saving')
    try {
      let stored: LocalProfile | undefined
      try { stored = (await profileStore.read()).profile } catch { stored = undefined }
      if (stored && stored.id !== base.id) { setErrors([t('validation.conflict')]); return }
      // The freshest stored profile keeps any Personalise Home edits made meanwhile.
      const result: LocalProfile = { ...(stored ?? base), name: name.trim(), suite: normaliseSuite(suite) }
      const homeProblems = profileErrors(result)
      if (homeProblems.length) { setErrors([t('validation.homeProfile'), ...homeProblems]); return }
      try { await profileStore.save(result) } catch { setErrors([c('media.storageFailed')]); return }
      dirty = false
      status.textContent = t('actions.saved')
      try { options.onSaved(result) } catch (error) { console.warn('[suite profile] onSaved failed', error) }
      close()
    } finally {
      if (!closed) { setBusy(false); if (status.textContent === t('actions.saving')) status.textContent = '' }
    }
  }

  function requestCancel() {
    if (busy && !confirmingDiscard) return
    if (!dirty) { close(); return }
    confirmingDiscard = true
    drawActions()
  }

  function drawActions() {
    actions.replaceChildren()
    if (confirmingDiscard) {
      actions.append(h('p', { class: 'scs-problem', text: t('actions.discardTitle') }))
      const keep = button(actions, t('actions.keepEditing'), () => { confirmingDiscard = false; drawActions(); actions.querySelector<HTMLElement>('[data-key="cancel"]')?.focus() }, { key: 'keep' })
      button(actions, t('actions.discard'), () => { dirty = false; close() }, { key: 'discard', kind: 'danger' })
      keep.focus()
      return
    }
    button(actions, t('actions.save'), () => { void save() }, { key: 'save', kind: 'primary' })
    button(actions, t('actions.cancel'), requestCancel, { key: 'cancel' })
  }

  function close() {
    if (closed) return
    closed = true
    releaseDepthWorker()
    for (const r of recorders) r.cancel()
    recorders.clear()
    meter.close()
    unsubscribe()
    clear(dialog)
    for (const url of blobUrls.values()) URL.revokeObjectURL(url)
    blobUrls.clear()
    if (dialog.open) dialog.close()
    dialog.remove()
    if (previousFocus?.isConnected) previousFocus.focus()
    options.onClose()
  }

  // ---------------------------------------------------------------------------------------
  // Rendering and language
  // ---------------------------------------------------------------------------------------
  function rerender(names: SectionName[], focusKey?: string) {
    const active = document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement) ? document.activeElement : null
    const key = focusKey ?? active?.dataset.key
    for (const n of names) { if (HIDDEN_SECTIONS.includes(n)) continue; clear(sections[n]); renderers[n]() }
    if (key && (focusKey || !active?.isConnected)) dialog.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus()
  }
  function applyLanguage() {
    const info = i18n.info()
    dialog.lang = info.code
    dialog.dir = info.dir
    dialog.style.fontFamily = info.fontFamily
    title.textContent = t('title')
    intro.textContent = t('intro')
    explanation.replaceChildren(h('p', { text: t('noInference') }), h('p', { text: c('privacy') }), h('p', { class: 'scs-hint', text: c('disclaimer') }))
    if (info.translation === 'machine-generated-needs-review') explanation.append(h('p', { class: 'scs-hint', text: c('translation.machine-generated-needs-review') }))
    drawActions()
    rerender(SECTIONS)
    refreshErrors()
  }
  const unsubscribe = i18n.onChange(() => { if (!closed) applyLanguage() })

  dialog.addEventListener('cancel', e => { e.preventDefault(); requestCancel() })
  // Keep keys and clicks from reaching the game underneath.
  let modal = false
  dialog.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && !modal) requestCancel() })
  dialog.addEventListener('keyup', e => e.stopPropagation())
  dialog.addEventListener('click', e => e.stopPropagation())
  dialog.addEventListener('pointerdown', e => e.stopPropagation())

  applyLanguage()
  options.root.append(dialog)
  try { dialog.showModal(); modal = true } catch { dialog.setAttribute('open', '') }
  title.focus()
}
