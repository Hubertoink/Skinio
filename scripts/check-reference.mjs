import { _electron as electron, expect } from "@playwright/test";
import { mkdir, writeFile, open } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(`artifacts/reference-test-${Date.now()}`);
await mkdir(dir, { recursive: true });
const png = path.join(dir, "reference.png");
await writeFile(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=", "base64"));
const large = path.join(dir, "large.png");
const handle = await open(large, "w");
await handle.truncate(20_000_001);
await handle.close();
const invalid = path.join(dir, "invalid.png");
await writeFile(invalid, "not an image");
const env = { ...process.env, SKIN_FORGE_TEST_DATA: path.join(dir, "profile") };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  ...(process.argv[2] ? { executablePath: path.resolve(process.argv[2]), args: [] } : { args: ["."] }),
  env,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForLoadState("domcontentloaded");
  expect(new URL(page.url()).protocol).toBe("file:");
  await app.evaluate(({ dialog, BrowserWindow }) => {
    global.__referenceCalls = 0;
    dialog.showOpenDialog = async (parent, options) => {
      if (!(parent instanceof BrowserWindow)) throw new Error("Missing parent window");
      if (options.properties.join() !== "openFile") throw new Error("Wrong dialog mode");
      global.__referenceCalls++;
      return { canceled: !global.__referencePath, filePaths: global.__referencePath ? [global.__referencePath] : [] };
    };
  });
  const button = page.getByRole("button", { name: /Referenzbild hinzufügen/ });
  await button.click();
  await expect(button).toBeEnabled();
  expect(await app.evaluate(() => global.__referenceCalls)).toBe(1);
  await expect(page.getByAltText("Referenzbild für die KI")).toHaveCount(0);

  for (const file of [large, invalid, png, png]) {
    await app.evaluate((_, file) => { global.__referencePath = file; }, file);
    await button.click();
    await expect(button.or(page.getByRole("button", { name: "Referenz entfernen" }))).toBeEnabled();
    if (file === large) {
      await expect(page.getByRole("status")).toContainText("maximal 20 MB");
    } else if (file === invalid) {
      await expect(page.getByAltText("Referenzbild für die KI")).toHaveCount(0);
    } else {
      const image = page.getByAltText("Referenzbild für die KI");
      await expect(image).toBeVisible();
      expect(await image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(page.locator(".reference-preview")).toContainText("reference.png");
      await page.getByRole("button", { name: "Referenz entfernen" }).click();
    }
  }
  expect(await app.evaluate(() => global.__referenceCalls)).toBe(5);
  expect(errors).toEqual([]);
  console.log("PASS: file:// build, native dialog IPC and parent, cancel, size limit, invalid image, repeat import, decoded preview.");
} finally {
  await app.close();
}
