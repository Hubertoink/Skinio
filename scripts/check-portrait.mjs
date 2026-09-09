import { _electron as electron, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
const fixture = JSON.parse(
  await readFile("Results/Niko_expansive_1788784345871/report.json", "utf8"),
);
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(`artifacts/portrait-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.SKIN_FORGE_DEV;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await window.desktop.saveKey("sk_only_a_local_mock_key");
    localStorage.setItem("skin-forge-model", "gpt-5.6-luna");
  });
  await page.reload();
  await page.getByLabel("Kleidung und Schuhe abgleichen").uncheck();
  await page
    .locator('input[accept=".png,.skinforge,.json"]')
    .setInputFiles(
      path.resolve(
        "Results/Niko_expansive_1788784345871/Niko-hybrid.skinforge",
      ),
    );
  await expect(page.getByRole("status")).toContainText("Importiert");
  await page
    .locator("#prompt")
    .fill("Testportrait mit Cap, roten Haaren und Bart");
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(path.resolve("Example/Niko_Test.jpg"));
  await page
    .getByLabel("Gesichtsmethode", { exact: true })
    .selectOption("image");
  await expect(
    page.getByLabel("Porträtanalyse und Gesichtsprüfung"),
  ).toBeChecked();
  await page.evaluate(() => {
    window.testStages = [];
    window.desktop.onGenerationProgress((s) => window.testStages.push(s));
  });
  await app.evaluate((_electron, fixture) => {
    global.testCalls = [];
    global.breakReview = false;
    global.fetch = async (url, init) => {
      if (url === "https://api.openai.com/v1/images/edits") {
        global.testCalls.push("image");
        return new Response(
          JSON.stringify({
            data: [{ b64_json: fixture.faceDraft.split(",")[1] }],
          }),
        );
      }
      if (url !== "https://api.openai.com/v1/responses")
        throw new Error("No network allowed in test");
      const name = JSON.parse(init.body).text.format.name;
      global.testCalls.push(name);
      let result =
        name === "portrait_features"
          ? fixture.portrait
          : name === "minecraft_skin_grid"
            ? fixture.beforeReview
            : {
                layers: fixture.faceReview.layers,
                eyeRow: fixture.faceReview.eyeRow,
                leftEyeX: fixture.faceReview.leftEyeX,
                rightEyeX: fixture.faceReview.rightEyeX,
                notes: fixture.faceReview.notes,
              };
      if (name === "face_review" && global.breakReview)
        result = { ...result, layers: {} };
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(result) }],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    };
  }, fixture);
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("skin-forge-project-v1")),
  );
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(page.locator(".preview-bar")).toBeVisible({ timeout: 30000 });
  expect(await app.evaluate(() => global.testCalls)).toEqual([
    "portrait_features",
    "image",
    "minecraft_skin_grid",
    "face_review",
  ]);
  expect(await page.evaluate(() => window.testStages)).toEqual([
    "analysis",
    "image",
    "grid",
    "review",
  ]);
  expect(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("skin-forge-project-v1")),
      )
    ).palette,
  ).toEqual(before.palette);
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect
    .poll(async () =>
      JSON.stringify(
        (
          await page.evaluate(() =>
            JSON.parse(localStorage.getItem("skin-forge-project-v1")),
          )
        ).palette,
      ),
    )
    .toBe(JSON.stringify(fixture.palette));
  const accepted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("skin-forge-project-v1")),
  );
  await app.evaluate(() => {
    global.breakReview = true;
  });
  await page
    .getByRole("button", { name: "Mit KI generieren", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Merkmalsmasken");
  expect(await page.locator(".preview-bar").count()).toBe(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("skin-forge-project-v1")),
    ),
  ).toEqual(accepted);
  await page.evaluate(() => window.desktop.deleteKey());
  console.log(
    "Portrait Electron integration passed: 4 stages, feature masks, palette commits only with acceptance, atomic failure, zero real API calls.",
  );
} finally {
  await app.close();
}
