import { describe, expect, it } from "vitest";
import { getOAuthErrorMessage, getPendingErrorMessage } from "@/lib/integrations/oauth-messages";

describe("getOAuthErrorMessage", () => {
  it("returns the correct message for oauth_access_denied", () => {
    const result = getOAuthErrorMessage("oauth_access_denied");
    expect(result.message).toBe("Access was denied. No changes were made.");
    expect(result.title).toBe("Connection failed");
  });

  it("returns the correct message for oauth_state_expired", () => {
    expect(getOAuthErrorMessage("oauth_state_expired").message).toBe(
      "Your connection attempt expired. Please try again."
    );
  });

  it("returns the correct message for oauth_discovery_failed", () => {
    expect(getOAuthErrorMessage("oauth_discovery_failed").message).toContain(
      "Make sure you have permission to manage a Page"
    );
  });

  it("returns the correct message for no_accounts_discovered", () => {
    expect(getOAuthErrorMessage("no_accounts_discovered").message).toBe(
      "No Pages are available for this account."
    );
  });

  it("returns the correct message for oauth_token_exchange_failed", () => {
    expect(getOAuthErrorMessage("oauth_token_exchange_failed").message).toBe(
      "The platform could not be authenticated. Please try again."
    );
  });

  it("returns a generic message for unknown codes", () => {
    expect(getOAuthErrorMessage("something_new").message).toBe(
      "something_new"
    );
  });

  it("returns a default for undefined", () => {
    expect(getOAuthErrorMessage(undefined).message).toBe(
      "An unknown error occurred."
    );
  });

  it("does not expose internal details", () => {
    const result = getOAuthErrorMessage("oauth_discovery_failed");
    expect(result.message).not.toContain("PublishingError");
    expect(result.message).not.toContain("PROVIDER_PERMISSION");
    expect(result.message).not.toContain("stack");
  });

  it("decodes URI-encoded input", () => {
    const encoded = encodeURIComponent("oauth_access_denied");
    expect(getOAuthErrorMessage(encoded).message).toBe(
      "Access was denied. No changes were made."
    );
  });
});

describe("getPendingErrorMessage", () => {
  it("maps pending codes to selection screens", () => {
    expect(getPendingErrorMessage("pending_expired").message).toMatch(/expired/i);
    expect(getPendingErrorMessage("pending_not_found").message).toMatch(/no longer available/i);
    expect(getPendingErrorMessage("pending_unauthorized").message).toMatch(/not have permission/i);
    expect(getPendingErrorMessage("pending_no_pages").message).toMatch(/no pages/i);
    expect(getPendingErrorMessage("pending_no_selection").message).toMatch(/at least one page/i);
    expect(getPendingErrorMessage("pending_invalid_selection").message).toMatch(/no longer available/i);
    expect(getPendingErrorMessage("pending_already_consumed").message).toMatch(/already/i);
    expect(getPendingErrorMessage("pending_confirm_failed").message).toMatch(/try again/i);
  });

  it("uses the selection error title for all pending errors", () => {
    const result = getPendingErrorMessage("pending_expired");
    expect(result.title).toBe("Page selection unavailable");
  });

  it("decodes URI-encoded pending codes", () => {
    const encoded = encodeURIComponent("pending_unauthorized");
    expect(getPendingErrorMessage(encoded).message).toMatch(/not have permission/i);
  });

  it("falls back to the raw code for unknown pending codes", () => {
    expect(getPendingErrorMessage("something_else").message).toBe("something_else");
  });
});
