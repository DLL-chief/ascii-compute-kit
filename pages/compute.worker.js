// src/ascii/constants.ts
var MAX_FILE_BYTES = 12 * 1024 * 1024;

// src/ascii/kernel.ts
function lumaAt(rgba, i) {
  const r = rgba[i] ?? 0;
  const g = rgba[i + 1] ?? 0;
  const b = rgba[i + 2] ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function gridSize(w, h, cellW, cellH) {
  return { cols: Math.floor(w / cellW), rows: Math.floor(h / cellH) };
}
function computeIndices(rgba, w, h, options) {
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
function drawingContext(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C 2D-\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 OffscreenCanvas");
    return { ctx, canvas };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C 2D-\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 canvas");
    return { ctx, canvas };
  }
  throw new Error("\u041D\u0435\u0442 canvas \u0434\u043B\u044F \u0440\u0430\u0441\u0442\u0435\u0440\u0438\u0437\u0430\u0446\u0438\u0438 \u0433\u043B\u0438\u0444\u043E\u0432");
}
function rasterizeGlyphs(indices, cols, rows, w, h, options) {
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
function asciiFilter(rgba, w, h, options) {
  const { indices, cols, rows } = computeIndices(rgba, w, h, options);
  return rasterizeGlyphs(indices, cols, rows, w, h, options);
}

// src/ascii/wasm-bytes.ts
var ASCII_WASM_B64 = "AGFzbQEAAAABDAFgCH9/f39/f39/AAMCAQAFAwEAEAYJAX8BQYCAwAALBxkCBm1lbW9yeQIADGx1bWFfaW5kaWNlcwAACpMDAZADBQ1/AX4BfwF+A38CQCAARQ0AIARFDQAgA0UNACACRQ0AIAFFDQAgB0UNACACIARuIQggASADbiEJIAQgAksNACABQQJ0IQogA0ECdCELIAQgAWxBAnQhDEEAIQ0gBiAGQQBHayEOA0ACQCADIAFLDQAgDSAEbCEPIAcgDSAJbGohEEEAIREgACESQQAhEwNAIBMiFEEBaiETQgAhFSASIRZCACEXQQAhGAJAA0AgGCAPaiACTw0BIBhBAWohGCARIRkgFiEGIAMhGgJAA0AgGSABTw0BIAYxAABCzQB+IBd8IAZBAWoxAABClgF+fCAGQQJqMQAAQh1+fCEXIBlBAWohGSAGQQRqIQYgFUIBfCEVIBpBf2oiGg0ACwsgFiAKaiEWIBggBEcNAAsLAkACQCAVUEUNAEEAIQYMAQsgFyAVgEIIiKchBgsgECAUakH/ASAGayAGIAUbIA5sQf8BbjoAACARIANqIREgEiALaiESIBMgCUkNAAsLIAAgDGohACANQQFqIg0gCEkNAAsLCwA3BG5hbWUACwphc2NpaS53YXNtAQ8BAAxsdW1hX2luZGljZXMHEgEAD19fc3RhY2tfcG9pbnRlcgBNCXByb2R1Y2VycwIIbGFuZ3VhZ2UBBFJ1c3QADHByb2Nlc3NlZC1ieQEFcnVzdGMdMS45OC4xICg0OGEyMjljZWEgMjAyNi0wOS0wMSkAlAEPdGFyZ2V0X2ZlYXR1cmVzCCsLYnVsay1tZW1vcnkrD2J1bGstbWVtb3J5LW9wdCsWY2FsbC1pbmRpcmVjdC1vdmVybG9uZysKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKxNub250cmFwcGluZy1mcHRvaW50Kw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0";

// src/ascii/wasm.ts
var SRC_PTR = 0;
var DST_PTR = 2 * 1024 * 1024;
function b64ToBuffer(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
async function loadWasmAscii(url) {
  let bytes = null;
  if (url) {
    try {
      const res = await fetch(url);
      if (res.ok) bytes = await res.arrayBuffer();
    } catch {
      bytes = null;
    }
  }
  if (!bytes) bytes = b64ToBuffer(ASCII_WASM_B64);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const memory = instance.exports.memory;
  const luma = instance.exports.luma_indices;
  if (!memory || typeof luma !== "function") {
    throw new Error("Wasm-\u043C\u043E\u0434\u0443\u043B\u044C \u0431\u0435\u0437 memory / luma_indices");
  }
  return {
    memory,
    lumaIndices: luma
  };
}
function ensureBytes(memory, needed) {
  const have = memory.buffer.byteLength;
  if (needed <= have) return;
  const pages = Math.ceil((needed - have) / 65536);
  memory.grow(pages);
}
function wasmComputeIndices(wasm, rgba, w, h, cellW, cellH, invert, rampLen) {
  const cols = Math.floor(w / cellW);
  const rows = Math.floor(h / cellH);
  const dstBytes = cols * rows;
  ensureBytes(wasm.memory, DST_PTR + dstBytes + 16);
  const mem = new Uint8Array(wasm.memory.buffer);
  mem.set(rgba, SRC_PTR);
  wasm.lumaIndices(SRC_PTR, w, h, cellW, cellH, invert ? 1 : 0, rampLen, DST_PTR);
  const indices = new Uint8Array(dstBytes);
  indices.set(mem.subarray(DST_PTR, DST_PTR + dstBytes));
  return { indices, cols, rows };
}

// src/workers/compute.worker.ts
var wasmMod = null;
var wasmTried = false;
var wasmError = "";
async function ensureWasm() {
  if (wasmTried) return;
  wasmTried = true;
  try {
    wasmMod = await loadWasmAscii(
      typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? `${import.meta.env.BASE_URL}wasm/ascii.wasm` : void 0
    );
  } catch (err) {
    wasmError = err instanceof Error ? err.message : String(err);
    wasmMod = null;
  }
}
self.onmessage = async (ev) => {
  const msg = ev.data;
  const reply = (data, transfer) => {
    self.postMessage(data, transfer ?? []);
  };
  try {
    if (msg.kind === "init") {
      await ensureWasm();
      reply({ id: msg.id, ok: true, kind: "init", usedWasm: !!wasmMod });
      return;
    }
    const { rgba, w, h, options, useWasm, id } = msg;
    if (!rgba || !w || !h || !options) {
      throw new Error("\u041D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 run");
    }
    const t0 = performance.now();
    let out;
    let usedWasm = false;
    if (useWasm) {
      await ensureWasm();
      if (!wasmMod) throw new Error(wasmError || "Wasm \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0441\u044F");
      const { indices, cols, rows } = wasmComputeIndices(
        wasmMod,
        rgba,
        w,
        h,
        options.cellW,
        options.cellH,
        options.invert,
        options.ramp.length
      );
      out = rasterizeGlyphs(indices, cols, rows, w, h, options);
      usedWasm = true;
    } else {
      out = asciiFilter(rgba, w, h, options);
    }
    const ms = performance.now() - t0;
    reply(
      { id, ok: true, kind: "run", rgba: out, w, h, ms, usedWasm },
      [out.buffer]
    );
  } catch (err) {
    reply({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
