# STATUS

Обновлено: 2026-09-14.

## Сейчас

Код и GitHub Pages. Демо: https://dll-chief.github.io/ascii-compute-kit/

Прототип считает ASCII на JS (сразу в `<pre>`), Worker, Wasm, WebGL2, WebGPU. Вход: 512×512, файл до 12 МБ. Страница — `index.html` + `pages/*.js`. Публикация — Actions (ADR-004), потому что REST-тумблер Pages недоступен интеграции.

## Сделано

* Документация, ADR-001 … ADR-004.
* `src/ascii` — яркость → индекс → глиф / текст.
* `src/backends` + `src/workers` + встроенный Wasm.
* Детект с таймаутом WebGPU 1.5 с, явные «есть / нет».
* Ошибки файла: тип, размер, декод.
* Статический сайт: `index.html`, бандлы, workflow Pages.

## Блокеры

Нет. Если первый деплой завис на environment `github-pages` — нужен разовый approve владельца.

## Следующее

* Цветной ASCII (`colored: true`).
* Сверка пикселей js-main vs wasm на фикстуре.
