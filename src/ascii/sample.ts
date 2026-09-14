import { SAMPLE_SIZE } from "./constants";

/** Pixel plate — no DOM, so SSR and iframes without canvas still get a frame. */
export function makeSampleImage(size = SAMPLE_SIZE): {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
} {
  const w = size;
  const h = size;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const cx = w * 0.34;
  const cy = h * 0.4;
  const r = size * 0.24;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = 0.92 - (y / (h - 1)) * 0.06;

      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r) {
        const ring = Math.abs(d - r * 0.58) < r * 0.07;
        v = ring ? 0.1 : 0.18 + (1 - d / r) * 0.12;
      }

      if (x > w * 0.58 && x < w * 0.9 && y > h * 0.12 && y < h * 0.72) {
        const cell = 28;
        v = (Math.floor((x - w * 0.58) / cell) + Math.floor((y - h * 0.12) / cell)) & 1 ? 0.08 : 0.9;
      }

      if (y > h * 0.8 && y < h * 0.9) {
        v = Math.floor(x / 18) % 2 === 0 ? 0.08 : 0.9;
      }

      const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
      rgba[i] = g;
      rgba[i + 1] = Math.round(g * 0.97);
      rgba[i + 2] = Math.round(g * 0.9);
      rgba[i + 3] = 255;
    }
  }
  return { rgba, w, h };
}
