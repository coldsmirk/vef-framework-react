#!/usr/bin/env node

import module from "node:module";
import process from "node:process";

try {
  module.enableCompileCache();
} catch {}

try {
  await import("../dist/cli/index.js");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exitCode = 1;
}
