import type { BodyFlightControls } from "./bodyControls";
import { BODY_PROFILES } from "./bodyControls";

/**
 * BodyArcade original: flight-side control tuner overlay.
 *
 * Raw signal axes → mapped intent → plane response, live, with gain
 * sliders and a profile switcher. Toggled with "b" (wired in Game).
 * P3's Feel Lab extends this with the full shaping-stack controls; the
 * package-side tuner (dead zones, One Euro, expo) lives in PosePuppet.
 */

export interface PlaneResponse {
  headingRateDegS: number;
  speed: number;
  altitude: number;
  bankDeg: number;
}

// v2: fresh defaults after the Gate-2 tuning pass (old saved gains would
// silently mask the new per-profile values).
const GAIN_STORE_KEY = "bodyarcade_flight_gains_v2";

const RAW_AXES = ["leanX", "leanY", "crouch", "tallness", "armsOut", "handsForward"] as const;
const INTENT_AXES = ["turnRate", "speedAxis", "elevateAxis"] as const;

export class FlightTuner {
  private root: HTMLElement | null = null;
  private raf = 0;
  private bars = new Map<string, { fill: HTMLElement; value: HTMLElement }>();
  private statusEl: HTMLElement | null = null;
  private responseEl: HTMLElement | null = null;
  private profileBtn: HTMLButtonElement | null = null;
  private assistBtn: HTMLButtonElement | null = null;
  private notesEl: HTMLElement | null = null;
  private recenterEl: HTMLElement | null = null;

  constructor(
    private body: BodyFlightControls,
    private getPlaneResponse: () => PlaneResponse | null,
  ) {
    this.loadGains();
  }

  get mounted() {
    return this.root !== null;
  }

  toggle(host: HTMLElement): boolean {
    if (this.root) {
      this.unmount();
      return false;
    }
    this.mount(host);
    return true;
  }

