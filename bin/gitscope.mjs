#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const standaloneServer = resolve(__dirname, "..", ".next", "standalone", "server.js");

if (!existsSync(standaloneServer)) {
  console.error(
    "gitscope: standalone build not found.\n" +
      "Run `next build` first or reinstall the package.",
  );
  process.exit(1);
}

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

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
