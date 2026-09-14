var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/backends/worker-client.ts
function setComputeWorkerUrl(url) {
  workerUrlOverride = url;
}
var workerUrlOverride, ComputeWorkerClient;
var init_worker_client = __esm({
  "src/backends/worker-client.ts"() {
    ComputeWorkerClient = class {
      constructor(useWasm, workerUrl) {
        this.useWasm = useWasm;
        this.workerUrl = workerUrl;
      }
      worker = null;
      seq = 1;
      pending = /* @__PURE__ */ new Map();
      script() {
        if (this.workerUrl) return this.workerUrl;
        if (workerUrlOverride) return workerUrlOverride;
        return new URL("../workers/compute.worker.ts", import.meta.url);
      }
      ensure() {
        if (this.worker) return this.worker;
        const worker = new Worker(this.script(), { type: "module" });
        worker.onmessage = (ev) => {
          const data = ev.data;
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
              usedWasm: data.usedWasm
            });
            return;
          }
          p.resolve({
            rgba: data.rgba,
            w: data.w,
            h: data.h,
            backend: this.useWasm ? "wasm-worker" : "js-worker",
            ms: data.ms,
            usedWasm: data.usedWasm
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
        return new Promise((resolve, reject) => {
          this.pending.set(id, {
            resolve: () => resolve(),
            reject
          });
          worker.postMessage({ id, kind: "init", useWasm: this.useWasm });
        });
      }
      async run(rgba, w, h, options) {
        const id = this.seq++;
        const worker = this.ensure();
        const copy = new Uint8ClampedArray(rgba);
        return new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          worker.postMessage(
            { id, kind: "run", rgba: copy, w, h, options, useWasm: this.useWasm },
            [copy.buffer]
          );
        });
      }
      dispose() {
        this.worker?.terminate();
        this.worker = null;
        this.pending.clear();
      }
    };
  }
});

// src/ascii/constants.ts
var DEFAULT_RAMP, DIGIT_RAMP, DEFAULT_CELL_W, DEFAULT_CELL_H, SAMPLE_SIZE, MAX_FILE_BYTES, MAX_DECODE_EDGE;
var init_constants = __esm({
  "src/ascii/constants.ts"() {
    DEFAULT_RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
    DIGIT_RAMP = "1732549608";
    DEFAULT_CELL_W = 8;
    DEFAULT_CELL_H = 14;
    SAMPLE_SIZE = 512;
    MAX_FILE_BYTES = 12 * 1024 * 1024;
    MAX_DECODE_EDGE = 8192;
  }
});

