import { AUTO_ORDER, type Backend, type BackendId, type DetectResult, type RunInput, type RunOutput } from "../ascii/types";
import { jsMainBackend } from "../backends/js-main";
import { jsWorkerBackend } from "../backends/js-worker";
import { wasmWorkerBackend } from "../backends/wasm-worker";
import { webgpuBackend } from "../backends/webgpu";
import { webgl2Backend } from "../backends/webgl2";

const backends: Record<BackendId, Backend> = {
  "js-main": jsMainBackend,
  "js-worker": jsWorkerBackend,
  "wasm-worker": wasmWorkerBackend,
  webgpu: webgpuBackend,
  webgl2: webgl2Backend,
};

const inited = new Set<BackendId>();

export function getBackend(id: BackendId) {
  return backends[id];
}

export async function runPipeline(
  detect: DetectResult,
  input: RunInput,
  command: { type: "auto" } | { type: "use"; backend: BackendId },
): Promise<RunOutput> {
  const order: BackendId[] =
    command.type === "use" ? [command.backend] : AUTO_ORDER.filter((id) => backends[id].available(detect));

  let lastError = "";
  let fallbackFrom: BackendId | undefined;
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!;
    const b = backends[id];
    if (!b.available(detect) && command.type === "use") {
      throw new Error(`Бэкенд ${id} недоступен`);
    }
    try {
      if (b.init && !inited.has(id)) {
        await b.init();
        inited.add(id);
      }
      const out = await b.run(input);
      return i === 0 ? out : { ...out, fallbackFrom };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      fallbackFrom = id;
    }
  }
  throw new Error(lastError || "Ни один бэкенд не сработал");
}
