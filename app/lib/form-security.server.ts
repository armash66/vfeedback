import { createHmac, timingSafeEqual } from "node:crypto";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function generateFormToken(): string {
  const secret = process.env.SESSION_SECRET || "fallback-secret";
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", secret).update(`fill-time:${timestamp}`).digest("hex");
  return `${timestamp}.${signature}`;
}

export function verifyFormToken(token: unknown, nowMs: number = Date.now()): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [timestampStr, signature] = parts;
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const secret = process.env.SESSION_SECRET || "fallback-secret";
  const expectedSignature = createHmac("sha256", secret).update(`fill-time:${timestampStr}`).digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
  } catch {
    return false;
  }

  const elapsed = nowMs - timestamp;
  // Reject if submitted in under 3 seconds
  if (elapsed < 3000) {
    return false;
  }
  // Reject if older than 24 hours
  if (elapsed > 24 * 60 * 60 * 1000) {
    return false;
  }
  // Reject if timestamp is in the future
  if (elapsed < -60000) {
    return false;
  }

  return true;
}

export function isHoneypotTriggered(formData: FormData): boolean {
  const website = formData.get("website");
  return typeof website === "string" && website.trim().length > 0;
}
