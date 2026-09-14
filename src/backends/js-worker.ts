import type { Backend, DetectResult, RunInput, RunOutput } from "../ascii/types";
import { ComputeWorkerClient } from "./worker-client";

const client = new ComputeWorkerClient(false);

export const jsWorkerBackend: Backend = {
  id: "js-worker",
  available(d: DetectResult) {
    return d.workers;
  },
  async init() {
    await client.init();
  },
  async run(input: RunInput): Promise<RunOutput> {
    const out = await client.run(input.rgba, input.w, input.h, input.options);
    return { ...out, backend: "js-worker" };
  },
  async dispose() {
    client.dispose();
  },
};
