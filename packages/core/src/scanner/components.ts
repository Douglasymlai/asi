import fs from "node:fs";
import path from "node:path";
import { AsiConfig, ComponentManifest, ComponentVariantManifest, RiskLevel } from "../specs/contracts.js";
import { listFiles, pathExists } from "../utils/fs.js";
import { slugify, unique } from "../utils/text.js";

const SHADCN_COMPONENT_ROLES: Record<string, { semanticRole: string; risk?: RiskLevel; requiresConfirmation?: boolean; intents?: string[] }> = {
  button: { semanticRole: "action-trigger" },
  dialog: { semanticRole: "modal-dialog" },
  alertdialog: { semanticRole: "confirmation-dialog", risk: "high", requiresConfirmation: true, intents: ["confirm_action"] },
  dropdownmenu: { semanticRole: "menu" },
  sheet: { semanticRole: "drawer" },
  tabs: { semanticRole: "navigation-tabs" },
  form: { semanticRole: "form" },
  input: { semanticRole: "text-input" },
  select: { semanticRole: "select-input" },
  checkbox: { semanticRole: "boolean-input" },
  table: { semanticRole: "data-table" }
};

function inferComponentName(filePath: string, source: string): string {
  const exportMatch = source.match(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9]+)/);
  if (exportMatch?.[1]) {
    return exportMatch[1];
  }
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function extractVariantBlock(source: string): string[] {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes("variants:"));
  if (start === -1) {
    return [];
  }
  const block: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.includes("defaultVariants")) {
      break;
    }
    block.push(line);
  }
  return block;
}

function extractVariants(source: string): ComponentVariantManifest[] | undefined {
  const lines = extractVariantBlock(source);
  if (lines.length === 0) {
    return undefined;
  }

  const variants: ComponentVariantManifest[] = [];
  let current: ComponentVariantManifest | undefined;
  for (const line of lines) {
    const dimension = line.match(/^\s*([A-Za-z0-9_]+):\s*{\s*$/);
    if (dimension) {
      current = { name: dimension[1]!, values: [] };
      variants.push(current);
      continue;
    }
    if (current) {
      const option = line.match(/^\s*([A-Za-z0-9_]+):\s*/);
      if (option && !["class", "className"].includes(option[1]!)) {
        current.values.push(option[1]!);
      }
      if (line.match(/^\s*}\s*,?\s*$/)) {
        current = undefined;
      }
    }
  }

  return variants.filter((variant) => variant.values.length > 0);
}

function extractImportantProps(source: string, variants: ComponentVariantManifest[] | undefined): string[] | undefined {
  const props = new Set<string>(variants?.map((variant) => variant.name) ?? []);
  for (const prop of ["asChild", "disabled", "checked", "open", "defaultValue", "value", "type"]) {
    if (source.includes(prop)) {
      props.add(prop);
    }
  }
  return props.size > 0 ? [...props] : undefined;
}

function extractStates(source: string, variants: ComponentVariantManifest[] | undefined): string[] | undefined {
  const states = new Set<string>();
  for (const state of ["open", "closed", "checked", "unchecked", "active", "inactive", "disabled", "loading", "selected", "unselected"]) {
    if (source.includes(state)) {
      states.add(state);
    }
  }
  if (variants?.some((variant) => variant.name === "variant" && variant.values.includes("destructive"))) {
    states.add("destructive");
  }
  return states.size > 0 ? [...states] : undefined;
}

function inferRole(name: string): { semanticRole: string; risk?: RiskLevel; requiresConfirmation?: boolean; intents?: string[] } | undefined {
  return SHADCN_COMPONENT_ROLES[name.toLowerCase()];
}

function detectLibrary(filePath: string): string | undefined {
  if (filePath.includes(`${path.sep}components${path.sep}ui${path.sep}`)) {
    return "shadcn-ui";
  }
  return undefined;
}

function buildComponentManifest(filePath: string, source: string, projectRoot: string): ComponentManifest {
  const name = inferComponentName(filePath, source);
  const variants = extractVariants(source);
  const role = inferRole(name) ?? { semanticRole: "component" };
  const risk = role.risk ?? (variants?.some((variant) => variant.name === "variant" && variant.values.includes("destructive")) ? "high" : undefined);

  return {
    id: slugify(name),
    name,
    semanticRole: role.semanticRole,
    ...(variants && variants.length > 0 ? { variants } : {}),
    ...(extractStates(source, variants) ? { states: extractStates(source, variants) } : {}),
    ...(extractImportantProps(source, variants) ? { importantProps: extractImportantProps(source, variants) } : {}),
    ...(risk ? { risk } : {}),
    ...(role.requiresConfirmation ? { requiresConfirmation: true } : {}),
    ...(role.intents ? { intents: role.intents } : {}),
    confidence: detectLibrary(filePath) === "shadcn-ui" ? 0.95 : 0.7,
    source: {
      file: path.relative(projectRoot, filePath),
      exportName: name,
      ...(detectLibrary(filePath) ? { package: detectLibrary(filePath) } : {})
    }
  };
}

export function extractComponentCatalog(projectRoot: string, config: AsiConfig): ComponentManifest[] {
  const componentDirs = unique(config.componentDirs?.map((dir) => path.join(projectRoot, dir)) ?? []);
  const components: ComponentManifest[] = [];

  for (const componentDir of componentDirs) {
    if (!pathExists(componentDir)) {
      continue;
    }
    const files = listFiles(componentDir, (filePath) => /\.(tsx|ts|jsx|js)$/.test(filePath));
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const name = inferComponentName(filePath, source).toLowerCase();
      if (!(name in SHADCN_COMPONENT_ROLES) && !source.includes("cva(") && !filePath.includes(`${path.sep}components${path.sep}ui${path.sep}`)) {
        continue;
      }
      components.push(buildComponentManifest(filePath, source, projectRoot));
    }
  }

  return components.sort((left, right) => left.name.localeCompare(right.name));
}
