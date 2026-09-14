# ascii-compute-kit

Это ЭТАЛОННЫЙ ШАБЛОН репозитория (vibecoders/project-template), применённый к конкретному проекту.
Структуру можно копировать в новый проект. Пустые незаполненные файлы хуже, чем их отсутствие.

## 1. Что это за проект

* Бизнес-цель: браузерный каркас «картинка → ASCII-art», который показывает три вычислительных контура веба (главный поток / Web Worker / WebAssembly / GPU-шейдеры) и деградирует, если контур недоступен. Первый пользователь — DLL-chief на Android Chrome и десктопе; вторичные — форки как стартовый шаблон фильтров.
* Стадия: прототип с рабочим кодом и живым GitHub Pages.
* Владелец: DLL-chief (https://github.com/DLL-chief).

Демо: https://dll-chief.github.io/ascii-compute-kit/

Исходники в этом репозитории. React-студия (`src/ui`) — снимок превью на TanStack Start (ADR-002). Сайт Pages — ванильный `index.html` (ADR-003).

## 2. Стек

| Слой | Технология | Версия |
| --- | --- | --- |
| Compute CPU | JS + Web Workers + WebAssembly (`luma_indices`, Rust → wasm32) | Wasm MVP |
| Compute GPU | WebGPU compute (WGSL), запасной WebGL2 fragment | adapter / webgl2 |
| UI (Pages) | `index.html` + `pages/app.js` (ESM, без React) | ES2022 |
| UI (снимок превью) | React в `src/ui` | — |
| Backend | нет | — |
| БД | нет | — |
| Инфраструктура | GitHub Pages, ветка `main`, папка `/` | — |

Чего в стеке НЕТ и почему:

* Нет сервера, API, БД, авторизации.
* Нет SharedArrayBuffer: GitHub Pages не отдаёт COOP/COEP.
* Нет GitLab. Источник истины — этот репозиторий (ADR-001).
* Нет Vite на Pages. Бандлы `pages/*.js` коммитятся (ADR-003).

## 3. Быстрый старт

Открыть https://dll-chief.github.io/ascii-compute-kit/ или:

```bash
git clone https://github.com/DLL-chief/ascii-compute-kit.git
cd ascii-compute-kit
# любой static server из корня, например:
python3 -m http.server 8080
```

Модули: `src/ascii`, `src/detect`, `src/pipeline`, `src/backends`, `src/workers`.
Wasm: исходник `wasm/ascii.rs`, байты встроены в `src/ascii/wasm-bytes.ts`.

Пересборка Pages после правки ядра: `bash scripts/build-pages.sh`.

Переменные окружения не нужны.

## 4. Карта структуры репозитория

```
.
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── STATUS.md
├── index.html          — вход GitHub Pages
├── pages/              — ванильный UI + бандлы
├── docs/
│   ├── README.md
│   ├── architecture.md
│   ├── api_contracts.md
│   └── adr/
│       ├── 001-github-pages-single-source-of-truth.md
│       ├── 002-tanstack-start-preview.md
│       └── 003-github-pages-static.md
├── wasm/ascii.rs
├── public/wasm/ascii.wasm
└── src/
    ├── ascii/          — ядро, рампа, wasm, файл
    ├── backends/       — js-main, worker, wasm, webgpu, webgl2
    ├── detect/         — feature detect
    ├── pipeline/       — авто-деградация
    ├── workers/        — compute.worker.ts
    └── ui/             — AsciiStudio (React, снимок превью)
```

## 5. Кому и как читать

* Человек: этот файл → `docs/architecture.md`.
* ИИ-агент: `AGENTS.md` → `STATUS.md` → контракты.
* Модульные README — точечно.

## 6. Как вносить изменения

1. Ветка от `main` (`feature/...`, `fix/...`).
2. PR по-русски: что и зачем.
3. Обновить `STATUS.md`, если меняется активное состояние.
4. Не ломать `Backend.run` без нового ADR.
5. Если трогали ядро/воркер/детект — `bash scripts/build-pages.sh` и закоммитить `pages/*.js`.
