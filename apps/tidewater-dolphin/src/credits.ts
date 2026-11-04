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

/** Asset-integration pass: the imported scenery models (public/models/additions/, CREDITS.md and manifest.json there). */
export const ADDITIONS_NOTICE =
  'Optional scenery additions (Play tab → Scenery additions, Enhanced): models from the user\'s own model library, ' +
  'converted for Tidewater. CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/), modified for BodyArcade: ' +
  '"Animated Kelp" by JosephWPugsley (https://sketchfab.com/3d-models/74c400fd4d81469199268ac27451d03f); ' +
  '"Kelp" by Mazelya (https://sketchfab.com/3d-models/d1758bd85ec04eaab14fe50028108a10); ' +
  '"Sea Weed" by rkuhlf (https://sketchfab.com/3d-models/d97c596b189845b681cc8eef8a3ab429); ' +
  '"Fantasy Fishing Boat" by eb78 (https://sketchfab.com/3d-models/bf7d68cb9db5469a9895064de1499d68); ' +
  '"Ancient column" by OdinTdh (https://opengameart.org/content/ancient-column). ' +
  'CC0: Medieval Stone Temple and Medieval Boat by AnyRPG, Broken Stone Slab by Kutejnikov, Figure Head Human Statute by DaGameKnower, ' +
  'Free Photogrammetric Rock / Rock 2 / Rock Cluster by Yughues, Rock by kindland, Mossy Rock by hooded_kian, ' +
  '3TD Harbour Pack, 3TD Cave Pack Pro and 3TD Fantasy Ruins Pack by Ron Kapaun, Low Poly Manatee by DevMops, Shark (low poly) by STKRudy85 ' +
  '(all OpenGameArt.org); Wild Rooibos Bush, Shrub 03, Dry Branches Medium 01 and Bark Debris 01 by Poly Haven (polyhaven.com). ' +
  'Full list with source pages and checksums: models/additions/CREDITS.md.';

export const TIDEWATER_NOTICE =
  'Tidewater — island, ocean, sky, rendering engine and environment — by Daniel Greenheck / ' +
  'DRG Software Solutions LLC, MIT License (Copyright (c) 2026 DRG Software Solutions LLC), ' +
  'https://github.com/dgreenheck/tidewater, pinned at commit 4811ba4. Third-party assets in Tidewater ' +
  '(Freesound CC0 recordings, Poly Haven CC0 scans and textures, Microsoft Rocketbox MIT characters, ' +
  'OFL / Apache fonts, SMAA lookup textures from three.js) keep their own licences; see ' +
  'vendor/tidewater/CREDITS.md.';

const CONTROLS_HTML = `
	<section>
		<h3>Swim — Dolphin (default · Modern scheme)</h3>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Space</kbd></span><span class="tw-help-text">Swim<small>Hold to swim and keep speed; let go and you glide. A tap is one tail stroke.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>W</kbd><kbd>S</kbd></span><span class="tw-help-text">Dive and climb<small>W noses down, S noses up (Invert vertical in Dolphin Controls). Speed plus a nose-up near the surface breaches.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>A</kbd><kbd>D</kbd></span><span class="tw-help-text">Turn<small>Banks on its own — tight when slow, wide when fast. Brake into a turn to tighten it.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Shift</kbd></span><span class="tw-help-text">Charge<small>Hold for the fast swim (9 m/s); let go and it eases back to cruise.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>X</kbd></span><span class="tw-help-text">Brake<small>Slows to a hover in under a second</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>V</kbd></span><span class="tw-help-text">Camera style<small>Follow · Remote · Surface</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>R</kbd></span><span class="tw-help-text">Recenter the camera</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd class="tw-kbd-ico" aria-label="Mouse">🖱</kbd></span><span class="tw-help-text">Look around<small>Drag on the view with either button. As you swim on, the camera settles behind you again.</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span><span class="tw-help-text">Assist<small>Full · standard · expert</small></span></div>
		<div class="tw-help-row"><span class="tw-keys">Gamepad</span><span class="tw-help-text">Left stick steers · RT (or A) swims — squeeze gently to cruise slowly · LB (or B) charges · LT (or X) brakes · right stick looks · Y changes the camera · click the right stick to recenter · Start opens the menu · Back opens this sheet.</span></div>
		<div class="tw-help-row"><span class="tw-keys">PosePuppet</span><span class="tw-help-text">Swim with your body<small>Kick rhythm, lean to pitch and bank, crouch / stretch for depth, hands forward to burst. The keyboard and a live gamepad win while you use them. The Legacy BodyArcade scheme (Shift to kick, Space to burst, Q/E depth) is in Dolphin Controls (H → Play).</small></span></div>
	</section>
	<section>
		<h3>Walking · Boat — Play tab (H)</h3>
		<div class="tw-help-row"><span class="tw-keys"><span class="tw-wasd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span class="tw-help-text">Move · throttle and steer<small>Tidewater's own walker and boat</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd class="tw-kbd-ico" aria-label="Mouse">🖱</kbd></span><span class="tw-help-text">Look around<small>Click the view to capture the mouse, Esc releases it</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Shift</kbd></span><span class="tw-help-text">Sprint, boat boost</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>Space</kbd></span><span class="tw-help-text">Jump, swim up</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>C</kbd></span><span class="tw-help-text">Dive</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>E</kbd></span><span class="tw-help-text">Interact<small>Board, helm, step ashore, trade</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>V</kbd></span><span class="tw-help-text">Boat camera<small>1st / 3rd person. In Dolphin mode, V cycles Follow · Remote · Surface.</small></span></div>
	</section>
	<section>
		<h3>Fishing — when enabled (Play tab)</h3>
		<div class="tw-help-row"><span class="tw-keys"><kbd>R</kbd></span><span class="tw-help-text">Fishing rod<small>Take out / put away (walking, pier, deck)</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>LMB</kbd></span><span class="tw-help-text">Cast, strike, reel<small>Hold to wind up / reel</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>RMB</kbd></span><span class="tw-help-text">Reel in an empty line</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>I</kbd></span><span class="tw-help-text">Cooler and fish log</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>E</kbd></span><span class="tw-help-text">Sell to Joe, buy from Marta</span></div>
	</section>
	<section>
		<h3>Interface</h3>
		<div class="tw-help-row"><span class="tw-keys"><kbd>F</kbd></span><span class="tw-help-text">Free camera<small>Review camera; the player waits</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>T</kbd></span><span class="tw-help-text">Pause time</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>L</kbd></span><span class="tw-help-text">Flashlight</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>M</kbd></span><span class="tw-help-text">Mute</span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>H</kbd></span><span class="tw-help-text">Settings panel<small>Play tab: mode, fishing, Dolphin Controls, scenery additions</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>P</kbd></span><span class="tw-help-text">Photo mode<small>Hides all interface</small></span></div>
		<div class="tw-help-row"><span class="tw-keys"><kbd>F1</kbd><kbd>?</kbd></span><span class="tw-help-text">This sheet</span></div>
	</section>`;

