# STATUS

Обновлено: 2026-09-14.

## Сейчас

Код и статический сайт в `main`. Демо после включения Pages: https://dll-chief.github.io/ascii-compute-kit/

Прототип считает ASCII на JS (сразу в `<pre>`), Worker, Wasm, WebGL2, WebGPU. Вход: 512×512, файл до 12 МБ.

## Сделано

* Документация, ADR-001 … ADR-004.
* `src/ascii` — яркость → индекс → глиф / текст.
* `src/backends` + `src/workers` + встроенный Wasm.
* Детект с таймаутом WebGPU 1.5 с, явные «есть / нет».
* Ошибки файла: тип, размер, декод.
* `index.html` + `pages/*.js` в корне — готово к Pages.

## Блокеры

Включение GitHub Pages: агенту API отвечает 403. Нужен разовый клик владельца:
[Settings → Pages](https://github.com/DLL-chief/ascii-compute-kit/settings/pages) → Deploy from a branch → `main` → `/` → Save.

## Следующее

* Цветной ASCII (`colored: true`).
* Сверка пикселей js-main vs wasm на фикстуре.
