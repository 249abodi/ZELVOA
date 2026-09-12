import type { UserRole } from "@prisma/client";

export type Permission =
  | "org.view"
  | "org.manage"
  | "workspace.manage"
  | "member.invite"
  | "member.remove"
  | "member.manage"
  | "post.view"
  | "post.create"
  | "post.edit"
  | "post.delete"
  | "post.publish"
  | "post.approve"
  | "media.view"
  | "media.manage"
  | "accounts.view"
  | "accounts.manage"
  | "analytics.view"
  | "campaign.manage"
  | "inbox.view"
  | "inbox.reply"
  | "inbox.assign"
  | "billing.manage"
  | "settings.manage"
  | "ai.use"
  | "admin.access";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    "org.view", "org.manage", "workspace.manage", "member.invite", "member.remove", "member.manage",
    "post.view", "post.create", "post.edit", "post.delete", "post.publish", "post.approve",
    "media.view", "media.manage", "accounts.view", "accounts.manage", "analytics.view", "campaign.manage", "inbox.view", "inbox.reply", "inbox.assign",
    "billing.manage", "settings.manage", "ai.use", "admin.access",
  ],
  ADMIN: [
    "org.view", "workspace.manage", "member.invite", "member.remove", "member.manage",
    "post.view", "post.create", "post.edit", "post.delete", "post.publish", "post.approve",
    "media.view", "media.manage", "accounts.view", "accounts.manage", "analytics.view", "campaign.manage", "inbox.view", "inbox.reply", "inbox.assign",
    "billing.manage", "settings.manage", "ai.use",
  ],
  SOCIAL_MEDIA_MANAGER: [
    "post.view", "post.create", "post.edit", "post.delete", "post.publish",
    "media.view", "media.manage", "accounts.view", "accounts.manage", "analytics.view", "campaign.manage", "inbox.view", "inbox.reply", "inbox.assign",
    "ai.use",
  ],
  CONTENT_MANAGER: [
    "post.view", "post.create", "post.edit", "media.view", "media.manage", "accounts.view", "campaign.manage", "ai.use",
  ],
  DESIGNER: [
    "post.view", "media.view", "media.manage",
  ],
  VIEWER: [
    "post.view", "media.view", "analytics.view", "inbox.view",
  ],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function can(
  role: UserRole | string | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return roleHasPermission(role as UserRole, permission);
}

export const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "OWNER", label: "Owner", description: "Full access." },
  { value: "ADMIN", label: "Admin", description: "Manage workspace and members." },
  { value: "CONTENT_MANAGER", label: "Content Manager", description: "Create and edit content." },
  { value: "DESIGNER", label: "Designer", description: "Manage media and design." },
  { value: "SOCIAL_MEDIA_MANAGER", label: "Social Media Manager", description: "Manage posts and publishing." },
  { value: "VIEWER", label: "Viewer", description: "Read-only access." },
];