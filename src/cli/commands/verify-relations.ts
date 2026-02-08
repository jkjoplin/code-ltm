import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { printError, printInfo, printSuccess, printWarning } from "../output.js";

export function registerVerifyRelationsCommand(program: Command): void {
  program
    .command("verify-relations")
    .description("Check learning relation integrity (asymmetry/orphans)")
    .option("--json", "Print full JSON details")
    .action((opts) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);
        const report = repo.verifyRelations();
        const issueCount =
          report.asymmetric.length +
          report.orphan_sources.length +
          report.orphan_targets.length;

        if (issueCount === 0) {
          printSuccess("Relationship integrity check passed");
        } else {
          printWarning(`Relationship integrity issues detected: ${issueCount}`);
          printInfo(`Asymmetric links: ${report.asymmetric.length}`);
          printInfo(`Orphan sources: ${report.orphan_sources.length}`);
          printInfo(`Orphan targets: ${report.orphan_targets.length}`);
        }

        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
        }
        db.close();
      } catch (error) {
        printError(
          `Verify relations failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        process.exit(1);
      }
    });
}
