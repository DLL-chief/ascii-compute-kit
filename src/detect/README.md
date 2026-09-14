# detect

`detect(onPartial?)` возвращает Workers, Wasm, WebGPU, WebGL2, isolated.

WebGPU: `requestAdapter` с таймаутом 1.5 с, иначе UI не зависает. Пока ждём — статус «проверяю», не «нет».
