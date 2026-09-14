import type { DetectResult } from "../ascii/types";

const GPU_WAIT_MS = 1500;

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

export async function detect(onPartial?: (d: DetectResult) => void): Promise<DetectResult> {
  const reasons: DetectResult["reasons"] = {};

  const workers = typeof Worker === "function";
  if (!workers) reasons.workers = "Worker API нет в этом браузере";

  const wasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  if (!wasm) reasons.wasm = "WebAssembly нет в этом браузере";

  let webgl2 = false;
  if (typeof document !== "undefined") {
    try {
      const c = document.createElement("canvas");
      webgl2 = !!c.getContext("webgl2");
    } catch {
      webgl2 = false;
    }
  }
  if (!webgl2) reasons.webgl2 = "контекст WebGL2 не создаётся";

  const isolated = !!globalThis.crossOriginIsolated;
  if (!isolated) reasons.webgpu = reasons.webgpu;

  const partial: DetectResult = {
    workers,
    wasm,
    webgpu: false,
    webgl2,
    isolated,
    reasons: {
      ...reasons,
      webgpu: "спрашиваю GPU adapter…",
    },
  };
  onPartial?.(partial);

  let webgpu = false;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) {
    reasons.webgpu = "navigator.gpu нет (нужен Chrome/Edge с WebGPU)";
  } else {
    const probed = await Promise.race([
      gpu
        .requestAdapter()
        .then((adapter) => ({ ok: !!adapter, why: adapter ? "" : "requestAdapter() пустой" }))
        .catch((err: unknown) => ({
          ok: false,
          why: err instanceof Error ? err.message : "ошибка adapter",
        })),
      timeout(GPU_WAIT_MS, { ok: false, why: `нет ответа за ${GPU_WAIT_MS / 1000} с` }),
    ]);
    webgpu = probed.ok;
    if (!webgpu) reasons.webgpu = probed.why;
  }

  return {
    workers,
    wasm,
    webgpu,
    webgl2,
    isolated,
    reasons,
  };
}
