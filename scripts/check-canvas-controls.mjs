import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
const env = {
  ...process.env,
  SKIN_FORGE_TEST_DATA: path.resolve(`artifacts/canvas-controls-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Grundfarben", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Farbe #ff0000", exact: true })
    .click();
  await page.getByRole("tab", { name: "Haut & Haare" }).click();
  await expect(
    page.getByRole("button", { name: "Farbe #ffe2cc", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Grundfarben", exact: true }).click();
  await page.getByLabel("Körperteil im Flächeneditor").selectOption("head");
  await page
    .getByRole("button", { name: "Äußere Schicht", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Äußere Schicht", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const canvas = page.getByTestId("face-canvas");
  await expect(canvas).toHaveAttribute("height", "128");
  await page.waitForTimeout(150);
  await canvas.scrollIntoViewIfNeeded();
  const face = await canvas.boundingBox();
  console.log(await page.evaluate(({x,y})=>({width:innerWidth,height:innerHeight,target:document.elementFromPoint(x,y)?.outerHTML.slice(0,150)}),{x:face.x+face.width*.56,y:face.y+face.height*.56}));
  await page.mouse.click(
    face.x + face.width * 0.56,
    face.y + face.height * 0.56,
  );
  await page.waitForTimeout(600);
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("skin-forge-project-v1")),
    );
  await page.screenshot({path:path.resolve("artifacts/layer-test.png")});
  const outer = await stored();
  console.log("red pixels",outer.pixels.flatMap((v,i)=>i%4===0&&v===255&&outer.pixels[i+1]===0&&outer.pixels[i+2]===0?[[i/4%64,Math.floor(i/4/64)]]:[]));
  const i = (12 * 64 + 44) * 4;
  expect(outer.pixels.slice(i, i + 4)).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Grundschicht", exact: true }).click();
  await page.mouse.click(
    face.x + face.width * 0.56,
    face.y + face.height * 0.56,
  );
  await page.waitForTimeout(600);
  const base = await stored();
  expect(base.pixels.slice((12 * 64 + 12) * 4, (12 * 64 + 12) * 4 + 4)).toEqual(
    [255, 0, 0, 255],
  );
  expect(base.pixels.slice(i, i + 4)).toEqual(outer.pixels.slice(i, i + 4));
  const viewport = page.getByTestId("viewport");
  console.log("Layers and color banks passed");
  for (const view of ["1", "3", "4"]) {
    console.log("Checking locked view", view);
    await page.getByLabel("Kameraansicht").selectOption(view);
    await expect(
      page.getByRole("button", { name: "Ansicht fixieren" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(400);
    const before = await viewport.screenshot();
    const b = await viewport.boundingBox();
    for (const button of ["right", "middle"]) {
      await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.5);
      await page.mouse.down({ button });
      await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.65, {
        steps: 8,
      });
      await page.mouse.up({ button });
    }
    await page.waitForTimeout(400);
    expect(
      (await viewport.screenshot()).equals(before),
      `locked view ${view}`,
    ).toBe(true);
  }
  const beforeZoom = await viewport.screenshot();
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(500);
  expect(
    (await viewport.screenshot()).equals(beforeZoom),
    "zoom changes view",
  ).toBe(false);
  await page.getByRole("button", { name: "Ansicht fixieren" }).click();
  const b = await viewport.boundingBox();
  const beforeOrbit = await viewport.screenshot();
  await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.5);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.7, {
    steps: 8,
  });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(600);
  expect(
    (await viewport.screenshot()).equals(beforeOrbit),
    "unlocked orbit changes view",
  ).toBe(false);
  await page.getByLabel("Kameraansicht").selectOption("1");
  await page.screenshot({
    path: path.resolve("artifacts/canvas-controls.png"),
  });
  console.log(
    "Canvas controls passed: color banks/red, independent base/outer painting, fixed front/left/right, blocked orbit/pan, zoom and unlock.",
  );
} finally {
  await app.close();
}
