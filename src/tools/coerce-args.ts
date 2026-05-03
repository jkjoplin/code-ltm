// Some MCP bridges serialize array/object params as JSON-encoded strings on the
// way to the server. Zod schemas expecting `array`/`object` then reject the
// payload. Detect those JSON-shaped strings and parse them back to native
// values before validation.

export function coerceArgs(args: unknown): unknown {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return args;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    out[key] = coerceValue(value);
  }
  return out;
}

function coerceValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (looksLikeJsonContainer(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object") {
          return parsed;
        }
      } catch {
        // Not valid JSON — fall through and return the original string.
      }
    }
    return value;
  }
  return value;
}

function looksLikeJsonContainer(s: string): boolean {
  if (s.length < 2) return false;
  const first = s[0];
  const last = s[s.length - 1];
  return (first === "[" && last === "]") || (first === "{" && last === "}");
}
