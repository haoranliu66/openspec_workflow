import fs from "node:fs";
import path from "node:path";

import {
  OpenSpecRunner,
  runOpenSpec,
} from "../lib/openspec-cli";
import { resolveProjectRoot } from "../lib/project-root";

export interface ChangeValidationFailure {
  changeId: string;
  reason: string;
}

export interface ActiveChangeValidationResult {
  changeIds: string[];
  failures: ChangeValidationFailure[];
}

export type LineWriter = (line: string) => void;

const CHANGE_ID = /^[a-z0-9][a-z0-9-]*$/;

function defaultWriter(line: string): void {
  process.stdout.write(`${line}\n`);
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.split(/\r?\n/, 1)[0];
  }
  return String(error);
}

export function listActiveChanges(root: string): string[] {
  const changesRoot = path.join(root, "openspec", "changes");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(changesRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Cannot read active changes directory: ${changesRoot}`,
      { cause: error },
    );
  }

  return entries
    .filter((entry) => (
      entry.isDirectory()
      && entry.name !== "archive"
      && !entry.name.startsWith(".")
    ))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function validateActiveChanges(
  root: string,
  run: OpenSpecRunner = runOpenSpec,
  write: LineWriter = defaultWriter,
): ActiveChangeValidationResult {
  const changeIds = listActiveChanges(root);
  const failures: ChangeValidationFailure[] = [];

  changeIds.forEach((changeId, index) => {
    const progress = `[${index + 1}/${changeIds.length}]`;
    if (!CHANGE_ID.test(changeId)) {
      write(`${progress} invalid change ID ${JSON.stringify(changeId)}`);
      failures.push({
        changeId,
        reason: "invalid change ID; expected ^[a-z0-9][a-z0-9-]*$",
      });
      return;
    }

    write(`${progress} validating ${changeId}`);
    try {
      run(["validate", changeId, "--strict"], {
        cwd: root,
        stdio: "inherit",
      });
    } catch (error) {
      failures.push({ changeId, reason: failureReason(error) });
    }
  });

  return { changeIds, failures };
}

export function main(
  run: OpenSpecRunner = runOpenSpec,
  root = resolveProjectRoot(__dirname),
  write: LineWriter = defaultWriter,
): void {
  const result = validateActiveChanges(root, run, write);
  if (result.changeIds.length === 0) {
    write("No active OpenSpec changes found; strict validation skipped.");
    return;
  }
  if (result.failures.length > 0) {
    throw new Error([
      `Strict validation failed for ${result.failures.length} active changes:`,
      ...result.failures.map(
        ({ changeId, reason }) => `- ${changeId}: ${reason}`,
      ),
    ].join("\n"));
  }
  write(`Validated ${result.changeIds.length} active OpenSpec changes in strict mode.`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
