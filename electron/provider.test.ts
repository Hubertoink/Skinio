import { describe, it, expect, vi } from "vitest";
import { generateOpenAI, responseText } from "./provider";
import { createSkin, PALETTE } from "../src/core/skin";
import { demoPatch, type GenerationRequest } from "../src/core/harness";
import { generateFaceImage } from "./face-image";
import { outfitPalette, type Outfit } from "./outfit";
vi.mock("./face-image", () => ({ generateFaceImage: vi.fn() }));
function request(): GenerationRequest {
  return {
    ...createSkin(),
    pixels: Array.from(createSkin().pixels),
    parts: ["torso"],
    layer: "base",
    palette: PALETTE,
    prompt: "Rüstung",
    reference: "data:image/jpeg;base64,AAAA",
  };
}
describe("OpenAI adapter without paid calls", () => {
  it("plans clothing before the grid and returns its exact palette", async () => {
    const r = {
      ...request(),
      clothingReview: true,
      parts: ["rightArm", "leftLeg"] as GenerationRequest["parts"],
    };
    const outfit: Outfit = {
      top: "tshirt",
      sleeves: "short",
      topColor: "#f4f3ef",
      bottom: "trousers",
      bottomColor: "#202124",
      shoes: "sneakers",
      shoeColor: "#f4f3ef",
      skinColor: "#c68e6c",
    };
    const palette = outfitPalette(r.palette, outfit, 64);
    const names: string[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body as string);
      names.push(body.text.format.name);
      const result =
        body.text.format.name === "outfit_plan"
          ? outfit
          : demoPatch({ ...r, palette });
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(result) }],
            },
          ],
        }),
      );
    });
    const result = await generateOpenAI(
      r,
      "test-model",
      "test-key",
      new AbortController().signal,
      fetcher,
    );
    expect(names).toEqual(["outfit_plan", "minecraft_skin_grid"]);
    expect(result.palette).toEqual(palette);
    expect(result.outfit).toEqual(outfit);
    expect(r.palette).toEqual(PALETTE);
    expect(result.patch.faces.leftLeg_base_front[10]).not.toEqual(
      result.patch.faces.leftLeg_base_front[5],
    );
  });
  it("rasterizes the draft as an additional visual reference and keeps the front overlay clear", async () => {
    const r: GenerationRequest = {
      ...request(),
      parts: ["head"],
      layer: "both",
      humanFace: true,
      faceMethod: "image",
    };
    const draft = Array(8).fill("--------");
    vi.mocked(generateFaceImage).mockResolvedValueOnce({
      rows: draft,
      preview: "data:image/png;base64,AAAA",
      usage: { total_tokens: 42 },
    });
    const patch = demoPatch(r);
    const originalSide = [...patch.faces.head_base_right];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(patch) }],
            },
          ],
        }),
      ),
    );
    const result = await generateOpenAI(
      r,
      "test-model",
      "test-key",
      new AbortController().signal,
      fetcher,
    );
    expect(result.patch.faces.head_base_front).toEqual(
      patch.faces.head_base_front,
    );
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.input[0].content[2]).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,AAAA",
      detail: "high",
    });
    expect(result.patch.faces.head_outer_front).toEqual(
      Array(8).fill("........"),
    );
    expect(result.patch.faces.head_base_right).toEqual(originalSide);
    expect(result.imageModel).toBe("gpt-image-2");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not start the paid raster request after an image failure", async () => {
    vi.mocked(generateFaceImage).mockRejectedValueOnce(
      new Error("image failed"),
    );
    const fetcher = vi.fn();
    await expect(
      generateOpenAI(
        { ...request(), parts: ["head"], humanFace: true, faceMethod: "image" },
        "test",
        "key",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow("image failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends strict structured output and a vision input, then validates the result", async () => {
    const r = request();
    const patch = demoPatch(r);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(patch) }],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      ),
    );
    const result = await generateOpenAI(
      r,
      "test-model",
      "test-key",
      new AbortController().signal,
      fetcher,
    );
    const [url, init] = fetcher.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.input[0].content[1].type).toBe("input_image");
    expect(result.patch).toEqual(patch);
    expect(result.usage?.output_tokens).toBe(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries a failed paid call", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      generateOpenAI(
        request(),
        "test-model",
        "test-key",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(/Guthaben/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects refusals, truncation and malformed grids", async () => {
    expect(() => responseText({ status: "incomplete" })).toThrow(
      /unvollständig/,
    );
    expect(() =>
      responseText({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
    ).toThrow(/abgelehnt/);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: '{"name":"x","faces":{}}' },
              ],
            },
          ],
        }),
      ),
    );
    await expect(
      generateOpenAI(
        request(),
        "test-model",
        "test-key",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(/Körperflächen/);
  });
});