// src/ascii/kernel.ts
function lumaAt(rgba, i) {
  const r = rgba[i] ?? 0;
  const g = rgba[i + 1] ?? 0;
  const b = rgba[i + 2] ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function gridSize(w, h, cellW, cellH) {
  return { cols: Math.floor(w / cellW), rows: Math.floor(h / cellH) };
}
function computeIndices(rgba, w, h, options) {
  const { cellW, cellH, ramp, invert } = options;
  const { cols, rows } = gridSize(w, h, cellW, cellH);
  const indices = new Uint8Array(cols * rows);
  const rampMax = Math.max(1, ramp.length - 1);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let n = 0;
      const x0 = col * cellW;
      const y0 = row * cellH;
      for (let y = 0; y < cellH; y++) {
        const yy = y0 + y;
        if (yy >= h) break;
        const rowOff = yy * w * 4;
        for (let x = 0; x < cellW; x++) {
          const xx = x0 + x;
          if (xx >= w) break;
          sum += lumaAt(rgba, rowOff + xx * 4);
          n++;
        }
      }
      let yNorm = n === 0 ? 0 : sum / n / 255;
      if (invert) yNorm = 1 - yNorm;
      indices[row * cols + col] = Math.min(rampMax, Math.floor(yNorm * rampMax));
    }
  }
  return { indices, cols, rows };
}
function drawingContext(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C 2D-\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 OffscreenCanvas");
    return { ctx, canvas };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C 2D-\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 canvas");
    return { ctx, canvas };
  }
  throw new Error("\u041D\u0435\u0442 canvas \u0434\u043B\u044F \u0440\u0430\u0441\u0442\u0435\u0440\u0438\u0437\u0430\u0446\u0438\u0438 \u0433\u043B\u0438\u0444\u043E\u0432");
}
function rasterizeGlyphs(indices, cols, rows, w, h, options) {
  const { cellW, cellH, ramp, invert } = options;
  try {
    const { ctx, canvas } = drawingContext(w, h);
    ctx.imageSmoothingEnabled = false;
    const bg = invert ? "#ece7dc" : "#0c0d0b";
    const fg = invert ? "#16170f" : "#ece7dc";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `700 ${cellH}px ui-monospace, "IBM Plex Mono", monospace`;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = indices[row * cols + col] ?? 0;
        const ch = ramp[idx] ?? " ";
        ctx.fillText(ch, col * cellW, row * cellH);
      }
    }
    return ctx.getImageData(0, 0, w, h).data;
  } catch {
    return new Uint8ClampedArray(w * h * 4);
  }
}
function toAsciiText(indices, cols, rows, ramp) {
  const lines = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const idx = indices[row * cols + col] ?? 0;
      line += ramp[idx] ?? " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
function asciiFilter(rgba, w, h, options) {
  const { indices, cols, rows } = computeIndices(rgba, w, h, options);
  return rasterizeGlyphs(indices, cols, rows, w, h, options);
}
function defaultOptions(partial) {
  return {
    cellW: DEFAULT_CELL_W,
    cellH: DEFAULT_CELL_H,
    ramp: DEFAULT_RAMP,
    invert: false,
    colored: false,
    ...partial
  };
}
var init_kernel = __esm({
  "src/ascii/kernel.ts"() {
    init_constants();
  }
});

// src/ascii/types.ts
var AUTO_ORDER;
var init_types = __esm({
  "src/ascii/types.ts"() {
    AUTO_ORDER = [
      "webgpu",
      "webgl2",
      "wasm-worker",
      "js-worker",
      "js-main"
    ];
  }
});

// src/backends/js-main.ts
var jsMainBackend;
var init_js_main = __esm({
  "src/backends/js-main.ts"() {
    init_kernel();
    jsMainBackend = {
      id: "js-main",
      available() {
        return true;
      },
      async run(input) {
        const t0 = performance.now();
        const rgba = asciiFilter(input.rgba, input.w, input.h, input.options);
        return {
          rgba,
          w: input.w,
          h: input.h,
          backend: "js-main",
          ms: performance.now() - t0
        };
      }
    };
  }
});

// src/backends/js-worker.ts
var client, jsWorkerBackend;
var init_js_worker = __esm({
  "src/backends/js-worker.ts"() {
    init_worker_client();
    client = new ComputeWorkerClient(false);
    jsWorkerBackend = {
      id: "js-worker",
      available(d) {
        return d.workers;
      },
      async init() {
        await client.init();
      },
      async run(input) {
        const out = await client.run(input.rgba, input.w, input.h, input.options);
        return { ...out, backend: "js-worker" };
      },
      async dispose() {
        client.dispose();
      }
    };
  }
});

// src/backends/wasm-worker.ts
var client2, wasmWorkerBackend;
var init_wasm_worker = __esm({
  "src/backends/wasm-worker.ts"() {
    init_worker_client();
    client2 = new ComputeWorkerClient(true);
    wasmWorkerBackend = {
      id: "wasm-worker",
      available(d) {
        return d.workers && d.wasm;
      },
      async init() {
        await client2.init();
      },
      async run(input) {
        const out = await client2.run(input.rgba, input.w, input.h, input.options);
        if (!out.usedWasm) {
          throw new Error("Worker \u043D\u0435 \u0441\u043C\u043E\u0433 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C Wasm");
        }
        return { ...out, backend: "wasm-worker" };
      },
      async dispose() {
        client2.dispose();
      }
    };
  }
});

// src/backends/gpu-luma.ts
function indicesFromLumaGrid(luma, cols, rows, invert, rampLen) {
  const indices = new Uint8Array(cols * rows);
  const rampMax = Math.max(1, rampLen - 1);
  for (let i = 0; i < indices.length; i++) {
    let y = luma[i] ?? 0;
    if (y > 1) y = y / 255;
    if (invert) y = 1 - y;
    indices[i] = Math.min(rampMax, Math.floor(y * rampMax));
  }
  return indices;
}
async function webgpuIndices(rgba, w, h, options) {
  const gpu = navigator.gpu;
  if (!gpu) throw new Error("WebGPU \u043D\u0435\u0442");
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("\u041D\u0435\u0442 GPU adapter");
  const device = await adapter.requestDevice();
  const cols = Math.floor(w / options.cellW);
  const rows = Math.floor(h / options.cellH);
  const shader = device.createShaderModule({
    code: `
struct Params { w: u32, h: u32, cell_w: u32, cell_h: u32, cols: u32, rows: u32, }
@group(0) @binding(0) var<storage, read> src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<uniform> p: Params;

fn unpack_rgba(v: u32) -> vec4<f32> {
  let r = f32(v & 255u);
  let g = f32((v >> 8u) & 255u);
  let b = f32((v >> 16u) & 255u);
  return vec4(r, g, b, 1.0);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= p.cols || id.y >= p.rows) { return; }
  var sum = 0.0;
  var n = 0.0;
  let x0 = id.x * p.cell_w;
  let y0 = id.y * p.cell_h;
  for (var y: u32 = 0u; y < p.cell_h; y++) {
    let yy = y0 + y;
    if (yy >= p.h) { break; }
    for (var x: u32 = 0u; x < p.cell_w; x++) {
      let xx = x0 + x;
      if (xx >= p.w) { break; }
      let packed = src[yy * p.w + xx];
      let c = unpack_rgba(packed);
      sum += 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      n += 1.0;
    }
  }
  dst[id.y * p.cols + id.x] = select(0.0, sum / n / 255.0, n > 0.0);
}
`
  });
  const packed = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    packed[i] = (rgba[o] ?? 0) | (rgba[o + 1] ?? 0) << 8 | (rgba[o + 2] ?? 0) << 16 | (rgba[o + 3] ?? 255) << 24;
  }
  const srcBuf = device.createBuffer({
    size: packed.byteLength,
    usage: GPU_STORAGE | GPU_COPY_DST
  });
  device.queue.writeBuffer(srcBuf, 0, packed);
  const dstSize = cols * rows * 4;
  const dstBuf = device.createBuffer({
    size: dstSize,
    usage: GPU_STORAGE | GPU_COPY_SRC
  });
  const readBuf = device.createBuffer({
    size: dstSize,
    usage: GPU_COPY_DST | GPU_MAP_READ
  });
  const paramBuf = device.createBuffer({
    size: 32,
    usage: GPU_UNIFORM | GPU_COPY_DST
  });
  const params = new Uint32Array([w, h, options.cellW, options.cellH, cols, rows, 0, 0]);
  device.queue.writeBuffer(paramBuf, 0, params);
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPU_COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPU_COMPUTE, buffer: { type: "storage" } },
      { binding: 2, visibility: GPU_COMPUTE, buffer: { type: "uniform" } }
    ]
  });
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: { module: shader, entryPoint: "main" }
  });
  const bind = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: srcBuf } },
      { binding: 1, resource: { buffer: dstBuf } },
      { binding: 2, resource: { buffer: paramBuf } }
    ]
  });
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
  pass.end();
  enc.copyBufferToBuffer(dstBuf, 0, readBuf, 0, dstSize);
  device.queue.submit([enc.finish()]);
  await readBuf.mapAsync(GPU_MAP_READ);
  const luma = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  device.destroy();
  return {
    indices: indicesFromLumaGrid(luma, cols, rows, options.invert, options.ramp.length),
    cols,
    rows
  };
}
function webgl2Indices(rgba, w, h, options) {
  const canvas = document.createElement("canvas");
  const cols = Math.floor(w / options.cellW);
  const rows = Math.floor(h / options.cellH);
  canvas.width = cols;
  canvas.height = rows;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("\u041D\u0435\u0442 WebGL2");
  const vs = `#version 300 es
  const vec2 pos[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main() { gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0); }`;
  const fs = `#version 300 es
  precision highp float;
  uniform sampler2D src;
  uniform vec2 srcSize;
  uniform vec2 cellSize;
  uniform float rows;
  out vec4 color;
  void main() {
    float cellX = floor(gl_FragCoord.x);
    float cellY = rows - 1.0 - floor(gl_FragCoord.y);
    vec2 origin = vec2(cellX, cellY) * cellSize;
    float sum = 0.0;
    float n = 0.0;
    for (int y = 0; y < 32; y++) {
      if (float(y) >= cellSize.y) break;
      for (int x = 0; x < 32; x++) {
        if (float(x) >= cellSize.x) break;
        vec2 img = origin + vec2(float(x) + 0.5, float(y) + 0.5);
        vec2 uv = vec2(img.x / srcSize.x, 1.0 - img.y / srcSize.y);
        vec4 c = texture(src, uv);
        sum += 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        n += 1.0;
      }
    }
    float yv = n > 0.0 ? sum / n : 0.0;
    color = vec4(yv, yv, yv, 1.0);
  }`;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("shader");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || "compile");
    }
    return sh;
  };
  const prog = gl.createProgram();
  if (!prog) throw new Error("program");
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || "link");
  }
  gl.useProgram(prog);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  gl.uniform1i(gl.getUniformLocation(prog, "src"), 0);
  gl.uniform2f(gl.getUniformLocation(prog, "srcSize"), w, h);
  gl.uniform2f(gl.getUniformLocation(prog, "cellSize"), options.cellW, options.cellH);
  gl.uniform1f(gl.getUniformLocation(prog, "rows"), rows);
  gl.viewport(0, 0, cols, rows);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const pixels = new Uint8Array(cols * rows * 4);
  gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const luma = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    const srcRow = rows - 1 - row;
    for (let col = 0; col < cols; col++) {
      luma[row * cols + col] = pixels[(srcRow * cols + col) * 4] ?? 0;
    }
  }
  return {
    indices: indicesFromLumaGrid(luma, cols, rows, options.invert, options.ramp.length),
    cols,
    rows
  };
}
var GPU_STORAGE, GPU_COPY_DST, GPU_COPY_SRC, GPU_MAP_READ, GPU_UNIFORM, GPU_COMPUTE;
var init_gpu_luma = __esm({
  "src/backends/gpu-luma.ts"() {
    init_kernel();
    GPU_STORAGE = 128;
    GPU_COPY_DST = 8;
    GPU_COPY_SRC = 4;
    GPU_MAP_READ = 1;
    GPU_UNIFORM = 64;
    GPU_COMPUTE = 4;
  }
});

