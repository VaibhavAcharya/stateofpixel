import pixelmatch from "pixelmatch";

export type PickedImage = {
  name: string;
  url: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
};

export type ImageDiff = {
  diffPixels: number;
  diffRatio: number;
  diffImage: { url: string; width: number; height: number } | null;
};

export async function pickImage(file: File): Promise<PickedImage> {
  const bitmap = await createImageBitmap(file);
  return {
    name: file.name,
    url: URL.createObjectURL(file),
    width: bitmap.width,
    height: bitmap.height,
    bitmap,
  };
}

export async function diffImages(
  base: PickedImage,
  next: PickedImage,
): Promise<ImageDiff> {
  const width = Math.max(base.width, next.width);
  const height = Math.max(base.height, next.height);
  const diff = new ImageData(width, height);
  const diffPixels = pixelmatch(
    pixels(base.bitmap, width, height),
    pixels(next.bitmap, width, height),
    diff.data,
    width,
    height,
    { threshold: 0.1, diffMask: true },
  );
  if (diffPixels === 0) {
    return { diffPixels, diffRatio: 0, diffImage: null };
  }
  const canvas = new OffscreenCanvas(width, height);
  context(canvas).putImageData(diff, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return {
    diffPixels,
    diffRatio: diffPixels / (width * height),
    diffImage: { url: URL.createObjectURL(blob), width, height },
  };
}

function pixels(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = context(canvas);
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, width, height).data;
}

function context(canvas: OffscreenCanvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) {
    throw new Error("This browser cannot read image pixels");
  }
  return ctx;
}
