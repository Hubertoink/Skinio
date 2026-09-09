import { build } from "esbuild";
import { spawn } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["scripts/replay-draft.ts"],
  outfile: "artifacts/replay-draft.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  electron,
  ["artifacts/replay-draft.cjs", ...process.argv.slice(2)],
  { stdio: "inherit", windowsHide: true, env },
);
child.on("exit", (code) => process.exit(code ?? 1));
