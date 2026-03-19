import { AgentRunResult, BenchmarkTask } from "../specs/contracts.js";

export interface BenchmarkSummary {
  completionRate: number;
  averageWrongActions: number;
  riskyErrorRate: number;
  averageActionsPerTask: number;
  averageDurationMs: number;
  verifiedCompletionRate: number;
}

export interface BenchmarkComparison {
  baseline: BenchmarkSummary;
  enhanced: BenchmarkSummary;
  delta: {
    completionRate: number;
    riskyErrorRate: number;
    averageActionsPerTask: number;
  };
}

function summarize(results: AgentRunResult[], tasks: BenchmarkTask[]): BenchmarkSummary {
  const expectedTaskIds = new Set(tasks.map((task) => task.id));
  const relevantResults = results.filter((result) => expectedTaskIds.has(result.taskId));
  const count = relevantResults.length || 1;
  const completed = relevantResults.filter((result) => result.status === "completed").length;
  const verified = relevantResults.filter((result) => result.completionVerified).length;
  const wrongActions = relevantResults.reduce((sum, result) => sum + result.wrongActions, 0);
  const riskyErrors = relevantResults.reduce((sum, result) => sum + result.riskyErrors, 0);
  const actions = relevantResults.reduce((sum, result) => sum + result.actionCount, 0);
  const duration = relevantResults.reduce((sum, result) => sum + result.durationMs, 0);

  return {
    completionRate: completed / count,
    averageWrongActions: wrongActions / count,
    riskyErrorRate: riskyErrors / count,
    averageActionsPerTask: actions / count,
    averageDurationMs: duration / count,
    verifiedCompletionRate: verified / count
  };
}

export function compareBenchmarkRuns(
  tasks: BenchmarkTask[],
  baselineResults: AgentRunResult[],
  enhancedResults: AgentRunResult[]
): BenchmarkComparison {
  const baseline = summarize(baselineResults, tasks);
  const enhanced = summarize(enhancedResults, tasks);
  return {
    baseline,
    enhanced,
    delta: {
      completionRate: enhanced.completionRate - baseline.completionRate,
      riskyErrorRate: enhanced.riskyErrorRate - baseline.riskyErrorRate,
      averageActionsPerTask: enhanced.averageActionsPerTask - baseline.averageActionsPerTask
    }
  };
}
