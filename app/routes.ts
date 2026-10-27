import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("report/:type", "routes/report.tsx"),
  route("done/:code", "routes/done.tsx"),
  route("status", "routes/status.tsx"),
  route("healthz", "routes/healthz.ts"),
  route("api/auth/*", "routes/api.auth.$.ts"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
] satisfies RouteConfig;
