import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const SA_API_BASE = "https://surreyalign.org/api/external/v1";

async function proxyGet(req: Request, res: Response, path: string) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthenticated." });
    }
    const url = new URL(path, SA_API_BASE + "/");
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === "string") url.searchParams.set(key, val);
    }
    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ success: false, message: "Unable to reach SurreyAlign." });
  }
}

async function proxyPost(req: Request, res: Response, path: string, includeBody = true) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthenticated." });
    }
    const headers: Record<string, string> = {
      "Authorization": authHeader,
      "Accept": "application/json",
    };
    if (includeBody) headers["Content-Type"] = "application/json";
    const response = await fetch(`${SA_API_BASE}/${path}`, {
      method: "POST",
      headers,
      body: includeBody ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ success: false, message: "Unable to reach SurreyAlign." });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const response = await fetch(`${SA_API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch {
      res.status(502).json({ success: false, message: "Unable to reach SurreyAlign. Please try again." });
    }
  });

  app.get("/api/auth/me", (req, res) => proxyGet(req, res, "auth/me"));
  app.post("/api/auth/logout", (req, res) => proxyPost(req, res, "auth/logout", false));

  app.get("/api/goals", (req, res) => proxyGet(req, res, "goals"));
  app.get("/api/goals/:goalId/execution", (req, res) =>
    proxyGet(req, res, `goals/${req.params.goalId}/execution`)
  );

  const httpServer = createServer(app);
  return httpServer;
}
