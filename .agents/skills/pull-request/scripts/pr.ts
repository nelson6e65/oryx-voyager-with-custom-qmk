import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The title and the description of a pull request, read from a file shaped like a commit message.
 */
interface IPullRequestText {
  title: string;
  body: string;
}

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
 * A heading that announces postponed work or the story of the change, which a description does not carry.
 */
const POSTPONED_HEADING =
  /^#+\s*(?:left\b|next\b|follow[- ]?ups?\b|to[- ]?do\b|pending\b|later\b|history\b)[^\n]*/gim;

/**
 * First line the title, the rest, after a blank line, the description.
 */
const readText = (file: string): IPullRequestText => {
  const [title = "", ...rest] = readFileSync(file, "utf8").split("\n");
  return { title: title.trim(), body: rest.join("\n").trim() };
};

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

/**
 * Every path Git tracks, from the root of the repository; empty when there is no repository around.
 */
const trackedFiles = (): Set<string> => {
  try {
    const root = git("rev-parse", "--show-toplevel");
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
 */
const problemsIn = (text: string): string[] => {
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
  for (const [heading] of text.matchAll(POSTPONED_HEADING)) {
    problems.push(
      `"${heading.trim()}" announces postponed work or history; a description carries only the change`,
    );
  }
  return problems;
};

/**
 * The repository's default branch as GitHub knows it, `main` when gh cannot tell.
 */
const defaultBranch = (): string => {
  const result = spawnSync(
    "gh",
    ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
    {
      encoding: "utf8",
    },
  );
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : "main";
};

/**
 * Whether the remote knows the branch, which the base of a pull request has to be.
 */
const isOnRemote = (branch: string): boolean => {
  try {
    git("rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Pulls `--base <branch>` out of the arguments and leaves the positional ones. `null` when the flag carries no branch.
 */
const takeBase = (args: string[]): { base: string | undefined; rest: string[] } | null => {
  const flag = args.indexOf("--base");
  if (flag === -1) return { base: undefined, rest: args };
  const base = args[flag + 1];
  if (base === undefined || base.startsWith("-")) return null;
  return { base, rest: [...args.slice(0, flag), ...args.slice(flag + 2)] };
};

/**
 * Runs `gh` with the terminal attached and hands its exit code back.
 */
const gh = (...args: string[]): number => spawnSync("gh", args, { stdio: "inherit" }).status ?? 1;

/**
 * The one way a pull request's title and description reach GitHub. `pr.ts <file>` opens a pull request from the current
 * branch against the default one, `pr.ts --base <branch> <file>` against another branch of the repository, which is how
 * a stack is opened, and `pr.ts <file> <number>` rewrites the title and the description of pull request `number`. The
 * file has the shape of a commit message: the first line is the title, the rest, after a blank line, the description.
 * Both are checked before anything is sent, because a description, once published, keeps its history of edits.
 */
function main(args: string[]): number {
  const parsed = takeBase(args[0] === "--" ? args.slice(1) : args);
  if (parsed === null) {
    console.error("--base takes the branch the pull request is opened against.");
    return 2;
  }
  const [file, number] = parsed.rest;
  if (!file || (number !== undefined && !/^[0-9]+$/.test(number))) {
    console.error("Usage: pr.ts [--base <branch>] <file> [pull request number]");
    return 2;
  }
  if (parsed.base !== undefined && number !== undefined) {
    console.error(
      "--base opens a pull request; one that exists keeps the base it was opened with.",
    );
    return 2;
  }
  const { title, body } = readText(file);
  if (!title) {
    console.error(`${file}: the first line is the title and cannot be empty.`);
    return 2;
  }
  const problems = problemsIn(`${title}\n${body}`);
  if (problems.length > 0) {
    console.error("The pull request title and description must stand on their own:");
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }
  if (number !== undefined) return gh("pr", "edit", number, "--title", title, "--body", body);
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const fallback = defaultBranch();
  if (branch === fallback) {
    console.error(`Branch off ${fallback} first: pull requests are never opened from it.`);
    return 2;
  }
  const base = parsed.base ?? fallback;
  if (base === branch) {
    console.error("A pull request cannot be opened against its own branch.");
    return 2;
  }
  if (base !== fallback && !isOnRemote(base)) {
    console.error(
      `Push ${base} first (git push -u origin ${base}): GitHub opens a pull request only against a branch it has.`,
    );
    return 2;
  }
  try {
    git("rev-parse", "--abbrev-ref", "@{upstream}");
  } catch {
    console.error(
      `Push the branch first (git push -u origin ${branch}); gh would otherwise ask where to.`,
    );
    return 2;
  }
  return gh("pr", "create", "--base", base, "--head", branch, "--title", title, "--body", body);
}

process.exitCode = main(process.argv.slice(2));
