import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(`artifacts/final-preview-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.SKIN_FORGE_DEV;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ansicht wechseln", exact: true })
    .click();
  await page.getByRole("button", { name: "Pixelraster", exact: true }).click();
  for (const [person, folder] of [
    ["Niko", "Niko_expansive_1788784716152"],
    ["Umut", "Umut_expansive_1788784351249"],
    ["Umut", "Umut_grid_v4_1788784424904"],
    ["Niko", "Niko_outfit_1788785063552"],
  ]) {
    await page
      .locator('input[accept=".png,.skinforge,.json"]')
      .setInputFiles(
        path.resolve(`Results/${folder}/${person}-hybrid.skinforge`),
      );
    await expect(page.getByRole("status")).toContainText("Importiert");
    await page.getByLabel("Körperteil im Flächeneditor").selectOption("head");
    await page.evaluate(() =>
      document
        .querySelectorAll(".left-panel,.right-panel")
        .forEach((el) => (el.scrollTop = 0)),
    );
    await page.screenshot({ path: `Results/${folder}/app-preview.png` });
  }
} finally {
  await app.close();
}
