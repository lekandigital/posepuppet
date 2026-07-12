// Avatar cards in the right rail: preview glyph, name, capability chip.
// Click selects (writes config); cards reflect config changes from any
// source (button cycle, palette, URL). Chips and limitation notes come
// from the capability manifest (data/avatar-capabilities.json) — the same
// reviewed data that gates finger fusion and face-touch, so a card can
// never promise what the gate refuses (V5).

import { config, setConfig, onConfigChange } from '../config';
import { type AvatarId, isAvatarAvailable } from '../rig/avatarRegistry';
import { capsFor } from '../rig/capabilities';

interface CardDef {
  id: AvatarId;
  label: string;
  glyph: string;
  chip: string;
  chipClass: 'ok' | 'exp' | 'warn';
  /** one-line limitation, instrument language */
  note: string;
}

const GLYPHS: Record<AvatarId, string> = { robot: '◼', astronaut: '▲', erika: '⬟', woody: '◆' };

const CARDS: CardDef[] = (['robot', 'astronaut', 'erika', 'woody'] as AvatarId[]).map((id) => {
  const caps = capsFor(id);
  return {
    id,
    label: id,
    glyph: GLYPHS[id],
    chip: caps.labels.chip,
    chipClass: caps.labels.chipClass,
    note: caps.labels.note,
  };
});

let listenerInstalled = false;

export function createAvatarCards(): void {
  const host = document.getElementById('avatar-cards');
  const count = document.getElementById('avatar-count');
  const stageAvatar = document.getElementById('stage-avatar');
  if (!host) return;

  const defs = CARDS.filter((c) => isAvatarAvailable(c.id));
  if (count) count.textContent = String(defs.length).padStart(2, '0');

  const els = new Map<AvatarId, HTMLButtonElement>();
  for (const def of defs) {
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.avatar = def.id;

    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.textContent = def.glyph;

    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = def.label;

    const chip = document.createElement('span');
    chip.className = `chip ${def.chipClass}`;
    chip.textContent = def.chip;

    const note = document.createElement('div');
    note.className = 'card-note';
    note.textContent = def.note;

    card.append(preview, nm, chip, note);
    card.onclick = () => setConfig('avatar', def.id);
    host.append(card);
    els.set(def.id, card);
  }

  function sync(): void {
    for (const [id, el] of els) el.classList.toggle('on', id === config.avatar);
    if (stageAvatar) stageAvatar.textContent = config.avatar.toUpperCase();
  }
  if (!listenerInstalled) {
    listenerInstalled = true;
    onConfigChange((key) => {
      if (key === 'avatar') {
        // cards may have been rebuilt since; resolve nodes fresh
        document.querySelectorAll<HTMLElement>('#avatar-cards .card[data-avatar]').forEach((el) => {
          el.classList.toggle('on', el.dataset.avatar === config.avatar);
        });
        const sa = document.getElementById('stage-avatar');
        if (sa && sa.isConnected) sa.textContent = config.avatar.toUpperCase();
      }
    });
  }
  sync();
}
