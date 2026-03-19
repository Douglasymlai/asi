#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createDefaultConfig, loadConfig } from "../config/index.js";
import { diffManifests } from "../diff/index.js";
import { mergeAuthoredWorkflows } from "../manifest/merge.js";
import { AsiConfig, AsiFramework, AsiManifest, AgentReport } from "../specs/contracts.js";
import { validateManifest, validateReport, formatIssues } from "../specs/validation.js";
import { readJsonFile, writeJsonFile, pathExists, ensureDir } from "../utils/fs.js";
import { scanAndWrite, scanProject, getScanCachePath } from "../scanner/index.js";
import { startServer } from "../server/index.js";

function parseArgs(argv: string[]): { command: string; options: Map<string, string> } {
  const [command = "help", ...rest] = argv;
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options.set(key, "true");
      continue;
    }
    options.set(key, next);
    index += 1;
  }
  return { command, options };
}

function resolveProjectRoot(options: Map<string, string>): string {
  return path.resolve(options.get("project") ?? process.cwd());
}

function latestManifestPath(projectRoot: string): string {
  const config = loadConfig(projectRoot);
  const compiled = path.join(projectRoot, config.outputFile);
  if (pathExists(compiled)) {
    return compiled;
  }
  return getScanCachePath(projectRoot, config.cacheDir);
}

function print(value: string): void {
  process.stdout.write(`${value}\n`);
}

function readManifest(filePath: string): AsiManifest {
  return readJsonFile<AsiManifest>(filePath);
}

function inferFramework(projectRoot: string, options: Map<string, string>): AsiFramework {
  const explicit = options.get("framework");
  if (explicit === "next" || explicit === "react") {
    return explicit;
  }
  if (pathExists(path.join(projectRoot, "src", "app"))) {
    return "next";
  }
  return "react";
}

function inferRouter(projectRoot: string, framework: AsiFramework): AsiConfig["router"] {
  if (framework === "next") {
    return "next-app";
  }
  const appFile = path.join(projectRoot, "src", "App.tsx");
  if (pathExists(appFile)) {
    const source = fs.readFileSync(appFile, "utf8");
    if (source.includes("<Route") || source.includes("createBrowserRouter")) {
      return "react-router";
    }
  }
  return "manual";
}

function buildInitConfig(projectRoot: string, options: Map<string, string>): Partial<AsiConfig> {
  const framework = inferFramework(projectRoot, options);
  return {
    framework,
    surface: (options.get("surface") as AsiConfig["surface"] | undefined) ?? "web",
    router: inferRouter(projectRoot, framework),
    routesDir: framework === "next" ? "src/app" : "src/pages",
    componentDirs: ["src/components/ui"]
  };
}

function runInit(projectRoot: string, options: Map<string, string>): void {
  const configPath = createDefaultConfig(projectRoot, buildInitConfig(projectRoot, options));
  print(`Created ${path.relative(process.cwd(), configPath)}`);
}

function runScan(projectRoot: string): void {
  const manifest = scanAndWrite(projectRoot);
  print(`Scanned ${manifest.pages.length} page(s) into ${loadConfig(projectRoot).outputFile}`);
}

function runCompile(projectRoot: string): void {
  const config = loadConfig(projectRoot);
  const scanPath = getScanCachePath(projectRoot, config.cacheDir);
  const baseManifest = pathExists(scanPath) ? readManifest(scanPath) : scanProject(projectRoot);
  const { manifest, warnings } = mergeAuthoredWorkflows(projectRoot, baseManifest);
  writeJsonFile(path.join(projectRoot, config.cacheDir, "compiled-manifest.json"), manifest);
  writeJsonFile(path.join(projectRoot, config.outputFile), manifest);
  print(`Compiled ${Object.keys(manifest.workflowDetails).length} workflow(s) into ${config.outputFile}`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      print(`WARNING: ${warning}`);
    }
  }
}

function runValidate(projectRoot: string, options: Map<string, string>): void {
  const reportPath = options.get("report");
  if (reportPath) {
    const issues = validateReport(readJsonFile(path.resolve(reportPath)));
    print(formatIssues(issues));
    process.exitCode = issues.some((issue) => issue.severity === "error") ? 1 : 0;
    return;
  }
  const targetPath = options.get("file") ? path.resolve(options.get("file") as string) : latestManifestPath(projectRoot);
  const issues = validateManifest(readManifest(targetPath));
  print(formatIssues(issues));
  process.exitCode = issues.some((issue) => issue.severity === "error") ? 1 : 0;
}

function runExport(projectRoot: string, options: Map<string, string>): void {
  const config = loadConfig(projectRoot);
  const sourcePath = latestManifestPath(projectRoot);
  const targetPath = path.resolve(projectRoot, options.get("out") ?? config.outputFile);
  ensureDir(path.dirname(targetPath));
  if (sourcePath !== targetPath) {
    fs.copyFileSync(sourcePath, targetPath);
  }
  print(`Exported manifest to ${path.relative(projectRoot, targetPath)}`);
}

