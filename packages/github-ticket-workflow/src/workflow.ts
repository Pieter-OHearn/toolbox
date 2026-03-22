import fs from "node:fs";
import path from "node:path";
import {
  applyPrMetadata,
  commentReviewLimitReached,
  currentStatus,
  ensureTicketExists,
  findPrForBranch,
  mergePrAndMarkDone,
  openPrForBranch,
  prNumberFromUrl,
  setStatus,
  ticketTitle,
} from "./github.js";
import {
  changedFilesAgainstBase,
  ensureTicketBranch,
  requireCleanTree,
  syncTicketBranch,
  ticketBranchName,
} from "./git.js";
import { loadConfig } from "./config.js";
import { fixPromptTemplate, implementPromptTemplate, reviewPromptTemplate } from "./prompts.js";
import { runAgentExec, runAgentReviewStructured, resolveProvider } from "./providers.js";
import { inferReviewResumePoint, loadState, saveState, ticketRunDir } from "./state.js";
import type { LoadedConfig, ReviewResult, WorkflowState } from "./types.js";
import { readJsonFile, relativeToRepoRoot, runShellCommand } from "./utils.js";

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function contextFileBullets(config: LoadedConfig): string {
  return config.promptContextFiles
    .map((filePath) => `- ${relativeToRepoRoot(config.repoRoot, filePath)}`)
    .join("\n");
}

function reviewFocusForCycle(cycle: number): string {
  switch (cycle) {
    case 1:
      return "Broad review for correctness, regressions, acceptance criteria, and spec alignment.";
    case 2:
      return "Targeted review for security, edge cases, second-order leak paths, and missing regression coverage.";
    case 3:
      return "Final verification pass for unresolved findings, fix regressions, and gaps in validation.";
    default:
      return "Focused review.";
  }
}

function reviewGuidanceForCycle(cycle: number): string {
  switch (cycle) {
    case 1:
      return [
        "- Prioritize concrete correctness and integration issues in the current diff.",
        "- Check acceptance criteria coverage before searching for speculative improvements.",
      ].join("\n");
    case 2:
      return [
        "- Search for second-order security paths, not just direct request handling.",
        "- Prefer high-signal findings that a generic first pass might miss.",
      ].join("\n");
    case 3:
      return [
        "- Review only the remaining risky areas and the latest fixes.",
        "- Return no_findings if the remaining diff is clean and adequately tested.",
      ].join("\n");
    default:
      return "- Focus on concrete defects only.";
  }
}

function runPrePushChecks(config: LoadedConfig, runDir: string, label: string): void {
  for (const command of config.prePushChecks) {
    runShellCommand(command, {
      cwd: config.repoRoot,
      env: {
        ROOT_DIR: config.repoRoot,
        RUN_DIR: runDir,
        CHECK_LABEL: label,
        BASE_BRANCH: config.baseBranch,
      },
    });
  }
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function buildPrBody(ticket: number, implementOutputFile: string, bodyFile: string): void {
  const text = fs.existsSync(implementOutputFile)
    ? fs.readFileSync(implementOutputFile, "utf8")
    : "";
  const lines = text.split("\n");
  let summary = "Implemented the ticket scope and related verification.";
  const verification: string[] = [];
  const acceptance: string[] = [];
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (line.startsWith("1. brief summary") || line === "brief summary of what you changed") {
      section = "summary";
      continue;
    }
    if (line.startsWith("3. verification performed") || line === "verification performed") {
      section = "verification";
      continue;
    }
    if (line.startsWith("4. acceptance criteria checklist")) {
      section = "acceptance";
      continue;
    }
    if (/^[1-5]\./.test(line)) {
      section = "";
      continue;
    }

    if (!rawLine.trim()) {
      continue;
    }

    if (section === "summary") {
      summary = rawLine.trim();
    } else if (section === "verification") {
      verification.push(rawLine);
    } else if (section === "acceptance") {
      acceptance.push(rawLine);
    }
  }

  const body = [`Closes #${ticket}`, "", "## Summary", summary];

  if (verification.length > 0) {
    body.push("", "## Verification", ...verification);
  }
  if (acceptance.length > 0) {
    body.push("", "## Acceptance Criteria", ...acceptance);
  }

  body.push("", "## Notes", "Created by the automated ticket workflow.", "");
  writeFile(bodyFile, body.join("\n"));
}

