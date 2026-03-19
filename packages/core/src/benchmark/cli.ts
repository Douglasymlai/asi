#!/usr/bin/env node
import path from "node:path";
import { compareBenchmarkRuns } from "./evaluate.js";
import { AgentRunResult, BenchmarkTask } from "../specs/contracts.js";
import { readJsonFile } from "../utils/fs.js";

function parseArgs(argv: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      options.set(key, value);
      index += 1;
    }
  }
  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const tasksPath = options.get("tasks");
  const baselinePath = options.get("baseline");
  const enhancedPath = options.get("enhanced");
  if (!tasksPath || !baselinePath || !enhancedPath) {
    throw new Error("benchmark summary requires --tasks, --baseline, and --enhanced");
  }
  const tasks = readJsonFile<BenchmarkTask[]>(path.resolve(tasksPath));
  const baseline = readJsonFile<AgentRunResult[]>(path.resolve(baselinePath));
  const enhanced = readJsonFile<AgentRunResult[]>(path.resolve(enhancedPath));
  process.stdout.write(`${JSON.stringify(compareBenchmarkRuns(tasks, baseline, enhanced), null, 2)}\n`);
}

main();
