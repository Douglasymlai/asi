import fs from "node:fs";
import path from "node:path";
import { FrameworkAdapter } from "../../core/src/framework/contracts.js";
import { AsiConfig } from "../../core/src/specs/contracts.js";
import { listFiles, pathExists } from "../../core/src/utils/fs.js";

const PAGE_FILE_PATTERN = /\.(tsx|ts|jsx|js)$/;

function normalizeRoute(route: string): string {
  if (route === "/") {
    return route;
  }
  return route.startsWith("/") ? route : `/${route}`;
}

function routeFromReactPageFile(filePath: string, routesDir: string): string {
  const relative = path.relative(routesDir, filePath).replace(/\\/g, "/");
  const withoutExtension = relative.replace(/\.(tsx|ts|jsx|js)$/, "");
  const withoutIndex = withoutExtension.replace(/(^|\/)index$/, "");
  if (withoutIndex === "") {
    return "/";
  }
  const segments = withoutIndex
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamicMatch = segment.match(/^\[(.+)\]$/);
      if (dynamicMatch) {
        return `:${dynamicMatch[1]}`;
      }
      return segment;
    });
  return `/${segments.join("/")}`;
}

function extractExplicitRoute(source: string): string | undefined {
  const routeConst = source.match(/export\s+const\s+asiRoute\s*=\s*["']([^"']+)["']/);
  if (routeConst?.[1]) {
    return normalizeRoute(routeConst[1]);
  }
  const routeMarker = source.match(/data-route=["']([^"']+)["']/);
  if (routeMarker?.[1]) {
    return normalizeRoute(routeMarker[1]);
  }
  return undefined;
}

function resolveImportPath(routerFile: string, importPath: string): string | undefined {
  const absoluteBase = path.resolve(path.dirname(routerFile), importPath);
  const candidates = [
    absoluteBase,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.ts`,
    `${absoluteBase}.jsx`,
    `${absoluteBase}.js`,
    path.join(absoluteBase, "index.tsx"),
    path.join(absoluteBase, "index.ts"),
    path.join(absoluteBase, "index.jsx"),
    path.join(absoluteBase, "index.js")
  ];

  return candidates.find((candidate) => pathExists(candidate));
}

function collectImports(source: string, sourceFile: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of source.matchAll(/import\s+([A-Z][A-Za-z0-9_]+)\s+from\s+["'](.+?)["']/g)) {
    const importPath = resolveImportPath(sourceFile, match[2]!);
    if (importPath) {
      imports.set(match[1]!, importPath);
    }
  }
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](.+?)["']/g)) {
    const names = match[1]!;
    const importPath = resolveImportPath(sourceFile, match[2]!);
    if (!importPath) continue;
    for (const name of names.split(",")) {
      const trimmed = name.trim();
      const asMatch = trimmed.match(/(\w+)\s+as\s+([A-Z]\w*)/);
      if (asMatch?.[2]) {
        imports.set(asMatch[2], importPath);
      } else if (/^[A-Z]/.test(trimmed)) {
        imports.set(trimmed, importPath);
      }
    }
  }
  return imports;
}

function extractJsxRoutes(source: string, imports: Map<string, string>): Map<string, string> {
  const routeMap = new Map<string, string>();
  for (const match of source.matchAll(/<Route[^>]*path=["']([^"']+)["'][^>]*element=\{<([A-Z][A-Za-z0-9_]+)/g)) {
    const route = normalizeRoute(match[1]!);
    const importPath = imports.get(match[2]!);
    if (importPath) {
      routeMap.set(importPath, route);
    }
  }
  for (const match of source.matchAll(/<Route[^>]*element=\{<([A-Z][A-Za-z0-9_]+)[^>]*path=["']([^"']+)["']/g)) {
    const route = normalizeRoute(match[2]!);
    const importPath = imports.get(match[1]!);
    if (importPath && !routeMap.has(importPath)) {
      routeMap.set(importPath, route);
    }
  }
  return routeMap;
}

function extractObjectRoutes(source: string, imports: Map<string, string>, sourceFile: string): Map<string, string> {
  const routeMap = new Map<string, string>();
  for (const match of source.matchAll(/path:\s*["']([^"']+)["'][^}]*element:\s*<([A-Z][A-Za-z0-9_]+)/g)) {
    const route = normalizeRoute(match[1]!);
    const importPath = imports.get(match[2]!);
    if (importPath) {
      routeMap.set(importPath, route);
    }
  }
  for (const match of source.matchAll(/path:\s*["']([^"']+)["'][^}]*Component:\s*([A-Z][A-Za-z0-9_]+)/g)) {
    const route = normalizeRoute(match[1]!);
    const importPath = imports.get(match[2]!);
    if (importPath && !routeMap.has(importPath)) {
      routeMap.set(importPath, route);
    }
  }
  for (const match of source.matchAll(/path:\s*["']([^"']+)["'][^}]*lazy:\s*\(\)\s*=>\s*import\(["']([^"']+)["']\)/g)) {
    const route = normalizeRoute(match[1]!);
    const lazyPath = resolveImportPath(sourceFile, match[2]!);
    if (lazyPath && !routeMap.has(lazyPath)) {
      routeMap.set(lazyPath, route);
    }
  }
  return routeMap;
}

function buildReactRouterMap(projectRoot: string, config: AsiConfig): Map<string, string> {
  if (config.router !== "react-router") {
    return new Map();
  }

  const candidates = [
    config.routerConfigFile ? path.join(projectRoot, config.routerConfigFile) : undefined,
    path.join(projectRoot, config.srcDir, "App.tsx"),
    path.join(projectRoot, config.srcDir, "App.jsx"),
    path.join(projectRoot, config.srcDir, "router.tsx"),
    path.join(projectRoot, config.srcDir, "router.ts"),
    path.join(projectRoot, config.srcDir, "routes.tsx"),
    path.join(projectRoot, config.srcDir, "routes.ts")
  ].filter((candidate): candidate is string => candidate !== undefined && pathExists(candidate));

  const routeMap = new Map<string, string>();
  for (const candidate of candidates) {
    const source = fs.readFileSync(candidate, "utf8");
    const imports = collectImports(source, candidate);

    for (const [filePath, route] of extractJsxRoutes(source, imports)) {
      routeMap.set(filePath, route);
    }
    for (const [filePath, route] of extractObjectRoutes(source, imports, candidate)) {
      if (!routeMap.has(filePath)) {
        routeMap.set(filePath, route);
      }
    }
  }

  return routeMap;
}

function discoverReactPageFiles(projectRoot: string, config: AsiConfig): string[] {
  const routesDir = path.join(projectRoot, config.routesDir);
  return listFiles(routesDir, (filePath) => PAGE_FILE_PATTERN.test(filePath))
    .filter((filePath) => !filePath.endsWith(".d.ts"));
}

export const reactFrameworkAdapter: FrameworkAdapter = {
  id: "react",
  discoverPages(projectRoot: string, config: AsiConfig) {
    const routesDir = path.join(projectRoot, config.routesDir);
    const routeMap = buildReactRouterMap(projectRoot, config);

    return discoverReactPageFiles(projectRoot, config).map((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const explicitRoute = extractExplicitRoute(source);
      return {
        filePath,
        route: explicitRoute ?? routeMap.get(filePath) ?? routeFromReactPageFile(filePath, routesDir)
      };
    });
  }
};
