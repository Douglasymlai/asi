import {
  SIA_VERSION,
  REPORT_VERSION,
  ActionManifest,
  AgentReport,
  AsiConfig,
  AsiFramework,
  SiaManifest,
  AsiRouter,
  AsiSurface,
  ComponentManifest,
  AvailabilityConditions,
  DynamicContent,
  PageDetail,
  WorkflowDetail,
  WorkflowStep
} from "./contracts.js";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ path, message: "Expected non-empty string", severity: "error" });
    return false;
  }
  return true;
}

function expectBoolean(value: unknown, path: string, issues: ValidationIssue[]): value is boolean {
  if (typeof value !== "boolean") {
    issues.push({ path, message: "Expected boolean", severity: "error" });
    return false;
  }
  return true;
}

function expectStringArray(value: unknown, path: string, issues: ValidationIssue[]): value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issues.push({ path, message: "Expected string array", severity: "error" });
    return false;
  }
  return true;
}

function expectStringEnum<T extends string>(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  allowed: readonly T[]
): value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push({ path, message: `Expected one of: ${allowed.join(", ")}`, severity: "error" });
    return false;
  }
  return true;
}

function validateAvailability(value: unknown, path: string, issues: ValidationIssue[]): value is AvailabilityConditions {
  if (value === undefined) {
    return true;
  }
  if (!isObject(value)) {
    issues.push({ path, message: "Expected availability object", severity: "error" });
    return false;
  }
  if (value.status !== undefined) {
    expectStringArray(value.status, `${path}.status`, issues);
  }
  if (value.role !== undefined) {
    expectStringArray(value.role, `${path}.role`, issues);
  }
  return true;
}

function validateAction(action: unknown, path: string, issues: ValidationIssue[]): action is ActionManifest {
  if (!isObject(action)) {
    issues.push({ path, message: "Expected action object", severity: "error" });
    return false;
  }
  expectString(action.id, `${path}.id`, issues);
  expectString(action.label, `${path}.label`, issues);
  expectString(action.intent, `${path}.intent`, issues);
  expectString(action.risk, `${path}.risk`, issues);
  expectBoolean(action.requiresConfirmation, `${path}.requiresConfirmation`, issues);
  expectStringArray(action.sideEffects, `${path}.sideEffects`, issues);
  expectBoolean(action.reversible, `${path}.reversible`, issues);
  validateAvailability(action.availableWhen, `${path}.availableWhen`, issues);
  if (typeof action.confidence !== "number") {
    issues.push({ path: `${path}.confidence`, message: "Expected number", severity: "error" });
  }
  if (!isObject(action.source)) {
    issues.push({ path: `${path}.source`, message: "Expected source object", severity: "error" });
  }
  return true;
}

function validateDynamicContent(value: unknown, path: string, issues: ValidationIssue[]): value is DynamicContent {
  if (value === undefined) {
    return true;
  }
  if (!isObject(value)) {
    issues.push({ path, message: "Expected dynamicContent object", severity: "error" });
    return false;
  }
  expectString(value.dataSource, `${path}.dataSource`, issues);
  expectStringArray(value.entityFields, `${path}.entityFields`, issues);
  expectBoolean(value.stateDependent, `${path}.stateDependent`, issues);
  if (value.possibleStates !== undefined) {
    expectStringArray(value.possibleStates, `${path}.possibleStates`, issues);
  }
  if (value.roleDependent !== undefined) {
    expectBoolean(value.roleDependent, `${path}.roleDependent`, issues);
  }
  if (value.roles !== undefined) {
    expectStringArray(value.roles, `${path}.roles`, issues);
  }
  return true;
}

