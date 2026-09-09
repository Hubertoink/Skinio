// Explicit --paid: reuse a saved image draft; three analysis/raster/review calls.
import { app, nativeImage, safeStorage } from "electron";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateOpenAI } from "../electron/provider";
import {
  applyPatch,
  qualityWarnings,
  type GenerationRequest,
} from "../src/core/harness";
import { createSkin, projectOf } from "../src/core/skin";
import { extractPalette } from "../src/core/palette";
// Match the app's encryption context; no renderer or project is opened here.
app.setName("skin-forge");
app.setPath("userData", path.join(process.env.APPDATA!, "skin-forge"));

async function run() {
  if (!process.argv.includes("--paid"))
    throw new Error(
      "Explicit --paid required: three analysis/raster/review API calls.",
    );
  const person = process.argv.includes("--umut") ? "Umut" : "Niko";
  const source =
    person === "Umut"
      ? "Results/Umut_image_1788780543121"
      : "Results/Niko_image_1788780460710";
  const previous = JSON.parse(
    await readFile(path.join(source, "report.json"), "utf8"),
  );
  const image = nativeImage.createFromPath(
    path.resolve(`Example/${person}_Test.jpg`),
  );
  const { width, height } = image.getSize();
  const reference = image
    .resize({
      width: Math.round(width * Math.min(1, 1024 / Math.max(width, height))),
      height: Math.round(height * Math.min(1, 1024 / Math.max(width, height))),
    })
    .toJPEG(88)
    .toString("base64");
  let skin = createSkin(previous.model);
  if (process.argv.includes("--outfit")) {
    const saved = JSON.parse(
      await readFile(
        "Results/Niko_expansive_1788784716152/Niko-hybrid.skinforge",
        "utf8",
      ),
    );
    skin = { model: saved.model, pixels: new Uint8ClampedArray(saved.pixels) };
  }
  const expansive = process.argv.includes("--expansive");
  const samples = image.resize({ width: 256 }).toBitmap();
  for (let i = 0; i < samples.length; i += 4)
    [samples[i], samples[i + 2]] = [samples[i + 2], samples[i]];
  let request: GenerationRequest = {
    model: skin.model,
    pixels: Array.from(skin.pixels),
    parts: process.argv.includes("--outfit")
      ? ["torso", "rightArm", "leftArm", "rightLeg", "leftLeg"]
      : previous.parts,
    layer: previous.layer,
    palette: expansive ? extractPalette(samples, 256) : previous.palette,
    paletteLimit: expansive ? 256 : 64,
    clothingDetail: "detailed",
    clothingReview: process.argv.includes("--outfit"),
    closeHeadwear: true,
    humanFace: true,
    faceMethod:
      process.argv.includes("--grid") || process.argv.includes("--outfit")
        ? "grid"
        : "image",
    portraitDetails: !process.argv.includes("--outfit"),
    prompt: process.argv.includes("--outfit")
      ? "Rote Haare, lila Basecap, weißes T-Shirt, schwarze Hose, weiße Sneaker."
      : previous.prompt,
    reference: `data:image/jpeg;base64,${reference}`,
  };
  const key = safeStorage.decryptString(
    await readFile(
      path.join(process.env.APPDATA!, "skin-forge", "credentials.bin"),
    ),
  );
  let paidCalls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    if (url === "https://api.openai.com/v1/images/edits")
      return new Response(
        JSON.stringify({
          data: [{ b64_json: previous.faceDraft.split(",")[1] }],
        }),
      );
    if (
      url !== "https://api.openai.com/v1/responses" ||
      ++paidCalls > (request.clothingReview ? 2 : 3)
    )
      throw new Error("The bounded paid-call limit was exceeded.");
    return fetch(url, init);
  };
  console.log(
    `${person}: reusing image draft; Luna analysis, raster and final review.`,
  );
  const result = await generateOpenAI(
    request,
    "gpt-5.6-luna",
    key,
    AbortSignal.timeout(240000),
    fetcher,
  );
  request = { ...request, palette: result.palette ?? request.palette };
  const applied = applyPatch(skin, request, result.patch);
  const folder = path.resolve(
    `Results/${person}_${process.argv.includes("--outfit") ? "outfit" : process.argv.includes("--grid") ? "grid_v4" : expansive ? "expansive" : "hybrid"}_${Date.now()}`,
  );
  await mkdir(folder, { recursive: true });
  const bitmap = Buffer.from(applied.skin.pixels);
  for (let i = 0; i < bitmap.length; i += 4)
    [bitmap[i], bitmap[i + 2]] = [bitmap[i + 2], bitmap[i]];
  await writeFile(
    path.join(folder, `${person}-hybrid.png`),
    nativeImage.createFromBitmap(bitmap, { width: 64, height: 64 }).toPNG(),
  );
  await writeFile(
    path.join(folder, `${person}-hybrid.skinforge`),
    JSON.stringify(projectOf(applied.skin, result.patch.name, request.palette)),
  );
  await writeFile(
    path.join(folder, "face-draft.png"),
    Buffer.from(previous.faceDraft.split(",")[1], "base64"),
  );
  const report = {
    harnessVersion: 4,
    ...result,
    model: request.model,
    parts: request.parts,
    layer: request.layer,
    humanFace: true,
    faceMethod:
      process.argv.includes("--grid") || process.argv.includes("--outfit")
        ? "grid"
        : "image",
    paletteLimit: request.paletteLimit,
    clothingDetail: request.clothingDetail,
    closeHeadwear: request.closeHeadwear,
    palette: request.palette,
    prompt: request.prompt,
    referenceIncluded: true,
    reusedDraftFrom: request.faceMethod === "image" ? source : undefined,
    paidCalls,
    changedPixels: applied.changed,
    validated: true,
    qualityWarnings: qualityWarnings(applied.skin, request),
  };
  await writeFile(
    path.join(folder, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      folder,
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      warnings: report.qualityWarnings,
    }),
  );
}
app
  .whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.message);
    app.exit(1);
  });