function runDiff(options: Map<string, string>): void {
  const leftPath = options.get("left");
  const rightPath = options.get("right");
  if (!leftPath || !rightPath) {
    throw new Error("diff requires --left and --right");
  }
  const left = readManifest(path.resolve(leftPath));
  const right = readManifest(path.resolve(rightPath));
  const diff = diffManifests(left, right);
  print(diff.lines.join("\n"));

  // --ci mode: fail on breaking changes, with configurable threshold
  const ci = options.get("ci") === "true";
  if (ci) {
    if (diff.breaking) {
      print("\nCI CHECK FAILED: Breaking changes detected.");
      process.exitCode = 2;
      return;
    }
    // Check change count threshold
    const maxChanges = parseInt(options.get("max-changes") ?? "0", 10);
    const changeCount = diff.lines.filter((l) => l !== "No manifest changes detected.").length;
    if (maxChanges > 0 && changeCount > maxChanges) {
      print(`\nCI CHECK FAILED: ${changeCount} change(s) exceed threshold of ${maxChanges}.`);
      process.exitCode = 2;
      return;
    }
    print("\nCI CHECK PASSED.");
    process.exitCode = 0;
    return;
  }

  process.exitCode = diff.breaking ? 2 : 0;
}

function runPropose(projectRoot: string): void {
  const config = loadConfig(projectRoot);
  const scanPath = getScanCachePath(projectRoot, config.cacheDir);
  const nextManifest = scanProject(projectRoot);
  if (!pathExists(scanPath)) {
    print("No previous scan found. `asi scan` will create the initial manifest.");
    print(JSON.stringify(nextManifest.pages, null, 2));
    return;
  }
  const current = readManifest(scanPath);
  const diff = diffManifests(current, nextManifest);
  print(diff.lines.join("\n"));
}

async function runServe(projectRoot: string, options: Map<string, string>): Promise<void> {
  const manifestPath = latestManifestPath(projectRoot);
  if (!pathExists(manifestPath)) {
    throw new Error("No manifest found. Run `asi scan` or `asi compile` first.");
  }
  const manifest = readManifest(manifestPath);
  const port = parseInt(options.get("port") ?? "4380", 10);

  const reports: AgentReport[] = [];
  const server = await startServer({
    manifest,
    port,
    onReport: (report) => {
      reports.push(report);
      print(`Report received: workflow=${report.workflow} status=${report.status}`);
    }
  });

  print(`ASI manifest server running at http://localhost:${port}`);
  print(`  GET  /              Level 0 — App overview + page summaries`);
  print(`  GET  /pages         Level 0 — Page list`);
  print(`  GET  /pages/:id     Level 1 — Page detail`);
  print(`  GET  /workflows     Workflow list`);
  print(`  GET  /workflows/:id Level 2 — Workflow detail`);
  print(`  POST /reports       Submit agent report`);
  print(`  GET  /manifest/full Full manifest (escape hatch)`);
  print(`\nPress Ctrl+C to stop.`);

  process.on("SIGINT", () => {
    server.close();
    if (reports.length > 0) {
      print(`\n${reports.length} report(s) received during session.`);
    }
    process.exit(0);
  });
}

function runHelp(): void {
  print(
    [
      "ASI CLI",
      "",
      "Commands:",
      "  asi init [--project <dir>] [--framework next|react] [--surface web|desktop|mobile]",
      "  asi scan [--project <dir>]",
      "  asi propose [--project <dir>]",
      "  asi compile [--project <dir>]",
      "  asi validate [--project <dir>] [--file <manifest.json>] [--report <report.json>]",
      "  asi export [--project <dir>] [--out <manifest.json>]",
      "  asi diff --left <manifest.json> --right <manifest.json> [--ci] [--max-changes <n>]",
      "  asi serve [--project <dir>] [--port <port>]"
    ].join("\n")
  );
}

function main(): void {
  const { command, options } = parseArgs(process.argv.slice(2));
  const projectRoot = resolveProjectRoot(options);
  switch (command) {
    case "init":
      runInit(projectRoot, options);
      return;
    case "scan":
      runScan(projectRoot);
      return;
    case "propose":
      runPropose(projectRoot);
      return;
    case "compile":
      runCompile(projectRoot);
      return;
    case "validate":
      runValidate(projectRoot, options);
      return;
    case "export":
      runExport(projectRoot, options);
      return;
    case "diff":
      runDiff(options);
      return;
    case "serve":
      runServe(projectRoot, options);
      return;
    default:
      runHelp();
  }
}

main();
