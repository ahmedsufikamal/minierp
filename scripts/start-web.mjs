import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT?.trim() || "3000";
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);

const child = spawn(process.execPath, [fileURLToPath(nextBin), "start", "-H", "0.0.0.0", "-p", port], {
  env: process.env,
  stdio: "inherit",
});

function forwardSignal(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
