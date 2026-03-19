import path from "node:path";
import { AsiConfig } from "../specs/contracts.js";

export const DEFAULT_CONFIG: AsiConfig = {
  framework: "next",
  surface: "web",
  router: "next-app",
  srcDir: "src",
  routesDir: "src/app",
  workflowsDir: "workflows",
  outputFile: "sia-manifest.json",
  cacheDir: ".sia",
  componentDirs: ["src/components/ui"],
  designSystem: {
    buttonComponent: "Button",
    destructiveVariant: "destructive",
    modalComponent: "Dialog"
  },
  overrides: {
    pages: {},
    actions: {}
  }
};

export function getConfigPath(projectRoot: string): string {
  return path.join(projectRoot, "sia.config.json");
}
