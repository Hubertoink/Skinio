// Integration fixture only. No application UI or real network requests.
export async function mockGrid(app) {
  await app.evaluate(() => {
    global.__badGrid = false;
    global.fetch = async (url, init) => {
      if (url !== "https://api.openai.com/v1/responses")
        throw new Error("Network disabled in test");
      const body = JSON.parse(init.body),
        input = JSON.parse(body.input[0].content[0].text);
      const tokens = Object.keys(input.palette),
        empty = tokens[0].length === 2 ? ".." : ".";
      const patch = {
        name: "Test generation",
        faces: global.__badGrid
          ? {}
          : Object.fromEntries(
              input.targetFaces.map((f) => [
                f.id,
                Array.from({ length: f.height }, (_, y) =>
                  Array.from({ length: f.width }, (_, x) =>
                    f.layer === "outer" && x > 0 && x < f.width - 1
                      ? empty
                      : tokens[(x + y) % tokens.length],
                  ).join(""),
                ),
              ]),
            ),
      };
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(patch) }],
            },
          ],
        }),
      );
    };
  });
}
export async function configureMock(page) {
  await page.evaluate(async () => {
    await window.desktop.saveKey("sk-only-a-local-test-key");
    localStorage.setItem("skin-forge-model", "test-model");
  });
  await page.reload();
  await page.getByLabel("Kleidung und Schuhe abgleichen").uncheck();
  await page.locator("#prompt").fill("Testkleidung mit Schattierung");
}
