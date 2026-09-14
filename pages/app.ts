import { setComputeWorkerUrl } from "../src/backends/worker-client";
import { DEFAULT_RAMP, DIGIT_RAMP, MAX_FILE_BYTES, SAMPLE_SIZE } from "../src/ascii/constants";
import {
  asciiFilter,
  computeIndices,
  defaultOptions,
  toAsciiText,
} from "../src/ascii/kernel";
import { makeSampleImage } from "../src/ascii/sample";
import { frameFromImageFile, ImageLoadError } from "../src/ascii/from-file";
import type { AsciiOptions, BackendId, DetectResult, RunOutput } from "../src/ascii/types";
import { detect } from "../src/detect";

setComputeWorkerUrl(new URL("./compute.worker" + ".js", import.meta.url));

const LABELS: Record<BackendId | "auto", string> = {
  auto: "Авто",
  webgpu: "WebGPU",
  webgl2: "WebGL2",
  "wasm-worker": "Wasm + Worker",
  "js-worker": "JS Worker",
  "js-main": "JS поток",
};

type Frame = { rgba: Uint8ClampedArray; w: number; h: number };

const BOOT = (() => {
  const sample = makeSampleImage();
  const opt = defaultOptions();
  const { indices, cols, rows } = computeIndices(sample.rgba, sample.w, sample.h, opt);
  return { sample, text: toAsciiText(indices, cols, rows, opt.ramp) };
})();

function copyPixels(src: Uint8ClampedArray) {
  const out = new Uint8ClampedArray(src.length);
  out.set(src);
  return out;
}

function paint(canvas: HTMLCanvasElement | null, frame: Frame | null) {
  if (!canvas || !frame) return;
  try {
    const pixels = copyPixels(frame.rgba);
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixels, frame.w, frame.h), 0, 0);
  } catch {
    /* iframe без canvas */
  }
}

