#!/usr/bin/env node
import { mergeTicket, startTicket, statusTicket } from "./workflow.js";

function usage(): string {
  return `Usage:
  github-ticket-workflow start <ticket-number> [--provider codex|claude] [--review-cycles N] [--skip-ready-check] [--config path]
  github-ticket-workflow merge <ticket-number> [--config path]
  github-ticket-workflow status <ticket-number> [--config path]`;
}

function parseGlobalFlags(args: string[]): {
  remaining: string[];
  configPath?: string;
} {
  const remaining: string[] = [];
  let configPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--config") {
      configPath = args[index + 1];
      index += 1;
      continue;
    }
    remaining.push(arg);
  }

  return { remaining, configPath };
}

function main(): void {
  const { remaining, configPath } = parseGlobalFlags(process.argv.slice(2));
  const command = remaining[0];

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  try {
    if (command === "start") {
      const ticket = Number(remaining[1]);
      if (!Number.isInteger(ticket)) {
        throw new Error("start requires a ticket number");
      }

      let providerOverride: string | undefined;
      let reviewCycles: number | undefined;
      let skipReadyCheck = false;

      for (let index = 2; index < remaining.length; index += 1) {
        const arg = remaining[index];
        if (arg === "--provider") {
          providerOverride = remaining[index + 1];
          index += 1;
        } else if (arg === "--review-cycles") {
          reviewCycles = Number(remaining[index + 1]);
          index += 1;
        } else if (arg === "--skip-ready-check") {
          skipReadyCheck = true;
        } else {
          throw new Error(`unknown option for start: ${arg}`);
        }
      }

      startTicket(ticket, {
        configPath,
        providerOverride,
        reviewCycles,
        skipReadyCheck,
      });
      return;
    }

    if (command === "merge") {
      const ticket = Number(remaining[1]);
      if (!Number.isInteger(ticket)) {
        throw new Error("merge requires a ticket number");
      }
      mergeTicket(ticket, { configPath });
      return;
    }

    if (command === "status") {
      const ticket = Number(remaining[1]);
      if (!Number.isInteger(ticket)) {
        throw new Error("status requires a ticket number");
      }
      process.stdout.write(`${statusTicket(ticket, { configPath })}\n`);
      return;
    }

    throw new Error(`unknown command: ${command}`);
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

main();
