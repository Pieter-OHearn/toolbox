const mockRunCommand = jest.fn();

jest.mock("../utils", () => ({
  runCommand: (...args: unknown[]) => mockRunCommand(...args),
}));

import { buildProjectStatusEditArgs, setStatus } from "../github";

describe("GitHub project helpers", () => {
  const config = {
    repoRoot: "/repo",
    repoSlug: "Pieter-OHearn/example",
    raw: {
      repo: { owner: "Pieter-OHearn" },
      githubProject: {
        number: 4,
        id: "project-id",
        statusFieldId: "field-id",
      },
    },
  };

  beforeEach(() => {
    mockRunCommand.mockReset();
  });

  it("builds project item-edit args", () => {
    expect(buildProjectStatusEditArgs(config, "item-id", "done-id")).toEqual([
      "project",
      "item-edit",
      "--id",
      "item-id",
      "--project-id",
      "project-id",
      "--field-id",
      "field-id",
      "--single-select-option-id",
      "done-id",
    ]);
  });

  it("resolves the item id before editing status", () => {
    mockRunCommand.mockReturnValueOnce("item-id").mockReturnValueOnce("");
    setStatus(config, 19, "done-id");
    expect(mockRunCommand).toHaveBeenNthCalledWith(
      2,
      "gh",
      buildProjectStatusEditArgs(config, "item-id", "done-id"),
      { cwd: "/repo" },
    );
  });
});
