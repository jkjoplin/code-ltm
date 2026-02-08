import { Command } from "commander";
import { createRequire } from "node:module";
import { printError, printInfo, printSuccess, printWarning } from "../output.js";

const requireFromEsm = createRequire(import.meta.url);

function checkBetterSqlite3Abi(): { ok: boolean; detail: string } {
  try {
    const mod = requireFromEsm("better-sqlite3");
    if (typeof mod !== "function") {
      return { ok: false, detail: "better-sqlite3 module shape is unexpected" };
    }
    return { ok: true, detail: "better-sqlite3 loaded successfully" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NODE_MODULE_VERSION")) {
      return {
        ok: false,
        detail:
          "better-sqlite3 ABI mismatch detected. Run `npm rebuild better-sqlite3`.",
      };
    }
    return { ok: false, detail: message };
  }
}

function checkTypescriptEslintDependency(): { ok: boolean; detail: string } {
  try {
    const mod = requireFromEsm("typescript-eslint");
    if (!mod) {
      return { ok: false, detail: "typescript-eslint resolved to empty module" };
    }
    return { ok: true, detail: "typescript-eslint dependency installed" };
  } catch {
    return {
      ok: false,
      detail:
        "Missing `typescript-eslint` package. Run `npm install -D typescript-eslint`.",
    };
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run environment checks for common runtime/tooling issues")
    .action(() => {
      let failures = 0;

      const abiCheck = checkBetterSqlite3Abi();
      if (abiCheck.ok) {
        printSuccess(abiCheck.detail);
      } else {
        failures++;
        printWarning(abiCheck.detail);
      }

      const lintDependencyCheck = checkTypescriptEslintDependency();
      if (lintDependencyCheck.ok) {
        printSuccess(lintDependencyCheck.detail);
      } else {
        failures++;
        printWarning(lintDependencyCheck.detail);
      }

      printInfo(`Node version: ${process.version}`);
      if (failures > 0) {
        printError(`Doctor found ${failures} issue(s)`);
        process.exit(1);
      }
      printSuccess("Doctor checks passed");
    });
}
