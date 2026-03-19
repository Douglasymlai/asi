import ts from "typescript";
import { AvailabilityConditions } from "../specs/contracts.js";
import { unique } from "../utils/text.js";

/**
 * AST-based conditional rendering analysis.
 * Detects patterns like:
 *   - {status === "shipped" && <Button>...</Button>}
 *   - {["confirmed", "shipped"].includes(status) && <Button>...</Button>}
 *   - {role === "admin" && <Button>...</Button>}
 *   - {role !== "viewer" && <Button>...</Button>}
 *   - {isAdmin && <Button>...</Button>}
 *   - {condition ? <ComponentA/> : <ComponentB/>}
 */

interface ConditionalGuard {
  field: string;
  values: string[];
  negated: boolean;
}

interface ConditionalBlock {
  guards: ConditionalGuard[];
  elementIds: string[];
  elementLabels: string[];
}

function isStatusLikeIdentifier(name: string): boolean {
  return ["status", "state", "orderStatus", "ticketStatus", "phase"].includes(name);
}

function isRoleLikeIdentifier(name: string): boolean {
  return ["role", "userRole", "viewerRole", "currentRole", "isAdmin", "isSupport"].includes(name);
}

function classifyField(name: string): "status" | "role" | "unknown" {
  if (isStatusLikeIdentifier(name)) return "status";
  if (isRoleLikeIdentifier(name)) return "role";
  return "unknown";
}

function extractStringLiteral(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function extractArrayLiteralStrings(node: ts.Expression): string[] {
  if (!ts.isArrayLiteralExpression(node)) return [];
  return node.elements
    .map((element) => extractStringLiteral(element as ts.Expression))
    .filter((value): value is string => value !== undefined);
}

function extractGuardFromBinary(node: ts.BinaryExpression, sourceFile: ts.SourceFile): ConditionalGuard | undefined {
  const { left, right, operatorToken } = node;

  // status === "value" or status !== "value"
  if (
    (operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
  ) {
    const negated =
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;

    let identifierName: string | undefined;
    let literalValue: string | undefined;

    if (ts.isIdentifier(left)) {
      identifierName = left.text;
      literalValue = extractStringLiteral(right);
    } else if (ts.isPropertyAccessExpression(left)) {
      identifierName = left.name.text;
      literalValue = extractStringLiteral(right);
    } else if (ts.isIdentifier(right)) {
      identifierName = right.text;
      literalValue = extractStringLiteral(left);
    }

    if (identifierName && literalValue) {
      return { field: identifierName, values: [literalValue], negated };
    }
  }

  return undefined;
}

function extractGuardFromCallExpression(node: ts.CallExpression, sourceFile: ts.SourceFile): ConditionalGuard | undefined {
  // ["a", "b"].includes(status) pattern
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "includes" &&
    node.arguments.length === 1
  ) {
    const arrayValues = extractArrayLiteralStrings(node.expression.expression);
    const arg = node.arguments[0]!;
    let identifierName: string | undefined;
    if (ts.isIdentifier(arg)) {
      identifierName = arg.text;
    } else if (ts.isPropertyAccessExpression(arg)) {
      identifierName = arg.name.text;
    }
    if (identifierName && arrayValues.length > 0) {
      return { field: identifierName, values: arrayValues, negated: false };
    }
  }
  return undefined;
}

function extractGuard(condition: ts.Expression, sourceFile: ts.SourceFile): ConditionalGuard | undefined {
  // Handle negation prefix: !condition
  if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = extractGuard(condition.operand, sourceFile);
    if (inner) {
      return { ...inner, negated: !inner.negated };
    }
    return undefined;
  }

  if (ts.isBinaryExpression(condition)) {
    return extractGuardFromBinary(condition, sourceFile);
  }

  if (ts.isCallExpression(condition)) {
    return extractGuardFromCallExpression(condition, sourceFile);
  }

  // Boolean identifier: isAdmin => role guard
  if (ts.isIdentifier(condition)) {
    const name = condition.text;
    if (name.startsWith("is")) {
      const roleName = name.slice(2).toLowerCase();
      return { field: name, values: [roleName], negated: false };
    }
  }

  return undefined;
}

function extractGuards(condition: ts.Expression, sourceFile: ts.SourceFile): ConditionalGuard[] {
  // Handle && chains: guard1 && guard2 && <JSX>
  if (ts.isBinaryExpression(condition) && condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const leftGuards = extractGuards(condition.left, sourceFile);
    const rightGuard = extractGuard(condition.right, sourceFile);
    if (rightGuard) leftGuards.push(rightGuard);
    return leftGuards;
  }

  const single = extractGuard(condition, sourceFile);
  return single ? [single] : [];
}

