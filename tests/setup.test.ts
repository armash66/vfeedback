import { describe, expect, it } from "vitest";
// @ts-expect-error JS module without declaration file
import { parseEnv, serializeEnvValue } from "../scripts/setup.mjs";

describe("setup.mjs - pure env round-trip tests", () => {
  const testCases = [
    { name: "value with spaces", value: "a b" },
    { name: "value with hash", value: "p#ss" },
    { name: "value with embedded double quotes", value: 'say "hi"' },
    { name: "value with backslash", value: "path\\to\\dir" },
    { name: "value with both backslash and quotes", value: 'say \\"hello\\"' },
    { name: "safe alphanumeric value", value: "safeValue123" },
    { name: "value with leading and trailing spaces", value: "  padded  " },
  ];

  for (const { name, value } of testCases) {
    it(`serializes and parses round trip for: ${name}`, () => {
      const serialized = serializeEnvValue(value);
      const envContent = `TEST_KEY=${serialized}\n`;
      const parsedMap = parseEnv(envContent);
      expect(parsedMap.get("TEST_KEY")).toBe(value);
    });
  }

  it("leaves safe values unquoted", () => {
    expect(serializeEnvValue("simple_val-123")).toBe("simple_val-123");
    expect(serializeEnvValue("5433")).toBe("5433");
  });

  it("quotes values requiring quotes and escapes correctly", () => {
    expect(serializeEnvValue("a b")).toBe('"a b"');
    expect(serializeEnvValue("p#ss")).toBe('"p#ss"');
    expect(serializeEnvValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(serializeEnvValue("path\\to")).toBe('"path\\\\to"');
  });
});