function errText(err: unknown) {
  if (err instanceof ImageLoadError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

function localAscii(frame: Frame, opt: AsciiOptions) {
  const t0 = performance.now();
  const { indices, cols, rows } = computeIndices(frame.rgba, frame.w, frame.h, opt);
  const text = toAsciiText(indices, cols, rows, opt.ramp);
  let rgba: Uint8ClampedArray;
  try {
    rgba = asciiFilter(frame.rgba, frame.w, frame.h, opt);
  } catch {
    rgba = new Uint8ClampedArray(frame.w * frame.h * 4);
  }
  const out: RunOutput = {
    rgba,
    w: frame.w,
    h: frame.h,
    backend: "js-main",
    ms: performance.now() - t0,
  };
  return { text, out };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const srcCanvas = $ <HTMLCanvasElement>("src");
const dstCanvas = $ <HTMLCanvasElement>("dst");
const asciiPre = $ <HTMLPreElement>("ascii");
const statusEl = $ <HTMLElement>("status");
const originEl = $ <HTMLElement>("origin");
const errorEl = $ <HTMLElement>("error");
const banner = $ <HTMLElement>("banner");
const runBtn = $ <HTMLButtonElement>("run");
const fileInput = $ <HTMLInputElement>("file");
const cellLabel = $ <HTMLElement>("cell-label");
const cellInput = $ <HTMLInputElement>("cell");
const invertInput = $ <HTMLInputElement>("invert");
const digitsInput = $ <HTMLInputElement>("digits");

let caps: DetectResult | null = null;
let gpuPending = true;
let source: Frame = BOOT.sample;
let originNote = `тестовая пластина ${SAMPLE_SIZE}×${SAMPLE_SIZE}`;
let choice: BackendId | "auto" = "js-main";
let busy = false;

function opt(): AsciiOptions {
  const cellW = Number(cellInput.value);
  return defaultOptions({
    invert: invertInput.checked,
    cellW,
    cellH: Math.round(cellW * 1.75),
    ramp: digitsInput.checked ? DIGIT_RAMP : DEFAULT_RAMP,
  });
}

function setStatus(text: string, error?: string | null) {
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

function show(frame: Frame, text: string, out: RunOutput | null, note: string) {
  source = frame;
  originNote = note;
  asciiPre.textContent = text;
  paint(srcCanvas, frame);
  if (out) paint(dstCanvas, out);
}

function runLocal(frame: Frame, note: string) {
  try {
    const { text, out } = localAscii(frame, opt());
    show(frame, text, out, note);
    setStatus(`Готово · JS поток · ${out.ms.toFixed(1)} мс`);
    return out;
  } catch (err) {
    setStatus("Сбой JS-фильтра", errText(err));
    return null;
  }
}

function capMark(on: boolean | undefined, pending: boolean) {
  if (pending) return "проверяю";
  return on ? "есть" : "нет";
}

function paintCaps() {
  const rows: Array<[string, boolean | undefined, boolean, string?]> = [
    ["workers", caps?.workers, !caps, caps?.reasons.workers],
    ["wasm", caps?.wasm, !caps, caps?.reasons.wasm],
    ["webgpu", caps?.webgpu, !caps || gpuPending, caps?.reasons.webgpu],
    ["webgl2", caps?.webgl2, !caps, caps?.reasons.webgl2],
    ["isolated", caps?.isolated, !caps, "без изоляции страницы — нормально для GitHub Pages"],
  ];
  for (const [key, on, pending, detail] of rows) {
    const el = document.querySelector(`[data-cap="${key}"]`);
    if (!el) continue;
    el.textContent = capMark(on, pending) + ( !pending && !on && detail ? ` · ${detail}` : "");
    el.classList.toggle("is-on", !pending && !!on);
    el.classList.toggle("is-off", !pending && !on);
    el.classList.toggle("is-wait", pending);
  }
  document.querySelectorAll<HTMLButtonElement>("[data-backend]").forEach((btn) => {
    const id = btn.dataset.backend as BackendId | "auto";
    let hint = "всегда";
    let ok = true;
    let pending = false;
    if (id === "wasm-worker") {
      ok = !!caps?.workers && !!caps?.wasm;
      pending = !caps;
      hint = pending ? "проверяю" : ok ? "есть" : "нет Worker или Wasm";
    } else if (id === "js-worker") {
      ok = !!caps?.workers;
      pending = !caps;
      hint = pending ? "проверяю" : ok ? "есть" : "нет Worker";
    } else if (id === "webgpu") {
      ok = !!caps?.webgpu;
      pending = !caps || gpuPending;
      hint = pending ? "проверяю" : ok ? "есть" : (caps?.reasons.webgpu ?? "нет");
    } else if (id === "webgl2") {
      ok = !!caps?.webgl2;
      pending = !caps;
      hint = pending ? "проверяю" : ok ? "есть" : (caps?.reasons.webgl2 ?? "нет");
    }
    btn.classList.toggle("is-active", choice === id);
    btn.querySelector(".hint")!.textContent = hint;
    btn.classList.toggle("is-missing", !pending && !ok && id !== "auto" && id !== "js-main");
  });
}

async function run() {
  const frame = source;
  const o = opt();
  if (choice === "js-main" || (choice === "auto" && !caps)) {
    runLocal(frame, originNote);
    return;
  }
  busy = true;
  runBtn.textContent = "Считаем…";
  setStatus(`Считаю (${LABELS[choice]})…`);
  try {
    const { runPipeline } = await import("../src/pipeline");
    if (!caps) {
      runLocal(frame, originNote);
      return;
    }
    const command =
      choice === "auto"
        ? ({ type: "auto" } as const)
        : ({ type: "use", backend: choice } as const);
    const out = await runPipeline(
      caps,
      { rgba: frame.rgba, w: frame.w, h: frame.h, options: o },
      command,
    );
    const { indices, cols, rows } = computeIndices(frame.rgba, frame.w, frame.h, o);
    show(frame, toAsciiText(indices, cols, rows, o.ramp), out, originNote);
    const fb = out.fallbackFrom ? ` · откат с ${LABELS[out.fallbackFrom]}` : "";
    setStatus(`Готово · ${LABELS[out.backend]} · ${out.ms.toFixed(1)} мс${fb}`);
  } catch (err) {
    setStatus("Ошибка бэкенда, считаю JS", errText(err));
    runLocal(frame, originNote);
  } finally {
    busy = false;
    runBtn.textContent = "Прогнать фильтр";
  }
}

function loadPlate() {
  busy = false;
  runBtn.textContent = "Прогнать фильтр";
  const sample = makeSampleImage();
  runLocal(sample, `тестовая пластина ${sample.w}×${sample.h}`);
}

function onFile(file: File | undefined) {
  if (!file) return;
  const mb = (file.size / (1024 * 1024)).toFixed(2);
  setStatus(`Читаю «${file.name}» (${mb} МБ)…`);
  void frameFromImageFile(file)
    .then((loaded) => {
      const scaleNote = loaded.scaled
        ? `${loaded.originalW}×${loaded.originalH} → ${loaded.w}×${loaded.h}`
        : `${loaded.w}×${loaded.h}`;
      runLocal(loaded, `${file.name} · ${scaleNote}`);
    })
    .catch((err: unknown) => {
      setStatus("Файл не принят", errText(err));
    })
    .finally(() => {
      fileInput.value = "";
    });
}

function syncCellLabel() {
  const w = Number(cellInput.value);
  cellLabel.textContent = `Ячейка ${w}×${Math.round(w * 1.75)}`;
}

asciiPre.textContent = BOOT.text;
runLocal(BOOT.sample, `тестовая пластина ${SAMPLE_SIZE}×${SAMPLE_SIZE}`);
paintCaps();
syncCellLabel();
setStatus("Пластина уже в HTML — JS дорисовал canvas");

void detect((partial) => {
  caps = partial;
  paintCaps();
})
  .then((full) => {
    caps = full;
    gpuPending = false;
    paintCaps();
  })
  .catch((err: unknown) => {
    gpuPending = false;
    setStatus(statusEl.textContent || "Детект сбойнул", errText(err));
    paintCaps();
  });

document.querySelectorAll<HTMLButtonElement>("[data-backend]").forEach((btn) => {
  btn.addEventListener("click", () => {
    choice = btn.dataset.backend as BackendId | "auto";
    paintCaps();
  });
});

runBtn.addEventListener("click", () => {
  void run();
});
$ <HTMLButtonElement>("plate").addEventListener("click", loadPlate);
fileInput.addEventListener("change", () => onFile(fileInput.files?.[0]));
cellInput.addEventListener("input", syncCellLabel);
