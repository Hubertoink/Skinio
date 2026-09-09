import { describe, it, expect } from "vitest";
import {
  faces,
  createSkin,
  normalizeSkin,
  detectSkinModel,
  convertModel,
  colorAt,
  paint,
  put,
  indexAt,
  parseProject,
  projectOf,
  PALETTE,
} from "./skin";
describe("PNG model detection before normalization", () => {
  it.each(["classic", "slim"] as const)("recognizes %s arms", (model) => {
    expect(detectSkinModel(createSkin(model).pixels)).toBe(model);
  });
  it("does not confuse opaque black sleeves with slim padding", () => {
    const s = createSkin("classic");
    for (let y = 20; y < 32; y++)
      for (let x = 54; x < 56; x++) put(s.pixels, x, y, "#000000");
    expect(detectSkinModel(s.pixels)).toBe("classic");
  });
  it("leaves incomplete, mixed and partially transparent arms undecided", () => {
    expect(detectSkinModel(new Uint8ClampedArray(16384))).toBeUndefined();
    const s = createSkin("slim");
    put(s.pixels, 54, 20, "#000000");
    expect(detectSkinModel(s.pixels)).toBeUndefined();
    s.pixels[indexAt(54, 20) + 3] = 128;
    expect(detectSkinModel(s.pixels)).toBeUndefined();
    s.pixels[indexAt(54, 20) + 3] = 0;
    s.pixels[indexAt(44, 20) + 3] = 0;
    expect(detectSkinModel(s.pixels)).toBeUndefined();
  });
  it("preserves slim artwork by selecting its layout before filling base alpha", () => {
    const raw = createSkin("slim");
    const imported = normalizeSkin({
      model: detectSkinModel(raw.pixels) ?? "classic",
      pixels: raw.pixels,
    });
    expect(imported).toEqual(raw);
    expect(imported.pixels[indexAt(54, 20) + 3]).toBe(0);
    expect(imported.pixels[indexAt(46, 52) + 3]).toBe(0);
  });
});
describe("Minecraft UV atlas", () => {
  it("uses known independent classic atlas coordinates", () => {
    const fs = faces("classic");
    for (const [id, rect] of Object.entries({
      head_base_front: [8, 8, 8, 8],
      head_outer_back: [56, 8, 8, 8],
      torso_base_front: [20, 20, 8, 12],
      torso_outer_bottom: [28, 32, 8, 4],
      rightArm_base_front: [44, 20, 4, 12],
      leftArm_base_front: [36, 52, 4, 12],
      rightLeg_base_back: [12, 20, 4, 12],
      leftLeg_base_front: [20, 52, 4, 12],
      leftArm_outer_back: [60, 52, 4, 12],
    })) {
      const f = fs.find((f) => f.id === id)!;
      expect([f.x, f.y, f.w, f.h]).toEqual(rect);
    }
  });
  it.each(["classic", "slim"] as const)(
    "%s has no overlapping or out-of-bounds faces",
    (model) => {
      const visited = new Set<string>();
      for (const f of faces(model))
        for (let y = f.y; y < f.y + f.h; y++)
          for (let x = f.x; x < f.x + f.w; x++) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(64);
            expect(y).toBeLessThan(64);
            expect(visited.has(`${x}/${y}`)).toBe(false);
            visited.add(`${x}/${y}`);
          }
      expect(faces(model)).toHaveLength(72);
      expect(visited.size).toBe(model === "classic" ? 3264 : 3136);
    },
  );
  it("maps slim arm side/back offsets independently of classic", () => {
    const fs = faces("slim");
    expect(fs.find((f) => f.id === "rightArm_base_front")).toMatchObject({
      x: 44,
      y: 20,
      w: 3,
      h: 12,
    });
    expect(fs.find((f) => f.id === "rightArm_base_left")).toMatchObject({
      x: 47,
      y: 20,
      w: 4,
    });
    expect(fs.find((f) => f.id === "leftArm_outer_back")).toMatchObject({
      x: 59,
      y: 52,
      w: 3,
    });
  });
});
describe("pixel operations", () => {
  it("flood fill stops at color boundaries and face edges", () => {
    const s = createSkin();
    const f = faces("classic").find((f) => f.id === "torso_base_front")!;
    for (let y = 0; y < f.h; y++) put(s.pixels, f.x + 3, f.y + y, "#ff0000");
    const next = paint(s, f, 1, 5, "#0000ff", true);
    expect(colorAt(next.pixels, 21, 25)).toBe("#0000ff");
    expect(colorAt(next.pixels, 23, 25)).toBe("#ff0000");
    expect(colorAt(next.pixels, 26, 25)).toBe(colorAt(s.pixels, 26, 25));
    expect(colorAt(next.pixels, 19, 25)).toBe(colorAt(s.pixels, 19, 25));
    expect(colorAt(s.pixels, 21, 25)).not.toBe("#0000ff");
  });
  it("rejects erasing base while allowing outer transparency", () => {
    const s = createSkin();
    const f = faces("classic").find((f) => f.id === "head_base_front")!;
    expect(paint(s, f, 0, 0, ".")).toBe(s);
  });
  it("normalizes unused pixels and base opacity but preserves overlay alpha", () => {
    const s = createSkin();
    s.pixels.fill(77);
    const next = normalizeSkin(s);
    expect(next.pixels[indexAt(8, 8) + 3]).toBe(255);
    expect(next.pixels[indexAt(40, 8) + 3]).toBe(77);
    expect(next.pixels[indexAt(0, 0)]).toBe(0);
  });
  it("converts arm widths while preserving non-arm pixels", () => {
    const s = createSkin();
    const slim = convertModel(s, "slim");
    expect(slim.model).toBe("slim");
    for (const f of faces("classic").filter((f) => !f.part.endsWith("Arm")))
      for (let y = f.y; y < f.y + f.h; y++)
        for (let x = f.x; x < f.x + f.w; x++)
          expect(colorAt(slim.pixels, x, y)).toBe(colorAt(s.pixels, x, y));
  });
  it("round trips projects and rejects corrupted files", () => {
    const p = projectOf(createSkin(), "Test", PALETTE);
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() => parseProject({ ...p, pixels: [1, 2] })).toThrow();
    expect(() => parseProject({ ...p, version: 9 })).toThrow();
  });
});
