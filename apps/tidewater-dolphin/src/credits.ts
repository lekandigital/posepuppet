// In-app credits (Checkpoint 10). The dolphin's CC-BY attribution must remain accessible to all
// end users (Sketchfab policy / Track C §1 Item 1) and Tidewater's MIT notice travels with its
// code. Both are shown in Tidewater's own F1 controls sheet (the sheet's fishing rows and
// "how to play" are replaced with the dolphin controls), and `?credits` renders a plain page.
// Repo-root CREDITS.md mirrors this text.

/** Exact attribution string — Implementation Master §8.1, verbatim (unchanged from shared-world). */
export const CREDITS_ATTRIBUTION =
  '"Realistic Dolphin | Rigged with 25+ Animations" by GAMICO ' +
  '(https://sketchfab.com/gamico) is licensed under CC-BY 4.0 ' +
  '(https://creativecommons.org/licenses/by/4.0/). Source: ' +
  'https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8 ' +
  '— Modified for BodyArcade (see CREDITS.md for changes).';

export const TIDEWATER_NOTICE =
  'Tidewater — island, ocean, sky, rendering engine and environment — by Daniel Greenheck / ' +
  'DRG Software Solutions LLC, MIT License (Copyright (c) 2026 DRG Software Solutions LLC), ' +
  'https://github.com/dgreenheck/tidewater, pinned at commit 4811ba4. Third-party assets in Tidewater ' +
  '(Freesound CC0 recordings, Poly Haven CC0 scans and textures, Microsoft Rocketbox MIT characters, ' +
  'OFL / Apache fonts, SMAA lookup textures from three.js) keep their own licences; see ' +
  'vendor/tidewater/CREDITS.md.';

const CONTROLS_HTML = `
	<section>
		<h3>Swim</h3>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Shift</kbd></span><span class="tw-help-text">Kick<small>Tap for one kick, hold for a steady rhythm</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>W</kbd><kbd>S</kbd></span><span class="tw-help-text">Pitch<small>W dives, S surfaces</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>A</kbd><kbd>D</kbd></span><span class="tw-help-text">Bank and turn</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Q</kbd><kbd>E</kbd></span><span class="tw-help-text">Depth trim<small>Q up, E down</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Space</kbd></span><span class="tw-help-text">Burst</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>X</kbd></span><span class="tw-help-text">Brake</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>R</kbd></span><span class="tw-help-text">Recenter the camera</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span><span class="tw-help-text">Assist<small>Full · standard · expert</small></span></div>
	</section>
	<section>
		<h3>Body input</h3>
		<div class="tw-help-row"><span class="tw-keys">PosePuppet</span><span class="tw-help-text">Swim with your body<small>Kick rhythm, lean to pitch and bank, crouch / stretch for depth, hands forward to burst. Keyboard always wins while touched.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>F</kbd></span><span class="tw-help-text">Free camera<small>Review camera; the dolphin waits</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>T</kbd></span><span class="tw-help-text">Pause time</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>L</kbd></span><span class="tw-help-text">Flashlight</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>M</kbd></span><span class="tw-help-text">Mute</span></div>
	</section>
	<section>
		<h3>Interface</h3>
		<div class="tw-help-row"><span class="tw-keys"><kbd>H</kbd></span><span class="tw-help-text">Settings panel</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>P</kbd></span><span class="tw-help-text">Photo mode<small>Hides all interface</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>F1</kbd><kbd>?</kbd></span><span class="tw-help-text">This sheet</span></div>
	</section>`;

const CREDITS_HTML = `
	<span style="display:block;font-size:12px;line-height:1.5;opacity:.92">
		<b>Dolphin:</b> <a href="https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8" target="_blank" rel="noopener noreferrer">“Realistic Dolphin | Rigged with 25+ Animations”</a>
		by <a href="https://sketchfab.com/gamico" target="_blank" rel="noopener noreferrer">GAMICO</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC-BY&nbsp;4.0</a>
		— modified for BodyArcade (the Jump clip’s baked root translation is stripped at load; full licence at <code>models/dolphin/LICENSE-dolphin.txt</code>).<br>
		<b>World:</b> <a href="https://github.com/dgreenheck/tidewater" target="_blank" rel="noopener noreferrer">Tidewater</a> by Daniel Greenheck / DRG Software Solutions LLC, MIT (© 2026), pinned 4811ba4 — island, ocean, sky, engine, wildlife, audio (CC0 Freesound), Poly Haven CC0 scans, Microsoft Rocketbox MIT characters.
		<b>Dolphin gameplay:</b> BodyArcade (120 Hz swim sim, chase camera, PosePuppet body input).
	</span>`;

/** Replace the fishing controls / guide in Tidewater's F1 sheet and start overlay with the dolphin's; add credits. */
export function installCredits(ui: { helpEl?: HTMLElement; startEl?: HTMLElement; root?: HTMLElement }): void {
  const help = ui.helpEl;
  if (help) {
    const grid = help.querySelector('.tw-help-grid');
    if (grid) grid.innerHTML = CONTROLS_HTML;
    const guide = help.querySelector('.tw-help-guide');
    if (guide) guide.innerHTML = CREDITS_HTML;
    const sub = help.querySelector('.tw-help-head p');
    if (sub) sub.textContent = 'BodyArcade dolphin in the Tidewater island. Keyboard or PosePuppet body input; no mouse look.';
  }
  const start = ui.startEl;
  if (start) {
    const keys = start.querySelector('.tw-start-keys');
    if (keys) {
      keys.innerHTML =
        '<span><kbd>Shift</kbd>Kick</span>' +
        '<span><span class="tw-wasd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>Pitch · bank</span>' +
        '<span><kbd>Space</kbd>Burst</span>' +
        '<span><kbd>R</kbd>Recenter</span>' +
        '<span><kbd>F1</kbd>All controls</span>';
    }
    const title = start.querySelector('.tw-start-title');
    if (title) title.insertAdjacentHTML('afterend', '<div style="margin-top:.35rem;font:500 13px/1.3 Inter,system-ui,sans-serif;letter-spacing:.18em;opacity:.85">BODYARCADE DOLPHIN</div>');
    const cta = start.querySelector('.tw-start-cta span:last-child');
    if (cta) cta.textContent = 'Click to swim';
  }
  if (new URLSearchParams(location.search).has('credits')) mountCreditsPage();
}

export function mountCreditsPage(): void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:1000;overflow:auto;background:#0b141a;color:#dfe8ee;font:15px/1.6 Inter,system-ui,sans-serif;padding:8vh 1.5rem;';
  el.innerHTML = `<div style="max-width:46rem;margin:0 auto">
    <h1 style="font-size:1.3rem">BodyArcade Tidewater Dolphin — credits</h1>
    <p>${CREDITS_ATTRIBUTION}</p>
    <p>${TIDEWATER_NOTICE}</p>
    <p><a style="color:#8fd4ff" href="./">← back to the game</a></p></div>`;
  document.body.appendChild(el);
}
