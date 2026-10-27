export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return "/";
  }
  const origin = "http://vfeedback.invalid";
  try {
    return new URL(value, origin).origin === origin ? value : "/";
  } catch {
    return "/";
  }
}
