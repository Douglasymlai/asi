import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { compareBenchmarkRuns } from "../src/benchmark/evaluate.js";
import { AgentRunResult, BenchmarkTask } from "../src/specs/contracts.js";
import { readJsonFile } from "../src/utils/fs.js";
import { FIXTURE_APP_ROOT, REPO_ROOT } from "./helpers.js";

test("benchmark comparison computes proof-of-value deltas", () => {
  const tasks = readJsonFile<BenchmarkTask[]>(path.join(FIXTURE_APP_ROOT, "data/benchmark-tasks.json")).slice(0, 4);
  const baseline = readJsonFile<AgentRunResult[]>(path.join(REPO_ROOT, "tests/fixtures/specs/baseline-results.json"));
  const enhanced = readJsonFile<AgentRunResult[]>(path.join(REPO_ROOT, "tests/fixtures/specs/enhanced-results.json"));
  const comparison = compareBenchmarkRuns(tasks, baseline, enhanced);
  assert.ok(comparison.delta.completionRate > 0);
  assert.ok(comparison.delta.riskyErrorRate < 0);
  assert.ok(comparison.delta.averageActionsPerTask < 0);
});
