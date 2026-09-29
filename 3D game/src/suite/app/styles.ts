/**
 * #suite's stylesheet. Everything is scoped under #suite; colours are tokens from theme.ts.
 * Sizes are in em from an 18 px base scaled by the text-size setting; touch targets are at
 * least 48 × 48 px regardless of text size.
 *
 * z-order: #suite sits at 30 — above the house UI (#hud, #answer 4, #overlay 5) and below
 * the camera sheet (#camera-setup 40) and chip dock (#camera-dock 41, bottom-right).
 */
import { PALETTE, PALETTE_HC, paletteCss } from './theme'

export const SUITE_Z = 30
/** Space kept clear at the bottom-right for the camera chip dock. */
export const DOCK_CLEAR_PX = 72
/** How far (as % of the image's own width) the hero panorama drifts while it is shown. */
const PAN_SPAN = 26

export const SUITE_CSS = `
#suite { position: fixed; inset: 0; z-index: ${SUITE_Z}; pointer-events: none;
  ${paletteCss(PALETTE)}
  --s-scale: 1; --s-radius: 16px; --s-gap: 0.75em; --s-dock-clear: ${DOCK_CLEAR_PX}px;
  font-size: calc(18px * var(--s-scale)); line-height: 1.5; color: var(--s-text);
  -webkit-text-size-adjust: 100%; }
#suite.s-hc { ${paletteCss(PALETTE_HC)} }
#suite[hidden] { display: none; }
#suite *, #suite *::before, #suite *::after { box-sizing: border-box; }
#suite .s-backdrop { position: absolute; inset: 0; pointer-events: auto;
  background: var(--s-bg); }
#suite.s-hc .s-backdrop { background: var(--s-bg); }
#suite .s-stage { position: absolute; inset: 0; pointer-events: auto; touch-action: none; cursor: grab; }
#suite .s-stage.s-dragging { cursor: grabbing; }
#suite .s-stage.s-over { cursor: pointer; }
#suite .s-screen { position: absolute; inset: 0; overflow: auto; pointer-events: auto;
  padding: 24px 16px calc(var(--s-dock-clear) + 24px); -webkit-overflow-scrolling: touch; }
#suite .s-screen.s-explore { overflow: visible; padding: 0; pointer-events: none; }
#suite .s-page { width: 100%; max-width: 46em; margin: 0 auto; display: flex; flex-direction: column; gap: 1em; }

#suite h1, #suite h2, #suite h3 { margin: 0; line-height: 1.25; font-weight: 650; overflow-wrap: anywhere; }
#suite h1 { font-size: 1.6em; }
#suite h2 { font-size: 1.25em; }
#suite h3 { font-size: 1.05em; }
#suite p { margin: 0; overflow-wrap: anywhere; }
#suite ul { margin: 0; padding-left: 1.2em; }
#suite .s-muted { color: var(--s-muted); }
#suite .s-small { font-size: 0.9em; }
#suite [hidden] { display: none !important; }
#suite .s-visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; }

#suite .s-card { background: var(--s-surface); border: 1px solid rgba(17, 17, 17, .08); border-radius: var(--s-radius);
  padding: 1em; display: flex; flex-direction: column; gap: var(--s-gap);
  box-shadow: 0 12px 40px -20px rgba(17, 17, 17, .08); }
#suite.s-hc .s-card { border: 2px solid var(--s-border); box-shadow: none; }
#suite.s-hc button { border: 2px solid var(--s-border); }
#suite .s-card.s-separate { background: var(--s-surface-2); border-style: dashed; border-color: var(--s-border); }
#suite .s-divider { border: 0; border-top: 1px solid var(--s-border); margin: 0.5em 0; opacity: .6; }
#suite .s-row { display: flex; flex-wrap: wrap; gap: var(--s-gap); align-items: center; }
#suite .s-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13em), 1fr)); gap: var(--s-gap); }

#suite button, #suite .s-button { font: inherit; color: var(--s-text); background: var(--s-surface);
  border: 1px solid rgba(17, 17, 17, .16); border-radius: 12px; min-height: 48px; min-width: 48px;
  padding: 0.45em 1em; cursor: pointer; text-align: center; line-height: 1.3; overflow-wrap: break-word; }
/* In flex rows, never shrink a button below its longest word (an explicit min-width would
   otherwise let flex squeeze it and break words mid-way, e.g. Devanagari at large text). */
#suite .s-row > button, #suite .s-actions button, #suite .s-panel-foot button, #suite .s-strip button,
#suite .s-lightbox-bar button { min-width: min-content; }
#suite button:hover { background: var(--s-accent-soft); color: var(--s-on-accent-soft); }
#suite button.s-primary { background: var(--s-accent); border-color: var(--s-accent); color: var(--s-on-accent); font-weight: 600;
  letter-spacing: .03em; }
#suite button.s-primary:hover { filter: brightness(1.08); }
#suite button[aria-pressed="true"], #suite button.s-chosen { background: var(--s-accent-soft); color: var(--s-on-accent-soft);
  border-color: var(--s-accent); box-shadow: inset 0 0 0 2px var(--s-accent); }
#suite button:disabled { opacity: .55; cursor: default; }
#suite :focus-visible { outline: 3px solid var(--s-focus); outline-offset: 2px; }
/* Headings take focus only to orient screen readers after a screen change. */
#suite [tabindex="-1"]:focus { outline: none; }
#suite button:focus-visible { box-shadow: 0 0 0 6px var(--s-surface); }

#suite .s-badge { display: inline-flex; align-items: center; min-height: 1.8em; padding: 0.1em 0.7em; border-radius: 999px;
  font-size: 0.8em; font-weight: 600; white-space: normal; }
#suite .s-badge.s-personal { background: var(--s-personal-bg); color: var(--s-personal-text); }
#suite .s-badge.s-demo { background: var(--s-demo-bg); color: var(--s-demo-text); }
#suite .s-notice { background: var(--s-notice-bg); color: var(--s-notice); border-radius: 12px; padding: 0.6em 0.9em; }

#suite .s-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 0.3em; text-align: start;
  padding: 0.8em 1em; width: 100%; }
#suite .s-choice .s-choice-title { font-weight: 650; }
#suite .s-thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; background: var(--s-surface-2); display: block; }

#suite .s-brand { display: flex; flex-direction: column; gap: 0.35em; }

/* Home: a full-bleed panorama hero in a bezel, then hairline cards on greyish-white. No
   animation anywhere (a check enforces it): the hero's dissolve and drift are transitions that
   the script drives, and they are off under reduced motion. */
#suite { --s-ease: cubic-bezier(0.32, 0.72, 0, 1); --s-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif; }
#suite .s-page.s-home { max-width: 74em; gap: 1.4em; }
#suite .s-hero { display: flex; flex-direction: column; gap: 1em; padding-top: 0.2em; }
#suite .s-hero-frame { padding: 6px; border-radius: 34px; background: rgba(17, 17, 17, .04); border: 1px solid rgba(17, 17, 17, .08); }
#suite .s-hero-stage { position: relative; isolation: isolate; overflow: hidden; border-radius: 28px; background: #2a2a28; color: #fff;
  min-height: clamp(32em, 80dvh, 48em); padding: clamp(1em, 3vw, 2.2em); display: flex; flex-direction: column; gap: 1.2em; }
#suite .s-slides, #suite .s-scrim { position: absolute; inset: 0; z-index: -1; }
#suite .s-slides { overflow: hidden; z-index: -2; }
#suite .s-slide { position: absolute; top: 0; left: 0; height: 100%; min-width: 136%; object-fit: cover; opacity: 0; user-select: none;
  transition: opacity 1.6s var(--s-ease), transform 0s linear 1.6s; }
#suite .s-slide.s-pan-l { transform: translateX(0); }
#suite .s-slide.s-pan-r { transform: translateX(-${PAN_SPAN}%); }
#suite .s-slide.s-on { opacity: 1; transition: opacity 1.6s var(--s-ease), transform 18s cubic-bezier(.3, .1, .3, 1); }
#suite .s-slide.s-pan-l.s-on { transform: translateX(-${PAN_SPAN}%); }
#suite .s-slide.s-pan-r.s-on { transform: translateX(0); }
#suite.s-rm .s-slide, #suite.s-rm .s-slide.s-on { min-width: 100%; transform: none !important; transition: none; }
#suite .s-scrim { background: linear-gradient(to top, rgba(10, 10, 10, .86) 0%, rgba(10, 10, 10, .55) 42%, rgba(10, 10, 10, .18) 100%); }
#suite .s-eyebrow { display: inline-flex; align-items: center; gap: 0.6em; align-self: flex-start; padding: 0.35em 1em 0.35em 0.8em; border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, .35); background: rgba(10, 10, 10, .35); color: #fff;
  font-size: 0.72em; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }
#suite .s-dot { width: .55em; height: .55em; border-radius: 50%; background: #fff; }
#suite .s-hero-copy { margin-top: auto; display: flex; flex-direction: column; gap: 0.9em; max-width: 34em; }
#suite .s-hero h1 { font-family: var(--s-serif); font-size: clamp(2.6em, 8.5vw, 5em); line-height: 1; letter-spacing: -0.03em; font-weight: 500; color: #fff; }
#suite .s-hero h1 em { font-style: italic; opacity: .82; }
#suite .s-hero .s-lede { color: rgba(255, 255, 255, .88); font-size: 1.05em; max-width: 30em; }
#suite .s-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.8em; margin-top: 0.3em; }
#suite .s-hero button { transition: transform .5s var(--s-ease), background .3s var(--s-ease); }
#suite .s-hero button:active { transform: scale(0.98); }
#suite button.s-cta { display: inline-flex; align-items: center; gap: 0.9em; border-radius: 999px; padding: 0.35em 0.4em 0.35em 1.5em;
  background: #fff; border-color: #fff; color: #111; }
#suite button.s-cta:hover { background: #fff; color: #111; filter: none; }
#suite .s-cta-icon { display: inline-grid; place-items: center; width: 2.2em; height: 2.2em; border-radius: 50%; background: #111; color: #fff;
  transition: transform .5s var(--s-ease); }
#suite button.s-cta:hover .s-cta-icon { transform: translateY(2px) scale(1.06); }
#suite button.s-ghost { border-radius: 999px; padding: 0.45em 1.3em; color: #fff; background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .5); }
#suite button.s-ghost:hover { background: rgba(255, 255, 255, .28); color: #fff; }
#suite .s-hero-side { display: flex; flex-direction: column; gap: 0.35em; max-width: 30em; padding-top: 1em; border-top: 1px solid rgba(255, 255, 255, .3); }
#suite .s-cap-kicker { font-size: 0.72em; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: rgba(255, 255, 255, .8); }
#suite .s-cap-name { font-family: var(--s-serif); font-style: italic; font-size: 1.5em; line-height: 1.2; color: #fff; }
#suite .s-cap-desc { font-size: 0.92em; color: rgba(255, 255, 255, .85); }
#suite .s-reel { display: flex; flex-wrap: wrap; gap: 0.5em; margin-top: 0.5em; }
#suite button.s-reel-item { padding: 0; width: 4.4em; min-width: 4.4em; height: 48px; overflow: hidden; border-radius: 12px; background: #2a2a28;
  border: 2px solid rgba(255, 255, 255, .25); opacity: .72; }
#suite button.s-reel-item:hover { background: #2a2a28; opacity: 1; }
#suite button.s-reel-item[aria-pressed="true"] { opacity: 1; border-color: #fff; box-shadow: none; background: #2a2a28; }
#suite button.s-reel-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
#suite .s-hero :focus-visible { outline-color: #fff; }
@media (min-width: 900px) {
  #suite .s-hero-stage { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); grid-template-rows: auto 1fr; column-gap: 3em; }
  #suite .s-eyebrow { grid-column: 1 / -1; justify-self: start; }
  #suite .s-hero-copy { grid-column: 1; align-self: end; margin-top: 0; }
  #suite .s-hero-side { grid-column: 2; align-self: end; justify-self: end; width: 100%; }
}
#suite .s-steps { list-style: none; margin: 0.2em 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5em; }
#suite .s-steps li { display: inline-flex; align-items: center; gap: 0.5em; padding: 0.3em 0.9em 0.3em 0.4em; border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, .10); font-size: 0.85em; color: var(--s-muted); }
#suite .s-steps li b { display: inline-grid; place-items: center; width: 1.7em; height: 1.7em; border-radius: 50%;
  background: var(--s-accent-soft); color: var(--s-on-accent-soft); font-weight: 650; }
#suite.s-hc .s-hero-frame { background: none; border: 2px solid var(--s-border); }
#suite .s-section-head { display: flex; flex-direction: column; gap: 0.25em; margin-top: 1.2em; }
#suite .s-section-head h2 { font-family: var(--s-serif); font-weight: 500; font-size: clamp(1.7em, 4vw, 2.3em); letter-spacing: -0.02em; }
#suite .s-home > h2, #suite .s-home #s-who { font-family: var(--s-serif); font-weight: 500; letter-spacing: -0.01em; }

/* Place cards: a bezelled print — outer tray, inner photo, name on a dark fade. */
#suite .s-grid.s-places { grid-template-columns: repeat(auto-fill, minmax(min(100%, 17em), 1fr)); gap: 1em; }
#suite .s-choice.s-photo { padding: 6px; gap: 0; overflow: hidden; position: relative; border-radius: 24px;
  background: var(--s-surface); border: 1px solid rgba(17, 17, 17, .08);
  transition: transform .5s var(--s-ease), border-color .3s var(--s-ease); }
#suite .s-choice.s-photo:hover { background: var(--s-surface); color: var(--s-text); border-color: rgba(17, 17, 17, .35); transform: translateY(-2px); }
#suite .s-choice.s-photo .s-thumb { border-radius: 18px; aspect-ratio: 16 / 11; }
#suite .s-choice.s-photo .s-photo-body { display: flex; flex-direction: column; gap: 0.2em; padding: 0.7em 0.7em 0.6em; width: 100%; }
#suite .s-choice.s-photo .s-choice-title { font-family: var(--s-serif); font-weight: 500; font-size: 1.15em; }
#suite .s-choice.s-photo[aria-pressed="true"] { border-color: var(--s-accent); background: var(--s-surface); box-shadow: 0 0 0 1px var(--s-accent); }
#suite .s-choice.s-photo[aria-pressed="true"]::after { content: '✓'; position: absolute; top: 1em; right: 1em; width: 2em; height: 2em;
  display: grid; place-items: center; border-radius: 50%; background: var(--s-accent); color: var(--s-on-accent); font-weight: 700; }
#suite.s-rm .s-choice.s-photo { transition: none; }

/* Activities: numbered editorial cards. The first ready one is featured over the place's own
   photograph; ones that still need setup are quiet dashed cards, not warning boxes. */
#suite .s-acts-section { display: flex; flex-direction: column; gap: 1em; }
#suite .s-step-tag { display: inline-flex; align-items: center; gap: 0.6em; align-self: flex-start; padding: 0.25em 0.9em 0.25em 0.3em; border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, .10); background: var(--s-surface); font-size: 0.72em; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--s-muted); }
#suite .s-step-tag b { display: inline-grid; place-items: center; width: 1.9em; height: 1.9em; border-radius: 50%; background: var(--s-accent); color: var(--s-on-accent); letter-spacing: 0; }
#suite .s-place-chip { display: inline-flex; align-items: center; gap: 0.6em; align-self: flex-start; margin: 0; padding: 0.25em 1em 0.25em 0.25em; border-radius: 999px;
  background: var(--s-surface); border: 1px solid rgba(17, 17, 17, .10); font-size: 0.9em; color: var(--s-muted); }
#suite .s-place-chip img { width: 2.4em; height: 2.4em; border-radius: 50%; object-fit: cover; display: block; }
#suite .s-acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15em), 1fr)); gap: 1em; }
#suite .s-act { position: relative; overflow: hidden; isolation: isolate; display: flex; flex-direction: column; gap: 0.6em; min-height: 17em; padding: 1.3em;
  border-radius: 26px; background: var(--s-surface); border: 1px solid rgba(17, 17, 17, .08); box-shadow: 0 24px 40px -28px rgba(17, 17, 17, .18);
  transition: transform .5s var(--s-ease), border-color .3s var(--s-ease); }
#suite .s-act:hover { transform: translateY(-3px); border-color: rgba(17, 17, 17, .3); }
#suite .s-act-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6em; }
#suite .s-act-badge { display: inline-grid; place-items: center; width: 3em; height: 3em; border-radius: 50%; background: var(--s-surface-2); }
#suite .s-act-icon { width: 1.6em; height: 1.6em; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
#suite .s-act-num { font-family: var(--s-serif); font-size: 2.6em; line-height: 1; letter-spacing: -0.04em; color: rgba(17, 17, 17, .16); }
#suite .s-act h3 { font-family: var(--s-serif); font-weight: 500; font-size: 1.45em; letter-spacing: -0.01em; }
#suite .s-act-desc { color: var(--s-muted); }
#suite .s-act-foot { margin-top: auto; padding-top: 0.8em; display: flex; flex-direction: column; align-items: flex-start; gap: 0.4em; }
#suite button.s-act-start { display: inline-flex; align-items: center; gap: 0.9em; border-radius: 999px; padding: 0.3em 0.35em 0.3em 1.3em; }
#suite button.s-act-start .s-cta-icon { background: rgba(255, 255, 255, .16); color: inherit; }
#suite button.s-act-start:hover .s-cta-icon { transform: translateX(3px); }
#suite .s-act-feature { color: #fff; background: #1b1b1a; border-color: #1b1b1a; }
#suite .s-act-feature .s-act-desc { color: rgba(255, 255, 255, .86); }
#suite .s-act-feature .s-act-badge { background: rgba(255, 255, 255, .16); }
#suite .s-act-feature .s-act-num { color: rgba(255, 255, 255, .3); }
#suite .s-act-feature .s-act-photo { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-fit: cover; opacity: .5; }
#suite .s-act-feature::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(to top, rgba(10, 10, 10, .92) 0%, rgba(10, 10, 10, .72) 55%, rgba(10, 10, 10, .45) 100%); }
#suite .s-act-feature button.s-act-start { background: #fff; color: #111; border-color: #fff; }
#suite .s-act-feature button.s-act-start .s-cta-icon { background: #111; color: #fff; }
#suite .s-act-feature :focus-visible { outline-color: #fff; }
#suite .s-act-off { min-height: 0; background: transparent; box-shadow: none; border: 1px dashed rgba(17, 17, 17, .28); padding: 1.1em; }
#suite .s-act-off:hover { transform: none; border-color: rgba(17, 17, 17, .28); }
#suite .s-act-off .s-act-badge { background: transparent; border: 1px solid rgba(17, 17, 17, .18); color: var(--s-muted); }
#suite .s-act-off h3 { font-size: 1.15em; color: var(--s-muted); }
#suite .s-act-off .s-act-num { font-size: 1.6em; }
#suite .s-act-reason { color: var(--s-notice); }
#suite button.s-linkish { min-height: 48px; padding: 0.3em 0; border: 0; background: none; border-radius: 6px; color: var(--s-text);
  text-decoration: underline; text-underline-offset: 0.25em; text-decoration-thickness: 1px; }
#suite button.s-linkish:hover { background: none; color: var(--s-text); text-decoration-thickness: 2px; }
@media (min-width: 900px) { #suite .s-act-feature { grid-column: span 2; } }
#suite.s-rm .s-act, #suite.s-rm .s-act-feature button, #suite.s-rm .s-act-start .s-cta-icon { transition: none; }
#suite.s-hc .s-act { border: 2px solid var(--s-border); box-shadow: none; }
#suite.s-hc .s-act-feature { background: #000; color: #fff; }
#suite.s-hc .s-act-feature .s-act-photo, #suite.s-hc .s-act-feature::before { display: none; }
#suite .s-back { align-self: flex-start; }

/* Home screen: secondary/caregiver-only controls collapse behind one disclosure so the
   patient-facing "Who" and "Language" sections are what's seen first. */
#suite .s-more { padding: 0; }
#suite .s-more-summary { display: flex; align-items: center; min-height: 48px; padding: 0.8em 1em;
  font-weight: 650; cursor: pointer; list-style: none; }
#suite .s-more-summary::-webkit-details-marker { display: none; }
#suite .s-more-summary::before { content: '▸'; display: inline-block; margin-inline-end: 0.5em;
  transition: transform .15s ease; }
#suite .s-more[open] .s-more-summary::before { transform: rotate(90deg); }
#suite .s-more-body { display: flex; flex-direction: column; gap: var(--s-gap); padding: 0 1em 1em; }
#suite .s-more-body h3 { margin-bottom: 0.2em; }

#suite .s-switch { display: flex; align-items: center; justify-content: space-between; gap: 1em; min-height: 48px; cursor: pointer; }
#suite .s-switch input { width: 28px; height: 28px; accent-color: var(--s-accent); flex: none; }
#suite fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5em; min-width: 0; }
#suite legend { padding: 0; margin-bottom: 0.3em; font-weight: 600; }
#suite label.s-range { display: flex; flex-direction: column; gap: 0.2em; }
#suite input[type=range] { width: 100%; min-height: 48px; accent-color: var(--s-accent); }
#suite textarea { font: inherit; color: var(--s-text); background: var(--s-surface); border: 2px solid var(--s-border);
  border-radius: 12px; padding: 0.5em 0.7em; width: 100%; min-height: 5em; resize: vertical; }

#suite .s-progress { display: flex; flex-direction: column; gap: 0.5em; }
#suite .s-bar { height: 12px; border-radius: 999px; background: var(--s-surface-2); overflow: hidden; }
#suite .s-bar > span { display: block; height: 100%; background: var(--s-accent); border-radius: 999px; width: 0; transition: width .3s ease; }
#suite.s-rm .s-bar > span { transition: none; }

/* First launch, before strings are in: a calm, centered, on-brand placeholder rather
   than a blank screen. No animation (nothing here ever spins, pulses or flashes — see
   the suite-app check "css: no animations"), so this is typography and stillness, not
   a spinner. */
#suite .s-launch { min-height: 40vh; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.35em; text-align: center; }

/* Overlays (pause, settings, exit question, loading) */
#suite .s-layer { position: absolute; inset: 0; pointer-events: auto; display: grid; place-items: center;
  padding: 16px 16px calc(var(--s-dock-clear) + 8px); background: rgba(244, 244, 242, .72); overflow: auto; }
#suite.s-hc .s-layer { background: rgba(0, 0, 0, .6); }
#suite .s-dialog { width: min(34em, 100%); max-height: 100%; overflow: auto; }

/* Explore panel: side panel from 768 px, bottom sheet below */
#suite .s-panel { position: absolute; pointer-events: auto; background: var(--s-surface); color: var(--s-text);
  display: flex; flex-direction: column; box-shadow: 0 8px 30px rgba(17, 17, 17, .14); }
#suite.s-hc .s-panel { border: 2px solid var(--s-border); box-shadow: none; }
#suite .s-panel-body { overflow: auto; padding: 1em; display: flex; flex-direction: column; gap: 0.8em; min-height: 0; flex: 1 1 auto; }
#suite .s-panel-foot { flex: none; display: flex; flex-wrap: wrap; gap: 0.5em; padding: 0.6em 1em;
  border-top: 1px solid var(--s-surface-2); }
#suite .s-prompt { font-size: 1.15em; line-height: 1.45; }
#suite .s-cue { color: var(--s-cue); font-style: italic; }
#suite .s-actions { display: flex; flex-wrap: wrap; gap: 0.5em; }
#suite .s-actions button { flex: 1 1 auto; }
#suite .s-objects { display: flex; flex-direction: column; gap: 0.5em; }
#suite .s-chat { display: flex; flex-direction: column; gap: 0.55em; padding: 0.8em; border: 1px solid var(--s-border); border-radius: 14px;
  background: var(--s-surface-2); }
#suite .s-chat-reply { padding: 0.65em; border-radius: 10px; background: var(--s-surface); }
#suite .s-strip { list-style: none; margin: 0; padding: 0 0 4px; display: flex; flex-wrap: wrap; gap: 0.5em; }
#suite .s-strip button { text-align: start; }
#suite .s-strip button.s-current { border-color: var(--s-accent); box-shadow: inset 0 0 0 2px var(--s-accent); }
#suite .s-caregiver { border-top: 1px dashed var(--s-border); padding-top: 0.8em; display: flex; flex-direction: column; gap: 0.6em; }
#suite .s-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4em; }
#suite .s-items button { width: 100%; text-align: start; }
#suite .s-explore-root { position: absolute; inset: 0; pointer-events: none; }
#suite .s-navigation-tools { position: absolute; top: 16px; right: 16px; display: flex; flex-direction: column;
  align-items: flex-end; gap: 0.5em; pointer-events: none; }
#suite .s-navigation-tools > * { pointer-events: auto; }
#suite .s-nav-toggle { display: flex; gap: 3px; padding: 4px; border: 1px solid rgba(17,17,17,.12); border-radius: 14px;
  background: rgba(255,255,255,.94); box-shadow: 0 2px 12px rgba(17,17,17,.12); }
#suite .s-nav-toggle .s-nav-choice { min-height: 44px; padding: .45em .8em; border: 0; background: transparent; }
#suite .s-nav-toggle .s-nav-choice[aria-pressed="true"] { background: var(--s-accent); color: var(--s-on-accent); box-shadow: none; }
#suite .s-navpad { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid var(--s-border);
  border-radius: 16px; background: rgba(255,255,255,.9); box-shadow: 0 2px 12px rgba(17,17,17,.12); touch-action: none; }
#suite .s-navpad[hidden] { display: none; }
#suite .s-navpad-row { display: flex; justify-content: center; gap: 4px; }
#suite .s-navpad .s-nav-key { width: 48px; height: 48px; min-width: 48px; min-height: 48px; padding: 0;
  font-size: 1.25em; touch-action: none; user-select: none; -webkit-user-select: none; }
#suite.s-hc .s-navpad, #suite.s-hc .s-nav-toggle { background: var(--s-bg); border: 2px solid var(--s-border); box-shadow: none; }

@media (min-width: 768px) {
  #suite .s-panel { left: 16px; top: 16px; bottom: 16px; width: clamp(20em, 36vw, 28em); max-width: calc(100vw - 32px);
    border-radius: var(--s-radius); }
}
@media (max-width: 767.98px) {
  #suite .s-panel { left: 0; right: 0; bottom: 0; max-height: 62vh; border-radius: var(--s-radius) var(--s-radius) 0 0; }
  /* The footer keeps the bottom-right corner free for the camera chip dock (about 110 px
     wide); its two buttons stay on one row and wrap their text instead. */
  #suite .s-panel-foot { padding-right: 124px; min-height: var(--s-dock-clear); align-items: center; flex-wrap: nowrap;
    padding-bottom: calc(0.6em + env(safe-area-inset-bottom)); }
  #suite .s-panel-foot button { flex: 0 1 auto; padding-left: 0.7em; padding-right: 0.7em; }
  #suite .s-strip { flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity; }
  #suite .s-strip li { flex: none; max-width: 70vw; scroll-snap-align: start; }
  #suite h1 { font-size: 1.4em; }
}

/* Close-up */
#suite .s-lightbox { position: absolute; inset: 0; pointer-events: auto; background: var(--s-bg); display: flex; flex-direction: column; }
#suite .s-lightbox-bar { display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center; padding: 0.6em 1em;
  background: var(--s-surface); border-bottom: 1px solid var(--s-surface-2); }
#suite .s-lightbox-bar h2 { flex: 1 1 10em; }
#suite .s-lightbox-stage { position: relative; flex: 1 1 auto; min-height: 30vh; overflow: hidden; touch-action: none;
  background: var(--s-surface-2); cursor: zoom-in; }
#suite .s-lightbox-stage.s-zoomed { cursor: grab; }
#suite .s-lightbox-stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
  transform-origin: 50% 50%; user-select: none; -webkit-user-drag: none; }
#suite .s-lightbox-info { padding: 0.8em 1em calc(var(--s-dock-clear) + 0.4em); background: var(--s-surface);
  display: flex; flex-direction: column; gap: 0.5em; max-height: 40vh; overflow: auto; }

#suite dl.s-facts { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.4em 1em; margin: 0; }
#suite dl.s-facts dt { color: var(--s-muted); }
#suite dl.s-facts dd { margin: 0; font-weight: 600; text-align: end; }
#suite .s-vision-block { border: 2px dashed var(--s-border); background: var(--s-surface-2); }
`
