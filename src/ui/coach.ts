// Setup coach: one card in the rail, camera-coach language ("Step back so
// your legs are visible"), lowest-possible nag factor — one message at a
// time, optional one-click action, auto-clears. P2 ships the surface +
// the perf auto-tuner message; P6 adds the visibility-driven guidance.

export interface CoachAction {
  label: string;
  run(): void;
}

export interface Coach {
  /** Show a message (replaces the current one). */
  set(eyebrow: string, text: string, action?: CoachAction): void;
  /** Return to the neutral hint. */
  clear(): void;
}

const NEUTRAL_EYEBROW = 'Setup';
const NEUTRAL_TEXT = 'Stand back so your shoulders and hips are in frame, then calibrate.';

export function createCoach(): Coach {
  const eyebrowEl = document.getElementById('coach-eyebrow');
  const lineEl = document.getElementById('coach-line');
  const card = document.getElementById('coach-card');
  let actionBtn: HTMLButtonElement | null = null;

  function removeAction(): void {
    actionBtn?.remove();
    actionBtn = null;
  }

  return {
    set(eyebrow, text, action) {
      if (!eyebrowEl || !lineEl || !card) return;
      eyebrowEl.textContent = eyebrow;
      lineEl.textContent = text;
      removeAction();
      if (action) {
        actionBtn = document.createElement('button');
        actionBtn.className = 'coach-action';
        actionBtn.textContent = action.label;
        actionBtn.onclick = () => {
          action.run();
          this.clear();
        };
        card.append(actionBtn);
      }
    },
    clear() {
      if (!eyebrowEl || !lineEl) return;
      eyebrowEl.textContent = NEUTRAL_EYEBROW;
      lineEl.textContent = NEUTRAL_TEXT;
      removeAction();
    },
  };
}
