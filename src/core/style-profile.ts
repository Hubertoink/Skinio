export const STYLE_OPTIONS = {
  motif: {
    human: "Mensch",
    fantasy: "Humanoide Fantasy",
    animal: "Tier",
    monster: "Monster",
    robot: "Roboter",
    masked: "Maskiert",
  },
  eyes: {
    dots: "Punktaugen",
    classic: "Klassisch mit Weißanteil",
    large: "Groß / Anime",
    visor: "Visor",
    hidden: "Verdeckt",
    none: "Keine",
  },
  mouth: {
    none: "Keiner",
    minimal: "Minimal",
    smile: "Lächeln",
    snout: "Schnauze / Schnabel",
    mask: "Maske",
  },
  hair: {
    none: "Keine",
    short: "Kurz",
    fringe: "Pony",
    long: "Lang",
    headwear: "Kopfbedeckung",
  },
  shading: {
    flat: "Flach",
    soft: "Weiche Farbgruppen",
    contrast: "Kontrastreich",
  },
  overlay: {
    none: "Keine",
    accents: "Akzente",
    volume: "Volumen",
    covered: "Gesichtsabdeckung",
  },
} as const;
export const STYLE_LABELS = {
  motif: "Motiv",
  eyes: "Augen",
  mouth: "Mund",
  hair: "Haare",
  shading: "Schattierung",
  overlay: "Außenschicht",
};
export const DETAIL_OPTIONS = {
  beard: "Bart",
  glasses: "Brille",
  scar: "Narbe",
  ears: "Ohren / Hörner",
} as const;
export type StyleTraits = {
  [K in keyof typeof STYLE_OPTIONS]: keyof (typeof STYLE_OPTIONS)[K];
};
export type StyleProfile = StyleTraits & {
  version: 1;
  preset:
    "free" | "classic" | "anime" | "portrait" | "masked" | "creature" | "robot";
  details: (keyof typeof DETAIL_OPTIONS)[];
};
export const PRESET_LABELS = {
  free: "Freie Gestaltung",
  classic: "Classic Human",
  anime: "Soft / Anime",
  portrait: "Porträt",
  masked: "Masked",
  creature: "Creature",
  robot: "Robot",
} as const;
export function stylePreset(preset: StyleProfile["preset"]): StyleProfile {
  const base: StyleProfile = {
    version: 1,
    preset,
    motif: "human",
    eyes: "classic",
    mouth: "minimal",
    hair: "short",
    shading: "soft",
    overlay: "accents",
    details: [],
  };
  const overrides: Partial<
    Record<StyleProfile["preset"], Partial<StyleTraits>>
  > = {
    anime: { eyes: "large", mouth: "none", hair: "fringe", overlay: "volume" },
    masked: {
      motif: "masked",
      eyes: "hidden",
      mouth: "mask",
      hair: "headwear",
      overlay: "covered",
    },
    creature: { motif: "animal", eyes: "dots", mouth: "snout", hair: "none" },
    robot: {
      motif: "robot",
      eyes: "visor",
      mouth: "none",
      hair: "none",
      shading: "contrast",
      overlay: "volume",
    },
  };
  return { ...base, ...overrides[preset] };
}
export function validateStyleProfile(value: unknown): StyleProfile {
  const p = value as StyleProfile;
  if (
    !p ||
    typeof p !== "object" ||
    p.version !== 1 ||
    !Object.hasOwn(PRESET_LABELS, p.preset) ||
    Object.entries(STYLE_OPTIONS).some(
      ([key, values]) => !Object.hasOwn(values, p[key as keyof StyleTraits]),
    ) ||
    !Array.isArray(p.details) ||
    p.details.length > 4 ||
    new Set(p.details).size !== p.details.length ||
    p.details.some((d) => !Object.hasOwn(DETAIL_OPTIONS, d))
  )
    throw new Error("Ungültiges Skin-Stilprofil.");
  return {
    version: 1,
    preset: p.preset,
    motif: p.motif,
    eyes: p.eyes,
    mouth: p.mouth,
    hair: p.hair,
    shading: p.shading,
    overlay: p.overlay,
    details: [...p.details],
  };
}
export function activeStyle(p?: StyleProfile) {
  return p && p.preset !== "free" ? p : undefined;
}
export function visibleHumanFace(p?: StyleProfile) {
  const s = activeStyle(p);
  return (
    !!s &&
    ["human", "fantasy"].includes(s.motif) &&
    ["dots", "classic", "large"].includes(s.eyes) &&
    s.overlay !== "covered"
  );
}
export function fixedPortrait(r: {
  styleProfile?: StyleProfile;
  humanFace?: boolean;
}) {
  const s = activeStyle(r.styleProfile);
  return s
    ? s.preset === "portrait" &&
        visibleHumanFace(s) &&
        s.eyes === "classic" &&
        ["minimal", "smile"].includes(s.mouth)
    : !!r.humanFace;
}
export function styleInstructions(p?: StyleProfile) {
  const s = activeStyle(p);
  if (!s) return "";
  return ` STYLE PROFILE v1 (applies to every face-design stage): ${JSON.stringify(s)}. Use the selected traits; the preset name is only a starting point. Details lists requested additions, not a requirement to remove other visible reference features. Motif defines anatomy. Eyes: dots = single dark pixels without sclera; classic = small eyes with muted light neighbors; large = stylized multi-row eyes allowed; visor = connected mechanical band; hidden/none = do not invent pupils. Mouth: snout means deliberate animal muzzle or beak, mask means opaque covering. Hair must follow the selected shape. Shading flat means flat colors, soft means coherent related color clusters, contrast means deliberate strong plane contrast. Overlay none means all requested outer faces transparent; accents means sparse raised details; volume means selective depth; covered intentionally permits facial occlusion. Do not replace this style with standard human portrait anatomy. Preserve features in the reference where compatible with these choices and explicit user design changes. `;
}
