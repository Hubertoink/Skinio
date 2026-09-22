import { fixedPortrait } from "../src/core/style-profile";
import type { GenerationRequest, GridPatch } from "../src/core/harness";
import { outputSchema, validatePatch, applyPatch } from "../src/core/harness";
import { indexAt, rgba, type Skin } from "../src/core/skin";
import {
  colorToken,
  transparentToken,
  splitRow,
  rowPattern,
} from "../src/core/palette-codec";

export const COLOR_FIELDS = [
  "skinBase",
  "skinShadow",
  "skinHighlight",
  "hairBase",
  "hairHighlight",
  "eyeColor",
  "eyebrowColor",
  "beardColor",
  "lipColor",
  "headwearColor",
  "glassesColor",
  "scarColor",
] as const;
export const DETAIL_FIELDS = [
  "hairstyle",
  "facialHair",
  "glasses",
  "scar",
  "headwear",
  "distinctive",
] as const;
export type PortraitDesign = Record<
  (typeof COLOR_FIELDS)[number] | (typeof DETAIL_FIELDS)[number],
  string
>;
export const portraitSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries([
    ...COLOR_FIELDS.map((k) => [
      k,
      { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    ]),
    ...DETAIL_FIELDS.map((k) => [k, { type: "string", maxLength: 320 }]),
  ]),
  required: [...COLOR_FIELDS, ...DETAIL_FIELDS],
};
export function validatePortrait(raw: unknown): PortraitDesign {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Ungültige Porträtanalyse.");
  const p = raw as PortraitDesign;
  if (
    Object.keys(p).length !== COLOR_FIELDS.length + DETAIL_FIELDS.length ||
    COLOR_FIELDS.some(
      (k) => typeof p[k] !== "string" || !/^#[\da-f]{6}$/i.test(p[k]),
    ) ||
    DETAIL_FIELDS.some((k) => typeof p[k] !== "string" || p[k].length > 320)
  )
    throw new Error("Ungültige Porträtmerkmale oder Farben.");
  return p;
}
export function portraitPalette(
  palette: string[],
  design: PortraitDesign,
  limit = Math.max(64, palette.length),
): string[] {
  const extracted = [
    ...new Set([
      ...COLOR_FIELDS.map((k) => design[k].toLowerCase()),
      "#100f0e",
      "#eee0ca",
    ]),
  ];
  const retained = palette.filter((c) => !extracted.includes(c.toLowerCase()));
  return [...retained.slice(0, limit - extracted.length), ...extracted];
}
export const FEATURE_ORDER = [
  "skin",
  "facialHair",
  "hair",
  "headwear",
  "eyebrows",
  "mouth",
  "eyes",
  "glasses",
  "scar",
] as const;
type Feature = (typeof FEATURE_ORDER)[number];
function featureSymbols(
  feature: Feature,
  r: GenerationRequest,
  p: PortraitDesign,
) {
  const nearest = (hex: string) => {
    const rgb = rgba(hex);
    let best = 0,
      distance = Infinity;
    r.palette.forEach((c, i) => {
      const d = rgba(c)
        .slice(0, 3)
        .reduce((sum, v, j) => sum + (v - rgb[j]) ** 2, 0);
      if (d < distance) {
        best = i;
        distance = d;
      }
    });
    return colorToken(best, r.palette.length);
  };
  const colors: Record<Feature, string[]> = {
    skin: [p.skinBase, p.skinShadow, p.skinHighlight],
    hair: [p.hairBase, p.hairHighlight],
    facialHair: [p.beardColor, p.skinShadow],
    headwear: [p.headwearColor],
    eyebrows: [p.eyebrowColor],
    mouth: [p.lipColor, p.skinShadow],
    eyes: ["#100f0e", p.eyeColor, "#eee0ca", p.skinHighlight],
    glasses: [p.glassesColor],
    scar: [p.scarColor, p.skinHighlight],
  };
  return [
    ...new Set(colors[feature].map(nearest)),
    ...(feature === "skin" ? [] : [transparentToken(r.palette.length)]),
  ];
}
export function featureReviewSchema(r: GenerationRequest, p: PortraitDesign) {
  const old = faceReviewSchema(r);
  return {
    ...old,
    properties: {
      layers: {
        type: "object",
        additionalProperties: false,
        required: [...FEATURE_ORDER],
        properties: Object.fromEntries(
          FEATURE_ORDER.map((feature) => [
            feature,
            {
              type: "array",
              minItems: 8,
              maxItems: 8,
              items: {
                type: "string",
                pattern: rowPattern(
                  8,
                  r.palette.length,
                  feature !== "skin",
                  featureSymbols(feature, r, p),
                ),
              },
            },
          ]),
        ),
      },
      eyeRow: old.properties.eyeRow,
      leftEyeX: old.properties.leftEyeX,
      rightEyeX: old.properties.rightEyeX,
      notes: old.properties.notes,
    },
    required: ["layers", "eyeRow", "leftEyeX", "rightEyeX", "notes"],
  };
}
export function applyFeatureReview(
  raw: unknown,
  patch: GridPatch,
  r: GenerationRequest,
  p: PortraitDesign,
) {
  const v = raw as {
    layers: Record<Feature, string[]>;
    eyeRow: number;
    leftEyeX: number;
    rightEyeX: number;
    notes: string;
  };
  if (
    !v ||
    typeof v !== "object" ||
    Object.keys(v).sort().join() !==
      ["layers", "eyeRow", "leftEyeX", "rightEyeX", "notes"].sort().join() ||
    !v.layers ||
    Object.keys(v.layers).sort().join() !== [...FEATURE_ORDER].sort().join()
  )
    throw new Error("Gesichtsprüfung: unvollständige Merkmalsmasken.");
  for (const f of FEATURE_ORDER) {
    const rows = v.layers[f],
      pattern = new RegExp(
        rowPattern(8, r.palette.length, f !== "skin", featureSymbols(f, r, p)),
      );
    if (
      !Array.isArray(rows) ||
      rows.length !== 8 ||
      rows.some((row) => typeof row !== "string" || !pattern.test(row))
    )
      throw new Error(`Gesichtsprüfung: ungültige ${f}-Maske.`);
  }
  // A valid matrix alone does not guarantee facial anatomy. Keep sparse
  // landmarks in their own rows; pupils are one pixel each, never vertical blobs.
  const layers = Object.fromEntries(
    FEATURE_ORDER.map((f) => [f, [...v.layers[f]]]),
  ) as Record<Feature, string[]>;
  if (fixedPortrait(r)) {
    const empty = transparentToken(r.palette.length);
    for (const [feature, allowedRows] of [
      ["eyes", [3]],
      ["eyebrows", [2]],
      ["mouth", [5, 6]],
    ] as const)
      layers[feature] = layers[feature].map((row, y) =>
        allowedRows.some((n) => n === y) ? row : empty.repeat(8),
      );
    const nearest = (target: string) => {
      const rgb = rgba(target);
      const distances = r.palette.map((c) =>
        rgba(c)
          .slice(0, 3)
          .reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0),
      );
      return colorToken(
        distances.indexOf(Math.min(...distances)),
        r.palette.length,
      );
    };
    layers.eyes = Array(8).fill(empty.repeat(8));
    layers.eyes[3] = [
      empty,
      nearest("#eee0ca"),
      nearest("#100f0e"),
      empty,
      empty,
      nearest("#100f0e"),
      nearest("#eee0ca"),
      empty,
    ].join("");
    v.eyeRow = 3;
    v.leftEyeX = 2;
    v.rightEyeX = 5;
  }
  const rows = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      let color = splitRow(layers.skin[y], r.palette.length)[x];
      for (const feature of FEATURE_ORDER.slice(1))
        if (
          splitRow(layers[feature][y], r.palette.length)[x] !==
          transparentToken(r.palette.length)
        )
          color = splitRow(layers[feature][y], r.palette.length)[x];
      if (fixedPortrait(r) && y === 3 && [1, 2, 5, 6].includes(x))
        color = splitRow(layers.eyes[y], r.palette.length)[x];
      return color;
    }).join(""),
  );
  const checked = applyFaceReview(
    {
      faces: {
        head_base_front: rows,
        ...(r.layer === "both"
          ? {
              head_outer_front: Array(8).fill(
                transparentToken(r.palette.length).repeat(8),
              ),
            }
          : {}),
      },
      eyeRow: v.eyeRow,
      leftEyeX: v.leftEyeX,
      rightEyeX: v.rightEyeX,
      notes: v.notes,
    },
    patch,
    r,
  );
  return { ...checked, review: { ...checked.review, layers } };
}
export function faceReviewSchema(r: GenerationRequest) {
  const properties = outputSchema(r).properties.faces.properties;
  const ids = [
    "head_base_front",
    ...(r.layer === "both" ? ["head_outer_front"] : []),
  ];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      faces: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(ids.map((id) => [id, properties[id]])),
        required: ids,
      },
      eyeRow: { type: "integer", minimum: 0, maximum: 7 },
      leftEyeX: { type: "integer", minimum: 0, maximum: 7 },
      rightEyeX: { type: "integer", minimum: 0, maximum: 7 },
      notes: { type: "string", maxLength: 500 },
    },
    required: ["faces", "eyeRow", "leftEyeX", "rightEyeX", "notes"],
  };
}
export interface FaceReview {
  eyeRow: number;
  leftEyeX: number;
  rightEyeX: number;
  notes: string;
  warnings: string[];
  layers?: Record<Feature, string[]>;
}
export function applyFaceReview(
  raw: unknown,
  patch: GridPatch,
  r: GenerationRequest,
): { patch: GridPatch; review: FaceReview } {
  const v = raw as FaceReview & { faces: GridPatch["faces"] };
  const ids = [
    "head_base_front",
    ...(r.layer === "both" ? ["head_outer_front"] : []),
  ];
  if (
    !v ||
    typeof v !== "object" ||
    Object.keys(v).sort().join() !==
      ["faces", "eyeRow", "leftEyeX", "rightEyeX", "notes"].sort().join() ||
    !v.faces ||
    typeof v.faces !== "object" ||
    Object.keys(v.faces).sort().join() !== ids.sort().join() ||
    [v.eyeRow, v.leftEyeX, v.rightEyeX].some(
      (n) => !Number.isInteger(n) || n < 0 || n > 7,
    ) ||
    typeof v.notes !== "string" ||
    v.notes.length > 500
  )
    throw new Error("Ungültige Gesichtsprüfung. Keine Pixel übernommen.");
  const corrected = validatePatch(
    { name: patch.name, faces: { ...patch.faces, ...v.faces } },
    r,
  );
  const skin = applyPatch(
    { model: r.model, pixels: new Uint8ClampedArray(r.pixels) },
    r,
    corrected,
  ).skin;
  const visible = (x: number, y: number) => {
    const b = indexAt(8 + x, 8 + y),
      o = indexAt(40 + x, 8 + y),
      a = skin.pixels[o + 3] / 255;
    return [0.2126, 0.7152, 0.0722].reduce(
      (s, w, i) =>
        s + w * (skin.pixels[b + i] * (1 - a) + skin.pixels[o + i] * a),
      0,
    );
  };
  const contrast = (x: number) => {
    const neighbors = [
      [x - 1, v.eyeRow],
      [x + 1, v.eyeRow],
      [x, v.eyeRow + 1],
      [x, v.eyeRow - 1],
    ]
      .filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8)
      .map(([a, b]) => visible(a, b));
    return Math.max(...neighbors) - visible(x, v.eyeRow);
  };
  const warnings =
    v.leftEyeX < 1 ||
    v.rightEyeX > 6 ||
    v.rightEyeX - v.leftEyeX < 2 ||
    v.eyeRow < 2 ||
    v.eyeRow > 5 ||
    contrast(v.leftEyeX) < 35 ||
    contrast(v.rightEyeX) < 35
      ? [
          "Die nachgeprüften Augen haben möglicherweise zu wenig Kontrast. Bitte das Gesicht in der Vorschau prüfen.",
        ]
      : [];
  return {
    patch: corrected,
    review: {
      eyeRow: v.eyeRow,
      leftEyeX: v.leftEyeX,
      rightEyeX: v.rightEyeX,
      notes: v.notes,
      warnings,
    },
  };
}
/** Nearest-neighbor enlargement of the ACTUAL composited 8x8 face for visual review. */
export async function reviewImage(skin: Skin): Promise<string> {
  const { nativeImage } = await import("electron");
  const bitmap = Buffer.alloc(256 * 256 * 4);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const b = indexAt(8 + (x >> 5), 8 + (y >> 5)),
        o = indexAt(40 + (x >> 5), 8 + (y >> 5)),
        a = skin.pixels[o + 3] / 255,
        i = (y * 256 + x) * 4;
      for (let c = 0; c < 3; c++)
        bitmap[i + 2 - c] = Math.round(
          skin.pixels[b + c] * (1 - a) + skin.pixels[o + c] * a,
        );
      bitmap[i + 3] = 255;
    }
  return nativeImage
    .createFromBitmap(bitmap, { width: 256, height: 256 })
    .toDataURL();
}
