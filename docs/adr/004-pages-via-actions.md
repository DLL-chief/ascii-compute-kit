# 004. Публикация Pages через GitHub Actions

* Статус: принято
* Дата: 2026-09-14
* Ссылается на: ADR-003

## Контекст

ADR-003 зафиксировал статическую страницу и хостинг с `main` `/`. REST `POST /repos/.../pages` от GitHub App (интеграция агента) отвечает 403: нет права Pages, хотя Contents есть. Пользовательские репозитории govnosert / acoustic-chronograph включали Pages руками в UI.

Нужно включить сайт без ручного Settings.

## Решение

* Источник Pages — GitHub Actions (build_type workflow), не «Deploy from a branch».
* Workflow `.github/workflows/pages.yml`: `configure-pages` + артефакт из `index.html` / `pages/*.js` / wasm.
* Токен раннера `GITHUB_TOKEN` с `pages: write` сам создаёт сайт.
* Сама страница по-прежнему статическая, без Vite на хостинге (это из ADR-003 остаётся).

## Последствия

Плюсы: агент может опубликовать сайт push’ем в `main`.

Минусы: первый прогон создаёт environment `github-pages`. Если GitHub попросит approve environment — это разовый клик владельца.

Отклонено: ждать ручного тумблера в Settings; отдельный домен.
