import { AsiConfig, AsiFramework } from "../specs/contracts.js";

export interface DiscoveredPage {
  filePath: string;
  route: string;
}

export interface FrameworkAdapter {
  id: AsiFramework;
  discoverPages(projectRoot: string, config: AsiConfig): DiscoveredPage[];
}
