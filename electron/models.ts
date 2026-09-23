import type { ModelCatalog } from "../src/bridge";

// /models exposes IDs, not capabilities. Family matching is a suggestion,
// not a guarantee of Structured Outputs or image-input support.
export function categorizeModels(ids: string[]): ModelCatalog {
  const sorted = [...new Set(ids)].sort((a, b) =>
    b.localeCompare(a, "en", { numeric: true }),
  );
  return {
    raster: sorted.filter((id) => {
      const version = /^gpt-(\d+)(?=[.-]|$)/.exec(id);
      const family =
        (version && Number(version[1]) >= 5) ||
        /^gpt-4(?:o|\.1)(?:-|$)/.test(id) ||
        /^o[1-9]\d*(?:-|$)/.test(id);
      return (
        !!family &&
        !/(?:^|-)(?:audio|realtime|transcribe|tts|search|chat|codex|deep-research|pro|preview)(?:-|$)/.test(
          id,
        ) &&
        !/^o1-mini(?:-|$)/.test(id)
      );
    }),
    image: sorted.filter((id) => /^gpt-image-[a-zA-Z0-9._-]{1,80}$/.test(id)),
  };
}

export async function listOpenAIModels(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<ModelCatalog> {
  let response: Response;
  try {
    response = await fetcher("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(
      "Modelle konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.",
    );
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Modellzugriff abgelehnt. Prüfe deinen API-Key und seine Berechtigungen."
        : `Modelle konnten nicht geladen werden (HTTP ${response.status}). Bitte erneut versuchen.`,
    );
  }
  const payload = await response.json();
  if (
    !payload ||
    !Array.isArray(payload.data) ||
    payload.data.some(
      (m: unknown) =>
        !m || typeof m !== "object" || !("id" in m) || typeof m.id !== "string",
    )
  ) {
    throw new Error("OpenAI hat eine ungültige Modellliste geliefert.");
  }
  return categorizeModels(payload.data.map((m: { id: string }) => m.id));
}