function findingsToMarkdown(review: ReviewResult): string {
  if (review.result === "no_findings") {
    return "NO_FINDINGS";
  }

  return review.findings
    .map(
      (finding, index) =>
        `${index + 1}. Severity: ${finding.severity}\nFile: ${finding.file}\nProblem: ${finding.problem}\nRequired change: ${finding.change}\n`,
    )
    .join("\n");
}

function refreshSavedPrState(
  config: LoadedConfig,
  branch: string,
  state: WorkflowState,
): WorkflowState {
  const pr = findPrForBranch(config, branch);
  if (pr) {
    return {
      ...state,
      prUrl: pr.url,
      prNumber: pr.number,
    };
  }

  return {
    ...state,
    prUrl: undefined,
    prNumber: undefined,
  };
}

function implementationModel(): string | undefined {
  return process.env.IMPLEMENT_MODEL;
}

function reviewModel(): string | undefined {
  return process.env.REVIEW_MODEL;
}

function fixModel(): string | undefined {
  return process.env.FIX_MODEL;
}

function runImplementationPhase(
  config: LoadedConfig,
  ticket: number,
  branch: string,
  runDir: string,
  state: WorkflowState,
  providerOverride?: string,
): WorkflowState {
  fs.mkdirSync(runDir, { recursive: true });
  ensureTicketBranch(config, branch);
  setStatus(config, ticket, config.raw.githubProject.statusOptions.inProgress);

  const nextState = { ...state, workflowStage: "implement" as const };
  saveState(config.stateDir, ticket, nextState);

  const promptFile = path.join(runDir, "implement.md");
  const outputFile = path.join(runDir, "implement.out.txt");
  writeFile(
    promptFile,
    renderTemplate(implementPromptTemplate, {
      TICKET_NUMBER: String(ticket),
      BRANCH_NAME: branch,
      ROOT_DIR: config.repoRoot,
      CONTEXT_FILE_BULLETS: contextFileBullets(config),
      PRODUCT_INSTRUCTIONS: config.productInstructions,
    }),
  );

  runAgentExec({
    config,
    providerOverride,
    promptFile,
    outputFile,
    model: implementationModel(),
  });

  runPrePushChecks(config, runDir, "implement");
  syncTicketBranch(config, branch);

  const prBodyFile = path.join(runDir, "pr-body.md");
  buildPrBody(ticket, outputFile, prBodyFile);
  const refreshedState = refreshSavedPrState(config, branch, nextState);

  if (!refreshedState.prUrl) {
    const title = ticketTitle(config, ticket);
    const prUrl = openPrForBranch(config, ticket, branch, title, prBodyFile);
    refreshedState.prUrl = prUrl;
    refreshedState.prNumber = prNumberFromUrl(config, prUrl);
    applyPrMetadata(config, prUrl);
  }

  refreshedState.workflowStage = "review";
  saveState(config.stateDir, ticket, refreshedState);
  setStatus(config, ticket, config.raw.githubProject.statusOptions.inReview);
  return refreshedState;
}

function runFixCycle(
  config: LoadedConfig,
  ticket: number,
  branch: string,
  runDir: string,
  cycle: number,
  state: WorkflowState,
  providerOverride?: string,
): WorkflowState {
  const reviewJsonFile = path.join(runDir, `review-${cycle}.json`);
  const reviewTextFile = path.join(runDir, `review-${cycle}.txt`);
  if (!fs.existsSync(reviewTextFile)) {
    const review = readJsonFile<ReviewResult>(reviewJsonFile);
    writeFile(reviewTextFile, findingsToMarkdown(review));
  }

  const promptFile = path.join(runDir, `fix-${cycle}.md`);
  const outputFile = path.join(runDir, `fix-${cycle}.out.txt`);
  writeFile(
    promptFile,
    renderTemplate(fixPromptTemplate, {
      TICKET_NUMBER: String(ticket),
      BRANCH_NAME: branch,
      ROOT_DIR: config.repoRoot,
      PR_URL: state.prUrl ?? "",
      REVIEW_FINDINGS: fs.readFileSync(reviewTextFile, "utf8"),
      CONTEXT_FILE_BULLETS: contextFileBullets(config),
      PRODUCT_INSTRUCTIONS: config.productInstructions,
    }),
  );

  ensureTicketBranch(config, branch);
  const nextState = { ...state, workflowStage: "fix" as const };
  saveState(config.stateDir, ticket, nextState);

  runAgentExec({
    config,
    providerOverride,
    promptFile,
    outputFile,
    model: fixModel(),
  });

  runPrePushChecks(config, runDir, `fix-${cycle}`);
  syncTicketBranch(config, branch);

  const reviewState: WorkflowState = { ...nextState, workflowStage: "review" };
  saveState(config.stateDir, ticket, reviewState);
  return reviewState;
}

