import { ActionManifest, DynamicContent } from "../specs/contracts.js";
import { unique } from "../utils/text.js";
import { analyzeConditionalRendering, extractPossibleStatesFromConditionals, extractRolesFromConditionals } from "./conditionals.js";
import { analyzeDataFetching, inferDataSourceFromHooks } from "./hooks.js";
import { extractEntityTypes, extractDestructuredFields, extractEnumLikeValues, guessEntityFieldsFromTypes } from "./types.js";

function parseCsvList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseArrayLiteral(value: string): string[] {
  return unique(
    [...value.matchAll(/["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter(Boolean)
  );
}

function extractCsvMarker(source: string, name: string): string[] {
  const matches: string[] = [];
  const literalPattern = new RegExp(`${name}=["']([^"']+)["']`, "g");
  for (const match of source.matchAll(literalPattern)) {
    matches.push(...parseCsvList(match[1]));
  }

  const arrayPattern = new RegExp(`${name}=\\{([A-Z0-9_]+|\\[[^}]+\\])\\}`, "g");
  for (const match of source.matchAll(arrayPattern)) {
    const expression = match[1];
    if (expression.startsWith("[")) {
      matches.push(...parseArrayLiteral(expression));
      continue;
    }
    const constantPattern = new RegExp(`const\\s+${expression}\\s*=\\s*\\[([^\\]]+)\\]`);
    const constantMatch = source.match(constantPattern);
    if (constantMatch?.[1]) {
      matches.push(...parseArrayLiteral(constantMatch[1]));
    }
  }
  return unique(matches);
}

export function inferDynamicContent(
  source: string,
  route: string,
  actions: ActionManifest[],
  entity?: string,
  filePath?: string
): DynamicContent | undefined {
  const file = filePath ?? "page.tsx";

  // Data-attribute based extraction (existing)
  const markerEntityFields = extractCsvMarker(source, "data-entity-fields");
  const markerStates = extractCsvMarker(source, "data-state-options");
  const markerRoles = extractCsvMarker(source, "data-role-options");

  // AST-based hook analysis
  const fetches = analyzeDataFetching(source, file);
  const dataSource = fetches.length > 0 ? inferDataSourceFromHooks(fetches) : (
    source.includes("fetch(") || source.includes("useQuery(") || source.includes("useSWR(") ? "api" as const :
    source.includes("const ") || source.includes("export const") ? "static" as const : "unknown" as const
  );

  // AST-based conditional analysis
  const conditionalBlocks = analyzeConditionalRendering(source, file);
  const conditionalStates = extractPossibleStatesFromConditionals(conditionalBlocks);
  const conditionalRoles = extractRolesFromConditionals(conditionalBlocks);

  // AST-based type analysis
  const entityTypes = extractEntityTypes(source, file);
  const destructuredFields = extractDestructuredFields(source, file);
  const enumValues = extractEnumLikeValues(source, file);

  // Merge entity fields: data-attributes > type inference > destructured fields
  const typeInferredFields = guessEntityFieldsFromTypes(entityTypes, entity);
  const entityFields = unique([...markerEntityFields, ...typeInferredFields, ...destructuredFields].filter(Boolean));

  // Merge possible states: data-attributes > conditional analysis > enum values
  const possibleStates = unique([...markerStates, ...conditionalStates]);
  if (possibleStates.length === 0) {
    // Fall back to enum-like constant arrays that look like status values
    const enumStates = [...enumValues.values()].flat().filter((v) =>
      /^[a-z_]+$/.test(v) && !["true", "false"].includes(v)
    );
    if (enumStates.length >= 2) {
      possibleStates.push(...enumStates);
    }
  }

  // Merge roles
  const roles = unique([...markerRoles, ...conditionalRoles]);

  // Build conditional actions map
  const conditionalActions = Object.fromEntries(
    actions
      .filter((action) => action.availableWhen)
      .map((action) => [action.id, action.availableWhen as NonNullable<ActionManifest["availableWhen"]>])
  );

  const stateDependent = possibleStates.length > 0 || Object.values(conditionalActions).some((item) => item.status?.length);
  const roleDependent = roles.length > 0 || Object.values(conditionalActions).some((item) => item.role?.length);
  const isDynamic = route.includes(":") || fetches.length > 0 || source.includes("fetch(") || stateDependent || roleDependent;
  if (!isDynamic) {
    return undefined;
  }

  const dynamicContent: DynamicContent = {
    dataSource,
    entityFields,
    stateDependent
  };
  if (possibleStates.length > 0) {
    dynamicContent.possibleStates = possibleStates;
  }
  if (roleDependent) {
    dynamicContent.roleDependent = roleDependent;
  }
  if (roles.length > 0) {
    dynamicContent.roles = roles;
  }
  if (Object.keys(conditionalActions).length > 0) {
    dynamicContent.conditionalActions = conditionalActions;
  }
  if (dynamicContent.entityFields.length === 0) {
    dynamicContent.notes = ["entity_fields_unknown"];
  }
  return dynamicContent;
}
