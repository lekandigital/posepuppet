// Capture ownership: getUserMedia and video-file playback into ONE video
// element. Extracted from the app's camera module — the runtime is the only
// getUserMedia consumer on a page (enforced by test). Overlay layout /
// CSS-mirroring helpers stayed app-side (they are app DOM concerns).

export interface CaptureSize {
  width: number;
  height: number;
}

export async function startCamera(
  video: HTMLVideoElement,
  size: CaptureSize = { width: 1280, height: 720 },
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: size.width }, height: { ideal: size.height }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

/** Plays a local video file through the same pipeline instead of the webcam. */
export async function startVideoFile(video: HTMLVideoElement, src: string | File): Promise<void> {
  stopStream(video);
  video.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  video.loop = true;
  await video.play();
}

/** Stops and detaches any camera stream on the element (idempotent). */
export function stopStream(video: HTMLVideoElement): void {
  if (video.srcObject) {
    (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}