function runReviewCycles(
  config: LoadedConfig,
  ticket: number,
  branch: string,
  runDir: string,
  reviewCycles: number,
  startCycle: number,
  state: WorkflowState,
  providerOverride?: string,
): WorkflowState {
  syncTicketBranch(config, branch);
  let currentState = state;

  for (let cycle = startCycle; cycle <= reviewCycles; cycle += 1) {
    const changedFiles = changedFilesAgainstBase(config);
    const promptFile = path.join(runDir, `review-${cycle}.md`);
    const outputFile = path.join(runDir, `review-${cycle}.json`);
    const outputTextFile = path.join(runDir, `review-${cycle}.txt`);
    const previousFindings =
      cycle > 1 && fs.existsSync(path.join(runDir, `review-${cycle - 1}.txt`))
        ? fs.readFileSync(path.join(runDir, `review-${cycle - 1}.txt`), "utf8")
        : "No prior findings.";

    currentState = {
      ...currentState,
      workflowStage: "review",
    };
    saveState(config.stateDir, ticket, currentState);

    writeFile(
      promptFile,
      renderTemplate(reviewPromptTemplate, {
        TICKET_NUMBER: String(ticket),
        ROOT_DIR: config.repoRoot,
        PR_URL: currentState.prUrl ?? "",
        REVIEW_CYCLE: String(cycle),
        REVIEW_FOCUS: reviewFocusForCycle(cycle),
        CHANGED_FILES:
          changedFiles.length > 0 ? changedFiles.join("\n") : "(no changed files detected)",
        REVIEW_FINDINGS_CONTEXT: previousFindings,
        REVIEW_GUIDANCE: reviewGuidanceForCycle(cycle),
        BASE_BRANCH: config.baseBranch,
        CONTEXT_FILE_BULLETS: contextFileBullets(config),
        PRODUCT_INSTRUCTIONS: config.productInstructions,
      }),
    );

    runAgentReviewStructured({
      config,
      providerOverride,
      promptFile,
      outputFile,
      model: reviewModel(),
    });

    const review = readJsonFile<ReviewResult>(outputFile);
    currentState = {
      ...currentState,
      lastCompletedReviewCycle: cycle,
      lastReviewResult: review.result,
    };
    saveState(config.stateDir, ticket, currentState);

    if (review.result === "no_findings") {
      return currentState;
    }

    writeFile(outputTextFile, findingsToMarkdown(review));
    currentState = runFixCycle(
      config,
      ticket,
      branch,
      runDir,
      cycle,
      currentState,
      providerOverride,
    );
  }

  const provider = resolveProvider(config, providerOverride);
  if (currentState.prUrl) {
    commentReviewLimitReached(
      config,
      currentState.prUrl,
      ticket,
      reviewCycles,
      provider.label,
      relativeToRepoRoot(config.repoRoot, config.stateDir),
    );
  }

  return currentState;
}

