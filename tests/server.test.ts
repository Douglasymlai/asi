import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { scanProject } from "../src/scanner/index.js";
import { mergeAuthoredWorkflows } from "../src/manifest/merge.js";
import { createManifestServer } from "../src/server/index.js";
import { copyFixtureApp } from "./helpers.js";

function fetch(url: string, options?: { method?: string; body?: string }): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options?.method ?? "GET",
        headers: options?.body ? { "Content-Type": "application/json" } : {}
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: raw });
          }
        });
      }
    );
    req.on("error", reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

async function tryListen(server: http.Server, port: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise<{ ok: true }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve({ ok: true });
    });
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EPERM" || error.code === "EACCES") {
      return { ok: false, reason: `socket binding not allowed in this environment (${error.code})` };
    }
    throw error;
  });
}

test("serve: progressive disclosure endpoints", async (t) => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const port = 14380 + Math.floor(Math.random() * 1000);
  const server = createManifestServer({ manifest, port });
  const listenResult = await tryListen(server, port);
  if (!listenResult.ok) {
    t.skip(listenResult.reason);
    return;
  }

  try {
    // Level 0 — App root
    const root = await fetch(`http://localhost:${port}/`);
    assert.equal(root.status, 200);
    const rootBody = root.body as Record<string, unknown>;
    assert.equal(rootBody.sia, "1.0");
    assert.ok(Array.isArray(rootBody.pages));
    assert.equal(rootBody.pageDetails, undefined, "Root should not include pageDetails");

    // Pages list
    const pages = await fetch(`http://localhost:${port}/pages`);
    assert.equal(pages.status, 200);
    assert.ok(Array.isArray(pages.body));

    // Level 1 — Page detail
    const pageDetail = await fetch(`http://localhost:${port}/pages/order-detail`);
    assert.equal(pageDetail.status, 200);
    const pageBody = pageDetail.body as Record<string, unknown>;
    assert.equal(pageBody.id, "order-detail");
    assert.ok(Array.isArray(pageBody.actions));

    // Level 1 — 404 for unknown page
    const notFound = await fetch(`http://localhost:${port}/pages/nonexistent`);
    assert.equal(notFound.status, 404);

    // Level 2 — Workflow detail
    const workflow = await fetch(`http://localhost:${port}/workflows/refund-order`);
    assert.equal(workflow.status, 200);
    const wfBody = workflow.body as Record<string, unknown>;
    assert.equal(wfBody.id, "refund-order");
    assert.ok(Array.isArray(wfBody.steps));

    // Workflow list
    const workflows = await fetch(`http://localhost:${port}/workflows`);
    assert.equal(workflows.status, 200);
    assert.ok(Array.isArray(workflows.body));

    // Full manifest escape hatch
    const full = await fetch(`http://localhost:${port}/manifest/full`);
    assert.equal(full.status, 200);
    const fullBody = full.body as Record<string, unknown>;
    assert.ok(fullBody.pageDetails !== undefined);
  } finally {
    server.close();
  }
});

test("serve: agent report submission", async (t) => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const receivedReports: unknown[] = [];
  const port = 14380 + Math.floor(Math.random() * 1000);
  const server = createManifestServer({
    manifest,
    port,
    onReport: (report) => receivedReports.push(report)
  });
  const listenResult = await tryListen(server, port);
  if (!listenResult.ok) {
    t.skip(listenResult.reason);
    return;
  }

  try {
    const validReport = {
      sia_report: "1.0",
      timestamp: "2025-03-19T12:05:00Z",
      agent: "test-agent/1.0",
      app: "fixture-store-admin",
      workflow: "refund_order",
      status: "completed",
      steps_completed: ["open_refund_modal", "select_refund_amount", "confirm_refund"],
      duration_ms: 3200,
      entity: { type: "order", id: "order_123", stateTransition: "confirmed → refunded" },
      completion_verified: true
    };

    const result = await fetch(`http://localhost:${port}/reports`, {
      method: "POST",
      body: JSON.stringify(validReport)
    });
    assert.equal(result.status, 201);
    assert.equal(receivedReports.length, 1);

    // Invalid report
    const badResult = await fetch(`http://localhost:${port}/reports`, {
      method: "POST",
      body: JSON.stringify({ invalid: true })
    });
    assert.equal(badResult.status, 400);
  } finally {
    server.close();
  }
});
