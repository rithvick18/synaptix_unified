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
  background: radial-gradient(120% 90% at 20% 0%, var(--s-surface) 0%, var(--s-bg) 60%); }
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

#suite .s-card { background: var(--s-surface); border: 1px solid var(--s-surface-2); border-radius: var(--s-radius);
  padding: 1em; display: flex; flex-direction: column; gap: var(--s-gap);
  box-shadow: 0 1px 2px rgba(60, 40, 20, .06), 0 6px 18px rgba(60, 40, 20, .06); }
#suite.s-hc .s-card { border: 2px solid var(--s-border); box-shadow: none; }
#suite .s-card.s-separate { background: var(--s-surface-2); border-style: dashed; border-color: var(--s-border); }
#suite .s-divider { border: 0; border-top: 1px solid var(--s-border); margin: 0.5em 0; opacity: .6; }
#suite .s-row { display: flex; flex-wrap: wrap; gap: var(--s-gap); align-items: center; }
#suite .s-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13em), 1fr)); gap: var(--s-gap); }

#suite button, #suite .s-button { font: inherit; color: var(--s-text); background: var(--s-surface);
  border: 2px solid var(--s-border); border-radius: 12px; min-height: 48px; min-width: 48px;
  padding: 0.45em 1em; cursor: pointer; text-align: center; line-height: 1.3; overflow-wrap: break-word; }
/* In flex rows, never shrink a button below its longest word (an explicit min-width would
   otherwise let flex squeeze it and break words mid-way, e.g. Devanagari at large text). */
#suite .s-row > button, #suite .s-actions button, #suite .s-panel-foot button, #suite .s-strip button,
#suite .s-lightbox-bar button { min-width: min-content; }
#suite button:hover { background: var(--s-accent-soft); color: var(--s-on-accent-soft); }
#suite button.s-primary { background: var(--s-accent); border-color: var(--s-accent); color: var(--s-on-accent); font-weight: 600; }
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

/* Overlays (pause, settings, exit question, loading) */
#suite .s-layer { position: absolute; inset: 0; pointer-events: auto; display: grid; place-items: center;
  padding: 16px 16px calc(var(--s-dock-clear) + 8px); background: rgba(43, 38, 32, .45); overflow: auto; }
#suite.s-hc .s-layer { background: rgba(0, 0, 0, .6); }
#suite .s-dialog { width: min(34em, 100%); max-height: 100%; overflow: auto; }

/* Explore panel: side panel from 768 px, bottom sheet below */
#suite .s-panel { position: absolute; pointer-events: auto; background: var(--s-surface); color: var(--s-text);
  display: flex; flex-direction: column; box-shadow: 0 8px 30px rgba(40, 28, 16, .22); }
#suite.s-hc .s-panel { border: 2px solid var(--s-border); box-shadow: none; }
#suite .s-panel-body { overflow: auto; padding: 1em; display: flex; flex-direction: column; gap: 0.8em; min-height: 0; flex: 1 1 auto; }
#suite .s-panel-foot { flex: none; display: flex; flex-wrap: wrap; gap: 0.5em; padding: 0.6em 1em;
  border-top: 1px solid var(--s-surface-2); }
#suite .s-prompt { font-size: 1.15em; line-height: 1.45; }
#suite .s-cue { color: var(--s-cue); font-style: italic; }
#suite .s-actions { display: flex; flex-wrap: wrap; gap: 0.5em; }
#suite .s-actions button { flex: 1 1 auto; }
#suite .s-objects { display: flex; flex-direction: column; gap: 0.5em; }
#suite .s-strip { list-style: none; margin: 0; padding: 0 0 4px; display: flex; flex-wrap: wrap; gap: 0.5em; }
#suite .s-strip button { text-align: start; }
#suite .s-strip button.s-current { border-color: var(--s-accent); box-shadow: inset 0 0 0 2px var(--s-accent); }
#suite .s-caregiver { border-top: 1px dashed var(--s-border); padding-top: 0.8em; display: flex; flex-direction: column; gap: 0.6em; }
#suite .s-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4em; }
#suite .s-items button { width: 100%; text-align: start; }

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
