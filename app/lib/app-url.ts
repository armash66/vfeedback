export function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing APP_URL environment variable in production. Please set it in your environment.");
    }
    return "http://localhost:5173";
  }
  return url.replace(/\/+$/, "");
}