function validateComponent(value: unknown, path: string, issues: ValidationIssue[]): value is ComponentManifest {
  if (!isObject(value)) {
    issues.push({ path, message: "Expected component object", severity: "error" });
    return false;
  }
  expectString(value.id, `${path}.id`, issues);
  expectString(value.name, `${path}.name`, issues);
  expectString(value.semanticRole, `${path}.semanticRole`, issues);
  if (value.variants !== undefined) {
    if (!Array.isArray(value.variants)) {
      issues.push({ path: `${path}.variants`, message: "Expected variants array", severity: "error" });
    } else {
      value.variants.forEach((variant, index) => {
        if (!isObject(variant)) {
          issues.push({ path: `${path}.variants[${index}]`, message: "Expected variant object", severity: "error" });
          return;
        }
        expectString(variant.name, `${path}.variants[${index}].name`, issues);
        expectStringArray(variant.values, `${path}.variants[${index}].values`, issues);
      });
    }
  }
  if (value.states !== undefined) {
    expectStringArray(value.states, `${path}.states`, issues);
  }
  if (value.importantProps !== undefined) {
    expectStringArray(value.importantProps, `${path}.importantProps`, issues);
  }
  if (value.intents !== undefined) {
    expectStringArray(value.intents, `${path}.intents`, issues);
  }
  if (value.risk !== undefined) {
    expectString(value.risk, `${path}.risk`, issues);
  }
  if (value.requiresConfirmation !== undefined) {
    expectBoolean(value.requiresConfirmation, `${path}.requiresConfirmation`, issues);
  }
  if (typeof value.confidence !== "number") {
    issues.push({ path: `${path}.confidence`, message: "Expected number", severity: "error" });
  }
  if (!isObject(value.source)) {
    issues.push({ path: `${path}.source`, message: "Expected source object", severity: "error" });
  }
  return true;
}

function validatePageDetail(value: unknown, path: string, issues: ValidationIssue[]): value is PageDetail {
  if (!isObject(value)) {
    issues.push({ path, message: "Expected page detail object", severity: "error" });
    return false;
  }
  expectString(value.id, `${path}.id`, issues);
  expectString(value.route, `${path}.route`, issues);
  expectString(value.type, `${path}.type`, issues);
  expectString(value.purpose, `${path}.purpose`, issues);
  if (value.entity !== undefined) {
    expectString(value.entity, `${path}.entity`, issues);
  }
  if (value.dynamic !== undefined) {
    expectBoolean(value.dynamic, `${path}.dynamic`, issues);
  }
  expectString(value.sourceFile, `${path}.sourceFile`, issues);
  if (typeof value.confidence !== "number") {
    issues.push({ path: `${path}.confidence`, message: "Expected number", severity: "error" });
  }
  if (!Array.isArray(value.actions)) {
    issues.push({ path: `${path}.actions`, message: "Expected actions array", severity: "error" });
  } else {
    value.actions.forEach((action, index) => validateAction(action, `${path}.actions[${index}]`, issues));
  }
  if (!Array.isArray(value.workflows)) {
    issues.push({ path: `${path}.workflows`, message: "Expected workflows array", severity: "error" });
  }
  validateDynamicContent(value.dynamicContent, `${path}.dynamicContent`, issues);
  return true;
}

function validateStep(value: unknown, path: string, issues: ValidationIssue[]): value is WorkflowStep {
  if (!isObject(value)) {
    issues.push({ path, message: "Expected workflow step", severity: "error" });
    return false;
  }
  expectString(value.id, `${path}.id`, issues);
  expectString(value.action, `${path}.action`, issues);
  expectString(value.target, `${path}.target`, issues);
  expectString(value.description, `${path}.description`, issues);
  if (value.inputType !== undefined) {
    expectString(value.inputType, `${path}.inputType`, issues);
  }
  if (value.required !== undefined) {
    expectBoolean(value.required, `${path}.required`, issues);
  }
  if (value.next !== null) {
    expectString(value.next, `${path}.next`, issues);
  }
  if (value.optional_next !== undefined) {
    expectStringArray(value.optional_next, `${path}.optional_next`, issues);
  }
  return true;
}

