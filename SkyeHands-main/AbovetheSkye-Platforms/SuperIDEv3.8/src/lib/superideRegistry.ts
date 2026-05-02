export type SuperIdeRouteKind = "shell" | "standalone" | "backend";

export type SuperIdeShellRoute = {
  path: string;
  label: string;
  appId: string;
  kind: SuperIdeRouteKind;
  nav: boolean;
  status: "verified" | "mounted" | "planned";
};

export type SuperIdeApiRoute = {
  method: "GET" | "POST";
  path: string;
  lane: "auth" | "runtime" | "commerce" | "catalog" | "skydocxmax" | "payments" | "publishing" | "submissions" | "evidence";
  protected: boolean;
  status: "mounted" | "boundary" | "planned";
};

export const SUPERIDE_SHELL_ROUTES: SuperIdeShellRoute[] = [
  { path: "/", label: "Home", appId: "SkyeDocs", kind: "shell", nav: true, status: "verified" },
  { path: "/workspace", label: "Workspace", appId: "SkyeDocs", kind: "shell", nav: true, status: "verified" },
  { path: "/neural-space-pro", label: "Neural Space Pro", appId: "SkyeChat", kind: "shell", nav: true, status: "verified" },
  { path: "/skyechat", label: "SkyeChat", appId: "SkyeChat", kind: "shell", nav: true, status: "verified" },
  { path: "/skydocxmax", label: "SkyeDocxMax", appId: "SkyeDocxMax", kind: "shell", nav: true, status: "verified" },
  { path: "/skydocx", label: "SkyeDocxMax Legacy Alias", appId: "SkyeDocxMax", kind: "shell", nav: false, status: "verified" },
  { path: "/skyeblog", label: "SkyeBlog", appId: "SkyeBlog", kind: "shell", nav: true, status: "mounted" },
  { path: "/skydex", label: "SkyDex 4.6", appId: "SkyDex4.6", kind: "shell", nav: true, status: "mounted" },
  { path: "/sovereign-variables", label: "SovereignVariables", appId: "SovereignVariables", kind: "shell", nav: true, status: "mounted" },
  { path: "/publishing", label: "Publishing", appId: "SkyeDocxMax", kind: "backend", nav: true, status: "verified" },
  { path: "/publishing/packages", label: "Publishing Packages", appId: "SkyeDocxMax", kind: "backend", nav: false, status: "mounted" },
  { path: "/publishing/binaries", label: "Publishing Binaries", appId: "SkyeDocxMax", kind: "backend", nav: false, status: "mounted" },
  { path: "/catalog", label: "Catalog", appId: "SkyeBookx", kind: "backend", nav: true, status: "verified" },
  { path: "/commerce", label: "Commerce", appId: "SkyeBookx", kind: "backend", nav: true, status: "verified" },
  { path: "/submissions", label: "Submissions", appId: "SkyeAdmin", kind: "backend", nav: true, status: "verified" },
  { path: "/submissions/portal", label: "Submission Portal", appId: "SkyeAdmin", kind: "backend", nav: false, status: "mounted" },
  { path: "/release-history", label: "Release History", appId: "SkyeAnalytics", kind: "backend", nav: true, status: "verified" },
  { path: "/evidence", label: "Evidence", appId: "SkyeAnalytics", kind: "backend", nav: true, status: "verified" },
  { path: "/settings", label: "Settings", appId: "SkyeAdmin", kind: "backend", nav: true, status: "verified" },
  { path: "/SkyeDocxMax/index.html", label: "SkyeDocxMax Standalone", appId: "SkyeDocxMax", kind: "standalone", nav: false, status: "verified" },
  { path: "/SkyeDocxMax/homepage.html", label: "SkyeDocxMax Product Home", appId: "SkyeDocxMax", kind: "standalone", nav: false, status: "verified" },
];

export const SUPERIDE_APP_SURFACE_PATHS: Record<string, string> = {
  SkyeDocs: "/SkyeDocs/index.html",
  "SkyDex4.6": "/SkyDex4.6/index.html",
  SkyeDocxMax: "/SkyeDocxMax/index.html",
  SkyeBlog: "/SkyeBlog/index.html",
  "AE-Flow": "/AE-Flow/index.html",
  GoogleBusinessProfileRescuePlatform: "/GoogleBusinessProfileRescuePlatform/index.html",
  SovereignVariables: "/SovereignVariables/index.html",
  SkyeBookx: "/SkyeBookx/index.html",
  SkyePlatinum: "/SkyePlatinum/index.html",
  REACT2HTML: "/REACT2HTML/index.html",
  "SKYEMAIL-GEN": "/SKYEMAIL-GEN/index.html",
  "Skye-ID": "/Skye-ID/index.html",
  SkyeSheets: "/SkyeSheets/index.html",
  SkyeSlides: "/SkyeSlides/index.html",
  SkyeMail: "/SkyeMail/index.html",
  SkyeChat: "/SkyeChat/index.html",
  SkyeCalendar: "/SkyeCalendar/index.html",
  SkyeDrive: "/SkyeDrive/index.html",
  SkyeVault: "/SkyeVault/index.html",
  SkyeForms: "/SkyeForms/index.html",
  SkyeNotes: "/SkyeNotes/index.html",
  SkyeAnalytics: "/SkyeAnalytics/index.html",
  SkyeTasks: "/SkyeTasks/index.html",
  SkyeAdmin: "/SkyeAdmin/index.html",
  "kAIxU-Vision": "/kAIxU-Vision/index.html",
  "kAixu-Nexus": "/kAixu-Nexus/index.html",
  "kAIxU-Codex": "/kAIxU-Codex/index.html",
  "kAIxu-Atmos": "/kAIxu-Atmos/index.html",
  "kAIxu-Quest": "/kAIxu-Quest/index.html",
  "kAIxu-Forge": "/kAIxu-Forge/index.html",
  "kAIxu-Atlas": "/kAIxu-Atlas/index.html",
  "kAixU-Chronos": "/kAixU-Chronos/index.html",
  "kAIxu-Bestiary": "/kAIxu-Bestiary/index.html",
  "kAIxu-Mythos": "/kAIxu-Mythos/index.html",
  "kAIxU-Faction": "/kAIxU-Faction/index.html",
  "kAIxU-PrimeCommand": "/kAIxU-PrimeCommand/index.html",
  "API-Playground": "/API-Playground/index.html",
  "Smokehouse-Standalone": "/Smokehouse/index.html",
};

