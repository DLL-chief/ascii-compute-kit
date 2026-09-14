# Контракты

HTTP API в проекте нет. Контракты — между модулями внутри страницы.

## 1. detect()

```ts
type DetectResult = {
  workers: boolean;
  wasm: boolean;
  webgpu: boolean;
  webgl2: boolean;
  isolated: boolean; // window.crossOriginIsolated, информационно
  reasons: {
    workers?: string;
    wasm?: string;
    webgpu?: string;
    webgl2?: string;
  };
};

function detect(): Promise<DetectResult>;
```

Правила:

* `webgpu === true` только после успешного `requestAdapter()`. Наличие `navigator.gpu` само по себе недостаточно.
* `reasons` заполняется только для ложных флагов, человекочитаемо по-русски.
* Функция идемпотентна с точки зрения UI: повторный вызов допустим, побочных эффектов на canvas нет.

## 2. Backend.run

Каждый compute-бэкенд реализует:

```ts
type BackendId =
  | 'js-main'
  | 'js-worker'
  | 'wasm-worker'
  | 'webgpu'
  | 'webgl2';

type RunInput = {
  rgba: Uint8ClampedArray; // длина === w * h * 4
  w: number;               // целое > 0
  h: number;               // целое > 0
  options: AsciiOptions;
};

type AsciiOptions = {
  cellW: number;     // ширина ячейки в пикселях исходника, по умолчанию 8
  cellH: number;     // высота ячейки, по умолчанию 14
  ramp: string;      // строка символов от тёмного к светлому
  invert: boolean;   // перевернуть рамп
  colored: boolean;  // false в первой итерации: монохромные глифы
};

type RunOutput = {
  rgba: Uint8ClampedArray; // тот же w*h*4
  w: number;
  h: number;
  backend: BackendId;
  ms: number;              // только чистое время ядра, без загрузки wasm/шейдера
};

interface Backend {
  id: BackendId;
  available(d: DetectResult): boolean;
  init?(): Promise<void>;   // загрузка wasm / создание GPU device
  run(input: RunInput): Promise<RunOutput>;
  dispose?(): Promise<void>;
}
```

Инварианты:

* Входной буфер не мутировать. Если нужен transfer в Worker — копировать или принимать ownership явно и не использовать буфер в UI после transfer.
* Выходной растр того же `w` и `h`, альфа 255 на непрозрачных глифах, фон — сплошной (по умолчанию почти чёрный или почти белый в зависимости от `invert`).
* Если backend недоступен, `run` не вызывается. Если упал в процессе — reject с `Error`, pipeline переключается на следующий по цепочке и пишет это в UI.
* `ms` не включает `init`.

## 3. Сообщения Worker

Запрос (structured clone / transferable):

```ts
type WorkerRequest = {
  id: number;
  kind: 'run';
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
  options: AsciiOptions;
  useWasm: boolean;
};
```

Ответ:

```ts
type WorkerResponse =
  | { id: number; ok: true; rgba: Uint8ClampedArray; w: number; h: number; ms: number; usedWasm: boolean }
  | { id: number; ok: false; error: string };
```

Воркер не трогает DOM. Wasm, если есть, загружается внутри воркера один раз на `init`.

## 4. ASCII-ядро (язык-агностик)

Псевдокод контракта алгоритма, общий для JS, Wasm и шейдера:

1. Для каждой ячейки сетки `cellW × cellH` посчитать среднюю яркость  
   `Y = 0.299R + 0.587G + 0.114B` по пикселям ячейки.
2. Нормировать `Y` в `[0, 1]`. При `invert` взять `1 - Y`.
3. Индекс символа: `floor(Y * (ramp.length - 1))`, зажать в границы рампы.
4. Нарисовать глиф моноширинным шрифтом в соответствующий прямоугольник выходного растра. Сглаживание выключено.

Стартовая рампа (тёмное → светлое):

```
 .'`^",:;Il!i><~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$
```

Дефолты: `cellW=8`, `cellH=14`, `invert=false`, `colored=false`.

Цифровая рампа `1732549608` — не в первой итерации. Когда появится, это будет другая строка `options.ramp`, не отдельный контракт.

## 5. UI → pipeline

```ts
type PipelineCommand =
  | { type: 'auto' }
  | { type: 'use'; backend: BackendId };
```

Pipeline возвращает `RunOutput` плюс итог детекта для панели.

## 6. Чего нет и не появится без ADR

* REST/GraphQL.
* Вебхуки.
* Авторизация.
* Сохранение фильтра на сервере.
* SharedArrayBuffer в сообщении воркера.