function extractElementIdsFromJsx(node: ts.Node, sourceFile: ts.SourceFile): { ids: string[]; labels: string[] } {
  const ids: string[] = [];
  const labels: string[] = [];

  const visit = (child: ts.Node): void => {
    if (ts.isJsxElement(child)) {
      const attrs = child.openingElement.attributes;
      for (const prop of attrs.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === "id" && prop.initializer) {
          if (ts.isStringLiteral(prop.initializer)) {
            ids.push(prop.initializer.text);
          } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression && ts.isStringLiteral(prop.initializer.expression)) {
            ids.push(prop.initializer.expression.text);
          }
        }
      }
      // Extract text label from children
      const text = child.children
        .filter(ts.isJsxText)
        .map((t) => t.getFullText(sourceFile).trim())
        .join(" ")
        .trim();
      if (text) labels.push(text);
    }
    if (ts.isJsxSelfClosingElement(child)) {
      for (const prop of child.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === "id" && prop.initializer) {
          if (ts.isStringLiteral(prop.initializer)) {
            ids.push(prop.initializer.text);
          }
        }
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return { ids, labels };
}

export function analyzeConditionalRendering(source: string, filePath: string): ConditionalBlock[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const blocks: ConditionalBlock[] = [];

  const visit = (node: ts.Node): void => {
    // {condition && <JSX>}
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)) {
      const expr = node.expression;
      if (expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const guards = extractGuards(expr.left, sourceFile);
        const leftGuard = extractGuard(expr.left, sourceFile);
        if (leftGuard && !guards.includes(leftGuard)) guards.push(leftGuard);
        if (guards.length > 0) {
          const { ids, labels } = extractElementIdsFromJsx(expr.right, sourceFile);
          if (ids.length > 0 || labels.length > 0) {
            blocks.push({ guards, elementIds: ids, elementLabels: labels });
          }
        }
      }
    }

    // {condition ? <A> : <B>}
    if (ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression)) {
      const cond = node.expression;
      const guard = extractGuard(cond.condition, sourceFile);
      if (guard) {
        const whenTrue = extractElementIdsFromJsx(cond.whenTrue, sourceFile);
        const whenFalse = extractElementIdsFromJsx(cond.whenFalse, sourceFile);
        if (whenTrue.ids.length > 0 || whenTrue.labels.length > 0) {
          blocks.push({ guards: [guard], elementIds: whenTrue.ids, elementLabels: whenTrue.labels });
        }
        if (whenFalse.ids.length > 0 || whenFalse.labels.length > 0) {
          blocks.push({ guards: [{ ...guard, negated: !guard.negated }], elementIds: whenFalse.ids, elementLabels: whenFalse.labels });
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return blocks;
}

export function deriveAvailabilityFromConditionals(
  conditionalBlocks: ConditionalBlock[],
  actionId: string,
  actionLabel: string
): AvailabilityConditions | undefined {
  const matchingBlocks = conditionalBlocks.filter(
    (block) => block.elementIds.includes(actionId) || block.elementLabels.some((label) => label === actionLabel)
  );

  if (matchingBlocks.length === 0) return undefined;

  const statusValues: string[] = [];
  const roleValues: string[] = [];

  for (const block of matchingBlocks) {
    for (const guard of block.guards) {
      const fieldClass = classifyField(guard.field);
      if (fieldClass === "status" && !guard.negated) {
        statusValues.push(...guard.values);
      } else if (fieldClass === "role" && !guard.negated) {
        roleValues.push(...guard.values);
      }
    }
  }

  const result: AvailabilityConditions = {};
  if (statusValues.length > 0) result.status = unique(statusValues);
  if (roleValues.length > 0) result.role = unique(roleValues);
  return Object.keys(result).length > 0 ? result : undefined;
}

export function extractPossibleStatesFromConditionals(blocks: ConditionalBlock[]): string[] {
  const states: string[] = [];
  for (const block of blocks) {
    for (const guard of block.guards) {
      if (classifyField(guard.field) === "status") {
        states.push(...guard.values);
      }
    }
  }
  return unique(states);
}

export function extractRolesFromConditionals(blocks: ConditionalBlock[]): string[] {
  const roles: string[] = [];
  for (const block of blocks) {
    for (const guard of block.guards) {
      if (classifyField(guard.field) === "role") {
        roles.push(...guard.values);
      }
    }
  }
  return unique(roles);
}
