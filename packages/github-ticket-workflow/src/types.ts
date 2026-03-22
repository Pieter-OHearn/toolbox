export type AgentProviderName = "codex" | "claude";

export interface AgentProviderConfig {
  bin?: string;
  flags?: string[];
}

export interface WorkflowConfig {
  repo: {
    owner: string;
    name: string;
  };
  git: {
    defaultBaseBranch: string;
  };
  ticket: {
    branchPrefix: string;
  };
  githubProject: {
    number: number;
    id: string;
    statusFieldId: string;
    statusOptions: {
      backlog: string;
      ready: string;
      inProgress: string;
      inReview: string;
      done: string;
    };
  };
  workflow: {
    requireReadyByDefault: boolean;
    stateDir: string;
    promptContextFiles: string[];
    productInstructions: string;
    prePushChecks: string[];
  };
  agents: {
    defaultProvider: AgentProviderName;
    providers: Record<AgentProviderName, AgentProviderConfig>;
  };
}

export interface LoadedConfig {
  raw: WorkflowConfig;
  configPath: string;
  repoRoot: string;
  repoSlug: string;
  baseBranch: string;
  branchPrefix: string;
  stateDir: string;
  promptContextFiles: string[];
  productInstructions: string;
  prePushChecks: string[];
}

export interface WorkflowState {
  ticketNumber: number;
  branchName: string;
  prUrl?: string;
  prNumber?: number;
  lastCompletedReviewCycle: number;
  lastReviewResult?: "no_findings" | "findings";
  workflowStage?: "implement" | "review" | "fix";
}

export interface ReviewFinding {
  severity: "high" | "medium" | "low";
  file: string;
  problem: string;
  change: string;
}

export interface ReviewResult {
  result: "no_findings" | "findings";
  findings: ReviewFinding[];
}

export interface ProviderCommand {
  bin: string;
  args: string[];
}

export interface ResumePoint {
  action: "review" | "fix" | "done";
  cycle: number;
  lastReviewResult?: "no_findings" | "findings";
}
