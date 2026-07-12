// Camera panel layout: the overlay canvas is laid out to exactly cover the
// video's content rect (object-fit: contain math done here) and mirrored
// the same way, so overlay drawing happens in raw video pixel coordinates
// and always lines up. Capture itself (getUserMedia / video files) lives in
// @bodyarcade/pose-runtime — the runtime is the page's only capture owner.

export interface CameraElements {
  video: HTMLVideoElement;
  overlay: HTMLCanvasElement;
  pane: HTMLElement;
}

/** Computes the object-fit:contain rect of the video inside its pane and
 *  applies it to both the video element and the overlay canvas. */
export function layoutOverlay({ video, overlay, pane }: CameraElements): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const pw = pane.clientWidth;
  const ph = pane.clientHeight;
  const scale = Math.min(pw / vw, ph / vh);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const x = Math.round((pw - w) / 2);
  const y = Math.round((ph - h) / 2);
  for (const el of [video, overlay]) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }
  if (overlay.width !== vw || overlay.height !== vh) {
    overlay.width = vw;
    overlay.height = vh;
  }
}

export function watchLayout(els: CameraElements): void {
  const relayout = () => layoutOverlay(els);
  new ResizeObserver(relayout).observe(els.pane);
  els.video.addEventListener('loadedmetadata', relayout);
  els.video.addEventListener('resize', relayout);
}

export function setMirrored(els: CameraElements, mirrored: boolean): void {
  els.video.classList.toggle('unmirrored', !mirrored);
  els.overlay.classList.toggle('unmirrored', !mirrored);
}
