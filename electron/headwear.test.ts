import { describe, it, expect } from "vitest";
import { closeHeadwear } from "./headwear";
import { COLOR_FIELDS, DETAIL_FIELDS, type PortraitDesign } from "./portrait";
import { createSkin, PALETTE } from "../src/core/skin";
import { demoPatch, type GenerationRequest } from "../src/core/harness";
import { transparentToken } from "../src/core/palette-codec";
const p = {
  ...Object.fromEntries(COLOR_FIELDS.map((k) => [k, "#787878"])),
  ...Object.fromEntries(DETAIL_FIELDS.map((k) => [k, "none"])),
  headwear: "Basecap",
} as PortraitDesign;
describe("continuous cap coverage", () => {
  it.each([64, 256])(
    "%i colors: closes top and band, preserves eyes and non-head faces",
    (size) => {
      const palette =
        size === 64
          ? PALETTE
          : Array.from(
              { length: 256 },
              (_, i) => "#" + i.toString(16).padStart(2, "0").repeat(3),
            );
      const r: GenerationRequest = {
        model: "classic",
        pixels: Array.from(createSkin().pixels),
        parts: ["head", "torso"],
        layer: "both",
        palette,
        prompt: "Basecap",
      };
      const patch = demoPatch(r);
      patch.faces.head_outer_top = Array(8).fill(
        transparentToken(size).repeat(8),
      );
      const final = closeHeadwear(patch, r, p);
      expect(final.faces.head_outer_top.join("")).not.toContain(".");
      expect(final.faces.head_outer_front.slice(2)).toEqual(
        patch.faces.head_outer_front.slice(2),
      );
      expect(final.faces.head_base_front.slice(2)).toEqual(
        patch.faces.head_base_front.slice(2),
      );
      expect(final.faces.torso_base_front).toEqual(
        patch.faces.torso_base_front,
      );
      expect(final.faces.head_base_bottom).toEqual(
        patch.faces.head_base_bottom,
      );
      if (size === 256)
        expect(final.faces.head_outer_top).toEqual(
          Array(8).fill("78".repeat(8)),
        );
      expect(closeHeadwear(patch, { ...r, closeHeadwear: false }, p)).toBe(
        patch,
      );
      expect(closeHeadwear(patch, r, { ...p, headwear: "none" })).toBe(patch);
      expect(
        closeHeadwear(patch, { ...r, prompt: "Bitte ohne Basecap" }, p),
      ).toBe(patch);
    },
  );
  it("never creates outer faces when only base is selected", () => {
    const r: GenerationRequest = {
      model: "classic",
      pixels: Array.from(createSkin().pixels),
      parts: ["head"],
      layer: "base",
      palette: PALETTE,
      prompt: "Cap",
    };
    const patch = closeHeadwear(demoPatch(r), r, p);
    expect(Object.keys(patch.faces)).toHaveLength(6);
    expect(patch.faces.head_outer_top).toBeUndefined();
  });
});
