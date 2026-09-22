import { POSES } from "./core/poses";
import { StylePicker } from "./components/StylePicker";
import {
  activeStyle,
  stylePreset,
  visibleHumanFace,
  type StyleProfile,
} from "./core/style-profile";
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Pencil,
  Eraser,
  Pipette,
  PaintBucket,
  Rotate3D,
  Undo2,
  Redo2,
  Upload,
  Download,
  Save,
  Settings2,
  Sparkles,
  ShieldCheck,
  Grid2X2,
  Eye,
  Scan,
  X,
  Check,
  ImagePlus,
  ChevronRight,
  LoaderCircle,
  Plus,
  Trash2,
  Layers2,
  LockKeyhole,
  UnlockKeyhole,
  Camera,
  PersonStanding,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  PARTS,
  PART_LABELS,
  PALETTE,
  createBlankSkin,
  colorAt,
  faces,
  paint,
  convertModel,
  projectOf,
  parseProject,
  type Skin,
  type Part,
  type Face,
  type Layer,
} from "./core/skin";
import {
  applyPatch,
  selectedFaces,
  qualityWarnings,
  type GenerationLayer,
  type GenerationRequest,
} from "./core/harness";
import {
  importPNG,
  pngOf,
  referenceOf,
  paletteFromReference,
  saveFile,
} from "./core/images";
import { Viewport, type Tool } from "./components/Viewport";
import { FaceEditor } from "./components/FaceEditor";
import type { GenerationResult } from "./bridge";

import { colorToken } from "./core/palette-codec";

import { COLOR_BANKS, STUDIO_COLORS, type ColorBank } from "./core/color-banks";

