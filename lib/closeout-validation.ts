import fs from "node:fs";
import path from "node:path";

import {
  type CloseoutDiagnostic,
  type CloseoutDocument,
  type CloseoutSchema,
  parseCloseoutJson,
} from "./closeout-contract";
import { validateProductFeatureTrace } from "./closeout-feature";
import { validateEvidenceAndGates, validateTasksMarkdown } from "./closeout-p0";
import { collectDeltaRequirementIds, validateProductRequirementTrace } from "./closeout-trace";
import { runOpenSpec } from "./openspec-cli";

const CHANGE_ID = /^[a-z0-9][a-z0-9-]*$/;

export interface CloseoutValidationResult {
  changeId: string;
  schema?: CloseoutSchema;
  diagnostics: CloseoutDiagnostic[];
}

export type StrictChangeRunner = (changeId: string, projectRoot: string) => void;

export function validateCloseoutContent(projectRoot: string, changeId: string): CloseoutValidationResult {
  const active = activeChangeRoot(projectRoot, changeId);
  if (active === undefined) {
    return result(changeId, [diagnostic("CHANGE_NOT_ACTIVE", path.join(projectRoot, "openspec", "changes", changeId), "change is not an active change directory")]);
  }

  const schemaPath = path.join(active, ".openspec.yaml");
  const schema = readSchema(schemaPath);
  if (schema === undefined) {
    return result(changeId, [diagnostic("SCHEMA_UNSUPPORTED", schemaPath, "change schema must be product-change or bugfix")]);
  }

  const closeoutPath = path.join(active, "closeout.json");
  let content: string;
  try {
    content = fs.readFileSync(closeoutPath, "utf8");
  } catch {
    return result(changeId, [diagnostic("CLOSEOUT_MISSING", closeoutPath, "closeout document is missing or unreadable")], schema);
  }
  const parsed = parseCloseoutJson(content, schema, closeoutPath);
  if (parsed.document === undefined) {
    return result(changeId, parsed.diagnostics, schema);
  }

  const diagnostics: CloseoutDiagnostic[] = [];
  diagnostics.push(...validateTasks(active));
  diagnostics.push(...validateEvidenceAndGates(projectRoot, parsed.document, closeoutPath));
  if (schema === "product-change") {
    diagnostics.push(...validateProductRequirementTrace(projectRoot, active, parsed.document));
    diagnostics.push(...validateProductFeatureTrace(projectRoot, active, changeId, parsed.document));
  } else {
    diagnostics.push(...collectDeltaRequirementIds(active).diagnostics);
  }
  return result(changeId, diagnostics, schema);
}

export function validateCloseChange(
  projectRoot: string,
  changeId: string,
  runStrict: StrictChangeRunner = defaultStrictRunner,
): CloseoutValidationResult {
  if (activeChangeRoot(projectRoot, changeId) === undefined) {
    return validateCloseoutContent(projectRoot, changeId);
  }
  try {
    runStrict(changeId, projectRoot);
  } catch (error) {
    throw new Error(`Strict validation failed for ${changeId}: ${failureReason(error)}`, { cause: error });
  }
  return validateCloseoutContent(projectRoot, changeId);
}

export function parseValidateCloseArguments(args: string[]): { changeId: string } {
  if (args.length !== 1 || !CHANGE_ID.test(args[0]) || args[0] === "archive") {
    throw new Error("validate:close requires exactly one valid active change ID");
  }
  return { changeId: args[0] };
}

function activeChangeRoot(projectRoot: string, changeId: string): string | undefined {
  if (!CHANGE_ID.test(changeId) || changeId === "archive") {
    return undefined;
  }
  const candidate = path.join(projectRoot, "openspec", "changes", changeId);
  try {
    return fs.lstatSync(candidate).isDirectory() ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function readSchema(schemaPath: string): CloseoutSchema | undefined {
  let content: string;
  try {
    content = fs.readFileSync(schemaPath, "utf8");
  } catch {
    return undefined;
  }
  const match = /^schema:\s*([^\s#]+)\s*$/m.exec(content);
  return match?.[1] === "product-change" || match?.[1] === "bugfix" ? match[1] : undefined;
}

function validateTasks(changeRoot: string): CloseoutDiagnostic[] {
  const tasksPath = path.join(changeRoot, "tasks.md");
  try {
    return validateTasksMarkdown(fs.readFileSync(tasksPath, "utf8"), tasksPath);
  } catch {
    return [diagnostic("TASKS_INVALID", tasksPath, "tasks file is missing or unreadable")];
  }
}

function defaultStrictRunner(changeId: string, projectRoot: string): void {
  runOpenSpec(["validate", changeId, "--strict"], { cwd: projectRoot, stdio: "inherit" });
}

function failureReason(error: unknown): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message.split(/\r?\n/, 1)[0] : String(error);
}

function result(changeId: string, diagnostics: CloseoutDiagnostic[], schema?: CloseoutSchema): CloseoutValidationResult {
  return schema === undefined ? { changeId, diagnostics } : { changeId, schema, diagnostics };
}

function diagnostic(code: string, sourcePath: string, message: string): CloseoutDiagnostic {
  return { code, path: sourcePath, message };
}
