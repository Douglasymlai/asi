import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./helpers.js";

function createTempCache(root: string): string {
  const cacheDir = path.join(root, "npm-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

test("package tarball includes release assets and installed CLI works", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asi-package-"));
  const cacheDir = createTempCache(tempRoot);
  const installRoot = path.join(tempRoot, "consumer");
  fs.mkdirSync(installRoot, { recursive: true });
  fs.writeFileSync(
    path.join(installRoot, "package.json"),
    JSON.stringify({ name: "asi-consumer", private: true }, null, 2)
  );

  const tarballName = execFileSync(
    "npm",
    ["pack", "--pack-destination", tempRoot, "--cache", cacheDir],
    { cwd: REPO_ROOT, encoding: "utf8" }
  ).trim();
  const tarballPath = path.join(tempRoot, tarballName);
  const typescriptTarballName = execFileSync(
    "npm",
    ["pack", path.join(REPO_ROOT, "node_modules", "typescript"), "--pack-destination", tempRoot, "--cache", cacheDir],
    { cwd: REPO_ROOT, encoding: "utf8" }
  ).trim();
  const typescriptTarballPath = path.join(tempRoot, typescriptTarballName);
  const tarEntries = execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  assert.ok(tarEntries.includes("package/dist/src/cli/index.js"));
  assert.ok(tarEntries.includes("package/README.md"));
  assert.ok(tarEntries.includes("package/LICENSE"));
  assert.ok(!tarEntries.some((entry) => entry.startsWith("package/src/")));
  assert.ok(!tarEntries.some((entry) => entry.startsWith("package/tests/")));
  assert.ok(!tarEntries.some((entry) => entry.includes(".claude")));

  execFileSync("npm", ["install", typescriptTarballPath, tarballPath, "--cache", cacheDir, "--offline", "--no-audit"], {
    cwd: installRoot,
    stdio: "pipe"
  });

  const binPath = path.join(installRoot, "node_modules", ".bin", "asi");
  const projectRoot = path.join(installRoot, "sample-project");
  fs.mkdirSync(projectRoot, { recursive: true });

  execFileSync(binPath, ["init", "--project", projectRoot], {
    cwd: installRoot,
    stdio: "pipe"
  });

  assert.ok(fs.existsSync(path.join(projectRoot, "asi.config.json")));
});