const CREDITS_HTML = `
	<span style="display:block;font-size:12px;line-height:1.5;opacity:.92">
		<b>Dolphin:</b> <a href="https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8" target="_blank" rel="noopener noreferrer">“Realistic Dolphin | Rigged with 25+ Animations”</a>
		by <a href="https://sketchfab.com/gamico" target="_blank" rel="noopener noreferrer">GAMICO</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC-BY&nbsp;4.0</a>
		— modified for BodyArcade (the Jump clip’s baked root translation is stripped at load; full licence at <code>models/dolphin/LICENSE-dolphin.txt</code>).<br>
		<b>World:</b> <a href="https://github.com/dgreenheck/tidewater" target="_blank" rel="noopener noreferrer">Tidewater</a> by Daniel Greenheck / DRG Software Solutions LLC, MIT (© 2026), pinned 4811ba4 — island, ocean, sky, engine, wildlife, audio (CC0 Freesound), Poly Haven CC0 scans, Microsoft Rocketbox MIT characters.
		<b>Dolphin gameplay:</b> BodyArcade (120 Hz swim sim, chase camera, PosePuppet body input).<br>
		<b>Scenery additions (Enhanced):</b> models from the user’s library — CC-BY 4.0, modified:
		<a href="https://sketchfab.com/3d-models/74c400fd4d81469199268ac27451d03f" target="_blank" rel="noopener noreferrer">“Animated Kelp”</a> by JosephWPugsley,
		<a href="https://sketchfab.com/3d-models/d1758bd85ec04eaab14fe50028108a10" target="_blank" rel="noopener noreferrer">“Kelp”</a> by Mazelya,
		<a href="https://sketchfab.com/3d-models/d97c596b189845b681cc8eef8a3ab429" target="_blank" rel="noopener noreferrer">“Sea Weed”</a> by rkuhlf,
		<a href="https://sketchfab.com/3d-models/bf7d68cb9db5469a9895064de1499d68" target="_blank" rel="noopener noreferrer">“Fantasy Fishing Boat”</a> by eb78,
		<a href="https://opengameart.org/content/ancient-column" target="_blank" rel="noopener noreferrer">“Ancient column”</a> by OdinTdh
		(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC-BY&nbsp;4.0</a>);
		CC0 models by AnyRPG, Kutejnikov, DaGameKnower, Yughues, kindland, hooded_kian, Ron Kapaun, DevMops, STKRudy85 (OpenGameArt) and Poly Haven —
		full list at <code>models/additions/CREDITS.md</code>.
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
    if (sub) sub.textContent = 'BodyArcade dolphin in the Tidewater island. Hold Space to swim, WASD to steer, Shift to charge, X to brake. Drag the view to look. Walking, boat, fishing and Dolphin Controls are in the Play tab (H).';
  }
  const start = ui.startEl;
  if (start) {
    const keys = start.querySelector('.tw-start-keys');
    if (keys) {
      keys.innerHTML =
        '<span><kbd>Space</kbd>Swim</span>' +
        '<span><span class="tw-wasd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>Dive · turn · climb</span>' +
        '<span><kbd>Shift</kbd>Charge</span>' +
        '<span><kbd>X</kbd>Brake</span>' +
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
    <p>${ADDITIONS_NOTICE}</p>
    <p><a style="color:#8fd4ff" href="./">← back to the game</a></p></div>`;
  document.body.appendChild(el);
}
