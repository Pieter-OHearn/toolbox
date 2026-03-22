import type { LoadedConfig } from "./types.js";
import { relativeToRepoRoot, runCommand } from "./utils.js";

export function changedFilesAgainstBase(config: LoadedConfig): string[] {
  const output = runCommand("git", ["diff", "--name-only", `${config.baseBranch}...HEAD`], {
    cwd: config.repoRoot,
  });

  return output.length === 0 ? [] : output.split("\n").filter(Boolean);
}

export function requireCleanTree(config: LoadedConfig): void {
  const statePath = relativeToRepoRoot(config.repoRoot, config.stateDir);
  const output = runCommand(
    "git",
    ["status", "--short", "--untracked-files=all", `:(exclude)${statePath}/`, ":(exclude).codex/"],
    { cwd: config.repoRoot },
  );

  if (output.length > 0) {
    throw new Error("working tree is not clean; commit or stash changes first");
  }
}

export function currentBranch(config: LoadedConfig): string {
  return runCommand("git", ["branch", "--show-current"], { cwd: config.repoRoot });
}

export function ensureOnBranch(config: LoadedConfig, branch: string): void {
  if (currentBranch(config) !== branch) {
    runCommand("git", ["checkout", branch], { cwd: config.repoRoot });
  }
}

export function localBranchExists(config: LoadedConfig, branch: string): boolean {
  try {
    runCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: config.repoRoot,
    });
    return true;
  } catch {
    return false;
  }
}

export function remoteBranchExists(config: LoadedConfig, branch: string): boolean {
  try {
    runCommand("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], {
      cwd: config.repoRoot,
    });
    return true;
  } catch {
    return false;
  }
}

export function createBranchFromBase(config: LoadedConfig, branch: string): void {
  runCommand("git", ["fetch", "origin", config.baseBranch], { cwd: config.repoRoot });
  runCommand("git", ["checkout", config.baseBranch], { cwd: config.repoRoot });
  runCommand("git", ["pull", "--ff-only", "origin", config.baseBranch], {
    cwd: config.repoRoot,
  });
  runCommand("git", ["checkout", "-b", branch], { cwd: config.repoRoot });
}

export function ensureTicketBranch(config: LoadedConfig, branch: string): void {
  if (localBranchExists(config, branch)) {
    ensureOnBranch(config, branch);
    return;
  }

  if (remoteBranchExists(config, branch)) {
    runCommand("git", ["fetch", "origin", `${branch}:${branch}`], { cwd: config.repoRoot });
    runCommand("git", ["checkout", branch], { cwd: config.repoRoot });
    return;
  }

  createBranchFromBase(config, branch);
}

export function syncTicketBranch(config: LoadedConfig, branch: string): void {
  ensureTicketBranch(config, branch);
  if (remoteBranchExists(config, branch)) {
    const ahead = Number(
      runCommand("git", ["rev-list", "--count", `origin/${branch}..${branch}`], {
        cwd: config.repoRoot,
      }) || "0",
    );
    if (ahead > 0) {
      runCommand("git", ["push"], { cwd: config.repoRoot });
    }
    return;
  }

  runCommand("git", ["push", "-u", "origin", branch], { cwd: config.repoRoot });
}

export function ticketBranchName(prefix: string, ticket: number, title: string): string {
  return `${prefix}/${ticket}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-+/g, "-")}`;
}
