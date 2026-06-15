import process from "node:process";

import { execa } from "execa";

import { ensurePnpm } from "../utils";

export async function handleUpdate(cwd: string = process.cwd()): Promise<void> {
  await ensurePnpm();
  await execa({ cwd, stdio: "inherit" })("pnpm", ["update", "@vef-framework-react/*"]);
}
