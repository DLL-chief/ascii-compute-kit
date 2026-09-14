import { rasterizeGlyphs } from "../ascii/kernel";
import type { AsciiOptions } from "../ascii/types";

const GPU_STORAGE = 0x80;
const GPU_COPY_DST = 0x08;
const GPU_COPY_SRC = 0x04;
const GPU_MAP_READ = 0x01;
const GPU_UNIFORM = 0x40;
const GPU_COMPUTE = 0x04;

function indicesFromLumaGrid(
  luma: Float32Array | Uint8Array,
  cols: number,
  rows: number,
  invert: boolean,
  rampLen: number,
): Uint8Array {
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

export async function webgpuIndices(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  options: AsciiOptions,
): Promise<{ indices: Uint8Array; cols: number; rows: number }> {
  const gpu = navigator.gpu;
  if (!gpu) throw new Error("WebGPU нет");
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("Нет GPU adapter");
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
`,
  });

  const packed = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    packed[i] =
      (rgba[o] ?? 0) |
      ((rgba[o + 1] ?? 0) << 8) |
      ((rgba[o + 2] ?? 0) << 16) |
      ((rgba[o + 3] ?? 255) << 24);
  }

  const srcBuf = device.createBuffer({
    size: packed.byteLength,
    usage: GPU_STORAGE | GPU_COPY_DST,
  });
  device.queue.writeBuffer(srcBuf, 0, packed);

  const dstSize = cols * rows * 4;
  const dstBuf = device.createBuffer({
    size: dstSize,
    usage: GPU_STORAGE | GPU_COPY_SRC,
  });
  const readBuf = device.createBuffer({
    size: dstSize,
    usage: GPU_COPY_DST | GPU_MAP_READ,
  });
  const paramBuf = device.createBuffer({
    size: 32,
    usage: GPU_UNIFORM | GPU_COPY_DST,
  });
  const params = new Uint32Array([w, h, options.cellW, options.cellH, cols, rows, 0, 0]);
  device.queue.writeBuffer(paramBuf, 0, params);

  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPU_COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPU_COMPUTE, buffer: { type: "storage" } },
      { binding: 2, visibility: GPU_COMPUTE, buffer: { type: "uniform" } },
    ],
  });
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: { module: shader, entryPoint: "main" },
  });
  const bind = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: srcBuf } },
      { binding: 1, resource: { buffer: dstBuf } },
      { binding: 2, resource: { buffer: paramBuf } },
    ],
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
    rows,
  };
}

export function webgl2Indices(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  options: AsciiOptions,
): { indices: Uint8Array; cols: number; rows: number } {
  const canvas = document.createElement("canvas");
  const cols = Math.floor(w / options.cellW);
  const rows = Math.floor(h / options.cellH);
  canvas.width = cols;
  canvas.height = rows;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("Нет WebGL2");

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

  const compile = (type: number, src: string) => {
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
    rows,
  };
}

export { indicesFromLumaGrid, rasterizeGlyphs };
