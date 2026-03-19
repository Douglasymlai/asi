import fs from "node:fs";
import path from "node:path";
import { AvailabilityConditions, WorkflowDetail, WorkflowStep } from "../specs/contracts.js";
import { slugify } from "../utils/text.js";

interface ParsedWorkflow {
  id: string;
  goal: string;
  trigger: string;
  availableWhen?: AvailabilityConditions;
  steps: WorkflowStep[];
  completion: WorkflowDetail["completion"];
  metadata: WorkflowDetail["metadata"];
}

function parseKeyValueList(lines: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of lines) {
    const cleaned = line.replace(/^- /, "").trim();
    const [key, ...rest] = cleaned.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    result[slugify(key).replace(/_/g, "")] = rest.join(":").trim().replace(/^"|"$/g, "");
  }
  return result;
}

function parseAvailability(lines: string[]): AvailabilityConditions | undefined {
  const result: AvailabilityConditions = {};
  for (const line of lines) {
    const cleaned = line.replace(/^- /, "").trim();
    const [key, ...rest] = cleaned.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    const values = rest.join(":").split(",").map((value) => value.trim()).filter(Boolean);
    if (slugify(key) === "status") {
      result.status = values;
    }
    if (slugify(key) === "role") {
      result.role = values;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseStepDefinition(line: string): { id: string; description: string } | null {
  const match = line.match(/\[(.+?)\]\s+(.+)$/);
  if (!match) {
    return null;
  }
  return {
    id: match[1],
    description: match[2]
  };
}

function inferStepAction(description: string): WorkflowStep["action"] {
  const lowered = description.toLowerCase();
  if (lowered.startsWith("click")) {
    return "click";
  }
  if (lowered.startsWith("enter") || lowered.startsWith("add")) {
    return "input";
  }
  if (lowered.startsWith("select")) {
    return "select";
  }
  return "assert";
}

function inferStepTarget(stepId: string, description: string): string {
  const quoted = description.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    return slugify(quoted[1]);
  }
  return stepId;
}

function parseSteps(lines: string[]): WorkflowStep[] {
  const mainSteps: Array<{ id: string; description: string; optional?: Array<{ id: string; description: string }> }> = [];
  let current: { id: string; description: string; optional?: Array<{ id: string; description: string }> } | undefined;

  for (const line of lines) {
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      const parsed = parseStepDefinition(numbered[1]);
      if (parsed) {
        current = { ...parsed, optional: [] };
        mainSteps.push(current);
      }
      continue;
    }
    const optional = line.match(/^\s*-\s*optional:\s+(.+)$/);
    if (optional && current) {
      const parsed = parseStepDefinition(optional[1]);
      if (parsed) {
        current.optional?.push(parsed);
      }
    }
  }

  const steps: WorkflowStep[] = [];
  for (let index = 0; index < mainSteps.length; index += 1) {
    const currentStep = mainSteps[index]!;
    const nextMain = mainSteps[index + 1]?.id ?? null;
    const optionalIds = currentStep.optional?.map((step) => step.id) ?? [];
    steps.push({
      id: currentStep.id,
      action: inferStepAction(currentStep.description),
      target: inferStepTarget(currentStep.id, currentStep.description),
      description: currentStep.description,
      next: nextMain,
      ...(optionalIds.length ? { optional_next: optionalIds } : {})
    });
    for (const optionalStep of currentStep.optional ?? []) {
      steps.push({
        id: optionalStep.id,
        action: inferStepAction(optionalStep.description),
        target: inferStepTarget(optionalStep.id, optionalStep.description),
        description: optionalStep.description,
        required: false,
        next: nextMain
      });
    }
  }
  if (steps.length > 0) {
    const lastMainStepId = mainSteps[mainSteps.length - 1]?.id;
    const lastStep = steps.find((step) => step.id === lastMainStepId);
    if (lastStep) {
      lastStep.next = null;
    }
  }
  return steps;
}

export function parseWorkflowFile(filePath: string): ParsedWorkflow {
  const source = fs.readFileSync(filePath, "utf8");
  const sections = source.split(/^## /m);
  const header = sections[0] ?? "";
  const titleMatch = header.match(/^#\s+(.+)$/m);
  const goalMatch = header.match(/^>\s+(.+)$/m);
  if (!titleMatch || !goalMatch) {
    throw new Error(`Workflow ${path.basename(filePath)} is missing title or goal`);
  }

  const sectionMap = new Map<string, string[]>();
  for (const section of sections.slice(1)) {
    const [rawName, ...rest] = section.split("\n");
    sectionMap.set(slugify(rawName), rest.map((line) => line.trimEnd()).filter(Boolean));
  }

  const trigger = sectionMap.get("trigger")?.[0]?.replace(/^- /, "").trim();
  if (!trigger) {
    throw new Error(`Workflow ${path.basename(filePath)} is missing trigger`);
  }

  const metadataPairs = parseKeyValueList(sectionMap.get("metadata") ?? []);
  const completionPairs = parseKeyValueList(sectionMap.get("completion") ?? []);
  const steps = parseSteps(sectionMap.get("steps") ?? []);
  if (steps.length === 0) {
    throw new Error(`Workflow ${path.basename(filePath)} has no steps`);
  }

  const stateChange = completionPairs.statechange ?? completionPairs.state_change;
  const [changeField, changeValue] = stateChange?.split("→").map((value) => value.trim()) ?? [];

  return {
    id: slugify(titleMatch[1]).replace(/_/g, "-"),
    goal: goalMatch[1],
    trigger,
    availableWhen: parseAvailability(sectionMap.get("available_when") ?? []),
    steps,
    completion: {
      signal: completionPairs.signal ?? "unknown",
      ...(completionPairs.messagecontains ? { message_contains: completionPairs.messagecontains } : {}),
      ...(completionPairs.redirectsto ? { redirects_to: completionPairs.redirectsto } : {}),
      ...(changeField && changeValue ? { expectedStateChange: { [changeField]: changeValue } } : {})
    },
    metadata: {
      risk: metadataPairs.risk === "high" || metadataPairs.risk === "medium" ? metadataPairs.risk : "low",
      sideEffects: metadataPairs.sideeffects?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
      reversible: metadataPairs.reversible === "true",
      sourceFile: filePath
    }
  };
}