function validateWorkflow(value: unknown, path: string, issues: ValidationIssue[]): value is WorkflowDetail {
  if (!isObject(value)) {
    issues.push({ path, message: "Expected workflow detail", severity: "error" });
    return false;
  }
  expectString(value.id, `${path}.id`, issues);
  expectString(value.pageId, `${path}.pageId`, issues);
  expectString(value.goal, `${path}.goal`, issues);
  expectString(value.trigger, `${path}.trigger`, issues);
  validateAvailability(value.availableWhen, `${path}.availableWhen`, issues);
  if (!Array.isArray(value.steps)) {
    issues.push({ path: `${path}.steps`, message: "Expected steps array", severity: "error" });
  } else {
    value.steps.forEach((step, index) => validateStep(step, `${path}.steps[${index}]`, issues));
  }
  if (!isObject(value.completion)) {
    issues.push({ path: `${path}.completion`, message: "Expected completion object", severity: "error" });
  }
  if (!isObject(value.reporting)) {
    issues.push({ path: `${path}.reporting`, message: "Expected reporting object", severity: "error" });
  }
  if (!isObject(value.metadata)) {
    issues.push({ path: `${path}.metadata`, message: "Expected metadata object", severity: "error" });
  }
  return true;
}

export function validateManifest(manifest: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(manifest)) {
    return [{ path: "$", message: "Manifest must be an object", severity: "error" }];
  }
  if (manifest.sia !== SIA_VERSION) {
    issues.push({ path: "$.sia", message: `Expected SIA version ${SIA_VERSION}`, severity: "error" });
  }
  if (!isObject(manifest.app)) {
    issues.push({ path: "$.app", message: "Expected app object", severity: "error" });
  } else {
    expectString(manifest.app.name, "$.app.name", issues);
    expectString(manifest.app.framework, "$.app.framework", issues);
    expectString(manifest.app.domain, "$.app.domain", issues);
    expectString(manifest.app.generatedAt, "$.app.generatedAt", issues);
  }
  if (!Array.isArray(manifest.pages)) {
    issues.push({ path: "$.pages", message: "Expected pages array", severity: "error" });
  }
  if (!isObject(manifest.pageDetails)) {
    issues.push({ path: "$.pageDetails", message: "Expected pageDetails object", severity: "error" });
  } else {
    Object.entries(manifest.pageDetails).forEach(([pageId, page]) => {
      validatePageDetail(page, `$.pageDetails.${pageId}`, issues);
    });
  }
  if (!isObject(manifest.workflowDetails)) {
    issues.push({ path: "$.workflowDetails", message: "Expected workflowDetails object", severity: "error" });
  } else {
    Object.entries(manifest.workflowDetails).forEach(([workflowId, workflow]) => {
      validateWorkflow(workflow, `$.workflowDetails.${workflowId}`, issues);
    });
  }
  if (manifest.components !== undefined) {
    if (!Array.isArray(manifest.components)) {
      issues.push({ path: "$.components", message: "Expected components array", severity: "error" });
    } else {
      manifest.components.forEach((component, index) => validateComponent(component, `$.components[${index}]`, issues));
    }
  }
  if (!isObject(manifest.metadata)) {
    issues.push({ path: "$.metadata", message: "Expected metadata object", severity: "error" });
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return issues;
  }

  const typedManifest = manifest as unknown as SiaManifest;
  for (const page of typedManifest.pages) {
    if (!typedManifest.pageDetails[page.id]) {
      issues.push({
        path: `$.pages[${page.id}]`,
        message: `Missing pageDetails entry for ${page.id}`,
        severity: "error"
      });
    }
  }
  for (const [pageId, page] of Object.entries(typedManifest.pageDetails)) {
    for (const workflow of page.workflows) {
      if (!typedManifest.workflowDetails[workflow.id]) {
        issues.push({
          path: `$.pageDetails.${pageId}.workflows`,
          message: `Missing workflowDetails entry for ${workflow.id}`,
          severity: "error"
        });
      }
    }
  }
  for (const [workflowId, workflow] of Object.entries(typedManifest.workflowDetails)) {
    if (!typedManifest.pageDetails[workflow.pageId]) {
      issues.push({
        path: `$.workflowDetails.${workflowId}.pageId`,
        message: `Unknown pageId ${workflow.pageId}`,
        severity: "error"
      });
    }
    const stepIds = new Set(workflow.steps.map((step) => step.id));
    for (const step of workflow.steps) {
      if (step.next && !stepIds.has(step.next)) {
        issues.push({
          path: `$.workflowDetails.${workflowId}.steps.${step.id}.next`,
          message: `Unknown next step ${step.next}`,
          severity: "error"
        });
      }
      for (const optional of step.optional_next ?? []) {
        if (!stepIds.has(optional)) {
          issues.push({
            path: `$.workflowDetails.${workflowId}.steps.${step.id}.optional_next`,
            message: `Unknown optional step ${optional}`,
            severity: "error"
          });
        }
      }
    }
  }
  return issues;
}

