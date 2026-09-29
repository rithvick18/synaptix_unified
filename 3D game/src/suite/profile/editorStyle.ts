/** Styles for the caregiver editor, all scoped under its root id. */
export const ROOT_ID = 'suite-caregiver-setup'

const R = `#${ROOT_ID}`

export const EDITOR_CSS = `
${R}{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#f8f5ee;color:#1b271f;font-size:18px;line-height:1.5;box-sizing:border-box;overflow:hidden;overflow:clip;z-index:1000;pointer-events:auto}
${R}::backdrop{background:rgba(12,26,18,.9)}
${R} *,${R} *::before,${R} *::after{box-sizing:border-box}
${R} .scs-frame{display:flex;flex-direction:column;height:100%}
${R} .scs-header{padding:14px 16px 10px;border-bottom:1px solid #bfb7a5;background:#fffdf8}
${R} .scs-header p{margin:4px 0 0;max-width:70ch}
${R} .scs-main{flex:1;min-height:0;position:relative;overflow:auto;overscroll-behavior:contain;padding:4px 16px 40px}
${R} .scs-inner{max-width:980px;margin:0 auto}
${R} .scs-footer{border-top:1px solid #bfb7a5;background:#fffdf8;padding:8px 16px;max-height:45vh;overflow:auto}
${R} .scs-footer .scs-inner{display:flex;flex-direction:column;gap:4px}
${R} .scs-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
${R} h2{font-size:1.55rem;line-height:1.25;margin:0}
${R} h3{font-size:1.3rem;line-height:1.3;margin:0 0 8px}
${R} h4{font-size:1.1rem;margin:0 0 8px}
${R} p{margin:6px 0}
${R} section.scs-section{background:#fffdf8;border:1px solid #c9c1ae;border-radius:12px;padding:16px;margin:16px 0}
${R} .scs-note{background:#eef3ec;border-left:6px solid #2c5f45;padding:10px 12px;border-radius:6px}
${R} .scs-field{margin:12px 0;min-width:0}
${R} label,${R} legend{font-weight:600;display:block;margin-bottom:4px}
${R} fieldset{border:1px solid #c9c1ae;border-radius:10px;padding:10px 12px;margin:12px 0;min-width:0}
${R} .scs-hint{color:#39463d;font-size:.95rem;margin:4px 0 0;font-weight:400}
${R} input[type=text],${R} textarea,${R} select{display:block;width:100%;min-height:48px;padding:10px 12px;border:2px solid #56655a;border-radius:8px;background:#fff;color:#131d16;font:inherit}
${R} textarea{min-height:96px;resize:vertical}
${R} button{min-height:48px;min-width:48px;padding:10px 18px;border:2px solid #2c5f45;border-radius:10px;background:#e6efe5;color:#132b1d;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
${R} button:hover{background:#d6e6d4}
${R} button.scs-primary{background:#1e5a3e;color:#fff;border-color:#1e5a3e}
${R} button.scs-primary:hover{background:#174a33}
${R} button.scs-danger{border-color:#8a2c1b;color:#7a2515;background:#fbefea}
${R} button:disabled{opacity:.55;cursor:not-allowed}
${R} :focus-visible{outline:3px solid #0a4fc4;outline-offset:3px;box-shadow:0 0 0 6px #fff}
${R} .scs-check{display:flex;align-items:center;gap:12px;min-height:48px;font-weight:600;cursor:pointer;margin:0}
${R} input[type=checkbox],${R} input[type=radio]{width:28px;height:28px;margin:0;flex:none;accent-color:#1e5a3e}
${R} .scs-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
${R} .scs-chips button{border-radius:999px;background:#fff}
${R} .scs-chips button[aria-pressed=true]{background:#1e5a3e;color:#fff}
${R} .scs-chips button[aria-pressed=true]::before{content:"\\2713\\00a0"}
${R} .scs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px}
${R} .scs-card{border:1px solid #c9c1ae;border-radius:10px;padding:12px;background:#fff;min-width:0}
${R} .scs-thumb{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#e8e2d4;border-radius:6px}
${R} .scs-thumb-empty{display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;color:#39463d}
${R} .scs-option{display:flex;gap:12px;align-items:flex-start;border:2px solid #c9c1ae;border-radius:10px;padding:10px;min-height:48px;cursor:pointer;background:#fff;font-weight:400;margin:0}
${R} .scs-option:has(input:checked){border-color:#1e5a3e;background:#edf5ec}
${R} .scs-option .scs-option-body{flex:1;min-width:0}
${R} .scs-option .scs-thumb{margin-top:8px;max-width:320px}
${R} .scs-option strong{display:block}
${R} .scs-problem{color:#86271a;font-weight:600}
${R} .scs-errors:empty,${R} .scs-status:empty{display:none}
${R} .scs-errors{color:#86271a;font-weight:600;margin:0;padding-left:1.2em}
${R} details.scs-object{border:1px solid #c9c1ae;border-radius:10px;margin:8px 0;background:#fff}
${R} details.scs-object>summary{min-height:56px;display:flex;align-items:center;gap:12px;cursor:pointer;padding:6px 12px;font-weight:600;list-style:none}
${R} details.scs-object>summary::-webkit-details-marker{display:none}
${R} details.scs-object>summary::after{content:"+";margin-left:auto;font-size:1.4rem}
${R} details.scs-object[open]>summary::after{content:"\\2212"}
${R} details.scs-object>div{padding:0 12px 12px}
${R} .scs-mini{width:56px;height:56px;object-fit:contain;background:#e8e2d4;border-radius:6px;flex:none}
${R} .scs-badge{display:inline-block;font-size:.85rem;font-weight:600;border:1px solid currentColor;border-radius:999px;padding:0 8px;margin-left:6px}
${R} .scs-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
${R} .scs-row>.scs-field{flex:1 1 180px;margin:4px 0}
${R} ol.scs-sequence{padding-left:0;list-style:none;margin:8px 0}
${R} ol.scs-sequence li{display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-bottom:1px solid #d8d1c1;padding:6px 0}
${R} .scs-seq-label{flex:1 1 200px;min-width:0;overflow-wrap:anywhere}
${R} .scs-seq-num{font-weight:700;min-width:2ch}
${R} audio{display:block;width:100%;min-height:48px;margin:6px 0}
${R} .scs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
${R} .scs-record{margin:6px 0}
@media (max-width:480px){${R}{font-size:17px}${R} section.scs-section{padding:12px}${R} button{padding:10px 14px}${R} fieldset{padding:8px}}
@media (forced-colors:active){${R} .scs-chips button[aria-pressed=true]{outline:3px solid CanvasText}}
`
