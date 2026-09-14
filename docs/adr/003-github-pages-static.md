# 003. GitHub Pages: статический index.html с ветки main

* Статус: принято
* Дата: 2026-09-14

## Контекст

ADR-001 зафиксировал публикацию на GitHub Pages. Браузер не исполняет TypeScript из `src/`. Vite в этом репозитории нет специально (ADR-001 отклонил «сразу Vite»). Нужен работающий URL на github.io.

## Решение

* Источник Pages: ветка `main`, папка `/` (как у govnosert и acoustic-chronograph).
* Вход: корневой `index.html`, относительные пути `./pages/...`.
* UI Pages — ванильный DOM в `pages/app.ts`, не React.
* Воркеры и ядро собираются esbuild в `pages/*.js` и коммитятся. На самом Pages сборки нет.
* Wasm — встроенные байты; отдельный `.wasm` не обязателен для демо.
* `setComputeWorkerUrl` указывает на `./compute.worker.js` рядом с бандлом.

## Последствия

Плюсы: один `git push` обновляет сайт; Android Chrome открывает URL без COOP/COEP.

Минусы: два UI (React-снимок в `src/ui` и ваниль в `pages/`). Меняя ядро — пересобрать `sh scripts/build-pages.sh`.

Отклонено: GitHub Actions + Vite; публикация из `/docs`; отдельный домен.
