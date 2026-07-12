// Injected, pp-hud-scoped styles in the frozen PosePuppet grammar:
// graphite glass, 1px rules, mono status labels, role-bound accents
// (cyan = live signal, violet = predicted, green-white = privacy).
// Dark chrome always — the games are dark stages; the HUD is system chrome.

export const HUD_STYLE_ID = 'pp-hud-styles';

export const HUD_CSS = /* css */ `
.pp-hud {
  --pph-glass: rgba(13, 17, 25, 0.82);
  --pph-pane: #0d1119;
  --pph-ink: #e9f1ff;
  --pph-ink-2: #aebdd6;
  --pph-ink-3: #66748f;
  --pph-rule: #2a3650;
  --pph-blue: #2f6bff;
  --pph-cyan: #3fe0ff;
  --pph-violet: #9d7bff;
  --pph-glow: #c8ffdf;
  --pph-warn: #ffb454;
  --pph-danger: #ff4d6a;
  position: fixed;
  z-index: 60;
  width: 172px;
  color: var(--pph-ink);
  font-family: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  /* No backdrop-filter: real blur over a live WebGL canvas costs frames
     (measured ~4 fps on flight) — fake the glass with opacity instead,
     the pass-2 rule for chrome over live video/canvas regions. */
  background: rgba(10, 14, 22, 0.92);
  border: 1px solid var(--pph-rule);
  user-select: none;
  transition: width 160ms ease;
}
.pp-hud[data-pos="bottom-left"]  { left: var(--pph-x, 12px); bottom: var(--pph-y, 12px); }
.pp-hud[data-pos="bottom-right"] { right: var(--pph-x, 12px); bottom: var(--pph-y, 12px); }
.pp-hud[data-pos="top-left"]     { left: var(--pph-x, 12px); top: var(--pph-y, 12px); }
.pp-hud[data-pos="top-right"]    { right: var(--pph-x, 12px); top: var(--pph-y, 12px); }
.pp-hud:focus-visible { outline: 2px solid var(--pph-cyan); outline-offset: 2px; }
.pp-hud[data-size="expanded"] { width: 224px; }

.pp-hud-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-bottom: 1px solid var(--pph-rule);
}
.pp-hud[data-open="collapsed"]:not(.pp-hud-peek) .pp-hud-head { border-bottom: none; }
.pp-hud-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--pph-ink-3);
  flex: none;
}
.pp-hud-dot[data-s="live"] { background: var(--pph-cyan); box-shadow: 0 0 8px rgba(63,224,255,0.6); }
.pp-hud-dot[data-s="warn"] { background: var(--pph-warn); }
.pp-hud-dot[data-s="bad"]  { background: var(--pph-danger); }
.pp-hud-title { color: var(--pph-ink-2); font-weight: 600; }
.pp-hud-track { flex: 1; text-align: right; color: var(--pph-ink-2); white-space: nowrap; overflow: hidden; }
.pp-hud-btn {
  all: unset;
  cursor: pointer;
  color: var(--pph-ink-3);
  padding: 0 3px;
  line-height: 1;
  font-family: inherit;
  font-size: 10px;
}
.pp-hud-btn:hover, .pp-hud-btn:focus-visible { color: var(--pph-cyan); }
.pp-hud-btn:focus-visible { outline: 1px solid var(--pph-cyan); outline-offset: 1px; }

.pp-hud-stage {
  position: relative;
  height: 128px;
  background: var(--pph-pane);
  overflow: hidden;
  transition: height 160ms ease;
}
.pp-hud[data-size="expanded"] .pp-hud-stage { height: 168px; }
.pp-hud[data-open="collapsed"]:not(.pp-hud-peek) .pp-hud-stage,
.pp-hud[data-open="collapsed"]:not(.pp-hud-peek) .pp-hud-foot { display: none; }
.pp-hud-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.pp-hud[data-feed="camera"] .pp-hud-canvas { display: none; }
.pp-hud-cam {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: none;
}
.pp-hud[data-feed="camera"] .pp-hud-cam { display: block; }
.pp-hud-msg {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
  color: var(--pph-ink-2);
  line-height: 1.6;
}
.pp-hud[data-msg="1"] .pp-hud-msg { display: flex; }
.pp-hud[data-msg="1"] .pp-hud-canvas, .pp-hud[data-msg="1"] .pp-hud-cam { display: none; }
.pp-hud-start {
  all: unset;
  position: absolute;
  left: 50%; bottom: 8px;
  transform: translateX(-50%);
  display: none;
  cursor: pointer;
  padding: 3px 8px;
  border: 1px solid var(--pph-rule);
  color: var(--pph-cyan);
  background: rgba(47, 107, 255, 0.12);
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.06em;
}
.pp-hud[data-startable="1"] .pp-hud-start { display: block; }
.pp-hud-start:hover, .pp-hud-start:focus-visible { border-color: var(--pph-cyan); }
.pp-hud-swap {
  all: unset;
  position: absolute;
  right: 4px; top: 4px;
  cursor: pointer;
  padding: 2px 5px;
  border: 1px solid var(--pph-rule);
  color: var(--pph-ink-3);
  background: rgba(13, 17, 25, 0.6);
  font-family: inherit;
  font-size: 9px;
}
.pp-hud-swap:hover, .pp-hud-swap:focus-visible { color: var(--pph-cyan); border-color: var(--pph-cyan); }
.pp-hud[data-swap="0"] .pp-hud-swap { display: none; }

.pp-hud-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 7px;
  border-top: 1px solid var(--pph-rule);
  color: var(--pph-ink-3);
}
.pp-hud-privacy { color: var(--pph-glow); white-space: nowrap; overflow: hidden; }
/* compact width fits "LOCAL INFERENCE"; the expanded panel affords the rest */
.pp-hud[data-size="expanded"] .pp-hud-privacy::after { content: " · NO UPLOADS"; }
.pp-hud-flash {
  /* display, not opacity: an invisible span still takes layout width and
     was squeezing the privacy line into truncation */
  display: none;
  color: var(--pph-cyan);
  white-space: nowrap;
}
.pp-hud-flash[data-on="1"] { display: inline; }

@media (prefers-reduced-motion: reduce) {
  .pp-hud, .pp-hud-stage, .pp-hud-flash { transition: none; }
}
`;

export function injectHudStyles(doc: Document): void {
  if (doc.getElementById(HUD_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = HUD_STYLE_ID;
  el.textContent = HUD_CSS;
  doc.head.append(el);
}
