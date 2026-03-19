export const SIA_VERSION = "1.0" as const;
export const REPORT_VERSION = "1.0" as const;

export type RiskLevel = "low" | "medium" | "high";
export type PageType = "list" | "detail" | "form" | "dashboard" | "settings" | "auth";
export type AsiFramework = "next" | "react";
export type AsiSurface = "web" | "desktop" | "mobile";
export type AsiRouter = "next-app" | "react-router" | "manual";

export interface AppInfo {
  name: string;
  framework: string;
  domain: string;
  generatedAt: string;
}

export interface AvailabilityConditions {
  status?: string[];
  role?: string[];
}

export interface ActionManifest {
  id: string;
  label: string;
  intent: string;
  risk: RiskLevel;
  requiresConfirmation: boolean;
  sideEffects: string[];
  reversible: boolean;
  availableWhen?: AvailabilityConditions;
  confidence: number;
  source: {
    file: string;
    component: string;
  };
}

export interface DynamicContent {
  dataSource: "api" | "static" | "unknown";
  entityFields: string[];
  stateDependent: boolean;
  possibleStates?: string[];
  roleDependent?: boolean;
  roles?: string[];
  conditionalActions?: Record<string, AvailabilityConditions>;
  notes?: string[];
}

export interface WorkflowSummary {
  id: string;
  goal: string;
  trigger: string;
  stepsCount: number;
  source: "authored";
}

export interface PageSummary {
  id: string;
  route: string;
  type: PageType;
  purpose: string;
  entity?: string;
  dynamic?: boolean;
}

export interface PageDetail extends PageSummary {
  sourceFile: string;
  confidence: number;
  actions: ActionManifest[];
  workflows: WorkflowSummary[];
  dynamicContent?: DynamicContent;
}

export interface WorkflowStep {
  id: string;
  action: "click" | "input" | "select" | "assert";
  target: string;
  description: string;
  inputType?: string;
  required?: boolean;
  next: string | null;
  optional_next?: string[];
}

export interface WorkflowCompletion {
  signal: string;
  message_contains?: string;
  redirects_to?: string;
  expectedStateChange?: Record<string, string>;
}

export interface WorkflowReporting {
  on_success: Record<string, string | boolean>;
  on_failure: Record<string, string | boolean>;
}

export interface WorkflowDetail {
  id: string;
  pageId: string;
  goal: string;
  trigger: string;
  availableWhen?: AvailabilityConditions;
  steps: WorkflowStep[];
  completion: WorkflowCompletion;
  reporting: WorkflowReporting;
  metadata: {
    risk: RiskLevel;
    sideEffects: string[];
    reversible: boolean;
    sourceFile: string;
  };
}

export interface ManifestMetadata {
  generatedFrom: string;
  scanWarnings: string[];
}

export interface ComponentVariantManifest {
  name: string;
  values: string[];
}

export interface ComponentManifest {
  id: string;
  name: string;
  semanticRole: string;
  variants?: ComponentVariantManifest[];
  states?: string[];
  importantProps?: string[];
  risk?: RiskLevel;
  requiresConfirmation?: boolean;
  intents?: string[];
  confidence: number;
  source: {
    file?: string;
    package?: string;
    exportName?: string;
  };
}

export interface SiaManifest {
  sia: typeof SIA_VERSION;
  app: AppInfo;
  pages: PageSummary[];
  pageDetails: Record<string, PageDetail>;
  workflowDetails: Record<string, WorkflowDetail>;
  components?: ComponentManifest[];
  metadata: ManifestMetadata;
}

export interface AsiConfig {
  framework: AsiFramework;
  surface: AsiSurface;
  router?: AsiRouter;
  srcDir: string;
  routesDir: string;
  workflowsDir: string;
  outputFile: string;
  cacheDir: string;
  componentDirs?: string[];
  routerConfigFile?: string;
  designSystem: {
    buttonComponent: string;
    destructiveVariant: string;
    modalComponent: string;
  };
  app?: {
    name?: string;
    domain?: string;
  };
  overrides: {
    pages?: Record<string, Partial<Pick<PageDetail, "purpose" | "entity" | "type">>>;
    actions?: Record<string, Partial<Pick<ActionManifest, "risk" | "requiresConfirmation" | "intent" | "reversible">>>;
  };
}

export interface BenchmarkTask {
  id: string;
  goal: string;
  page: string;
  role: string;
  seedState: string;
  expectedWorkflow?: string;
  expectedOutcome: "success" | "blocked" | "failure";
  expectedFailureReason?: string;
}

export interface AgentRunResult {
  taskId: string;
  condition: "baseline" | "pages_only" | "pages_workflows" | "full_manifest";
  status: "completed" | "failed" | "blocked";
  stepsCompleted: string[];
  wrongActions: number;
  riskyErrors: number;
  actionCount: number;
  durationMs: number;
  completionVerified: boolean;
}

export interface AgentReport {
  sia_report: typeof REPORT_VERSION;
  timestamp: string;
  agent: string;
  app: string;
  workflow: string;
  status: "completed" | "failed";
  steps_completed: string[];
  steps_skipped?: string[];
  failed_at_step?: string;
  failure_reason?: string;
  duration_ms: number;
  entity: {
    type: string;
    id: string;
    stateTransition?: string;
  };
  completion_verified: boolean;
  notes?: string | null;
}
