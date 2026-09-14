import type { AsciiOptions, RunOutput } from "../ascii/types";

type Pending = {
  resolve: (v: RunOutput & { usedWasm: boolean }) => void;
  reject: (e: Error) => void;
};

export class ComputeWorkerClient {
  private worker: Worker | null = null;
  private seq = 1;
  private pending = new Map<number, Pending>();

  constructor(private useWasm: boolean) {}

  private ensure() {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("../workers/compute.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as
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
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      if (!data.ok) {
        p.reject(new Error(data.error));
        return;
      }
      if (data.kind === "init") {
        p.resolve({
          rgba: new Uint8ClampedArray(),
          w: 0,
          h: 0,
          backend: "js-worker",
          ms: 0,
          usedWasm: data.usedWasm,
        });
        return;
      }
      p.resolve({
        rgba: data.rgba,
        w: data.w,
        h: data.h,
        backend: this.useWasm ? "wasm-worker" : "js-worker",
        ms: data.ms,
        usedWasm: data.usedWasm,
      });
    };
    worker.onerror = (e) => {
      for (const p of this.pending.values()) {
        p.reject(new Error(e.message || "Worker error"));
      }
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }

  async init() {
    const id = this.seq++;
    const worker = this.ensure();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
      });
      worker.postMessage({ id, kind: "init", useWasm: this.useWasm });
    });
  }

  async run(rgba: Uint8ClampedArray, w: number, h: number, options: AsciiOptions) {
    const id = this.seq++;
    const worker = this.ensure();
    const copy = new Uint8ClampedArray(rgba);
    return new Promise<RunOutput & { usedWasm: boolean }>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(
        { id, kind: "run", rgba: copy, w, h, options, useWasm: this.useWasm },
        [copy.buffer],
      );
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
