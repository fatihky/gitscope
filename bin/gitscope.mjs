#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dist = join(__dirname, "..", "dist");

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

if (!existsSync(dist)) {
  console.error(
    "gitscope: production build not found.\n" +
      "Run `waku build` first or reinstall the package.",
  );
  process.exit(1);
}

let wakuCli;
try {
  wakuCli = join(dirname(require.resolve("waku/package.json")), "cli.js");
} catch {
  console.error("gitscope: could not find the `waku` package — reinstall the package.");
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

const child = spawn(
  process.execPath,
  [wakuCli, "start", "--port", port, "--host", hostname],
  { cwd: join(__dirname, ".."), stdio: "inherit", env: process.env },
);

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
