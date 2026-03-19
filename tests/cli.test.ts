import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFixtureApp, copyReactFixtureApp, REPO_ROOT } from "./helpers.js";

const CLI_PATH = path.join(REPO_ROOT, "dist/src/cli/index.js");

test("cli init creates a default config in a fresh project", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asi-init-"));
  execFileSync(process.execPath, [CLI_PATH, "init", "--project", projectRoot], { cwd: REPO_ROOT });
  assert.ok(fs.existsSync(path.join(projectRoot, "asi.config.json")));
});

test("cli scan, compile, validate, export, and diff run end-to-end", () => {
  const projectRoot = copyFixtureApp();
  const exportPath = path.join(projectRoot, "exports", "manifest.json");

  execFileSync(process.execPath, [CLI_PATH, "scan", "--project", projectRoot], { cwd: REPO_ROOT });
  execFileSync(process.execPath, [CLI_PATH, "compile", "--project", projectRoot], { cwd: REPO_ROOT });
  const validateOutput = execFileSync(process.execPath, [CLI_PATH, "validate", "--project", projectRoot], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  execFileSync(process.execPath, [CLI_PATH, "export", "--project", projectRoot, "--out", exportPath], { cwd: REPO_ROOT });

  const modifiedManifestPath = path.join(projectRoot, "modified-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "asi-manifest.json"), "utf8"));
  manifest.pageDetails["order-detail"].actions.pop();
  fs.writeFileSync(modifiedManifestPath, JSON.stringify(manifest, null, 2));

  const diffResult = spawnSync(
    process.execPath,
    [CLI_PATH, "diff", "--left", path.join(projectRoot, "asi-manifest.json"), "--right", modifiedManifestPath],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );

  assert.match(validateOutput, /No validation issues found/);
  assert.ok(fs.existsSync(exportPath));
  assert.equal(diffResult.status, 2);
  assert.match(diffResult.stdout, /removed action "archive_order"/);
});

test("cli init scaffolds generic React config", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asi-react-init-"));
  execFileSync(process.execPath, [CLI_PATH, "init", "--project", projectRoot, "--framework", "react"], { cwd: REPO_ROOT });
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "asi.config.json"), "utf8"));
  assert.equal(config.framework, "react");
  assert.equal(config.routesDir, "src/pages");
});

test("cli scan and validate work for the generic React fixture", () => {
  const projectRoot = copyReactFixtureApp();
  execFileSync(process.execPath, [CLI_PATH, "scan", "--project", projectRoot], { cwd: REPO_ROOT });
  const validateOutput = execFileSync(process.execPath, [CLI_PATH, "validate", "--project", projectRoot], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "asi-manifest.json"), "utf8"));
  assert.equal(manifest.app.framework, "react");
  assert.ok(Array.isArray(manifest.components));
  assert.match(validateOutput, /No validation issues found/);
});
