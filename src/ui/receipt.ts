// The privacy receipt: "LOCAL · 0 EXTERNAL REQUESTS SINCE LOAD" — a live,
// truthful counter of every request that leaves this origin. Same-origin
// static assets (font subsets, the pose model, wasm) are the app serving
// itself and are excluded from the headline by design — the trust claim
// is "nothing talks to anyone else's server", and that claim is enforced
// here: every cross-origin resource, beacon, or socket bumps the number
// the moment it happens.

export interface Receipt {
  arm(): void;
  count(): number;
}

export function createReceipt(): Receipt {
  const el = document.getElementById('net-receipt')!;
  let armed = false;
  let n = 0;

  function render(): void {
    el.textContent = `LOCAL · ${n} EXTERNAL REQUEST${n === 1 ? '' : 'S'} SINCE LOAD`;
    el.classList.toggle('dirty', n > 0);
  }

  function isExternal(url: string): boolean {
    try {
      return new URL(url, location.href).origin !== location.origin;
    } catch {
      return true; // unparseable → assume the worst, count it
    }
  }

  function bump(): void {
    if (!armed) return;
    n++;
    render();
  }

  // PerformanceObserver sees every resource the page loads (fetch, xhr,
  // img, script, css…) — the widest truthful net available in-page.
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (isExternal(entry.name)) bump();
      }
    }).observe({ type: 'resource', buffered: false });
  } catch {
    /* very old engines: fall through to the wrappers below */
  }

  // Belt and braces for paths resource timing can miss or delay.
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = (...args: Parameters<typeof navigator.sendBeacon>) => {
      if (isExternal(String(args[0]))) bump();
      return origBeacon(...args);
    };
  }
  const OrigWS = window.WebSocket;
  // count *new* sockets to other hosts opened after arming (ws/wss origins
  // never string-match http origins, so compare hosts)
  window.WebSocket = new Proxy(OrigWS, {
    construct(target, args) {
      try {
        if (new URL(String(args[0])).host !== location.host) bump();
      } catch {
        bump();
      }
      return Reflect.construct(target, args as ConstructorParameters<typeof WebSocket>);
    },
  });

  return {
    arm() {
      armed = true;
      render();
    },
    count: () => n,
  };
}
