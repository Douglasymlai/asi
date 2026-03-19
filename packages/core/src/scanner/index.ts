import fs from "node:fs";
import path from "node:path";
import { SIA_VERSION, SiaManifest } from "../specs/contracts.js";
import { assertValidManifest } from "../specs/validation.js";
import { writeJsonFile } from "../utils/fs.js";
import { FrameworkAdapter } from "../framework/contracts.js";
import { extractComponentCatalog } from "./components.js";
import { scanPageFile } from "./pages.js";
import { AsiConfig } from "../specs/contracts.js";

export function getScanCachePath(projectRoot: string, cacheDir: string): string {
  return path.join(projectRoot, cacheDir, "scan-manifest.json");
}

export function scanProjectWithAdapter(projectRoot: string, config: AsiConfig, adapter: FrameworkAdapter): SiaManifest {
  const discoveredPages = adapter.discoverPages(projectRoot, config);
  const warnings: string[] = [];
  if (discoveredPages.length === 0) {
    warnings.push("no_pages_found");
  }

  const pageDetails = Object.fromEntries(
    discoveredPages.map(({ filePath, route }) => {
      const page = scanPageFile(filePath, route, projectRoot, config);
      return [page.id, page];
    })
  );
  const pages = Object.values(pageDetails).map((page) => ({
    id: page.id,
    route: page.route,
    type: page.type,
    purpose: page.purpose,
    ...(page.entity ? { entity: page.entity } : {}),
    ...(page.dynamic ? { dynamic: true } : {})
  }));
  const components = extractComponentCatalog(projectRoot, config);

  const packageName = getPackageName(projectRoot);
  const manifest: SiaManifest = {
    sia: SIA_VERSION,
    app: {
      name: config.app?.name ?? packageName ?? path.basename(projectRoot),
      framework: config.framework,
      domain: config.app?.domain ?? inferDomain(Object.values(pageDetails).map((page) => page.route)),
      generatedAt: new Date().toISOString()
    },
    pages,
    pageDetails,
    workflowDetails: {},
    ...(components.length > 0 ? { components } : {}),
    metadata: {
      generatedFrom: "scan",
      scanWarnings: warnings
    }
  };
  return assertValidManifest(manifest);
}

export function scanAndWriteWithAdapter(projectRoot: string, config: AsiConfig, adapter: FrameworkAdapter): SiaManifest {
  const manifest = scanProjectWithAdapter(projectRoot, config, adapter);
  const scanCachePath = getScanCachePath(projectRoot, config.cacheDir);
  writeJsonFile(scanCachePath, manifest);
  writeJsonFile(path.join(projectRoot, config.outputFile), manifest);
  return manifest;
}

function getPackageName(projectRoot: string): string | undefined {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(packagePath, "utf8")).name as string | undefined;
}

function inferDomain(routes: string[]): string {
  if (routes.some((route) => route.startsWith("/orders")) && routes.some((route) => route.startsWith("/customers"))) {
    return "e-commerce";
  }
  return "general";
}
