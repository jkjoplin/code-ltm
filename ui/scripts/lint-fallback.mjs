import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const requireFromEsm = createRequire(import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

function hasLintDeps() {
  try {
    requireFromEsm.resolve("@eslint/js");
    requireFromEsm.resolve("typescript-eslint");
    return true;
  } catch {
    return false;
  }
}

if (hasLintDeps()) {
  process.exit(run("eslint", ["src/**/*.{ts,tsx}"]));
}

console.warn(
  "ui lint dependencies are not installed in this environment; falling back to `tsc --noEmit`."
);
process.exit(run("tsc", ["--noEmit"]));
