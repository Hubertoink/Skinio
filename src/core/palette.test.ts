import { describe, it, expect } from "vitest";
import { extractPalette } from "./palette";
import {
  colorToken,
  splitRow,
  rowPattern,
  tokenIndex,
  transparentToken,
} from "./palette-codec";
import { createSkin, projectOf, parseProject, PALETTE } from "./skin";
import {
  demoPatch,
  applyPatch,
  validatePatch,
  outputSchema,
  type GenerationRequest,
} from "./harness";
describe("expanded image palettes and backward-compatible pixel encoding", () => {
  it.each([1, 32, 64, 65, 127, 128, 129, 255, 256])(
    "%i colors: schema and decoder agree at every index",
    (size) => {
      const pattern = new RegExp(rowPattern(8, size, true));
      for (let i = 0; i < size; i++) {
        const token = colorToken(i, size),
          row = token.repeat(8);
        expect(pattern.test(row)).toBe(true);
        expect(splitRow(row, size)).toEqual(Array(8).fill(token));
        expect(tokenIndex(token, size)).toBe(i);
      }
      expect(pattern.test(transparentToken(size).repeat(8))).toBe(true);
      expect(
        new RegExp(rowPattern(8, size, false)).test(
          transparentToken(size).repeat(8),
        ),
      ).toBe(false);
      if (size > 64 && size < 256)
        expect(pattern.test(colorToken(size, size).repeat(8))).toBe(false);
      expect(pattern.test("xxxxxxxx")).toBe(size === 64);
    },
  );
  it("exports and applies 256 colors without losing pixel bounds or alpha rules", () => {
    const palette = Array.from(
      { length: 256 },
      (_, i) => "#" + i.toString(16).padStart(2, "0").repeat(3),
    );
    const skin = createSkin();
    const r: GenerationRequest = {
      model: "classic",
      pixels: Array.from(skin.pixels),
      parts: ["head"],
      layer: "both",
      palette,
      paletteLimit: 256,
      prompt: "Portrait",
    };
    const patch = demoPatch(r);
    patch.faces.head_base_front = Array(8).fill("00ff7f8081828384");
    expect(
      outputSchema(r).properties.faces.properties.head_base_front.items.pattern,
    ).toBeTruthy();
    const result = applyPatch(skin, r, patch).skin;
    expect(result.pixels.slice(64 * 16 * 4)).toEqual(
      skin.pixels.slice(64 * 16 * 4),
    );
    expect(
      parseProject(projectOf(result, "Test", palette)).palette,
    ).toHaveLength(256);
    patch.faces.head_base_front[0] = "................";
    expect(() => validatePatch(patch, r)).toThrow();
    patch.faces.head_base_front[0] = "00000000";
    expect(() => validatePatch(patch, r)).toThrow();
    expect(
      parseProject(projectOf(skin, "Old", PALETTE.slice(0, 32))).palette,
    ).toHaveLength(32);
  });
  it("extracts representative colors locally, ignoring transparent pixels", () => {
    expect(
      extractPalette(
        [255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0],
        256,
      ).sort(),
    ).toEqual(["#0000ff", "#ff0000"]);
    expect(() => extractPalette([0, 0, 0, 0], 64)).toThrow();
    const pixels = Array.from({ length: 4096 }, (_, i) => [
      i % 256,
      (i * 13) % 256,
      (i * 47) % 256,
      255,
    ]).flat();
    expect(extractPalette(pixels, 64).length).toBeLessThanOrEqual(64);
    expect(extractPalette(pixels, 256)).toHaveLength(256);
  });
});
