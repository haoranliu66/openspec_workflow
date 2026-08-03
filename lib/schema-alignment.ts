import fs from "node:fs";
import path from "node:path";

type ProductArtifact = "br" | "prd" | "proposal" | "specs" | "design" | "tasks";

export interface ProductSchemaAlignmentResult {
  warnings: string[];
}

const EXPECTED: Record<ProductArtifact, string[]> = {
  br: [],
  prd: ["br"],
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

function topLevelBlock(schema: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*$`, "m").exec(schema);
  if (match === null) return undefined;

  const restStart = match.index + match[0].length;
  const rest = schema.slice(restStart);
  const nextTopLevel = rest.search(/\n(?=[^\s][^\r\n]*:)/);
  const end = nextTopLevel === -1 ? schema.length : restStart + nextTopLevel;
  return schema.slice(match.index, end);
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

function verifyNoH1(content: string | undefined, template: string, violations: string[]): void {
  if (content !== undefined && /^#(?!#)/m.test(content)) {
    violations.push(`${template} must not include an H1`);
  }
}

export function checkProductSchemaAlignment(root: string): ProductSchemaAlignmentResult {
  const schemaPath = path.join(root, "schema.yaml");
  const violations: string[] = [];
  if (!fs.existsSync(schemaPath)) {
    violations.push("missing schema.yaml");
  } else {
    const schema = fs.readFileSync(schemaPath, "utf8");
    (Object.entries(EXPECTED) as Array<[ProductArtifact, string[]]>).forEach(([artifact, expected]) => {
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
    if (artifactBlock(schema, "feature") !== undefined) {
      violations.push("product schema must not define feature artifact");
    }

    const apply = topLevelBlock(schema, "apply");
    if (apply === undefined) {
      violations.push("missing apply block");
    } else {
      const applyRequires = requiresFromBlock(apply);
      if (!sameArray(applyRequires, ["tasks"])) {
        violations.push("apply must require only tasks");
      }
      if (!/^  tracks:\s*tasks\.md\s*$/m.test(apply)) {
        violations.push("apply must track tasks.md");
      }
    }
  }

  const proposal = templateContent(root, "proposal.md", violations);
  verifyHeadings(
    proposal,
    "proposal.md",
    ["Why", "What Changes", "Capabilities", "Impact"],
    violations,
  );
  const design = templateContent(root, "design.md", violations);
  verifyHeadings(
    design,
    "design.md",
    ["Context", "Goals / Non-Goals", "Decisions", "Risks / Trade-offs"],
    violations,
  );
  verifyNoH1(proposal, "proposal.md", violations);
  verifyNoH1(design, "design.md", violations);
  if (design !== undefined && (!/\*\*Goals:\*\*/.test(design) || !/\*\*Non-Goals:\*\*/.test(design))) {
    violations.push("design.md must include native Goals and Non-Goals labels");
  }

  const spec = templateContent(root, "spec.md", violations);
  verifyNoH1(spec, "spec.md", violations);
  if (spec !== undefined && !spec.startsWith("## ADDED Requirements")) {
    violations.push('spec.md must begin with "## ADDED Requirements"');
  }

  const tasks = templateContent(root, "tasks.md", violations);
  verifyTasksTemplate(tasks, violations);

  if (violations.length > 0) {
    throw new Error(`product-change native alignment failed:\n${violations.join("\n")}`);
  }
  return { warnings: [] };
}

function verifyTasksTemplate(content: string | undefined, violations: string[]): void {
  if (content === undefined) return;

  for (const taskId of ["1.1", "1.2", "2.1", "2.2"]) {
    if (!new RegExp(`^- \\[ \\] ${taskId.replace(".", "\\.")}\\s+\\S`, "m").test(content)) {
      violations.push(`tasks.md must retain core task ${taskId}`);
    }
  }

  if (!/^## 3\. Team verification and close review\s*$/m.test(content)) {
    violations.push("tasks.md must include the team verification and close review section");
    return;
  }

  if (!/^- \[ \] 3\.1\s+.*`verification\.md`/mi.test(content)) {
    violations.push("tasks.md must include a change-local verification.md task");
  }
  if (!/^- \[ \] 3\.5\s+.*explicit.*close authorization/mi.test(content)) {
    violations.push("tasks.md must include explicit close authorization review");
  }
}
