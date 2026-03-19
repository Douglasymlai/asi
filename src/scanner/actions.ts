import ts from "typescript";
import path from "node:path";
import { ActionManifest, AsiConfig, AvailabilityConditions, RiskLevel } from "../specs/contracts.js";
import { clampConfidence, slugify, unique } from "../utils/text.js";

interface CandidateElement {
  tagName: string;
  label: string;
  attributes: Map<string, string>;
}

function nodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile);
}

function getTagName(node: ts.JsxOpeningLikeElement | ts.JsxSelfClosingElement, sourceFile: ts.SourceFile): string {
  return node.tagName.getText(sourceFile);
}

function getAttributeValue(attribute: ts.JsxAttribute, sourceFile: ts.SourceFile): string {
  if (!attribute.initializer) {
    return "true";
  }
  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    const expression = attribute.initializer.expression;
    if (ts.isStringLiteralLike(expression)) {
      return expression.text;
    }
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
      return "true";
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
      return "false";
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements
        .map((element) => (ts.isStringLiteralLike(element) ? element.text : nodeText(element, sourceFile)))
        .join(",");
    }
    return nodeText(expression, sourceFile);
  }
  return nodeText(attribute.initializer, sourceFile);
}

function getAttributes(
  node: ts.JsxAttributes,
  sourceFile: ts.SourceFile
): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const property of node.properties) {
    if (!ts.isJsxAttribute(property)) {
      continue;
    }
    attributes.set(property.name.getText(sourceFile), getAttributeValue(property, sourceFile));
  }
  return attributes;
}

