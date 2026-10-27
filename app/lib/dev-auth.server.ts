import { createHmac, timingSafeEqual } from "node:crypto";
import { DEV_PERSONAS, findPersona, type DevPersona } from "./dev-personas.js";

export const DEV_PERSONA_COOKIE = "vfeedback_dev_persona";

export function devAuthEnabled(): boolean {
  try {
    process.loadEnvFile?.(".env");
  } catch {}
  if (process.env.NODE_ENV === "production" && process.env.VFEEDBACK_DEV_AUTH === "1") {
    throw new Error("VFEEDBACK_DEV_AUTH cannot be enabled in production");
  }
  return process.env.NODE_ENV !== "production" && process.env.VFEEDBACK_DEV_AUTH === "1";
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for signing dev auth cookies");
  }
  return secret;
}

export function signPersonaCookie(key: string): string {
  const secret = getSecret();
  const signature = createHmac("sha256", secret).update(key).digest("hex");
  return `${key}.${signature}`;
}

export function verifyPersonaCookie(cookieValue: string | undefined | null): DevPersona | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [key, signature] = parts;
  const persona = findPersona(key);
  if (!persona) return null;

  try {
    const secret = getSecret();
    const expectedSignature = createHmac("sha256", secret).update(key).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    return persona;
  } catch {
    return null;
  }
}

export function parseCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";");
  for (const c of cookies) {
    const [k, ...v] = c.trim().split("=");
    if (k === name) {
      return decodeURIComponent(v.join("="));
    }
  }
  return null;
}

export function getDevIdentityFromRequest(request: Request): {
  userId: string;
  email: string;
  name: string;
} | null {
  if (!devAuthEnabled()) return null;
  const cookieHeader = request.headers.get("cookie");
  const rawValue = parseCookie(cookieHeader, DEV_PERSONA_COOKIE);
  const persona = verifyPersonaCookie(rawValue);
  if (!persona) return null;
  return {
    userId: `dev-${persona.key}`,
    email: persona.email,
    name: persona.name,
  };
}

export function createPersonaCookieHeader(key: string): string {
  const signed = signPersonaCookie(key);
  return `${DEV_PERSONA_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax`;
}

export function clearPersonaCookieHeader(): string {
  return `${DEV_PERSONA_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
