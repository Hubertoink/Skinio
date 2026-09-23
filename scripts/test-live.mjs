// Explicit opt-in: four portrait/outfit calls, five with --image; encrypted app key only.
import { _electron as electron, expect } from "@playwright/test";
import { mkdir, copyFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
if (!process.argv.includes("--paid"))
  throw new Error(
    "Pass --paid to authorize four portrait/outfit API calls (five with --image).",
  );
const person = process.argv.includes("--umut") ? "Umut" : "Niko";
const method = process.argv.includes("--image") ? "image" : "grid";
const folder = path.resolve(`Results/${person}_${method}_${Date.now()}`);
const profile = path.join(folder, "profile");
await mkdir(profile, { recursive: true });
await copyFile(
  path.join(process.env.APPDATA, "skin-forge", "credentials.bin"),
  path.join(profile, "credentials.bin"),
);
const env = { ...process.env, SKIN_FORGE_TEST_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.SKIN_FORGE_DEV;
let app;
try {
  app = await electron.launch({ args: ["."], env });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "KI-Einstellungen", exact: true })
    .click();
  await page.getByLabel("Modell-ID", { exact: true }).selectOption("__manual");
  await page.getByLabel("Eigene Modell-ID", { exact: true }).fill("gpt-5.6-luna");
  await page
    .getByRole("button", { name: "Einstellungen schließen", exact: true })
    .click();
  await page.getByLabel("KI-Schichten").selectOption("both");
  await page
    .locator("#prompt")
    .fill(
      person === "Niko"
        ? "Erstelle aus dem Bild von mir bitte einen Skin. Ich trage eine Basecap, rote Haare (Zopf) und einen markanten Bart. Weißes T-Shirt und blaue Jeans."
        : "Erstelle einen wiedererkennbaren Skin nach diesem Foto: kurze dunkelbraune seitlich gelegte Haare, leichter Stoppelbart und Schnurrbart. Hellblaues offenes Hemd über schwarzem T-Shirt, blaue Jeans und schwarze Schuhe.",
    );
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(path.resolve(`Example/${person}_Test.jpg`));
  await expect(page.locator(".reference-preview img")).toBeVisible();
  await page
    .getByLabel("Gesichtsmethode", { exact: true })
    .selectOption(method);
  console.log(`Starting paid test: ${person}, ${method}, Luna, both layers.`);
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(page.locator(".generation-overlay")).toBeVisible();
  await page
    .locator(".generation-overlay")
    .waitFor({ state: "hidden", timeout: 430000 });
  const status = await page.getByRole("status").innerText();
  console.log(status);
  if (!(await page.locator(".preview-bar").count()))
    throw new Error("No valid preview returned: " + status);
  await page
    .getByRole("button", { name: "Ansicht wechseln", exact: true })
    .click();
  await page.getByLabel("Körperteil im Flächeneditor").selectOption("head");
  await page.evaluate(() =>
    document.querySelectorAll(".left-panel,.right-panel").forEach((el) => {
      el.scrollTop = 0;
    }),
  );
  await page.screenshot({
    path: path.join(folder, "preview.png"),
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  const outputPath = path.join(folder, `${person}-${method}.png`);
  await app.evaluate(({ dialog }, outputPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: outputPath,
    });
  }, outputPath);
  await page.getByRole("button", { name: "PNG exportieren" }).click();
  await expect(page.getByRole("status")).toContainText("PNG exportiert");
  const projectPath = path.join(folder, `${person}-${method}.skinforge`);
  await app.evaluate(({ dialog }, outputPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: outputPath,
    });
  }, projectPath);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Projektdatei gespeichert",
  );
  console.log(JSON.stringify({ folder, status, projectPath, outputPath }));
} finally {
  if (app) await app.close();
  await unlink(path.join(profile, "credentials.bin")).catch(() => {});
}
