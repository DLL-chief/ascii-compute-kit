# 004. Тумблер GitHub Pages недоступен интеграции

* Статус: принято
* Дата: 2026-09-14
* Ссылается на: ADR-003

## Контекст

Сайт уже лежит в корне `main` (`index.html`, `pages/*.js`, ADR-003). REST `POST /repos/.../pages` от GitHub App агента отвечает 403: нет `pages:write` / `administration:write`. `actions/configure-pages` с `GITHUB_TOKEN` тоже не включает сайт (enablement требует другой токен).

У владельца Pages в других репозиториях (govnosert, acoustic-chronograph) включён вручную: ветка `main`, папка `/`.

## Решение

* Не держать workflow, который падает красным крестом, пока тумблер выключен.
* Публикация — «Deploy from a branch» / `main` / `/`, как в остальных демо владельца.
* Включить может только владелец: Settings → Pages. После этого URL https://dll-chief.github.io/ascii-compute-kit/ собирается сам.

## Последствия

Плюсы: совпадает с govnosert, статика без Actions.

Минусы: один разовый клик в настройках репозитория. Агент это сделать не может, пока GitHub App не получит право Pages.
