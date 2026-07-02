// Avatar cards in the right rail: preview glyph, name, capability chip.
// Click selects (writes config); cards reflect config changes from any
// source (button cycle, palette, URL). Capability metadata stays simple —
// a label per avatar, no audit machinery (P6 fills these out).

import { config, setConfig, onConfigChange } from '../config';
import { type AvatarId, isAvatarAvailable } from '../rig/avatarRegistry';

interface CardDef {
  id: AvatarId;
  label: string;
  glyph: string;
  chip: string;
  chipClass: 'ok' | 'exp' | 'warn';
  /** one-line limitation, instrument language */
  note: string;
}

const CARDS: CardDef[] = [
  // honest labels (Gate-3 live findings): neither default avatar has
  // movable finger geometry; the robot's face-touch reads reach-to-collar
  { id: 'robot', label: 'robot', glyph: '◼', chip: 'Fingers not supported', chipClass: 'warn',
    note: 'mitt hands; face-touch lands at the collar' },
  { id: 'astronaut', label: 'astronaut', glyph: '▲', chip: 'Fingers not supported', chipClass: 'warn',
    note: 'mitten gloves; face-touch and body fully supported' },
  { id: 'woody', label: 'woody', glyph: '◆', chip: 'Experimental · local', chipClass: 'exp',
    note: 'local file only — never ships with the app' },
];

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
