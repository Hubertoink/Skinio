import { describe, it, expect } from "vitest";
import {
  outfitPalette,
  reconcileOutfit,
  validateOutfit,
  type Outfit,
} from "./outfit";
import {
  applyPatch,
  demoPatch,
  type GenerationRequest,
} from "../src/core/harness";
import {
  createSkin,
  PALETTE,
  PARTS,
  faces as allFaces,
  indexAt,
} from "../src/core/skin";
const plan: Outfit = {
  top: "tshirt",
  sleeves: "short",
  topColor: "#f4f3ef",
  bottom: "trousers",
  bottomColor: "#202124",
  shoes: "sneakers",
  shoeColor: "#f4f3ef",
  skinColor: "#c68e6c",
};
describe("outfit reconciliation", () => {
  it.each(["classic", "slim"] as const)(
    "%s: matching white sleeves, exposed forearms, white shoes, unchanged face",
    (model) => {
      const original = createSkin(model);
      const r: GenerationRequest = {
        model,
        pixels: Array.from(original.pixels),
        parts: [...PARTS],
        layer: "both",
        palette: outfitPalette(PALETTE, plan, 256),
        prompt: "weißes T-Shirt, schwarze Hose, weiße Sneaker",
        clothingDetail: "detailed",
      };
      const patch = demoPatch(r);
      const result = reconcileOutfit(patch, r, plan);
      expect(result.faces.head_base_front).toEqual(patch.faces.head_base_front);
      expect(result.faces.head_outer_front).toEqual(
        patch.faces.head_outer_front,
      );
      const skin = applyPatch(original, r, result).skin;
      for (const f of allFaces(model).filter(
        (f) => f.layer === "base" && f.side === "front",
      )) {
        const rgb = (y: number) =>
          Array.from(
            skin.pixels.slice(
              indexAt(f.x + 1, f.y + y),
              indexAt(f.x + 1, f.y + y) + 3,
            ),
          );
        if (f.part.endsWith("Arm")) {
          expect(Math.min(...rgb(1))).toBeGreaterThan(210);
          expect(rgb(7)[0] - rgb(7)[2]).toBeGreaterThan(40);
        }
        if (f.part.endsWith("Leg")) {
          expect(Math.max(...rgb(5))).toBeLessThan(60);
          expect(Math.min(...rgb(10))).toBeGreaterThan(210);
        }
      }
    },
  );
  it("does not change unselected regions or outer-only requests", () => {
    const r: GenerationRequest = {
      model: "classic",
      pixels: Array.from(createSkin().pixels),
      parts: ["leftLeg"],
      layer: "base",
      palette: outfitPalette(PALETTE, plan, 64),
      prompt: "Sneaker",
    };
    const patch = demoPatch(r);
    expect(Object.keys(reconcileOutfit(patch, r, plan).faces)).toEqual(
      Object.keys(patch.faces),
    );
    expect(reconcileOutfit(patch, { ...r, layer: "outer" }, plan)).toBe(patch);
    expect(() => validateOutfit({ ...plan, top: "spacesuit" })).toThrow();
  });
});
