import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function fail(message: string): never {
  throw new Error(message);
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function ensureArrayOfStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`config field ${field} must be an array of strings`);
  }

  return value;
}

export function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`config field ${field} must be a non-empty string`);
  }

  return value;
}

export function ensureBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    fail(`config field ${field} must be a boolean`);
  }

  return value;
}

export function ensureNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    fail(`config field ${field} must be a number`);
  }

  return value;
}

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
  } = {},
): string {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    input: options.input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function runCommandStreaming(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    inputFile?: string;
    outputFile?: string;
  } = {},
): void {
  const stdio: Array<"inherit" | number> = ["inherit", "inherit", "inherit"];
  if (options.inputFile) {
    stdio[0] = fs.openSync(options.inputFile, "r");
  }
  if (options.outputFile) {
    stdio[1] = fs.openSync(options.outputFile, "w");
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio,
  });

  if (typeof stdio[0] === "number") {
    fs.closeSync(stdio[0]);
  }
  if (typeof stdio[1] === "number") {
    fs.closeSync(stdio[1]);
  }

  if (result.status !== 0) {
    fail(`command failed: ${command} ${args.join(" ")}`);
  }
}

export function runShellCommand(
  command: string,
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  const result = spawnSync(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    fail(`shell command failed: ${command}`);
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-+/g, "-");
}

export function relativeToRepoRoot(repoRoot: string, filePath: string): string {
  const relative = path.relative(repoRoot, filePath);
  return relative.length === 0 ? "." : relative;
}
