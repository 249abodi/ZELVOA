import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "../route";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/auth/providers", () => {
  test("returns only configured providers", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    vi.stubEnv("FACEBOOK_AUTH_CLIENT_ID", "fid");
    vi.stubEnv("FACEBOOK_AUTH_CLIENT_SECRET", "fsec");

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.providers.map((p: { id: string }) => p.id)).toEqual([
      "GOOGLE",
      "FACEBOOK",
    ]);
  });

  test("returns an empty list when nothing is configured", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.data.providers).toEqual([]);
  });
});