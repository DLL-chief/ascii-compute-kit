import { ASCII_WASM_B64 } from "./wasm-bytes";

export type WasmAscii = {
  memory: WebAssembly.Memory;
  lumaIndices: (
    src: number,
    w: number,
    h: number,
    cellW: number,
    cellH: number,
    invert: number,
    rampLen: number,
    dst: number,
  ) => void;
};

const SRC_PTR = 0;
const DST_PTR = 2 * 1024 * 1024;

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

export async function loadWasmAscii(url?: string): Promise<WasmAscii> {
  let bytes: ArrayBuffer | null = null;
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
  const memory = instance.exports.memory as WebAssembly.Memory | undefined;
  const luma = instance.exports.luma_indices as
    | ((...a: number[]) => void)
    | undefined;
  if (!memory || typeof luma !== "function") {
    throw new Error("Wasm-модуль без memory / luma_indices");
  }
  return {
    memory,
    lumaIndices: luma as WasmAscii["lumaIndices"],
  };
}

function ensureBytes(memory: WebAssembly.Memory, needed: number) {
  const have = memory.buffer.byteLength;
  if (needed <= have) return;
  const pages = Math.ceil((needed - have) / 65536);
  memory.grow(pages);
}

export function wasmComputeIndices(
  wasm: WasmAscii,
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  cellW: number,
  cellH: number,
  invert: boolean,
  rampLen: number,
): { indices: Uint8Array; cols: number; rows: number } {
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

export { SRC_PTR, DST_PTR };
