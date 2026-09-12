export type ApprovalActionValue = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export interface ApprovalTransition {
  approvalStatus: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  postStatus: "APPROVED" | "CHANGES_REQUESTED" | "DRAFT";
}

const TRANSITIONS: Record<ApprovalActionValue, ApprovalTransition | null> = {
  APPROVE: { approvalStatus: "APPROVED", postStatus: "APPROVED" },
  REQUEST_CHANGES: { approvalStatus: "CHANGES_REQUESTED", postStatus: "CHANGES_REQUESTED" },
  REJECT: { approvalStatus: "REJECTED", postStatus: "DRAFT" },
};

export function resolveApprovalTransition(action: ApprovalActionValue): ApprovalTransition {
  const transition = TRANSITIONS[action];
  if (!transition) throw new Error(`Unsupported approval action: ${action}`);
  return transition;
}