// In-app credits (Checkpoint 01): the CC-BY attribution must remain
// accessible to all end users (Sketchfab policy / Track C §1 Item 1).
// `?view=credits` renders this panel; CREDITS.md at the repo root mirrors
// it; LICENSE-dolphin.txt ships beside the model file.

/** Exact attribution string — Implementation Master §8.1, verbatim. */
export const CREDITS_ATTRIBUTION =
  '"Realistic Dolphin | Rigged with 25+ Animations" by GAMICO ' +
  '(https://sketchfab.com/gamico) is licensed under CC-BY 4.0 ' +
  '(https://creativecommons.org/licenses/by/4.0/). Source: ' +
  'https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8 ' +
  '— Modified for BodyArcade (see CREDITS.md for changes).';

export function mountCredits(root: HTMLElement): void {
  const el = document.createElement('div');
  el.id = 'credits';
  el.style.cssText =
    'max-width:44rem;margin:8vh auto;padding:0 1.5rem;color:#dfe8ee;' +
    'font:15px/1.6 -apple-system,system-ui,sans-serif;';
  el.innerHTML = `
    <h1 style="font-size:1.3rem;margin-bottom:1rem">BodyArcade Shared World — credits</h1>
    <h2 style="font-size:1rem;margin:1.2rem 0 .4rem">Dolphin</h2>
    <p>
      <a style="color:#8fd4ff" href="https://sketchfab.com/3d-models/realistic-dolphin-rigged-with-25-animations-c16124a10efd4381b1a84468ad6ef7a8"
         target="_blank" rel="noopener noreferrer">&ldquo;Realistic Dolphin | Rigged with 25+ Animations&rdquo;</a>
      by <a style="color:#8fd4ff" href="https://sketchfab.com/gamico" target="_blank" rel="noopener noreferrer">GAMICO</a>
      is licensed under
      <a style="color:#8fd4ff" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC-BY&nbsp;4.0</a>.
      Modified for BodyArcade: the Jump clip&rsquo;s baked root translation is stripped at load
      (see CREDITS.md in the repository for the current list of changes; full license text ships
      beside the model at <code>models/dolphin/LICENSE-dolphin.txt</code>).
    </p>
    <h2 style="font-size:1rem;margin:1.2rem 0 .4rem">Water</h2>
    <p>
      Water rendering by
      <a style="color:#8fd4ff" href="https://github.com/jeantimex/threejs-water" target="_blank" rel="noopener noreferrer">jeantimex/threejs-water</a>
      (MIT) — a Three.js port of Evan Wallace&rsquo;s WebGL water. Pool tile texture from zooboing on Flickr.
    </p>
    <p style="margin-top:2rem">
      <a style="color:#8fd4ff" href="?view=pool">&larr; back to the pool</a> ·
      <a style="color:#8fd4ff" href="?view=stock">stock water demo</a>
    </p>`;
  document.body.style.background = '#0b141a';
  root.appendChild(el);
}
