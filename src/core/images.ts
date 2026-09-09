import { normalizeSkin, detectSkinModel, type Skin, type Model } from "./skin";
import { extractPalette } from "./palette";
export async function paletteFromReference(url: string, limit: number) {
  const img = await loadImage(url),
    canvas = document.createElement("canvas");
  const scale = Math.min(1, 256 / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return extractPalette(
    ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    limit,
  );
}
export function skinCanvas(skin: Skin) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  c.getContext("2d")!.putImageData(
    new ImageData(new Uint8ClampedArray(skin.pixels), 64, 64),
    0,
    0,
  );
  return c;
}
export function pngOf(skin: Skin) {
  return skinCanvas(normalizeSkin(skin)).toDataURL("image/png");
}
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}
export async function importPNG(file: File, model: Model): Promise<Skin> {
  if (file.size > 5_000_000)
    throw new Error("Skin-Datei ist zu groß (maximal 5 MB).");
  const url = URL.createObjectURL(file);
  try {
    return await importSkinURL(url, model);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function importSkinURL(url: string, model: Model): Promise<Skin> {
  const img = await loadImage(url);
  if (img.width !== 64 || img.height !== 64)
    throw new Error(
      "Bitte einen 64 × 64 PNG-Skin importieren. Legacy- und HD-Skins sind noch nicht unterstützt.",
    );
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  c.getContext("2d")!.drawImage(img, 0, 0);
  const pixels = c.getContext("2d")!.getImageData(0, 0, 64, 64).data;
  return normalizeSkin({
    model: detectSkinModel(pixels) ?? model,
    pixels,
  });
}
export async function referenceOf(file: File): Promise<string> {
  if (file.size > 20_000_000)
    throw new Error("Referenzbild darf maximal 20 MB groß sein.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function saveFile(
  kind: "png" | "project" | "json",
  name: string,
  data: string,
) {
  if (window.desktop) return window.desktop.saveFile(kind, name, data);
  const url =
    kind === "png"
      ? data
      : URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.${kind === "project" ? "skinforge" : kind}`;
  a.click();
  if (kind !== "png") setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
