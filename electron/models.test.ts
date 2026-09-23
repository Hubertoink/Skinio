import { describe, expect, it, vi } from "vitest";
import { categorizeModels, listOpenAIModels } from "./models";

describe("model discovery", () => {
  it("includes future family versions, separates images and excludes specialized models", () => {
    const result = categorizeModels([
      "gpt-7",
      "gpt-12-mini",
      "gpt-6-astra",
      "gpt-4.1",
      "gpt-4o",
      "o3",
      "gpt-7",
      "gpt-image-3",
      "gpt-image-12",
      "gpt-3.5-turbo",
      "gpt-4",
      "gpt-4o-audio-preview",
      "gpt-7-codex",
      "gpt-7-chat-latest",
      "o3-deep-research",
      "gpt-7-pro",
      "gpt-realtime",
      "text-embedding-3-large",
      "o1-mini",
      "dall-e-3",
    ]);
    expect(result.raster).toEqual([
      "o3",
      "gpt-12-mini",
      "gpt-7",
      "gpt-6-astra",
      "gpt-4o",
      "gpt-4.1",
    ]);
    expect(result.image).toEqual(["gpt-image-12", "gpt-image-3"]);
  });

  it("loads the account catalog with credentials only in the authorization header", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "gpt-7" }, { id: "gpt-image-3" }],
        }),
      ),
    );
    expect(await listOpenAIModels("test-secret", fetcher)).toEqual({
      raster: ["gpt-7"],
      image: ["gpt-image-3"],
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-secret" },
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([401, 403, 429, 500])(
    "handles HTTP %s without exposing API error bodies",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("test-secret", { status }));
      await expect(listOpenAIModels("test-secret", fetcher)).rejects.toThrow(
        status === 401 || status === 403
          ? /API-Key/
          : new RegExp(`HTTP ${status}`),
      );
    },
  );

  it("handles network failure and malformed catalogs", async () => {
    await expect(
      listOpenAIModels(
        "key",
        vi.fn<typeof fetch>().mockRejectedValue(new Error("secret")),
      ),
    ).rejects.toThrow(/Verbindung/);
    for (const data of [{}, { data: [null] }, { data: [{ id: 12 }] }]) {
      await expect(
        listOpenAIModels(
          "key",
          vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify(data))),
        ),
      ).rejects.toThrow(/ungültige Modellliste/);
    }
    expect(
      await listOpenAIModels(
        "key",
        vi.fn<typeof fetch>().mockResolvedValue(new Response('{"data":[]}')),
      ),
    ).toEqual({ raster: [], image: [] });
  });
});
