import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const SA_API_BASE = "https://surreyalign.org/api/external/v1";

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

function d(app: Express, route: string, apiPath: string | ((req: Request) => string)) {
  app.delete(route, (req, res) => proxyRequest(req, res, "DELETE", typeof apiPath === "function" ? apiPath(req) : apiPath));
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/login", (req, res) =>
    proxyRequest(req, res, "POST", "auth/login", { includeBody: true, requireAuth: false })
  );
  g(app, "/api/auth/me", "auth/me");
  p(app, "/api/auth/logout", "auth/logout", false);

  g(app, "/api/goals", "goals");
  g(app, "/api/goals/:goalId/execution", (req) => `goals/${req.params.goalId}/execution`);

  g(app, "/api/reference/callings", "reference/callings");
  g(app, "/api/reference/wards", "reference/wards");
  g(app, "/api/reference/organizations", "reference/organizations");
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

  // ALIGN Pulse
  g(app, "/api/reports/align-pulse", "reports/align-pulse");
  p(app, "/api/pulse", "pulse");

  // Council Agendas
  g(app, "/api/agendas", "agendas");
  g(app, "/api/agendas/my-items", "agendas/my-items");
  p(app, "/api/agendas/items/:item/respond", (req) => `agendas/items/${req.params.item}/respond`);
  p(app, "/api/agendas/submissions", "agendas/submissions");

  // User Settings
  g(app, "/api/user/settings", "user/settings");
  pa(app, "/api/user/settings", "user/settings");

  const httpServer = createServer(app);
  return httpServer;
}
