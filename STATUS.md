# STATUS

Обновлено: 2026-09-14.

## Сейчас

Код и GitHub Pages. Демо: https://dll-chief.github.io/ascii-compute-kit/

Прототип считает ASCII на JS (сразу в `<pre>`), Worker, Wasm, WebGL2, WebGPU. Вход: 512×512, файл до 12 МБ. Pages — `index.html` + `pages/*.js`, без Vite.

## Сделано

* Документация, ADR-001, ADR-002, ADR-003.
* `src/ascii` — яркость → индекс → глиф / текст.
* `src/backends` + `src/workers` + встроенный Wasm.
* Детект с таймаутом WebGPU 1.5 с, явные «есть / нет».
* Ошибки файла: тип, размер, декод.
* Статический сайт на GitHub Pages (`main` /).

## Блокеры

Нет.

## Следующее

* Цветной ASCII (`colored: true`).
* Сверка пикселей js-main vs wasm на фикстуре.
