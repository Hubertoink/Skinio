import { _electron as electron, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
const dir = path.resolve(`artifacts/new-${Date.now()}`);
await mkdir(dir, { recursive: true });
const env = { ...process.env, SKIN_FORGE_TEST_DATA: dir };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("skin-forge-project-v1")),
    );
  await expect(page.getByLabel("Projektname")).toHaveValue("Neuer Skin");
  await expect(page.getByText("Raster-Demo starten")).toHaveCount(0);
  await expect(page.getByText("Skin aus Example öffnen")).toHaveCount(0);
  await page.getByLabel("Projektname").fill("Mein Entwurf");
  await page.waitForTimeout(600);
  const original = await stored();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await stored()).toEqual(original);
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page
    .getByRole("button", { name: "Speichern und neu", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await stored()).toEqual(original);
  const output = path.join(dir, "saved.skinforge");
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => {
      throw new Error("Test: Speichern fehlgeschlagen");
    };
  });
  await page
    .getByRole("button", { name: "Speichern und neu", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Speichern fehlgeschlagen",
  );
  expect(await stored()).toEqual(original);
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, output);
  await page
    .getByRole("button", { name: "Speichern und neu", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Projektname")).toHaveValue("Neuer Skin");
  const { workspace, ...originalProject } = original;
  expect(JSON.parse(await readFile(output, "utf8"))).toEqual(originalProject);
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(path.resolve("Example/Niko_Test.jpg"));
  await page.getByLabel("Palettengröße").selectOption("256");
  await page
    .getByRole("button", { name: "Farben aus Referenzbild übernehmen" })
    .click();
  await expect(page.getByRole("status")).toContainText("Farben lokal");
  await page.waitForTimeout(600);
  expect((await stored()).palette.length).toBeGreaterThan(64);
  expect((await stored()).palette.length).toBeLessThanOrEqual(256);
  for (const [width, height] of [
    [1200, 800],
    [1600, 1000],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, { width, height }) =>
        BrowserWindow.getAllWindows()[0].setSize(width, height),
      { width, height },
    );
    await page.waitForTimeout(300);
    const paletteBox = await page.locator(".palette").boundingBox();
    const pickerBox = (await page.locator(".color-picker").count())
      ? await page.locator(".color-picker").boundingBox()
      : null;
    expect(paletteBox.height).toBeGreaterThan(200);
    if (pickerBox)
      expect(pickerBox.y).toBeGreaterThanOrEqual(
        paletteBox.y + paletteBox.height,
      );
    await expect(
      page.getByRole("toolbar", { name: "Malwerkzeuge" }),
    ).toBeVisible();
    const stage = await page.locator(".stage").boundingBox();
    const toolbar = await page
      .getByRole("toolbar", { name: "Malwerkzeuge" })
      .boundingBox();
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(
      stage.y + stage.height,
    );
    expect(toolbar.x).toBeGreaterThanOrEqual(stage.x);
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(
      stage.x + stage.width,
    );
    await expect(
      page.getByRole("button", { name: "Stift", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: path.join(dir, `palette-${width}.png`) });
  }
  await page.getByLabel("Projektname").fill("Zweiter Entwurf");
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page.getByRole("button", { name: "Ohne Speichern fortfahren" }).click();
  await expect(page.getByLabel("Projektname")).toHaveValue("Neuer Skin");
  await expect(
    page.getByRole("button", { name: "Zurück", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#prompt")).toHaveValue("");
  console.log(
    "New project passed: cancel, canceled save, saved contents, discard/reset, local 256-color extraction.",
  );
} finally {
  await app.close();
}
