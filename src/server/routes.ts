import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const DEFAULT_SURREYALIGN_API_BASE = "https://surreyalign.org/api/external/v1";
const SA_API_BASE = (
  process.env.SURREYALIGN_PWA_UPSTREAM_API_BASE?.trim()
  || DEFAULT_SURREYALIGN_API_BASE
).replace(/\/+$/, "");

const FORWARDED_RESPONSE_HEADERS = ["cache-control", "etag", "last-modified", "vary"] as const;

function forwardSafeResponseHeaders(response: globalThis.Response, res: Response) {
  for (const header of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(header);
    if (value) {
      res.setHeader(header, value);
    }
  }
}

async function proxyRequest(
  req: Request,
  res: Response,
  method: string,
  path: string,
  options: { includeBody?: boolean; includeQuery?: boolean; requireAuth?: boolean } = {}
) {
  const { includeBody = false, includeQuery = true, requireAuth = true } = options;
  try {
    const authHeader = req.headers.authorization;
    if (requireAuth && !authHeader) {
      return res.status(401).json({ message: "Unauthenticated." });
    }
    const url = new URL(path, SA_API_BASE + "/");
    if (includeQuery) {
      for (const [key, val] of Object.entries(req.query)) {
        if (typeof val === "string") url.searchParams.set(key, val);
      }
    }
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;
    if (includeBody) headers["Content-Type"] = "application/json";

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: includeBody ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    forwardSafeResponseHeaders(response, res);
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ success: false, message: "Unable to reach SurreyAlign." });
  }
}

function g(app: Express, route: string, apiPath: string | ((req: Request) => string)) {
  app.get(route, (req, res) => proxyRequest(req, res, "GET", typeof apiPath === "function" ? apiPath(req) : apiPath));
}

function p(app: Express, route: string, apiPath: string | ((req: Request) => string), includeBody = true) {
  app.post(route, (req, res) => proxyRequest(req, res, "POST", typeof apiPath === "function" ? apiPath(req) : apiPath, { includeBody }));
}

function pa(app: Express, route: string, apiPath: string | ((req: Request) => string)) {
  app.patch(route, (req, res) => proxyRequest(req, res, "PATCH", typeof apiPath === "function" ? apiPath(req) : apiPath, { includeBody: true }));
}

function d(app: Express, route: string, apiPath: string | ((req: Request) => string), includeBody = false) {
  app.delete(route, (req, res) => proxyRequest(req, res, "DELETE", typeof apiPath === "function" ? apiPath(req) : apiPath, { includeBody }));
}

