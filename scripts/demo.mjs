// SPDX-License-Identifier: Apache-2.0
// Starts the copilot API with fictional demonstration data and the web app.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_PORT = process.env.DEMO_API_PORT ?? "8080";
const API_URL = `http://localhost:${API_PORT}`;

const children = [];

function start(command, env) {
  const child = spawn(command, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  return child;
}

function addExitHooks() {
  const shutdown = () => {
    for (const child of children) {
      if (child.pid === undefined) continue;
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function waitForApi(attempts = 60, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

addExitHooks();

start(`pnpm --filter @lux/copilot-api exec tsx src/index.ts`, {
  SEED_DEMO: "1",
  PORT: API_PORT,
});

const apiReady = await waitForApi();
if (!apiReady) {
  console.error("demo: copilot API did not become healthy; aborting");
  process.exit(1);
}

start(`pnpm --filter @lux/copilot-web dev`, {
  VITE_API_URL: API_URL,
});

console.log("");
console.log("  lux demo");
console.log("  ------------------------------------------");
console.log(`  Copilot API   ${API_URL}`);
console.log("  Web app       http://localhost:5173");
console.log("  Data          fictional (Maison Verre)");
console.log("  Stop          Ctrl+C");
console.log("");
