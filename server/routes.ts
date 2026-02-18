import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const SA_API_BASE = "https://surreyalign.org/api/external/v1";

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
    } catch (error) {
      res.status(502).json({ success: false, message: "Unable to reach SurreyAlign. Please try again." });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthenticated." });
      }
      const response = await fetch(`${SA_API_BASE}/auth/me`, {
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(502).json({ success: false, message: "Unable to reach SurreyAlign." });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthenticated." });
      }
      const response = await fetch(`${SA_API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(502).json({ success: false, message: "Unable to reach SurreyAlign." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
