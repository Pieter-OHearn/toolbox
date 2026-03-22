import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reviewOutputSchema } from "./schema.js";
import type { LoadedConfig, ProviderCommand } from "./types.js";
import { fail, runCommandStreaming, writeJsonFile } from "./utils.js";

export function resolveProvider(
  config: LoadedConfig,
  providerOverride?: string,
): {
  provider: "codex" | "claude";
  bin: string;
  flags: string[];
  label: string;
} {
  const provider = (providerOverride ??
    process.env.AGENT_PROVIDER ??
    config.raw.agents.defaultProvider) as "codex" | "claude";

  if (provider !== "codex" && provider !== "claude") {
    fail(`unsupported provider: ${provider}`);
  }

  const providerConfig = config.raw.agents.providers[provider];
  const envBin =
    provider === "codex"
      ? (process.env.AGENT_BIN ?? process.env.CODEX_BIN)
      : (process.env.AGENT_BIN ?? process.env.CLAUDE_BIN);

  const envFlags =
    process.env.AGENT_FLAGS ?? (provider === "codex" ? process.env.CODEX_FLAGS : undefined);

  const defaultFlags =
    provider === "codex"
      ? ["--dangerously-bypass-approvals-and-sandbox", "-C", config.repoRoot]
      : ["--print", "--dangerously-skip-permissions"];

  return {
    provider,
    bin: envBin ?? providerConfig.bin ?? (provider === "codex" ? "codex" : "claude"),
    flags: envFlags
      ? envFlags.split(/\s+/).filter(Boolean)
      : (providerConfig.flags ?? defaultFlags),
    label: provider === "codex" ? "Codex" : "Claude",
  };
}

export function buildExecCommand(
  provider: "codex" | "claude",
  bin: string,
  flags: string[],
  promptFile: string,
  outputFile: string,
  model?: string,
): ProviderCommand {
  if (provider === "codex") {
    const args = ["exec", ...flags, "-o", outputFile];
    if (model) {
      args.push("-m", model);
    }
    args.push("-");
    return { bin, args };
  }

  const args = [...flags];
  if (model) {
    args.push("--model", model);
  }
  return { bin, args };
}

export function runAgentExec(options: {
  config: LoadedConfig;
  providerOverride?: string;
  promptFile: string;
  outputFile: string;
  model?: string;
}): void {
  const resolved = resolveProvider(options.config, options.providerOverride);
  const command = buildExecCommand(
    resolved.provider,
    resolved.bin,
    resolved.flags,
    options.promptFile,
    options.outputFile,
    options.model,
  );

  runCommandStreaming(command.bin, command.args, {
    cwd: options.config.repoRoot,
    inputFile: options.promptFile,
    outputFile: resolved.provider === "claude" ? options.outputFile : undefined,
  });
}

export function runAgentReviewStructured(options: {
  config: LoadedConfig;
  providerOverride?: string;
  promptFile: string;
  outputFile: string;
  model?: string;
}): void {
  const resolved = resolveProvider(options.config, options.providerOverride);

  if (resolved.provider === "codex") {
    const args = ["exec", ...resolved.flags, "-o", options.outputFile, "--output-schema"];
    const schemaFile = path.join(os.tmpdir(), `github-ticket-workflow-schema-${process.pid}.json`);
    writeJsonFile(schemaFile, reviewOutputSchema);
    args.push(schemaFile);
    if (options.model) {
      args.push("-m", options.model);
    }
    args.push("-");
    runCommandStreaming(resolved.bin, args, {
      cwd: options.config.repoRoot,
      inputFile: options.promptFile,
    });
    fs.unlinkSync(schemaFile);
    return;
  }

  const args = [
    ...resolved.flags,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(reviewOutputSchema),
  ];
  if (options.model) {
    args.push("--model", options.model);
  }
  runCommandStreaming(resolved.bin, args, {
    cwd: options.config.repoRoot,
    inputFile: options.promptFile,
    outputFile: options.outputFile,
  });
}
