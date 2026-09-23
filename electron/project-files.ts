import { readFile, writeFile, mkdir, rename, unlink, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseProject } from "../src/core/skin";
import type { ProjectFile } from "../src/bridge";

async function atomicWrite(target: string, content: string) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

// Only native dialogs grant write access. Renderer messages carry opaque IDs,
// never arbitrary filesystem paths. Grants survive app restarts.
export class ProjectFiles {
  constructor(private registryPath: string) {}

  private async registry(): Promise<Record<string, string>> {
    try {
      const value = JSON.parse(await readFile(this.registryPath, "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => {
        const [id, file] = entry;
        return /^[a-f0-9-]{36}$/.test(id) && typeof file === "string" && path.isAbsolute(file);
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new Error("Die Projektzuordnung konnte nicht gelesen werden.");
    }
  }

  async remember(filePath: string): Promise<ProjectFile> {
    const registry = await this.registry();
    const id = Object.keys(registry).find((id) => registry[id] === filePath) ?? randomUUID();
    registry[id] = filePath;
    await mkdir(path.dirname(this.registryPath), { recursive: true });
    await atomicWrite(this.registryPath, JSON.stringify(registry));
    return { id, path: filePath };
  }

  async save(content: string, id: string | null, saveAs: boolean,
    choose: (currentPath?: string) => Promise<string | null>): Promise<ProjectFile | null> {
    if (typeof content !== "string" || content.length > 1_000_000 ||
      (id !== null && (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))) || typeof saveAs !== "boolean")
      throw new Error("Ungültige Projektdatei.");
    parseProject(JSON.parse(content));
    const currentPath = id ? (await this.registry())[id] : undefined;
    if (id && !currentPath && !saveAs)
      throw new Error("Projektdatei nicht mehr zugeordnet. Bitte „Speichern unter“ verwenden.");
    const target = !saveAs && currentPath ? currentPath : await choose(currentPath);
    if (!target) return null;
    if (!/\.(skinforge|json)$/i.test(target))
      throw new Error("Bitte als .skinforge-Projektdatei speichern.");
    if (!saveAs && currentPath) {
      try {
        if (!(await stat(target)).isFile()) throw new Error();
      } catch {
        throw new Error("Projektdatei nicht erreichbar. Bitte „Speichern unter“ verwenden.");
      }
    }
    await atomicWrite(target, content);
    return this.remember(target);
  }
}
