import ts from "typescript";
import { unique } from "../utils/text.js";

/**
 * AST-based data-fetching hook analysis.
 * Detects patterns like:
 *   - useQuery({ queryKey: [...], queryFn: () => fetch("/api/orders") })
 *   - useSWR("/api/orders", fetcher)
 *   - const data = await fetch("/api/orders")
 *   - getServerSideProps / getStaticProps
 *   - server component: async function Page() { await fetch(...) }
 */

export interface DataFetchInfo {
  hookName: string;
  apiEndpoint?: string;
  returnFields: string[];
}

function extractFetchUrl(node: ts.CallExpression, sourceFile: ts.SourceFile): string | undefined {
  if (node.arguments.length === 0) return undefined;
  const firstArg = node.arguments[0]!;

  // fetch("/api/orders")
  if (ts.isStringLiteral(firstArg)) {
    return firstArg.text;
  }

  // fetch(`/api/orders/${id}`)
  if (ts.isTemplateExpression(firstArg)) {
    return firstArg.head.text + firstArg.templateSpans.map((span) => `*${span.literal.text}`).join("");
  }

  if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    return firstArg.text;
  }

  return undefined;
}

export function analyzeDataFetching(source: string, filePath: string): DataFetchInfo[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fetches: DataFetchInfo[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // fetch(...) calls
      if (ts.isIdentifier(callee) && callee.text === "fetch") {
        const url = extractFetchUrl(node, sourceFile);
        fetches.push({
          hookName: "fetch",
          apiEndpoint: url,
          returnFields: []
        });
      }

      // useQuery(...) — React Query / TanStack Query
      if (ts.isIdentifier(callee) && callee.text === "useQuery") {
        let endpoint: string | undefined;
        if (node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0]!)) {
          const config = node.arguments[0]!;
          for (const prop of config.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === "queryFn") {
              // Look for fetch call inside queryFn
              const fnVisit = (n: ts.Node): void => {
                if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "fetch") {
                  endpoint = extractFetchUrl(n, sourceFile);
                }
                ts.forEachChild(n, fnVisit);
              };
              fnVisit(prop.initializer);
            }
          }
        }
        fetches.push({ hookName: "useQuery", apiEndpoint: endpoint, returnFields: [] });
      }

      // useSWR("/api/...", fetcher)
      if (ts.isIdentifier(callee) && callee.text === "useSWR") {
        const url = node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0]!)
          ? node.arguments[0]!.text
          : undefined;
        fetches.push({ hookName: "useSWR", apiEndpoint: url as string | undefined, returnFields: [] });
      }

      // Custom fetch wrappers: getOrder(id), fetchProducts(), etc.
      if (ts.isIdentifier(callee) && /^(get|fetch|load|retrieve)[A-Z]/.test(callee.text)) {
        fetches.push({ hookName: callee.text, returnFields: [] });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return fetches;
}

export function inferDataSourceFromHooks(fetches: DataFetchInfo[]): "api" | "static" | "unknown" {
  if (fetches.length > 0) return "api";
  return "unknown";
}

export function extractApiEndpoints(fetches: DataFetchInfo[]): string[] {
  return unique(
    fetches
      .map((f) => f.apiEndpoint)
      .filter((url): url is string => url !== undefined)
  );
}
