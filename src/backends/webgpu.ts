import { rasterizeGlyphs } from "../ascii/kernel";
import type { Backend, DetectResult, RunInput, RunOutput } from "../ascii/types";
import { webgpuIndices } from "./gpu-luma";

export const webgpuBackend: Backend = {
  id: "webgpu",
  available(d: DetectResult) {
    return d.webgpu;
  },
  async run(input: RunInput): Promise<RunOutput> {
    const t0 = performance.now();
    const { indices, cols, rows } = await webgpuIndices(
      input.rgba,
      input.w,
      input.h,
      input.options,
    );
    const rgba = rasterizeGlyphs(indices, cols, rows, input.w, input.h, input.options);
    return {
      rgba,
      w: input.w,
      h: input.h,
      backend: "webgpu",
      ms: performance.now() - t0,
    };
  },
};
