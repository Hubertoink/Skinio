import { rgba } from "../src/core/skin";
import {
  selectedFaces,
  validatePatch,
  type GenerationRequest,
  type GridPatch,
} from "../src/core/harness";
import { colorToken, transparentToken } from "../src/core/palette-codec";

export interface Outfit {
  top: "none" | "tshirt" | "shirt" | "hoodie" | "jacket";
  sleeves: "short" | "long";
  topColor: string;
  bottom: "none" | "trousers" | "shorts";
  bottomColor: string;
  shoes: "none" | "sneakers" | "boots";
  shoeColor: string;
  skinColor: string;
}
const enums = {
  top: ["none", "tshirt", "shirt", "hoodie", "jacket"],
  sleeves: ["short", "long"],
  bottom: ["none", "trousers", "shorts"],
  shoes: ["none", "sneakers", "boots"],
};
const colors = ["topColor", "bottomColor", "shoeColor", "skinColor"];
export const outfitSchema = {
  type: "object",
  additionalProperties: false,
  required: [...Object.keys(enums), ...colors],
  properties: Object.fromEntries([
    ...Object.entries(enums).map(([k, values]) => [
      k,
      { type: "string", enum: values },
    ]),
    ...colors.map((k) => [k, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }]),
  ]),
};
export function validateOutfit(raw: unknown): Outfit {
  const p = raw as Record<string, string>;
  if (
    !p ||
    Object.keys(p).sort().join() !== outfitSchema.required.sort().join() ||
    Object.entries(enums).some(([k, v]) => !v.includes(p[k])) ||
    colors.some((k) => !/^#[0-9a-f]{6}$/i.test(p[k]))
  )
    throw new Error("Ungültiger Kleidungsplan. Keine Pixel übernommen.");
  return p as unknown as Outfit;
}
function ramp(hex: string) {
  const rgb = rgba(hex).slice(0, 3);
  return [-24, -10, 0, 10].map(
    (delta) =>
      "#" +
      rgb
        .map((v) =>
          Math.max(0, Math.min(255, v + delta))
            .toString(16)
            .padStart(2, "0"),
        )
        .join(""),
  );
}
export function outfitPalette(palette: string[], p: Outfit, limit: number) {
  const required = [
    ...new Set([
      ...(p.top === "none" ? [] : ramp(p.topColor)),
      ...(p.bottom === "none" ? [] : ramp(p.bottomColor)),
      ...(p.shoes === "none" ? [] : ramp(p.shoeColor)),
      ...ramp(p.skinColor),
    ]),
  ];
  // Put required fabric shades first so later portrait colors cannot evict them.
  return [
    ...required,
    ...palette.filter((c) => !required.includes(c.toLowerCase())),
  ].slice(0, limit);
}
/** Reconcile clothing materials and anatomical zones, preserving every head pixel. */
export function reconcileOutfit(
  patch: GridPatch,
  r: GenerationRequest,
  p: Outfit,
): GridPatch {
  if (r.layer === "outer") return patch;
  const token = (hex: string) => {
    const rgb = rgba(hex);
    const d = r.palette.map((c) =>
      rgba(c)
        .slice(0, 3)
        .reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0),
    );
    return colorToken(d.indexOf(Math.min(...d)), r.palette.length);
  };
  const top = ramp(p.topColor).map(token),
    bottom = ramp(p.bottomColor).map(token),
    shoe = ramp(p.shoeColor).map(token),
    skin = ramp(p.skinColor).map(token);
  const faces = { ...patch.faces };
  for (const f of selectedFaces(r)) {
    if (f.part === "head") continue;
    const arm = f.part === "rightArm" || f.part === "leftArm";
    const leg = f.part === "rightLeg" || f.part === "leftLeg";
    if ((f.part === "torso" || arm) && p.top === "none") continue;
    if (leg && p.bottom === "none" && p.shoes === "none") continue;
    const old = faces[f.id];
    faces[f.id] = Array.from({ length: f.h }, (_, y) =>
      Array.from({ length: f.w }, (_, x) => {
        const vertical = f.side !== "top" && f.side !== "bottom";
        const row = vertical ? y : f.side === "top" ? 0 : 11;
        const edge = x === 0 || x === f.w - 1;
        const shade =
          r.clothingDetail === "simple"
            ? 2
            : f.side === "top"
              ? 3
              : f.side === "bottom"
                ? 0
                : edge
                  ? 1
                  : (x + y) % 7 === 0
                    ? 3
                    : 2;
        let material: string[] | undefined;
        if (f.part === "torso") material = top;
        if (arm) material = row < (p.sleeves === "short" ? 4 : 10) ? top : skin;
        if (leg) {
          if (p.shoes !== "none" && row >= (p.shoes === "boots" ? 8 : 9))
            material = shoe;
          else if (p.bottom !== "none")
            material = p.bottom === "shorts" && row >= 6 ? skin : bottom;
        }
        if (!material)
          return r.palette.length > 64
            ? old[y].slice(x * 2, x * 2 + 2)
            : old[y][x];
        // The clothing overlay must not hide the corrected sleeves or footwear.
        if (f.layer === "outer") {
          if (vertical && arm && row === (p.sleeves === "short" ? 3 : 9))
            return top[1];
          if (vertical && leg && material === shoe && row === 11)
            return shoe[1];
          return transparentToken(r.palette.length);
        }
        if (f.part === "torso" && f.side === "front") {
          const center =
            x >= Math.floor(f.w / 2) - 1 && x <= Math.floor(f.w / 2);
          if (y === 0 && center) return skin[2];
          if ((p.top === "shirt" || p.top === "jacket") && center)
            return top[y % 3 === 1 ? 0 : 1];
          if (y === 11 || (y === 1 && center)) return top[1];
        }
        if (arm && row === (p.sleeves === "short" ? 3 : 9)) return top[1];
        if (leg && material === shoe) {
          if (row === 11) return shoe[1];
          if (f.side === "front" && row === 9 && !edge) return shoe[3];
        }
        if (leg && material === bottom && (row === 0 || (edge && row < 4)))
          return bottom[0];
        return material[shade];
      }).join(""),
    );
  }
  return validatePatch({ name: patch.name, faces }, r);
}
