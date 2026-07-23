import path from "node:path";

import { OpenSpecRunner, runOpenSpec } from "../lib/openspec-cli";
import { resolveProjectRoot } from "../lib/project-root";
import { checkProductSchemaAlignment } from "../lib/schema-alignment";

export const schemas = ["bugfix", "product-change"] as const;

export function validateSchemas(
  root: string,
  run: OpenSpecRunner = runOpenSpec,
): void {
  checkProductSchemaAlignment(
    path.join(root, "openspec", "schemas", "product-change"),
  );

  schemas.forEach((schema) => {
    run(["schema", "validate", schema], {
      cwd: root,
      stdio: "inherit",
    });
  });
}

export function main(
  run: OpenSpecRunner = runOpenSpec,
  root = resolveProjectRoot(__dirname),
): void {
  validateSchemas(root, run);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === __filename) {
  main();
}
