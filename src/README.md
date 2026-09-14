# src/

Конвенция: каждый модуль — папка + `README.md`. Код — рядом, не в другом дереве.

| Модуль | Зачем |
| --- | --- |
| `ascii/` | ядро фильтра, wasm, загрузка файла |
| `detect/` | feature detect |
| `pipeline/` | авто-выбор бэкенда |
| `backends/` | js-main, worker, wasm, gpu |
| `workers/` | compute worker |
| `ui/` | React-студия из превью |
