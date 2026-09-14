import { rasterizeGlyphs } from "../ascii/kernel";
import type { Backend, DetectResult, RunInput, RunOutput } from "../ascii/types";
import { webgl2Indices } from "./gpu-luma";

export const webgl2Backend: Backend = {
  id: "webgl2",
  available(d: DetectResult) {
    return d.webgl2;
  },
  async run(input: RunInput): Promise<RunOutput> {
    const t0 = performance.now();
    const { indices, cols, rows } = webgl2Indices(
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
      backend: "webgl2",
      ms: performance.now() - t0,
    };
  },
};
