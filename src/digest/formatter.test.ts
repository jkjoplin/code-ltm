import { describe, it, expect } from "vitest";
import { formatDigest } from "./formatter.js";
import type { DigestOptions, ScoredLearning } from "./types.js";

function makeOptions(overrides: Partial<DigestOptions> = {}): DigestOptions {
  return {
    min_confidence: "medium",
    format: "markdown",
    max_chars: 8192,
    max_content_length: 500,
    group_by_type: true,
    include_ids: true,
    include_metadata: true,
    ...overrides,
  };
}

function makeLearning(overrides: Partial<ScoredLearning> = {}): ScoredLearning {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    title: "Test Learning",
    content: "Some content here",
    type: "gotcha",
    scope: "project",
    confidence: "high",
    tags: ["test"],
    created_at: "2025-01-01T00:00:00.000Z",
    score: 50,
    ...overrides,
  };
}

describe("formatDigest", () => {
  describe("markdown format", () => {
    it("groups learnings by type in priority order", () => {
      const learnings = [
        makeLearning({ type: "pattern", title: "Pattern One", score: 40 }),
        makeLearning({ type: "gotcha", title: "Gotcha One", score: 50 }),
        makeLearning({ type: "tip", title: "Tip One", score: 30 }),
      ];

      const result = formatDigest(learnings, makeOptions(), 3);

      const gotchaIdx = result.output.indexOf("### Gotchas");
      const patternIdx = result.output.indexOf("### Patterns");
      const tipIdx = result.output.indexOf("### Tips");

      expect(gotchaIdx).toBeGreaterThan(-1);
      expect(patternIdx).toBeGreaterThan(-1);
      expect(tipIdx).toBeGreaterThan(-1);
      expect(gotchaIdx).toBeLessThan(patternIdx);
      expect(patternIdx).toBeLessThan(tipIdx);
    });

    it("includes short IDs when include_ids is true", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions({ include_ids: true }), 1);
      expect(result.output).toContain("[aaaaaaaa]");
    });

    it("excludes IDs when include_ids is false", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions({ include_ids: false }), 1);
      expect(result.output).not.toContain("[aaaaaaaa]");
    });

    it("truncates long content with ellipsis", () => {
      const longContent = "a".repeat(600);
      const learnings = [makeLearning({ content: longContent })];
      const result = formatDigest(learnings, makeOptions({ max_content_length: 100 }), 1);
      expect(result.output).toContain("...");
      expect(result.stats.total_truncated).toBe(1);
    });

    it("includes footer for omitted learnings", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions(), 5);
      expect(result.output).toContain("4 additional learnings omitted");
    });

    it("uses singular 'learning' for 1 omitted", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions(), 2);
      expect(result.output).toContain("1 additional learning omitted");
    });

    it("includes metadata comment when include_metadata is true", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions({ include_metadata: true }), 1);
      expect(result.output).toContain("<!-- Generated:");
    });

    it("excludes metadata when include_metadata is false", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions({ include_metadata: false }), 1);
      expect(result.output).not.toContain("<!-- Generated:");
    });

    it("does not group when group_by_type is false", () => {
      const learnings = [
        makeLearning({ type: "gotcha", title: "Gotcha" }),
        makeLearning({ type: "pattern", title: "Pattern" }),
      ];
      const result = formatDigest(learnings, makeOptions({ group_by_type: false }), 2);
      expect(result.output).not.toContain("### Gotchas");
      expect(result.output).not.toContain("### Patterns");
      expect(result.output).toContain("Gotcha");
      expect(result.output).toContain("Pattern");
    });

    it("degrades to title-only when budget is tight", () => {
      const learnings = [
        makeLearning({ title: "First", content: "Content for the first learning" }),
        makeLearning({
          title: "Second",
          content: "Content for the second learning which is quite long",
          id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
        }),
      ];

      // Very tight budget: enough for one full entry + one title-only
      const fullEntry = formatDigest(learnings.slice(0, 1), makeOptions({ max_chars: 100000, group_by_type: false, include_metadata: false }), 1);
      const charForFull = fullEntry.stats.character_count;

      // Budget: enough for one full + title-only of second, but not two full entries
      const result = formatDigest(
        learnings,
        makeOptions({
          max_chars: charForFull + 60,
          group_by_type: false,
          include_metadata: false,
        }),
        2
      );

      expect(result.stats.total_included).toBe(2);
      expect(result.stats.total_truncated).toBeGreaterThanOrEqual(1);
    });
  });

  describe("index format", () => {
    it("generates pipe-delimited table with all columns", () => {
      const learnings = [makeLearning({ tags: ["auth", "api"] })];
      const result = formatDigest(learnings, makeOptions({ format: "index" }), 1);

      expect(result.output).toContain("| ID | Title | Type | Confidence | Tags |");
      expect(result.output).toContain("|---|---|---|---|---|");
      expect(result.output).toContain("aaaaaaaa");
      expect(result.output).toContain("Test Learning");
      expect(result.output).toContain("gotcha");
      expect(result.output).toContain("high");
      expect(result.output).toContain("auth, api");
    });

    it("respects max_chars budget", () => {
      const learnings = Array.from({ length: 50 }, (_, i) =>
        makeLearning({
          id: `${String(i).padStart(8, "0")}-bbbb-cccc-dddd-eeeeeeeeeeee`,
          title: `Learning number ${i}`,
          score: 50 - i,
        })
      );

      const result = formatDigest(learnings, makeOptions({ format: "index", max_chars: 500 }), 50);
      expect(result.stats.character_count).toBeLessThanOrEqual(500);
      expect(result.stats.total_included).toBeLessThan(50);
    });
  });

  describe("json format", () => {
    it("produces valid JSON with stats", () => {
      const learnings = [makeLearning()];
      const result = formatDigest(learnings, makeOptions({ format: "json" }), 1);

      const parsed = JSON.parse(result.output);
      expect(parsed.learnings).toHaveLength(1);
      expect(parsed.learnings[0].id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
      expect(parsed.stats).toBeDefined();
      expect(parsed.stats.total_matched).toBe(1);
      expect(parsed.stats.total_included).toBe(1);
    });

    it("truncates content at max_content_length", () => {
      const learnings = [makeLearning({ content: "x".repeat(1000) })];
      const result = formatDigest(learnings, makeOptions({ format: "json", max_content_length: 100 }), 1);

      const parsed = JSON.parse(result.output);
      expect(parsed.learnings[0].content.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(parsed.learnings[0].content).toMatch(/\.\.\.$/);
    });

    it("includes score in output", () => {
      const learnings = [makeLearning({ score: 75 })];
      const result = formatDigest(learnings, makeOptions({ format: "json" }), 1);

      const parsed = JSON.parse(result.output);
      expect(parsed.learnings[0].score).toBe(75);
    });
  });

  describe("budget enforcement", () => {
    it("stops adding learnings when max_chars is reached", () => {
      const learnings = Array.from({ length: 20 }, (_, i) =>
        makeLearning({
          id: `${String(i).padStart(8, "0")}-bbbb-cccc-dddd-eeeeeeeeeeee`,
          title: `Learning ${i}`,
          content: "Some content that takes up space in the budget",
          score: 100 - i,
        })
      );

      const result = formatDigest(
        learnings,
        makeOptions({ max_chars: 500, group_by_type: false, include_metadata: false }),
        20
      );

      expect(result.stats.character_count).toBeLessThanOrEqual(500);
      expect(result.stats.total_included).toBeLessThan(20);
      expect(result.stats.total_omitted).toBeGreaterThan(0);
    });
  });
});
