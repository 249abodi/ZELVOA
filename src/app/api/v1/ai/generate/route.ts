import { handleApiError, unauthorized, ok, fail, parseJson } from "@/lib/api";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { aiGenerateSchema } from "@/lib/validators";
import { getAIProvider } from "@/lib/ai/factory";
import { buildPrompt } from "@/lib/ai/prompts";
import {
  assertMonthlyAIQuotaAvailable,
  assertUserAIAvailable,
  AIQuotaError,
  recordAIUsage,
  getOrganizationMonthlyAICount,
  monthlyRequestLimit,
} from "@/lib/ai/usage";
import { AIProviderError, AIOutputError } from "@/lib/ai/types";
import { mapProviderError } from "@/lib/ai/openai";
import { extractStructuredJSON } from "@/lib/ai/output";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "ai.use")) {
      return fail("You do not have permission to use the AI assistant.", 403);
    }

    const provider = getAIProvider();
    if (!provider || !provider.isConfigured()) {
      return fail(
        "AI is not configured. Set AI_API_KEY to enable the assistant.",
        503,
        { code: "AI_NOT_CONFIGURED" }
      );
    }

    assertUserAIAvailable(context.user.id);
    if (context.organization?.id) {
      await assertMonthlyAIQuotaAvailable(context.organization.id);
    }

    const raw = await parseJson(request);
    const body = aiGenerateSchema.parse(raw);

    const completion = await provider.completeJSON(
      "You are the ZELVOA AI copywriter. Return only valid JSON matching the requested schema — no extra text, no preamble.",
      buildPrompt(body)
    );

    const durationMs = Date.now() - start;

    let structuredOutput: unknown;
    try {
      structuredOutput = extractStructuredJSON(completion.text, body.feature);
    } catch (err) {
      if (err instanceof AIOutputError) {
        await recordAIUsage({
          userId: context.user.id,
          organizationId: context.organization?.id ?? null,
          workspaceId: context.workspace.id,
          feature: body.feature,
          modelName: completion.model,
          promptTokens: completion.promptTokens,
          completionTokens: completion.completionTokens,
          status: "FAILED",
          errorCode: "AI_INVALID_REQUEST",
          durationMs,
        }).catch(() => {});

        return fail(err.message, 422, { code: "AI_INVALID_REQUEST" });
      }
      throw err;
    }

    await recordAIUsage({
      userId: context.user.id,
      organizationId: context.organization?.id ?? null,
      workspaceId: context.workspace.id,
      feature: body.feature,
      modelName: completion.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      status: "SUCCESS",
      errorCode: null,
      durationMs,
    });

    const orgId = context.organization?.id;
    const used = orgId ? await getOrganizationMonthlyAICount(orgId) : 0;
    const limit = monthlyRequestLimit();

    await writeAudit({
      organizationId: orgId,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "ai.generated",
      entityType: "AiGeneration",
      entityId: `${body.feature}-${Date.now()}`,
      metadata: {
        feature: body.feature,
        platform: body.platform ?? null,
        language: body.language ?? "en",
        tone: body.tone ?? null,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      },
    });

    return ok({
      generated: true,
      text: completion.text,
      output: structuredOutput,
      model: completion.model,
      usage: {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        remaining: Math.max(0, limit - used),
      },
    });
  } catch (error) {
    if (error instanceof AIQuotaError) {
      return fail(
        error.message,
        429,
        { code: "AI_RATE_LIMITED" },
        { "Retry-After": String(error.retryAfterSeconds ?? 60) }
      );
    }

    if (error instanceof AIProviderError) {
      const mapped = mapProviderError(error.status);
      return fail(mapped.message, mapped.status, { code: mapped.code });
    }

    if (error instanceof AIOutputError) {
      return fail(error.message, 422, { code: "AI_INVALID_REQUEST" });
    }

    return handleApiError(error);
  }
}
