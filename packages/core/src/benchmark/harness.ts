import { AgentRunResult, SiaManifest, BenchmarkTask } from "../specs/contracts.js";

/**
 * Benchmark harness for evaluating agent performance with/without SIA manifests.
 *
 * This module defines the protocol and types for running agent benchmarks.
 * The actual agent execution is delegated to an adapter function — this
 * allows integration with any agent framework (Claude + browser-use,
 * Playwright, Puppeteer, etc.)
 */

export type AgentCondition = "baseline" | "pages_only" | "pages_workflows" | "full_manifest";

export interface AgentAdapter {
  /**
   * Execute a single task and return the result.
   * The adapter receives the task, condition, and optionally the manifest.
   */
  execute(
    task: BenchmarkTask,
    condition: AgentCondition,
    manifest?: Partial<SiaManifest>
  ): Promise<AgentRunResult>;
}

export interface HarnessConfig {
  tasks: BenchmarkTask[];
  manifest: SiaManifest;
  adapter: AgentAdapter;
  conditions: AgentCondition[];
  onTaskComplete?: (result: AgentRunResult) => void;
}

export interface HarnessResult {
  results: AgentRunResult[];
  byCondition: Record<string, AgentRunResult[]>;
}

function filterManifest(manifest: SiaManifest, condition: AgentCondition): Partial<SiaManifest> | undefined {
  switch (condition) {
    case "baseline":
      return undefined;
    case "pages_only":
      return {
        sia: manifest.sia,
        app: manifest.app,
        pages: manifest.pages,
        pageDetails: Object.fromEntries(
          Object.entries(manifest.pageDetails).map(([id, page]) => [
            id,
            { ...page, workflows: [] }
          ])
        ),
        workflowDetails: {},
        metadata: manifest.metadata
      };
    case "pages_workflows":
      return {
        sia: manifest.sia,
        app: manifest.app,
        pages: manifest.pages,
        pageDetails: manifest.pageDetails,
        workflowDetails: manifest.workflowDetails,
        metadata: manifest.metadata
      };
    case "full_manifest":
      return manifest;
  }
}

export async function runBenchmark(config: HarnessConfig): Promise<HarnessResult> {
  const results: AgentRunResult[] = [];
  const byCondition: Record<string, AgentRunResult[]> = {};

  for (const condition of config.conditions) {
    byCondition[condition] = [];
    const filteredManifest = filterManifest(config.manifest, condition);

    for (const task of config.tasks) {
      const result = await config.adapter.execute(task, condition, filteredManifest);
      results.push(result);
      byCondition[condition]!.push(result);
      config.onTaskComplete?.(result);
    }
  }

  return { results, byCondition };
}

export function generateBenchmarkReport(harness: HarnessResult): string {
  const lines: string[] = ["=== SIA Benchmark Report ===", ""];

  for (const [condition, results] of Object.entries(harness.byCondition)) {
    const total = results.length || 1;
    const completed = results.filter((r) => r.status === "completed").length;
    const blocked = results.filter((r) => r.status === "blocked").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const wrongActions = results.reduce((sum, r) => sum + r.wrongActions, 0);
    const riskyErrors = results.reduce((sum, r) => sum + r.riskyErrors, 0);
    const avgActions = results.reduce((sum, r) => sum + r.actionCount, 0) / total;
    const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / total;
    const verified = results.filter((r) => r.completionVerified).length;

    lines.push(`--- ${condition} ---`);
    lines.push(`  Tasks: ${total}`);
    lines.push(`  Completed: ${completed} (${((completed / total) * 100).toFixed(1)}%)`);
    lines.push(`  Blocked: ${blocked}`);
    lines.push(`  Failed: ${failed}`);
    lines.push(`  Wrong actions: ${wrongActions}`);
    lines.push(`  Risky errors: ${riskyErrors}`);
    lines.push(`  Avg actions/task: ${avgActions.toFixed(1)}`);
    lines.push(`  Avg duration: ${avgDuration.toFixed(0)}ms`);
    lines.push(`  Verified: ${verified}/${total}`);
    lines.push("");
  }

  // Compute deltas if we have both baseline and full_manifest
  const baseline = harness.byCondition["baseline"];
  const enhanced = harness.byCondition["full_manifest"];
  if (baseline && enhanced && baseline.length > 0 && enhanced.length > 0) {
    const bTotal = baseline.length || 1;
    const eTotal = enhanced.length || 1;
    const bCompletion = baseline.filter((r) => r.status === "completed").length / bTotal;
    const eCompletion = enhanced.filter((r) => r.status === "completed").length / eTotal;
    const bRisky = baseline.reduce((s, r) => s + r.riskyErrors, 0) / bTotal;
    const eRisky = enhanced.reduce((s, r) => s + r.riskyErrors, 0) / eTotal;
    const bActions = baseline.reduce((s, r) => s + r.actionCount, 0) / bTotal;
    const eActions = enhanced.reduce((s, r) => s + r.actionCount, 0) / eTotal;

    lines.push("--- Improvement (baseline → full_manifest) ---");
    lines.push(`  Completion rate: ${((eCompletion - bCompletion) * 100).toFixed(1)}pp`);
    lines.push(`  Risky error rate: ${((eRisky - bRisky) * 100).toFixed(1)}pp`);
    lines.push(`  Avg actions/task: ${(eActions - bActions).toFixed(1)}`);
    lines.push("");
  }

  return lines.join("\n");
}