export const SUPERIDE_API_ROUTES: SuperIdeApiRoute[] = [
  { method: "GET", path: "/api/health", lane: "runtime", protected: false, status: "mounted" },
  { method: "GET", path: "/api/runtime/readiness", lane: "runtime", protected: false, status: "boundary" },
  { method: "GET", path: "/api/runtime/summary", lane: "runtime", protected: true, status: "mounted" },
  { method: "GET", path: "/api/runtime/commerce", lane: "runtime", protected: true, status: "mounted" },
  { method: "POST", path: "/api/auth/login", lane: "auth", protected: false, status: "mounted" },
  { method: "GET", path: "/api/auth/verify", lane: "auth", protected: true, status: "mounted" },
  { method: "POST", path: "/api/auth/refresh", lane: "auth", protected: false, status: "mounted" },
  { method: "POST", path: "/api/auth/logout", lane: "auth", protected: true, status: "mounted" },
  { method: "GET", path: "/api/commerce/library", lane: "commerce", protected: true, status: "mounted" },
  { method: "POST", path: "/api/commerce/fulfillment-token", lane: "commerce", protected: true, status: "mounted" },
  { method: "GET", path: "/api/catalog/titles", lane: "catalog", protected: true, status: "mounted" },
  { method: "POST", path: "/api/catalog/titles", lane: "catalog", protected: true, status: "mounted" },
  { method: "GET", path: "/api/release-history", lane: "runtime", protected: true, status: "mounted" },
  { method: "GET", path: "/api/skydocxmax/documents", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/skydocxmax/documents", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/skydocxmax/import", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/skydocxmax/export", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/skydocxmax/share", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/skydocxmax/publish", lane: "skydocxmax", protected: true, status: "mounted" },
  { method: "POST", path: "/api/payments/checkout/session", lane: "payments", protected: true, status: "mounted" },
  { method: "POST", path: "/api/payments/webhook/stripe", lane: "payments", protected: false, status: "boundary" },
  { method: "POST", path: "/api/payments/session/reconcile", lane: "payments", protected: true, status: "mounted" },
  { method: "POST", path: "/api/publishing/package", lane: "publishing", protected: true, status: "mounted" },
  { method: "POST", path: "/api/publishing/binaries", lane: "publishing", protected: true, status: "mounted" },
  { method: "GET", path: "/api/publishing/packages", lane: "publishing", protected: true, status: "mounted" },
  { method: "GET", path: "/api/submissions/jobs", lane: "submissions", protected: true, status: "mounted" },
  { method: "POST", path: "/api/submissions/jobs", lane: "submissions", protected: true, status: "mounted" },
  { method: "POST", path: "/api/submissions/dispatch", lane: "submissions", protected: true, status: "mounted" },
  { method: "POST", path: "/api/submissions/status", lane: "submissions", protected: true, status: "mounted" },
  { method: "POST", path: "/api/submissions/cancel", lane: "submissions", protected: true, status: "mounted" },
  { method: "GET", path: "/api/evidence/release-gates", lane: "evidence", protected: true, status: "mounted" },
  { method: "GET", path: "/api/evidence/artifacts", lane: "evidence", protected: true, status: "mounted" },
  { method: "GET", path: "/api/evidence/smoke", lane: "evidence", protected: true, status: "mounted" },
];

export function buildPathAppAliases(): Record<string, string> {
  return Object.fromEntries(
    SUPERIDE_SHELL_ROUTES
      .filter((route) => route.kind !== "standalone")
      .map((route) => [route.path.toLowerCase(), route.appId])
  );
}

export function buildShellRouteDefaultApps(): Record<string, string> {
  return Object.fromEntries(
    SUPERIDE_SHELL_ROUTES
      .filter((route) => route.kind === "backend")
      .map((route) => [route.path.replace(/^\//, ""), route.appId])
  );
}
