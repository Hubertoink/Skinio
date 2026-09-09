import { describe, it, expect } from "vitest";
import {
  buildHarness,
  demoPatch,
  applyPatch,
  validatePatch,
  validateRequest,
  selectedFaces,
  qualityWarnings,
  type GenerationRequest,
} from "./harness";
import {
  createSkin,
  PALETTE,
  PARTS,
  indexAt,
  faces,
  type Model,
  type Layer,
} from "./skin";
function request(
  model: Model = "classic",
  layer: Layer = "base",
): GenerationRequest {
  const s = createSkin(model);
  return {
    model,
    pixels: Array.from(s.pixels),
    parts: ["torso"],
    layer,
    palette: PALETTE,
    prompt: "Rote Rüstung",
  };
}
describe("grid harness", () => {
  it.each(["classic", "slim"] as const)(
    "%s: both-layer schema permits transparency only on outer faces",
    (model) => {
      const r: GenerationRequest = {
        ...request(model),
        parts: ["head"],
        layer: "both",
        humanFace: true,
      };
      const p = demoPatch(r);
      expect(Object.keys(validatePatch(p, r).faces)).toHaveLength(12);
      const schema = buildHarness(r).schema.properties.faces.properties;
      expect(schema.head_base_front.items.pattern).not.toContain(".");
      expect(schema.head_outer_front.items.pattern).toContain(".");
      p.faces.head_base_front[0] = "........";
      expect(() => applyPatch(createSkin(model), r, p)).toThrow();
    },
  );
  it("both-layer generation preserves every non-selected part", () => {
    const r: GenerationRequest = {
      ...request(),
      parts: ["head"],
      layer: "both",
    };
    const original = createSkin();
    const next = applyPatch(original, r, demoPatch(r)).skin;
    expect(next.pixels.slice(64 * 16 * 4)).toEqual(
      original.pixels.slice(64 * 16 * 4),
    );
  });
  it("warns about a blank eye band or eyes hidden behind opaque overlay without mutating art", () => {
    const r: GenerationRequest = {
      ...request(),
      parts: ["head"],
      layer: "base",
      humanFace: true,
    };
    const skin = createSkin();
    expect(qualityWarnings(skin, r)).toEqual([]);
    for (let y = 3; y <= 4; y++)
      for (let x = 0; x < 8; x++)
        skin.pixels.set([120, 80, 50, 255], indexAt(40 + x, 8 + y));
    const before = skin.pixels.slice();
    expect(qualityWarnings(skin, r).join()).toContain("Augen");
    expect(skin.pixels).toEqual(before);
    expect(qualityWarnings(skin, { ...r, humanFace: false })).toEqual([]);
  });
  it("warns about an empty requested overlay", () => {
    expect(
      qualityWarnings(createSkin(), { ...request(), layer: "both" }).join(),
    ).toContain("vollständig leer");
    expect(qualityWarnings(createSkin(), request())).toEqual([]);
  });
  it.each(["classic", "slim"] as const)(
    "%s: every single part and layer changes only its exact mask",
    (model) => {
      for (const part of PARTS)
        for (const layer of ["base", "outer"] as const) {
          const r = { ...request(model, layer), parts: [part] };
          const s = createSkin(model);
          const { skin, changed } = applyPatch(s, r, demoPatch(r));
          const allowed = new Set<number>();
          for (const f of selectedFaces(r))
            for (let y = 0; y < f.h; y++)
              for (let x = 0; x < f.w; x++)
                for (let c = 0; c < 4; c++)
                  allowed.add(indexAt(f.x + x, f.y + y) + c);
          for (let i = 0; i < s.pixels.length; i++)
            if (!allowed.has(i)) expect(skin.pixels[i]).toBe(s.pixels[i]);
          expect(changed).toBeGreaterThan(0);
          expect(skin.pixels.length).toBe(16384);
        }
    },
  );
  it("validates a complete character with all 36 base faces", () => {
    const r = { ...request(), parts: [...PARTS] };
    const patch = demoPatch(r);
    expect(Object.keys(validatePatch(patch, r).faces)).toHaveLength(36);
    expect(buildHarness(r).schema.properties.faces.required).toHaveLength(36);
  });
  it.each([
    "extra",
    "missing",
    "width",
    "height",
    "color",
    "transparent",
    "wrongType",
    "extraRoot",
  ])("rejects %s atomically", (problem) => {
    const r = request();
    const s = createSkin();
    const before = s.pixels.slice();
    const p = demoPatch(r);
    const id = Object.keys(p.faces)[0];
    if (problem === "extra") p.faces.head_base_front = ["0"];
    if (problem === "missing") delete p.faces[id];
    if (problem === "width") p.faces[id][0] += "0";
    if (problem === "height") p.faces[id].pop();
    if (problem === "color") p.faces[id][0] = "!".repeat(4);
    if (problem === "transparent") p.faces[id][0] = ".".repeat(4);
    if (problem === "wrongType") (p.faces as any)[id] = null;
    if (problem === "extraRoot") (p as any).code = "danger";
    expect(() => applyPatch(s, r, p)).toThrow();
    expect(s.pixels).toEqual(before);
  });
  it("permits transparent pixels only on overlay", () => {
    const r = request("classic", "outer");
    const p = demoPatch(r);
    for (const f of selectedFaces(r))
      p.faces[f.id] = Array(f.h).fill(".".repeat(f.w));
    expect(() => validatePatch(p, r)).not.toThrow();
    expect(() => validatePatch(p, request())).toThrow();
  });
  it("rejects stale generation results", () => {
    const r = request();
    const s = createSkin();
    s.pixels[0] = 1;
    expect(() => applyPatch(s, r, demoPatch(r))).toThrow(/inzwischen/);
  });
  it("rejects malformed input, remote image URLs and invalid palettes", () => {
    const r = request();
    expect(() => validateRequest({ ...r, parts: [] })).toThrow();
    expect(() =>
      validateRequest({ ...r, reference: "https://example.com/image.png" }),
    ).toThrow();
    expect(() => validateRequest({ ...r, palette: ["red"] })).toThrow();
    expect(() => validateRequest({ ...r, pixels: [-1] })).toThrow();
  });
  it("exports a schema with exact face dimensions and fixed palette symbols", () => {
    const r = { ...request(), palette: ["#000000", "#ffffff"] };
    const h = buildHarness(r);
    expect(h.schema.properties.faces.properties.torso_base_front).toEqual({
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: { type: "string", pattern: "^[01]{8}$" },
    });
    expect(JSON.parse(h.input).palette).toEqual({
      "0": "#000000",
      "1": "#ffffff",
    });
    expect(h.instructions).toContain("never an image");
  });
});
