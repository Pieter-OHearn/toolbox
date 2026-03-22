import { buildExecCommand } from "../providers";

describe("buildExecCommand", () => {
  it("builds the codex command with output capture", () => {
    expect(
      buildExecCommand("codex", "codex", ["-C", "/repo"], "prompt.md", "out.txt", "gpt-5"),
    ).toEqual({
      bin: "codex",
      args: ["exec", "-C", "/repo", "-o", "out.txt", "-m", "gpt-5", "-"],
    });
  });

  it("builds the claude command with model override", () => {
    expect(
      buildExecCommand("claude", "claude", ["--print"], "prompt.md", "out.txt", "sonnet"),
    ).toEqual({
      bin: "claude",
      args: ["--print", "--model", "sonnet"],
    });
  });
});
