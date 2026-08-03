import { runOpenSpec } from "./openspec-cli";
import { checkProject, writeIndex } from "../scripts/openspec-governance";

export interface CloseWorkflowDependencies {
  validate: (root: string, changeId: string) => void;
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

  constructor(message: string, archived: boolean) {
    super(message);
    this.name = "CloseWorkflowError";
    this.archived = archived;
  }
}

const defaultDependencies: CloseWorkflowDependencies = {
  validate: (root, changeId) => {
    runOpenSpec(["validate", changeId, "--strict"], { cwd: root, stdio: "inherit" });
  },
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
  dependencies.validate(projectRoot, changeId);

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
