/**
 * Rowing feedback strip (Gate-2 round-2 request): the rower must be able to
 * tell what the game recognizes — a pulse per accepted stroke (sized by pull
 * strength), live cadence, the applied steering, and a plain-language line
 * when the signal is lost, weak, or the keyboard owns the boat. Distinguishes
 * "tracking failure" from "control/physics failure" at a glance.
 *
 * Pure DOM overlay in the FlockFormationHUD idiom (injected styles, no
 * pointer events). Landmarks never reach this file — everything shown is
 * derived from the RowDebugState the controls already expose.
 */
import type { RowDebugState } from "../input/rowControls";

export class RowingHUD {
  private container: HTMLDivElement;
  private pulseEl: HTMLDivElement;
  private pulseFillEl: HTMLDivElement;
  private cadenceEl: HTMLSpanElement;
  private steerMarkerEl: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private hintEl: HTMLDivElement;

  private lastCount: number | null = null;
  private lastStrengths: number[] = [];
  private pulseTimer: number | null = null;
  private hintUntil = 0;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "rowing-hud";
    this.container.innerHTML = `
      <div class="rowing-hud-strip">
        <div class="rowing-hud-pulse"><div class="rowing-hud-pulse-fill"></div></div>
        <span class="rowing-hud-cadence">— spm</span>
        <div class="rowing-hud-steer"><div class="rowing-hud-steer-marker"></div></div>
        <span class="rowing-hud-status">ROWING</span>
      </div>
      <div class="rowing-hud-hint" aria-live="polite"></div>
    `;
    parent.appendChild(this.container);
    this.pulseEl = this.container.querySelector(".rowing-hud-pulse")!;
    this.pulseFillEl = this.container.querySelector(".rowing-hud-pulse-fill")!;
    this.cadenceEl = this.container.querySelector(".rowing-hud-cadence")!;
    this.steerMarkerEl = this.container.querySelector(".rowing-hud-steer-marker")!;
    this.statusEl = this.container.querySelector(".rowing-hud-status")!;
    this.hintEl = this.container.querySelector(".rowing-hud-hint")!;
    this.injectStyles();
  }

  /** Once per frame while the boat is active. */
  update(d: RowDebugState) {
    const st = d.signal?.stroke;

    // stroke pulse: fires on count increments, sized by pull strength so a
    // weak pull is visibly small (the "is it seeing me?" question)
    if (st) {
      if (this.lastCount === null) this.lastCount = st.count;
      if (st.count > this.lastCount) {
        this.lastCount = st.count;
        const amp = (st.ampL + st.ampR) / 2;
        const strength = Math.min(1, amp / 0.45);
        this.lastStrengths.push(strength);
        if (this.lastStrengths.length > 3) this.lastStrengths.shift();
        this.firePulse(strength);
      }
    }

    // cadence, rower units
    const spm = (st?.rate ?? 0) * 60;
    this.cadenceEl.textContent = spm >= 3 ? `${Math.round(spm)} spm` : "— spm";

    // applied steering: + turnRate = left on screen
    const cap = Math.max(d.assist.turnCap, 0.01);
    const x = Math.max(-1, Math.min(1, d.turnRate / cap));
    this.steerMarkerEl.style.left = `${50 - x * 44}%`;

    // status word + guidance line
    const [word, tone, hint] = this.describe(d);
    this.statusEl.textContent = word;
    this.statusEl.dataset.tone = tone;
    const now = performance.now();
    if (hint) {
      this.hintEl.textContent = hint;
      this.hintUntil = now + 1200;
    } else if (now > this.hintUntil) {
      this.hintEl.textContent = "";
    }
  }

  private describe(d: RowDebugState): [string, string, string | null] {
    switch (d.reason) {
      case "keyboard":
        return ["KEYBOARD", "info", null];
      case "no-signal":
        return ["NO BODY SIGNAL", "warn", "open the Row button from PosePuppet to row with your body — keys steer meanwhile"];
      case "autopilot":
        return ["SIGNAL LOST", "warn", "keep your upper body in view of the camera — keys still steer"];
      case "low-confidence":
        return ["TRACKING UNSURE", "warn", "face the camera and add light"];
      case "reacquiring":
        return ["REACQUIRING", "info", null];
      default:
        break;
    }
    if (d.cruiseHolding) return ["CRUISE", "good", null];
    if (d.signal?.stroke?.active) {
      const weak =
        this.lastStrengths.length === 3 && this.lastStrengths.every((s) => s < 0.35);
      return ["ROWING", "good", weak ? "pull with a fuller arm motion for more power" : null];
    }
    if (d.signal?.seated && d.signal.neutralConfidence < 0.5) {
      return ["IDLE", "info", "seated? hold a T-pose for a moment to recalibrate"];
    }
    return ["IDLE", "info", null];
  }

  private firePulse(strength: number) {
    const size = 0.45 + 0.55 * strength;
    this.pulseFillEl.style.transform = `scale(${size})`;
    this.pulseEl.classList.remove("rowing-hud-pulse-hit");
    // restart the CSS animation
    void this.pulseEl.offsetWidth;
    this.pulseEl.classList.add("rowing-hud-pulse-hit");
    if (this.pulseTimer !== null) window.clearTimeout(this.pulseTimer);
    this.pulseTimer = window.setTimeout(() => {
      this.pulseEl.classList.remove("rowing-hud-pulse-hit");
    }, 450);
  }

  setVisible(v: boolean) {
    this.container.style.opacity = v ? "1" : "0";
  }

  dispose() {
    if (this.pulseTimer !== null) window.clearTimeout(this.pulseTimer);
    this.container.remove();
  }

  private injectStyles() {
    if (document.getElementById("rowing-hud-styles")) return;
    const style = document.createElement("style");
    style.id = "rowing-hud-styles";
    style.textContent = `
      .rowing-hud {
        position: absolute;
        left: 50%;
        bottom: 86px;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        pointer-events: none;
        z-index: 12;
        transition: opacity 0.2s ease;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .rowing-hud-strip {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 14px;
        border-radius: 999px;
        background: rgba(10, 16, 24, 0.55);
        backdrop-filter: blur(6px);
        color: rgba(255, 255, 255, 0.92);
        font-size: 12px;
        letter-spacing: 0.04em;
      }
      .rowing-hud-pulse {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 1.5px solid rgba(255, 255, 255, 0.45);
        display: grid;
        place-items: center;
        position: relative;
      }
      .rowing-hud-pulse-fill {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #7fd4ff;
        transform: scale(0.2);
        opacity: 0.35;
        transition: transform 0.15s ease, opacity 0.3s ease;
      }
      .rowing-hud-pulse-hit .rowing-hud-pulse-fill {
        opacity: 1;
      }
      .rowing-hud-pulse-hit {
        animation: rowing-hud-ring 0.45s ease-out;
      }
      @keyframes rowing-hud-ring {
        0% { box-shadow: 0 0 0 0 rgba(127, 212, 255, 0.7); }
        100% { box-shadow: 0 0 0 10px rgba(127, 212, 255, 0); }
      }
      .rowing-hud-cadence { min-width: 52px; text-align: center; }
      .rowing-hud-steer {
        width: 76px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.22);
        position: relative;
      }
      .rowing-hud-steer::after {
        content: "";
        position: absolute;
        left: 50%;
        top: -2px;
        width: 1px;
        height: 8px;
        background: rgba(255, 255, 255, 0.35);
      }
      .rowing-hud-steer-marker {
        position: absolute;
        top: -3px;
        left: 50%;
        width: 10px;
        height: 10px;
        margin-left: -5px;
        border-radius: 50%;
        background: #fff;
        transition: left 0.08s linear;
      }
      .rowing-hud-status { min-width: 90px; }
      .rowing-hud-status[data-tone="good"] { color: #9df0b7; }
      .rowing-hud-status[data-tone="warn"] { color: #ffd48a; }
      .rowing-hud-status[data-tone="info"] { color: rgba(255, 255, 255, 0.8); }
      .rowing-hud-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.75);
        background: rgba(10, 16, 24, 0.45);
        border-radius: 8px;
        padding: 3px 10px;
        min-height: 17px;
      }
      @media (prefers-reduced-motion: reduce) {
        .rowing-hud-pulse-hit { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }
}
