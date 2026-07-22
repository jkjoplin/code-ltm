import { describe, it, expect } from "vitest";
import { RunAutonomyCycleInputSchema } from "./types.js";

// RH-A-006: config posture is dry-run-safe (autonomy.dry_run_default = true), but the public MCP input
// schema defaulted dry_run to false — an MCP caller omitting the argument got a durable write. The
// schema default must be the safe one: omitting dry_run means dry run; durable writes are explicit.
describe("RunAutonomyCycleInputSchema dry_run default", () => {
  it("defaults dry_run to true when the argument is omitted", () => {
    const input = RunAutonomyCycleInputSchema.parse({});
    expect(input.dry_run).toBe(true);
  });

  it("honors an explicit dry_run: false (durable writes stay reachable, but only explicitly)", () => {
    const input = RunAutonomyCycleInputSchema.parse({ dry_run: false });
    expect(input.dry_run).toBe(false);
  });

  it("honors an explicit dry_run: true", () => {
    const input = RunAutonomyCycleInputSchema.parse({ dry_run: true });
    expect(input.dry_run).toBe(true);
  });
});
