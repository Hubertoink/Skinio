import {
  DETAIL_OPTIONS,
  PRESET_LABELS,
  STYLE_LABELS,
  STYLE_OPTIONS,
  stylePreset,
  type StyleProfile,
  type StyleTraits,
} from "../core/style-profile";

export function StylePicker({
  value,
  onChange,
  disabled,
}: {
  value: StyleProfile;
  onChange: (p: StyleProfile) => void;
  disabled: boolean;
}) {
  return (
    <section className="style-picker" aria-label="Skin-Stilprofil">
      <label className="generation-layer-label">
        Skin-Stil
        <select
          aria-label="Skin-Stil"
          value={value.preset}
          disabled={disabled}
          onChange={(e) =>
            onChange(stylePreset(e.target.value as StyleProfile["preset"]))
          }
        >
          {Object.entries(PRESET_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {value.preset !== "free" && (
        <details className="harness-details">
          <summary>Merkmale anpassen</summary>
          {(Object.keys(STYLE_OPTIONS) as (keyof StyleTraits)[]).map((key) => (
            <label className="generation-layer-label" key={key}>
              {STYLE_LABELS[key]}
              <select
                aria-label={STYLE_LABELS[key]}
                value={value[key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              >
                {Object.entries(STYLE_OPTIONS[key]).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {Object.entries(DETAIL_OPTIONS).map(([id, label]) => (
            <label className="face-guide" key={id}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={value.details.includes(
                  id as keyof typeof DETAIL_OPTIONS,
                )}
                onChange={(e) =>
                  onChange({
                    ...value,
                    details: e.target.checked
                      ? [...value.details, id as keyof typeof DETAIL_OPTIONS]
                      : value.details.filter((d) => d !== id),
                  })
                }
              />
              {label} ergänzen
            </label>
          ))}
        </details>
      )}
      <p className="microcopy">
        {value.preset === "free"
          ? "Prompt und bestehende Gesichtsvorgaben bestimmen den Stil."
          : `${STYLE_OPTIONS.eyes[value.eyes]} · ${STYLE_OPTIONS.shading[value.shading]} · ${STYLE_OPTIONS.overlay[value.overlay]}. Wird im Projekt gespeichert und in allen KI-Stufen berücksichtigt.`}
      </p>
    </section>
  );
}
