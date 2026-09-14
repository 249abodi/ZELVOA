import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AIProviderError } from "@/lib/ai/types";
import { POST } from "@/app/api/v1/ai/generate/route";
import type { AIProvider } from "@/lib/ai/types";

const {
  mockGetCurrentContext,
  mockGetAIProvider,
  mockAssertUserAIAvailable,
  mockAssertMonthlyAIQuotaAvailable,
  mockRecordAIUsage,
  mockGetOrganizationMonthlyAICount,
  mockWriteAudit,
  mockApi,
  MockAIQuotaError,
} = vi.hoisted(() => {
  function jsonResult(status: number, body: unknown, headers?: unknown) {
    return {
      status,
      headers: headers ?? {},
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }

  class MockAIQuotaError extends Error {
    retryAfterSeconds: number | null;
    constructor(message: string, retryAfterSeconds: number | null = null) {
      super(message);
      this.name = "AIQuotaError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }

  return {
    mockGetCurrentContext: vi.fn(),
    mockGetAIProvider: vi.fn(),
    mockAssertUserAIAvailable: vi.fn(),
    mockAssertMonthlyAIQuotaAvailable: vi.fn(),
    mockRecordAIUsage: vi.fn(),
    mockGetOrganizationMonthlyAICount: vi.fn(),
    mockWriteAudit: vi.fn(),
    mockApi: {
      ok: vi.fn((data: unknown, init?: { status?: number; headers?: unknown }) =>
        jsonResult(init?.status ?? 200, { data }, init?.headers)
      ),
      fail: vi.fn(
        (message: string, status = 400, details?: Record<string, unknown>, headers?: unknown) =>
          jsonResult(status, { error: { message, ...(details ?? {}) } }, headers)
      ),
      unauthorized: vi.fn(() => jsonResult(401, { error: { message: "Unauthorized" } })),
      parseJson: vi.fn(async (req: Request) =>
        req && typeof req.json === "function" ? await req.json() : null
      ),
      handleApiError: vi.fn((err: unknown) =>
        err instanceof Error && err.name === "ZodError"
          ? jsonResult(422, { error: { message: "Validation failed" } })
          : jsonResult(500, { error: { message: "Internal server error." } })
      ),
    },
    MockAIQuotaError,
  };
});

vi.mock("@/lib/api", () => mockApi);
vi.mock("@/lib/auth", () => ({ getCurrentContext: (...a: unknown[]) => mockGetCurrentContext(...a) }));
vi.mock("@/lib/ai/factory", () => ({ getAIProvider: (...a: unknown[]) => mockGetAIProvider(...a) }));
vi.mock("@/lib/ai/usage", () => ({
  AIQuotaError: MockAIQuotaError,
  assertUserAIAvailable: (...a: unknown[]) => mockAssertUserAIAvailable(...a),
  assertMonthlyAIQuotaAvailable: (...a: unknown[]) => mockAssertMonthlyAIQuotaAvailable(...a),
  recordAIUsage: (...a: unknown[]) => mockRecordAIUsage(...a),
  getOrganizationMonthlyAICount: (...a: unknown[]) => mockGetOrganizationMonthlyAICount(...a),
  monthlyRequestLimit: () => 2000,
}));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => mockWriteAudit(...a) }));

