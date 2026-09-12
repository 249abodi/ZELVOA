import { describe, expect, test } from "vitest";
import { resolveApprovalTransition } from "@/lib/approvals/state";

describe("resolveApprovalTransition", () => {
  test("APPROVE moves approval to APPROVED and post to APPROVED", () => {
    expect(resolveApprovalTransition("APPROVE")).toEqual({
      approvalStatus: "APPROVED",
      postStatus: "APPROVED",
    });
  });

  test("REQUEST_CHANGES moves post back to CHANGES_REQUESTED", () => {
    expect(resolveApprovalTransition("REQUEST_CHANGES")).toEqual({
      approvalStatus: "CHANGES_REQUESTED",
      postStatus: "CHANGES_REQUESTED",
    });
  });

  test("REJECT moves approval to REJECTED and post back to DRAFT", () => {
    expect(resolveApprovalTransition("REJECT")).toEqual({
      approvalStatus: "REJECTED",
      postStatus: "DRAFT",
    });
  });

  test("unknown actions throw", () => {
    expect(() => resolveApprovalTransition("CANCEL" as never)).toThrow();
  });

  test("every valid action resolves to a concrete end state", () => {
    for (const action of ["APPROVE", "REQUEST_CHANGES", "REJECT"] as const) {
      const t = resolveApprovalTransition(action);
      expect(t.approvalStatus).toMatch(/^(APPROVED|CHANGES_REQUESTED|REJECTED)$/);
      expect(t.postStatus).not.toBe("PENDING_APPROVAL");
    }
  });
});