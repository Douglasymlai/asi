import test from "node:test";
import assert from "node:assert/strict";
import { scanProject } from "../src/scanner/index.js";
import { validateManifest } from "../src/specs/validation.js";
import { copyFixtureApp, copyReactFixtureApp } from "./helpers.js";

test("scanProject infers dynamic order detail page semantics", () => {
  const projectRoot = copyFixtureApp();
  const manifest = scanProject(projectRoot);
  const page = manifest.pageDetails["order-detail"];
  assert.equal(page.route, "/orders/:id");
  assert.equal(page.dynamic, true);
  assert.deepEqual(page.dynamicContent?.possibleStates, ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]);
  assert.deepEqual(page.dynamicContent?.conditionalActions?.refund_order?.role, ["admin"]);
  assert.ok(page.actions.some((action) => action.id === "cancel_order" && action.risk === "high"));
  assert.deepEqual(validateManifest(manifest), []);
});

test("scanProject captures dashboard route correctly", () => {
  const projectRoot = copyFixtureApp();
  const manifest = scanProject(projectRoot);
  const dashboard = manifest.pageDetails.dashboard;
  assert.equal(dashboard.route, "/");
  assert.equal(dashboard.type, "dashboard");
  assert.equal(dashboard.purpose, "Monitor fulfillment, revenue, and support queues");
});

test("scanProject supports generic React routes and component catalog", () => {
  const projectRoot = copyReactFixtureApp();
  const manifest = scanProject(projectRoot);

  assert.equal(manifest.app.framework, "react");
  assert.equal(manifest.pages.length, 4);
  assert.equal(manifest.pageDetails["order-detail"]?.route, "/orders/:id");
  assert.ok(manifest.pageDetails["order-detail"]?.actions.some((action) => action.id === "refund_order"));
  assert.ok(manifest.components?.some((component) => component.name === "Button"));
  assert.deepEqual(validateManifest(manifest), []);
});