const AUTOSAVE = "skin-forge-project-v1";
function initial() {
  try {
    const raw = localStorage.getItem(AUTOSAVE);
    if (raw) return parseProject(JSON.parse(raw));
  } catch {}
  return projectOf(createBlankSkin(), "Neuer Skin", STUDIO_COLORS);
}
const TOOLS = [
  { id: "brush", label: "Stift", key: "B", icon: Pencil },
  { id: "erase", label: "Radierer", key: "E", icon: Eraser },
  { id: "pick", label: "Pipette", key: "I", icon: Pipette },
  { id: "fill", label: "Füllen", key: "F", icon: PaintBucket },
  { id: "orbit", label: "Drehen", key: "V", icon: Rotate3D },
] as const;
export function App() {
  const [boot] = useState(initial);
  const [skin, setSkin] = useState<Skin>({
    model: boot.model,
    pixels: new Uint8ClampedArray(boot.pixels),
  });
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const [name, setName] = useState(boot.name);
  const [palette, setPalette] = useState(
    boot.palette.length === 32 && boot.palette.every((c, i) => c === PALETTE[i])
      ? PALETTE
      : boot.palette,
  );
  const [colorBank, setColorBank] = useState<ColorBank>("basic");
  const [viewLocked, setViewLocked] = useState(false);
  const [color, setColor] = useState("#e8c66a");
  const [paletteLimit, setPaletteLimit] = useState<64 | 128 | 256>(
    boot.palette.length > 128 ? 256 : boot.palette.length > 64 ? 128 : 64,
  );
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [clothingReview, setClothingReview] = useState(true);
  const [clothingDetail, setClothingDetail] = useState<
    "simple" | "shaded" | "detailed"
  >("detailed");
  const [closeHeadwear, setCloseHeadwear] = useState(true);
  const [tool, setTool] = useState<Tool>("brush");
  const [parts, setParts] = useState<Part[]>([...PARTS]);
  const [layer, setLayer] = useState<Layer>("base");
  const [generationLayer, setGenerationLayer] =
    useState<GenerationLayer>("both");
  const [styleProfile, setStyleProfile] = useState<StyleProfile>(
    boot.styleProfile ?? stylePreset("free"),
  );
  const [humanFace, setHumanFace] = useState(true);
  const [faceMethod, setFaceMethod] = useState<"grid" | "image">("grid");
  const [portraitDetails, setPortraitDetails] = useState(true);
  const [generationStage, setGenerationStage] = useState(
    "Die KI setzt Pixel …",
  );
  useEffect(
    () =>
      window.desktop?.onGenerationProgress?.((stage) =>
        setGenerationStage(
          {
            analysis: "Merkmale und Kleidung analysieren …",
            image: "Gesichtsentwurf zeichnen …",
            grid: "Merkmale ins Skin-Raster übertragen …",
            review: "Gesichtsdetails und Augen-Kontrast nachprüfen …",
          }[stage],
        ),
      ),
    [],
  );

  const [grid, setGrid] = useState(true);
  const [outer, setOuter] = useState(true);
  const [isolate, setIsolate] = useState(false);
  const [view, setView] = useState(0);
  const capturePose = useRef<(() => string) | null>(null);
  const [pose, setPose] = useState("neutral");
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [part, setPart] = useState<Part>("torso");
  const [face, setFace] = useState("front");
  const [hover, setHover] = useState("64 × 64 · RGBA PNG");
  const [message, setMessage] = useState("Bereit.");
  const [saved, setSaved] = useState(true);
  const [history, setHistory] = useState<Skin[]>([]);
  const [future, setFuture] = useState<Skin[]>([]);
  const stroke = useRef<Skin | null>(null);
  const sampledDuringStroke = useRef(false);
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<string>();
  const [referenceName, setReferenceName] = useState("");
  const [settings, setSettings] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState("");
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [model, setModel] = useState(
    () => localStorage.getItem("skin-forge-model") || "gpt-6-astra",
  );
  const [imageModel, setImageModel] = useState(
    () => localStorage.getItem("skin-forge-image-model") || "gpt-image-2",
  );
  const [reasoningEffort, setReasoningEffort] = useState<
    "auto" | "low" | "medium" | "high"
  >("low");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stageSeconds, setStageSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    setElapsedSeconds(0);
    const timer = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    setStageSeconds(0);
    const timer = setInterval(
      () => setStageSeconds(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy, generationStage]);
  const [preview, setPreview] = useState<{
    request: GenerationRequest;
    result: GenerationResult;
    skin: Skin;
    changed: number;
  }>();
  const [showOriginal, setShowOriginal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const frozen = busy || paletteBusy || !!preview || newDialog;
  useEffect(() => {
    window.desktop
      ?.keyStatus()
      .then(setHasKey)
      .catch((e) => setMessage(String(e)));
  }, []);
  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE,
          JSON.stringify(projectOf(skin, name, palette, styleProfile)),
        );
        setSaved(true);
      } catch {
        setMessage(
          "Automatisches Speichern fehlgeschlagen. Bitte Projekt als Datei sichern.",
        );
      }
    }, 400);
    return () => clearTimeout(t);
  }, [skin, name, palette, styleProfile]);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          AUTOSAVE,
          JSON.stringify(
            projectOf(skinRef.current, name, palette, styleProfile),
          ),
        );
      } catch {}
    };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [name, palette, styleProfile]);
  const change = (next: Skin) => {
    const before = skinRef.current;
    if (next === before) return;
    setHistory((h) => [...h.slice(-79), before]);
    setFuture([]);
    skinRef.current = next;
    setSkin(next);
  };
  const startStroke = () => {
    sampledDuringStroke.current = false;
    stroke.current = skinRef.current;
  };
  const endStroke = () => {
    sampledDuringStroke.current = false;
    const before = stroke.current;
    stroke.current = null;
    if (before && before !== skinRef.current) {
      setHistory((h) => [...h.slice(-79), before]);
      setFuture([]);
    }
  };
  const doPaint = (f: Face, x: number, y: number) => {
    if (
      frozen ||
      sampledDuringStroke.current ||
      tool === "orbit" ||
      !parts.includes(f.part)
    )
      return;
    if (tool === "pick") {
      const c = colorAt(skinRef.current.pixels, f.x + x, f.y + y);
      if (c !== ".") {
        sampledDuringStroke.current = true;
        setColor(c);
        setTool("brush");
      }
      return;
    }
    if (tool === "erase" && layer === "base") {
      setMessage(
        "Die Grundschicht bleibt deckend. Zum Radieren die äußere Schicht wählen.",
      );
      return;
    }
    const next = paint(
      skinRef.current,
      f,
      x,
      y,
      tool === "erase" ? "." : color,
      tool === "fill",
    );
    skinRef.current = next;
    setSkin(next);
  };
  const undo = () => {
    if (frozen || !history.length) return;
    const before = skinRef.current;
    setFuture((f) => [...f, before]);
    const next = history[history.length - 1];
    setHistory(history.slice(0, -1));
    skinRef.current = next;
    setSkin(next);
  };
  const redo = () => {
    if (frozen || !future.length) return;
    const before = skinRef.current;
    setHistory((h) => [...h, before]);
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    skinRef.current = next;
    setSkin(next);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        settings ||
        newDialog
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!e.ctrlKey && !e.metaKey) {
        const t = TOOLS.find(
          (t) => t.key.toLowerCase() === e.key.toLowerCase(),
        );
        if (t) setTool(t.id);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  const attempt = async (action: () => unknown | Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const importFile = async (file: File) => {
    if (frozen) return;
    if (file.name.endsWith(".skinforge") || file.name.endsWith(".json")) {
      if (file.size > 1_000_000) throw new Error("Projektdatei ist zu groß.");
      const p = parseProject(JSON.parse(await file.text()));
      change({ model: p.model, pixels: new Uint8ClampedArray(p.pixels) });
      setName(p.name);
      setStyleProfile(p.styleProfile ?? stylePreset("free"));
      setPalette(p.palette);
      setPaletteLimit(
        p.palette.length > 128 ? 256 : p.palette.length > 64 ? 128 : 64,
      );
      setMessage("Importiert. Projekt geladen.");
    } else {
      const imported = await importPNG(file, skinRef.current.model);
      change(imported);
      setName(file.name.replace(/\.[^.]+$/, ""));
      setMessage(
        `Importiert als ${imported.model === "slim" ? "Slim · 3 px Arme" : "Classic · 4 px Arme"}.`,
      );
    }
  };
  const startNew = () => {
    const next = createBlankSkin(skinRef.current.model);
    skinRef.current = next;
    setSkin(next);
    setName("Neuer Skin");
    setStyleProfile(stylePreset("free"));
    setHistory([]);
    setFuture([]);
    stroke.current = null;
    setPreview(undefined);
    setShowOriginal(false);
    setReference(undefined);
    setReferenceName("");
    setPrompt("");
    setParts([...PARTS]);
    setLayer("base");
    setPart("head");
    setFace("front");
    setTool("brush");
    setIsolate(false);
    setOuter(true);
    setView(0);
    setViewLocked(false);
    setNewDialog(false);
    setNewError("");
    setMessage("Neuer, unbemalter Skin erstellt.");
  };
  const saveAndStartNew = async () => {
    setNewSaving(true);
    setNewError("");
    try {
      const saved = await saveFile(
        "project",
        name,
        JSON.stringify(projectOf(skinRef.current, name, palette, styleProfile)),
      );
      if (saved) startNew();
    } catch (error) {
      setNewError(error instanceof Error ? error.message : String(error));
    } finally {
      setNewSaving(false);
    }
  };
  const imageFaceAvailable =
    !!reference && parts.includes("head") && generationLayer !== "outer";
  const effectiveHumanFace = activeStyle(styleProfile)
    ? visibleHumanFace(styleProfile)
    : humanFace;
  const portraitAvailable = imageFaceAvailable && effectiveHumanFace;
  const clothingReviewActive =
    clothingReview &&
    generationLayer !== "outer" &&
    parts.some((p) => p !== "head");
  const request = (): GenerationRequest => ({
    model: skinRef.current.model,
    pixels: Array.from(skinRef.current.pixels),
    parts: [...parts],
    layer: generationLayer,
    humanFace: effectiveHumanFace,
    styleProfile,
    imageModel,
    reasoningEffort,
    faceMethod: imageFaceAvailable ? faceMethod : "grid",
    portraitDetails: portraitAvailable && portraitDetails,
    paletteLimit,
    clothingDetail,
    clothingReview:
      clothingReview &&
      generationLayer !== "outer" &&
      parts.some((p) => p !== "head"),
    closeHeadwear,
    palette: [...palette],
    prompt,
    ...(reference ? { reference } : {}),
  });
  const showResult = (r: GenerationRequest, result: GenerationResult) => {
    r = { ...r, palette: result.palette ?? r.palette };
    const applied = applyPatch(skinRef.current, r, result.patch);
    setPreview({ request: r, result, ...applied });
    setShowOriginal(false);
    setMessage(
      `Raster geprüft: ${applied.changed} geänderte Pixel. Vorschau ansehen und übernehmen oder verwerfen.`,
    );
  };
  const generate = async () => {
    if (frozen) return;
    if (!parts.length || !prompt.trim()) {
      setMessage(
        "Bitte mindestens ein Körperteil auswählen und einen Prompt eingeben.",
      );
      return;
    }
    if (!window.desktop || !hasKey || !model.trim()) {
      setSettings(true);
      return;
    }
    const r = request();
    setGenerationStage("Generierung wird vorbereitet …");
    setBusy(true);
    setMessage("KI-Bearbeitung läuft …");
    try {
      const result = await window.desktop!.generate(r, model.trim());
      showResult(r, result);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const display = preview && !showOriginal ? preview.skin : skin;
  const selectedCount = faces(skin.model)
    .filter(
      (f) =>
        parts.includes(f.part) &&
        (generationLayer === "both" || f.layer === generationLayer),
    )
    .reduce((n, f) => n + f.w * f.h, 0);
  const togglePart = (p: Part) => {
    if (!frozen) {
      setParts((v) => (v.includes(p) ? v.filter((a) => a !== p) : [...v, p]));
      setPart(p);
    }
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <Box size={23} />
          </div>
          <div>
            skin<span>forge</span>
          </div>
        </div>
        <div className="project-title">
          <input
            aria-label="Projektname"
            disabled={frozen}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="save-state">
            <i />
            {saved ? "Lokal gespeichert" : "Speichert …"}
          </span>
        </div>
        <div className="header-actions">
          <button
            disabled={frozen}
            onClick={() => {
              setNewError("");
              setNewDialog(true);
            }}
          >
            <Plus size={15} /> Neu
          </button>
          <button disabled={frozen} onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Öffnen
          </button>
          <button
            onClick={() =>
              attempt(async () => {
                if (
                  await saveFile(
                    "project",
                    name,
                    JSON.stringify(
                      projectOf(skin, name, palette, styleProfile),
                    ),
                  )
                )
                  setMessage("Projektdatei gespeichert.");
              })
            }
          >
            <Save size={15} /> Projekt
          </button>
          <button
            className="primary"
            disabled={!!preview}
            onClick={() =>
              attempt(async () => {
                if (await saveFile("png", name, pngOf(skin)))
                  setMessage(
                    "64 × 64 PNG exportiert. Beim Minecraft-Import das passende Classic-/Slim-Modell wählen.",
                  );
              })
            }
          >
            <Download size={15} /> PNG exportieren
          </button>
          <button title="Aktuelle Kamera und Pose als PNG mit transparentem Hintergrund speichern" onClick={() => attempt(async () => {
            if (!capturePose.current) throw new Error("Die 3D-Vorschau ist noch nicht verfügbar.");
            const png = capturePose.current();
            if (await saveFile("pose", `${name}-${pose}`, png)) setMessage("Pose als transparentes PNG exportiert – ohne Boden und Pixelraster.");
          })}>
            <Camera size={15} /> Pose exportieren
          </button>
          <button
            className="icon-button"
            aria-label="KI-Einstellungen"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      <main className={`workspace${aiCollapsed ? " ai-collapsed" : ""}`}>
        <aside className="left-panel">
          <div className="section-label spaced">
            FARBPALETTE <span>{palette.length}</span>
          </div>
          <label className="generation-layer-label">
            Palettengröße
            <select
              aria-label="Palettengröße"
              value={paletteLimit}
              disabled={frozen}
              onChange={(e) => {
                const limit = Number(e.target.value) as 64 | 128 | 256;
                setPaletteLimit(limit);
                setPalette((p) => p.slice(0, limit));
              }}
            >
              <option value={64}>Kompakt · bis 64 Farben</option>
              <option value={128}>Erweitert · bis 128 Farben</option>
              <option value={256}>Expansiv · bis 256 Farben</option>
            </select>
          </label>
          <button
            className="text-button"
            disabled={frozen || !reference}
            onClick={() =>
              void attempt(async () => {
                setPaletteBusy(true);
                try {
                  const colors = await paletteFromReference(
                    reference!,
                    paletteLimit,
                  );
                  setPalette(colors);
                  setColorBank("project");
                  setMessage(
                    `${colors.length} Farben lokal aus dem Referenzbild übernommen.`,
                  );
                } finally {
                  setPaletteBusy(false);
                }
              })
            }
          >
            {paletteBusy
              ? "Farben werden gelesen …"
              : "Farben aus Referenzbild übernehmen"}
          </button>
          <div className="palette-tabs" role="tablist" aria-label="Farbgruppen">
            {[
              ...Object.entries(COLOR_BANKS).map(([id, b]) => ({
                id,
                label: b.label,
              })),
              { id: "project", label: `Projekt / Bild (${palette.length})` },
            ].map((b) => (
              <button
                key={b.id}
                role="tab"
                aria-selected={colorBank === b.id}
                onClick={() => setColorBank(b.id as ColorBank)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div
            className="palette"
            role="tabpanel"
            aria-label={
              colorBank === "project"
                ? "Projektfarben"
                : COLOR_BANKS[colorBank].label
            }
          >
            {(colorBank === "project"
              ? palette
              : COLOR_BANKS[colorBank].colors
            ).map((c, i) => (
              <button
                key={i}
                aria-label={`Farbe ${c}`}
                className={
                  color.toLowerCase() === c.toLowerCase() ? "chosen" : ""
                }
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setTool("brush");
                  if (
                    !frozen &&
                    !palette.some((p) => p.toLowerCase() === c.toLowerCase())
                  )
                    setPalette((p) => [...p.slice(0, paletteLimit - 1), c]);
                }}
                title={
                  colorBank === "project"
                    ? `${colorToken(i, palette.length)} · ${c}`
                    : c
                }
              />
            ))}
          </div>
          <div className="color-picker">
            <input
              aria-label="Eigene Farbe"
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setTool("brush");
              }}
            />
            <code>{color.toUpperCase()}</code>
            <button
              className="icon-button"
              disabled={frozen}
              title={`Aktuelle Farbe hinzufügen (bei ${paletteLimit} Farben letzte ersetzen)`}
              onClick={() => {
                if (!palette.includes(color))
                  setPalette((p) =>
                    p.length < paletteLimit
                      ? [...p, color]
                      : [...p.slice(0, paletteLimit - 1), color],
                  );
              }}
            >
              <Plus size={15} />
            </button>
          </div>
          <p className="microcopy">
            Grundfarben, Hauttöne und Naturfarben bleiben immer verfügbar.
            <br />
            Gewählte Farben ergänzen die Projektpalette für die KI.
          </p>
          <button
            className="text-button"
            disabled={frozen}
            onClick={() => {
              const colors = new Map<string, number>();
              for (let y = 0; y < 64; y++)
                for (let x = 0; x < 64; x++) {
                  const c = colorAt(skin.pixels, x, y);
                  if (c !== ".") colors.set(c, (colors.get(c) ?? 0) + 1);
                }
              setPalette(
                [...colors]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, paletteLimit)
                  .map(([c]) => c),
              );
              setColorBank("project");
              setMessage(`Bis zu ${paletteLimit} Skin-Farben übernommen.`);
            }}
          >
            Palette aus Skin übernehmen
          </button>
          <button
            className="text-button"
            disabled={frozen}
            onClick={() => {
              setPalette([...STUDIO_COLORS]);
              setPaletteLimit(128);
              setColorBank("project");
            }}
          >
            Alle Farbgruppen laden
          </button>
        </aside>
        <section className="center-panel">
          <button className="ai-panel-toggle" aria-controls="ai-panel" aria-expanded={!aiCollapsed}
            aria-label={aiCollapsed ? "KI-Panel ausklappen" : "KI-Panel einklappen"}
            title={aiCollapsed ? "KI-Panel ausklappen" : "KI-Panel einklappen"}
            onClick={() => setAiCollapsed((value) => !value)}>
            {aiCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            <span>KI</span>
          </button>
          <div className="stage">
            <div className="stage-toolbar">
              <div className="camera-controls">
                <label className="pose-select">
                  <span>Pose</span>
                  <select aria-label="Pose" value={pose} onChange={(e) => setPose(e.target.value)}>
                    {POSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <div
                  className="canvas-select"
                  title={`Kameraansicht: ${["Freie 3D-Ansicht", "Vorne", "Hinten", "Linke Seite", "Rechte Seite"][view % 5]}`}
                >
                  <Camera size={17} aria-hidden="true" />
                  <select
                    aria-label="Kameraansicht"
                    value={view % 5}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setView(v);
                      setViewLocked(v !== 0);
                    }}
                  >
                    <option value={0}>Freie 3D-Ansicht</option>
                    <option value={1}>Vorne</option>
                    <option value={2}>Hinten</option>
                    <option value={3}>Linke Seite</option>
                    <option value={4}>Rechte Seite</option>
                  </select>
                </div>
                <button
                  className="icon-button"
                  aria-label="Ansicht fixieren"
                  aria-pressed={viewLocked}
                  title={
                    viewLocked
                      ? "Ansicht lösen"
                      : "Drehen und Verschieben sperren"
                  }
                  onClick={() => setViewLocked((v) => !v)}
                >
                  {viewLocked ? (
                    <LockKeyhole size={17} />
                  ) : (
                    <UnlockKeyhole size={17} />
                  )}
                </button>
              </div>
              <div
                className={`canvas-select${frozen ? " disabled" : ""}`}
                title={`Körpermodell: ${skin.model === "classic" ? "Classic · 4 px Arme" : "Slim · 3 px Arme"}`}
              >
                <PersonStanding size={17} aria-hidden="true" />
                <select
                  aria-label="Körpermodell"
                  disabled={frozen}
                  value={skin.model}
                  onChange={(e) =>
                    change(convertModel(skin, e.target.value as Skin["model"]))
                  }
                >
                  <option value="classic">Classic · 4 px Arme</option>
                  <option value="slim">Slim · 3 px Arme</option>
                </select>
              </div>
            </div>
            <div className="stage-caption">
              <span>{preview ? "KI-VORSCHAU" : "VORSCHAU"}</span>
              <h1>{preview ? preview.result.patch.name : "Skin-Vorschau"}</h1>
              <p>
                {preview
                  ? `${preview.changed} Pixel · ${selectedFaces(preview.request).length} geprüfte Flächen`
                  : name}
              </p>
            </div>
            <Viewport
              captureRef={capturePose}
              pose={pose}
              skin={display}
              parts={parts}
              layer={layer}
              tool={tool}
              grid={grid}
              outer={outer}
              isolate={isolate}
              view={view}
              locked={viewLocked}
              disabled={frozen}
              onPaint={doPaint}
              onStart={startStroke}
              onEnd={endStroke}
              onHover={setHover}
            />
            <div
              className="floating-tools"
              role="toolbar"
              aria-label="Malwerkzeuge"
            >
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? "selected" : ""}
                  disabled={frozen}
                  title={`${t.label} (${t.key})`}
                  onClick={() => setTool(t.id)}
                >
                  <t.icon size={20} />
                </button>
              ))}
              <span className="tool-divider" />
              <button
                aria-label="Zurück"
                title="Rückgängig (Strg+Z)"
                disabled={frozen || !history.length}
                onClick={undo}
              >
                <Undo2 size={20} />
              </button>
              <button
                aria-label="Vor"
                title="Wiederholen (Strg+Shift+Z)"
                disabled={frozen || !future.length}
                onClick={redo}
              >
                <Redo2 size={20} />
              </button>
            </div>
            <div className="view-controls">
              <button
                aria-label="Grundschicht"
                aria-pressed={layer === "base"}
                title="Grundschicht bemalen"
                className={layer === "base" ? "active" : ""}
                disabled={frozen}
                onClick={() => setLayer("base")}
              >
                <Box size={17} />
              </button>
              <button
                aria-label="Äußere Schicht"
                aria-pressed={layer === "outer"}
                title="Äußere Schicht bemalen"
                className={layer === "outer" ? "active" : ""}
                disabled={frozen}
                onClick={() => setLayer("outer")}
              >
                <Layers2 size={17} />
              </button>
              <button
                className={grid ? "active" : ""}
                title="Pixelraster"
                aria-label="Pixelraster"
                onClick={() => setGrid(!grid)}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                className={outer ? "active" : ""}
                title="Äußere Schicht anzeigen"
                aria-label="Äußere Schicht anzeigen"
                onClick={() => setOuter(!outer)}
              >
                <Eye size={17} />
              </button>
              <button
                className={isolate ? "active" : ""}
                title="Auswahl isolieren"
                aria-label="Auswahl isolieren"
                onClick={() => setIsolate(!isolate)}
              >
                <Scan size={17} />
              </button>
              <button
                title="Ansicht wechseln"
                aria-label="Ansicht wechseln"
                onClick={() => setView((v) => v + 1)}
              >
                <Rotate3D size={17} />
              </button>
            </div>
            <div className="stage-hint">
              Linksklick malt <span>·</span>{" "}
              {viewLocked ? "Ansicht fixiert" : "Rechtsziehen dreht"}{" "}
              <span>·</span> Mausrad zoomt
            </div>
            {busy && (
              <div className="generation-overlay">
                <LoaderCircle className="spin" size={28} />
                <strong>{generationStage}</strong>
                <span>
                  {elapsedSeconds} s gesamt · {stageSeconds} s in diesem Schritt
                </span>
                <small>
                  Die API liefert hier erst die vollständige Antwort. Zeitlimit:
                  7 Minuten.
                </small>
                <span>Dein Original bleibt erhalten.</span>
                <button onClick={() => attempt(() => window.desktop?.cancel())}>
                  Abbrechen
                </button>
              </div>
            )}
            {preview && (
              <div className="preview-bar">
                <button onClick={() => setShowOriginal((v) => !v)}>
                  <Eye size={15} />
                  {showOriginal ? "Entwurf zeigen" : "Original zeigen"}
                </button>
                <button
                  onClick={() => {
                    setPreview(undefined);
                    setMessage("Entwurf verworfen. Original erhalten.");
                  }}
                >
                  <X size={15} /> Verwerfen
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    attempt(() => {
                      const next = applyPatch(
                        skinRef.current,
                        preview.request,
                        preview.result.patch,
                      );
                      change(next.skin);
                      if (preview.result.palette)
                        setPalette([...preview.request.palette]);
                      setPreview(undefined);
                      setMessage(
                        `${next.changed} Pixel übernommen. Mit Zurück vollständig rückgängig machen.`,
                      );
                    })
                  }
                >
                  <Check size={15} /> Übernehmen
                </button>
              </div>
            )}
          </div>
          <div className="detail-panel">
            <div className="detail-heading">
              <div>
                <span className="section-label">FLÄCHENEDITOR</span>
                <small>Direkt am Raster nacharbeiten</small>
              </div>
              <select
                aria-label="Körperteil im Flächeneditor"
                value={part}
                onChange={(e) => setPart(e.target.value as Part)}
              >
                {PARTS.map((p) => (
                  <option key={p} value={p}>
                    {PART_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <FaceEditor
              skin={display}
              part={part}
              layer={layer}
              faceId={face}
              grid={grid}
              disabled={frozen || !parts.includes(part)}
              onFace={setFace}
              onPaint={doPaint}
              onStart={startStroke}
              onEnd={endStroke}
            />
          </div>
        </section>
        <aside id="ai-panel" className="right-panel" hidden={aiCollapsed}>
          <div className="ai-title">
            <div className="ai-mark">
              <Sparkles size={19} />
            </div>
            <div>
              <h2>KI-Werkstatt</h2>
            </div>
          </div>
          <div className="harness-badge">
            <ShieldCheck size={16} />
            <span>Festes Raster. Geprüfter Skin.</span>
            <span className="tag">V4</span>
          </div>
          <div className="section-label spaced">
            WAS SOLL SICH VERÄNDERN?
            <button
              className="text-button"
              disabled={frozen}
              onClick={() => setParts(parts.length === 6 ? [] : [...PARTS])}
            >
              {parts.length === 6 ? "Keine" : "Alle"}
            </button>
          </div>
          <div className="body-selection">
            {PARTS.map((p) => (
              <button
                key={p}
                disabled={frozen}
                className={parts.includes(p) ? "selected" : ""}
                aria-pressed={parts.includes(p)}
                onClick={() => togglePart(p)}
              >
                <span className="checkbox">
                  {parts.includes(p) && <Check size={11} />}
                </span>
                {PART_LABELS[p]}
              </button>
            ))}
          </div>
          <label className="generation-layer-label">
            KI bearbeitet
            <select
              aria-label="KI-Schichten"
              disabled={frozen}
              value={generationLayer}
              onChange={(e) =>
                setGenerationLayer(e.target.value as GenerationLayer)
              }
            >
              <option value="both">Beide Schichten · kompletter Skin</option>
              <option value="base">Nur Grundschicht</option>
              <option value="outer">Nur äußere Schicht</option>
            </select>
          </label>
          <StylePicker
            value={styleProfile}
            onChange={setStyleProfile}
            disabled={frozen}
          />
          <label className="generation-layer-label">
            Kleidungsdetails
            <select
              aria-label="Kleidungsdetails"
              disabled={frozen || !parts.some((p) => p !== "head")}
              value={clothingDetail}
              onChange={(e) =>
                setClothingDetail(e.target.value as typeof clothingDetail)
              }
            >
              <option value="simple">Einfach · große Farbflächen</option>
              <option value="shaded">Schattiert · Falten und Säume</option>
              <option value="detailed">
                Detailliert · Nähte, Kragen und Farbabstufungen
              </option>
            </select>
          </label>
          <label className="face-guide">
            <input
              type="checkbox"
              aria-label="Kleidung und Schuhe abgleichen"
              checked={clothingReview}
              disabled={
                frozen ||
                generationLayer === "outer" ||
                !parts.some((p) => p !== "head")
              }
              onChange={(e) => setClothingReview(e.target.checked)}
            />
            Kleidung und Schuhe abgleichen
          </label>
          <p className="microcopy">
            Ärmel, freie Unterarme und Schuhe erhalten passende Farben. Ein
            zusätzlicher KI-Aufruf; aufwendige Muster bei Bedarf ohne Abgleich
            erzeugen.
          </p>
          <label className="face-guide">
            <input
              type="checkbox"
              aria-label="Cap oder Mütze geschlossen halten"
              checked={closeHeadwear}
              disabled={frozen || !parts.includes("head")}
              onChange={(e) => setCloseHeadwear(e.target.checked)}
            />{" "}
            Cap/Mütze geschlossen halten
          </label>
          <label className="face-guide">
            <input
              type="checkbox"
              checked={effectiveHumanFace}
              disabled={frozen || !!activeStyle(styleProfile)}
              onChange={(e) => setHumanFace(e.target.checked)}
            />{" "}
            Menschliches Gesicht mit sichtbaren Augen
          </label>
          <label className="generation-layer-label">
            Gesichtsmethode
            <select
              aria-label="Gesichtsmethode"
              value={imageFaceAvailable ? faceMethod : "grid"}
              disabled={frozen || !imageFaceAvailable}
              onChange={(e) =>
                setFaceMethod(e.target.value as "grid" | "image")
              }
            >
              <option value="grid">Direktes Pixelraster</option>
              <option value="image">
                Bildentwurf → Pixelraster · experimentell
              </option>
            </select>
          </label>
          <label className="face-guide">
            <input
              type="checkbox"
              aria-label="Porträtanalyse und Gesichtsprüfung"
              checked={portraitAvailable && portraitDetails}
              disabled={frozen || !portraitAvailable}
              onChange={(e) => setPortraitDetails(e.target.checked)}
            />{" "}
            Merkmale analysieren & Gesicht nachprüfen
          </label>
          <p className="microcopy">
            {imageFaceAvailable
              ? `${(portraitAvailable && portraitDetails ? 3 : 1) + (faceMethod === "image" ? 1 : 0) + (clothingReviewActive ? 1 : 0)} kostenpflichtige API-Aufrufe. ${portraitAvailable && portraitDetails ? "Haut-, Haar- und Augenfarben ergänzen die Palette. Nach dem Raster folgt eine gezielte Gesichtskorrektur mit Kontrastprüfung." : "Direktes Raster ohne zusätzliche Merkmalsanalyse und KI-Nachprüfung."} ${faceMethod === "image" ? `${imageModel} liefert zusätzlich den Gesichtsentwurf.` : ""}`
              : `${clothingReviewActive ? 2 : 1} kostenpflichtige API-Aufrufe. Porträtanalyse und Bildentwurf benötigen ein Referenzbild und die Kopf-Grundschicht.`}
          </p>
          {preview?.result.portrait && (
            <details className="harness-details">
              <summary>Erkannte Porträtmerkmale</summary>
              <p>
                Haut <code>{preview.result.portrait.skinBase}</code> · Haare{" "}
                <code>{preview.result.portrait.hairBase}</code> · Augen{" "}
                <code>{preview.result.portrait.eyeColor}</code>
              </p>
              <p>
                {preview.result.portrait.hairstyle} ·{" "}
                {preview.result.portrait.facialHair}
              </p>
              <p>
                Brille: {preview.result.portrait.glasses}
                <br />
                Kopfbedeckung: {preview.result.portrait.headwear}
                <br />
                Narbe: {preview.result.portrait.scar}
              </p>
              <p>{preview.result.faceReview?.notes}</p>
            </details>
          )}
          {preview?.result.faceReview?.warnings.map((w) => (
            <p className="quality-warning" key={w}>
              {w}
            </p>
          ))}
          {preview?.result.stages && (
            <details className="harness-details">
              <summary>Laufzeit und Modell</summary>
              <p>
                {preview.result.provider} · {preview.result.pipeline} ·{" "}
                {(preview.result.elapsedMs / 1000).toFixed(1)} s gesamt
              </p>
              {preview.result.stages.map((s, i) => (
                <p key={i}>
                  {s.name}: {(s.elapsedMs / 1000).toFixed(1)} s ·{" "}
                  {s.output_tokens ?? "?"} Ausgabetoken, davon{" "}
                  {s.reasoning_tokens ?? "?"} Reasoning
                </p>
              ))}
            </details>
          )}
          {preview?.result.faceDraft && (
            <details className="harness-details">
              <summary>Gesichtsentwurf vor der Verkleinerung</summary>
              <img
                style={{ width: "100%", imageRendering: "pixelated" }}
                src={preview.result.faceDraft}
                alt="KI-Gesichtsentwurf vor Reduktion auf 8 mal 8 Pixel"
              />
            </details>
          )}
          <p className="selection-note">
            {selectedCount} freigegebene Pixel ·{" "}
            {generationLayer === "both"
              ? "Beide Schichten"
              : generationLayer === "base"
                ? "Grundschicht"
                : "Äußere Schicht"}
          </p>
          {preview &&
            qualityWarnings(preview.skin, preview.request).map((w) => (
              <p className="quality-warning" key={w}>
                {w}
              </p>
            ))}
          <label className="section-label spaced" htmlFor="prompt">
            DEINE BESCHREIBUNG
          </label>
          <textarea
            id="prompt"
            disabled={frozen}
            value={prompt}
            maxLength={4000}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Zum Beispiel: eine rote Ritterrüstung mit goldenen Kanten …"
          />
          <div className="prompt-suggestions">
            {["Rote Ritterrüstung", "Astronaut in Weiß"].map((s) => (
              <button
                disabled={frozen}
                key={s}
                onClick={() =>
                  setPrompt(
                    s +
                      ". Zusammenhängende Farben, klare Pixelgruppen und passende Details auf allen Seiten.",
                  )
                }
              >
                {s}
              </button>
            ))}
          </div>
          {reference ? (
            <div className="reference-preview">
              <img src={reference} alt="Referenzbild für die KI" />
              <div>
                <strong>{referenceName}</strong>
                <small>Wird an OpenAI übertragen</small>
              </div>
              <button
                disabled={frozen}
                className="icon-button"
                aria-label="Referenz entfernen"
                onClick={() => {
                  setReference(undefined);
                  setReferenceName("");
                }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              className="reference-drop"
              disabled={frozen}
              onClick={() => refInput.current?.click()}
            >
              <ImagePlus size={22} />
              <span>
                Referenzbild hinzufügen
                <small>Foto, Zeichnung oder Charakter · optional</small>
              </span>
              <Plus size={16} />
            </button>
          )}
          <button
            className="generate-button"
            disabled={frozen || !parts.length || !prompt.trim()}
            onClick={() => generate()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {hasKey && model
              ? "Mit KI generieren"
              : "KI verbinden & generieren"}
            <ChevronRight size={17} />
          </button>
          <p className="cost-note">
            OpenAI · eigener API-Key · kostenpflichtige Anfrage
            <br />
            Übertragen: Prompt, Palette, Skin-Raster
            {reference ? " und Referenzbild" : ""}.<br />
            Keine automatischen Wiederholungen.
          </p>
        </aside>
      </main>
      <footer className="status-bar">
        <span role="status">{message}</span>
        <code>{hover}</code>
      </footer>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".png,.skinforge,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void attempt(() => importFile(f));
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={refInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void attempt(async () => {
              setReference(await referenceOf(f));
              setReferenceName(f.name);
            });
          e.target.value = "";
        }}
      />
      {newDialog && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!newSaving) setNewDialog(false);
          }}
        >
          <section
            className="settings-modal new-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !newSaving) {
                e.preventDefault();
                setNewDialog(false);
              }
              if (e.key === "Tab") {
                const buttons = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <h2 id="new-project-title">Aktuellen Skin speichern?</h2>
            <p>
              Vor dem Erstellen eines neuen Skins kannst du „{name}“ als
              Projektdatei speichern. Die neue Figur ist unbemalt.
            </p>
            {newError && (
              <p role="alert" className="quality-warning">
                {newError}
              </p>
            )}
            <div className="new-project-actions">
              <button
                autoFocus
                disabled={newSaving}
                onClick={() => setNewDialog(false)}
              >
                Abbrechen
              </button>
              <button disabled={newSaving} onClick={startNew}>
                Ohne Speichern fortfahren
              </button>
              <button
                className="primary"
                disabled={newSaving}
                onClick={() => void saveAndStartNew()}
              >
                {newSaving ? "Speichert …" : "Speichern und neu"}
              </button>
            </div>
          </section>
        </div>
      )}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Einstellungen schließen"
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <div className="ai-mark">
              <Settings2 size={22} />
            </div>
            <h2 id="settings-title">Deine KI-Verbindung</h2>
            <p>
              OpenAI Responses API mit strukturierten Pixelrastern. Der Key wird
              lokal mit Betriebssystemschutz gespeichert.
            </p>
            {!window.desktop && (
              <div className="notice">
                Die API-Anbindung ist in der Electron-App verfügbar. Starte sie
                mit <code>npm run dev</code>. Im Browser funktioniert der
                Editor.
              </div>
            )}
            <label>
              Modell-ID
              <input
                aria-label="Modell-ID"
                placeholder="Modell-ID aus deinem API-Konto"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  localStorage.setItem("skin-forge-model", e.target.value);
                }}
              />
            </label>
            <button
              onClick={() => {
                setModel("gpt-6-astra");
                localStorage.setItem("skin-forge-model", "gpt-6-astra");
              }}
            >
              Astra als Rastermodell wählen
            </button>
            <label>
              Reasoning-Aufwand
              <select
                aria-label="Reasoning-Aufwand"
                value={reasoningEffort}
                onChange={(e) =>
                  setReasoningEffort(e.target.value as typeof reasoningEffort)
                }
              >
                <option value="low">Niedrig · schneller Einstieg</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch · mehr Denkzeit</option>
                <option value="auto">Modellstandard</option>
              </select>
            </label>
            <label>
              Bildmodell-ID
              <input
                aria-label="Bildmodell-ID"
                value={imageModel}
                onChange={(e) => {
                  setImageModel(e.target.value);
                  localStorage.setItem(
                    "skin-forge-image-model",
                    e.target.value,
                  );
                }}
              />
            </label>
            <small>
              Astra/GPT-5 erzeugen das Raster; das Bildmodell erzeugt den
              optionalen Entwurf. Reasoning wird für GPT-5/6-Rastermodelle
              gesetzt. Benötigt Structured Outputs; für Referenzbilder
              zusätzlich Bildeingaben. Die Verfügbarkeit hängt von deinem
              API-Konto ab.
            </small>
            <label>
              API-Key{" "}
              <span>{hasKey ? "● gespeichert" : "noch nicht verbunden"}</span>
              <input
                aria-label="API-Key"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <div className="settings-actions">
              <button
                disabled={!window.desktop || !hasKey}
                onClick={() =>
                  attempt(async () => {
                    await window.desktop!.deleteKey();
                    setHasKey(false);
                    setMessage("API-Key gelöscht.");
                  })
                }
              >
                <Trash2 size={15} /> Key löschen
              </button>
              <button
                className="primary"
                disabled={!window.desktop || !key.trim()}
                onClick={() =>
                  attempt(async () => {
                    await window.desktop!.saveKey(key);
                    setKey("");
                    setHasKey(true);
                    setSettings(false);
                    setMessage(
                      "API-Key gespeichert. Mit „Mit KI generieren“ startest du den ersten kostenpflichtigen Test.",
                    );
                  })
                }
              >
                <ShieldCheck size={16} /> Key speichern
              </button>
            </div>
            <p className="microcopy">
              Direktes Raster: ein API-Aufruf. Porträtanalyse und abschließende
              Gesichtsprüfung ergänzen zwei Aufrufe. Der optionale Bildentwurf
              verwendet zusätzlich das gewählte Bildmodell. Der
              Kleidungsabgleich ergänzt einen Aufruf. Die Anzahl steht vor dem
              Generieren in der Werkstatt. Jeder fertige Skin durchläuft
              dieselbe lokale Prüfung. Ein Abbruch kann bereits entstandene
              Kosten nicht rückgängig machen.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
