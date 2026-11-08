import type { SyncRule, UserConfig } from "@commitlint/types";

import { execFileSync } from "node:child_process";

import { foreignReferences } from "./scripts/published-text.ts";

/**
 * Commit message linting — enforces Conventional Commits with a fixed scope list. See
 * https://www.conventionalcommits.org and the conventions in CONTRIBUTING.md.
 */

/**
 * Scope → required path(s). Checked against the files staged for the commit: when every staged file falls under one of
 * a scope's paths, the commit must use that scope. `qmk_firmware` is the submodule, which Git stages as a single path.
 */
const SCOPED_PATHS: Readonly<Record<string, readonly string[]>> = {
  qmk: ["qmk_firmware"],
  scripts: ["scripts/"],
  // New top-level area → add here as: <name>: ['<dir>/'],
};

/**
 * Scopes for what the keyboard does. A layout's folder holds both the source Oryx generates and the custom code, so
 * none of them can be told apart by path: they are never enforced by path.
 */
const FEATURE_SCOPES: readonly string[] = [
  // The custom Caps Word module (`custom_caps_word.c`) and its configuration in `rules.mk`.
  "caps-word",
  // A layout as a whole: its README, its layers and combos.
  "layout",
  // The source Oryx generates, which reaches `oryx` through the workflow.
  "oryx",
  // New custom feature → add it here.
];

/**
 * Cross-cutting scopes that don't map to a single directory — never enforced by path.
 */
const EXTRA_SCOPES: readonly string[] = ["agents", "ci", "contributing", "deps"];

/**
 * Scopes for work nothing outside this repository ever sees, drawn from the tables above. `feat` announces what the
 * keyboard gained, so none of these carries it; the tool scopes below are already held to the types that fit them.
 */
const INTERNAL_SCOPES: readonly string[] = ["agents", "ci", "contributing", "deps", "scripts"];

/**
 * Tool scopes for repo tooling, each restricted to the commit types that fit the tool's purpose (lint and format tools
 * → chore/style; the git hooks and the package manager → chore). Never enforced by path.
 */
const TOOL_SCOPE_TYPES: Readonly<Record<string, readonly string[]>> = {
  commitlint: ["chore", "style"],
  husky: ["chore"],
  "lint-staged": ["chore", "style"],
  nub: ["chore"],
  oxfmt: ["chore", "style"],
  oxlint: ["chore", "style"],
};

const getStagedFiles = (): string[] => {
  try {
    return execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * A scope and the paths it claims, carried together so the message below can name the paths without indexing
 * SCOPED_PATHS again.
 */
type ScopedEntry = readonly [scope: string, paths: readonly string[]];

const entryForFile = (file: string): ScopedEntry | undefined =>
  Object.entries(SCOPED_PATHS).find(([, paths]) => paths.some((path) => file.startsWith(path)));

/**
 * undefined means "no restriction": either nothing is staged, the staged files span more than one scope, or none of
 * them fall under a path this table claims.
 */
const entryForStagedFiles = (files: string[]): ScopedEntry | undefined => {
  if (files.length === 0) {
    return undefined;
  }

  const entries = files.map((file) => entryForFile(file));
  const [first] = entries;

  if (!first || entries.some((entry) => entry?.[0] !== first[0])) {
    return undefined;
  }

  return first;
};

/**
 * Enforces the scope → path mapping above for commits confined to one directory; commits spanning several directories
 * are left unrestricted. It judges what is staged, not the resulting commit: `git commit --amend` with only part of the
 * change staged is judged by that part. In CI nothing is staged, so the rule never restricts there.
 */
const scopeMatchesPath: SyncRule = ({ scope }) => {
  const expected = entryForStagedFiles(getStagedFiles());

  if (!expected) {
    return [true, ""];
  }

  const [expectedScope, expectedPaths] = expected;

  if (scope === expectedScope) {
    return [true, ""];
  }

  const paths = expectedPaths.join('", "');

  return [
    false,
    `commits confined to "${paths}" must use scope "${expectedScope}" (got "${scope ?? "<none>"}")`,
  ];
};

/**
 * Restricts each tool scope to its allowed commit types, so e.g. `chore(oxfmt): …` passes but `feat(oxfmt): …` does
 * not.
 */
const scopeAllowedForType: SyncRule = ({ scope, type }) => {
  const allowedTypes = scope ? TOOL_SCOPE_TYPES[scope] : undefined;

  if (!allowedTypes) {
    return [true, ""];
  }

  if (type && allowedTypes.includes(type)) {
    return [true, ""];
  }

  return [
    false,
    `scope "${scope}" is only allowed with the types "${allowedTypes.join('", "')}" (got "${type ?? "<none>"}")`,
  ];
};

/**
 * Keeps `feat` for the keyboard: a scope only this repository sees takes `chore`, or whichever of `build`, `ci`,
 * `docs`, `style` and `refactor` fits the change (see CONTRIBUTING.md).
 */
const featIsProductOnly: SyncRule = ({ scope, type }) => {
  if (type !== "feat" || !scope || !INTERNAL_SCOPES.includes(scope)) {
    return [true, ""];
  }

  return [
    false,
    `scope "${scope}" is internal to this repository, so it never takes "feat": use "chore", or the type that fits`,
  ];
};

/**
 * The message leaves with the merge, and its reader has only the repository: no file that is not in Git, no numbered
 * rule, or section of a document outside it (see CONTRIBUTING.md). The patterns live in `scripts/published-text.ts`.
 */
const noForeignReferences: SyncRule = ({ raw }) => {
  const problems = foreignReferences(raw ?? "");

  return problems.length === 0 ? [true, ""] : [false, problems.join("; ")];
};

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "scope-matches-path": scopeMatchesPath,
        "scope-allowed-for-type": scopeAllowedForType,
        "feat-is-product-only": featIsProductOnly,
        "no-foreign-references": noForeignReferences,
      },
    },
  ],
  rules: {
    // Keep the header short enough that GitHub does not truncate it.
    "header-max-length": [2, "always", 72],

    "scope-enum": [
      2,
      "always",
      [
        ...Object.keys(SCOPED_PATHS),
        ...FEATURE_SCOPES,
        ...EXTRA_SCOPES,
        ...Object.keys(TOOL_SCOPE_TYPES),
      ],
    ],
    "scope-matches-path": [2, "always"],
    "scope-allowed-for-type": [2, "always"],
    "feat-is-product-only": [2, "always"],
    "no-foreign-references": [2, "always"],
  },
};

export default config;
