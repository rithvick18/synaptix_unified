/**
 * Home, Summary screens. Plain DOM; every string from i18n.
 *
 * Home is the single master screen: who this is for, language, comfort/camera/caregiver
 * setup (collapsed), then the place picker and the activity picker right on the same
 * page. There is no separate "Choose a place" or "Choose an activity" screen to navigate
 * to — picking a place prepares it in the background so the activity list underneath is
 * usually ready by the time it scrolls into view.
 */
import type { ActivityKind, EnvironmentPreset, LoadedContentPack, SessionSummary } from '../contracts'
import { resolveUnder, suiteUrl } from '../paths'
import type { SuiteController } from './app'
import { h } from './dom'
import { splitDuration } from './summary'

const badge = (c: SuiteController, personal: boolean): HTMLElement =>
  h('span', { class: `s-badge ${personal ? 's-personal' : 's-demo'}`, text: personal ? c.t('app.badge.personal') : c.t('app.badge.demo') })

function header(c: SuiteController, titleKey: string, back: (() => void) | null, intro?: string): HTMLElement {
  return h('header', { class: 's-brand' },
    back ? h('button', { type: 'button', class: 's-back', 'data-k': 'back', onclick: back }, c.t('app.back')) : null,
    h('p', { class: 's-muted s-small', text: c.t('app.brand') }),
    h('h1', { tabindex: -1, text: c.t(titleKey) }),
    intro ? h('p', { class: 's-muted', text: intro }) : null)
}

// ---------------------------------------------------------------------------------------- Home

