import { rgba } from "../src/core/skin";
import {
  selectedFaces,
  validatePatch,
  type GenerationRequest,
  type GridPatch,
} from "../src/core/harness";
import {
  colorToken,
  tokenIndex,
  splitRow,
  transparentToken,
} from "../src/core/palette-codec";
import type { PortraitDesign } from "./portrait";

/** Caps occupy a continuous crown and upper band, never the eye band. */
export function closeHeadwear(
  patch: GridPatch,
  r: GenerationRequest,
  portrait?: PortraitDesign,
): GridPatch {
  if (
    r.closeHeadwear === false ||
    !portrait ||
    !r.parts.includes("head") ||
    !/\b(basecap|cap|mütze|kappe|beanie)\b/i.test(portrait.headwear) ||
    /^(none|unclear|keine?|ohne|nicht)/i.test(portrait.headwear) ||
    /(?:ohne|without|entferne|remove|no)\s+(?:eine?n?\s+|the\s+|a\s+)?(?:basecap|cap|mütze|kappe|beanie)/i.test(
      r.prompt,
    )
  )
    return patch;
  const cap = rgba(portrait.headwearColor);
  let nearest = 0,
    distance = Infinity;
  r.palette.forEach((hex, i) => {
    const d = rgba(hex)
      .slice(0, 3)
      .reduce((n, v, c) => n + (v - cap[c]) ** 2, 0);
    if (d < distance) {
      nearest = i;
      distance = d;
    }
  });
  const material = colorToken(nearest, r.palette.length),
    transparent = transparentToken(r.palette.length);
  const result = { name: patch.name, faces: { ...patch.faces } };
  for (const f of selectedFaces(r).filter(
    (f) => f.part === "head" && f.side !== "bottom",
  )) {
    result.faces[f.id] = patch.faces[f.id].map((row, y) => {
      if (f.side !== "top" && y >= 2) return row;
      return splitRow(row, r.palette.length)
        .map((token) => {
          if (token === transparent) return material;
          const color = rgba(r.palette[tokenIndex(token, r.palette.length)]);
          // Keep subtle existing cap shading, replace unrelated hair/skin colors.
          const delta = color
            .slice(0, 3)
            .reduce((n, v, c) => n + (v - cap[c]) ** 2, 0);
          return delta <= 24 ** 2 ? token : material;
        })
        .join("");
    });
  }
  return validatePatch(result, r);
}
