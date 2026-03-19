import path from "node:path";
import { AsiManifest, WorkflowDetail } from "../specs/contracts.js";
import { assertValidManifest } from "../specs/validation.js";
import { listFiles } from "../utils/fs.js";
import { loadConfig } from "../config/index.js";
import { parseWorkflowFile } from "../compiler/dsl.js";

export interface MergeResult {
  manifest: AsiManifest;
  warnings: string[];
}

function formatStateTransitionTemplate(expectedStateChange: WorkflowDetail["completion"]["expectedStateChange"]): string | undefined {
  if (!expectedStateChange) {
    return undefined;
  }
  return Object.entries(expectedStateChange)
    .map(([field, value]) => `${field} -> ${value}`)
    .join(", ");
}

function createReporting(workflow: WorkflowDetail, entityType?: string): WorkflowDetail["reporting"] {
  const stateTransition = formatStateTransitionTemplate(workflow.completion.expectedStateChange);
  return {
    on_success: {
      workflow: workflow.id,
      status: "completed",
      entity: entityType ?? workflow.pageId,
      ...(stateTransition ? { stateTransition } : {})
    },
    on_failure: {
      workflow: workflow.id,
      status: "failed",
      failedAtStep: "<step_id>",
      reason: "<agent_description>"
    }
  };
}

export function mergeAuthoredWorkflows(projectRoot: string, manifest: AsiManifest): MergeResult {
  const config = loadConfig(projectRoot);
  const workflowDir = path.join(projectRoot, config.workflowsDir);
  const workflowFiles = listFiles(workflowDir, (filePath) => filePath.endsWith(".asi.md"));
  const workflowDetails: Record<string, WorkflowDetail> = { ...manifest.workflowDetails };
  const warnings: string[] = [];

  for (const filePath of workflowFiles) {
    const parsed = parseWorkflowFile(filePath);
    const page = Object.values(manifest.pageDetails).find((candidate) =>
      candidate.actions.some(
        (action) => action.id === parsed.trigger || action.intent === parsed.trigger || action.label === parsed.trigger
      )
    );
    if (!page) {
      warnings.push(
        `Workflow '${parsed.id}' (${path.relative(projectRoot, filePath)}): ` +
        `trigger '${parsed.trigger}' not found in any scanned page. ` +
        `Ensure a matching action id, intent, or label exists in the scanned manifest.`
      );
      continue;
    }
    const workflowDetail: WorkflowDetail = {
      id: parsed.id,
      pageId: page.id,
      goal: parsed.goal,
      trigger: parsed.trigger,
      ...(parsed.availableWhen ? { availableWhen: parsed.availableWhen } : {}),
      steps: parsed.steps,
      completion: parsed.completion,
      reporting: createReporting({
        id: parsed.id,
        pageId: page.id,
        goal: parsed.goal,
        trigger: parsed.trigger,
        ...(parsed.availableWhen ? { availableWhen: parsed.availableWhen } : {}),
        steps: parsed.steps,
        completion: parsed.completion,
        reporting: {
          on_success: {},
          on_failure: {}
        },
        metadata: {
          ...parsed.metadata,
          sourceFile: path.relative(projectRoot, parsed.metadata.sourceFile)
        }
      }, page.entity),
      metadata: {
        ...parsed.metadata,
        sourceFile: path.relative(projectRoot, parsed.metadata.sourceFile)
      }
    };
    workflowDetails[workflowDetail.id] = workflowDetail;
    if (!page.workflows.some((workflow) => workflow.id === workflowDetail.id)) {
      page.workflows.push({
        id: workflowDetail.id,
        goal: workflowDetail.goal,
        trigger: workflowDetail.trigger,
        stepsCount: workflowDetail.steps.length,
        source: "authored"
      });
    }
  }

  const compiled: AsiManifest = {
    ...manifest,
    workflowDetails,
    metadata: {
      ...manifest.metadata,
      generatedFrom: "compile",
      scanWarnings: [...manifest.metadata.scanWarnings, ...warnings]
    }
  };
  return { manifest: assertValidManifest(compiled), warnings };
}
