import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inferReviewResumePoint } from "../state";

describe("inferReviewResumePoint", () => {
  it("returns fix when findings exist and no fix output is present", () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-state-"));
    fs.writeFileSync(
      path.join(runDir, "review-1.json"),
      JSON.stringify({
        result: "findings",
        findings: [{ severity: "high", file: "a.ts", problem: "x", change: "y" }],
      }),
    );

    expect(inferReviewResumePoint(runDir)).toEqual({
      action: "fix",
      cycle: 1,
      lastReviewResult: "findings",
    });
  });

  it("returns done when the latest review has no findings", () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-state-"));
    fs.writeFileSync(
      path.join(runDir, "review-2.json"),
      JSON.stringify({ result: "no_findings", findings: [] }),
    );

    expect(inferReviewResumePoint(runDir)).toEqual({
      action: "done",
      cycle: 2,
      lastReviewResult: "no_findings",
    });
  });
});