// src/backends/webgpu.ts
var webgpuBackend;
var init_webgpu = __esm({
  "src/backends/webgpu.ts"() {
    init_kernel();
    init_gpu_luma();
    webgpuBackend = {
      id: "webgpu",
      available(d) {
        return d.webgpu;
      },
      async run(input) {
        const t0 = performance.now();
        const { indices, cols, rows } = await webgpuIndices(
          input.rgba,
          input.w,
          input.h,
          input.options
        );
        const rgba = rasterizeGlyphs(indices, cols, rows, input.w, input.h, input.options);
        return {
          rgba,
          w: input.w,
          h: input.h,
          backend: "webgpu",
          ms: performance.now() - t0
        };
      }
    };
  }
});

// src/backends/webgl2.ts
var webgl2Backend;
var init_webgl2 = __esm({
  "src/backends/webgl2.ts"() {
    init_kernel();
    init_gpu_luma();
    webgl2Backend = {
      id: "webgl2",
      available(d) {
        return d.webgl2;
      },
      async run(input) {
        const t0 = performance.now();
        const { indices, cols, rows } = webgl2Indices(
          input.rgba,
          input.w,
          input.h,
          input.options
        );
        const rgba = rasterizeGlyphs(indices, cols, rows, input.w, input.h, input.options);
        return {
          rgba,
          w: input.w,
          h: input.h,
          backend: "webgl2",
          ms: performance.now() - t0
        };
      }
    };
  }
});

