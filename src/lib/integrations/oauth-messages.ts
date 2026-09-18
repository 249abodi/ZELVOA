const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_oauth_state:
    "Your connection attempt could not be verified. Please try again.",
  invalid_oauth_state:
    "Your connection attempt could not be verified. Please try again.",
  invalid_oauth_callback:
    "The OAuth response was invalid. Please try again.",
  oauth_state_already_used:
    "This connection attempt was already completed. Please try again.",
  oauth_state_expired:
    "Your connection attempt expired. Please try again.",
  oauth_access_denied:
    "Access was denied. No changes were made.",
  oauth_denied:
    "The provider denied the request. No changes were made.",
  oauth_token_exchange_failed:
    "The platform could not be authenticated. Please try again.",
  oauth_discovery_failed:
    "We couldn't find any Pages available to this account. Make sure you have permission to manage a Page and try again.",
  no_accounts_discovered:
    "No Pages are available for this account.",
  provider_rate_limited:
    "Too many requests. Please wait a moment and try again.",
  provider_api_error:
    "The platform could not be connected. Please try again.",
  provider_error:
    "The platform could not be connected. Please try again.",
  unauthenticated:
    "Your session has expired. Please log in again.",
  not_a_member:
    "You are not authorized for this workspace.",
  pending_not_found:
    "This Page selection is no longer available. Start a new connection to continue.",
  pending_expired:
    "This Page selection has expired. Start a new connection to continue.",
  pending_unauthorized:
    "You do not have permission to complete this Page selection.",
  pending_no_pages:
    "No Pages were found available to connect.",
  pending_no_selection:
    "Select at least one Page to continue.",
  pending_invalid_selection:
    "One or more selected Pages are no longer available. Review your selection and try again.",
  pending_already_consumed:
    "These Pages were already connected.",
  pending_confirm_failed:
    "The connection could not be completed. Please try again.",
};

const CONNECT_ERROR_TITLE = "Connection failed";
const SELECTION_ERROR_TITLE = "Page selection unavailable";

export function getPendingErrorMessage(code: string | undefined): {
  title: string;
  message: string;
} {
  if (!code) {
    return {
      title: SELECTION_ERROR_TITLE,
      message: "An unknown error occurred.",
    };
  }
  const decoded = decodeURIComponent(code);
  const message = OAUTH_ERROR_MESSAGES[decoded] ?? decoded;
  return { title: SELECTION_ERROR_TITLE, message };
}

export function getOAuthErrorMessage(code: string | undefined): {
  title: string;
  message: string;
} {
  if (!code) {
    return { title: CONNECT_ERROR_TITLE, message: "An unknown error occurred." };
  }
  const decoded = decodeURIComponent(code);
  const message = OAUTH_ERROR_MESSAGES[decoded] ?? decoded;
  return { title: CONNECT_ERROR_TITLE, message };
}
