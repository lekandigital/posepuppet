// Minimal profile/mode selector — mono chips under the identity chip.
// Deliberately tiny: profiles are URL-addressable render/content packs;
// switching reloads with the same mode where the target profile ships it.

import type { ModeId, ProfileId } from '../profiles/types';

const MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";

export function createSelector(
  container: HTMLElement,
  registered: ProfileId[],
  activeProfile: ProfileId,
  modes: ModeId[],
  activeMode: string,
): { dispose(): void } {
  const wrap = document.createElement('div');
  wrap.dataset.testid = 'ow-selector';
  wrap.style.cssText = [
    'position:fixed', 'top:52px', 'left:12px', 'display:flex', 'gap:6px',
    'z-index:30',
  ].join(';');

  const mkSelect = (
    testid: string, options: { v: string; label: string; disabled?: boolean }[],
    active: string, onChange: (v: string) => void,
  ): HTMLSelectElement => {
    const sel = document.createElement('select');
    sel.dataset.testid = testid;
    sel.style.cssText = [
      'appearance:none', 'padding:4px 10px', 'background:rgba(10,12,16,0.78)',
      'border:1px solid rgba(255,255,255,0.16)', 'border-radius:4px',
      `font:11px/1.3 ${MONO}`, 'color:#cfd8e3', 'letter-spacing:0.06em',
      'cursor:pointer',
    ].join(';');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.label;
      opt.disabled = !!o.disabled;
      opt.selected = o.v === active;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.appendChild(sel);
    return sel;
  };

  const ALL_PROFILES: { id: ProfileId; label: string }[] = [
    { id: 'low-poly', label: 'LOW-POLY' },
    { id: 'realistic', label: 'REALISTIC' },
    { id: 'fantasy-game', label: 'FANTASY' },
  ];
  mkSelect(
    'ow-profile-select',
    ALL_PROFILES.map((p) => ({ v: p.id, label: p.label, disabled: !registered.includes(p.id) })),
    activeProfile,
    (v) => {
      const u = new URL(location.href);
      u.searchParams.set('profile', v);
      location.href = u.toString();
    },
  );

  mkSelect(
    'ow-mode-select',
    [...modes.map((m) => ({ v: m, label: m.toUpperCase() })), { v: 'flyover', label: 'FLYOVER' }],
    activeMode,
    (v) => {
      const u = new URL(location.href);
      u.searchParams.set('mode', v);
      location.href = u.toString();
    },
  );

  container.appendChild(wrap);
  return { dispose: () => wrap.remove() };
}