export function validateConfig(config: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(config)) {
    return [{ path: "$", message: "Config must be an object", severity: "error" }];
  }
  expectStringEnum(config.framework, "$.framework", issues, ["next", "react"] satisfies readonly AsiFramework[]);
  expectStringEnum(config.surface, "$.surface", issues, ["web", "desktop", "mobile"] satisfies readonly AsiSurface[]);
  if (config.router !== undefined) {
    expectStringEnum(config.router, "$.router", issues, ["next-app", "react-router", "manual"] satisfies readonly AsiRouter[]);
  }
  expectString(config.srcDir, "$.srcDir", issues);
  expectString(config.routesDir, "$.routesDir", issues);
  expectString(config.workflowsDir, "$.workflowsDir", issues);
  expectString(config.outputFile, "$.outputFile", issues);
  if (config.componentDirs !== undefined) {
    expectStringArray(config.componentDirs, "$.componentDirs", issues);
  }
  if (config.routerConfigFile !== undefined) {
    expectString(config.routerConfigFile, "$.routerConfigFile", issues);
  }
  if (!isObject(config.designSystem)) {
    issues.push({ path: "$.designSystem", message: "Expected designSystem object", severity: "error" });
  }
  return issues;
}

export function validateReport(report: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(report)) {
    return [{ path: "$", message: "Report must be an object", severity: "error" }];
  }
  if (report.sia_report !== REPORT_VERSION) {
    issues.push({ path: "$.sia_report", message: `Expected report version ${REPORT_VERSION}`, severity: "error" });
  }
  expectString(report.timestamp, "$.timestamp", issues);
  expectString(report.agent, "$.agent", issues);
  expectString(report.app, "$.app", issues);
  expectString(report.workflow, "$.workflow", issues);
  expectString(report.status, "$.status", issues);
  expectStringArray(report.steps_completed, "$.steps_completed", issues);
  if (report.steps_skipped !== undefined) {
    expectStringArray(report.steps_skipped, "$.steps_skipped", issues);
  }
  if (report.failed_at_step !== undefined) {
    expectString(report.failed_at_step, "$.failed_at_step", issues);
  }
  if (report.failure_reason !== undefined) {
    expectString(report.failure_reason, "$.failure_reason", issues);
  }
  if (typeof report.duration_ms !== "number") {
    issues.push({ path: "$.duration_ms", message: "Expected number", severity: "error" });
  }
  if (!isObject(report.entity)) {
    issues.push({ path: "$.entity", message: "Expected entity object", severity: "error" });
  } else {
    expectString(report.entity.type, "$.entity.type", issues);
    expectString(report.entity.id, "$.entity.id", issues);
    if (report.entity.stateTransition !== undefined) {
      expectString(report.entity.stateTransition, "$.entity.stateTransition", issues);
    }
  }
  expectBoolean(report.completion_verified, "$.completion_verified", issues);
  if (report.notes !== undefined && report.notes !== null && typeof report.notes !== "string") {
    issues.push({ path: "$.notes", message: "Expected string or null", severity: "error" });
  }
  return issues;
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "No validation issues found.";
  }
  return issues
    .map((issue) => `${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`)
    .join("\n");
}

export function assertValidManifest(manifest: SiaManifest): SiaManifest {
  const issues = validateManifest(manifest);
  if (issues.some((issue) => issue.severity === "error")) {
    throw new Error(formatIssues(issues));
  }
  return manifest;
}

export function assertValidConfig(config: AsiConfig): AsiConfig {
  const issues = validateConfig(config);
  if (issues.some((issue) => issue.severity === "error")) {
    throw new Error(formatIssues(issues));
  }
  return config;
}

export function assertValidReport(report: AgentReport): AgentReport {
  const issues = validateReport(report);
  if (issues.some((issue) => issue.severity === "error")) {
    throw new Error(formatIssues(issues));
  }
  return report;
}
