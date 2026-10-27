export function mapAuthErrorCode(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }

  const normalized = code.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "invalid_oauth_configuration") {
    return "Sign-in configuration is unavailable. Please notify an administrator.";
  }

  if (normalized === "account_not_linked") {
    return "This email is already associated with another sign-in method.";
  }

  if (normalized === "name_is_missing") {
    return "Your account profile did not provide a display name.";
  }

  if (normalized === "access_denied") {
    return "Sign-in was cancelled or access was denied.";
  }

  if (normalized.includes("state")) {
    return "Sign-in could not be verified. Please try again.";
  }

  if (normalized.includes("issuer")) {
    return "Sign-in could not be verified. Please try again.";
  }

  return "Sign-in did not complete. Please try again.";
}
