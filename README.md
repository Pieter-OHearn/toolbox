# Toolbox

[![CI](https://github.com/pieter-ohearn/toolbox/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

A personal monorepo by Pieter O’Hearn containing reusable libraries and utilities.
This is where I collect packages I use across my projects (web, mobile, backend).

The goal is to keep them:

- Well-typed
- Small & focused (each package solves one problem well)
- Reusable across apps, APIs, and experiments

## 📦 Packages

| Package                                                                                                               | Description                                                                                     | Install                                             |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **[@Pieter-OHearn/github-ticket-workflow](https://github.com/pieter-ohearn/toolbox/pkgs/npm/github-ticket-workflow)** | Reusable local GitHub issue-to-PR workflow automation for Codex/Claude-driven ticket execution. | `pnpm add -D @Pieter-OHearn/github-ticket-workflow` |
| **[@Pieter-OHearn/iso-country](https://github.com/pieter-ohearn/toolbox/pkgs/npm/iso-country)**                       | ISO 3166-1 alpha-2 utilities (Zod v4): validation, code to name, emoji flags, search.           | `pnpm add @Pieter-OHearn/iso-country`               |
| **[@Pieter-OHearn/log-plus](https://github.com/pieter-ohearn/toolbox/pkgs/npm/log-plus)**                             | Lightweight logging with levels, timestamps, and pluggable formatters/transports.               | `pnpm add @Pieter-OHearn/log-plus`                  |

## Development

Clone and install:

```bash
git clone git@github.com:pieter-ohearn/toolbox.git
cd toolbox
pnpm install
```

Build all packages:

```bash
pnpm -r build
```

Run tests:

```bash
pnpm -r test
```

## Running CI Locally

We use [act](https://github.com/nektos/act) to run GitHub Actions workflows locally. This ensures pre-commit or pre-push hooks run the same jobs as CI.

### Install act (requires [Docker](https://docs.docker.com/get-docker/) to be running)

- **macOS**: `brew install act`
- **Other platforms**: see the [act install guide](https://github.com/nektos/act#installation)

### Run the CI workflow locally

```bash
act pull_request
```

This runs the `ci.yml` workflow using the same steps as GitHub’s hosted runners.

### Enable as a git hook

We use [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) to wire this into git.

In `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-push": "act pull_request"
  }
}
```

Enable hooks:

```bash
pnpm simple-git-hooks
```

Now every push runs the CI workflow locally before hitting GitHub.

## Releasing

We use Changesets:

1. Add a changeset when you make changes:

   ```bash
   pnpm changeset
   ```

   Choose packages + bump type, write release notes.

2. Preview upcoming changes:

   ```bash
   pnpm changeset status --verbose
   ```

3. Merge the Release PR created by CI → versions + changelogs update automatically.

## Naming

All packages are published under the npm scope @Pieter-OHearn/\*.
