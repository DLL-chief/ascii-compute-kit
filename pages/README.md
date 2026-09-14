# pages/

Статический вход GitHub Pages (ADR-003). Браузер не исполняет `.ts`, поэтому сюда кладутся собранные ESM:

* `app.ts` — исходник UI (ванильный DOM, без React).
* `app.js` / `compute.worker.js` — бандлы для `index.html`.

Пересборка: `bash scripts/build-pages.sh`.
Не импортировать React-студию `src/ui` сюда — Pages должен открываться без Vite.
