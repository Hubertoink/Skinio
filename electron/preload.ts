import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../src/bridge";
const bridge: DesktopBridge = {
  onGenerationProgress(listener) {
    const handler = (
      _event: unknown,
      stage: "analysis" | "image" | "grid" | "review",
    ) => {
      if (["analysis", "image", "grid", "review"].includes(stage))
        listener(stage);
    };
    ipcRenderer.on("ai:progress", handler);
    return () => ipcRenderer.removeListener("ai:progress", handler);
  },
  keyStatus: () => ipcRenderer.invoke("key:status"),
  saveKey: (key) => ipcRenderer.invoke("key:save", key),
  deleteKey: () => ipcRenderer.invoke("key:delete"),
  generate: (request, model) =>
    ipcRenderer.invoke("ai:generate", request, model),
  cancel: () => ipcRenderer.invoke("ai:cancel"),
  saveFile: (kind, name, content) =>
    ipcRenderer.invoke("file:save", kind, name, content),
};
contextBridge.exposeInMainWorld("desktop", bridge);
