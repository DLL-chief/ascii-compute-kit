# Архитектура

UI (`src/ui/ascii-studio.tsx`) → `detect` → `pipeline` → backend → ASCII-ядро.

* `src/ascii/kernel.ts` — яркость ячейки, индекс рампы, растеризация глифов, `toAsciiText` (SSR/iframe без canvas).
* `src/ascii/wasm.ts` + `wasm-bytes.ts` — та же яркость/индекс на Wasm; исходник `wasm/ascii.rs`.
* GPU (`src/backends/gpu-luma.ts`) считает сетку яркости; глифы — тот же 2D-шрифт.
* Worker: `src/workers/compute.worker.ts`, JS или Wasm.

Поток: RGBA 512×512 → индексы символов → текст и/или RGBA того же размера.

Авто-порядок: WebGPU → WebGL2 → Wasm+Worker → JS Worker → JS поток.
Первый кадр всегда JS, чтобы превью не зависело от rAF/adapter.
