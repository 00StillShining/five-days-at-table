// tools/extract/run.js
//
// Orchestrator: runs all four raw parsers (writing data/raw/*.json), then
// join.js (writing the canonical data/*.json). `npm run extract` runs this.
//
// Any parser or join.js exiting non-zero (a STOP / decision-request) aborts
// the whole run immediately with that exit code.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const steps = ["fd5.js", "methods.js", "provisioning.js", "shoppinglist.js", "morrisons.js", "join.js"];

for (const step of steps) {
  console.log(`\n=== running ${step} ===`);
  try {
    execFileSync("node", [path.join(HERE, step)], { stdio: "inherit", cwd: process.cwd() });
  } catch (err) {
    console.error(`\n${step} failed (exit code ${err.status ?? 1}). Aborting run.`);
    process.exit(err.status ?? 1);
  }
}

console.log("\n=== extract complete ===");
