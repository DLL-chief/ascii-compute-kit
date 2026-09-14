export type BackendId =
  | "js-main"
  | "js-worker"
  | "wasm-worker"
  | "webgpu"
  | "webgl2";

export type DetectResult = {
  workers: boolean;
  wasm: boolean;
  webgpu: boolean;
  webgl2: boolean;
  isolated: boolean;
  reasons: {
    workers?: string;
    wasm?: string;
    webgpu?: string;
    webgl2?: string;
  };
};

export type AsciiOptions = {
  cellW: number;
  cellH: number;
  ramp: string;
  invert: boolean;
  colored: boolean;
};

export type RunInput = {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
  options: AsciiOptions;
};

export type RunOutput = {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
  backend: BackendId;
  ms: number;
  fallbackFrom?: BackendId;
};

export interface Backend {
  id: BackendId;
  available(d: DetectResult): boolean;
  init?(): Promise<void>;
  run(input: RunInput): Promise<RunOutput>;
  dispose?(): Promise<void>;
}

export const AUTO_ORDER: BackendId[] = [
  "webgpu",
  "webgl2",
  "wasm-worker",
  "js-worker",
  "js-main",
];