export function renderHome(c: SuiteController): HTMLElement {
  const i18n = c.i18n!
  const saved = c.savedProfile
  const warning = c.host.profile.storageWarning

  const who = h('section', { class: 's-card', 'aria-labelledby': 's-who' },
    h('h2', { id: 's-who', text: c.t('app.home.who.title') }),
    h('div', { class: 's-grid' },
      saved
        ? h('button', { type: 'button', class: 's-choice', 'aria-pressed': String(c.profileMode === 'saved'), 'data-k': 'profile-saved',
            onclick: () => c.setProfileMode('saved') },
            h('span', { class: 's-choice-title', text: saved.name || c.t('app.home.who.unnamed') }),
            badge(c, true),
            h('span', { class: 's-muted s-small', text: c.t('app.home.who.savedHint') }))
        : null,
      h('button', { type: 'button', class: 's-choice', 'aria-pressed': String(c.profileMode === 'demo'), 'data-k': 'profile-demo',
        onclick: () => c.setProfileMode('demo') },
        h('span', { class: 's-choice-title', text: c.t('app.home.who.demo') }),
        badge(c, false),
        h('span', { class: 's-muted s-small', text: c.t('app.home.who.demoHint') }))),
    saved ? null : h('p', { class: 's-muted', text: c.t('app.home.who.none') }),
    h('div', { class: 's-row' },
      h('button', {
        type: 'button', class: 's-primary', 'data-k': 'to-place',
        onclick: () => document.getElementById('s-place-title')?.scrollIntoView({ behavior: c.settings.reducedMotion ? 'auto' : 'smooth', block: 'start' })
      }, c.t('app.home.start'))))

  const info = i18n.info()
  const language = h('section', { class: 's-card', 'aria-labelledby': 's-lang' },
    h('h2', { id: 's-lang', text: c.t('app.home.language.title') }),
    h('div', { class: 's-row', role: 'group', 'aria-labelledby': 's-lang' },
      i18n.languages.map((l) =>
        h('button', { type: 'button', lang: l.code, dir: l.dir, 'aria-pressed': String(l.code === i18n.language), 'data-k': `lang-${l.code}`,
          style: `font-family: ${l.fontFamily}`, onclick: () => void c.setLanguage(l.code) },
          l.nativeName === l.name ? l.name : `${l.nativeName} · ${l.name}`))),
    info.translation === 'machine-generated-needs-review' ? h('p', { class: 's-notice s-small', text: c.t('app.home.language.machine') }) : null)

  // Setup and caregiver-only controls: not needed to start a session, so they stay collapsed
  // behind one disclosure rather than competing with "Who" and "Language" for attention.
  const comfort = h('section', { 'aria-labelledby': 's-comfort' },
    h('h3', { id: 's-comfort', text: c.t('app.home.comfort.title') }),
    h('p', { class: 's-muted', text: c.t('app.home.comfort.hint') }),
    h('div', { class: 's-row' },
      h('button', { type: 'button', 'data-k': 'open-settings', onclick: () => c.openSettings() }, c.t('app.home.comfort.open'))))

  const camera = h('section', { 'aria-labelledby': 's-camera' },
    h('h3', { id: 's-camera', text: c.t('app.home.camera.title') }),
    h('p', { class: 's-muted', text: c.t('app.home.camera.hint') }),
    h('p', { 'data-camera-line': 'always', role: 'status', text: c.cameraLine() }),
    h('div', { class: 's-row' },
      h('button', { type: 'button', 'data-k': 'camera', onclick: () => c.openCamera() }, c.t('app.home.camera.open'))))

  const caregiver = h('section', { 'aria-labelledby': 's-caregiver' },
    h('h3', { id: 's-caregiver', text: c.t('app.home.caregiver.title') }),
    h('p', { class: 's-muted', text: c.t('app.home.caregiver.hint') }),
    c.flash ? h('p', { class: 's-notice', role: 'status', text: c.flash }) : null,
    h('div', { class: 's-row' },
      h('button', { type: 'button', 'data-k': 'caregiver-setup', onclick: () => void c.openCaregiverSetup() }, c.t('app.home.caregiver.setup'))))

  const more = h('details', { class: 's-card s-more', 'data-k': 'more' },
    h('summary', { class: 's-more-summary' }, c.t('app.home.more.title')),
    h('div', { class: 's-more-body' },
      comfort, h('hr', { class: 's-divider' }),
      camera, h('hr', { class: 's-divider' }),
      caregiver))

  const disclaimer = c.tOr('common.disclaimer', 'app.disclaimer')
  return h('div', { class: 's-page s-home' },
    renderHero(c, disclaimer),
    who, language,
    // Kept outside the disclosure: storage state matters even before a caregiver opens setup.
    warning ? h('p', { class: 's-notice', role: 'status' }, h('strong', { text: c.t('app.home.storage') + ' ' }), h('span', { lang: 'en', text: warning })) : null,
    h('hr', { class: 's-divider' }),
    ...renderPlaceSection(c),
    more)
}

// ---------------------------------------------------------------------------------------- Hero
//
// A full-bleed "look around" preview: the suite's own panoramas dissolve slowly one into the
// next while the view drifts sideways, like turning your head in the room. Nothing flashes or
// jumps: dissolves are 1.6 s opacity transitions (CSS transitions, never animations), and
// the whole thing stops under reduced motion, on hover/focus, and once anyone picks a place.

let heroIndex = 0
let heroManual = false
const HERO_DWELL_MS = 9000

/** Full-size panorama that sits next to a place's thumbnail (thumbs/x.webp → assets/panoramas/x.webp). */
const panoramaFor = (thumb: string): string => suiteUrl(`assets/panoramas/${thumb.replace(/^.*\//, '')}`)

