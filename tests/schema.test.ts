import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readJsonFile } from "../src/utils/fs.js";
import { validateConfig, validateReport } from "../src/specs/validation.js";
import { REPO_ROOT } from "./helpers.js";

test("report validation accepts valid report fixture", () => {
  const report = readJsonFile(path.join(REPO_ROOT, "tests/fixtures/specs/valid-report.json"));
  assert.deepEqual(validateReport(report), []);
});

test("report validation rejects invalid report fixture", () => {
  const report = readJsonFile(path.join(REPO_ROOT, "tests/fixtures/specs/invalid-report.json"));
  const issues = validateReport(report);
  assert.ok(issues.some((issue) => issue.path === "$.steps_completed"));
  assert.ok(issues.some((issue) => issue.path === "$.duration_ms"));
  assert.ok(issues.some((issue) => issue.path === "$.completion_verified"));
});

test("config validation rejects invalid config fixture", () => {
  const config = readJsonFile(path.join(REPO_ROOT, "tests/fixtures/specs/invalid-config.json"));
  const issues = validateConfig(config);
  assert.ok(issues.some((issue) => issue.path === "$.routesDir"));
  assert.ok(issues.some((issue) => issue.path === "$.designSystem"));
});
