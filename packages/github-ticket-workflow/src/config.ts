import fs from "node:fs";
import path from "node:path";
import type { LoadedConfig, WorkflowConfig } from "./types.js";
import {
  ensureArrayOfStrings,
  ensureBoolean,
  ensureNumber,
  ensureString,
  readJsonFile,
  runCommand,
} from "./utils.js";

function resolveRepoRoot(configPath: string): string {
  const configDir = path.dirname(configPath);
  try {
    return runCommand("git", ["-C", configDir, "rev-parse", "--show-toplevel"]);
  } catch {
    return path.resolve(configDir, "..");
  }
}

export function validateConfig(raw: unknown): WorkflowConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("config must be a JSON object");
  }

  const config = raw as Record<string, unknown> & {
    repo?: Record<string, unknown>;
    git?: Record<string, unknown>;
    ticket?: Record<string, unknown>;
    githubProject?: Record<string, unknown> & { statusOptions?: Record<string, unknown> };
    workflow?: Record<string, unknown>;
    agents?: Record<string, unknown> & {
      providers?: Record<string, unknown> & {
        codex?: Record<string, unknown>;
        claude?: Record<string, unknown>;
      };
    };
  };

  return {
    repo: {
      owner: ensureString(config.repo?.owner, "repo.owner"),
      name: ensureString(config.repo?.name, "repo.name"),
    },
    git: {
      defaultBaseBranch: ensureString(config.git?.defaultBaseBranch, "git.defaultBaseBranch"),
    },
    ticket: {
      branchPrefix: ensureString(config.ticket?.branchPrefix, "ticket.branchPrefix"),
    },
    githubProject: {
      number: ensureNumber(config.githubProject?.number, "githubProject.number"),
      id: ensureString(config.githubProject?.id, "githubProject.id"),
      statusFieldId: ensureString(
        config.githubProject?.statusFieldId,
        "githubProject.statusFieldId",
      ),
      statusOptions: {
        backlog: ensureString(
          config.githubProject?.statusOptions?.backlog,
          "githubProject.statusOptions.backlog",
        ),
        ready: ensureString(
          config.githubProject?.statusOptions?.ready,
          "githubProject.statusOptions.ready",
        ),
        inProgress: ensureString(
          config.githubProject?.statusOptions?.inProgress,
          "githubProject.statusOptions.inProgress",
        ),
        inReview: ensureString(
          config.githubProject?.statusOptions?.inReview,
          "githubProject.statusOptions.inReview",
        ),
        done: ensureString(
          config.githubProject?.statusOptions?.done,
          "githubProject.statusOptions.done",
        ),
      },
    },
    workflow: {
      requireReadyByDefault: ensureBoolean(
        config.workflow?.requireReadyByDefault,
        "workflow.requireReadyByDefault",
      ),
      stateDir: ensureString(config.workflow?.stateDir, "workflow.stateDir"),
      promptContextFiles: ensureArrayOfStrings(
        config.workflow?.promptContextFiles,
        "workflow.promptContextFiles",
      ),
      productInstructions: ensureString(
        config.workflow?.productInstructions,
        "workflow.productInstructions",
      ),
      prePushChecks: ensureArrayOfStrings(
        config.workflow?.prePushChecks ?? [],
        "workflow.prePushChecks",
      ),
    },
    agents: {
      defaultProvider: ensureString(config.agents?.defaultProvider, "agents.defaultProvider") as
        | "codex"
        | "claude",
      providers: {
        codex: {
          bin:
            typeof config.agents?.providers?.codex?.bin === "string"
              ? config.agents.providers.codex.bin
              : undefined,
          flags: ensureOptionalArrayOfStrings(
            config.agents?.providers?.codex?.flags,
            "agents.providers.codex.flags",
          ),
        },
        claude: {
          bin:
            typeof config.agents?.providers?.claude?.bin === "string"
              ? config.agents.providers.claude.bin
              : undefined,
          flags: ensureOptionalArrayOfStrings(
            config.agents?.providers?.claude?.flags,
            "agents.providers.claude.flags",
          ),
        },
      },
    },
  };
}

function ensureOptionalArrayOfStrings(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }

  return ensureArrayOfStrings(value, field);
}

export function loadConfig(configPathArg?: string): LoadedConfig {
  const configPath = path.resolve(
    process.cwd(),
    configPathArg ?? "automation/ticket-workflow.json",
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(`config file not found: ${configPath}`);
  }

  const raw = validateConfig(readJsonFile<unknown>(configPath));
  const repoRoot = resolveRepoRoot(configPath);

  return {
    raw,
    configPath,
    repoRoot,
    repoSlug: `${raw.repo.owner}/${raw.repo.name}`,
    baseBranch: raw.git.defaultBaseBranch,
    branchPrefix: raw.ticket.branchPrefix,
    stateDir: path.resolve(repoRoot, raw.workflow.stateDir),
    promptContextFiles: raw.workflow.promptContextFiles.map((file) => path.resolve(repoRoot, file)),
    productInstructions: raw.workflow.productInstructions,
    prePushChecks: raw.workflow.prePushChecks,
  };
}
