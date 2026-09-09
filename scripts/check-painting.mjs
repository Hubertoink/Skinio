import { _electron as electron, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import path from "node:path";
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(
    `artifacts/painting-profile-${Date.now()}`,
  ),
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
  await page.waitForTimeout(600);
  const bounds = await page.getByTestId("viewport").boundingBox();
  const camera = new PerspectiveCamera(
    35,
    bounds.width / bounds.height,
    0.1,
    500,
  );
  camera.position.set(0, 17, 76);
  camera.lookAt(0, 16, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(-2.5, 21.5, 2).project(camera);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("skin-forge-project-v1")).pixels,
  );
  await page.mouse.click(
    bounds.x + ((point.x + 1) / 2) * bounds.width,
    bounds.y + ((1 - point.y) / 2) * bounds.height,
  );
  await page.waitForTimeout(600);
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("skin-forge-project-v1")).pixels,
  );
  // Independently known torso front UV origin (20,20), local pixel (1,2).
  const pixelIndex = (22 * 64 + 21) * 4;
  expect(after.slice(pixelIndex, pixelIndex + 4)).toEqual([232, 198, 106, 255]);
  const changed = after.reduce((n, v, i) => n + (v !== before[i] ? 1 : 0), 0);
  expect(changed).toBe(3);
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await page.waitForTimeout(600);
  const restored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("skin-forge-project-v1")).pixels,
  );
  expect(restored.every((v, i) => v === before[i])).toBe(true);
  console.log(
    "3D painting passed: projected torso click writes exactly PNG pixel (21,22), and stroke undo restores the original.",
  );
} finally {
  await app.close();
}