export function startTicket(
  ticket: number,
  options: {
    configPath?: string;
    providerOverride?: string;
    reviewCycles?: number;
    skipReadyCheck?: boolean;
  } = {},
): void {
  const config = loadConfig(options.configPath);
  ensureTicketExists(config, ticket);
  requireCleanTree(config);

  const boardStatus = currentStatus(config, ticket);
  const branch = ticketBranchName(config.branchPrefix, ticket, ticketTitle(config, ticket));
  const runDir = ticketRunDir(config.stateDir, ticket);
  const saved = loadState(config.stateDir, ticket);
  const initialState: WorkflowState = saved ?? {
    ticketNumber: ticket,
    branchName: branch,
    lastCompletedReviewCycle: 0,
  };

  let resumeMode: "fresh" | "implement" | "review" = "fresh";
  if (boardStatus === "In progress") {
    resumeMode = "implement";
  } else if (boardStatus === "In review") {
    resumeMode = "review";
  } else if (
    !options.skipReadyCheck &&
    config.raw.workflow.requireReadyByDefault &&
    boardStatus !== "Ready"
  ) {
    throw new Error(
      `ticket #${ticket} must be in Ready before start (current status: ${boardStatus || "unknown"})`,
    );
  }

  let state = { ...initialState, branchName: branch };
  if (resumeMode === "fresh") {
    fs.rmSync(runDir, { recursive: true, force: true });
    state = {
      ticketNumber: ticket,
      branchName: branch,
      lastCompletedReviewCycle: 0,
    };
  }

  fs.mkdirSync(runDir, { recursive: true });
  state = refreshSavedPrState(config, branch, state);
  saveState(config.stateDir, ticket, state);

  const reviewCycles = options.reviewCycles ?? Number(process.env.REVIEW_CYCLES ?? "2");
  if (resumeMode === "implement") {
    state = runImplementationPhase(config, ticket, branch, runDir, state, options.providerOverride);
    runReviewCycles(
      config,
      ticket,
      branch,
      runDir,
      reviewCycles,
      1,
      state,
      options.providerOverride,
    );
    return;
  }

  if (resumeMode === "review") {
    if (!state.prUrl) {
      throw new Error(
        `ticket #${ticket} is in review but no open PR was found for branch ${branch}`,
      );
    }

    const resume = inferReviewResumePoint(runDir);
    state.lastCompletedReviewCycle = resume.cycle;
    state.lastReviewResult = resume.lastReviewResult;
    saveState(config.stateDir, ticket, state);

    if (resume.action === "done") {
      return;
    }
    if (resume.action === "fix") {
      state = runFixCycle(
        config,
        ticket,
        branch,
        runDir,
        resume.cycle,
        state,
        options.providerOverride,
      );
      runReviewCycles(
        config,
        ticket,
        branch,
        runDir,
        reviewCycles,
        resume.cycle + 1,
        state,
        options.providerOverride,
      );
      return;
    }

    runReviewCycles(
      config,
      ticket,
      branch,
      runDir,
      reviewCycles,
      resume.cycle,
      state,
      options.providerOverride,
    );
    return;
  }

  state = runImplementationPhase(config, ticket, branch, runDir, state, options.providerOverride);
  runReviewCycles(config, ticket, branch, runDir, reviewCycles, 1, state, options.providerOverride);
}

export function mergeTicket(ticket: number, options: { configPath?: string } = {}): void {
  const config = loadConfig(options.configPath);
  const state = loadState(config.stateDir, ticket);
  if (!state?.prUrl) {
    throw new Error(`no PR URL saved for ticket ${ticket}`);
  }

  mergePrAndMarkDone(config, state.prUrl, ticket);
}

export function statusTicket(ticket: number, options: { configPath?: string } = {}): string {
  const config = loadConfig(options.configPath);
  ensureTicketExists(config, ticket);
  const branch = ticketBranchName(config.branchPrefix, ticket, ticketTitle(config, ticket));
  const pr = findPrForBranch(config, branch);
  const boardStatus = currentStatus(config, ticket);
  const runDir = ticketRunDir(config.stateDir, ticket);
  const state = loadState(config.stateDir, ticket);

  const lines = [
    `Ticket: #${ticket}`,
    `Branch: ${branch}`,
    `Board status: ${boardStatus || "unknown"}`,
    `PR: ${pr?.url ?? "none"}`,
    `Saved stage: ${state?.workflowStage ?? "none"}`,
    `Last review cycle: ${state?.lastCompletedReviewCycle ?? 0}`,
    `Last review result: ${state?.lastReviewResult ?? "none"}`,
    `Run artifacts: ${runDir}`,
  ];
  return lines.join("\n");
}
