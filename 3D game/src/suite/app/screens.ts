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
import { resolveUnder } from '../paths'
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
      h('button', { type: 'button', 'data-k': 'caregiver-setup', onclick: () => void c.openCaregiverSetup() }, c.t('app.home.caregiver.setup'))),
    h('hr', { class: 's-divider' }),
    h('h3', { text: c.t('app.home.caregiver.homeTitle') }),
    h('p', { class: 's-muted', text: c.t('app.home.caregiver.homeHint') }),
    h('div', { class: 's-row' },
      h('button', { type: 'button', 'data-k': 'home-personalise', onclick: () => c.openHomePersonalisation() }, c.t('app.home.caregiver.homeOpen'))))

  const guided = h('section', { 'aria-labelledby': 's-guided' },
    h('h3', { id: 's-guided', text: c.t('app.home.guided.title') }),
    h('p', { class: 's-muted', text: c.t('app.home.guided.hint') }),
    h('div', { class: 's-row' },
      h('button', { type: 'button', 'data-k': 'guided', onclick: () => c.openGuidedTasks() }, c.t('app.home.guided.open'))))

  const more = h('details', { class: 's-card s-more', 'data-k': 'more' },
    h('summary', { class: 's-more-summary' }, c.t('app.home.more.title')),
    h('div', { class: 's-more-body' },
      comfort, h('hr', { class: 's-divider' }),
      camera, h('hr', { class: 's-divider' }),
      caregiver, h('hr', { class: 's-divider' }),
      guided))

  const disclaimer = c.tOr('common.disclaimer', 'app.disclaimer')
  return h('div', { class: 's-page' },
    h('header', { class: 's-brand' },
      h('h1', { tabindex: -1, text: c.t('app.brand') }),
      h('p', { class: 's-muted', text: disclaimer })),
    who, language,
    // Kept outside the disclosure: storage state matters even before a caregiver opens setup.
    warning ? h('p', { class: 's-notice', role: 'status' }, h('strong', { text: c.t('app.home.storage') + ' ' }), h('span', { lang: 'en', text: warning })) : null,
    h('hr', { class: 's-divider' }),
    ...renderPlaceSection(c),
    more)
}

// ---------------------------------------------------------------------------------------- Place + Activity
//
// Part of the Home page, not a screen of its own: picking a place prepares it in the
// background immediately, so the activity list right underneath is usually ready by the
// time it scrolls into view.

function renderPlaceSection(c: SuiteController): (HTMLElement | null)[] {
  const nodes: (HTMLElement | null)[] = [
    h('h2', { id: 's-place-title', tabindex: -1, text: c.t('app.place.title') }),
    h('p', { class: 's-muted', text: c.t('app.place.intro') })
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
  if (!c.choice || !content.ok.some((p) => p.meta.id === c.choice!.packId && p.environments.some((e) => e.id === c.choice!.environmentId))) {
    c.choice = c.defaultChoice(content)
    c.rememberChoice(c.choice)
  }
  const i18n = c.i18n!
  const general = content.ok.filter((p) => !p.meta.regional)
  const regional = content.ok.filter((p) => p.meta.regional)

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
    return h('button', { type: 'button', class: 's-choice', 'aria-pressed': String(chosen), 'data-k': `env-${pack.meta.id}-${env.id}`,
      onclick: () => c.choose(pack.meta.id, env.id) },
      env.thumbnail ? h('img', { class: 's-thumb', src: resolveUnder(pack.baseUrl, env.thumbnail), alt: '', loading: 'lazy', decoding: 'async' }) : null,
      h('span', { class: 's-choice-title', text: i18n.text(env.name, env.id) }),
      h('span', { class: 's-muted s-small', text: i18n.text(env.description, '') }))
  }
  const packSection = (pack: LoadedContentPack, isRegional: boolean): HTMLElement =>
    h('section', { class: 's-card', 'aria-label': i18n.text(pack.meta.name, pack.meta.id) },
      h('h3', { text: i18n.text(pack.meta.name, pack.meta.id) }),
      h('p', { class: 's-muted', text: i18n.text(pack.meta.description, '') }),
      isRegional ? h('p', { class: 's-small', text: c.t('app.place.coverage', { note: i18n.text(pack.meta.coverageNote, '') }) }) : null,
      pack.meta.status === 'preview' ? h('p', { class: 's-notice s-small', text: c.t('app.place.preview') }) : null,
      h('div', { class: 's-grid' }, pack.environments.map((env) => envCard(pack, env))))

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
  const section = h('section', { 'aria-labelledby': 's-activity-title' },
    h('h2', { id: 's-activity-title', text: c.t('app.activity.title') }),
    h('p', { class: 's-notice', text: c.t('app.activity.note') }))
  if (!c.choice) return section

  const content = c.content
  const pack = content?.ok.find((p) => p.meta.id === c.choice!.packId)
  const env = pack?.environments.find((e) => e.id === c.choice!.environmentId)
  if (pack && env) section.append(h('p', { class: 's-muted', text: c.t('app.activity.place', { name: c.i18n!.text(env.name, env.id) }) }))

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
  const list = h('div', { class: 's-grid' })
  for (const kind of c.activityOrder()) list.append(activityCard(c, kind))
  section.append(list)
  return section
}

function activityCard(c: SuiteController, kind: ActivityKind): HTMLElement {
  const def = c.deps.ACTIVITIES[kind]
  const avail = c.availability(kind)
  const ok = !!avail && avail.ok
  const titleId = `s-act-${kind}`
  return h('section', { class: 's-card', 'aria-labelledby': titleId },
    h('h2', { id: titleId, text: c.t(def.nameKey) }),
    h('p', { class: 's-muted', text: c.t(def.descriptionKey) }),
    ok
      ? h('div', { class: 's-row' },
          h('button', { type: 'button', class: 's-primary', 'data-k': `start-${kind}`, onclick: () => void c.startActivity(kind) }, c.t('app.activity.start')))
      : h('div', { class: 's-notice' },
          h('p', { text: avail && !avail.ok ? `${c.t('app.activity.unavailable')}: ${c.t(avail.reasonKey)}` : c.t('app.activity.unavailable') }),
          h('p', { class: 's-small', text: c.t('app.activity.setupHint') }),
          h('div', { class: 's-row' },
            h('button', { type: 'button', 'data-k': `setup-${kind}`, onclick: () => { c.go('home'); void c.openCaregiverSetup() } }, c.t('app.home.caregiver.setup')))))
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
