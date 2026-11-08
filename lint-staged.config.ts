import type { Configuration } from "lint-staged";

/**
 * Pre-commit (lint-staged). A single `*` glob runs every staged file through every tool, in a deterministic
 * lint-then-format order — no extension list to keep in sync.
 *
 * Both tools have to tolerate a set that includes files they don't handle, so both get
 * `--no-error-on-unmatched-pattern`: otherwise they exit non-zero when a commit stages only files outside their scope
 * (a change to the C code, say). Oxlint lints and type-checks the TypeScript (`typeCheck` in oxlint.config.ts); oxfmt
 * formats Markdown, YAML, JSON and TypeScript. Both skip the rest within a set.
 *
 * Both go in the same entry on purpose: a second entry matching the same files would run in parallel, and two tools
 * could write the same file at once.
 */
const config: Configuration = {
  "*": ["oxlint --fix --no-error-on-unmatched-pattern", "oxfmt --no-error-on-unmatched-pattern"],
};

export default config;
