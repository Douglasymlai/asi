import ts from "typescript";
import { unique } from "../utils/text.js";

/**
 * AST-based TypeScript type/interface analysis.
 * Extracts entity field names from:
 *   - interface Order { id: string; status: string; ... }
 *   - type Order = { id: string; status: string; ... }
 *   - Inline type annotations on API response variables
 *   - Destructured fields from hook returns: const { id, status } = order;
 */

export interface EntityTypeInfo {
  typeName: string;
  fields: string[];
}

function extractFieldsFromTypeLiteral(typeNode: ts.TypeLiteralNode, sourceFile: ts.SourceFile): string[] {
  return typeNode.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText(sourceFile))
    .filter(Boolean);
}

export function extractEntityTypes(source: string, filePath: string): EntityTypeInfo[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const types: EntityTypeInfo[] = [];

  const visit = (node: ts.Node): void => {
    // interface Order { ... }
    if (ts.isInterfaceDeclaration(node)) {
      const fields = node.members
        .filter(ts.isPropertySignature)
        .map((member) => member.name.getText(sourceFile))
        .filter(Boolean);
      if (fields.length > 0) {
        types.push({ typeName: node.name.text, fields });
      }
    }

    // type Order = { ... }
    if (ts.isTypeAliasDeclaration(node) && node.type && ts.isTypeLiteralNode(node.type)) {
      const fields = extractFieldsFromTypeLiteral(node.type, sourceFile);
      if (fields.length > 0) {
        types.push({ typeName: node.name.text, fields });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return types;
}

export function extractDestructuredFields(source: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fields: string[] = [];

  const visit = (node: ts.Node): void => {
    // const { id, status, total } = order;
    // const { id, status, total } = await getOrder(id);
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          fields.push(element.name.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return unique(fields);
}

export function extractEnumLikeValues(source: string, filePath: string): Map<string, string[]> {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const enumValues = new Map<string, string[]>();

  const visit = (node: ts.Node): void => {
    // const ORDER_STATES = ["pending", "confirmed", ...] or const statuses = [...]
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      const values = node.initializer.elements
        .map((el) => ts.isStringLiteral(el) ? el.text : undefined)
        .filter((v): v is string => v !== undefined);
      if (values.length > 0) {
        enumValues.set(node.name.text, values);
      }
    }

    // enum OrderStatus { Pending = "pending", ... }
    if (ts.isEnumDeclaration(node)) {
      const values = node.members
        .map((member) => {
          if (member.initializer && ts.isStringLiteral(member.initializer)) {
            return member.initializer.text;
          }
          return member.name.getText(sourceFile);
        })
        .filter(Boolean);
      if (values.length > 0) {
        enumValues.set(node.name.text, values);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return enumValues;
}

export function guessEntityFieldsFromTypes(
  types: EntityTypeInfo[],
  entity: string | undefined
): string[] {
  if (!entity) return [];
  const entityLower = entity.toLowerCase();
  const matching = types.find(
    (t) => t.typeName.toLowerCase() === entityLower || t.typeName.toLowerCase() === `${entityLower}type`
  );
  return matching?.fields ?? [];
}
