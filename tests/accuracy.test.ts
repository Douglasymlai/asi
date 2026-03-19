import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanProject } from "../src/scanner/index.js";
import { validateManifest } from "../src/specs/validation.js";

const UNANNOTATED_ROOT = path.join(process.cwd(), "tests/fixtures/unannotated-app");

function copyUnannotatedApp(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sia-unannotated-"));
  fs.cpSync(UNANNOTATED_ROOT, tempRoot, { recursive: true });
  return tempRoot;
}

test("unannotated app: manifest is valid", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);
  const issues = validateManifest(manifest);
  assert.deepEqual(issues, []);
});

test("unannotated app: detects all 7 pages", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);
  assert.equal(manifest.pages.length, 7);
});

test("unannotated app: infers page types from route patterns", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const dashboard = manifest.pageDetails.dashboard;
  assert.equal(dashboard?.type, "dashboard");
  assert.equal(dashboard?.route, "/");

  const orderList = manifest.pageDetails["order-list"];
  assert.equal(orderList?.type, "list");

  const orderDetail = manifest.pageDetails["order-detail"];
  assert.equal(orderDetail?.type, "detail");

  const settings = manifest.pageDetails.settings;
  assert.equal(settings?.type, "settings");
});

test("unannotated app: infers entities from route segments", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  assert.equal(manifest.pageDetails["order-list"]?.entity, "order");
  assert.equal(manifest.pageDetails["order-detail"]?.entity, "order");
  assert.equal(manifest.pageDetails["customer-list"]?.entity, "customer");
  assert.equal(manifest.pageDetails["product-list"]?.entity, "product");
});

test("unannotated app: detects actions without data-attributes", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  assert.ok(orderDetail, "order-detail page should exist");
  const actionIds = orderDetail.actions.map((a) => a.id);
  assert.ok(actionIds.includes("refund_order"), "should detect refund button");
  assert.ok(actionIds.includes("cancel_order"), "should detect cancel button");
  assert.ok(actionIds.includes("edit_shipping"), "should detect edit shipping button");
  assert.ok(actionIds.includes("archive_order"), "should detect archive button");
});

test("unannotated app: infers risk from variant=destructive and label keywords", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  const refund = orderDetail.actions.find((a) => a.id === "refund_order");
  assert.equal(refund?.risk, "high", "refund should be high risk (destructive variant + keyword)");

  const cancel = orderDetail.actions.find((a) => a.id === "cancel_order");
  assert.equal(cancel?.risk, "high", "cancel should be high risk");

  const editShipping = orderDetail.actions.find((a) => a.id === "edit_shipping");
  assert.equal(editShipping?.risk, "low", "edit shipping should be low risk");
});

test("unannotated app: infers intent from onClick handler names", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  const refund = orderDetail.actions.find((a) => a.id === "refund_order");
  // handleRefund => "refund" or "refund_order" (from label)
  assert.ok(refund?.intent, "refund action should have an intent");
});

test("unannotated app: detects dynamic content via AST-based hook analysis", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  assert.equal(orderDetail?.dynamic, true, "order detail should be dynamic");
  assert.equal(orderDetail?.dynamicContent?.dataSource, "api", "should detect API data source");
});

test("unannotated app: extracts possible states from conditional rendering", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  assert.ok(orderDetail?.dynamicContent?.stateDependent, "should detect state-dependent behavior");
  // States should be extracted from the .includes() array patterns
  const states = orderDetail?.dynamicContent?.possibleStates ?? [];
  assert.ok(states.includes("confirmed"), "should find 'confirmed' state");
  assert.ok(states.includes("shipped"), "should find 'shipped' state");
  assert.ok(states.includes("delivered"), "should find 'delivered' state");
});

test("unannotated app: detects role-dependent rendering", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  assert.ok(orderDetail?.dynamicContent?.roleDependent, "should detect role-dependent behavior");
});

test("unannotated app: derives availability conditions from conditional blocks", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  const orderDetail = manifest.pageDetails["order-detail"];
  const refund = orderDetail.actions.find((a) => a.id === "refund_order");
  // The conditional {["confirmed", "shipped", "delivered"].includes(status) && ...}
  // should produce availableWhen.status
  assert.ok(refund?.availableWhen?.status, "refund should have status availability");
  assert.ok(refund?.availableWhen?.status?.includes("confirmed"), "refund should be available when confirmed");
});

test("unannotated app: purpose falls back to h1 heading text", () => {
  const projectRoot = copyUnannotatedApp();
  const manifest = scanProject(projectRoot);

  // Without data-purpose, pages should fall back to h1 or type-based inference
  const dashboard = manifest.pageDetails.dashboard;
  // h1 is "Operations Dashboard"
  assert.equal(dashboard?.purpose, "Operations Dashboard");
});

test("scanner accuracy comparison: annotated vs unannotated", () => {
  const annotatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sia-annotated-"));
  fs.cpSync(path.join(process.cwd(), "tests/fixtures/fixture-app"), annotatedRoot, { recursive: true });
  const annotated = scanProject(annotatedRoot);

  const unannotatedRoot = copyUnannotatedApp();
  const unannotated = scanProject(unannotatedRoot);

  // Both should detect same number of pages
  assert.equal(annotated.pages.length, unannotated.pages.length, "page count should match");

  // Count how many page types match
  let pageTypeMatches = 0;
  let actionMatches = 0;
  let totalAnnotatedActions = 0;

  for (const annotatedPage of Object.values(annotated.pageDetails)) {
    const unannotatedPage = Object.values(unannotated.pageDetails).find(
      (p) => p.route === annotatedPage.route
    );
    if (!unannotatedPage) continue;
    if (unannotatedPage.type === annotatedPage.type) pageTypeMatches++;

    for (const annotatedAction of annotatedPage.actions) {
      totalAnnotatedActions++;
      if (unannotatedPage.actions.some((a) => a.id === annotatedAction.id)) {
        actionMatches++;
      }
    }
  }

  const pageTypeAccuracy = pageTypeMatches / annotated.pages.length;
  const actionDetectionRate = totalAnnotatedActions > 0 ? actionMatches / totalAnnotatedActions : 1;

  // Log accuracy metrics
  process.stdout.write(`\n--- Scanner Accuracy Report ---\n`);
  process.stdout.write(`Page type accuracy: ${(pageTypeAccuracy * 100).toFixed(0)}% (${pageTypeMatches}/${annotated.pages.length})\n`);
  process.stdout.write(`Action detection rate: ${(actionDetectionRate * 100).toFixed(0)}% (${actionMatches}/${totalAnnotatedActions})\n`);

  // Annotated should be ≥90% (it uses data-attributes, so near-perfect)
  // Unannotated should be ≥60% for page types
  assert.ok(pageTypeAccuracy >= 0.6, `Page type accuracy should be ≥60%, got ${(pageTypeAccuracy * 100).toFixed(0)}%`);
  assert.ok(actionDetectionRate >= 0.6, `Action detection rate should be ≥60%, got ${(actionDetectionRate * 100).toFixed(0)}%`);
});
