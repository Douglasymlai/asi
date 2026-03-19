import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "../src/utils/fs.js";
import { scanProject } from "../src/scanner/index.js";
import { mergeAuthoredWorkflows } from "../src/manifest/merge.js";
import { validateManifest } from "../src/specs/validation.js";
import { AsiManifest } from "../src/specs/contracts.js";
import { GOLDEN_MANIFEST_PATH, copyFixtureApp, normalizeManifest } from "./helpers.js";

test("compiled manifest matches the golden fixture", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: compiled } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  const golden = readJsonFile<AsiManifest>(GOLDEN_MANIFEST_PATH);
  assert.deepEqual(normalizeManifest(compiled), normalizeManifest(golden));
  assert.deepEqual(validateManifest(compiled), []);
});

test("workflow merge attaches authored flows to the expected pages", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: compiled } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  assert.equal(compiled.pageDetails["order-detail"].workflows.length, 3);
  assert.equal(compiled.pageDetails["product-list"].workflows[0]?.id, "create-product");
  assert.equal(compiled.workflowDetails["refund-order"].steps[1]?.optional_next?.[0], "add_refund_note");
  assert.equal(compiled.workflowDetails["refund-order"].reporting.on_success.entity, "order");
  assert.equal(compiled.workflowDetails["refund-order"].reporting.on_success.stateTransition, "status -> refunded");
});

test("workflow merge emits warnings for unmatched triggers", () => {
  const projectRoot = copyFixtureApp();
  const unmatchedWorkflow = `# orphan_workflow

> Do something that doesn't exist

## trigger
- nonexistent_action

## steps
1. [step_one] Click "Something"

## completion
- signal: toast_success

## metadata
- risk: low
- sideEffects: none
- reversible: true
`;
  fs.writeFileSync(path.join(projectRoot, "workflows", "orphan.asi.md"), unmatchedWorkflow);

  const { manifest, warnings } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  assert.ok(warnings.length > 0, "should have warnings");
  assert.ok(warnings[0]!.includes("nonexistent_action"), "warning should mention the unmatched trigger");
  assert.equal(manifest.workflowDetails["orphan-workflow"], undefined);
});
