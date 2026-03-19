import { AsiManifest } from "../specs/contracts.js";

export interface ManifestDiff {
  lines: string[];
  breaking: boolean;
}

export function diffManifests(left: AsiManifest, right: AsiManifest): ManifestDiff {
  const lines: string[] = [];
  let breaking = false;

  // --- Pages ---
  const leftPages = new Set(left.pages.map((page) => page.id));
  const rightPages = new Set(right.pages.map((page) => page.id));
  for (const pageId of rightPages) {
    if (!leftPages.has(pageId)) {
      lines.push(`+ pages/${pageId}: added`);
    }
  }
  for (const pageId of leftPages) {
    if (!rightPages.has(pageId)) {
      lines.push(`- pages/${pageId}: removed`);
      breaking = true;
    }
  }

  for (const pageId of [...leftPages].filter((page) => rightPages.has(page))) {
    const leftPage = left.pageDetails[pageId];
    const rightPage = right.pageDetails[pageId];
    if (JSON.stringify(leftPage.dynamicContent) !== JSON.stringify(rightPage.dynamicContent)) {
      lines.push(`! pages/${pageId}: dynamicContent changed`);
    }

    const leftActions = new Set(leftPage.actions.map((action) => action.id));
    const rightActions = new Set(rightPage.actions.map((action) => action.id));
    for (const actionId of rightActions) {
      if (!leftActions.has(actionId)) {
        const action = rightPage.actions.find((item) => item.id === actionId);
        lines.push(`+ pages/${pageId}: added action "${action?.id}" (confidence: ${action?.confidence ?? "n/a"})`);
      }
    }
    for (const actionId of leftActions) {
      if (!rightActions.has(actionId)) {
        lines.push(`- pages/${pageId}: removed action "${actionId}"`);
        breaking = true;
      }
    }
  }

  // --- Workflows ---
  const leftWorkflows = new Set(Object.keys(left.workflowDetails));
  const rightWorkflows = new Set(Object.keys(right.workflowDetails));
  for (const workflowId of rightWorkflows) {
    if (!leftWorkflows.has(workflowId)) {
      lines.push(`+ workflows/${workflowId}: added`);
    }
  }
  for (const workflowId of leftWorkflows) {
    if (!rightWorkflows.has(workflowId)) {
      lines.push(`- workflows/${workflowId}: removed`);
      breaking = true;
    }
  }
  for (const workflowId of [...leftWorkflows].filter((workflow) => rightWorkflows.has(workflow))) {
    const leftWorkflow = left.workflowDetails[workflowId];
    const rightWorkflow = right.workflowDetails[workflowId];
    if (JSON.stringify(leftWorkflow.steps) !== JSON.stringify(rightWorkflow.steps)) {
      lines.push(`~ workflows/${workflowId}: steps changed`);
    }
  }

  // --- Components ---
  const leftComponents = new Map((left.components ?? []).map((c) => [c.id, c]));
  const rightComponents = new Map((right.components ?? []).map((c) => [c.id, c]));

  for (const [id] of rightComponents) {
    if (!leftComponents.has(id)) {
      const comp = rightComponents.get(id)!;
      lines.push(`+ components/${id}: added (role: ${comp.semanticRole})`);
    }
  }
  for (const [id] of leftComponents) {
    if (!rightComponents.has(id)) {
      lines.push(`- components/${id}: removed`);
    }
  }
  for (const [id, leftComp] of leftComponents) {
    const rightComp = rightComponents.get(id);
    if (!rightComp) continue;

    if (leftComp.semanticRole !== rightComp.semanticRole) {
      lines.push(`~ components/${id}: semanticRole changed "${leftComp.semanticRole}" -> "${rightComp.semanticRole}"`);
    }
    if (JSON.stringify(leftComp.variants) !== JSON.stringify(rightComp.variants)) {
      lines.push(`~ components/${id}: variants changed`);
    }
    if (leftComp.risk !== rightComp.risk) {
      lines.push(`~ components/${id}: risk changed "${leftComp.risk ?? "none"}" -> "${rightComp.risk ?? "none"}"`);
    }
    if (leftComp.requiresConfirmation !== rightComp.requiresConfirmation) {
      lines.push(`! components/${id}: requiresConfirmation changed`);
    }
    if (JSON.stringify(leftComp.states) !== JSON.stringify(rightComp.states)) {
      lines.push(`~ components/${id}: states changed`);
    }
    if (JSON.stringify(leftComp.importantProps) !== JSON.stringify(rightComp.importantProps)) {
      lines.push(`~ components/${id}: importantProps changed`);
    }
  }

  if (lines.length === 0) {
    lines.push("No manifest changes detected.");
  }

  return { lines, breaking };
}
