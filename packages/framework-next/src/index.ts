import path from "node:path";
import { FrameworkAdapter } from "../../core/src/framework/contracts.js";
import { AsiConfig } from "../../core/src/specs/contracts.js";
import { listFiles } from "../../core/src/utils/fs.js";
import { routeFromNextPageFile } from "./routes.js";

export const nextFrameworkAdapter: FrameworkAdapter = {
  id: "next",
  discoverPages(projectRoot: string, config: AsiConfig) {
    const routesDir = path.join(projectRoot, config.routesDir);
    const pageFiles = listFiles(routesDir, (filePath) => /\/page\.(tsx|ts|jsx|js)$/.test(filePath));
    return pageFiles.map((filePath) => ({
      filePath,
      route: routeFromNextPageFile(filePath, routesDir)
    }));
  }
};
