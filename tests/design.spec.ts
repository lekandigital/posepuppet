// Design-system verification: WCAG contrast on token pairs (both themes)
// and the prefers-reduced-motion smoke test. Runs on the live app with a
// fake webcam so the real shell (not a fixture page) is what's measured.
import { test, expect } from '@playwright/test';

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(rgb: [number, number, number]): number {
  return 0.2126 * srgbToLin(rgb[0]) + 0.7152 * srgbToLin(rgb[1]) + 0.0722 * srgbToLin(rgb[2]);
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function parseColor(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** token text/surface pairs: [foreground, background, minimum ratio] */
const PAIRS: Array<[string, string, number]> = [
  // body text
  ['--ink', '--base', 4.5],
  ['--ink', '--pane', 4.5],
  ['--ink', '--pane-2', 4.5],
  ['--ink-2', '--pane', 4.5],
  // mono labels (12px-ish uppercase, supplementary): 3:1 floor
  ['--ink-3', '--pane', 3.0],
  ['--ink-3', '--base', 3.0],
  // role accents where they carry text
  ['--cyan', '--pane', 3.0],
  ['--glow', '--base', 3.0],
  ['--warn', '--pane', 3.0],
];

for (const theme of ['dark', 'light'] as const) {
  test(`contrast: token pairs pass in ${theme} theme`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);

    const values = await page.evaluate((names) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const out: Record<string, string> = {};
      for (const name of names) {
        probe.style.color = `var(${name})`;
        out[name] = getComputedStyle(probe).color;
      }
      probe.remove();
      return out;
    }, [...new Set(PAIRS.flatMap(([f, b]) => [f, b]))]);

    const failures: string[] = [];
    for (const [fg, bg, min] of PAIRS) {
      const f = parseColor(values[fg]);
      const b = parseColor(values[bg]);
      expect(f, `${fg} parses`).not.toBeNull();
      expect(b, `${bg} parses`).not.toBeNull();
      const r = ratio(f!, b!);
      if (r < min) failures.push(`${theme}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
    }
    expect(failures).toEqual([]);
  });
}

test('reduced motion: animations are neutralized', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const durations = await page.evaluate(() => {
    const els = [
      document.querySelector('.live-badge'),
      document.getElementById('record-btn'),
      document.querySelector('.tick'),
    ].filter(Boolean) as Element[];
    return els.map((el) => {
      const cs = getComputedStyle(el);
      return { anim: cs.animationDuration, trans: cs.transitionDuration };
    });
  });
  for (const d of durations) {
    for (const v of [d.anim, d.trans]) {
      // "0.01ms" per the reduced-motion rule; anything ≥100ms means the
      // override failed
      const ms = parseFloat(v) * (v.endsWith('ms') ? 1 : 1000);
      expect(ms).toBeLessThan(100);
    }
  }
});

test('keyboard focus is visible on controls', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { width: cs.outlineWidth, style: cs.outlineStyle };
  });
  expect(outline).not.toBeNull();
  // focus-visible outline: 2px solid
  expect(outline!.style).not.toBe('none');
  expect(parseFloat(outline!.width)).toBeGreaterThanOrEqual(2);
});
