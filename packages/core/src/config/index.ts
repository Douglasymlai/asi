import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, getConfigPath } from "./defaults.js";
import { AsiConfig } from "../specs/contracts.js";
import { ensureDir, writeJsonFile } from "../utils/fs.js";

export function createDefaultConfig(projectRoot: string, overrides: Partial<AsiConfig> = {}): string {
  const configPath = getConfigPath(projectRoot);
  const nextConfig: AsiConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    designSystem: {
      ...DEFAULT_CONFIG.designSystem,
      ...overrides.designSystem
    },
    overrides: {
      pages: {
        ...DEFAULT_CONFIG.overrides.pages,
        ...overrides.overrides?.pages
      },
      actions: {
        ...DEFAULT_CONFIG.overrides.actions,
        ...overrides.overrides?.actions
      }
    }
  };
  if (!fs.existsSync(configPath)) {
    writeJsonFile(configPath, nextConfig);
  }
  ensureDir(path.join(projectRoot, nextConfig.cacheDir));
  return configPath;
}

export function loadConfig(projectRoot: string): AsiConfig {
  const configPath = getConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    createDefaultConfig(projectRoot);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<AsiConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    app: {
      ...DEFAULT_CONFIG.app,
      ...raw.app
    },
    designSystem: {
      ...DEFAULT_CONFIG.designSystem,
      ...raw.designSystem
    },
    overrides: {
      pages: {
        ...DEFAULT_CONFIG.overrides.pages,
        ...raw.overrides?.pages
      },
      actions: {
        ...DEFAULT_CONFIG.overrides.actions,
        ...raw.overrides?.actions
      }
    }
  };
}
