import path from "node:path";
import { loadConfig, validateConfig } from "../config";

describe("config validation", () => {
  it("fails when a required field is missing", () => {
    expect(() =>
      validateConfig({
        repo: { owner: "Pieter-OHearn" },
      }),
    ).toThrow("config field repo.name must be a non-empty string");
  });

  it("loads fixture config and resolves repo-local paths", () => {
    const config = loadConfig(
      path.join(__dirname, "../fixtures/fake-repo/automation/ticket-workflow.json"),
    );
    expect(config.repoSlug).toBe("Pieter-OHearn/example");
    expect(config.stateDir.endsWith(path.join(".agent-workflow"))).toBe(true);
    expect(config.promptContextFiles[0].endsWith("AGENTS.md")).toBe(true);
  });
});
