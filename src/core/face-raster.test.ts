import { describe, it, expect } from "vitest";
import { faceRows } from "./face-raster";
import { PALETTE, SYMBOLS, createSkin } from "./skin";
import {
  buildHarness,
  validatePatch,
  validateRequest,
  demoPatch,
  applyPatch,
  type GenerationRequest,
} from "./harness";

describe("expanded palette and face raster", () => {
  const request: GenerationRequest = {
    model: "classic",
    pixels: Array.from(createSkin().pixels),
    parts: ["head"],
    layer: "both",
    palette: PALETTE,
    prompt: "Portrait",
  };
  it("preserves BGRA channel order and quantizes to the requested palette", () => {
    const pixels = new Uint8Array(256);
    for (let i = 0; i < 256; i += 4) pixels.set([5, 10, 250, 255], i);
    expect(faceRows(pixels, ["#0000ff", "#ff0000"])).toEqual(
      Array(8).fill("11111111"),
    );
    pixels[3] = 0;
    expect(() => faceRows(pixels, PALETTE)).toThrow(/deckend/);
    expect(() => faceRows(new Uint8Array(16), PALETTE)).toThrow(/Raster/);
  });
  it("accepts every one of the 64 symbols in schema and application, including hyphen", () => {
    expect(PALETTE).toHaveLength(64);
    expect(new Set(SYMBOLS).size).toBe(64);
    const p = demoPatch(request);
    p.faces.head_base_front = Array.from({ length: 8 }, (_, i) =>
      SYMBOLS.slice(i * 8, i * 8 + 8),
    );
    const pattern = new RegExp(
      buildHarness(request).schema.properties.faces.properties.head_base_front
        .items.pattern,
    );
    p.faces.head_base_front.forEach((row) =>
      expect(pattern.test(row)).toBe(true),
    );
    expect(pattern.test("........")).toBe(false);
    expect(pattern.test("!!!!!!!!")).toBe(false);
    expect(validatePatch(p, request)).toBe(p);
    expect(applyPatch(createSkin(), request, p).changed).toBeGreaterThan(0);
  });
  it("supports old 32-color requests and rejects image mode without its required editable face", () => {
    const old = { ...request, palette: PALETTE.slice(0, 32) };
    expect(validatePatch(demoPatch(old), old)).toBeTruthy();
    expect(() => validateRequest({ ...request, faceMethod: "image" })).toThrow(
      /Referenzbild/,
    );
    const valid = {
      ...request,
      faceMethod: "image",
      humanFace: true,
      reference: "data:image/jpeg;base64,AAAA",
    };
    expect(validateRequest(valid)).toBe(valid);
    expect(() => validateRequest({ ...valid, layer: "outer" })).toThrow();
    expect(() => validateRequest({ ...valid, parts: ["torso"] })).toThrow();
  });
});