// src/pipeline/index.ts
var pipeline_exports = {};
__export(pipeline_exports, {
  getBackend: () => getBackend,
  runPipeline: () => runPipeline
});
function getBackend(id) {
  return backends[id];
}
async function runPipeline(detect2, input, command) {
  const order = command.type === "use" ? [command.backend] : AUTO_ORDER.filter((id) => backends[id].available(detect2));
  let lastError = "";
  let fallbackFrom;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const b = backends[id];
    if (!b.available(detect2) && command.type === "use") {
      throw new Error(`\u0411\u044D\u043A\u0435\u043D\u0434 ${id} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D`);
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
  throw new Error(lastError || "\u041D\u0438 \u043E\u0434\u0438\u043D \u0431\u044D\u043A\u0435\u043D\u0434 \u043D\u0435 \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u043B");
}
var backends, inited;
var init_pipeline = __esm({
  "src/pipeline/index.ts"() {
    init_types();
    init_js_main();
    init_js_worker();
    init_wasm_worker();
    init_webgpu();
    init_webgl2();
    backends = {
      "js-main": jsMainBackend,
      "js-worker": jsWorkerBackend,
      "wasm-worker": wasmWorkerBackend,
      webgpu: webgpuBackend,
      webgl2: webgl2Backend
    };
    inited = /* @__PURE__ */ new Set();
  }
});

// pages/app.ts
init_worker_client();
init_constants();
init_kernel();

// src/ascii/sample.ts
init_constants();
function makeSampleImage(size = SAMPLE_SIZE) {
  const w = size;
  const h = size;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const cx = w * 0.34;
  const cy = h * 0.4;
  const r = size * 0.24;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = 0.92 - y / (h - 1) * 0.06;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r) {
        const ring = Math.abs(d - r * 0.58) < r * 0.07;
        v = ring ? 0.1 : 0.18 + (1 - d / r) * 0.12;
      }
      if (x > w * 0.58 && x < w * 0.9 && y > h * 0.12 && y < h * 0.72) {
        const cell = 28;
        v = Math.floor((x - w * 0.58) / cell) + Math.floor((y - h * 0.12) / cell) & 1 ? 0.08 : 0.9;
      }
      if (y > h * 0.8 && y < h * 0.9) {
        v = Math.floor(x / 18) % 2 === 0 ? 0.08 : 0.9;
      }
      const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
      rgba[i] = g;
      rgba[i + 1] = Math.round(g * 0.97);
      rgba[i + 2] = Math.round(g * 0.9);
      rgba[i + 3] = 255;
    }
  }
  return { rgba, w, h };
}

