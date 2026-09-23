import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import { readFile, writeFile, unlink, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateOpenAI } from "./provider";
import { listOpenAIModels } from "./models";
import { ProjectFiles } from "./project-files";
import { parseProject } from "../src/core/skin";
let win: BrowserWindow | null = null;
let active: AbortController | undefined;
const dev = process.env.SKIN_FORGE_DEV === "1";
const pageURL = dev
  ? process.env.SKIN_FORGE_DEV_URL || "http://127.0.0.1:5173/"
  : pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
function keyPath() {
  return path.join(app.getPath("userData"), "credentials.bin");
}
function encryptionAvailable() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text")
  );
}
function register(name: string, handler: (...args: any[]) => unknown) {
  ipcMain.handle(name, (event, ...args) => {
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame?.url !== pageURL
    )
      throw new Error("Unzulässiger App-Zugriff.");
    return handler(...args);
  });
}
app.whenReady().then(() => {
  if (process.env.SKIN_FORGE_TEST_DATA)
    app.setPath("userData", process.env.SKIN_FORGE_TEST_DATA);
  const projectFiles = new ProjectFiles(path.join(app.getPath("userData"), "project-files.json"));
  register("project:save", async (content, id, saveAs) =>
    projectFiles.save(content, id, saveAs, async (currentPath) => {
      const project = parseProject(JSON.parse(content));
      const name = project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "Skin";
      const result = await dialog.showSaveDialog(win!, {
        title: "Projekt speichern unter",
        defaultPath: currentPath ?? `${name}.skinforge`,
        filters: [{ name: "Skin Forge Projekt", extensions: ["skinforge"] }],
      });
      return result.canceled || !result.filePath ? null : result.filePath;
    }),
  );
  register("project:open", async () => {
    const result = await dialog.showOpenDialog(win!, {
      title: "Projekt oder Skin öffnen",
      properties: ["openFile"],
      filters: [{ name: "Skin Forge / Minecraft Skin", extensions: ["skinforge", "json", "png"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = result.filePaths[0];
    const project = /\.(skinforge|json)$/i.test(selected);
    if (!project && !/\.png$/i.test(selected)) throw new Error("Projektdatei oder PNG erwartet.");
    const handle = await open(selected, "r");
    let bytes: Buffer;
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > (project ? 1_000_000 : 5_000_000))
        throw new Error("Projekt- oder Skin-Datei ist zu groß.");
      bytes = Buffer.alloc(info.size);
      let offset = 0;
      while (offset < bytes.length) {
        const read = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!read.bytesRead) break;
        offset += read.bytesRead;
      }
      bytes = bytes.subarray(0, offset);
    } finally { await handle.close(); }
    if (project) parseProject(JSON.parse(bytes.toString("utf8")));
    return { name: path.basename(selected), bytes: new Uint8Array(bytes),
      file: project ? await projectFiles.remember(selected) : null };
  });
  register("key:status", async () => {
    try {
      return encryptionAvailable() && (await readFile(keyPath())).length > 0;
    } catch {
      return false;
    }
  });
  register("key:save", async (key: string) => {
    if (
      typeof key !== "string" ||
      key.trim().length < 12 ||
      key.length > 1000 ||
      /\s/.test(key.trim())
    )
      throw new Error("Bitte einen gültigen API-Key eingeben.");
    if (!encryptionAvailable())
      throw new Error(
        "Sichere Schlüsselspeicherung ist auf diesem System nicht verfügbar.",
      );
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(keyPath(), safeStorage.encryptString(key.trim()), {
      mode: 0o600,
    });
  });
  register("key:delete", async () => {
    try {
      await unlink(keyPath());
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  });
  register("ai:models", async () => {
    if (!encryptionAvailable())
      throw new Error("Sichere Schlüsselspeicherung ist nicht verfügbar.");
    let key: string;
    try {
      key = safeStorage.decryptString(await readFile(keyPath()));
    } catch {
      throw new Error("Bitte zuerst deinen API-Key speichern.");
    }
    return listOpenAIModels(key);
  });
  register("ai:generate", async (request, model) => {
    if (active) throw new Error("Eine Generierung läuft bereits.");
    if (!encryptionAvailable())
      throw new Error("Sichere Schlüsselspeicherung ist nicht verfügbar.");
    let key: string;
    try {
      key = safeStorage.decryptString(await readFile(keyPath()));
    } catch {
      throw new Error(
        "Bitte zuerst deinen API-Key in den Einstellungen speichern.",
      );
    }
    const controller = new AbortController();
    active = controller;
    let lastStage = "Vorbereitung";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 420_000);
    try {
      return await generateOpenAI(
        request,
        model,
        key,
        controller.signal,
        fetch,
        (stage) => {
          lastStage = stage;
          win?.webContents.send("ai:progress", stage);
        },
      );
    } catch (e) {
      if (controller.signal.aborted)
        throw new Error(
          timedOut
            ? `Zeitlimit von 7 Minuten erreicht (Schritt: ${lastStage}). Für den nächsten Versuch nur den Kopf wählen oder den Reasoning-Aufwand reduzieren. Bereits entstandene API-Kosten bleiben möglich.`
            : "Generierung abgebrochen. Bereits entstandene API-Kosten können bestehen bleiben.",
        );
      throw e;
    } finally {
      clearTimeout(timer);
      active = undefined;
    }
  });
  register("ai:cancel", () => {
    active?.abort();
  });
  register("file:open-reference", async () => {
    const result = await dialog.showOpenDialog(win!, {
      title: "Referenzbild hinzufügen",
      properties: ["openFile"],
      filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = result.filePaths[0];
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[path.extname(selected).toLowerCase()];
    if (!mime) throw new Error("Bitte ein PNG-, JPEG- oder WebP-Bild auswählen.");
    const file = await open(selected, "r");
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > 20_000_000)
        throw new Error("Referenzbild darf maximal 20 MB groß sein.");
      // Bound the read even if the selected file grows after stat().
      const buffer = Buffer.alloc(info.size);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      return { name: path.basename(selected), type: mime, bytes: new Uint8Array(buffer.subarray(0, offset)) };
    } finally {
      await file.close();
    }
  });
  register("file:save", async (kind: string, name: string, content: string) => {
    if (
      !["png", "pose", "project", "json"].includes(kind) ||
      typeof content !== "string" ||
      content.length > 10_000_000 ||
      typeof name !== "string"
    )
      throw new Error("Ungültige Datei.");
    const ext = kind === "project" ? "skinforge" : kind === "pose" ? "png" : kind;
    const clean =
      name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "skin";
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `${clean}.${ext}`,
      filters: [
        {
          name: kind === "png" ? "Minecraft Skin" : kind === "pose" ? "Pose (transparentes PNG)" : "Skin Forge",
          extensions: [ext],
        },
      ],
    });
    if (result.canceled || !result.filePath) return false;
    if (kind === "png" || kind === "pose") {
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(content))
        throw new Error("PNG erwartet.");
      const buffer = Buffer.from(content.split(",")[1], "base64");
      if (
        buffer.length < 24 ||
        (kind === "png" &&
          (buffer.readUInt32BE(16) !== 64 || buffer.readUInt32BE(20) !== 64)) ||
        (kind === "pose" &&
          (buffer.readUInt32BE(16) < 1 || buffer.readUInt32BE(20) < 1 ||
            buffer.readUInt32BE(16) > 8192 || buffer.readUInt32BE(20) > 8192))
      )
        throw new Error(kind === "png" ? "Skin muss 64 × 64 Pixel haben." : "Posenbild darf maximal 8192 × 8192 Pixel haben.");
      await writeFile(result.filePath, buffer);
    } else await writeFile(result.filePath, content, "utf8");
    return true;
  });
  win = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#111514",
    title: "Skin Forge",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: !process.env.SKIN_FORGE_TEST_DATA,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  win.once("ready-to-show", () => {
    if (!process.env.SKIN_FORGE_TEST_DATA || dev) win?.show();
  });
  win.on("closed", () => {
    active?.abort();
    win = null;
  });
  void win.loadURL(pageURL);
});
app.on("window-all-closed", () => app.quit());
