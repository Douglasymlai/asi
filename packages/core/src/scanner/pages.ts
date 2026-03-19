import fs from "node:fs";
import path from "node:path";
import { AsiConfig, PageDetail, PageType } from "../specs/contracts.js";
import { clampConfidence, singularize, slugify, titleCase } from "../utils/text.js";
import { extractActions } from "./actions.js";
import { inferDynamicContent } from "./dynamic.js";
import { analyzeConditionalRendering, deriveAvailabilityFromConditionals } from "./conditionals.js";

function readMarker(source: string, name: string): string | undefined {
  const match = source.match(new RegExp(`${name}=["']([^"']+)["']`));
  return match?.[1];
}

function inferEntity(route: string, source: string): string | undefined {
  const explicit = readMarker(source, "data-entity");
  if (explicit) {
    return explicit;
  }
  const segments = route.split("/").filter(Boolean).filter((segment) => !segment.startsWith(":"));
  const candidate = segments[segments.length - 1];
  if (!candidate || candidate === "settings" || candidate === "reports") {
    return undefined;
  }
  return singularize(candidate);
}

function inferPageType(route: string, source: string): PageType {
  const explicit = readMarker(source, "data-page-type");
  if (explicit === "list" || explicit === "detail" || explicit === "form" || explicit === "dashboard" || explicit === "settings" || explicit === "auth") {
    return explicit;
  }
  if (route === "/" || route.startsWith("/reports")) {
    return "dashboard";
  }
  if (route.includes("/settings")) {
    return "settings";
  }
  if (route.includes("/new") || route.includes("/create")) {
    return "form";
  }
  if (route.includes(":")) {
    return "detail";
  }
  return "list";
}

function inferPurpose(route: string, type: PageType, entity: string | undefined, source: string): string {
  const explicit = readMarker(source, "data-purpose");
  if (explicit) {
    return explicit;
  }
  const headingMatch = source.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }
  if (type === "detail" && entity) {
    return `View and manage a single ${entity}`;
  }
  if (type === "list" && entity) {
    return `Browse and search ${entity}s`;
  }
  if (type === "settings") {
    return "Configure application settings";
  }
  if (type === "dashboard") {
    return route === "/" ? "Review operational overview" : `Review ${titleCase(route.replace(/^\//, ""))}`;
  }
  if (type === "form" && entity) {
    return `Create or edit ${entity}`;
  }
  return "Understand this page";
}

function buildPageId(route: string, type: PageType, entity: string | undefined): string {
  if (type === "detail" && entity) {
    return `${entity}-detail`;
  }
  if (type === "list" && entity) {
    return `${entity}-list`;
  }
  if (type === "settings") {
    return "settings";
  }
  if (type === "dashboard" && route === "/") {
    return "dashboard";
  }
  return slugify(route.replace(/\//g, "-")) || "home";
}

export function scanPageFile(filePath: string, route: string, projectRoot: string, config: AsiConfig): PageDetail {
  const rawSource = fs.readFileSync(filePath, "utf8");
  const actions = extractActions(rawSource, filePath, projectRoot, config);
  const entity = inferEntity(route, rawSource);
  const type = inferPageType(route, rawSource);
  const purpose = inferPurpose(route, type, entity, rawSource);

  // AST-based conditional analysis to enrich actions without data-attributes
  const conditionalBlocks = analyzeConditionalRendering(rawSource, filePath);
  const enrichedActions = actions.map((action) => {
    if (action.availableWhen) return action;
    const inferred = deriveAvailabilityFromConditionals(conditionalBlocks, action.id, action.label);
    if (!inferred) return action;
    return {
      ...action,
      availableWhen: inferred,
      confidence: clampConfidence(action.confidence + 0.1)
    };
  });

  const dynamicContent = inferDynamicContent(rawSource, route, enrichedActions, entity, filePath);
  const pageId = buildPageId(route, type, entity);
  const override = config.overrides.pages?.[route];

  return {
    id: pageId,
    route,
    type: override?.type ?? type,
    purpose: override?.purpose ?? purpose,
    entity: override?.entity ?? entity,
    dynamic: Boolean(dynamicContent),
    sourceFile: path.relative(projectRoot, filePath),
    confidence: clampConfidence(0.55 + enrichedActions.length * 0.05 + (dynamicContent ? 0.1 : 0)),
    actions: enrichedActions.map((action) => {
      const actionOverride = config.overrides.actions?.[action.id];
      return {
        ...action,
        ...actionOverride
      };
    }),
    workflows: [],
    ...(dynamicContent ? { dynamicContent } : {})
  };
}
