import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsiManifest } from "../src/specs/contracts.js";

export const REPO_ROOT = process.cwd();
export const FIXTURE_APP_ROOT = path.join(REPO_ROOT, "tests/fixtures/fixture-app");
export const REACT_FIXTURE_APP_ROOT = path.join(REPO_ROOT, "tests/fixtures/react-web-app");
export const GOLDEN_MANIFEST_PATH = path.join(FIXTURE_APP_ROOT, "asi-manifest.json");

export function copyFixtureApp(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asi-fixture-"));
  fs.cpSync(FIXTURE_APP_ROOT, tempRoot, { recursive: true });
  return tempRoot;
}

export function copyReactFixtureApp(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asi-react-fixture-"));
  fs.cpSync(REACT_FIXTURE_APP_ROOT, tempRoot, { recursive: true });
  return tempRoot;
}

export function normalizeManifest(manifest: AsiManifest): AsiManifest {
  return JSON.parse(JSON.stringify({
    ...manifest,
    app: {
      ...manifest.app,
      generatedAt: "<generatedAt>"
    }
  })) as AsiManifest;
}
