import path from "node:path";

export function routeFromPageFile(filePath: string, routesDir: string): string {
  const relative = path.relative(routesDir, filePath).replace(/\\/g, "/");
  const withoutPage = relative.replace(/(^|\/)page\.(tsx|ts|jsx|js)$/, "");
  if (withoutPage === "") {
    return "/";
  }
  const segments = withoutPage
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamicMatch = segment.match(/^\[(.+)\]$/);
      if (dynamicMatch) {
        return `:${dynamicMatch[1]}`;
      }
      return segment;
    });
  return `/${segments.join("/")}`;
}
