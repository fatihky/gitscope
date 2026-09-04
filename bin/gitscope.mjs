#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const standaloneServer = resolve(__dirname, "..", ".next", "standalone", "server.js");

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`gitscope v0.1.0

Usage: gitscope [options]

Options:
  -h, --help     Show this help message
  -p, --port     Port to listen on (default: 3000, env: PORT)
      --hostname Hostname to bind to (default: 0.0.0.0, env: HOSTNAME)

Environment Variables:
  PORT           Port to listen on (default: 3000)
  HOSTNAME       Hostname to bind to (default: 0.0.0.0)

Examples:
  gitscope                    Start server on port 3000
  gitscope -p 8080            Start server on port 8080
  PORT=4000 gitscope          Start server on port 4000`);
  process.exit(0);
}

if (!existsSync(standaloneServer)) {
  console.error(
    "gitscope: standalone build not found.\n" +
      "Run `next build` first or reinstall the package.",
  );
  process.exit(1);
}

let port = process.env.PORT || "3000";
let hostname = process.env.HOSTNAME || "0.0.0.0";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === "-p" || arg === "--port") && args[i + 1]) {
    port = args[++i];
  } else if (arg === "--hostname" && args[i + 1]) {
    hostname = args[++i];
  }
}

process.env.PORT = port;
process.env.HOSTNAME = hostname;

const child = spawn("node", [standaloneServer], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error(`gitscope: failed to start server: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