function renderHero(c: SuiteController, disclaimer: string): HTMLElement {
  const i18n = c.i18n!
  const shots: { pack: LoadedContentPack; env: EnvironmentPreset; thumb: string; name: string; desc: string }[] = []
  for (const pack of c.content?.ok ?? []) {
    for (const env of pack.environments) {
      if (env.shell.startsWith('photo') && env.thumbnail) {
        shots.push({ pack, env, thumb: resolveUnder(pack.baseUrl, env.thumbnail), name: i18n.text(env.name, env.id), desc: i18n.text(env.description, '') })
      }
    }
  }
  const slides = shots.slice(0, 6)
  if (heroIndex >= slides.length) heroIndex = 0
  const scrollTo = (id: string, block: ScrollLogicalPosition): void =>
    document.getElementById(id)?.scrollIntoView({ behavior: c.settings.reducedMotion ? 'auto' : 'smooth', block })

  const layers = slides.map((sh, n) => {
    const img = h('img', { class: `s-slide ${n % 2 ? 's-pan-r' : 's-pan-l'}`, alt: '', decoding: 'async', draggable: 'false' })
    img.addEventListener('error', () => { if (img.src !== sh.thumb) img.src = sh.thumb }, { once: true })
    return img
  })
  const load = (n: number): void => {
    const img = layers[n % layers.length]
    if (img && !img.getAttribute('src')) img.src = panoramaFor(slides[n % slides.length].thumb)
  }

  const capKicker = h('p', { class: 's-cap-kicker', text: c.t('app.home.nowShowing') })
  const capName = h('p', { class: 's-cap-name', 'aria-live': 'polite' })
  const capDesc = h('p', { class: 's-cap-desc' })
  const visit = h('button', { type: 'button', class: 's-ghost', 'data-k': 'hero-visit',
    onclick: () => {
      const cur = slides[heroIndex]
      if (!cur) return
      heroManual = true
      c.choose(cur.pack.meta.id, cur.env.id)
      scrollTo('s-place-title', 'start')
    } }, c.t('app.home.visitThis'))
  const reel = h('div', { class: 's-reel', role: 'group', 'aria-label': c.t('app.home.collageLabel') },
    slides.map((sh, n) => h('button', { type: 'button', class: 's-reel-item', 'data-k': `reel-${sh.pack.meta.id}-${sh.env.id}`, 'aria-label': sh.name,
      onclick: () => { heroManual = true; show(n) } }, h('img', { src: sh.thumb, alt: '', decoding: 'async', loading: 'lazy' }))))

  function show(n: number): void {
    heroIndex = n
    load(n)
    load(n + 1)
    layers.forEach((l, i) => l.classList.toggle('s-on', i === n))
    ;[...reel.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === n)))
    const cur = slides[n]
    if (cur) { capName.textContent = cur.name; capDesc.textContent = cur.desc }
  }

  const stage = h('div', { class: 's-hero-stage' },
    h('div', { class: 's-slides', 'aria-hidden': 'true' }, layers),
    h('div', { class: 's-scrim', 'aria-hidden': 'true' }),
    h('p', { class: 's-eyebrow' }, h('span', { class: 's-dot', 'aria-hidden': 'true' }), c.t('app.brand')),
    h('div', { class: 's-hero-copy' },
      h('h1', { tabindex: -1 }, c.t('app.home.tagline'), ' ', h('em', { text: c.t('app.home.taglineEm') })),
      h('p', { class: 's-lede', text: disclaimer }),
      h('div', { class: 's-hero-actions' },
        h('button', { type: 'button', class: 's-primary s-cta', 'data-k': 'hero-begin', onclick: () => scrollTo('s-who', 'center') },
          h('span', { text: c.t('app.home.begin') }), h('span', { class: 's-cta-icon', 'aria-hidden': 'true', text: '↓' })),
        slides.length ? visit : null)),
    slides.length ? h('div', { class: 's-hero-side' }, capKicker, capName, capDesc, reel) : null)

  if (slides.length) {
    show(heroIndex)
    const motionOk = !c.settings.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (motionOk && slides.length > 1) {
      let held = false
      const hold = (v: boolean) => () => { held = v }
      stage.addEventListener('pointerenter', hold(true))
      stage.addEventListener('pointerleave', hold(false))
      stage.addEventListener('focusin', hold(true))
      stage.addEventListener('focusout', hold(false))
      const timer = window.setInterval(() => {
        if (!stage.isConnected) { window.clearInterval(timer); return }
        if (!held && !heroManual && !document.hidden) show((heroIndex + 1) % slides.length)
      }, HERO_DWELL_MS)
    }
  }

  return h('header', { class: 's-hero' },
    h('div', { class: 's-hero-frame' }, stage),
    h('ol', { class: 's-steps', 'aria-hidden': 'true' },
      (['who', 'place', 'activity'] as const).map((k, n) => h('li', {}, h('b', { text: String(n + 1) }), h('span', { text: c.t(`app.home.steps.${k}`) })))))
}

