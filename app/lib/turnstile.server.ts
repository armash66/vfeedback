export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

export function isTurnstileEnabled(): boolean {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return Boolean(siteKey && secretKey);
}

export async function verifyTurnstileToken(token: string | null | undefined): Promise<TurnstileVerifyResult> {
  // If Turnstile is not enabled (keys are empty or unset), skip verification
  if (!isTurnstileEnabled()) {
    return { success: true };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return { success: false, error: "Please complete the verification challenge." };
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY!.trim();

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    // NOTE: Hard constraint: Do NOT send visitor's IP to Cloudflare

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Turnstile siteverify HTTP error: ${response.status}`);
      return { success: false, error: "Verification failed. Please try again." };
    }

    const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return { success: false, error: "Verification failed. Please try again." };
    }

    return { success: true };
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      console.warn("Turnstile siteverify timed out or aborted:", error?.message);
      return { success: false, error: "Verification could not be completed. Please try again." };
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error verifying Turnstile token:", msg);
    return { success: false, error: "Verification failed. Please try again." };
  }
}