  private loadGains() {
    try {
      const raw = localStorage.getItem(GAIN_STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, Record<string, number>>;
      for (const p of BODY_PROFILES) {
        const g = saved[p.id];
        if (!g) continue;
        if (typeof g.turnGain === "number") p.turnGain = g.turnGain;
        if (typeof g.speedGain === "number") p.speedGain = g.speedGain;
        if (typeof g.climbGain === "number") p.climbGain = g.climbGain;
        if (typeof g.descendGain === "number") p.descendGain = g.descendGain;
      }
    } catch {
      /* defaults */
    }
  }

  private saveGains() {
    try {
      const out: Record<string, Record<string, number>> = {};
      for (const p of BODY_PROFILES) {
        out[p.id] = {
          turnGain: p.turnGain,
          speedGain: p.speedGain,
          climbGain: p.climbGain,
          descendGain: p.descendGain,
        };
      }
      localStorage.setItem(GAIN_STORE_KEY, JSON.stringify(out));
    } catch {
      /* session-only */
    }
  }

  private mount(host: HTMLElement) {
    const el = document.createElement("div");
    el.id = "flight-tuner";
    Object.assign(el.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: "280px",
      padding: "10px 12px",
      background: "rgba(10, 14, 22, 0.88)",
      border: "1px solid rgba(160, 200, 255, 0.35)",
      borderRadius: "8px",
      color: "#cfe4ff",
      font: "11px/1.5 ui-monospace, 'JetBrains Mono', Menlo, monospace",
      zIndex: "400",
      pointerEvents: "auto",
      userSelect: "none",
    } as CSSStyleDeclaration);

    const title = document.createElement("div");
    title.textContent = "BODY → FLIGHT TUNER";
    Object.assign(title.style, { letterSpacing: "0.08em", opacity: "0.9", marginBottom: "6px" });
    el.appendChild(title);

    this.statusEl = document.createElement("div");
    this.statusEl.style.marginBottom = "6px";
    el.appendChild(this.statusEl);

    // Recenter confirmation: its own banner — Gate-2 feedback said the old
    // inline flag drowned among the moving numbers.
    this.recenterEl = document.createElement("div");
    Object.assign(this.recenterEl.style, {
      display: "none",
      margin: "0 0 8px",
      padding: "6px 8px",
      textAlign: "center",
      fontWeight: "700",
      letterSpacing: "0.1em",
      color: "#0d1a12",
      background: "#8fe3c0",
      borderRadius: "4px",
    } as CSSStyleDeclaration);
    this.recenterEl.textContent = "RECENTERED — NEUTRAL CAPTURED";
    el.appendChild(this.recenterEl);

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "6px", marginBottom: "8px" });
    const mkBtn = (onClick: () => void) => {
      const b = document.createElement("button");
      Object.assign(b.style, {
        font: "inherit",
        color: "inherit",
        background: "rgba(90, 140, 220, 0.25)",
        border: "1px solid rgba(160, 200, 255, 0.4)",
        borderRadius: "4px",
        padding: "2px 8px",
        cursor: "pointer",
      } as CSSStyleDeclaration);
      b.onclick = onClick;
      btnRow.appendChild(b);
      return b;
    };
    this.profileBtn = mkBtn(() => this.body.cycleProfile());
    this.assistBtn = mkBtn(() => this.body.cycleAssist());
    el.appendChild(btnRow);
    this.notesEl = document.createElement("div");
    Object.assign(this.notesEl.style, { opacity: "0.6", marginBottom: "6px" });
    el.appendChild(this.notesEl);

    const mkSection = (label: string) => {
      const s = document.createElement("div");
      s.textContent = label;
      Object.assign(s.style, { opacity: "0.55", margin: "6px 0 2px" });
      el.appendChild(s);
    };

    const mkBar = (key: string, signed: boolean) => {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px" });
      const name = document.createElement("span");
      name.textContent = key.padEnd(12, " ");
      name.style.whiteSpace = "pre";
      name.style.width = "88px";
      const track = document.createElement("div");
      Object.assign(track.style, {
        flex: "1",
        height: "8px",
        background: "rgba(120, 160, 220, 0.15)",
        borderRadius: "3px",
        position: "relative",
        overflow: "hidden",
      } as CSSStyleDeclaration);
      const fill = document.createElement("div");
      Object.assign(fill.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        background: signed ? "#7ab8ff" : "#8fe3c0",
      } as CSSStyleDeclaration);
      track.appendChild(fill);
      const value = document.createElement("span");
      value.style.width = "44px";
      value.style.textAlign = "right";
      row.append(name, track, value);
      el.appendChild(row);
      this.bars.set(key, { fill, value });
    };

    mkSection("raw signal");
    for (const a of RAW_AXES) mkBar(a, a === "leanX" || a === "leanY");
    mkSection("intent → plane");
    for (const a of INTENT_AXES) mkBar(a, true);

    mkSection("gains");
    const gains: [label: string, get: () => number, set: (v: number) => void, max: number][] = [
      ["turn", () => this.body.profile.turnGain, (v) => (this.body.profile.turnGain = v), 3],
      ["speed", () => this.body.profile.speedGain, (v) => (this.body.profile.speedGain = v), 3],
      ["climb", () => this.body.profile.climbGain, (v) => (this.body.profile.climbGain = v), 3],
      ["descend", () => this.body.profile.descendGain, (v) => (this.body.profile.descendGain = v), 3],
    ];
    for (const [label, get, set, max] of gains) {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px" });
      const name = document.createElement("span");
      name.textContent = label;
      name.style.width = "88px";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = String(max);
      slider.step = "0.05";
      slider.value = String(get());
      slider.style.flex = "1";
      const val = document.createElement("span");
      val.style.width = "44px";
      val.style.textAlign = "right";
      val.textContent = get().toFixed(2);
      slider.oninput = () => {
        set(Number(slider.value));
        val.textContent = Number(slider.value).toFixed(2);
        this.saveGains();
      };
      row.append(name, slider, val);
      el.appendChild(row);
    }

    this.responseEl = document.createElement("div");
    this.responseEl.style.marginTop = "8px";
    el.appendChild(this.responseEl);

    host.appendChild(el);
    this.root = el;
    const tick = () => {
      if (!this.root) return;
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private render() {
    const d = this.body.debugState();
    if (this.statusEl) {
      const rate = d.signalRateHz.toFixed(0);
      const age = d.signalAgeMs == null ? "—" : `${Math.round(d.signalAgeMs)}ms`;
      const conf = d.signal ? d.signal.confidence.toFixed(2) : "—";
      const seated = d.signal?.seated ? " · seated" : "";
      const boost = d.profile.boostOnHandsForward
        ? d.boostArmedIn > 0
          ? ` · boost ${(d.boostArmedIn / 1000).toFixed(1)}s`
          : " · boost READY"
        : "";
      const wire = d.senderConnected
        ? `${d.transport === "broadcast" ? "bc" : "pm"} v${d.schemaV}`
        : "no sender";
      this.statusEl.innerHTML = "";
      const line1 = document.createElement("div");
      line1.textContent = `src ${d.reason.toUpperCase()} · ${wire} · ${rate}Hz · age ${age} · conf ${conf}${seated}${boost}`;
      this.statusEl.appendChild(line1);
      if (!d.senderConnected) {
        const hint = document.createElement("div");
        hint.textContent =
          "PosePuppet isn't reaching this page. BroadcastChannel is " +
          "origin-scoped — a different port is a different origin. Run " +
          "`npm run arcade` at the repo root, open PosePuppet, then " +
          "⌘K → \"fly\" (serves this game same-origin at /flight/).";
        Object.assign(hint.style, {
          color: "#f0938a",
          whiteSpace: "normal",
          marginTop: "2px",
        } as CSSStyleDeclaration);
        this.statusEl.appendChild(hint);
      }
      this.statusEl.style.color = d.active
        ? "#8fe3c0"
        : d.reason === "autopilot" || d.reason === "reacquiring"
          ? "#f0b46a"
          : "#9fb4d8";
    }
    if (this.profileBtn) this.profileBtn.textContent = `${d.profile.label} ⇄`;
    if (this.assistBtn) this.assistBtn.textContent = `${d.assist.label} ⇄`;
    if (this.notesEl) this.notesEl.textContent = d.profile.notes;
    if (this.recenterEl) {
      this.recenterEl.style.display = d.recenterFlashMs > 0 ? "block" : "none";
    }

    const setBar = (key: string, v: number, signed: boolean) => {
      const bar = this.bars.get(key);
      if (!bar) return;
      const c = Math.max(-1, Math.min(1, v));
      if (signed) {
        const pct = Math.abs(c) * 50;
        bar.fill.style.left = c < 0 ? `${50 - pct}%` : "50%";
        bar.fill.style.width = `${pct}%`;
      } else {
        bar.fill.style.left = "0";
        bar.fill.style.width = `${Math.max(0, c) * 100}%`;
      }
      bar.value.textContent = v.toFixed(2);
    };

    for (const a of RAW_AXES) setBar(a, d.signal ? d.signal.axes[a] : 0, a === "leanX" || a === "leanY");
    setBar("turnRate", d.intent.turnRate / Math.max(0.001, d.profile.turnGain), true);
    setBar("speedAxis", d.intent.speedAxis, true);
    setBar("elevateAxis", d.intent.elevateAxis, true);

    if (this.responseEl) {
      const r = this.getPlaneResponse();
      this.responseEl.textContent = r
        ? `plane  hdg ${r.headingRateDegS >= 0 ? "+" : ""}${r.headingRateDegS.toFixed(0)}°/s · spd ${r.speed.toFixed(2)} · alt ${r.altitude.toFixed(2)} · bank ${r.bankDeg.toFixed(0)}°`
        : "plane  — (not flying)";
    }
  }

  private unmount() {
    cancelAnimationFrame(this.raf);
    this.root?.remove();
    this.root = null;
    this.bars.clear();
  }

  dispose() {
    this.unmount();
  }
}
