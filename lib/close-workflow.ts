import { type CloseoutDiagnostic } from "./closeout-contract";
import { type CloseoutValidationResult, validateCloseChange } from "./closeout-validation";
import { runOpenSpec } from "./openspec-cli";
import { checkProject, writeIndex } from "../scripts/openspec-governance";

export interface CloseWorkflowDependencies {
  validate: (root: string, changeId: string) => CloseoutValidationResult;
  archive: (root: string, args: readonly string[]) => void;
  index: (root: string) => void;
  check: (root: string) => void;
}

export interface CloseWorkflowResult {
  changeId: string;
  archived: boolean;
}

export class CloseWorkflowError extends Error {
  readonly archived: boolean;
  readonly diagnostics: readonly CloseoutDiagnostic[];

  constructor(message: string, archived: boolean, diagnostics: readonly CloseoutDiagnostic[] = []) {
    super(message);
    this.name = "CloseWorkflowError";
    this.archived = archived;
    this.diagnostics = diagnostics;
  }
}

const defaultDependencies: CloseWorkflowDependencies = {
  validate: validateCloseChange,
  archive: (root, args) => {
    runOpenSpec(args, { cwd: root, stdio: "inherit" });
  },
  index: writeIndex,
  check: checkProject,
};

export function closeChange(
  projectRoot: string,
  changeId: string,
  options: { skipSpecs: boolean },
  dependencies: CloseWorkflowDependencies = defaultDependencies,
): CloseWorkflowResult {
  const validation = dependencies.validate(projectRoot, changeId);
  if (validation.diagnostics.length > 0) {
    throw new CloseWorkflowError(
      `Closeout validation failed for ${changeId}; archive was not attempted.\n${formatDiagnostics(validation.diagnostics)}`,
      false,
      validation.diagnostics,
    );
  }

  const archiveArgs = [
    "archive",
    changeId,
    ...(options.skipSpecs ? ["--skip-specs"] : []),
    "--yes",
    "--json",
  ];
  dependencies.archive(projectRoot, archiveArgs);

  try {
    dependencies.index(projectRoot);
    dependencies.check(projectRoot);
  } catch (error) {
    const reason = error instanceof Error && error.message.trim() !== ""
      ? error.message
      : String(error);
    throw new CloseWorkflowError(
      `Change ${changeId} was archived, but finalization failed: ${reason}. Run workflow index and workflow check to recover.`,
      true,
    );
  }

  return { changeId, archived: true };
}

function formatDiagnostics(diagnostics: readonly CloseoutDiagnostic[]): string {
  return diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`).join("\n");
}
