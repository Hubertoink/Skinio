import { useEffect, useState } from "react";
import type { ModelCatalog } from "../bridge";

function ModelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [manual, setManual] = useState(false);
  return (
    <>
      <label>
        {label}
        <select
          aria-label={label}
          value={manual ? "__manual" : value}
          onChange={(e) => {
            if (e.target.value === "__manual") setManual(true);
            else {
              setManual(false);
              onChange(e.target.value);
            }
          }}
        >
          {!options.includes(value) && (
            <option value={value}>
              {value || "Modell wählen"} · eigene Auswahl
            </option>
          )}
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          <option value="__manual">Modell-ID manuell eingeben …</option>
        </select>
      </label>
      {manual && (
        <label>
          Eigene {label}
          <input
            aria-label={`Eigene ${label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </>
  );
}

export function ModelSettings({
  hasKey,
  credentialVersion,
  model,
  imageModel,
  onModel,
  onImageModel,
}: {
  hasKey: boolean;
  credentialVersion: number;
  model: string;
  imageModel: string;
  onModel: (value: string) => void;
  onImageModel: (value: string) => void;
}) {
  const [catalog, setCatalog] = useState<ModelCatalog>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let stale = false;
    setCatalog(undefined);
    setError("");
    setLoading(false);
    if (!hasKey || !window.desktop) return;
    setLoading(true);
    window.desktop
      .listModels()
      .then((result) => {
        if (!stale) setCatalog(result);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [hasKey, credentialVersion, refresh]);
  return (
    <>
      <ModelSelect
        label="Modell-ID"
        value={model}
        options={catalog?.raster ?? []}
        onChange={onModel}
      />
      <ModelSelect
        label="Bildmodell-ID"
        value={imageModel}
        options={catalog?.image ?? []}
        onChange={onImageModel}
      />
      <button
        disabled={!hasKey || !window.desktop || loading}
        onClick={() => setRefresh((n) => n + 1)}
      >
        {loading ? "Modelle werden geladen …" : "Modelle aktualisieren"}
      </button>
      <p className="microcopy" role="status">
        {error ||
          (!hasKey
            ? "Speichere deinen API-Key, um verfügbare Modelle automatisch zu laden."
            : catalog
              ? `${catalog.raster.length} Rastermodelle und ${catalog.image.length} Bildmodelle gefunden. Die Liste wird bei jedem Öffnen aktualisiert.`
              : "")}
      </p>
      <small>
        Die Vorschläge werden nach Modellfamilie gefiltert. Rastermodelle
        benötigen Structured Outputs und für Referenzbilder Bildeingaben. Die
        Kompatibilität neuer Modelle ist nicht garantiert. Eigene Modell-IDs
        bleiben möglich.
      </small>
    </>
  );
}
