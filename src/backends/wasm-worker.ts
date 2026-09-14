import type { Backend, DetectResult, RunInput, RunOutput } from "../ascii/types";
import { ComputeWorkerClient } from "./worker-client";

const client = new ComputeWorkerClient(true);

export const wasmWorkerBackend: Backend = {
  id: "wasm-worker",
  available(d: DetectResult) {
    return d.workers && d.wasm;
  },
  async init() {
    await client.init();
  },
  async run(input: RunInput): Promise<RunOutput> {
    const out = await client.run(input.rgba, input.w, input.h, input.options);
    if (!out.usedWasm) {
      throw new Error("Worker не смог загрузить Wasm");
    }
    return { ...out, backend: "wasm-worker" };
  },
  async dispose() {
    client.dispose();
  },
};
