# ascii

Ядро: яркость ячейки → индекс рампы → глифы или текст.

* `kernel.ts` — `computeIndices`, `rasterizeGlyphs`, `toAsciiText`, `asciiFilter`
* `constants.ts` — рампа, 512, лимиты файла
* `sample.ts` — тестовая пластина без DOM
* `from-file.ts` — валидация и ужим картинки
* `wasm.ts` / `wasm-bytes.ts` — `luma_indices`

Читать вместе с `docs/api_contracts.md`.
