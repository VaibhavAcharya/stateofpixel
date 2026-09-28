import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

type Pixel = [number, number, number, number];

const WHITE: Pixel = [255, 255, 255, 255];
const BLACK: Pixel = [0, 0, 0, 255];

export function encodePng(
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => Pixel = () => WHITE,
  deflateLevel = 9,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      png.data.set(pixelAt(x, y), (y * width + x) * 4);
    }
  }
  return PNG.sync.write(png, { deflateLevel });
}

export function blackSquare(size: number): (x: number, y: number) => Pixel {
  return (x, y) => (x < size && y < size ? BLACK : WHITE);
}

export async function writeFixture(
  dir: string,
  name: string,
  bytes: Buffer,
): Promise<void> {
  const filePath = path.join(dir, `${name}.png`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export function pixelAt(png: PNG, x: number, y: number): number[] {
  const offset = (y * png.width + x) * 4;
  return Array.from(png.data.subarray(offset, offset + 4));
}
