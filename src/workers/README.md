# workers

`compute.worker.ts` — JS-фильтр или Wasm `luma_indices`, затем растеризация глифов.

Сообщения: `{ id, kind: init|run, useWasm }`. Ответ с transferable rgba.
