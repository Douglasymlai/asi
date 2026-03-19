import test from "node:test";
import assert from "node:assert/strict";
import { scanProject } from "../src/scanner/index.js";
import { mergeAuthoredWorkflows } from "../src/manifest/merge.js";
import { diffManifests } from "../src/diff/index.js";
import { copyFixtureApp } from "./helpers.js";

test("diffManifests reports removed actions as breaking changes", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: original } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  const mutated = structuredClone(original);
  mutated.pageDetails["order-detail"].actions = mutated.pageDetails["order-detail"].actions.filter(
    (action) => action.id !== "archive_order"
  );
  const diff = diffManifests(original, mutated);
  assert.equal(diff.breaking, true);
  assert.ok(diff.lines.some((line) => line.includes('removed action "archive_order"')));
});

test("diffManifests reports added pages as non-breaking", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: original } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  const mutated = structuredClone(original);
  mutated.pages.push({ id: "new-page", route: "/new", type: "form", purpose: "Create something" });
  const diff = diffManifests(original, mutated);
  assert.equal(diff.breaking, false);
  assert.ok(diff.lines.some((line) => line.includes("+ pages/new-page")));
});

test("diffManifests detects no changes", () => {
  const projectRoot = copyFixtureApp();
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  const diff = diffManifests(manifest, structuredClone(manifest));
  assert.equal(diff.breaking, false);
  assert.ok(diff.lines.some((line) => line.includes("No manifest changes detected")));
});

test("diffManifests detects added components", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: original } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  const mutated = structuredClone(original);
  mutated.components = [
    ...(mutated.components ?? []),
    { id: "tooltip", name: "Tooltip", semanticRole: "tooltip", confidence: 0.9, source: { file: "src/components/ui/tooltip.tsx" } }
  ];
  const diff = diffManifests(original, mutated);
  assert.ok(diff.lines.some((line) => line.includes("+ components/tooltip")));
});

test("diffManifests detects removed components", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: original } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  original.components = [
    { id: "badge", name: "Badge", semanticRole: "label", confidence: 0.8, source: { file: "src/components/ui/badge.tsx" } }
  ];
  const mutated = structuredClone(original);
  mutated.components = [];
  const diff = diffManifests(original, mutated);
  assert.ok(diff.lines.some((line) => line.includes("- components/badge")));
});

test("diffManifests detects component property changes", () => {
  const projectRoot = copyFixtureApp();
  const { manifest: original } = mergeAuthoredWorkflows(projectRoot, scanProject(projectRoot));
  original.components = [
    { id: "button", name: "Button", semanticRole: "action-trigger", risk: "low" as const, confidence: 0.95, source: { file: "src/components/ui/button.tsx" } }
  ];
  const mutated = structuredClone(original);
  mutated.components![0].risk = "high";
  mutated.components![0].requiresConfirmation = true;
  const diff = diffManifests(original, mutated);
  assert.ok(diff.lines.some((line) => line.includes('components/button: risk changed "low" -> "high"')));
  assert.ok(diff.lines.some((line) => line.includes("components/button: requiresConfirmation changed")));
});