// ---------------------------------------------------------------------------------------- Place + Activity
//
// Part of the Home page, not a screen of its own: picking a place prepares it in the
// background immediately, so the activity list right underneath is usually ready by the
// time it scrolls into view.

function renderPlaceSection(c: SuiteController): (HTMLElement | null)[] {
  const nodes: (HTMLElement | null)[] = [
    h('div', { class: 's-section-head' },
      h('h2', { id: 's-place-title', tabindex: -1, text: c.t('app.place.title') }),
      h('p', { class: 's-muted', text: c.t('app.place.intro') }))
  ]
  const content = c.content
  if (!content) {
    if (c.contentError) {
      nodes.push(h('div', { class: 's-card', role: 'status' },
        h('p', { text: c.t('app.place.failed') }),
        h('div', { class: 's-row' }, h('button', { type: 'button', 'data-k': 'retry', onclick: () => { c.contentError = false; c.render() } }, c.t('app.place.retry')))))
    } else {
      nodes.push(h('div', { class: 's-card s-progress', role: 'status', 'aria-live': 'polite' }, h('p', { text: c.t('app.place.loading') })))
      c.ensureContent().then(() => { if (c.screen === 'home') c.render() }, () => { if (c.screen === 'home') c.render() })
    }
    return nodes
  }
  if (!c.choice || !content.ok.some((p) => p.meta.id === c.choice!.packId && p.environments.some((e) => e.id === c.choice!.environmentId && e.shell.startsWith('photo')))) {
    c.choice = c.defaultChoice(content)
    c.rememberChoice(c.choice)
  }
  const i18n = c.i18n!
  const captured = content.ok.map((p) => ({ ...p, environments: p.environments.filter((e) => e.shell.startsWith('photo')) }))
    .filter((p) => p.environments.length > 0)
  const general = captured.filter((p) => !p.meta.regional)
  const regional = captured.filter((p) => p.meta.regional)

  if (content.failed.length) {
    nodes.push(h('p', { class: 's-notice', role: 'status',
      text: c.t('app.place.unavailable', { names: content.failed.map((p) => i18n.text(p.meta.name, p.meta.id)).join(', ') }) }))
  }
  if (content.ok.length === 0) nodes.push(h('div', { class: 's-card' }, h('p', { text: c.t('app.place.none') })))

  // Each group (general/regional) shows its own last pick as chosen, even while the other
  // group is the one actually active (c.choice) — see rememberChoice().
  const envCard = (pack: LoadedContentPack, env: EnvironmentPreset): HTMLElement => {
    const group = pack.meta.regional ? c.lastRegionalChoice : c.lastGeneralChoice
    const chosen = group?.packId === pack.meta.id && group.environmentId === env.id
    return h('button', { type: 'button', class: `s-choice${env.thumbnail ? ' s-photo' : ''}`, 'aria-pressed': String(chosen), 'data-k': `env-${pack.meta.id}-${env.id}`,
      onclick: () => c.choose(pack.meta.id, env.id) },
      env.thumbnail ? h('img', { class: 's-thumb', src: resolveUnder(pack.baseUrl, env.thumbnail), alt: '', loading: 'lazy', decoding: 'async' }) : null,
      h('span', { class: 's-photo-body' },
        h('span', { class: 's-choice-title', text: i18n.text(env.name, env.id) }),
        h('span', { class: 's-muted s-small', text: i18n.text(env.description, '') })))
  }
  const packSection = (pack: LoadedContentPack, isRegional: boolean): HTMLElement =>
    h('section', { class: 's-card', 'aria-label': i18n.text(pack.meta.name, pack.meta.id) },
      h('h3', { text: i18n.text(pack.meta.name, pack.meta.id) }),
      h('p', { class: 's-muted', text: i18n.text(pack.meta.description, '') }),
      isRegional ? h('p', { class: 's-small', text: c.t('app.place.coverage', { note: i18n.text(pack.meta.coverageNote, '') }) }) : null,
      pack.meta.status === 'preview' ? h('p', { class: 's-notice s-small', text: c.t('app.place.preview') }) : null,
      h('div', { class: 's-grid s-places' }, pack.environments.map((env) => envCard(pack, env))))

  if (general.length) nodes.push(h('h3', { text: c.t('app.place.general') }), ...general.map((p) => packSection(p, false)))
  if (regional.length) {
    nodes.push(
      h('hr', { class: 's-divider' }),
      h('h3', { text: c.t('app.place.regional.title') }),
      h('p', { class: 's-muted', text: c.t('app.place.regional.intro') }),
      ...regional.map((p) => packSection(p, true)))
  }

  nodes.push(h('hr', { class: 's-divider' }), renderActivityPicker(c))
  return nodes
}

