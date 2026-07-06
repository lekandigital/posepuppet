// First-run onboarding: one skippable glass overlay — how to stand, when
// to calibrate, hands visible, record, and the privacy line. Never shows
// twice unless asked (⌘K → "help · how to use").

import { config, setConfig } from '../config';

const STEPS: Array<[string, string]> = [
  ['Stand', 'Step back until your shoulders and hips are in frame. Full-body moves need head to feet.'],
  ['Calibrate', 'Click Setup (or press c) and hold your neutral pose through the countdown.'],
  ['Hands', 'Keep both hands inside the frame — the puppet mirrors what the camera can see.'],
  ['Record', 'The red rec button captures a composite clip. Raise both arms to start a guided take hands-free.'],
  ['Private', 'Everything runs in this browser. No frame, landmark, or recording ever leaves this machine.'],
];

export function createOnboarding(): { show(): void } {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding';
  overlay.className = 'onboarding hidden';

  const box = document.createElement('div');
  box.className = 'ob-box';
  const title = document.createElement('h1');
  title.className = 'ob-title serif';
  title.innerHTML = 'A puppet that <em>mirrors you</em>';
  box.append(title);

  for (const [label, text] of STEPS) {
    const row = document.createElement('div');
    row.className = 'ob-row';
    const l = document.createElement('span');
    l.className = 'ob-label';
    l.textContent = label;
    const t = document.createElement('p');
    t.textContent = text;
    row.append(l, t);
    box.append(row);
  }

  const actions = document.createElement('div');
  actions.className = 'ob-actions';
  const start = document.createElement('button');
  start.className = 'ob-start';
  start.textContent = 'Start puppeteering';
  start.onclick = dismiss;
  actions.append(start);
  box.append(actions);
  overlay.append(box);
  document.body.append(overlay);

  function dismiss(): void {
    overlay.classList.add('hidden');
    setConfig('onboardingSeen', true);
  }
  overlay.onclick = (e) => {
    if (e.target === overlay) dismiss();
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) dismiss();
  });

  const api = {
    show() {
      overlay.classList.remove('hidden');
      // defer focus past the triggering key event — focusing the button
      // synchronously lets the same Enter keypress "click" it and the
      // overlay dismisses itself instantly
      setTimeout(() => start.focus(), 120);
    },
  };
  // auto-show once per human: suppressed under automation (Playwright/eval
  // set navigator.webdriver) so the suite and eval never click through it;
  // ⌘K "help · how to use" reopens it any time
  const params = new URLSearchParams(location.search);
  const automated = navigator.webdriver || params.has('eval') || params.has('smoke');
  if (!config.onboardingSeen && !automated) api.show();
  return api;
}
