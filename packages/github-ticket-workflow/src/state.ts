import fs from "node:fs";
import path from "node:path";
import type { ResumePoint, ReviewResult, WorkflowState } from "./types.js";
import { readJsonFile, writeJsonFile } from "./utils.js";

export function ticketRunDir(stateDir: string, ticket: number): string {
  return path.join(stateDir, "ticket-runs", String(ticket));
}

export function ticketStateFile(stateDir: string, ticket: number): string {
  return path.join(stateDir, "ticket-runs", String(ticket), "state.json");
}

export function loadState(stateDir: string, ticket: number): WorkflowState | null {
  const file = ticketStateFile(stateDir, ticket);
  if (!fs.existsSync(file)) {
    return null;
  }

  return readJsonFile<WorkflowState>(file);
}

export function saveState(stateDir: string, ticket: number, state: WorkflowState): void {
  writeJsonFile(ticketStateFile(stateDir, ticket), state);
}

export function latestReviewCycle(runDir: string): number {
  if (!fs.existsSync(runDir)) {
    return 0;
  }

  let maxCycle = 0;
  for (const file of fs.readdirSync(runDir)) {
    const match = /^review-(\d+)\.json$/.exec(file);
    if (!match) {
      continue;
    }
    const cycle = Number(match[1]);
    if (cycle > maxCycle) {
      maxCycle = cycle;
    }
  }

  return maxCycle;
}

export function inferReviewResumePoint(runDir: string): ResumePoint {
  const latestCycle = latestReviewCycle(runDir);
  if (latestCycle === 0) {
    return { action: "review", cycle: 1 };
  }

  const latest = readJsonFile<ReviewResult>(path.join(runDir, `review-${latestCycle}.json`));
  if (latest.result === "no_findings") {
    return { action: "done", cycle: latestCycle, lastReviewResult: latest.result };
  }

  const fixFile = path.join(runDir, `fix-${latestCycle}.out.txt`);
  if (fs.existsSync(fixFile)) {
    return { action: "review", cycle: latestCycle + 1, lastReviewResult: latest.result };
  }

  return { action: "fix", cycle: latestCycle, lastReviewResult: latest.result };
}
