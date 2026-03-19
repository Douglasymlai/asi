import test from "node:test";
import assert from "node:assert/strict";
import { runBenchmark, generateBenchmarkReport, AgentAdapter, AgentCondition } from "../src/benchmark/harness.js";
import { scanProject } from "../src/scanner/index.js";
import { mergeAuthoredWorkflows } from "../src/manifest/merge.js";
import { AgentRunResult, AsiManifest, BenchmarkTask } from "../src/specs/contracts.js";
import { copyFixtureApp } from "./helpers.js";

function createMockAdapter(): AgentAdapter {
  return {
    async execute(task, condition, manifest) {
      // Simulate that agents perform better with manifest
      const hasManifest = condition !== "baseline";
      const completed = hasManifest || Math.random() > 0.5;
      return {
        taskId: task.id,
        condition,
        status: completed ? "completed" : "failed",
        stepsCompleted: completed ? ["step1", "step2"] : ["step1"],
        wrongActions: hasManifest ? 0 : 2,
        riskyErrors: hasManifest ? 0 : 1,
        actionCount: hasManifest ? 5 : 15,
        durationMs: hasManifest ? 1000 : 3000,
        completionVerified: completed
      };
    }
  };
}

const SAMPLE_TASKS: BenchmarkTask[] = [
  {
    id: "task-1",
    goal: "Refund order #123",
    page: "order-detail",
    role: "admin",
    seedState: "confirmed",
    expectedWorkflow: "refund_order",
    expectedOutcome: "success"
  },
  {
    id: "task-2",
    goal: "Cancel order #456",
    page: "order-detail",
    role: "admin",
    seedState: "pending",
    expectedWorkflow: "cancel_order",
    expectedOutcome: "success"
  },
  {
    id: "task-3",
    goal: "Refund a delivered order that cannot be refunded",
    page: "order-detail",
    role: "viewer",
    seedState: "delivered",
    expectedOutcome: "blocked",
    expectedFailureReason: "insufficient_permissions"
  }
];

test("benchmark harness runs tasks across conditions", async () => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const completedTasks: string[] = [];
  const result = await runBenchmark({
    tasks: SAMPLE_TASKS,
    manifest,
    adapter: createMockAdapter(),
    conditions: ["baseline", "full_manifest"],
    onTaskComplete: (r) => completedTasks.push(`${r.condition}:${r.taskId}`)
  });

  // Should have run each task under each condition
  assert.equal(result.results.length, 6);
  assert.equal(result.byCondition["baseline"]!.length, 3);
  assert.equal(result.byCondition["full_manifest"]!.length, 3);
  assert.equal(completedTasks.length, 6);
});

test("benchmark harness: full_manifest outperforms baseline", async () => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const result = await runBenchmark({
    tasks: SAMPLE_TASKS,
    manifest,
    adapter: createMockAdapter(),
    conditions: ["baseline", "full_manifest"]
  });

  const baseline = result.byCondition["baseline"]!;
  const enhanced = result.byCondition["full_manifest"]!;

  const bRisky = baseline.reduce((s, r) => s + r.riskyErrors, 0);
  const eRisky = enhanced.reduce((s, r) => s + r.riskyErrors, 0);
  assert.ok(eRisky <= bRisky, "enhanced should have fewer risky errors");

  const bActions = baseline.reduce((s, r) => s + r.actionCount, 0);
  const eActions = enhanced.reduce((s, r) => s + r.actionCount, 0);
  assert.ok(eActions <= bActions, "enhanced should use fewer actions");
});

test("benchmark report generation", async () => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const result = await runBenchmark({
    tasks: SAMPLE_TASKS,
    manifest,
    adapter: createMockAdapter(),
    conditions: ["baseline", "full_manifest"]
  });

  const report = generateBenchmarkReport(result);
  assert.ok(report.includes("baseline"), "report should include baseline section");
  assert.ok(report.includes("full_manifest"), "report should include full_manifest section");
  assert.ok(report.includes("Improvement"), "report should include improvement delta");
});

test("benchmark harness supports ablation (pages_only)", async () => {
  const projectRoot = copyFixtureApp();
  const scanned = scanProject(projectRoot);
  const { manifest } = mergeAuthoredWorkflows(projectRoot, scanned);

  const result = await runBenchmark({
    tasks: SAMPLE_TASKS,
    manifest,
    adapter: createMockAdapter(),
    conditions: ["baseline", "pages_only", "full_manifest"]
  });

  assert.equal(Object.keys(result.byCondition).length, 3);
  assert.equal(result.byCondition["pages_only"]!.length, 3);
});
