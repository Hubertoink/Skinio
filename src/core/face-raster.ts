import { rgba } from "./skin";
import { colorToken } from "./palette-codec";

/** Quantize an already resampled opaque 8x8 BGRA bitmap (Electron nativeImage). */
export function faceRows(bitmap: Uint8Array, palette: string[]): string[] {
  if (bitmap.length !== 8 * 8 * 4 || !palette.length || palette.length > 256)
    throw new Error("Gesichtsentwurf hat kein gültiges 8×8-Raster.");
  const colors = palette.map(rgba);
  return Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      const i = (y * 8 + x) * 4;
      if (bitmap[i + 3] !== 255)
        throw new Error("Gesichtsentwurf muss vollständig deckend sein.");
      const rgb = [bitmap[i + 2], bitmap[i + 1], bitmap[i]];
      let best = 0,
        distance = Infinity;
      colors.forEach((c, k) => {
        const d = c
          .slice(0, 3)
          .reduce((sum, v, j) => sum + (v - rgb[j]) ** 2, 0);
        if (d < distance) {
          distance = d;
          best = k;
        }
      });
      return colorToken(best, palette.length);
    }).join(""),
  );
}
