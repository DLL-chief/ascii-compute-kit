# Архитектура

Два UI на одном ядре.

* GitHub Pages: `index.html` → `pages/app.js` → `detect` / `pipeline` / ASCII-ядро.
* React-снимок: `src/ui/ascii-studio.tsx` (превью TanStack Start, ADR-002).

Поток: RGBA 512×512 → индексы символов → текст и/или RGBA того же размера.

* `src/ascii/kernel.ts` — яркость ячейки, индекс рампы, растеризация глифов, `toAsciiText`.
* `src/ascii/wasm.ts` + `wasm-bytes.ts` — та же яркость/индекс на Wasm; исходник `wasm/ascii.rs`.
* GPU (`src/backends/gpu-luma.ts`) считает сетку яркости; глифы — тот же 2D-шрифт.
* Worker: `src/workers/compute.worker.ts`. На Pages бандл `pages/compute.worker.js` через `setComputeWorkerUrl`.

Авто-порядок: WebGPU → WebGL2 → Wasm+Worker → JS Worker → JS поток.
Первый кадр всегда JS, чтобы страница не зависела от rAF/adapter.
