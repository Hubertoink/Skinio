import { _electron as electron, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mockGrid, configureMock } from "./mock-grid.mjs";
const dir = path.resolve("artifacts");
await mkdir(dir, { recursive: true });
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.join(dir, `test-profile-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({ args: ["."], env, timeout: 30000 });
try {
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  await expect(page.locator('[data-testid="viewport"] canvas')).toBeVisible();
  expect(await page.evaluate(() => typeof window.desktop?.generate)).toBe(
    "function",
  );
  expect(await page.evaluate(() => window.desktop.keyStatus())).toBe(false);
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  await mockGrid(desktop);
  await configureMock(page);
  await page.waitForTimeout(600);
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("skin-forge-project-v1")),
    );
  const original = await stored();
  await page.getByRole("button", { name: "Keine", exact: true }).click();
  await page.getByRole("button", { name: "Oberkörper", exact: true }).click();
  await page.getByRole("button", { name: "Mit KI generieren" }).click();
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeVisible();
  expect((await stored()).pixels).toEqual(original.pixels);
  await expect(page.getByRole("status")).toContainText("Raster geprüft");
  await page.getByRole("button", { name: "Verwerfen", exact: true }).click();
  expect((await stored()).pixels).toEqual(original.pixels);
  await page.getByRole("button", { name: "Mit KI generieren" }).click();
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await page.waitForTimeout(500);
  const modified = await stored();
  expect(modified.pixels).not.toEqual(original.pixels);
  // Head and both legs must remain byte-for-byte unchanged in a torso-only operation.
  for (const [x, y, w, h] of [
    [0, 0, 64, 16],
    [0, 16, 16, 16],
    [0, 48, 32, 16],
  ]) {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) {
        const i = (py * 64 + px) * 4;
        expect(modified.pixels.slice(i, i + 4)).toEqual(
          original.pixels.slice(i, i + 4),
        );
      }
  }
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await page.waitForTimeout(500);
  expect((await stored()).pixels).toEqual(original.pixels);
  await page.getByRole("button", { name: "Vor", exact: true }).click();
  await page.waitForTimeout(500);
  expect((await stored()).pixels).toEqual(modified.pixels);
  // Malformed provider output goes through the same validator.
  await desktop.evaluate(() => {
    global.__badGrid = true;
  });
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Harness:");
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toHaveCount(0);
  await desktop.evaluate(() => {
    global.__badGrid = false;
  });
  // Paint on the 2D grid; one stroke must be one undo step.
  const canvas = page.getByTestId("face-canvas");
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 5, bounds.y + 5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 5, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect((await stored()).pixels).not.toEqual(modified.pixels);
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await page.waitForTimeout(500);
  expect((await stored()).pixels).toEqual(modified.pixels);
  // Exercise secure key persistence using a deliberately invalid test key, never network.
  await page
    .getByRole("button", { name: "KI-Einstellungen", exact: true })
    .click();
  const raster = page.getByLabel("Modell-ID", { exact: true });
  await expect(raster.locator("option", { hasText: "gpt-7" })).toHaveCount(1);
  await expect(raster.locator("option", { hasText: "gpt-realtime" })).toHaveCount(0);
  await expect(raster).toHaveValue("test-model");
  await raster.selectOption("gpt-7");
  await expect(page.getByLabel("Reasoning-Aufwand")).toHaveValue("auto");
  await page.getByLabel("Bildmodell-ID", { exact: true }).selectOption("gpt-image-3");
  await desktop.evaluate(() => { global.__modelsFail = true; });
  await page.getByRole("button", { name: "Modelle aktualisieren", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("HTTP 503");
  await expect(raster).toHaveValue("gpt-7");
  await desktop.evaluate(() => { global.__modelsFail = false; });
  await page.getByRole("button", { name: "Modelle aktualisieren", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("1 Rastermodelle und 1 Bildmodelle");
  await raster.selectOption("__manual");
  await page.getByLabel("Eigene Modell-ID", { exact: true }).fill("test-model");
  await page
    .getByLabel("API-Key", { exact: true })
    .fill("sk-local-test-only-not-a-real-key");
  await page
    .getByRole("button", { name: "Key speichern", exact: true })
    .click();
  await expect(page.getByLabel("API-Key", { exact: true })).toHaveValue("");
  await expect(page.getByRole("dialog")).toContainText("1 Rastermodelle und 1 Bildmodelle");
  expect(await page.evaluate(() => window.desktop.keyStatus())).toBe(true);
  await page.getByRole("button", { name: "Einstellungen schließen" }).click();
  await page.getByRole("button", { name: "KI-Einstellungen", exact: true }).click();
  await expect(page.getByLabel("Modell-ID", { exact: true })).toHaveValue("test-model");
  await expect(page.getByLabel("Bildmodell-ID", { exact: true })).toHaveValue("gpt-image-3");
  await page.getByRole("button", { name: "Key löschen", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Speichere deinen API-Key");
  await expect(page.getByRole("button", { name: "Modelle aktualisieren", exact: true })).toBeDisabled();
  await page.getByLabel("API-Key", { exact: true }).fill("sk-local-test-only-not-a-real-key");
  await page.getByRole("button", { name: "Key speichern", exact: true }).click();
  await expect(page.getByLabel("API-Key", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Einstellungen schließen" }).click();

  // Native save dialog is redirected into an isolated test folder.
  const output = path.join(dir, "export-test.png");
  await desktop.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  await page.getByRole("button", { name: "PNG exportieren" }).click();
  await expect(page.getByRole("status")).toContainText("PNG exportiert");
  const png = await readFile(output);
  expect(png.readUInt32BE(16)).toBe(64);
  expect(png.readUInt32BE(20)).toBe(64);
  // Import the real example from the user's workspace; switch geometry and render.
  await page
    .locator('input[accept=".png,.skinforge,.json"]')
    .setInputFiles(output);
  await expect(page.getByRole("status")).toContainText("Importiert");
  await page.getByLabel("Körpermodell").selectOption("slim");
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await page.evaluate(() =>
    document.querySelectorAll(".left-panel,.right-panel").forEach((el) => {
      el.scrollTop = 0;
    }),
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, "skin-forge-desktop.png") });
  await page.getByRole("button", { name: "Mit KI generieren" }).click();
  await page.evaluate(() =>
    document.querySelectorAll(".left-panel,.right-panel").forEach((el) => {
      el.scrollTop = 0;
    }),
  );
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(dir, "skin-forge-harness-preview.png"),
  });
  await page.evaluate(() => window.desktop.deleteKey());
  expect(await page.evaluate(() => window.desktop.keyStatus())).toBe(false);
  expect(errors).toEqual([]);
  console.log(
    "Electron smoke test passed: rendering, IPC isolation, palette grid, preview/reject/accept, mask, undo/redo, painting, invalid JSON, secure key, PNG export, PNG reimport, slim model.",
  );
} catch (error) {
  const page = desktop.windows()[0];
  if (page) {
    await page
      .screenshot({ path: path.join(dir, "failure.png") })
      .catch(() => {});
  }
  console.error(
    String(error).slice(0, 1200),
    error.stack
      ?.split("\n")
      .filter((line) => line.includes("smoke.mjs"))
      .join("\n"),
  );
  process.exitCode = 1;
} finally {
  await desktop.close();
}
