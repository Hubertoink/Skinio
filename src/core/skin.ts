import { validateStyleProfile, type StyleProfile } from "./style-profile";
export const PARTS = [
  "head",
  "torso",
  "rightArm",
  "leftArm",
  "rightLeg",
  "leftLeg",
] as const;
export type Part = (typeof PARTS)[number];
export type Model = "classic" | "slim";
export type Layer = "base" | "outer";
export type Side = "right" | "left" | "top" | "bottom" | "front" | "back";
export const PART_LABELS: Record<Part, string> = {
  head: "Kopf",
  torso: "Oberkörper",
  rightArm: "Rechter Arm",
  leftArm: "Linker Arm",
  rightLeg: "Rechtes Bein",
  leftLeg: "Linkes Bein",
};
export const SIDE_LABELS: Record<Side, string> = {
  front: "Vorne",
  back: "Hinten",
  left: "Links",
  right: "Rechts",
  top: "Oben",
  bottom: "Unten",
};
export interface Face {
  id: string;
  part: Part;
  layer: Layer;
  side: Side;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Skin {
  model: Model;
  pixels: Uint8ClampedArray;
}
export const PALETTE = [
  "#191c27",
  "#303446",
  "#51576d",
  "#838ba2",
  "#bec7d5",
  "#edf1ed",
  "#392c29",
  "#614333",
  "#926244",
  "#bd8963",
  "#e2b58f",
  "#f4d3b0",
  "#422b43",
  "#743b58",
  "#b75465",
  "#ee8491",
  "#452b2f",
  "#843e35",
  "#c95c3d",
  "#ee9760",
  "#70552b",
  "#ac853d",
  "#e8c66a",
  "#f4e8a5",
  "#263f3a",
  "#3e6d55",
  "#6b9970",
  "#a5c790",
  "#233e57",
  "#3b688c",
  "#6d9eb5",
  "#a2ccce",
  // Natural skin, hair and fabric ramps; original indices remain stable.
  "#100f0e",
  "#27221f",
  "#44362e",
  "#655044",
  "#826553",
  "#a17a64",
  "#bb927a",
  "#d0a58d",
  "#dfb49c",
  "#ecc2aa",
  "#f4d0b9",
  "#ffe2cc",
  "#714d3f",
  "#956551",
  "#b67f69",
  "#d39b82",
  "#e1aa92",
  "#efbca4",
  "#ad7056",
  "#d18c66",
  "#513523",
  "#764830",
  "#a66338",
  "#ce884b",
  "#d2b88e",
  "#eee0ca",
  "#73706b",
  "#aaa5a0",
  "#718799",
  "#a7bacd",
  "#d0dfec",
  "#faf8f1",
];
export const SYMBOLS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
export function dimensions(part: Part, model: Model): [number, number, number] {
  return part === "head"
    ? [8, 8, 8]
    : part === "torso"
      ? [8, 12, 4]
      : [part.endsWith("Arm") && model === "slim" ? 3 : 4, 12, 4];
}
export function faces(model: Model): Face[] {
  const origins: Record<Part, [number, number, number, number]> = {
    head: [0, 0, 32, 0],
    torso: [16, 16, 16, 32],
    rightArm: [40, 16, 40, 32],
    leftArm: [32, 48, 48, 48],
    rightLeg: [0, 16, 0, 32],
    leftLeg: [16, 48, 0, 48],
  };
  return PARTS.flatMap((part) =>
    (["base", "outer"] as Layer[]).flatMap((layer) => {
      const [w, h, d] = dimensions(part, model);
      const origin = origins[part];
      const [u, v] = layer === "base" ? origin : origin.slice(2);
      const rects: [Side, number, number, number, number][] = [
        ["right", u, v + d, d, h],
        ["front", u + d, v + d, w, h],
        ["left", u + d + w, v + d, d, h],
        ["back", u + d * 2 + w, v + d, w, h],
        ["top", u + d, v, w, d],
        ["bottom", u + d + w, v, w, d],
      ];
      return rects.map(([side, x, y, fw, fh]) => ({
        id: `${part}_${layer}_${side}`,
        part,
        layer,
        side,
        x,
        y,
        w: fw,
        h: fh,
      }));
    }),
  );
}
export function indexAt(x: number, y: number) {
  return (y * 64 + x) * 4;
}
export function rgba(hex: string): [number, number, number, number] {
  if (hex === ".") return [0, 0, 0, 0];
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Ungültige Farbe.");
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    255,
  ];
}
export function colorAt(p: Uint8ClampedArray, x: number, y: number) {
  const i = indexAt(x, y);
  return p[i + 3] === 0
    ? "."
    : "#" +
        [...p.slice(i, i + 3)]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
}
export function put(p: Uint8ClampedArray, x: number, y: number, color: string) {
  p.set(rgba(color), indexAt(x, y));
}
export function createBlankSkin(model: Model = "classic"): Skin {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (const f of faces(model).filter((f) => f.layer === "base"))
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) put(pixels, f.x + x, f.y + y, "#bec7d5");
  return { model, pixels };
}
export function createSkin(model: Model = "classic"): Skin {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (const f of faces(model).filter((f) => f.layer === "base")) {
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        let color =
          f.part === "head"
            ? "#e2b58f"
            : f.part === "torso"
              ? "#3e6d55"
              : f.part.endsWith("Leg")
                ? "#303446"
                : y > 8
                  ? "#e2b58f"
                  : "#3e6d55";
        if (
          f.part === "head" &&
          (f.side === "top" || f.side === "back" || y < 2)
        )
          color = "#614333";
        if (
          f.part === "head" &&
          f.side === "front" &&
          y === 4 &&
          (x === 2 || x === 5)
        )
          color = "#233e57";
        if (
          f.part === "head" &&
          f.side === "front" &&
          y === 6 &&
          (x === 3 || x === 4)
        )
          color = "#bd8963";
        if (f.part.endsWith("Leg") && y > 9) color = "#392c29";
        if (
          f.part === "torso" &&
          f.side === "front" &&
          (x === 3 || x === 4) &&
          y < 2
        )
          color = "#e2b58f";
        put(pixels, f.x + x, f.y + y, color);
      }
  }
  return { model, pixels };
}
export function normalizeSkin(skin: Skin): Skin {
  const pixels = new Uint8ClampedArray(16384);
  for (const f of faces(skin.model))
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = indexAt(f.x + x, f.y + y);
        pixels.set(skin.pixels.slice(i, i + 4), i);
        if (f.layer === "base") pixels[i + 3] = 255;
      }
  return { model: skin.model, pixels };
}
/** Inspect raw PNG alpha before normalization fills base pixels or discards padding. */
export function detectSkinModel(pixels: Uint8ClampedArray): Model | undefined {
  if (pixels.length !== 64 * 64 * 4) return undefined;
  const armPixels = (model: Model) => {
    const indices = new Set<number>();
    for (const f of faces(model).filter(
      (f) => f.layer === "base" && f.part.endsWith("Arm"),
    ))
      for (let y = f.y; y < f.y + f.h; y++)
        for (let x = f.x; x < f.x + f.w; x++) indices.add(indexAt(x, y) + 3);
    return indices;
  };
  const slim = armPixels("slim");
  const classic = armPixels("classic");
  // Require complete opaque arms, not merely a transparent patch on one arm.
  if (![...slim].every((i) => pixels[i] === 255)) return undefined;
  const padding = [...classic].filter((i) => !slim.has(i));
  if (padding.every((i) => pixels[i] === 0)) return "slim";
  if (padding.every((i) => pixels[i] === 255)) return "classic";
  return undefined;
}
export function convertModel(skin: Skin, model: Model): Skin {
  const pixels = new Uint8ClampedArray(16384);
  const before = faces(skin.model);
  for (const f of faces(model)) {
    const old = before.find((a) => a.id === f.id)!;
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const sourceX = Math.min(old.w - 1, Math.floor((x * old.w) / f.w));
        const i = indexAt(old.x + sourceX, old.y + y);
        pixels.set(skin.pixels.slice(i, i + 4), indexAt(f.x + x, f.y + y));
      }
  }
  return normalizeSkin({ model, pixels });
}
export function paint(
  skin: Skin,
  f: Face,
  x: number,
  y: number,
  color: string,
  fill = false,
): Skin {
  if (
    x < 0 ||
    y < 0 ||
    x >= f.w ||
    y >= f.h ||
    (color === "." && f.layer === "base")
  )
    return skin;
  const pixels = skin.pixels.slice();
  const target = colorAt(pixels, f.x + x, f.y + y);
  if (target === color) return skin;
  const queue = [[x, y]];
  const visited = new Set<number>();
  while (queue.length) {
    const [px, py] = queue.pop()!;
    if (
      px < 0 ||
      py < 0 ||
      px >= f.w ||
      py >= f.h ||
      visited.has(py * f.w + px)
    )
      continue;
    visited.add(py * f.w + px);
    if (colorAt(pixels, f.x + px, f.y + py) !== target && fill) continue;
    put(pixels, f.x + px, f.y + py, color);
    if (fill)
      queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  return { ...skin, pixels };
}
export interface Project {
  styleProfile?: StyleProfile;
  format: "skin-forge";
  version: 1;
  name: string;
  model: Model;
  pixels: number[];
  palette: string[];
}
export function projectOf(
  skin: Skin,
  name: string,
  palette: string[],
  styleProfile?: StyleProfile,
): Project {
  return {
    ...(styleProfile
      ? { styleProfile: validateStyleProfile(styleProfile) }
      : {}),
    format: "skin-forge",
    version: 1,
    name,
    model: skin.model,
    pixels: Array.from(skin.pixels),
    palette,
  };
}
export function parseProject(value: unknown): Project {
  const p = value as Project;
  if (
    !p ||
    p.format !== "skin-forge" ||
    p.version !== 1 ||
    !["classic", "slim"].includes(p.model) ||
    typeof p.name !== "string" ||
    p.name.length > 160 ||
    !Array.isArray(p.pixels) ||
    p.pixels.length !== 16384 ||
    p.pixels.some((n) => !Number.isInteger(n) || n < 0 || n > 255) ||
    !Array.isArray(p.palette) ||
    p.palette.length < 1 ||
    p.palette.length > 256 ||
    p.palette.some((c) => typeof c !== "string" || !/^#[\da-f]{6}$/i.test(c))
  )
    throw new Error("Keine gültige Skin-Forge-Projektdatei (Version 1).");
  return {
    ...p,
    ...(p.styleProfile !== undefined
      ? { styleProfile: validateStyleProfile(p.styleProfile) }
      : {}),
  };
}