/** The activity list, shown right under the place picker once a place is chosen. */
function renderActivityPicker(c: SuiteController): HTMLElement {
  const section = h('section', { class: 's-acts-section', 'aria-labelledby': 's-activity-title' },
    h('div', { class: 's-section-head' },
      h('p', { class: 's-step-tag', 'aria-hidden': 'true' }, h('b', { text: '3' }), c.t('app.home.steps.activity')),
      h('h2', { id: 's-activity-title', text: c.t('app.activity.title') }),
      h('p', { class: 's-muted', text: c.t('app.activity.note') })))
  if (!c.choice) return section

  const content = c.content
  const pack = content?.ok.find((p) => p.meta.id === c.choice!.packId)
  const env = pack?.environments.find((e) => e.id === c.choice!.environmentId)
  if (pack && env) {
    section.append(h('p', { class: 's-place-chip' },
      env.thumbnail ? h('img', { src: resolveUnder(pack.baseUrl, env.thumbnail), alt: '', decoding: 'async' }) : null,
      h('span', { text: c.t('app.activity.place', { name: c.i18n!.text(env.name, env.id) }) })))
  }

  if (c.prepareError) {
    section.append(h('div', { class: 's-card', role: 'status' },
      h('p', { text: c.t('app.activity.failed') }),
      h('div', { class: 's-row' },
        h('button', { type: 'button', 'data-k': 'retry', onclick: () => { c.prepareError = false; c.render() } }, c.t('app.activity.retry')))))
    return section
  }
  if (!c.prepared) {
    c.prepare().catch(() => undefined)
    const p = c.prepareProgress
    const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
    section.append(h('div', { class: 's-card s-progress', role: 'status', 'aria-live': 'polite' },
      h('p', { text: c.t('app.activity.preparing') }),
      h('div', { class: 's-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'data-progress': true,
        'aria-label': c.t('app.activity.preparing') }, h('span', { style: `width: ${pct}%` }))))
    return section
  }

  const guided = c.profileMode === 'saved' && c.prepared.resolved?.mode === 'guided'
  if (guided) section.append(h('p', { class: 's-muted', text: c.t('app.activity.guidedFirst') }))
  // Ready activities first (the first one is featured over the place's photograph), then the
  // ones that still need caregiver setup as quiet, compact cards.
  const order = c.activityOrder()
  const ready = order.filter((k) => c.availability(k)?.ok)
  const setup = order.filter((k) => !c.availability(k)?.ok)
  const photo = pack && env?.thumbnail ? resolveUnder(pack.baseUrl, env.thumbnail) : null
  const list = h('div', { class: 's-acts' })
  ready.forEach((kind, n) => list.append(activityCard(c, kind, order.indexOf(kind) + 1, n === 0 ? photo : undefined)))
  section.append(list)
  if (setup.length) section.append(h('div', { class: 's-acts s-acts-setup' }, setup.map((kind) => activityCard(c, kind, order.indexOf(kind) + 1))))
  return section
}

