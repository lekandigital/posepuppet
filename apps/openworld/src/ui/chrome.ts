// Minimal game chrome in the frozen PosePuppet diagnostics language: mono,
// dark, 1px-bordered chips. Three pieces only: identity chip (region ·
// profile · mode), a status/coach line, and the ODbL attribution line
// (shipping requirement — always visible, never behind a toggle).

const MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";

export interface Chrome {
  setMode(label: string): void;
  setProfile(label: string): void;
  setStatus(text: string): void;
  /** transient line above the strip (coach/toast); empty hides */
  setCoach(text: string): void;
  dispose(): void;
}

export function createChrome(container: HTMLElement, region: string, attribution: string[]): Chrome {
  const chip = document.createElement('div');
  chip.dataset.testid = 'ow-chip';
  chip.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'padding:7px 12px',
    'background:rgba(10,12,16,0.78)', 'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:4px', `font:12px/1.4 ${MONO}`, 'color:#cfd8e3',
    'letter-spacing:0.06em', 'z-index:30', 'pointer-events:none', 'white-space:nowrap',
  ].join(';');
  const elRegion = document.createElement('span');
  elRegion.textContent = region.toUpperCase();
  const sep = () => {
    const s = document.createElement('span');
    s.textContent = ' · ';
    s.style.color = '#5d6a80';
    return s;
  };
  const elProfile = document.createElement('span');
  elProfile.dataset.testid = 'ow-profile';
  const elMode = document.createElement('span');
  elMode.dataset.testid = 'ow-mode';
  elMode.style.color = '#9fd8ff';
  chip.append(elRegion, sep(), elProfile, sep(), elMode);
  container.appendChild(chip);

  const status = document.createElement('div');
  status.dataset.testid = 'ow-status';
  status.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:14px', 'transform:translateX(-50%)',
    'padding:7px 12px', 'background:rgba(10,12,16,0.78)',
    'border:1px solid rgba(255,255,255,0.16)', 'border-radius:4px',
    `font:12px/1.4 ${MONO}`, 'color:#cfd8e3', 'letter-spacing:0.04em',
    'z-index:30', 'pointer-events:none', 'white-space:nowrap',
  ].join(';');
  container.appendChild(status);

  const coach = document.createElement('div');
  coach.dataset.testid = 'ow-coach';
  coach.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:52px', 'transform:translateX(-50%)',
    'padding:6px 12px', 'background:rgba(10,12,16,0.72)',
    'border:1px solid rgba(255,255,255,0.12)', 'border-radius:4px',
    `font:12px/1.4 ${MONO}`, 'color:#9fb4d8', 'z-index:30',
    'pointer-events:none', 'display:none',
  ].join(';');
  container.appendChild(coach);

  const attrib = document.createElement('div');
  attrib.dataset.testid = 'ow-attribution';
  attrib.textContent = attribution.join('  ·  ');
  attrib.style.cssText = [
    'position:fixed', 'right:10px', 'bottom:8px', `font:10px/1.4 ${MONO}`,
    'color:rgba(220,230,240,0.75)', 'text-shadow:0 1px 2px rgba(0,0,0,0.6)',
    'z-index:31', 'pointer-events:none', 'letter-spacing:0.02em',
  ].join(';');
  container.appendChild(attrib);

  return {
    setMode(label) { elMode.textContent = label.toUpperCase(); },
    setProfile(label) { elProfile.textContent = label.toUpperCase(); },
    setStatus(text) { status.textContent = text; },
    setCoach(text) {
      coach.textContent = text;
      coach.style.display = text ? 'block' : 'none';
    },
    dispose() {
      chip.remove(); status.remove(); coach.remove(); attrib.remove();
    },
  };
}
