import { execFileSync } from "node:child_process";

/**
 * A Markdown file name, wherever it stands in the text; a URL path segment does not count.
 */
const MARKDOWN_FILE = /(?<![\w./-])[\w-]+(?:\.[\w-]+)*\.md\b/g;

/**
 * A numbered rule ("rule 6", "rules 6"): the numbering of a regulation that is not in the repository.
 */
const NUMBERED_RULE = /\b[Rr]ules? [0-9]+\b/g;

/**
 * A section of an all-caps document ("SOMETHING 3.13", "SOMETHING section 6").
 */
const NUMBERED_SECTION = /\b[A-Z]{2,} (?:section [0-9]+|[0-9]+(?:\.[0-9]+)+)\b/g;

/**
 * Every path Git tracks, from the root of the repository; empty when there is no repository around.
 */
const trackedFiles = (): Set<string> => {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const listed = execFileSync("git", ["ls-files", "--full-name"], {
      cwd: root,
      encoding: "utf8",
    });
    return new Set(listed.split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
};

/**
 * Whether a file name, with or without its directory, is one of the tracked paths.
 */
const isTracked = (name: string, tracked: Set<string>): boolean =>
  tracked.has(name) || [...tracked].some((path) => path.endsWith(`/${name}`));

/**
 * Every reference in the text that a reader of the repository could not follow, as messages; empty when clean.
 *
 * Text that leaves this checkout — commit messages, pull request titles and descriptions — must stand on its own: its
 * reader has the repository and nothing else. This catches the ways that has failed so far: naming a Markdown file that
 * is not in Git, and leaning on the numbering of a document that is not in Git. Used by `commitlint.config.ts` for
 * commit messages.
 */
export function foreignReferences(text: string): string[] {
  const problems: string[] = [];
  const tracked = trackedFiles();
  for (const [file] of text.matchAll(MARKDOWN_FILE)) {
    if (!isTracked(file, tracked)) problems.push(`"${file}" is not a file of this repository`);
  }
  for (const [rule] of text.matchAll(NUMBERED_RULE)) {
    problems.push(
      `"${rule}" numbers a rule of a document that is not in this repository; say the rule in words`,
    );
  }
  for (const [section] of text.matchAll(NUMBERED_SECTION)) {
    problems.push(`"${section}" points at a section of a document that is not in this repository`);
  }
  return problems;
}
