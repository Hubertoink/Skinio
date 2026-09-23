import { spawn, execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:net";
import path from "node:path";
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const debugPort = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
// Occupy the old fixed port to prove dev owns a separate server.
const occupied = createServer();
await new Promise((resolve) => {
  occupied.once("error", resolve);
  occupied.listen(5173, "127.0.0.1", resolve);
});
const npm = path.join(
  path.dirname(process.execPath),
  "node_modules/npm/bin/npm-cli.js",
);
const child = spawn(
  process.execPath,
  [npm, "run", "dev", "--", `--remote-debugging-port=${debugPort}`],
  {
    stdio: "pipe",
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      SKIN_FORGE_TEST_DATA: path.resolve(`artifacts/npm-dev-${Date.now()}`),
    },
  },
);
let output = "";
child.stdout.on("data", (data) => {
  output += data;
});
child.stderr.on("data", (data) => {
  output += data;
});
const exited = new Promise((resolve) => child.once("exit", resolve));
let browser;
try {
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
    } catch {}
    if (child.exitCode !== null) throw new Error(output);
    if (i === 199) throw new Error("Electron did not start: " + output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent("page"));
  page.on("pageerror", (error) =>
    console.error("Dev renderer:", error.message),
  );
  await expect(
    page.getByRole("heading", { name: "Skin-Vorschau" }),
  ).toBeVisible({ timeout: 20000 });
  expect(new URL(page.url()).port).not.toBe("5173");
  expect(await page.evaluate(() => window.desktop.keyStatus())).toBe(false);
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  const pid = Number(/Electron PID: (\d+)/.exec(output)?.[1]);
  expect(pid).toBeGreaterThan(0);
  // A nonzero native main window handle proves this was a shown desktop window.
  await expect
    .poll(
      () =>
        Number(
          execFileSync(
            "powershell.exe",
            [
              "-NoProfile",
              "-Command",
              `(Get-Process -Id ${pid}).MainWindowHandle`,
            ],
            { windowsHide: true, encoding: "utf8" },
          ).trim(),
        ),
      { timeout: 15000 },
    )
    .not.toBe(0);
  const url = page.url();
  await page.getByLabel("Skin-Stil", { exact: true }).selectOption("anime");
  await page.getByText("Merkmale anpassen", { exact: true }).click();
  await expect(page.getByLabel("Augen", { exact: true })).toHaveValue("large");
  await page.getByLabel("Mund", { exact: true }).selectOption("smile");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("skin-forge-project-v1")).styleProfile
            ?.mouth,
      ),
    )
    .toBe("smile");
  await page.reload();
  await expect(page.getByLabel("Skin-Stil", { exact: true })).toHaveValue(
    "anime",
  );
  await page.getByText("Merkmale anpassen", { exact: true }).click();
  await expect(page.getByLabel("Mund", { exact: true })).toHaveValue("smile");
  await page.getByLabel("Skin-Stil", { exact: true }).selectOption("robot");
  await expect(
    page.getByLabel("Menschliches Gesicht mit sichtbaren Augen"),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Menschliches Gesicht mit sichtbaren Augen"),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "KI-Einstellungen", exact: true })
    .click();
  await page.getByLabel("Modell-ID", { exact: true }).selectOption("__manual");
  await page.getByLabel("Eigene Modell-ID", { exact: true }).fill("gpt-6-astra");
  await expect(page.getByLabel("Eigene Modell-ID", { exact: true })).toHaveValue(
    "gpt-6-astra",
  );
  await expect(page.getByLabel("Reasoning-Aufwand")).toHaveValue("auto");
  await page.screenshot({ path: "artifacts/style-settings.png" });
  await page.getByRole("button", { name: "Einstellungen schließen" }).click();
  await page.screenshot({ path: "artifacts/style-profile.png" });
  await page.close();
  const code = await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Dev did not exit with Electron")),
        10000,
      ),
    ),
  ]);
  expect(code).toBe(0);
  await expect(fetch(url)).rejects.toThrow();
  console.log(
    "npm run dev: visible Electron window, occupied-port isolation, IPC, and server shutdown passed.",
  );
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (occupied.listening)
    await new Promise((resolve) => occupied.close(resolve));
}
