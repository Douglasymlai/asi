import http from "node:http";
import { SiaManifest, AgentReport, REPORT_VERSION } from "../specs/contracts.js";
import { validateReport } from "../specs/validation.js";

export interface ServeOptions {
  manifest: SiaManifest;
  port: number;
  onReport?: (report: AgentReport) => void;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createManifestServer(options: ServeOptions): http.Server {
  const { manifest, onReport } = options;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${options.port}`);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      json(res, 204, null);
      return;
    }

    // Level 0 — App root: page summaries only
    if (pathname === "/" || pathname === "/manifest") {
      json(res, 200, {
        sia: manifest.sia,
        app: manifest.app,
        pages: manifest.pages,
        metadata: manifest.metadata
      });
      return;
    }

    // Level 0 — Pages list
    if (pathname === "/pages") {
      json(res, 200, manifest.pages);
      return;
    }

    // Level 1 — Page detail
    const pageMatch = pathname.match(/^\/pages\/([^/]+)$/);
    if (pageMatch) {
      const pageId = decodeURIComponent(pageMatch[1]!);
      const page = manifest.pageDetails[pageId];
      if (!page) {
        json(res, 404, { error: `Page '${pageId}' not found` });
        return;
      }
      // Return page detail with workflow summaries (not full workflow details)
      json(res, 200, page);
      return;
    }

    // Level 2 — Workflow detail
    const workflowMatch = pathname.match(/^\/workflows\/([^/]+)$/);
    if (workflowMatch) {
      const workflowId = decodeURIComponent(workflowMatch[1]!);
      const workflow = manifest.workflowDetails[workflowId];
      if (!workflow) {
        json(res, 404, { error: `Workflow '${workflowId}' not found` });
        return;
      }
      json(res, 200, workflow);
      return;
    }

    // Workflows list
    if (pathname === "/workflows") {
      const summaries = Object.values(manifest.workflowDetails).map((w) => ({
        id: w.id,
        pageId: w.pageId,
        goal: w.goal,
        trigger: w.trigger,
        stepsCount: w.steps.length
      }));
      json(res, 200, summaries);
      return;
    }

    // Agent report submission endpoint
    if (pathname === "/reports" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const report = JSON.parse(body) as unknown;
        const issues = validateReport(report);
        if (issues.some((issue) => issue.severity === "error")) {
          json(res, 400, { error: "Invalid report", issues });
          return;
        }
        if (onReport) {
          onReport(report as AgentReport);
        }
        json(res, 201, { status: "accepted", report });
      } catch {
        json(res, 400, { error: "Invalid JSON body" });
      }
      return;
    }

    // Full manifest (escape hatch)
    if (pathname === "/manifest/full") {
      json(res, 200, manifest);
      return;
    }

    json(res, 404, { error: "Not found" });
  });
}

export function startServer(options: ServeOptions): Promise<http.Server> {
  const server = createManifestServer(options);
  return new Promise((resolve) => {
    server.listen(options.port, "127.0.0.1", () => {
      resolve(server);
    });
  });
}
