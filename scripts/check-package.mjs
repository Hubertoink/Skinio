import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
import { mockGrid, configureMock } from "./mock-grid.mjs";
import { readFile } from "node:fs/promises";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(
    `artifacts/packaged-profile-${Date.now()}`,
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.SKIN_FORGE_DEV;
const app = await electron.launch({
  executablePath: path.resolve(
    `release/${version}/win-${process.arch}-unpacked/Skin Forge.exe`,
  ),
  args: [],
  env,
});
try {
  const page = await app.firstWindow();
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.desktop.keyStatus())).toBe(false);
  await mockGrid(app);
  await configureMock(page);
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeVisible();
  console.log(
    "Packaged app passed: ASAR assets, preload/IPC, rendering and validated grid preview.",
  );
} finally {
  await app.close();
}
