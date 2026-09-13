import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail, parseJson } from "@/lib/api";
import { aiGenerateSchema } from "@/lib/validators";
import { getAIProvider } from "@/lib/ai/factory";
import { buildPrompt } from "@/lib/ai/prompts";
import {
  assertMonthlyAIQuotaAvailable,
  assertUserAIAvailable,
  AIQuotaError,
  recordAIUsage,
} from "@/lib/ai/usage";
import { AIProviderError } from "@/lib/ai/types";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "ai.use")) {
      return fail("You do not have permission to use the AI assistant.", 403);
    }

    const provider = getAIProvider();
    if (!provider || !provider.isConfigured()) {
      return ok(
        {
          generated: false,
          reason: "AI is not configured. Set AI_API_KEY to enable the assistant.",
        },
        { status: 501 }
      );
    }

    assertUserAIAvailable(context.user.id);
    if (context.organization?.id) {
      await assertMonthlyAIQuotaAvailable(context.organization.id);
    }

    const raw = await parseJson(request);
    const body = aiGenerateSchema.parse(raw);

    const completion = await provider.complete(
      "You are the ZELVOA AI copywriter. Return only the final content, no extra preamble.",
      buildPrompt(body)
    );

    await recordAIUsage({
      userId: context.user.id,
      organizationId: context.organization?.id ?? null,
      feature: body.feature,
      modelName: completion.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "ai.generated",
      entityType: "AiGeneration",
      entityId: `${body.feature}-${Date.now()}`,
      metadata: {
        feature: body.feature,
        platform: body.platform ?? null,
        tone: body.tone ?? null,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      },
    });

    return ok({
      generated: true,
      text: completion.text,
      model: completion.model,
      usage: {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      },
    });
  } catch (error) {
    if (error instanceof AIQuotaError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds ?? 60) } }
      );
    }
    if (error instanceof AIProviderError && (error.status === 401 || error.status === 403)) {
      return fail("The AI provider rejected the configured API key.", 502);
    }
    return handleApiError(error);
  }
}