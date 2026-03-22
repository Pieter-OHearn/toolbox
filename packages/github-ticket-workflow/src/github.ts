import type { LoadedConfig } from "./types.js";
import { runCommand } from "./utils.js";

export function ticketTitle(config: LoadedConfig, ticket: number): string {
  return runCommand(
    "gh",
    [
      "issue",
      "view",
      String(ticket),
      "--repo",
      config.repoSlug,
      "--json",
      "title",
      "--jq",
      ".title",
    ],
    { cwd: config.repoRoot },
  );
}

export function ensureTicketExists(config: LoadedConfig, ticket: number): void {
  runCommand("gh", ["issue", "view", String(ticket), "--repo", config.repoSlug], {
    cwd: config.repoRoot,
  });
}

export function currentStatus(config: LoadedConfig, ticket: number): string {
  return runCommand(
    "gh",
    [
      "project",
      "item-list",
      String(config.raw.githubProject.number),
      "--owner",
      config.raw.repo.owner,
      "--format",
      "json",
      "--jq",
      `.items[] | select(.content.number == ${ticket}) | .status`,
    ],
    { cwd: config.repoRoot },
  );
}

export function projectItemId(config: LoadedConfig, ticket: number): string {
  return runCommand(
    "gh",
    [
      "project",
      "item-list",
      String(config.raw.githubProject.number),
      "--owner",
      config.raw.repo.owner,
      "--format",
      "json",
      "--jq",
      `.items[] | select(.content.number == ${ticket}) | .id`,
    ],
    { cwd: config.repoRoot },
  );
}

export function buildProjectStatusEditArgs(
  config: LoadedConfig,
  itemId: string,
  optionId: string,
): string[] {
  return [
    "project",
    "item-edit",
    "--id",
    itemId,
    "--project-id",
    config.raw.githubProject.id,
    "--field-id",
    config.raw.githubProject.statusFieldId,
    "--single-select-option-id",
    optionId,
  ];
}

export function setStatus(config: LoadedConfig, ticket: number, optionId: string): void {
  const itemId = projectItemId(config, ticket);
  runCommand("gh", buildProjectStatusEditArgs(config, itemId, optionId), {
    cwd: config.repoRoot,
  });
}

export function findPrForBranch(
  config: LoadedConfig,
  branch: string,
): {
  number: number;
  url: string;
} | null {
  const raw = runCommand(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      config.repoSlug,
      "--head",
      branch,
      "--state",
      "open",
      "--json",
      "number,url",
      "--jq",
      ".[0]",
    ],
    { cwd: config.repoRoot },
  );

  if (!raw || raw === "null") {
    return null;
  }

  return JSON.parse(raw) as { number: number; url: string };
}

export function openPrForBranch(
  config: LoadedConfig,
  ticket: number,
  branch: string,
  title: string,
  bodyFile: string,
): string {
  return runCommand(
    "gh",
    [
      "pr",
      "create",
      "--repo",
      config.repoSlug,
      "--base",
      config.baseBranch,
      "--head",
      branch,
      "--title",
      `Ticket #${ticket}: ${title}`,
      "--body-file",
      bodyFile,
    ],
    { cwd: config.repoRoot },
  );
}

export function prNumberFromUrl(config: LoadedConfig, prUrl: string): number {
  return Number(
    runCommand(
      "gh",
      ["pr", "view", prUrl, "--repo", config.repoSlug, "--json", "number", "--jq", ".number"],
      {
        cwd: config.repoRoot,
      },
    ),
  );
}

export function applyPrMetadata(config: LoadedConfig, prRef: string): void {
  const labels =
    process.env.PR_LABELS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const assignees =
    process.env.PR_ASSIGNEES?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  for (const label of labels) {
    runCommand("gh", ["pr", "edit", prRef, "--repo", config.repoSlug, "--add-label", label], {
      cwd: config.repoRoot,
    });
  }

  for (const assignee of assignees) {
    runCommand("gh", ["pr", "edit", prRef, "--repo", config.repoSlug, "--add-assignee", assignee], {
      cwd: config.repoRoot,
    });
  }
}

export function commentReviewLimitReached(
  config: LoadedConfig,
  prRef: string,
  ticket: number,
  cycles: number,
  label: string,
  stateDir: string,
): void {
  const body = `${label} ticket workflow stopped after reaching the review cycle limit for ticket #${ticket}.

- Review cycles used: ${cycles}
- Status remains: In review
- Next step: inspect the latest review output in \`${stateDir}/ticket-runs/${ticket}/\` and either fix the remaining findings manually or rerun the workflow to resume from the next pending step.`;

  runCommand("gh", ["pr", "comment", prRef, "--repo", config.repoSlug, "--body", body], {
    cwd: config.repoRoot,
  });
}

export function mergePrAndMarkDone(config: LoadedConfig, prUrl: string, ticket: number): void {
  runCommand(
    "gh",
    ["pr", "merge", prUrl, "--repo", config.repoSlug, "--squash", "--delete-branch"],
    {
      cwd: config.repoRoot,
    },
  );
  setStatus(config, ticket, config.raw.githubProject.statusOptions.done);
}
