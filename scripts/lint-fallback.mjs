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

function hasTypeScriptEslint() {
  try {
    requireFromEsm.resolve("typescript-eslint");
    return true;
  } catch {
    return false;
  }
}

if (hasTypeScriptEslint()) {
  process.exit(run("eslint", ["src/"]));
}

console.warn(
  "typescript-eslint is not installed in this environment; falling back to `tsc --noEmit`."
);
process.exit(run("tsc", ["--noEmit"]));