const OWNER_CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A", avatarUrl: null },
  organization: { id: "org-1", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-1", name: "WS", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/v1/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makeProvider(overrides?: Partial<AIProvider>): AIProvider {
  return {
    name: "openai",
    model: "gpt-test",
    isConfigured: () => true,
    complete: async () => ({ text: "", model: "gpt-test", promptTokens: 0, completionTokens: 0 }),
    completeJSON: async () => ({
      text: '{"caption": "hello"}',
      model: "gpt-test",
      promptTokens: 10,
      completionTokens: 5,
    }),
    ...overrides,
  } as AIProvider;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentContext.mockResolvedValue(OWNER_CONTEXT);
  mockGetAIProvider.mockReturnValue(makeProvider());
  mockAssertUserAIAvailable.mockImplementation(() => {});
  mockAssertMonthlyAIQuotaAvailable.mockImplementation(async () => {});
  mockRecordAIUsage.mockImplementation(async () => {});
  mockGetOrganizationMonthlyAICount.mockResolvedValue(2);
  mockWriteAudit.mockImplementation(async () => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/ai/generate", () => {
  test("returns 401 when unauthenticated", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(401);
    expect(mockApi.unauthorized).toHaveBeenCalled();
    expect(mockApi.ok).not.toHaveBeenCalled();
  });

  test("returns 403 when role lacks ai.use", async () => {
    mockGetCurrentContext.mockResolvedValue({ ...OWNER_CONTEXT, role: "VIEWER" });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(403);
    expect(mockApi.fail).toHaveBeenCalledWith(
      expect.stringContaining("permission"),
      403
    );
  });

  test("returns 400 when no workspace selected", async () => {
    mockGetCurrentContext.mockResolvedValue({ ...OWNER_CONTEXT, workspace: null });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(400);
  });

  test("returns 503 AI_NOT_CONFIGURED when provider is null", async () => {
    mockGetAIProvider.mockReturnValue(null);
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("AI_NOT_CONFIGURED");
  });

  test("returns 503 AI_NOT_CONFIGURED when provider exists but is not configured", async () => {
    mockGetAIProvider.mockReturnValue({ ...makeProvider(), isConfigured: () => false });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("AI_NOT_CONFIGURED");
  });

  test("returns 429 AI_RATE_LIMITED with Retry-After when quota exceeded", async () => {
    mockAssertMonthlyAIQuotaAvailable.mockImplementation(() => {
      throw new MockAIQuotaError("Limit reached", 90);
    });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("AI_RATE_LIMITED");
    expect(mockApi.fail).toHaveBeenCalledWith(
      expect.any(String),
      429,
      { code: "AI_RATE_LIMITED" },
      { "Retry-After": "90" }
    );
  });

  test("returns 422 with AI_INVALID_REQUEST for malformed provider JSON", async () => {
    mockGetAIProvider.mockReturnValue({
      ...makeProvider({
        completeJSON: async () => ({
          text: "not json",
          model: "gpt-test",
          promptTokens: 1,
          completionTokens: 1,
        }),
      }),
    });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("AI_INVALID_REQUEST");
    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED", errorCode: "AI_INVALID_REQUEST", feature: "captions" })
    );
  });

  test("returns 422 for provider JSON missing required fields", async () => {
    mockGetAIProvider.mockReturnValue({
      ...makeProvider({
        completeJSON: async () => ({
          text: '{"unexpected": true}',
          model: "gpt-test",
          promptTokens: 1,
          completionTokens: 1,
        }),
      }),
    });
    const res = await POST(makeRequest({ feature: "cta" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("AI_INVALID_REQUEST");
  });

  test("maps provider 429 to AI_RATE_LIMITED without leaking the raw message", async () => {
    mockGetAIProvider.mockReturnValue({
      ...makeProvider({
        completeJSON: async () => {
          throw new AIProviderError("sk-very-secret-provider-detail-rate-limited", 429);
        },
      }),
    });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("AI_RATE_LIMITED");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  test("maps provider 503 to AI_PROVIDER_UNAVAILABLE", async () => {
    mockGetAIProvider.mockReturnValue({
      ...makeProvider({
        completeJSON: async () => {
          throw new AIProviderError("provider down", 503);
        },
      }),
    });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("AI_PROVIDER_UNAVAILABLE");
  });

  test("maps provider 401 to AI_UNAUTHORIZED", async () => {
    mockGetAIProvider.mockReturnValue({
      ...makeProvider({
        completeJSON: async () => {
          throw new AIProviderError("bad key", 401);
        },
      }),
    });
    const res = await POST(makeRequest({ feature: "captions" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("AI_UNAUTHORIZED");
  });

  test("returns 422 for invalid platform in validation", async () => {
    const res = await POST(makeRequest({ feature: "captions", platform: "NOT_A_PLATFORM" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.message).toBe("Validation failed");
  });

  test("rejects oversized content", async () => {
    const res = await POST(makeRequest({ feature: "rewrite", content: "x".repeat(50000) }));
    expect(res.status).toBe(422);
  });

  test("successful generation returns structured output, usage and records usage", async () => {
    const res = await POST(
      makeRequest({ feature: "captions", content: "try me", platform: "X", language: "ar" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.generated).toBe(true);
    expect(body.data.output).toEqual({ caption: "hello" });
    expect(body.data.model).toBe("gpt-test");
    expect(body.data.usage.remaining).toBe(1998);
    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        organizationId: "org-1",
        workspaceId: "ws-1",
        feature: "captions",
        status: "SUCCESS",
        errorCode: null,
      })
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", action: "ai.generated" })
    );
  });

  test("workspace id cannot be influenced by request body (always from session)", async () => {
    const res = await POST(
      makeRequest({ feature: "captions", content: "x", workspaceId: "foreign-ws" })
    );
    expect(res.status).toBe(200);
    expect(mockRecordAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1" })
    );
  });

  test("does not leak API key into success response", async () => {
    vi.stubEnv("AI_API_KEY", "sk-should-never-leak");
    const res = await POST(makeRequest({ feature: "captions" }));
    const raw = await res.text();
    expect(raw).not.toContain("sk-should-never-leak");
  });
});