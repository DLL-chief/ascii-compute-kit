# Контракты

Типы: `src/ascii/types.ts`.

`detect(): Promise<DetectResult>` — Workers, Wasm, WebGPU (`requestAdapter`, таймаут 1.5 с), WebGL2, isolated.

`Backend.run({ rgba, w, h, options }) → { rgba, w, h, backend, ms }`
Не мутирует вход. `ms` без init.

Worker: `{ id, kind: init|run, useWasm }` / ответ ok + rgba transferable.

Ядро: Y = 0.299R+0.587G+0.114B, индекс `floor(Y/255 * (ramp.length-1))`.
`toAsciiText` — тот же индекс, строка для `<pre>`.

## Входное изображение

| Ограничение | Значение | Ошибка |
| --- | --- | --- |
| Тип | PNG/JPEG/WebP | «Это не картинка» |
| Размер файла | ≤ 12 МБ | «Файл N МБ, лимит 12 МБ» |
| Сторона после декода | ≤ 8192 | «Слишком большой кадр» |
| Рабочий кадр | всегда 512×512, вписан с полями | статус с исходным размером |

HEIC и битый файл — явное сообщение, кадр не меняется.
