import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  organizationName: z.string().min(2, "Workspace name is required").max(100).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  timezone: z.string().optional(),
  defaultLocale: z.string().optional(),
});

export const createMediaAssetSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  type: z.enum(["IMAGE", "VIDEO", "DOCUMENT"]),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  folderId: z.string().optional(),
});

export const updateMediaAssetSchema = z.object({
  fileName: z.string().min(1).max(255).optional(),
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  folderId: z.string().nullable().optional(),
});

export const bulkMediaActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(["delete", "move", "tag"]),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const createMediaFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
});

export const updateMediaFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().nullable().optional(),
});

export const platformEnum = z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "X", "YOUTUBE"]);

export const createPostSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, "Post content is required").max(10000),
  postType: z.enum(["STANDARD", "STORY", "REEL", "CAROUSEL", "VIDEO"]).optional(),
  socialAccountIds: z.array(z.string()).min(1, "Select at least one platform"),
  mediaAssetIds: z.array(z.string()).optional(),
  scheduledFor: z.string().datetime().optional(),
  variants: z
    .array(
      z.object({
        platform: platformEnum,
        content: z.string().max(10000),
        firstComment: z.string().max(10000).optional(),
      })
    )
    .optional(),
});

export const updatePostSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  postType: z.enum(["STANDARD", "STORY", "REEL", "CAROUSEL", "VIDEO"]).optional(),
  status: z.enum(["DRAFT", "SCHEDULED"]).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  socialAccountIds: z.array(z.string()).optional(),
  mediaAssetIds: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        platform: platformEnum,
        content: z.string().max(10000),
        firstComment: z.string().max(10000).optional(),
      })
    )
    .optional(),
});

export const calendarQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  platform: platformEnum.optional(),
  status: z
    .enum([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "SCHEDULED",
      "PROCESSING",
      "PUBLISHED",
      "FAILED",
    ])
    .optional(),
});

export const campaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  goal: z.string().max(1000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});

export const campaignUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    goal: z.string().max(1000).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export const campaignPostSchema = z.object({
  postId: z.string().min(1),
  socialAccountId: z.string().min(1).optional(),
});

export const approvalSubmitSchema = z.object({
  postId: z.string().min(1),
  comment: z.string().max(2000).optional(),
});

export const approvalActionSchema = z.object({
  action: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
  comment: z.string().max(2000).optional(),
});

export const analyticsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: platformEnum.optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const analyticsSyncSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const inboxListQuerySchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "ARCHIVED"]).optional(),
  assignee: z.enum(["me", "unassigned", "any"]).optional(),
  query: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const inboxUpdateSchema = z
  .object({
    status: z.enum(["OPEN", "ASSIGNED", "ARCHIVED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    notes: z.string().max(4000).nullable().optional(),
    assigneeId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required.",
  });

export const inboxReplySchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export const aiGenerateSchema = z.object({
  feature: z.enum(["captions", "hashtags", "cta", "ideas", "rewrite", "tone"]),
  content: z.string().max(40000).optional(),
  tone: z
    .enum(["professional", "friendly", "luxury", "playful", "bold", "neutral"])
    .optional(),
  platform: platformEnum.optional(),
  language: z.enum(["en", "ar"]).optional().default("en"),
  length: z.enum(["short", "medium", "long"]).optional(),
  count: z.number().int().min(1).max(6).optional(),
});

export const connectAccountSchema = z.object({
  platform: platformEnum,
  redirectUri: z.string().url().optional(),
  connectsTo: z.string().optional(),
});

export const callbackQuerySchema = z
  .object({
    platform: platformEnum,
    state: z.string().min(1),
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    devToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.code && !data.error) {
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "A callback must include either an authorization code or an error.",
      });
    }
  });

export const refreshAccountSchema = z.object({
  accountId: z.string().min(1),
});

export const reconnectAccountSchema = z.object({
  accountId: z.string().min(1),
  redirectUri: z.string().url().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  username: z.string().max(120).nullable().optional(),
});

export const publishPostSchema = z.object({
  socialAccountIds: z.array(z.string().min(1)).min(1).optional(),
});

export const schedulerRunSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const notificationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const notificationsMarkReadSchema = z
  .object({
    ids: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .refine((data) => data.ids || data.all, {
    message: "Provide at least one notification id or use all.",
  });