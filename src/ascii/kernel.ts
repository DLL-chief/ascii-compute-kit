import { DEFAULT_CELL_H, DEFAULT_CELL_W, DEFAULT_RAMP } from "./constants";
import type { AsciiOptions } from "./types";

export function lumaAt(rgba: Uint8ClampedArray | Uint8Array, i: number): number {
  const r = rgba[i] ?? 0;
  const g = rgba[i + 1] ?? 0;
  const b = rgba[i + 2] ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function gridSize(w: number, h: number, cellW: number, cellH: number) {
  return { cols: Math.floor(w / cellW), rows: Math.floor(h / cellH) };
}

export function computeIndices(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  options: AsciiOptions,
): { indices: Uint8Array; cols: number; rows: number } {
  const { cellW, cellH, ramp, invert } = options;
  const { cols, rows } = gridSize(w, h, cellW, cellH);
  const indices = new Uint8Array(cols * rows);
  const rampMax = Math.max(1, ramp.length - 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let n = 0;
      const x0 = col * cellW;
      const y0 = row * cellH;
      for (let y = 0; y < cellH; y++) {
        const yy = y0 + y;
        if (yy >= h) break;
        const rowOff = yy * w * 4;
        for (let x = 0; x < cellW; x++) {
          const xx = x0 + x;
          if (xx >= w) break;
          sum += lumaAt(rgba, rowOff + xx * 4);
          n++;
        }
      }
      let yNorm = n === 0 ? 0 : sum / n / 255;
      if (invert) yNorm = 1 - yNorm;
      indices[row * cols + col] = Math.min(rampMax, Math.floor(yNorm * rampMax));
    }
  }
  return { indices, cols, rows };
}

function drawingContext(w: number, h: number): {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  canvas: OffscreenCanvas | HTMLCanvasElement;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Не удалось создать 2D-контекст OffscreenCanvas");
    return { ctx, canvas };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Не удалось создать 2D-контекст canvas");
    return { ctx, canvas };
  }
  throw new Error("Нет canvas для растеризации глифов");
}

export function rasterizeGlyphs(
  indices: Uint8Array,
  cols: number,
  rows: number,
  w: number,
  h: number,
  options: AsciiOptions,
): Uint8ClampedArray {
  const { cellW, cellH, ramp, invert } = options;
  try {
    const { ctx, canvas } = drawingContext(w, h);
    ctx.imageSmoothingEnabled = false;
    const bg = invert ? "#ece7dc" : "#0c0d0b";
    const fg = invert ? "#16170f" : "#ece7dc";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `700 ${cellH}px ui-monospace, "IBM Plex Mono", monospace`;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = indices[row * cols + col] ?? 0;
        const ch = ramp[idx] ?? " ";
        ctx.fillText(ch, col * cellW, row * cellH);
      }
    }

    return ctx.getImageData(0, 0, w, h).data;
  } catch {
    return new Uint8ClampedArray(w * h * 4);
  }
}

export function toAsciiText(
  indices: Uint8Array,
  cols: number,
  rows: number,
  ramp: string,
): string {
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const idx = indices[row * cols + col] ?? 0;
      line += ramp[idx] ?? " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function asciiFilter(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  options: AsciiOptions,
): Uint8ClampedArray {
  const { indices, cols, rows } = computeIndices(rgba, w, h, options);
  return rasterizeGlyphs(indices, cols, rows, w, h, options);
}

export function defaultOptions(partial?: Partial<AsciiOptions>): AsciiOptions {
  return {
    cellW: DEFAULT_CELL_W,
    cellH: DEFAULT_CELL_H,
    ramp: DEFAULT_RAMP,
    invert: false,
    colored: false,
    ...partial,
  };
}
