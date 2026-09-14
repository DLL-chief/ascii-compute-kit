# ascii-compute-kit

Это ЭТАЛОННЫЙ ШАБЛОН репозитория (vibecoders/project-template), применённый к конкретному проекту.
Структуру можно копировать в новый проект. Пустые незаполненные файлы хуже, чем их отсутствие.

## 1. Что это за проект

* Бизнес-цель: браузерный каркас «картинка → ASCII-art», который показывает три вычислительных контура веба (главный поток / Web Worker / WebAssembly / GPU-шейдеры) и деградирует, если контур недоступен. Первый пользователь — DLL-chief на Android Chrome и десктопе; вторичные — форки как стартовый шаблон фильтров.
* Стадия: прототип с рабочим кодом (ядро, воркер, Wasm, WebGL2, WebGPU, UI).
* Владелец: DLL-chief (https://github.com/DLL-chief).

Публикация: исходники в этом репозитории. Живое превью собрано на TanStack Start (ADR-002). GitHub Pages из голого `index.html` — следующий шаг, не блокирует код.

Планируемый URL Pages: https://dll-chief.github.io/ascii-compute-kit/

## 2. Стек

| Слой | Технология | Версия |
| --- | --- | --- |
| Compute CPU | JS + Web Workers + WebAssembly (`luma_indices`, Rust → wasm32) | Wasm MVP |
| Compute GPU | WebGPU compute (WGSL), запасной WebGL2 fragment | adapter / webgl2 |
| UI (превью) | React 19 + TanStack Start (ADR-002) | — |
| UI (этот репозиторий) | модули `src/*` без обязательного бандлера | ES2022 |
| Backend | нет | — |
| БД | нет | — |
| Инфраструктура | GitHub, ветка `main` | — |

Чего в стеке НЕТ и почему:

* Нет сервера, API, БД, авторизации.
* Нет SharedArrayBuffer: GitHub Pages не отдаёт COOP/COEP.
* Нет GitLab. Источник истины — этот репозиторий (ADR-001).
* Фреймворк в превью — из-за платформы (ADR-002). Ядро ASCII от React не зависит.

## 3. Быстрый старт

```bash
git clone https://github.com/DLL-chief/ascii-compute-kit.git
cd ascii-compute-kit
```

Модули: `src/ascii`, `src/detect`, `src/pipeline`, `src/backends`, `src/workers`.
Wasm: исходник `wasm/ascii.rs`, байты встроены в `src/ascii/wasm-bytes.ts` (можно не таскать `.wasm` отдельно).

Переменные окружения не нужны.

## 4. Карта структуры репозитория

```
.
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── STATUS.md
├── docs/
│   ├── README.md
│   ├── architecture.md
│   ├── api_contracts.md
│   └── adr/
│       ├── 001-github-pages-single-source-of-truth.md
│       └── 002-tanstack-start-preview.md
├── wasm/ascii.rs
└── src/
    ├── ascii/          — ядро, рампа, wasm, файл
    ├── backends/       — js-main, worker, wasm, webgpu, webgl2
    ├── detect/         — feature detect
    ├── pipeline/       — авто-деградация
    ├── workers/        — compute.worker.ts
    └── ui/             — AsciiStudio (React, как в превью)
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