function getChildrenText(children: readonly ts.JsxChild[], sourceFile: ts.SourceFile): string {
  return children
    .map((child) => {
      if (ts.isJsxText(child)) {
        return child.getFullText(sourceFile).trim();
      }
      if (ts.isJsxExpression(child) && child.expression && ts.isStringLiteralLike(child.expression)) {
        return child.expression.text;
      }
      if (ts.isJsxElement(child)) {
        return getChildrenText(child.children, sourceFile);
      }
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferIntentFromHandler(attributes: Map<string, string>): string | undefined {
  const onClick = attributes.get("onClick");
  if (!onClick) return undefined;
  // handle*  or on* handler names: handleRefund => refund, onCancelOrder => cancel_order
  const match = onClick.match(/(?:handle|on)([A-Z][a-zA-Z]*)/);
  if (match?.[1]) {
    return slugify(match[1]);
  }
  return undefined;
}

function inferIntent(label: string, attributes: Map<string, string>): string {
  const explicit = attributes.get("data-action-intent");
  if (explicit) {
    return explicit;
  }
  // Try onClick handler name before falling back to label matching
  const handlerIntent = inferIntentFromHandler(attributes);
  if (handlerIntent) {
    return handlerIntent;
  }
  const lowered = label.toLowerCase();
  if (lowered.includes("refund")) {
    return "refund_order";
  }
  if (lowered.includes("cancel")) {
    return "cancel_order";
  }
  if (lowered.includes("edit shipping")) {
    return "edit_shipping_address";
  }
  if (lowered.includes("archive")) {
    return "archive";
  }
  if (lowered.includes("save")) {
    return "save";
  }
  if (lowered.includes("create")) {
    return "create";
  }
  if (lowered.includes("delete")) {
    return "delete";
  }
  if (lowered.includes("submit")) {
    return "submit";
  }
  if (lowered.includes("approve")) {
    return "approve";
  }
  if (lowered.includes("reject")) {
    return "reject";
  }
  if (lowered.includes("export")) {
    return "export";
  }
  if (lowered.includes("import")) {
    return "import";
  }
  return slugify(label);
}

function inferRisk(
  label: string,
  attributes: Map<string, string>,
  config: AsiConfig
): RiskLevel {
  const explicit = attributes.get("data-risk");
  if (explicit === "low" || explicit === "medium" || explicit === "high") {
    return explicit;
  }
  if (attributes.get("variant") === config.designSystem.destructiveVariant) {
    return "high";
  }
  const lowered = label.toLowerCase();
  if (["refund", "cancel", "delete", "archive"].some((keyword) => lowered.includes(keyword))) {
    return "high";
  }
  if (["save", "create", "update"].some((keyword) => lowered.includes(keyword))) {
    return "medium";
  }
  return "low";
}

function parseAvailability(attributes: Map<string, string>): AvailabilityConditions | undefined {
  const status = attributes.get("data-available-status")?.split(",").map((value) => value.trim()).filter(Boolean);
  const role = attributes.get("data-available-role")?.split(",").map((value) => value.trim()).filter(Boolean);
  if (!status?.length && !role?.length) {
    return undefined;
  }
  return {
    ...(status?.length ? { status } : {}),
    ...(role?.length ? { role } : {})
  };
}

function inferConfidence(attributes: Map<string, string>): number {
  let confidence = 0.45;
  if (attributes.has("data-action-intent")) {
    confidence += 0.25;
  }
  if (attributes.has("data-risk")) {
    confidence += 0.15;
  }
  if (attributes.has("data-available-status") || attributes.has("data-available-role")) {
    confidence += 0.1;
  }
  if (attributes.has("id")) {
    confidence += 0.05;
  }
  return clampConfidence(confidence);
}

function candidateToAction(
  candidate: CandidateElement,
  filePath: string,
  config: AsiConfig
): ActionManifest | null {
  if (!candidate.label) {
    return null;
  }
  const id = candidate.attributes.get("id") ?? slugify(candidate.label);
  const explicitReversible = candidate.attributes.get("data-reversible");
  const risk = inferRisk(candidate.label, candidate.attributes, config);
  const sideEffects = unique(
    candidate.attributes
      .get("data-side-effects")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? (risk === "high" ? ["state_change"] : [])
  );
  const requiresConfirmation =
    candidate.attributes.get("data-requires-confirmation") === "true" || risk === "high";

  return {
    id,
    label: candidate.label,
    intent: inferIntent(candidate.label, candidate.attributes),
    risk,
    requiresConfirmation,
    sideEffects,
    reversible:
      explicitReversible === "true" ? true : explicitReversible === "false" ? false : risk !== "high",
    availableWhen: parseAvailability(candidate.attributes),
    confidence: inferConfidence(candidate.attributes),
    source: {
      file: filePath,
      component: candidate.tagName
    }
  };
}

function collectCandidates(sourceFile: ts.SourceFile, config: AsiConfig): CandidateElement[] {
  const candidates: CandidateElement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      const tagName = getTagName(node.openingElement, sourceFile);
      const label = getChildrenText(node.children, sourceFile) || getAttributes(node.openingElement.attributes, sourceFile).get("aria-label") || "";
      candidates.push({
        tagName,
        label,
        attributes: getAttributes(node.openingElement.attributes, sourceFile)
      });
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const attributes = getAttributes(node.attributes, sourceFile);
      candidates.push({
        tagName: getTagName(node, sourceFile),
        label: attributes.get("aria-label") ?? attributes.get("label") ?? "",
        attributes
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const interactiveTags = new Set([
    "button", "Button", "IconButton",
    "Link", "a",
    config.designSystem.buttonComponent
  ]);
  // Also include input[type="submit"] self-closing elements
  return candidates.filter((candidate) => {
    if (interactiveTags.has(candidate.tagName)) return true;
    if (candidate.tagName === "input" && candidate.attributes.get("type") === "submit") return true;
    // form elements with an onSubmit handler
    if (candidate.tagName === "form" && candidate.attributes.has("onSubmit")) return true;
    return false;
  });
}

export function extractActions(
  source: string,
  filePath: string,
  projectRoot: string,
  config: AsiConfig
): ActionManifest[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const actions = collectCandidates(sourceFile, config)
    .map((candidate) => candidateToAction(candidate, path.relative(projectRoot, filePath), config))
    .filter((action): action is ActionManifest => action !== null);

  const uniqueActions = new Map<string, ActionManifest>();
  for (const action of actions) {
    if (!uniqueActions.has(action.id)) {
      uniqueActions.set(action.id, action);
    }
  }
  return [...uniqueActions.values()];
}