function firstQueryValue(value: Request["query"][string]): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim() !== "") {
    return value[0];
  }

  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/login", (req, res) =>
    proxyRequest(req, res, "POST", "auth/login", { includeBody: true, requireAuth: false })
  );
  g(app, "/api/auth/me", "auth/me");
  p(app, "/api/auth/logout", "auth/logout", false);

  g(app, "/api/goals", "goals");
  g(app, "/api/goals/:goalId/execution", (req) => `goals/${req.params.goalId}/execution`);
  g(app, "/api/leadership-intelligence/inbox", "leadership-intelligence/inbox");
  g(app, "/api/leadership-intelligence/insights/:insightId", (req) => `leadership-intelligence/insights/${req.params.insightId}`);
  p(app, "/api/leadership-intelligence/insights/:insightId/accept", (req) => `leadership-intelligence/insights/${req.params.insightId}/accept`, false);
  p(app, "/api/leadership-intelligence/insights/:insightId/defer", (req) => `leadership-intelligence/insights/${req.params.insightId}/defer`);
  p(app, "/api/leadership-intelligence/insights/:insightId/dismiss", (req) => `leadership-intelligence/insights/${req.params.insightId}/dismiss`);
  app.get("/api/command-centers/bishop", (req, res) => {
    const search = new URLSearchParams();
    const wardId = firstQueryValue(req.query.wardId);
    const weekStart = firstQueryValue(req.query.weekStart);

    if (wardId) {
      search.set("ward_id", wardId);
    }

    if (weekStart) {
      search.set("week_start", weekStart);
    }

    const apiPath = search.size > 0
      ? `command-centers/bishop?${search.toString()}`
      : "command-centers/bishop";

    return proxyRequest(req, res, "GET", apiPath, { includeQuery: false });
  });
  app.get("/api/carry-forward/entities/:entityType/:entityId", (req, res) => {
    const search = new URLSearchParams();
    const status = firstQueryValue(req.query.status);
    const limit = firstQueryValue(req.query.limit);
    const meetingSurface = firstQueryValue(req.query.meeting_surface);

    if (status) {
      search.set("status", status);
    }

    if (limit) {
      search.set("limit", limit);
    }

    if (meetingSurface) {
      search.set("meeting_surface", meetingSurface);
    }

    const basePath = `carry-forward/entities/${req.params.entityType}/${req.params.entityId}`;
    const apiPath = search.size > 0
      ? `${basePath}?${search.toString()}`
      : basePath;

    return proxyRequest(req, res, "GET", apiPath, { includeQuery: false });
  });
  g(app, "/api/carry-forward/items/:itemId", (req) => `carry-forward/items/${req.params.itemId}`);
  p(app, "/api/carry-forward/items/:itemId/report-requests", (req) => `carry-forward/items/${req.params.itemId}/report-requests`);
  p(app, "/api/carry-forward/report-requests/:reportRequestId/responses", (req) => `carry-forward/report-requests/${req.params.reportRequestId}/responses`);
  p(app, "/api/carry-forward/items/:itemId/resolve", (req) => `carry-forward/items/${req.params.itemId}/resolve`);
  p(app, "/api/carry-forward/items/:itemId/dismiss", (req) => `carry-forward/items/${req.params.itemId}/dismiss`);

  g(app, "/api/reference/callings", "reference/callings");
  g(app, "/api/reference/wards", "reference/wards");
  g(app, "/api/reference/organizations", "reference/organizations");
  g(app, "/api/reference/people/search", "reference/people/search");
  g(app, "/api/reference/users/search", "reference/users/search");
  g(app, "/api/reference/current-holders/:callingId", (req) => `reference/current-holders/${req.params.callingId}`);

  g(app, "/api/calling-requests", "calling-requests");
  p(app, "/api/calling-requests", "calling-requests");
  g(app, "/api/calling-requests/submission-context", "calling-requests/submission-context");
  g(app, "/api/calling-requests/pending-action-count", "calling-requests/pending-action-count");
  g(app, "/api/calling-requests/action-required", "calling-requests/action-required");
  g(app, "/api/calling-requests/:id", (req) => `calling-requests/${req.params.id}`);
  p(app, "/api/calling-requests/:id/submit", (req) => `calling-requests/${req.params.id}/submit`, false);
  p(app, "/api/calling-requests/:id/move-to-discussion", (req) => `calling-requests/${req.params.id}/move-to-discussion`, false);
  p(app, "/api/calling-requests/:id/move-to-voting", (req) => `calling-requests/${req.params.id}/move-to-voting`, false);
  p(app, "/api/calling-requests/:id/vote", (req) => `calling-requests/${req.params.id}/vote`);
  p(app, "/api/calling-requests/:id/decide", (req) => `calling-requests/${req.params.id}/decide`);
  p(app, "/api/calling-requests/:id/cancel", (req) => `calling-requests/${req.params.id}/cancel`, false);
  p(app, "/api/calling-requests/:id/presidency-recommendation", (req) => `calling-requests/${req.params.id}/presidency-recommendation`);
  p(app, "/api/calling-requests/:id/feedback", (req) => `calling-requests/${req.params.id}/feedback`);
  p(app, "/api/calling-requests/:id/comments", (req) => `calling-requests/${req.params.id}/comments`);
  p(app, "/api/calling-requests/:id/request-feedback", (req) => `calling-requests/${req.params.id}/request-feedback`);
  p(app, "/api/calling-requests/:id/respond-feedback/:fbId", (req) => `calling-requests/${req.params.id}/respond-feedback/${req.params.fbId}`);
  p(app, "/api/calling-requests/:id/assign-interviewer", (req) => `calling-requests/${req.params.id}/assign-interviewer`);
  pa(app, "/api/calling-requests/:id/steps/:stepId", (req) => `calling-requests/${req.params.id}/steps/${req.params.stepId}`);
  p(app, "/api/calling-requests/:id/select-nominee", (req) => `calling-requests/${req.params.id}/select-nominee`);
  p(app, "/api/calling-requests/:id/complete", (req) => `calling-requests/${req.params.id}/complete`, false);
  g(app, "/api/calling-requests/:id/interviewer-candidates", (req) => `calling-requests/${req.params.id}/interviewer-candidates`);
  g(app, "/api/calling-requests/:id/feedback-candidates", (req) => `calling-requests/${req.params.id}/feedback-candidates`);

  g(app, "/api/notifications", "notifications");
  g(app, "/api/notifications/push-config", "notifications/push-config");
  p(app, "/api/notifications/push-subscriptions", "notifications/push-subscriptions");
  d(app, "/api/notifications/push-subscriptions/current", "notifications/push-subscriptions/current", true);
  p(app, "/api/notifications/read-all", "notifications/read-all", false);
  p(app, "/api/notifications/:id/read", (req) => `notifications/${req.params.id}/read`, false);
  p(app, "/api/notifications/:id/unread", (req) => `notifications/${req.params.id}/unread`, false);
  d(app, "/api/notifications/:id", (req) => `notifications/${req.params.id}`);

  g(app, "/api/sunday-business/sunday", "sunday-business/sunday");
  g(app, "/api/sunday-business/outstanding", "sunday-business/outstanding");
  g(app, "/api/sunday-business/:id", (req) => `sunday-business/${req.params.id}`);
  p(app, "/api/sunday-business/:id/complete-ward", (req) => `sunday-business/${req.params.id}/complete-ward`);

  g(app, "/api/speaking-assignments", "speaking-assignments");
  g(app, "/api/speaking-assignments/schedule", "speaking-assignments/schedule");
  g(app, "/api/speaking-assignments/my-schedule", "speaking-assignments/my-schedule");
  g(app, "/api/speaking-assignments/pending-action-count", "speaking-assignments/pending-action-count");
  p(app, "/api/speaking-assignments/unavailable", "speaking-assignments/unavailable");
  d(app, "/api/speaking-assignments/unavailable/:id", (req) => `speaking-assignments/unavailable/${req.params.id}`);
  p(app, "/api/speaking-assignments/swap", "speaking-assignments/swap");
  p(app, "/api/speaking-assignments/swap/:id/respond", (req) => `speaking-assignments/swap/${req.params.id}/respond`);
  g(app, "/api/announcements/active", "announcements/active");
  g(app, "/api/sacrament-planner/overview", "sacrament-planner/overview");
  p(app, "/api/sacrament-planner/:meetingId/announcements/reviewed", (req) => `sacrament-planner/${req.params.meetingId}/announcements/reviewed`, false);
  g(app, "/api/sacrament-planner/:meetingId/speaker-follow-up", (req) => `sacrament-planner/${req.params.meetingId}/speaker-follow-up`);
  p(app, "/api/sacrament-planner/:meetingId/speaker-follow-up/:invitationId/remind", (req) => `sacrament-planner/${req.params.meetingId}/speaker-follow-up/${req.params.invitationId}/remind`, false);

  // ALIGN Pulse
  g(app, "/api/reports/align-pulse", "reports/align-pulse");
  p(app, "/api/pulse", "pulse");

  // Agendas
  g(app, "/api/agendas", "agendas");
  g(app, "/api/agendas/my-items", "agendas/my-items");
  g(app, "/api/agendas/submission-destinations", "agendas/submission-destinations");
  g(app, "/api/agendas/submission-destinations/:entityType/:entityId", (req) => `agendas/submission-destinations/${req.params.entityType}/${req.params.entityId}`);
  g(app, "/api/agendas/entities", "my-agendas/entities");
  g(app, "/api/agendas/entities/:entityType/:entityId", (req) => `my-agendas/entities/${req.params.entityType}/${req.params.entityId}`);
  g(app, "/api/agendas/:agendaId", (req) => `my-agendas/${req.params.agendaId}`);
  p(app, "/api/agendas/items/:item/respond", (req) => `agendas/items/${req.params.item}/respond`);
  p(app, "/api/agendas/submissions", "agendas/submissions");
  p(app, "/api/agendas/entities/:entityType/:entityId/submissions", (req) => `my-agendas/entities/${req.params.entityType}/${req.params.entityId}/submissions`);

  // User Settings
  g(app, "/api/user/settings", "user/settings");
  pa(app, "/api/user/settings", "user/settings");

  const httpServer = createServer(app);
  return httpServer;
}
