import { describe, expect, test } from "vitest";
import { PLATFORM_META, serializeCapabilities } from "@/lib/integrations/platforms";

describe("serializeCapabilities", () => {
  test("returns an array of enabled capability labels", () => {
    expect(
      serializeCapabilities({ publish: true, schedule: true, messaging: true, analytics: true })
    ).toEqual(["Publish", "Schedule", "Messaging", "Analytics"]);
  });

  test("omits disabled capabilities in stable order", () => {
    expect(
      serializeCapabilities({ publish: true, schedule: false, messaging: false, analytics: true })
    ).toEqual(["Publish", "Analytics"]);
  });

  test("returns an empty array when nothing is enabled", () => {
    expect(
      serializeCapabilities({ publish: false, schedule: false, messaging: false, analytics: false })
    ).toEqual([]);
  });

  test("emits joinable strings for every platform in PLATFORM_META", () => {
    for (const platform of Object.keys(PLATFORM_META)) {
      const capabilities = serializeCapabilities(PLATFORM_META[platform as keyof typeof PLATFORM_META].capabilities);
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.every((c) => typeof c === "string")).toBe(true);
      expect(typeof capabilities.join(", ")).toBe("string");
    }
  });
});