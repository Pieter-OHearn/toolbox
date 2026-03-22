# @Pieter-OHearn/github-ticket-workflow

Reusable GitHub issue-to-PR workflow automation for local agent-driven development.

The package provides a CLI that can:

- start work for a GitHub issue
- create or resume the issue branch
- run implementation, review, and fix agent cycles
- open and update a PR
- move a GitHub Project item through status columns
- persist run state in the consuming repository

## Install

```bash
pnpm add -D @Pieter-OHearn/github-ticket-workflow
```

## Config

Create `automation/ticket-workflow.json` in the consuming repository and point the CLI at it:

```bash
github-ticket-workflow status 19 --config automation/ticket-workflow.json
```

## Requirements

- Node.js
- `git`
- `gh`
- `python3`
- `jq`
- the selected agent CLI (`codex` or `claude`)
