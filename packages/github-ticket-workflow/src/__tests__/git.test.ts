import { ticketBranchName } from "../git";

describe("ticketBranchName", () => {
  it("builds the configured branch prefix with a slugified title", () => {
    expect(ticketBranchName("ticket", 19, "Bootstrap the Service Runtime!")).toBe(
      "ticket/19-bootstrap-the-service-runtime",
    );
  });
});
