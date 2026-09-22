import { describe, it, expect } from "vitest";
import {
  activeStyle,
  fixedPortrait,
  stylePreset,
  validateStyleProfile,
} from "./style-profile";
import {
  buildHarness,
  demoPatch,
  qualityWarnings,
  validateRequest,
  type GenerationRequest,
} from "./harness";
import { createBlankSkin, parseProject, projectOf, PALETTE } from "./skin";
import { generateOpenAI } from "../../electron/provider";

const request = (): GenerationRequest => ({
  model: "classic",
  pixels: [...createBlankSkin().pixels],
  parts: ["head"],
  layer: "both",
  palette: PALETTE,
  prompt: "Test",
  humanFace: true,
});
describe("style profiles across project, harness and provider", () => {
  it("roundtrips traits and accepts old projects without inventing a style", () => {
    const p = stylePreset("anime");
    p.details = ["glasses"];
    const project = projectOf(createBlankSkin(), "Test", PALETTE, p);
    expect(
      parseProject(JSON.parse(JSON.stringify(project))).styleProfile,
    ).toEqual(p);
    expect(
      parseProject(projectOf(createBlankSkin(), "Old", PALETTE)).styleProfile,
    ).toBeUndefined();
    expect(activeStyle(stylePreset("free"))).toBeUndefined();
  });
  it("rejects unknown profile versions, invalid traits and duplicate details", () => {
    for (const bad of [
      { version: 2 },
      { eyes: "laser" },
      { preset: "__proto__" },
      { details: ["beard", "beard"] },
    ])
      expect(() =>
        validateStyleProfile({ ...stylePreset("portrait"), ...bad }),
      ).toThrow();
  });
  it("does not impose fixed eyes on anime, robots or customized portraits", () => {
    expect(fixedPortrait({ styleProfile: stylePreset("portrait") })).toBe(true);
    for (const p of [
      stylePreset("anime"),
      stylePreset("robot"),
      { ...stylePreset("portrait"), eyes: "dots" as const },
    ]) {
      const r = validateRequest({ ...request(), styleProfile: p });
      expect(fixedPortrait(r)).toBe(false);
      expect(buildHarness(r).instructions).not.toContain(
        "Never draw 2x2 white cartoon eyes",
      );
      expect(JSON.parse(buildHarness(r).input).styleProfile).toEqual(p);
      expect(
        qualityWarnings(createBlankSkin(), r).some((w) => w.includes("Augen")),
      ).toBe(false);
    }
  });
  it("allows creature image drafts but rejects human portrait analysis for covered faces", () => {
    const r = {
      ...request(),
      styleProfile: stylePreset("masked"),
      reference: "data:image/png;base64,AAAA",
      faceMethod: "image" as const,
    };
    expect(validateRequest(r).humanFace).toBe(false);
    expect(() => validateRequest({ ...r, portraitDetails: true })).toThrow();
    expect(() => validateRequest({ ...r, reference: undefined })).toThrow();
  });
  it("sets explicit low reasoning for GPT-5, records usage, and honors no-overlay without repainting unselected faces", async () => {
    const r = {
      ...request(),
      styleProfile: { ...stylePreset("robot"), overlay: "none" as const },
    };
    let sent: any;
    const result = await generateOpenAI(
      r,
      "gpt-5",
      "fake",
      new AbortController().signal,
      (async (_url, init) => {
        sent = JSON.parse(init!.body as string);
        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  { type: "output_text", text: JSON.stringify(demoPatch(r)) },
                ],
              },
            ],
            usage: {
              output_tokens: 120,
              output_tokens_details: { reasoning_tokens: 20 },
            },
          }),
        );
      }) as typeof fetch,
    );
    expect(sent.reasoning).toEqual({ effort: "low" });
    expect(sent.store).toBe(false);
    expect(sent.instructions).toContain('"motif":"robot"');
    expect(result.stages?.[0].reasoning_tokens).toBe(20);
    expect(result.styleProfile).toEqual(r.styleProfile);
    expect(result.pipeline).toBe("grid");
    expect(result.patch.faces.head_outer_front).toEqual(
      Array(8).fill("........"),
    );
    expect(result.patch.faces.head_base_front).toEqual(
      demoPatch(r).faces.head_base_front,
    );
    expect(result.patch.faces.torso_base_front).toBeUndefined();
  });
});
