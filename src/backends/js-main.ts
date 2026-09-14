import { asciiFilter } from "../ascii/kernel";
import type { Backend, DetectResult, RunInput, RunOutput } from "../ascii/types";

export const jsMainBackend: Backend = {
  id: "js-main",
  available() {
    return true;
  },
  async run(input: RunInput): Promise<RunOutput> {
    const t0 = performance.now();
    const rgba = asciiFilter(input.rgba, input.w, input.h, input.options);
    return {
      rgba,
      w: input.w,
      h: input.h,
      backend: "js-main",
      ms: performance.now() - t0,
    };
  },
};

export function alwaysAvailable(_d: DetectResult) {
  return true;
}
