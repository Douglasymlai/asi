import test from "node:test";
import assert from "node:assert/strict";
import { scanProject } from "../src/scanner/index.js";
import { copyReactFixtureApp } from "./helpers.js";

test("component catalog captures shadcn-style component semantics", () => {
  const projectRoot = copyReactFixtureApp();
  const manifest = scanProject(projectRoot);

  assert.ok(manifest.components, "components catalog should be present");
  const button = manifest.components?.find((component) => component.name === "Button");
  const alertDialog = manifest.components?.find((component) => component.name === "AlertDialog");
  const table = manifest.components?.find((component) => component.name === "Table");

  assert.ok(button, "Button should be cataloged");
  assert.deepEqual(button?.variants?.find((variant) => variant.name === "variant")?.values, ["default", "secondary", "destructive"]);
  assert.ok(button?.importantProps?.includes("asChild"));
  assert.ok(button?.states?.includes("destructive"));

  assert.ok(alertDialog, "AlertDialog should be cataloged");
  assert.equal(alertDialog?.semanticRole, "confirmation-dialog");
  assert.equal(alertDialog?.requiresConfirmation, true);
  assert.equal(alertDialog?.risk, "high");

  assert.ok(table, "Table should be cataloged");
  assert.equal(table?.semanticRole, "data-table");
});
