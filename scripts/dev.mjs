import "./build-electron.mjs";
import { spawn } from "node:child_process";
import electron from "electron";
import { createServer } from "vite";
// Own the server we connect to, instead of accidentally using a stale Vite.
const server = await createServer({
  server: { port: 0, strictPort: false, open: false },
});
await server.listen();
const address = server.httpServer.address();
const env = {
  ...process.env,
  SKIN_FORGE_DEV: "1",
  SKIN_FORGE_DEV_URL: `http://127.0.0.1:${address.port}/`,
};
delete env.ELECTRON_RUN_AS_NODE;
console.log("Skin Forge startet als Electron-Fenster. Strg+C beendet die App.");
const desktop = spawn(electron, [".", ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: false,
  env,
});
console.log(`Electron PID: ${desktop.pid}`);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  desktop.kill();
  await server.close();
  process.exit(code);
}
desktop.on("error", (error) => {
  console.error("Electron konnte nicht starten:", error.message);
  void stop(1);
});
desktop.on("exit", (code) => void stop(code ?? 0));
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
