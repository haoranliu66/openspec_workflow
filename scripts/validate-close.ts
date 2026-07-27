import path from "node:path";

import {
  parseValidateCloseArguments,
  validateCloseChange,
} from "../lib/closeout-validation";
import { resolveProjectRoot } from "../lib/project-root";

export type LineWriter = (line: string) => void;

export function main(
  args = process.argv.slice(2),
  projectRoot = resolveProjectRoot(__dirname),
  write: LineWriter = (line) => process.stdout.write(`${line}\n`),
  writeError: LineWriter = (line) => process.stderr.write(`${line}\n`),
  validate: typeof validateCloseChange = validateCloseChange,
): void {
  const { changeId } = parseValidateCloseArguments(args);
  const result = validate(projectRoot, changeId);
  if (result.diagnostics.length > 0) {
    result.diagnostics.forEach((entry) => writeError(`${entry.code} ${entry.path}: ${entry.message}`));
    process.exitCode = 1;
    return;
  }
  write(`Validated closeout for ${result.changeId} (${result.schema}).`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
