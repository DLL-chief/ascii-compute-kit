import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cpu, Gauge, Image as ImageIcon, Play } from "lucide-react";
import { Button } from "./button";
import { DEFAULT_RAMP, DIGIT_RAMP, MAX_FILE_BYTES, SAMPLE_SIZE } from "../ascii/constants";
import {
  asciiFilter,
  computeIndices,
  defaultOptions,
  toAsciiText,
} from "../ascii/kernel";
import { makeSampleImage } from "../ascii/sample";
import { frameFromImageFile, ImageLoadError } from "../ascii/from-file";
import type { AsciiOptions, BackendId, DetectResult, RunOutput } from "../ascii/types";
import { detect } from "../detect";
import { cn } from "./utils";

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
  return {
    sample,
    text: toAsciiText(indices, cols, rows, opt.ramp),
  };
})();

function copyPixels(src: Uint8ClampedArray) {
  const out = new Uint8ClampedArray(src.length);
  out.set(src);
  return out;
}

function paint(canvas: HTMLCanvasElement | null, frame: Frame | null) {
  if (!canvas || !frame) return false;
  try {
    const pixels = copyPixels(frame.rgba);
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.putImageData(new ImageData(pixels, frame.w, frame.h), 0, 0);
    return true;
  } catch {
    return false;
  }
}

function errText(err: unknown) {
  if (err instanceof ImageLoadError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

function localAscii(frame: Frame, opt: AsciiOptions) {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const { indices, cols, rows } = computeIndices(frame.rgba, frame.w, frame.h, opt);
  const text = toAsciiText(indices, cols, rows, opt.ramp);
  let rgba: Uint8ClampedArray;
  try {
    rgba = asciiFilter(frame.rgba, frame.w, frame.h, opt);
  } catch {
    rgba = new Uint8ClampedArray(frame.w * frame.h * 4);
  }
  const ms = typeof performance !== "undefined" ? performance.now() - t0 : 0;
  const out: RunOutput = { rgba, w: frame.w, h: frame.h, backend: "js-main", ms };
  return { text, out };
}

function CapRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: "wait" | "on" | "off";
  detail?: string;
}) {
  const mark = state === "wait" ? "проверяю" : state === "on" ? "есть" : "нет";
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] text-right text-xs tabular-nums",
          state === "on" && "text-foreground",
          state === "off" && "text-muted",
          state === "wait" && "text-subtle",
        )}
      >
        {mark}
        {state === "off" && detail ? ` · ${detail}` : null}
      </span>
    </li>
  );
}

