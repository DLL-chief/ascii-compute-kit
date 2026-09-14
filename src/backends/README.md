# backends

Один интерфейс `Backend.run`. Недоступный бэкенд отключается в `available(detect)`.

Порядок авто: webgpu → webgl2 → wasm-worker → js-worker → js-main.

GPU считает только сетку яркости; глифы рисует то же 2D, что и JS, чтобы шрифт совпадал.