// src/ascii/from-file.ts
init_constants();
var ImageLoadError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "ImageLoadError";
  }
};
function assertFile(file) {
  if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)) {
    throw new ImageLoadError(
      `\u042D\u0442\u043E \u043D\u0435 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 (${file.type || file.name || "\u043D\u0435\u0442 \u0442\u0438\u043F\u0430"}). \u041D\u0443\u0436\u0435\u043D PNG, JPEG \u0438\u043B\u0438 WebP.`,
      "type"
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const cap = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new ImageLoadError(`\u0424\u0430\u0439\u043B ${mb} \u041C\u0411, \u043B\u0438\u043C\u0438\u0442 ${cap} \u041C\u0411. \u0421\u043E\u0436\u043C\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0431\u0440\u0435\u0436\u044C\u0442\u0435 \u0441\u043D\u0438\u043C\u043E\u043A.`, "size");
  }
  if (file.size < 24) {
    throw new ImageLoadError("\u0424\u0430\u0439\u043B \u043F\u0443\u0441\u0442\u043E\u0439.", "size");
  }
}
function fitToWork(imgW, imgH, canvas, draw) {
  if (imgW > MAX_DECODE_EDGE || imgH > MAX_DECODE_EDGE) {
    throw new ImageLoadError(
      `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u043A\u0430\u0434\u0440 ${imgW}\xD7${imgH} (\u043B\u0438\u043C\u0438\u0442 ${MAX_DECODE_EDGE} \u043F\u043E \u0441\u0442\u043E\u0440\u043E\u043D\u0435).`,
      "pixels"
    );
  }
  const size = SAMPLE_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new ImageLoadError("\u041D\u0435\u0442 2D-\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430 canvas.", "canvas");
  ctx.fillStyle = "#ece7dc";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / imgW, size / imgH);
  const dw = Math.max(1, Math.round(imgW * scale));
  const dh = Math.max(1, Math.round(imgH * scale));
  draw(ctx, (size - dw) / 2, (size - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, size, size);
  return {
    rgba: new Uint8ClampedArray(data.data),
    w: size,
    h: size,
    scaled: imgW !== size || imgH !== size
  };
}
async function frameFromImageFile(file) {
  assertFile(file);
  const url = URL.createObjectURL(file);
  try {
    let imgW = 0;
    let imgH = 0;
    const canvas = document.createElement("canvas");
    let fitted;
    if (typeof createImageBitmap === "function") {
      let bmp = null;
      try {
        bmp = await createImageBitmap(file);
      } catch {
        throw new ImageLoadError(
          "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u0441\u043C\u043E\u0433 \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0444\u0430\u0439\u043B. HEIC/AVIF \u0447\u0430\u0441\u0442\u043E \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 PNG \u0438\u043B\u0438 JPEG.",
          "decode"
        );
      }
      imgW = bmp.width;
      imgH = bmp.height;
      try {
        fitted = fitToWork(imgW, imgH, canvas, (ctx, x, y, w, h) => {
          ctx.drawImage(bmp, x, y, w, h);
        });
      } finally {
        bmp.close();
      }
    } else {
      fitted = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            imgW = img.naturalWidth;
            imgH = img.naturalHeight;
            resolve(
              fitToWork(imgW, imgH, canvas, (ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h))
            );
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(
          new ImageLoadError(
            "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u0441\u043C\u043E\u0433 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0444\u0430\u0439\u043B.",
            "decode"
          )
        );
        img.src = url;
      });
    }
    return {
      ...fitted,
      originalW: imgW,
      originalH: imgH,
      fileBytes: file.size
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// src/detect/index.ts
var GPU_WAIT_MS = 1500;
function timeout(ms, value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}
async function detect(onPartial) {
  const reasons = {};
  const workers = typeof Worker === "function";
  if (!workers) reasons.workers = "Worker API \u043D\u0435\u0442 \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435";
  const wasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  if (!wasm) reasons.wasm = "WebAssembly \u043D\u0435\u0442 \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435";
  let webgl2 = false;
  if (typeof document !== "undefined") {
    try {
      const c = document.createElement("canvas");
      webgl2 = !!c.getContext("webgl2");
    } catch {
      webgl2 = false;
    }
  }
  if (!webgl2) reasons.webgl2 = "\u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 WebGL2 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F";
  const isolated = !!globalThis.crossOriginIsolated;
  if (!isolated) reasons.webgpu = reasons.webgpu;
  const partial = {
    workers,
    wasm,
    webgpu: false,
    webgl2,
    isolated,
    reasons: {
      ...reasons,
      webgpu: "\u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E GPU adapter\u2026"
    }
  };
  onPartial?.(partial);
  let webgpu = false;
  const gpu = navigator.gpu;
  if (!gpu) {
    reasons.webgpu = "navigator.gpu \u043D\u0435\u0442 (\u043D\u0443\u0436\u0435\u043D Chrome/Edge \u0441 WebGPU)";
  } else {
    const probed = await Promise.race([
      gpu.requestAdapter().then((adapter) => ({ ok: !!adapter, why: adapter ? "" : "requestAdapter() \u043F\u0443\u0441\u0442\u043E\u0439" })).catch((err) => ({
        ok: false,
        why: err instanceof Error ? err.message : "\u043E\u0448\u0438\u0431\u043A\u0430 adapter"
      })),
      timeout(GPU_WAIT_MS, { ok: false, why: `\u043D\u0435\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u0437\u0430 ${GPU_WAIT_MS / 1e3} \u0441` })
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
    reasons
  };
}

// pages/app.ts
setComputeWorkerUrl(new URL("./compute.worker.js", import.meta.url));
var LABELS = {
  auto: "\u0410\u0432\u0442\u043E",
  webgpu: "WebGPU",
  webgl2: "WebGL2",
  "wasm-worker": "Wasm + Worker",
  "js-worker": "JS Worker",
  "js-main": "JS \u043F\u043E\u0442\u043E\u043A"
};
var BOOT = (() => {
  const sample = makeSampleImage();
  const opt2 = defaultOptions();
  const { indices, cols, rows } = computeIndices(sample.rgba, sample.w, sample.h, opt2);
  return { sample, text: toAsciiText(indices, cols, rows, opt2.ramp) };
})();
function copyPixels(src) {
  const out = new Uint8ClampedArray(src.length);
  out.set(src);
  return out;
}
function paint(canvas, frame) {
  if (!canvas || !frame) return;
  try {
    const pixels = copyPixels(frame.rgba);
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixels, frame.w, frame.h), 0, 0);
  } catch {
  }
}
function errText(err) {
  if (err instanceof ImageLoadError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
function localAscii(frame, opt2) {
  const t0 = performance.now();
  const { indices, cols, rows } = computeIndices(frame.rgba, frame.w, frame.h, opt2);
  const text = toAsciiText(indices, cols, rows, opt2.ramp);
  let rgba;
  try {
    rgba = asciiFilter(frame.rgba, frame.w, frame.h, opt2);
  } catch {
    rgba = new Uint8ClampedArray(frame.w * frame.h * 4);
  }
  const out = {
    rgba,
    w: frame.w,
    h: frame.h,
    backend: "js-main",
    ms: performance.now() - t0
  };
  return { text, out };
}
var $ = (id) => document.getElementById(id);
var srcCanvas = $("src");
var dstCanvas = $("dst");
var asciiPre = $("ascii");
var statusEl = $("status");
var originEl = $("origin");
var errorEl = $("error");
var banner = $("banner");
var runBtn = $("run");
var fileInput = $("file");
var cellLabel = $("cell-label");
var cellInput = $("cell");
var invertInput = $("invert");
var digitsInput = $("digits");
var caps = null;
var gpuPending = true;
var source = BOOT.sample;
var originNote = `\u0442\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043F\u043B\u0430\u0441\u0442\u0438\u043D\u0430 ${SAMPLE_SIZE}\xD7${SAMPLE_SIZE}`;
var choice = "js-main";
var busy = false;
function opt() {
  const cellW = Number(cellInput.value);
  return defaultOptions({
    invert: invertInput.checked,
    cellW,
    cellH: Math.round(cellW * 1.75),
    ramp: digitsInput.checked ? DIGIT_RAMP : DEFAULT_RAMP
  });
}
function setStatus(text, error) {
  statusEl.textContent = text;
  originEl.textContent = originNote;
  if (error) {
    errorEl.hidden = false;
    errorEl.textContent = error;
    banner.classList.add("is-error");
  } else {
    errorEl.hidden = true;
    errorEl.textContent = "";
    banner.classList.remove("is-error");
  }
}
function show(frame, text, out, note) {
  source = frame;
  originNote = note;
  asciiPre.textContent = text;
  paint(srcCanvas, frame);
  if (out) paint(dstCanvas, out);
}
function runLocal(frame, note) {
  try {
    const { text, out } = localAscii(frame, opt());
    show(frame, text, out, note);
    setStatus(`\u0413\u043E\u0442\u043E\u0432\u043E \xB7 JS \u043F\u043E\u0442\u043E\u043A \xB7 ${out.ms.toFixed(1)} \u043C\u0441`);
    return out;
  } catch (err) {
    setStatus("\u0421\u0431\u043E\u0439 JS-\u0444\u0438\u043B\u044C\u0442\u0440\u0430", errText(err));
    return null;
  }
}
function capMark(on, pending) {
  if (pending) return "\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E";
  return on ? "\u0435\u0441\u0442\u044C" : "\u043D\u0435\u0442";
}
function paintCaps() {
  const rows = [
    ["workers", caps?.workers, !caps, caps?.reasons.workers],
    ["wasm", caps?.wasm, !caps, caps?.reasons.wasm],
    ["webgpu", caps?.webgpu, !caps || gpuPending, caps?.reasons.webgpu],
    ["webgl2", caps?.webgl2, !caps, caps?.reasons.webgl2],
    ["isolated", caps?.isolated, !caps, "\u0431\u0435\u0437 \u0438\u0437\u043E\u043B\u044F\u0446\u0438\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u2014 \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E \u0434\u043B\u044F GitHub Pages"]
  ];
  for (const [key, on, pending, detail] of rows) {
    const el = document.querySelector(`[data-cap="${key}"]`);
    if (!el) continue;
    el.textContent = capMark(on, pending) + (!pending && !on && detail ? ` \xB7 ${detail}` : "");
    el.classList.toggle("is-on", !pending && !!on);
    el.classList.toggle("is-off", !pending && !on);
    el.classList.toggle("is-wait", pending);
  }
  document.querySelectorAll("[data-backend]").forEach((btn) => {
    const id = btn.dataset.backend;
    let hint = "\u0432\u0441\u0435\u0433\u0434\u0430";
    let ok = true;
    let pending = false;
    if (id === "wasm-worker") {
      ok = !!caps?.workers && !!caps?.wasm;
      pending = !caps;
      hint = pending ? "\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E" : ok ? "\u0435\u0441\u0442\u044C" : "\u043D\u0435\u0442 Worker \u0438\u043B\u0438 Wasm";
    } else if (id === "js-worker") {
      ok = !!caps?.workers;
      pending = !caps;
      hint = pending ? "\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E" : ok ? "\u0435\u0441\u0442\u044C" : "\u043D\u0435\u0442 Worker";
    } else if (id === "webgpu") {
      ok = !!caps?.webgpu;
      pending = !caps || gpuPending;
      hint = pending ? "\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E" : ok ? "\u0435\u0441\u0442\u044C" : caps?.reasons.webgpu ?? "\u043D\u0435\u0442";
    } else if (id === "webgl2") {
      ok = !!caps?.webgl2;
      pending = !caps;
      hint = pending ? "\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E" : ok ? "\u0435\u0441\u0442\u044C" : caps?.reasons.webgl2 ?? "\u043D\u0435\u0442";
    }
    btn.classList.toggle("is-active", choice === id);
    btn.querySelector(".hint").textContent = hint;
    btn.classList.toggle("is-missing", !pending && !ok && id !== "auto" && id !== "js-main");
  });
}
async function run() {
  const frame = source;
  const o = opt();
  if (choice === "js-main" || choice === "auto" && !caps) {
    runLocal(frame, originNote);
    return;
  }
  busy = true;
  runBtn.textContent = "\u0421\u0447\u0438\u0442\u0430\u0435\u043C\u2026";
  setStatus(`\u0421\u0447\u0438\u0442\u0430\u044E (${LABELS[choice]})\u2026`);
  try {
    const { runPipeline: runPipeline2 } = await Promise.resolve().then(() => (init_pipeline(), pipeline_exports));
    if (!caps) {
      runLocal(frame, originNote);
      return;
    }
    const command = choice === "auto" ? { type: "auto" } : { type: "use", backend: choice };
    const out = await runPipeline2(
      caps,
      { rgba: frame.rgba, w: frame.w, h: frame.h, options: o },
      command
    );
    const { indices, cols, rows } = computeIndices(frame.rgba, frame.w, frame.h, o);
    show(frame, toAsciiText(indices, cols, rows, o.ramp), out, originNote);
    const fb = out.fallbackFrom ? ` \xB7 \u043E\u0442\u043A\u0430\u0442 \u0441 ${LABELS[out.fallbackFrom]}` : "";
    setStatus(`\u0413\u043E\u0442\u043E\u0432\u043E \xB7 ${LABELS[out.backend]} \xB7 ${out.ms.toFixed(1)} \u043C\u0441${fb}`);
  } catch (err) {
    setStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u0431\u044D\u043A\u0435\u043D\u0434\u0430, \u0441\u0447\u0438\u0442\u0430\u044E JS", errText(err));
    runLocal(frame, originNote);
  } finally {
    busy = false;
    runBtn.textContent = "\u041F\u0440\u043E\u0433\u043D\u0430\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440";
  }
}
function loadPlate() {
  busy = false;
  runBtn.textContent = "\u041F\u0440\u043E\u0433\u043D\u0430\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440";
  const sample = makeSampleImage();
  runLocal(sample, `\u0442\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043F\u043B\u0430\u0441\u0442\u0438\u043D\u0430 ${sample.w}\xD7${sample.h}`);
}
function onFile(file) {
  if (!file) return;
  const mb = (file.size / (1024 * 1024)).toFixed(2);
  setStatus(`\u0427\u0438\u0442\u0430\u044E \xAB${file.name}\xBB (${mb} \u041C\u0411)\u2026`);
  void frameFromImageFile(file).then((loaded) => {
    const scaleNote = loaded.scaled ? `${loaded.originalW}\xD7${loaded.originalH} \u2192 ${loaded.w}\xD7${loaded.h}` : `${loaded.w}\xD7${loaded.h}`;
    runLocal(loaded, `${file.name} \xB7 ${scaleNote}`);
  }).catch((err) => {
    setStatus("\u0424\u0430\u0439\u043B \u043D\u0435 \u043F\u0440\u0438\u043D\u044F\u0442", errText(err));
  }).finally(() => {
    fileInput.value = "";
  });
}
function syncCellLabel() {
  const w = Number(cellInput.value);
  cellLabel.textContent = `\u042F\u0447\u0435\u0439\u043A\u0430 ${w}\xD7${Math.round(w * 1.75)}`;
}
asciiPre.textContent = BOOT.text;
runLocal(BOOT.sample, `\u0442\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043F\u043B\u0430\u0441\u0442\u0438\u043D\u0430 ${SAMPLE_SIZE}\xD7${SAMPLE_SIZE}`);
paintCaps();
syncCellLabel();
setStatus("\u041F\u043B\u0430\u0441\u0442\u0438\u043D\u0430 \u0443\u0436\u0435 \u0432 HTML \u2014 JS \u0434\u043E\u0440\u0438\u0441\u043E\u0432\u0430\u043B canvas");
void detect((partial) => {
  caps = partial;
  paintCaps();
}).then((full) => {
  caps = full;
  gpuPending = false;
  paintCaps();
}).catch((err) => {
  gpuPending = false;
  setStatus(statusEl.textContent || "\u0414\u0435\u0442\u0435\u043A\u0442 \u0441\u0431\u043E\u0439\u043D\u0443\u043B", errText(err));
  paintCaps();
});
document.querySelectorAll("[data-backend]").forEach((btn) => {
  btn.addEventListener("click", () => {
    choice = btn.dataset.backend;
    paintCaps();
  });
});
runBtn.addEventListener("click", () => {
  void run();
});
$("plate").addEventListener("click", loadPlate);
fileInput.addEventListener("change", () => onFile(fileInput.files?.[0]));
cellInput.addEventListener("input", syncCellLabel);