export function AsciiStudio() {
  const srcRef = useRef<HTMLCanvasElement>(null);
  const dstRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caps, setCaps] = useState<DetectResult | null>(null);
  const [gpuPending, setGpuPending] = useState(true);
  const [source, setSource] = useState<Frame>(BOOT.sample);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [asciiText, setAsciiText] = useState(BOOT.text);
  const [choice, setChoice] = useState<BackendId | "auto">("js-main");
  const [invert, setInvert] = useState(false);
  const [digits, setDigits] = useState(false);
  const [cellW, setCellW] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Пластина уже в HTML — JS дорисует canvas");
  const [originNote, setOriginNote] = useState(`тестовая пластина ${SAMPLE_SIZE}×${SAMPLE_SIZE}`);

  const opt = useCallback(
    () =>
      defaultOptions({
        invert,
        cellW,
        cellH: Math.round(cellW * 1.75),
        ramp: digits ? DIGIT_RAMP : DEFAULT_RAMP,
      }),
    [invert, digits, cellW],
  );

  const show = useCallback((frame: Frame, text: string, out: RunOutput | null, note: string) => {
    setSource(frame);
    setAsciiText(text);
    setOutput(out);
    setOriginNote(note);
    paint(srcRef.current, frame);
    if (out) paint(dstRef.current, out);
  }, []);

  const runLocal = useCallback(
    (frame: Frame, note: string) => {
      try {
        const { text, out } = localAscii(frame, opt());
        show(frame, text, out, note);
        setError(null);
        setStatus(`Готово · JS поток · ${out.ms.toFixed(1)} мс`);
        return out;
      } catch (err) {
        setError(errText(err));
        setStatus("Сбой JS-фильтра");
        return null;
      }
    },
    [opt, show],
  );

  useLayoutEffect(() => {
    runLocal(BOOT.sample, `тестовая пластина ${SAMPLE_SIZE}×${SAMPLE_SIZE}`);
  }, []);

  useEffect(() => {
    setGpuPending(true);
    void detect((partial) => setCaps(partial))
      .then((full) => {
        setCaps(full);
        setGpuPending(false);
      })
      .catch((err: unknown) => {
        setGpuPending(false);
        setError(errText(err));
      });
  }, []);

  const run = async () => {
    const frame = source;
    const o = opt();
    if (choice === "js-main" || choice === "auto" && !caps) {
      runLocal(frame, originNote);
      return;
    }
    setBusy(true);
    setStatus(`Считаю (${LABELS[choice === "auto" ? "auto" : choice]})…`);
    setError(null);
    try {
      const { runPipeline } = await import("../pipeline");
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
      setError(errText(err));
      setStatus("Ошибка бэкенда, считаю JS");
      runLocal(frame, originNote);
    } finally {
      setBusy(false);
    }
  };

  const loadPlate = () => {
    setBusy(false);
    const sample = makeSampleImage();
    runLocal(sample, `тестовая пластина ${sample.w}×${sample.h}`);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    setStatus(`Читаю «${file.name}» (${mb} МБ)…`);
    setError(null);
    void frameFromImageFile(file)
      .then((loaded) => {
        const scaleNote = loaded.scaled
          ? `${loaded.originalW}×${loaded.originalH} → ${loaded.w}×${loaded.h}`
          : `${loaded.w}×${loaded.h}`;
        runLocal(loaded, `${file.name} · ${scaleNote}`);
      })
      .catch((err: unknown) => {
        setError(errText(err));
        setStatus("Файл не принят");
      })
      .finally(() => {
        if (fileRef.current) fileRef.current.value = "";
      });
  };

  const capState = (key: "workers" | "wasm" | "webgpu" | "webgl2" | "isolated"): "wait" | "on" | "off" => {
    if (!caps) return "wait";
    if (key === "webgpu" && gpuPending) return "wait";
    return caps[key] ? "on" : "off";
  };

  const backendMeta = (id: BackendId | "auto"): { ok: boolean; pending: boolean; hint: string } => {
    if (id === "auto" || id === "js-main") return { ok: true, pending: false, hint: "всегда" };
    if (!caps) return { ok: false, pending: true, hint: "проверяю" };
    if (id === "wasm-worker") {
      const ok = caps.workers && caps.wasm;
      return { ok, pending: false, hint: ok ? "есть" : "нет Worker или Wasm" };
    }
    if (id === "js-worker") {
      return { ok: caps.workers, pending: false, hint: caps.workers ? "есть" : "нет Worker" };
    }
    if (id === "webgpu") {
      return {
        ok: caps.webgpu,
        pending: gpuPending,
        hint: gpuPending ? "проверяю" : caps.webgpu ? "есть" : (caps.reasons.webgpu ?? "нет"),
      };
    }
    return {
      ok: caps.webgl2,
      pending: false,
      hint: caps.webgl2 ? "есть" : (caps.reasons.webgl2 ?? "нет"),
    };
  };

  const backendBtn = (id: BackendId | "auto") => {
    const meta = backendMeta(id);
    const disabled = !meta.ok || meta.pending;
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        onClick={() => setChoice(id)}
        className={cn(
          "flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors",
          choice === id
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-transparent text-foreground disabled:opacity-40",
        )}
      >
        <span className="text-sm font-medium">{LABELS[id]}</span>
        <span className={cn("text-xs leading-tight", choice === id ? "opacity-80" : "text-muted")}>
          {meta.hint}
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Compute kit</p>
        <h1 className="font-display text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          ASCII из картинки
        </h1>
        <p className="max-w-xl text-pretty text-muted">
          Рабочий кадр {SAMPLE_SIZE}×{SAMPLE_SIZE}, файл до {(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} МБ.
          Пластина считается сразу, без ожидания воркеров.
        </p>
      </header>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-lg border bg-elevated px-4 py-3",
          error ? "border-danger/40" : "border-border",
        )}
      >
        <p className="font-mono text-sm tabular-nums text-foreground">{status}</p>
        <p className="mt-1 font-mono text-xs text-muted">{originNote}</p>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="order-1 grid gap-4 sm:grid-cols-2 lg:order-2">
          <figure className="flex flex-col gap-2">
            <figcaption className="text-xs uppercase tracking-wider text-muted">Исходник</figcaption>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface outline outline-1 -outline-offset-1 outline-white/10">
              <canvas ref={srcRef} className="relative z-10 h-full w-full object-contain" />
            </div>
          </figure>
          <figure className="flex flex-col gap-2">
            <figcaption className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
              <Cpu className="size-3.5" /> ASCII
            </figcaption>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-bg outline outline-1 -outline-offset-1 outline-white/10">
              <pre className="absolute inset-0 overflow-hidden p-2 font-mono text-xs leading-none text-foreground whitespace-pre">
                {asciiText}
              </pre>
              <canvas ref={dstRef} className="relative z-10 h-full w-full object-contain" />
            </div>
          </figure>
        </div>

        <aside className="order-2 flex flex-col gap-5 rounded-xl border border-border bg-elevated p-5 lg:order-1">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Что умеет браузер</p>
            <ul>
              <CapRow label="Workers" state={capState("workers")} detail={caps?.reasons.workers} />
              <CapRow label="WebAssembly" state={capState("wasm")} detail={caps?.reasons.wasm} />
              <CapRow label="WebGPU" state={capState("webgpu")} detail={caps?.reasons.webgpu} />
              <CapRow label="WebGL2" state={capState("webgl2")} detail={caps?.reasons.webgl2} />
              <CapRow
                label="COOP / SharedArrayBuffer"
                state={capState("isolated")}
                detail="без изоляции страницы — нормально для GitHub Pages"
              />
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Бэкенд</p>
            <div className="flex flex-wrap gap-2">
              {(["auto", "webgpu", "webgl2", "wasm-worker", "js-worker", "js-main"] as const).map(
                backendBtn,
              )}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              Ячейка {cellW}×{Math.round(cellW * 1.75)}
            </span>
            <input
              type="range"
              min={6}
              max={14}
              value={cellW}
              onChange={(e) => setCellW(Number(e.target.value))}
              className="h-11 w-full accent-primary"
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="size-4 accent-primary"
              />
              Инверсия рампы
            </label>
            <label className="flex h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={digits}
                onChange={(e) => setDigits(e.target.checked)}
                className="size-4 accent-primary"
              />
              Только цифры 0–9
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => void run()}>
              <Play className="size-4" />
              {busy ? "Считаем…" : "Прогнать фильтр"}
            </Button>
            <Button type="button" variant="outline" onClick={loadPlate}>
              <Gauge className="size-4" />
              Тестовая пластина
            </Button>
            <label className="flex min-h-11 cursor-pointer flex-col justify-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface">
              <span className="inline-flex items-center gap-2">
                <ImageIcon className="size-4" />
                Свой файл (PNG, JPEG, WebP)
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp"
                className="w-full text-xs text-muted"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}
