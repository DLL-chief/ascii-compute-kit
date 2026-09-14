export const DEFAULT_RAMP =
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export const DIGIT_RAMP = "1732549608";

export const DEFAULT_CELL_W = 8;
export const DEFAULT_CELL_H = 14;

/** Рабочий кадр фильтра. Больше — не считаем, меньше — вписываем с полями. */
export const SAMPLE_SIZE = 512;

/** Сырой файл больше этого не берём — браузер и превью не тянут. */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Сторона декодированного изображения. Дальше всё равно ужимаем до SAMPLE_SIZE. */
export const MAX_DECODE_EDGE = 8192;
