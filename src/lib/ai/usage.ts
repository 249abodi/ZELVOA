import { prisma } from "@/lib/db";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

const MONTHLY_REQUEST_DEFAULT = 2000;

export function monthlyRequestLimit(): number {
  const raw = process.env.AI_MONTHLY_REQUEST_LIMIT;
  if (raw && /^\d+$/.test(raw)) return parseInt(raw, 10);
  return MONTHLY_REQUEST_DEFAULT;
}

export async function getOrganizationMonthlyAICount(organizationId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return prisma.aIUsageRecord.count({
    where: { organizationId, createdAt: { gte: start } },
  });
}

export async function assertMonthlyAIQuotaAvailable(organizationId: string): Promise<void> {
  const used = await getOrganizationMonthlyAICount(organizationId);
  if (used >= monthlyRequestLimit()) {
    throw new Error("Monthly AI request limit reached. Upgrade your plan or wait for the next cycle.");
  }
}

const userRateLimiter = new InMemoryRateLimiter(60, 60 * 60 * 1000);

export function assertUserAIAvailable(userId: string): void {
  const result = userRateLimiter.check(`ai:${userId}`);
  if (!result.allowed) {
    throw new Error("AI rate limit reached. Please wait a moment before trying again.");
  }
}

export interface UsageInput {
  userId: string;
  organizationId: string | null;
  feature: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
}

export async function recordAIUsage(input: UsageInput): Promise<void> {
  await prisma.aIUsageRecord.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      feature: input.feature,
      modelName: input.modelName,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      costEstimate: estimateCost(input.modelName, input.promptTokens, input.completionTokens),
    },
  });
}

/** Rough per-1K-token pricing used only for the usage meter (never billed). */
function estimateCost(model: string, prompt: number, completion: number): number | null {
  const isMini = model.toLowerCase().includes("mini");
  const inputPer1k = isMini ? 0.00015 : 0.005;
  const outputPer1k = isMini ? 0.0006 : 0.015;
  return (prompt / 1000) * inputPer1k + (completion / 1000) * outputPer1k;
}