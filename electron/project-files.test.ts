import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectFiles } from "./project-files";
import { createBlankSkin, projectOf } from "../src/core/skin";

const content = (name: string) => JSON.stringify(projectOf(createBlankSkin(), name, ["#112233"]));
describe("project files", () => {
  it("retains the destination across saves and restarts; save-as cancels or switches safely", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "skin-forge-project-"));
    try {
      const registry = path.join(dir, "registry.json"), a = path.join(dir, "a.skinforge"), b = path.join(dir, "b.skinforge");
      const files = new ProjectFiles(registry);
      const first = (await files.save(content("A"), null, false, async () => a))!;
      const noDialog = async () => { throw new Error("Unexpected dialog"); };
      await new ProjectFiles(registry).save(content("A2"), first.id, false, noDialog);
      expect(JSON.parse(await readFile(a, "utf8")).name).toBe("A2");
      expect(await files.save(content("cancel"), first.id, true, async () => null)).toBeNull();
      expect(JSON.parse(await readFile(a, "utf8")).name).toBe("A2");
      const second = (await files.save(content("B"), first.id, true, async () => b))!;
      expect(second.id).not.toBe(first.id);
      await files.save(content("B2"), second.id, false, noDialog);
      expect(JSON.parse(await readFile(b, "utf8")).name).toBe("B2");
      expect(JSON.parse(await readFile(a, "utf8")).name).toBe("A2");
      expect((await files.remember(a)).id).toBe(first.id);
      await expect(files.save("{}", first.id, false, noDialog)).rejects.toThrow();
      await expect(files.save(content("bad"), "__proto__", false, noDialog)).rejects.toThrow();
      await expect(files.save(content("bad"), first.id, true, async () => path.join(dir, "missing", "fail.skinforge"))).rejects.toThrow();
      expect(JSON.parse(await readFile(a, "utf8")).name).toBe("A2");
      await rm(a);
      await expect(files.save(content("missing"), first.id, false, noDialog)).rejects.toThrow(/nicht erreichbar/);
      await writeFile(registry, "broken");
      await expect(files.save(content("bad"), second.id, false, noDialog)).rejects.toThrow(/Zuordnung|zuordnung/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
