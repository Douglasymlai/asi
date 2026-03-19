import { loadConfig } from "../config/index.js";
import { AsiConfig } from "../specs/contracts.js";
import { assertValidConfig } from "../specs/validation.js";
import { getScanCachePath, scanAndWriteWithAdapter, scanProjectWithAdapter } from "../../packages/core/src/scanner/index.js";
import { nextFrameworkAdapter } from "../../packages/framework-next/src/index.js";
import { reactFrameworkAdapter } from "../../packages/framework-react/src/index.js";

function resolveFrameworkAdapter(config: AsiConfig) {
  switch (config.framework) {
    case "next":
      return nextFrameworkAdapter;
    case "react":
      return reactFrameworkAdapter;
    default:
      throw new Error(`Unsupported SIA framework '${config.framework}'`);
  }
}

export { getScanCachePath };

export function scanProject(projectRoot: string) {
  const config = assertValidConfig(loadConfig(projectRoot));
  return scanProjectWithAdapter(projectRoot, config, resolveFrameworkAdapter(config));
}

export function scanAndWrite(projectRoot: string) {
  const config = assertValidConfig(loadConfig(projectRoot));
  return scanAndWriteWithAdapter(projectRoot, config, resolveFrameworkAdapter(config));
}
