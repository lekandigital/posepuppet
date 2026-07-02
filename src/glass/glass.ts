/* glass.ts — aero-glass kit helpers.
   dressPane() injects the fx overlay layers (rim hairlines, corner caps,
   frost matte/gloss, diagonal shine, sparkles) that give a .ag-pane its
   full Save-76-style anatomy without cluttering the markup. */

export interface PaneFxOptions {
  /** rim hairlines + corner caps (default true) */
  rim?: boolean;
  /** frost matte + gloss top band (default true) */
  frost?: boolean;
  /** diagonal wet-shine streak (default true) */
  shine?: boolean;
  /** sparkle dot positions, in % of pane size */
  sparks?: Array<{ x: number; y: number; o?: number }>;
}

export function dressPane(pane: HTMLElement, opts: PaneFxOptions = {}): void {
  const { rim = true, frost = true, shine = true, sparks = [] } = opts;
  const fx = document.createElement('div');
  fx.className = 'ag-fx';
  fx.setAttribute('aria-hidden', 'true');

  const add = (cls: string): HTMLSpanElement => {
    const el = document.createElement('span');
    el.className = cls;
    fx.appendChild(el);
    return el;
  };

  if (frost) {
    add('ag-frost-matte');
    add('ag-frost-gloss');
  }
  if (shine) add('ag-shine');
  if (rim) {
    add('ag-rim-top');
    add('ag-rim-bottom');
    add('ag-rim-left');
    add('ag-rim-right');
    add('ag-cap ag-cap-tl');
    add('ag-cap ag-cap-tr');
    add('ag-cap ag-cap-bl');
    add('ag-cap ag-cap-br');
  }
  for (const s of sparks) {
    const el = add('ag-spark');
    el.style.left = `${s.x}%`;
    el.style.top = `${s.y}%`;
    if (s.o !== undefined) el.style.opacity = String(s.o);
  }

  // fx sits above the pane body but below its content
  pane.prepend(fx);
}
