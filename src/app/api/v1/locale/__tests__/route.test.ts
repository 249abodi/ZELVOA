import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { PUT } from "@/app/api/v1/locale/route";

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

vi.mock("@/lib/api", () => ({
  ok: (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 }),
  fail: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: { message } }), { status }),
  handleApiError: (err: unknown) =>
    new Response(JSON.stringify({ error: { message: String(err) } }), { status: 500 }),
}));

function putRequest(locale: unknown): Request {
  return new Request("http://localhost/api/v1/locale", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
}

beforeEach(() => {
  mockCookieStore.set.mockClear();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("locale PUT", () => {
  test("sets the locale cookie when valid", async () => {
    const res = await PUT(putRequest("ar"));
    expect(res.status).toBe(200);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "zelvoa_locale",
      "ar",
      expect.objectContaining({ path: "/", maxAge: expect.any(Number) })
    );
  });

  test("switching back to English works", async () => {
    const res = await PUT(putRequest("en"));
    expect(res.status).toBe(200);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "zelvoa_locale",
      "en",
      expect.anything()
    );
  });

  test("rejects an unsupported locale", async () => {
    const res = await PUT(putRequest("fr"));
    expect(res.status).toBe(400);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  test("rejects a missing locale", async () => {
    const res = await PUT(
      new Request("http://localhost/api/v1/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});