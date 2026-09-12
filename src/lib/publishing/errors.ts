import type { PublishErrorStage } from "@prisma/client";

export type PublishingErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_IMPLEMENTED"
  | "NOT_AUTHENTICATED"
  | "AUTH_EXPIRED"
  | "ACCOUNT_INVALID"
  | "CONTENT_INVALID"
  | "MEDIA_INVALID"
  | "MEDIA_UNAVAILABLE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_DUPLICATE"
  | "PROVIDER_PERMISSION"
  | "PROVIDER_ERROR"
  | "RESULT_STORE"
  | "NOTIFICATION";

export interface PublishingErrorOptions {
  code: PublishingErrorCode;
  stage: PublishErrorStage;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export class PublishingError extends Error {
  readonly code: PublishingErrorCode;
  readonly stage: PublishErrorStage;
  readonly retryable: boolean;

  constructor(opts: PublishingErrorOptions) {
    super(opts.message, { cause: opts.cause });
    this.name = "PublishingError";
    this.code = opts.code;
    this.stage = opts.stage;
    this.retryable = opts.retryable;
  }
}

const PERMANENT_CODES: PublishingErrorCode[] = [
  "NOT_CONFIGURED",
  "NOT_IMPLEMENTED",
  "CONTENT_INVALID",
  "MEDIA_INVALID",
  "PROVIDER_PERMISSION",
  "PROVIDER_DUPLICATE",
];

export const SAFE_MESSAGES: Record<PublishingErrorCode, string> = {
  NOT_CONFIGURED: "This platform integration is not configured yet.",
  NOT_IMPLEMENTED: "Publishing is not available for this platform yet.",
  NOT_AUTHENTICATED: "The connected account is no longer authenticated.",
  AUTH_EXPIRED: "The connected account token has expired and could not be refreshed.",
  ACCOUNT_INVALID: "The connected account is invalid.",
  CONTENT_INVALID: "The post content does not meet this platform's requirements.",
  MEDIA_INVALID: "The attached media is not valid for this platform.",
  MEDIA_UNAVAILABLE: "Attached media could not be resolved to a public URL.",
  PROVIDER_RATE_LIMITED: "The platform is rate limiting requests. It will be retried later.",
  PROVIDER_DUPLICATE: "This post was already published on the platform.",
  PROVIDER_PERMISSION: "The connected account lacks permission to publish.",
  PROVIDER_ERROR: "The platform returned an error while publishing.",
  RESULT_STORE: "The post was published but its result could not be recorded.",
  NOTIFICATION: "The post was published but the notification could not be created.",
};

export function safeMessage(code: PublishingErrorCode): string {
  return SAFE_MESSAGES[code] ?? "Unexpected publishing error.";
}

export function isPermanent(code: PublishingErrorCode): boolean {
  return PERMANENT_CODES.includes(code);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}