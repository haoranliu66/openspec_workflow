import type { CloseoutDiagnostic } from "./closeout-contract";

export interface MarkdownTableRow {
  cells: string[];
  line: number;
}

export interface MarkdownTableResult {
  rows: MarkdownTableRow[];
  diagnostics: CloseoutDiagnostic[];
}

export function stripFencedCode(content: string): string {
  const lines = content.split("\n");
  let fence: { character: "`" | "~"; length: number } | undefined;

  return lines.map((line) => {
    if (fence) {
      const closing = new RegExp(`^\\s*${escapeRegExp(fence.character)}{${fence.length},}\\s*$`);
      if (closing.test(line)) {
        fence = undefined;
      }
      return "";
    }

    const opening = /^\s*(`{3,}|~{3,})/.exec(line);
    if (!opening) {
      return line;
    }
    fence = { character: opening[1][0] as "`" | "~", length: opening[1].length };
    return "";
  }).join("\n");
}

export function parseSectionTable(
  content: string,
  heading: string,
  expectedHeaders: readonly string[],
  sourcePath: string,
): MarkdownTableResult {
  const lines = stripFencedCode(content).split("\n");
  const headingIndex = lines.findIndex((line) => new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`).test(line));
  if (headingIndex === -1) {
    return invalid(sourcePath, `missing section: ${heading}`);
  }

  const sectionEnd = lines.findIndex((line, index) => index > headingIndex && /^##(?:\s|$)/.test(line));
  const end = sectionEnd === -1 ? lines.length : sectionEnd;
  let headerIndex = -1;
  for (let index = headingIndex + 1; index < end; index += 1) {
    if (parseTableCells(lines[index])) {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex === -1) {
    return invalid(sourcePath, `missing table in section: ${heading}`);
  }

  const headers = parseTableCells(lines[headerIndex]);
  const separator = parseTableCells(lines[headerIndex + 1] ?? "");
  if (!headers || !sameCells(headers, expectedHeaders)) {
    return invalid(sourcePath, `unexpected table headers in section: ${heading}`);
  }
  if (!separator || separator.length !== expectedHeaders.length || !separator.every(isSeparatorCell)) {
    return invalid(sourcePath, `missing table separator in section: ${heading}`);
  }

  const rows: MarkdownTableRow[] = [];
  for (let index = headerIndex + 2; index < end; index += 1) {
    const cells = parseTableCells(lines[index]);
    if (!cells) {
      break;
    }
    if (cells.length !== expectedHeaders.length) {
      return invalid(sourcePath, `unexpected table row in section: ${heading}`);
    }
    rows.push({ cells, line: index + 1 });
  }
  return rows.length > 0
    ? { rows, diagnostics: [] }
    : invalid(sourcePath, `missing table data in section: ${heading}`);
}

function parseTableCells(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return undefined;
  }
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function sameCells(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((cell, index) => cell === expected[index]);
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell);
}

function invalid(sourcePath: string, message: string): MarkdownTableResult {
  return { rows: [], diagnostics: [{ code: "CLOSEOUT_INVALID", path: sourcePath, message }] };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
