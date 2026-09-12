import { describe, expect, test } from "vitest";
import {
  generateLicenseKey,
  isValidLicenseKeyFormat,
  normalizeLicenseKey,
} from "@/lib/billing/license";

describe("generateLicenseKey", () => {
  test("produces keys matching the expected format", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLicenseKeyFormat(generateLicenseKey())).toBe(true);
    }
  });

  test("produces distinct keys", () => {
    const keys = new Set(Array.from({ length: 40 }, () => generateLicenseKey()));
    expect(keys.size).toBe(40);
  });
});

describe("isValidLicenseKeyFormat", () => {
  test("accepts a well-formed key", () => {
    expect(isValidLicenseKeyFormat("ZELVOA-AB2C-D3EF-G4HJ")).toBe(true);
  });

  test("accepts lowercase by normalizing", () => {
    expect(isValidLicenseKeyFormat("zelvoa-ab2c-d3ef-g4hj")).toBe(true);
  });

  test("rejects wrong prefix", () => {
    expect(isValidLicenseKeyFormat("ABC-AB12-CD34-EF56")).toBe(false);
  });

  test("rejects wrong segment lengths", () => {
    expect(isValidLicenseKeyFormat("ZELVOA-AB1-CD34-EF56")).toBe(false);
    expect(isValidLicenseKeyFormat("ZELVOA-AB12-CD34-EF5")).toBe(false);
  });

  test("rejects too many or too few segments", () => {
    expect(isValidLicenseKeyFormat("ZELVOA-AB12-CD34")).toBe(false);
    expect(isValidLicenseKeyFormat("ZELVOA-AB12-CD34-EF56-GH78")).toBe(false);
  });

  test("rejects ambiguous characters that are excluded from generation", () => {
    expect(isValidLicenseKeyFormat("ZELVOA-OOII-III0-OOOO")).toBe(false);
  });

  test("rejects garbage", () => {
    expect(isValidLicenseKeyFormat("not a key at all")).toBe(false);
    expect(isValidLicenseKeyFormat("")).toBe(false);
  });
});

describe("normalizeLicenseKey", () => {
  test("trims and uppercases", () => {
    expect(normalizeLicenseKey("  zelvoa-ab12-cd34-ef56  ")).toBe("ZELVOA-AB12-CD34-EF56");
  });
});