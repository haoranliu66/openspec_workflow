import fs from "node:fs";
import path from "node:path";

type NativeArtifact = "proposal" | "specs" | "design" | "tasks";

export interface ProductSchemaAlignmentResult {
  warnings: string[];
}

const EXPECTED: Record<NativeArtifact, string[]> = {
  proposal: [],
  specs: ["proposal"],
  design: ["proposal"],
  tasks: ["specs", "design"],
};

function artifactBlock(schema: string, artifact: string): string | undefined {
  const marker = `  - id: ${artifact}`;
  const start = schema.indexOf(marker);
  if (start === -1) return undefined;

  const rest = schema.slice(start + marker.length);
  const nextArtifact = rest.indexOf("\n  - id: ");
  const apply = rest.indexOf("\napply:");
  const end = [nextArtifact, apply]
    .filter((index) => index !== -1)
    .reduce((nearest, index) => Math.min(nearest, index), rest.length);
  return schema.slice(start, start + marker.length + end);
}

function requiresFromBlock(block: string): string[] | undefined {
  const lines = block.split(/\r?\n/);
  const index = lines.findIndex((line) => /^\s{2,4}requires:/.test(line));
  if (index === -1) return undefined;

  const inline = lines[index].match(/^\s{2,4}requires:\s*\[(.*)]\s*$/);
  if (inline) {
    const values = inline[1].trim();
    return values === "" ? [] : values.split(",").map((value) => value.trim());
  }

  const requires: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const match = line.match(/^\s{4,6}-\s+(.+?)\s*$/);
    if (!match) break;
    requires.push(match[1]);
  }
  return requires;
}

function requirementsDescription(requires: string[]): string {
  return requires.length === 0 ? "no artifacts" : requires.join(", ");
}

function sameArray(actual: string[] | undefined, expected: string[]): boolean {
  return actual !== undefined
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function templateContent(root: string, template: string, violations: string[]): string | undefined {
  const templatePath = path.join(root, "templates", template);
  if (!fs.existsSync(templatePath)) {
    violations.push(`missing template ${template}`);
    return undefined;
  }
  return fs.readFileSync(templatePath, "utf8");
}

function hasHeading(content: string, heading: string): boolean {
  return new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(content);
}

function verifyHeadings(
  content: string | undefined,
  template: string,
  headings: string[],
  violations: string[],
): void {
  if (content === undefined) return;
  headings.forEach((heading) => {
    if (!hasHeading(content, heading)) {
      violations.push(`${template} must include heading \"${heading}\"`);
    }
  });
}

export function checkProductSchemaAlignment(root: string): ProductSchemaAlignmentResult {
  const schemaPath = path.join(root, "schema.yaml");
  const violations: string[] = [];
  if (!fs.existsSync(schemaPath)) {
    throw new Error("product-change native alignment failed:\nmissing schema.yaml");
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  (Object.entries(EXPECTED) as Array<[NativeArtifact, string[]]>).forEach(([artifact, expected]) => {
    const block = artifactBlock(schema, artifact);
    if (block === undefined) {
      violations.push(`missing ${artifact} artifact`);
      return;
    }
    const actual = requiresFromBlock(block);
    if (!sameArray(actual, expected)) {
      violations.push(`${artifact} must require only ${requirementsDescription(expected)}`);
    }
  });

  const apply = artifactBlock(schema, "apply") ?? schema.slice(schema.indexOf("apply:"));
  const applyRequires = requiresFromBlock(apply);
  if (!sameArray(applyRequires, ["tasks"])) {
    violations.push("apply must require only tasks");
  }
  if (!/^  tracks:\s*tasks\.md\s*$/m.test(apply)) {
    violations.push("apply must track tasks.md");
  }

  verifyHeadings(
    templateContent(root, "proposal.md", violations),
    "proposal.md",
    ["Why", "What Changes", "Capabilities", "Impact"],
    violations,
  );
  verifyHeadings(
    templateContent(root, "design.md", violations),
    "design.md",
    ["Context", "Goals / Non-Goals", "Decisions", "Risks / Trade-offs"],
    violations,
  );
  const tasks = templateContent(root, "tasks.md", violations);
  if (tasks !== undefined && !/^- \[ \] 1\.1(?:\s|$)/m.test(tasks)) {
    violations.push('tasks.md must include a trackable "- [ ] 1.1" item');
  }

  if (violations.length > 0) {
    throw new Error(`product-change native alignment failed:\n${violations.join("\n")}`);
  }
  return { warnings: [] };
}