const ICON_PATHS: Record<ActivityKind, string[]> = {
  photo: ['M4 5h16v14H4z', 'M4 16l4.5-4.5 3.5 3.5 3-3 5 5', 'M15.5 9.5h.01'],
  object: ['M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z', 'M16 10h2a2 2 0 0 1 0 4h-2', 'M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2'],
  sound: ['M4 10v4h3l4 3V7l-4 3z', 'M15 9a4 4 0 0 1 0 6', 'M17.5 6.5a8 8 0 0 1 0 11'],
  space: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  sequence: ['M5 12h14', 'M5 12h.01M12 12h.01M19 12h.01', 'M3.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M10.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M17.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0']
}

/** Thin line icon per activity; decorative (the title carries the meaning). */
function activityIcon(kind: ActivityKind): SVGElement {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 's-act-icon')
  for (const d of ICON_PATHS[kind]) {
    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

function activityCard(c: SuiteController, kind: ActivityKind, number: number, feature?: string | null): HTMLElement {
  const def = c.deps.ACTIVITIES[kind]
  const avail = c.availability(kind)
  const ok = !!avail && avail.ok
  const titleId = `s-act-${kind}`
  const top = h('div', { class: 's-act-top' },
    h('span', { class: 's-act-badge' }, activityIcon(kind)),
    h('span', { class: 's-act-num', 'aria-hidden': 'true', text: String(number).padStart(2, '0') }))
  const head = [h('h3', { id: titleId, text: c.t(def.nameKey) }), h('p', { class: 's-act-desc', text: c.t(def.descriptionKey) })]

  if (ok) {
    return h('section', { class: `s-act${feature ? ' s-act-feature' : ''}`, 'aria-labelledby': titleId },
      feature ? h('img', { class: 's-act-photo', src: feature, alt: '', 'aria-hidden': 'true', decoding: 'async' }) : null,
      top, ...head,
      h('div', { class: 's-act-foot' },
        h('button', { type: 'button', class: 's-primary s-act-start', 'data-k': `start-${kind}`, onclick: () => void c.startActivity(kind) },
          h('span', { text: c.t('app.activity.start') }), h('span', { class: 's-cta-icon', 'aria-hidden': 'true', text: '→' }))))
  }
  return h('section', { class: 's-act s-act-off', 'aria-labelledby': titleId },
    top, ...head,
    h('div', { class: 's-act-foot' },
      h('p', { class: 's-small s-act-reason', text: avail && !avail.ok ? c.t(avail.reasonKey) : c.t('app.activity.unavailable') }),
      h('button', { type: 'button', class: 's-linkish', 'data-k': `setup-${kind}`, onclick: () => { c.go('home'); void c.openCaregiverSetup() } },
        c.t('app.home.caregiver.setup'))))
}

// ---------------------------------------------------------------------------------------- Summary

export function durationText(c: SuiteController, ms: number): string {
  const { minutes, seconds } = splitDuration(ms)
  if (minutes === 0) return c.t('app.summary.seconds', { count: seconds })
  if (seconds === 0) return c.t('app.summary.minutes', { count: minutes })
  return c.t('app.summary.minutesSeconds', { minutes: c.t('app.summary.minutes', { count: minutes }), seconds: c.t('app.summary.seconds', { count: seconds }) })
}

export function renderSummary(c: SuiteController): HTMLElement {
  const s: SessionSummary | null = c.summary
  const page = h('div', { class: 's-page' }, header(c, 'app.summary.title', null, c.t('app.summary.intro')))
  if (!s) {
    page.append(h('div', { class: 's-row' }, h('button', { type: 'button', class: 's-primary', onclick: () => c.go('home') }, c.t('app.summary.home'))))
    return page
  }
  const i18n = c.i18n!
  const fact = (label: string, value: string | number): HTMLElement[] => [h('dt', { text: label }), h('dd', { text: String(value) })]
  const activityName = c.deps.ACTIVITIES[s.activity] ? c.t(c.deps.ACTIVITIES[s.activity].nameKey) : s.activity
  const pack = c.content?.packs.find((p) => p.meta.id === s.packId)
  const env = pack?.environments.find((e) => e.id === s.environmentId)

  page.append(h('section', { class: 's-card', 'aria-label': c.t('app.summary.title') },
    h('dl', { class: 's-facts' },
      fact(c.t('app.summary.activity'), activityName),
      fact(c.t('app.summary.place'), env ? i18n.text(env.name, env.id) : s.environmentId),
      fact(c.t('app.summary.content'), s.profile === 'saved' ? c.t('app.badge.personal') : c.t('app.home.who.demo')),
      fact(c.t('app.summary.time'), durationText(c, s.durationMs)),
      s.pausedMs > 0 ? fact(c.t('app.summary.paused'), durationText(c, s.pausedMs)) : [],
      fact(c.t('app.summary.promptsPlayed'), s.promptsPlayed),
      fact(c.t('app.summary.promptsReplayed'), s.promptsReplayed),
      fact(c.t('app.summary.skips'), s.skips),
      fact(c.t('app.summary.sounds'), s.soundsPlayed),
      fact(c.t('app.summary.closeups'), s.closeups)),
    h('p', { class: 's-muted', text: s.endedBy === 'finished' ? c.t('app.summary.endedFinished') : c.t('app.summary.endedExited') })))

  const list = (titleKey: string, entries: string[]): HTMLElement =>
    h('section', { class: 's-card' },
      h('h2', { text: c.t(titleKey) }),
      entries.length ? h('ul', {}, entries.map((e) => h('li', { text: e }))) : h('p', { class: 's-muted', text: c.t('app.summary.none') }))

  page.append(
    list('app.summary.itemsShown', s.itemsShown.map((i) => (i.personal ? `${i.title} (${c.t('app.badge.personal')})` : i.title))),
    list('app.summary.objectsVisited', s.objectsVisited.map((o) => o.label)),
    list('app.summary.notes', s.caregiverNotes.map((n) => n.text)))

  if (s.vision) {
    const v = s.vision
    page.append(h('section', { class: 's-card s-vision-block', 'aria-labelledby': 's-vision-title' },
      h('h2', { id: 's-vision-title', text: c.t('app.summary.vision.title') }),
      h('p', { text: v.label }),
      h('dl', { class: 's-facts' },
        fact(c.t('app.summary.vision.tracking'), v.trackingAvailableShare === null ? c.t('app.summary.vision.unmeasured') : `${Math.round(v.trackingAvailableShare * 100)}%`),
        fact(c.t('app.summary.vision.samples'), v.samples),
        fact(c.t('app.summary.vision.cues'), v.gentleCuesShown),
        fact(c.t('app.summary.vision.held'), v.promptSpeechHeld))))
  }

  page.append(h('div', { class: 's-row' },
    h('button', { type: 'button', 'data-k': 'download', onclick: () => c.downloadSummary() }, c.t('app.summary.download')),
    h('button', { type: 'button', class: 's-primary', 'data-k': 'another', onclick: () => c.go('home') }, c.t('app.summary.another')),
    h('button', { type: 'button', 'data-k': 'home', onclick: () => c.go('home') }, c.t('app.summary.home'))))
  return page
}
