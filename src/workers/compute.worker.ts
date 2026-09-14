import { asciiFilter, rasterizeGlyphs } from "../ascii/kernel";
import { loadWasmAscii, wasmComputeIndices } from "../ascii/wasm";
import type { AsciiOptions } from "../ascii/types";

type WorkerRequest = {
  id: number;
  kind: "init" | "run";
  rgba?: Uint8ClampedArray;
  w?: number;
  h?: number;
  options?: AsciiOptions;
  useWasm?: boolean;
};

type WorkerResponse =
  | { id: number; ok: true; kind: "init"; usedWasm: boolean }
  | {
      id: number;
      ok: true;
      kind: "run";
      rgba: Uint8ClampedArray;
      w: number;
      h: number;
      ms: number;
      usedWasm: boolean;
    }
  | { id: number; ok: false; error: string };

let wasmMod: Awaited<ReturnType<typeof loadWasmAscii>> | null = null;
let wasmTried = false;
let wasmError = "";

async function ensureWasm() {
  if (wasmTried) return;
  wasmTried = true;
  try {
    wasmMod = await loadWasmAscii(
      typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
        ? `${import.meta.env.BASE_URL}wasm/ascii.wasm`
        : undefined,
    );
  } catch (err) {
    wasmError = err instanceof Error ? err.message : String(err);
    wasmMod = null;
  }
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  const reply = (data: WorkerResponse, transfer?: Transferable[]) => {
    (self as unknown as Worker).postMessage(data, transfer ?? []);
  };
  try {
    if (msg.kind === "init") {
      await ensureWasm();
      reply({ id: msg.id, ok: true, kind: "init", usedWasm: !!wasmMod });
      return;
    }
    const { rgba, w, h, options, useWasm, id } = msg;
    if (!rgba || !w || !h || !options) {
      throw new Error("Неполный запрос run");
    }
    const t0 = performance.now();
    let out: Uint8ClampedArray;
    let usedWasm = false;
    if (useWasm) {
      await ensureWasm();
      if (!wasmMod) throw new Error(wasmError || "Wasm не загрузился");
      const { indices, cols, rows } = wasmComputeIndices(
        wasmMod,
        rgba,
        w,
        h,
        options.cellW,
        options.cellH,
        options.invert,
        options.ramp.length,
      );
      out = rasterizeGlyphs(indices, cols, rows, w, h, options);
      usedWasm = true;
    } else {
      out = asciiFilter(rgba, w, h, options);
    }
    const ms = performance.now() - t0;
    reply(
      { id, ok: true, kind: "run", rgba: out, w, h, ms, usedWasm },
      [out.buffer],
    );
  } catch (err) {
    reply({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
