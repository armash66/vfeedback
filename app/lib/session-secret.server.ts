export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing or empty SESSION_SECRET environment variable");
  }
  return secret;
}
