import { describe, it, expect } from "vitest";
import { coerceArgs } from "./coerce-args.js";

describe("coerceArgs", () => {
  it("parses JSON-encoded array strings into arrays", () => {
    const result = coerceArgs({ ids: '["a","b","c"]' });
    expect(result).toEqual({ ids: ["a", "b", "c"] });
  });

  it("parses JSON-encoded object strings into objects", () => {
    const result = coerceArgs({ filter: '{"scope":"project"}' });
    expect(result).toEqual({ filter: { scope: "project" } });
  });

  it("trims whitespace before detecting JSON containers", () => {
    const result = coerceArgs({ tags: '  ["x"]  ' });
    expect(result).toEqual({ tags: ["x"] });
  });

  it("leaves non-JSON strings untouched", () => {
    const result = coerceArgs({ title: "[draft] something" });
    expect(result).toEqual({ title: "[draft] something" });
  });

  it("leaves native arrays and objects untouched", () => {
    const input = { ids: ["a", "b"], filter: { scope: "project" }, limit: 5 };
    expect(coerceArgs(input)).toEqual(input);
  });

  it("returns null/undefined unchanged", () => {
    expect(coerceArgs(null)).toBeNull();
    expect(coerceArgs(undefined)).toBeUndefined();
  });

  it("does not coerce JSON-encoded scalars (strings/numbers/booleans)", () => {
    const result = coerceArgs({ a: '"hello"', b: "42", c: "true" });
    expect(result).toEqual({ a: '"hello"', b: "42", c: "true" });
  });

  it("does not recurse into already-native nested arrays/objects", () => {
    const input = { file_references: [{ path: "src/a.ts" }] };
    expect(coerceArgs(input)).toEqual(input);
  });

  it("returns malformed JSON strings unchanged", () => {
    const result = coerceArgs({ tags: "[not, valid, json" });
    expect(result).toEqual({ tags: "[not, valid, json" });
  });
});
