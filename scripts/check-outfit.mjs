import { _electron as electron, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
const folder = "Results/Niko_outfit_1788785063552";
const fixture = JSON.parse(await readFile(`${folder}/report.json`, "utf8"));
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(`artifacts/outfit-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  await expect(page.getByLabel("Projektname")).toBeVisible();
  await page.evaluate(async () => {
    await window.desktop.saveKey("sk-local-mock-key");
    localStorage.setItem("skin-forge-model", "test-model");
  });
  await page.reload();
  await page
    .locator('input[accept=".png,.skinforge,.json"]')
    .setInputFiles(path.resolve(`${folder}/Niko-hybrid.skinforge`));
  await expect(page.getByRole("status")).toContainText("Importiert");
  await page.getByRole("button", { name: "Kopf", exact: true }).click();
  await page.locator("#prompt").fill(fixture.prompt);
  await expect(page.getByLabel("Kleidung und Schuhe abgleichen")).toBeChecked();
  await page.waitForTimeout(600);
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("skin-forge-project-v1")),
    );
  const before = await stored();
  await app.evaluate((_electron, fixture) => {
    global.calls = [];
    global.fetch = async (url, init) => {
      if (url !== "https://api.openai.com/v1/responses")
        throw Error("No network");
      const name = JSON.parse(init.body).text.format.name;
      global.calls.push(name);
      const result = name === "outfit_plan" ? fixture.outfit : fixture.patch;
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(result) }],
            },
          ],
        }),
      );
    };
  }, fixture);
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeVisible();
  expect(await stored()).toEqual(before);
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await page.waitForTimeout(600);
  expect((await stored()).pixels.slice(0, 4096)).toEqual(
    before.pixels.slice(0, 4096),
  );
  expect(await app.evaluate(() => global.calls)).toEqual([
    "outfit_plan",
    "minecraft_skin_grid",
  ]);
  const pixels = (await stored()).pixels;
  for (const [x, y] of [
    [5, 30],
    [21, 62],
  ])
    expect(
      Math.min(...pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)),
    ).toBeGreaterThan(210);
  await page.evaluate(() => window.desktop.deleteKey());
  console.log(
    "Outfit Electron passed: two stages, exact palette, preview atomicity, unchanged head, white sneaker pixels.",
  );
} finally {
  await app.close();
}
