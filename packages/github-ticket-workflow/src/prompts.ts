export const implementPromptTemplate = `Act as a senior engineer and implement GitHub issue #{{TICKET_NUMBER}} in {{ROOT_DIR}}.

Current branch:
- {{BRANCH_NAME}}

Repository context to read first:
{{CONTEXT_FILE_BULLETS}}

Product and engineering contract:
{{PRODUCT_INSTRUCTIONS}}

Start by building context properly:
1. Read the context files listed above in full
2. Read the full GitHub issue #{{TICKET_NUMBER}}, including:
   - problem / goal
   - scope
   - out of scope
   - technical notes
   - acceptance criteria
   - parent/sub-issue context
   - blocked-by / dependency links
3. Inspect the current implementation and relevant files before making changes
4. If blocker issues are incomplete, stop and report that clearly without making unrelated changes

Execution requirements:
- Build the narrowest correct solution that satisfies the issue
- Keep changes scoped to the issue
- Prefer explicit, maintainable design over clever abstractions
- Add or update tests where the issue scope justifies it
- Run relevant verification commands for the changed area
- If you cannot run something, say exactly what you could not run and why
- Commit your work on the current branch with a clear message referencing #{{TICKET_NUMBER}}
- Do not open the PR yourself; the outer workflow will handle that

Output format:
1. Brief summary of what you changed
2. Files changed and why
3. Verification performed
4. Acceptance criteria checklist with each item marked satisfied / not satisfied
5. Any blockers or unresolved risks that materially matter
`;

export const reviewPromptTemplate = `Review GitHub issue #{{TICKET_NUMBER}} in {{ROOT_DIR}}.

Context:
- PR: {{PR_URL}}
- Cycle: {{REVIEW_CYCLE}}
- Focus: {{REVIEW_FOCUS}}
- Changed files vs {{BASE_BRANCH}}:
{{CHANGED_FILES}}

Prior findings to account for:
{{REVIEW_FINDINGS_CONTEXT}}

Required reading:
1. The repository context files listed below
{{CONTEXT_FILE_BULLETS}}
2. GitHub issue #{{TICKET_NUMBER}}
3. Current diff against {{BASE_BRANCH}}

Repository contract:
{{PRODUCT_INSTRUCTIONS}}

This pass:
{{REVIEW_GUIDANCE}}

Review for concrete correctness, security, regression, and missing-test issues only.
Prioritize real defects over style.

Return only schema-valid structured output:
- \`result = "no_findings"\` when there are no concrete findings
- \`result = "findings"\` when there are one or more concrete findings
- include only defensible findings with severity, file, problem, and required change
`;

export const fixPromptTemplate = `Apply the review findings for GitHub issue #{{TICKET_NUMBER}} on branch {{BRANCH_NAME}} in {{ROOT_DIR}}.

Current PR:
- {{PR_URL}}

Read first:
1. The repository context files listed below
{{CONTEXT_FILE_BULLETS}}
2. GitHub issue #{{TICKET_NUMBER}}
3. The review findings below

Repository contract:
{{PRODUCT_INSTRUCTIONS}}

Task:
- Fix every valid review finding
- Keep changes scoped to the issue and the review feedback
- Focus only on the listed findings and any directly adjacent regression risk
- Re-run relevant verification
- Commit your updates on the current branch with a clear message referencing #{{TICKET_NUMBER}}
- Do not open a new PR

Review findings:
{{REVIEW_FINDINGS}}

Output format:
1. Findings addressed
2. Files changed and why
3. Verification performed
4. Any findings you intentionally did not change, with a concrete reason
`;
