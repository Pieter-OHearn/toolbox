import { fixPromptTemplate, implementPromptTemplate, reviewPromptTemplate } from "../prompts";

describe("prompt templates", () => {
  it("include repo-specific product instruction placeholders", () => {
    expect(implementPromptTemplate).toContain("{{PRODUCT_INSTRUCTIONS}}");
    expect(reviewPromptTemplate).toContain("{{PRODUCT_INSTRUCTIONS}}");
    expect(fixPromptTemplate).toContain("{{PRODUCT_INSTRUCTIONS}}");
  });
});
