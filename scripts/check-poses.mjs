import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve("artifacts/pose-test-profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("Pose", { exact: true }).waitFor();
  const before = await page.getByTestId("viewport").boundingBox();
  await page
    .getByRole("button", { name: "KI-Panel einklappen", exact: true })
    .click();
  await expect(page.locator("#ai-panel")).toBeHidden();
  const after = await page.getByTestId("viewport").boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 250);
  const options = await page
    .getByLabel("Pose", { exact: true })
    .locator("option")
    .evaluateAll((o) => o.map((x) => x.value));
  expect(options).toHaveLength(16);
  for (const model of ["classic", "slim"]) {
    await page.getByLabel("Körpermodell", { exact: true }).selectOption(model);
    for (const pose of options) {
      await page.getByLabel("Pose", { exact: true }).selectOption(pose);
      await page.waitForTimeout(90);
    }
  }

  await page
    .getByLabel("Körpermodell", { exact: true })
    .selectOption("classic");
  await page.getByLabel("Kameraansicht", { exact: true }).selectOption("1");
  for (const pose of ["t-pose", "jump", "peace", "dab"]) {
    await page.getByLabel("Pose", { exact: true }).selectOption(pose);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `artifacts/pose-${pose}.png` });
  }
  const output = path.resolve("artifacts/pose-export.png");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  await page
    .getByRole("button", { name: "Pose exportieren", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "transparentes PNG exportiert",
  );
  const png = await readFile(output);
  expect(png.readUInt32BE(16)).toBeGreaterThan(1000);
  const info = await page.evaluate(
    async (data) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
      let clear = 0,
        opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) clear++;
        if (pixels[i] === 255) opaque++;
      }
      return { clear, opaque, corner: pixels[3] };
    },
    "data:image/png;base64," + png.toString("base64"),
  );
  expect(info.corner).toBe(0);
  expect(info.clear).toBeGreaterThan(info.opaque);
  expect(info.opaque).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Pixelraster", exact: true }).click();
  await page.getByRole("button", { name: "Pose exportieren", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await readFile(output)).toEqual(png);
  await page.getByLabel("Kameraansicht", { exact: true }).selectOption("3");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Pose exportieren", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await readFile(output)).not.toEqual(png);
  await page.getByRole("button", { name: "PNG exportieren", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("64 × 64 PNG exportiert");
  const skinPng = await readFile(output);
  expect(skinPng.readUInt32BE(16)).toBe(64);
  expect(skinPng.readUInt32BE(20)).toBe(64);

  await page.getByLabel("Pose", { exact: true }).selectOption("squat");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/poses-squat.png" });
  await page
    .getByRole("button", { name: "KI-Panel ausklappen", exact: true })
    .click();
  await expect(page.locator("#ai-panel")).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: panel resizing, reopen, all 16 poses in classic and slim, transparent PNG export, no runtime errors.",
  );
} finally {
  await app.close();
}
