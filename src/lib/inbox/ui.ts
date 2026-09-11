export type ConversationStatusValue = "OPEN" | "ASSIGNED" | "ARCHIVED";

export interface OptionValue<T extends string = string> {
  value: T;
  label: string;
}

/** Mirrors the Prisma `ConversationStatus` enum. Do not add values here that the backend rejects. */
export const CONVERSATION_STATUS_OPTIONS: readonly { value: ConversationStatusValue; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export function statusOptionLabel(status: ConversationStatusValue): string {
  return CONVERSATION_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function isConversationStatus(value: string): value is ConversationStatusValue {
  return CONVERSATION_STATUS_OPTIONS.some((o) => o.value === value);
}

export function assigneeOptionLabel(name: string, email: string): string {
  return `${name} · ${email}`;
}