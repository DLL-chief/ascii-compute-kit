import { MAX_DECODE_EDGE, MAX_FILE_BYTES, SAMPLE_SIZE } from "./constants";

export class ImageLoadError extends Error {
  constructor(
    message: string,
    readonly code: "type" | "size" | "decode" | "pixels" | "canvas",
  ) {
    super(message);
    this.name = "ImageLoadError";
  }
}

export type LoadedFrame = {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
  originalW: number;
  originalH: number;
  fileBytes: number;
  scaled: boolean;
};

function assertFile(file: File) {
  if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)) {
    throw new ImageLoadError(
      `Это не картинка (${file.type || file.name || "нет типа"}). Нужен PNG, JPEG или WebP.`,
      "type",
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const cap = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new ImageLoadError(`Файл ${mb} МБ, лимит ${cap} МБ. Сожмите или обрежьте снимок.`, "size");
  }
  if (file.size < 24) {
    throw new ImageLoadError("Файл пустой.", "size");
  }
}

function fitToWork(imgW: number, imgH: number, canvas: HTMLCanvasElement, draw: CanvasDraw) {
  if (imgW > MAX_DECODE_EDGE || imgH > MAX_DECODE_EDGE) {
    throw new ImageLoadError(
      `Слишком большой кадр ${imgW}×${imgH} (лимит ${MAX_DECODE_EDGE} по стороне).`,
      "pixels",
    );
  }
  const size = SAMPLE_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new ImageLoadError("Нет 2D-контекста canvas.", "canvas");
  ctx.fillStyle = "#ece7dc";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / imgW, size / imgH);
  const dw = Math.max(1, Math.round(imgW * scale));
  const dh = Math.max(1, Math.round(imgH * scale));
  draw(ctx, (size - dw) / 2, (size - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, size, size);
  return {
    rgba: new Uint8ClampedArray(data.data),
    w: size,
    h: size,
    scaled: imgW !== size || imgH !== size,
  };
}

type CanvasDraw = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => void;

export async function frameFromImageFile(file: File): Promise<LoadedFrame> {
  assertFile(file);
  const url = URL.createObjectURL(file);
  try {
    let imgW = 0;
    let imgH = 0;
    const canvas = document.createElement("canvas");
    let fitted: { rgba: Uint8ClampedArray; w: number; h: number; scaled: boolean };

    if (typeof createImageBitmap === "function") {
      let bmp: ImageBitmap | null = null;
      try {
        bmp = await createImageBitmap(file);
      } catch {
        throw new ImageLoadError(
          "Браузер не смог декодировать файл. HEIC/AVIF часто не поддерживаются — сохраните PNG или JPEG.",
          "decode",
        );
      }
      imgW = bmp.width;
      imgH = bmp.height;
      try {
        fitted = fitToWork(imgW, imgH, canvas, (ctx, x, y, w, h) => {
          ctx.drawImage(bmp!, x, y, w, h);
        });
      } finally {
        bmp.close();
      }
    } else {
      fitted = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            imgW = img.naturalWidth;
            imgH = img.naturalHeight;
            resolve(
              fitToWork(imgW, imgH, canvas, (ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h)),
            );
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () =>
          reject(
            new ImageLoadError(
              "Браузер не смог открыть картинку. Попробуйте другой файл.",
              "decode",
            ),
          );
        img.src = url;
      });
    }

    return {
      ...fitted,
      originalW: imgW,
      originalH: imgH,
      fileBytes: file.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
