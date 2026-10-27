/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, val] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }

  const isCliCommand = process.argv.some((arg) => arg.includes("typegen") || arg.includes("reveal"));
  if (
    !isCliCommand &&
    command === "build" &&
    process.env.NODE_ENV === "production" &&
    process.env.VFEEDBACK_DEV_AUTH === "1"
  ) {
    throw new Error("VFEEDBACK_DEV_AUTH cannot be enabled in production");
  }

  return {
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@opentelemetry/semantic-conventions": path.resolve(
          __dirname,
          "node_modules/@opentelemetry/semantic-conventions/build/src/index.js",
        ),
      },
    },
    test: {
      server: {
        deps: {
          inline: true,
          fallbackCJS: true,
        },
      },
      env: {
        SESSION_SECRET: "vitest-test-session-secret-at-least-32-chars",
        BETTER_AUTH_SECRET: "vitest-test-better-auth-secret-32-chars",
      },
    },
  };
});
