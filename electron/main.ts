import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateOpenAI } from "./provider";
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
    const timer = setTimeout(() => controller.abort(), 420_000);
    try {
      return await generateOpenAI(
        request,
        model,
        key,
        controller.signal,
        fetch,
        (stage) => win?.webContents.send("ai:progress", stage),
      );
    } catch (e) {
      if (controller.signal.aborted)
        throw new Error(
          "Generierung abgebrochen oder Zeitlimit erreicht. Bereits entstandene API-Kosten können bestehen bleiben.",
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
  register("file:save", async (kind: string, name: string, content: string) => {
    if (
      !["png", "project", "json"].includes(kind) ||
      typeof content !== "string" ||
      content.length > 10_000_000 ||
      typeof name !== "string"
    )
      throw new Error("Ungültige Datei.");
    const ext = kind === "project" ? "skinforge" : kind;
    const clean =
      name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "skin";
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `${clean}.${ext}`,
      filters: [
        {
          name: kind === "png" ? "Minecraft Skin" : "Skin Forge",
          extensions: [ext],
        },
      ],
    });
    if (result.canceled || !result.filePath) return false;
    if (kind === "png") {
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(content))
        throw new Error("PNG erwartet.");
      const buffer = Buffer.from(content.split(",")[1], "base64");
      if (
        buffer.length < 24 ||
        buffer.readUInt32BE(16) !== 64 ||
        buffer.readUInt32BE(20) !== 64
      )
        throw new Error("Skin muss 64 × 64 Pixel haben.");
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
