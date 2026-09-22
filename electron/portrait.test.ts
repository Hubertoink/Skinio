import { describe, it, expect } from "vitest";
import { stylePreset } from "../src/core/style-profile";
import {
  validatePortrait,
  portraitPalette,
  applyFaceReview,
  applyFeatureReview,
  featureReviewSchema,
  FEATURE_ORDER,
  COLOR_FIELDS,
  DETAIL_FIELDS,
  type PortraitDesign,
} from "./portrait";
import { createSkin, PALETTE, SYMBOLS } from "../src/core/skin";
import { demoPatch, type GenerationRequest } from "../src/core/harness";
const design = Object.fromEntries([
  ...COLOR_FIELDS.map((k) => [k, "#ab7856"]),
  ...DETAIL_FIELDS.map((k) => [k, "none"]),
]) as PortraitDesign;
const r: GenerationRequest = {
  model: "classic",
  pixels: Array.from(createSkin().pixels),
  parts: ["head", "torso"],
  layer: "both",
  palette: PALETTE,
  prompt: "Portrait",
};
const review = () => ({
  faces: {
    head_base_front: Array(8).fill("AAAAAAAA"),
    head_outer_front: Array(8).fill("........"),
  },
  eyeRow: 3,
  leftEyeX: 2,
  rightEyeX: 5,
  notes: "Augen geprüft",
});
describe("granular portrait analysis and final review", () => {
  it("preserves multi-row anime eyes instead of replacing them with portrait pupils", () => {
    const request = {
      ...r,
      humanFace: true,
      styleProfile: stylePreset("anime"),
      palette: portraitPalette(PALETTE, design),
    };
    const skin = SYMBOLS[request.palette.indexOf(design.skinBase)];
    const dark = SYMBOLS[request.palette.indexOf("#100f0e")];
    const layers = Object.fromEntries(
      FEATURE_ORDER.map((f) => [
        f,
        Array(8).fill(f === "skin" ? skin.repeat(8) : "........"),
      ]),
    );
    layers.eyes[3] = `.${dark}${dark}..${dark}${dark}.`;
    layers.eyes[4] = layers.eyes[3];
    const result = applyFeatureReview(
      { layers, eyeRow: 3, leftEyeX: 2, rightEyeX: 5, notes: "Anime" },
      demoPatch(request),
      request,
      design,
    );
    expect(result.patch.faces.head_base_front[4]).toBe(
      `${skin}${dark}${dark}${skin}${skin}${dark}${dark}${skin}`,
    );
  });
  it("places a readable eye pair even when semantic masks scatter eyes vertically", () => {
    const request = {
      ...r,
      humanFace: true,
      palette: portraitPalette(PALETTE, design),
    };
    const skin = SYMBOLS[request.palette.indexOf(design.skinBase)];
    const dark = SYMBOLS[request.palette.indexOf("#100f0e")];
    const light = SYMBOLS[request.palette.indexOf("#eee0ca")];
    const layers = Object.fromEntries(
      FEATURE_ORDER.map((f) => [
        f,
        Array(8).fill(f === "skin" ? skin.repeat(8) : "........"),
      ]),
    );
    layers.eyes[4] = `..${dark}.....`;
    layers.eyes[5] = `.....${dark}..`;
    const result = applyFeatureReview(
      { layers, eyeRow: 4, leftEyeX: 2, rightEyeX: 5, notes: "test" },
      demoPatch(request),
      request,
      design,
    );
    expect(result.patch.faces.head_base_front[3]).toBe(
      `${skin}${light}${dark}${skin}${skin}${dark}${light}${skin}`,
    );
    expect(result.patch.faces.head_base_front[4]).toBe(skin.repeat(8));
    expect(result.patch.faces.head_base_front[5]).toBe(skin.repeat(8));
    expect(result.review.warnings).toEqual([]);
  });
  it("composes semantic masks with their own colors and preserves the body", () => {
    const request = { ...r, palette: portraitPalette(PALETTE, design) };
    const symbol = SYMBOLS[request.palette.indexOf(design.skinBase)];
    const layers = Object.fromEntries(
      FEATURE_ORDER.map((f) => [
        f,
        Array(8).fill(f === "skin" ? symbol.repeat(8) : "........"),
      ]),
    );
    const pupil = SYMBOLS[request.palette.indexOf("#100f0e")];
    layers.eyes[3] = `..${pupil}..${pupil}..`;
    const v = { layers, eyeRow: 3, leftEyeX: 2, rightEyeX: 5, notes: "OK" };
    const patch = demoPatch(request);
    const result = applyFeatureReview(v, patch, request, design);
    expect(result.patch.faces.head_base_front[3]).toBe(
      `${symbol}${symbol}${pupil}${symbol}${symbol}${pupil}${symbol}${symbol}`,
    );
    expect(result.patch.faces.torso_base_front).toEqual(
      patch.faces.torso_base_front,
    );
    expect(
      featureReviewSchema(request, design).properties.layers.required,
    ).toHaveLength(9);
    layers.headwear[0] = "00000000";
    expect(() => applyFeatureReview(v, patch, request, design)).toThrow(
      /headwear/,
    );
  });
  it("validates extracted colors and refuses incomplete invented fields", () => {
    expect(validatePortrait(design)).toBe(design);
    expect(() => validatePortrait({ ...design, skinBase: "red" })).toThrow();
    expect(() => validatePortrait({ ...design, extra: "x" })).toThrow();
    expect(() =>
      validatePortrait({ ...design, headwear: undefined }),
    ).toThrow();
    const palette = portraitPalette(PALETTE, design);
    expect(palette).toHaveLength(64);
    expect(palette).toContain("#ab7856");
    expect(new Set(palette).size).toBe(64);
  });
  it("permits final corrections only on the selected head fronts", () => {
    const patch = demoPatch(r),
      v = review();
    v.faces.head_base_front[3] = "AA0AA0AA";
    const result = applyFaceReview(v, patch, r);
    expect(result.patch.faces.torso_base_front).toEqual(
      patch.faces.torso_base_front,
    );
    expect(result.review.warnings).toEqual([]);
    expect(() =>
      applyFaceReview(
        {
          ...v,
          faces: { ...v.faces, torso_base_front: patch.faces.torso_base_front },
        },
        patch,
        r,
      ),
    ).toThrow();
    expect(() =>
      applyFaceReview(
        { ...v, faces: { ...v.faces, head_base_front: ["oops"] } },
        patch,
        r,
      ),
    ).toThrow();
    expect(() => applyFaceReview({ ...v, eyeRow: 9 }, patch, r)).toThrow();
  });
  it("checks contrast on actual composited pupils, including an occluding overlay", () => {
    const patch = demoPatch(r),
      v = review();
    expect(applyFaceReview(v, patch, r).review.warnings).toHaveLength(1);
    v.faces.head_base_front[3] = "AA0AA0AA";
    expect(applyFaceReview(v, patch, r).review.warnings).toEqual([]);
    v.faces.head_outer_front[3] = "AAAAAAAA";
    expect(applyFaceReview(v, patch, r).review.warnings).toHaveLength(1);
    expect(SYMBOLS[PALETTE.length - 1]).toBe("-");
  });
});
