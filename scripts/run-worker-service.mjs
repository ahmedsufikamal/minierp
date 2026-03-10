import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const role = process.argv[2]?.trim() || process.env.WORKER_ROLE?.trim();
const port = Number.parseInt(process.env.PORT || "8080", 10);

const workerScripts = {
  iam: new URL("./iam-worker.mjs", import.meta.url),
  inventory: new URL("./inventory-worker.mjs", import.meta.url),
};

if (!role || !(role in workerScripts)) {
  console.error(`Unknown worker role "${role ?? ""}". Expected one of: ${Object.keys(workerScripts).join(", ")}`);
  process.exit(1);
}

let shuttingDown = false;
let childExited = false;

const child = spawn(process.execPath, [fileURLToPath(workerScripts[role])], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  childExited = true;
  if (shuttingDown) {
    return;
  }

  if (signal) {
    console.error(`[${role}-worker-service] worker exited via signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/healthz") {
    const body = JSON.stringify({
      ok: !childExited,
      role,
      pid: child.pid ?? null,
    });
    res.writeHead(childExited ? 503 : 200, { "content-type": "application/json" });
    res.end(body);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[${role}-worker-service] received ${signal}, shutting down`);

  await new Promise((resolve) => server.close(resolve));
  if (!childExited) {
    child.kill("SIGTERM");
  }

  const timer = setTimeout(() => {
    if (!childExited) {
      child.kill("SIGKILL");
    }
  }, 10_000);
  timer.unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT").finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM").finally(() => process.exit(0));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[${role}-worker-service] health endpoint listening on 0.0.0.0:${port}`);
});
