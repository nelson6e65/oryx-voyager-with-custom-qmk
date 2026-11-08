# Contributing

How to work on this repository and the conventions every change follows. The [README](./README.md) explains what the firmware does and how a layout's folder is organized; [docs/building.md](./docs/building.md) and [docs/flashing.md](./docs/flashing.md) cover building and flashing; [AGENTS.md](./AGENTS.md) holds the rules that apply only to AI agents.

## Prerequisites

- **[Nub](https://nubjs.com)**, the only package manager here: npm, pnpm and yarn refuse to run. `nub pm pin <version>` moves its pin; keep the `nub-version` of `checks.yml` in step. Install it with `curl -fsSL https://nubjs.com/install.sh | bash`.
- **Node**, pinned in `.node-version` (`.nvmrc` links to it, for nvm and the IDEs): `nub node install` provisions it and `nub node pin <version>` moves it.
- **To build the firmware**, what [docs/building.md](./docs/building.md#requirements) lists.

## Getting started

```bash
nub install
```

It also installs the git hooks.

## Nub for everything

`nub install`, `nub run <script>`, `nubx <bin>` instead of `npx`, `nub <file.ts>` instead of `node`/`tsx`, `nub add -D <package>`.

## Layout

- `layouts/<keyboard>/<layout_id>/` — one folder per layout, with the source Oryx generates and the custom code side by side (see [How this repository works](./README.md#how-this-repository-works)).
- `scripts/` — `build.sh`, the local build, and `published-text.ts`, the check of the text that leaves the checkout.
- `docs/` — building and flashing the firmware.
- `.github/workflows/` — `fetch-and-build-layout.yml` brings the layout from Oryx, merges it into `main` and builds the firmware; `checks.yml` checks each pull request.
- `qmk_firmware/` — a submodule with ZSA's fork of QMK, checked out by the workflow and the Docker build.
- `.agents/skills/` — the [agent skills](./.agents/skills/README.md).

## Commands

- `nub run lint`: oxlint, with type checking, and `oxfmt --check`. `nub run fix:all` applies the automatic fixes; `nub run fix:format` only formats.
- `scripts/build.sh`: builds the firmware into `build/` from the working tree ([options](./docs/building.md#usage)).

## Language

**English** for everything the repository holds: code, comments, documentation, branch names, commit messages and pull requests. Existing content is corrected when it is touched, not retranslated in bulk.

## Code conventions

### C

- The custom code follows [QMK's coding conventions](https://docs.qmk.fm/coding_conventions_c), with four spaces of indentation. No formatter runs on C.
- Each custom feature lives in its own `custom_<feature>.c` file, which starts with the copyright line and `SPDX-License-Identifier: MIT`, then what the feature does and how to enable it.
- A feature is enabled and configured from lines at the top of the layout's `rules.mk` (`SRC += …` and `OPT_DEFS += -D…`), never from `config.h`.
- A QMK callback that the Oryx source already defines (`process_record_user()`, `rgb_matrix_indicators_user()`, `keyboard_post_init_user()`, `led_update_user()`) cannot be defined again: use the variant QMK offers next to it, as `custom_caps_word.c` does with `rgb_matrix_indicators_advanced_user()`.

### TypeScript

Node runs the TypeScript directly, so it uses only syntax Node can strip — no `enum`, no `namespace` — and imports local files with their `.ts` extension.

### Shell scripts

Bash, with `set -euo pipefail` and two spaces of indentation.

## Dependencies

- `nub add -D <package>`.
- `.npmrc` sets `minimum-release-age=1440`: a version published less than 24 hours ago is not installed. Do not work around it.
- Bumping oxfmt also changes how the workflow formats the Oryx source: run `nub run fix:format` in the same change.

## Linting and formatting

oxlint is the only linter: it lints and type-checks the TypeScript (`typeAware` and `typeCheck` in `oxlint.config.ts`). oxfmt is the only formatter: Markdown, YAML, JSON and TypeScript. Nothing lints or formats C or shell scripts; `.editorconfig` covers them.

The workflow formats the Oryx source before it commits it to `oryx`, so `oryx` and `main` share the same formatting and merge without conflicts. Only `keymap.json` changes.

**Never silence a check to make an error go away**: no disabling a rule, no `@ts-expect-error` or `any`. Find the cause; if a rule looks wrong, ask.

## Generated files

Never edited by hand:

- The source Oryx generates: `keymap.c`, `config.h`, `keymap.json` and the lines of `rules.mk` below the custom block. The layout changes in Oryx.
- `nub.lock`, changed only by nub.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), enforced by `commitlint` in the `commit-msg` hook: a header of at most 72 characters, body lines of at most 100, and a scope, when there is one, from `commitlint.config.ts`.

### Type

The type follows what the change affects:

- `feat` — something the keyboard does that it did not before: a custom feature, a change to the layout.
- `fix` — a defect in what the keyboard does.
- `refactor` — reorganizes the firmware code without changing what the keyboard does.
- `build` — changes how the firmware is built without touching its code: the `qmk_firmware` submodule, the `Dockerfile`.
- `ci` — the workflows.
- `chore` — what only this repository sees: the development dependencies, the git hooks, the lint and format configuration, the agent skills, the scripts.

`commitlint` rejects `feat` with a scope only this repository sees (`agents`, `ci`, `contributing`, `deps`, `scripts`).

### Subject

- **It stands alone in a list of changes.** Detail that does not fit goes in the body.
- **It completes "If applied, this commit will …"** ([the test](https://cbea.ms/git-commit/#imperative)). Every type but `fix` starts with a lowercase verb in the imperative.
- **`fix` names the defect with a noun phrase**, because the type supplies the verb: what failed, not how it is fixed, and never in the past tense.
- **No articles that add nothing.**
- **It names only what is in Git**: no file that is not tracked, no numbered rule or section of a document outside the repository. `commitlint` rejects the patterns met so far (`scripts/published-text.ts`).

```
✅ fix(caps-word): semicolon typed as colon on the Colemak layer
❌ fix(caps-word): treat KC_P as punctuation on the Colemak layer   (names the solution)
❌ fix(caps-word): Caps Word shifted the semicolon                  (narrates in the past)
✅ feat(oryx): move arrows to the right half of the nav layer
✅ build(qmk): update ZSA's QMK firmware
✅ chore(oxfmt): leave the QMK submodule out
```

### Scopes

- `qmk` and `scripts` are required when every staged file lives under `qmk_firmware` or `scripts/`.
- `caps-word`, `layout` and `oryx` are never enforced by path, because a layout's folder mixes the Oryx source and the custom code. A new custom feature gets its scope in `commitlint.config.ts`.
- `agents`, `ci`, `contributing` and `deps` cut across the repository.
- The tool scopes (`commitlint`, `husky`, `lint-staged`, `nub`, `oxfmt`, `oxlint`) only accept `chore`, and the lint and format ones `style` too.

### Commits from the workflow

The workflow commits without the hooks: `feat(oryx): <the notes written in Oryx>` for a layout change and `build(qmk): update ZSA's QMK firmware` for the submodule. Write the notes in Oryx like a subject: a lowercase verb in the imperative, in at most 60 characters.

### Git hooks

`commit-msg` runs `commitlint`, and `pre-commit` runs `lint-staged`: `oxlint --fix`, then `oxfmt`, over the staged files. Both call `nubx`: for a graphical client that does not load the shell profile, such as an IDE, set the `PATH` in `~/.config/husky/init.sh` ([Husky's startup files](https://typicode.github.io/husky/how-to.html#startup-files)).

## Branches and pull requests

- Never commit to `main` directly: branch off it with a short kebab-case name that says what the change is (`caps-word-timeout`, `colemak-semicolon`). Only the workflow commits to `oryx` and merges it into `main`.
- One pull request per change: what changes and why, and the reasoning when it changes a design decision. The title and the description name only what is in Git and describe only the change.
- The title passes the "If applied, this pull request will …" test and starts with a verb, with no type or scope: `Fix semicolon typed as colon on the Colemak layer`. When nothing in it reaches the keyboard, the verb says so: `Document …`, `Adjust the workflow …`.
- Headings in the description only when they help, and as nouns ("Summary", "Rationale", "Checks").
- A change to the firmware is built and tried on the keyboard before it merges.

### Merge method

Pull requests merge with a **merge commit** only; squash and rebase merges are disabled. That way the messages that reach `main` are the ones `commitlint` checked, while a squash writes a new one at merge time that never passes through it. A branch is brought up to date with `git rebase origin/main`.

The [`Checks`](./.github/workflows/checks.yml) workflow runs `commitlint` over the commits of each pull request, and `nub run lint`. A commit that fails is rewritten on the branch:

```bash
git rebase -i origin/main   # mark the commits as `reword`
# or turn them into one:
git reset --soft "$(git merge-base origin/main HEAD)" && git commit

git push --force-with-lease
```

Force-push only to a branch of your own.

## Non-obvious mechanics

- **oxfmt walks into nested repositories**: run from the root, or handed `qmk_firmware` by `lint-staged`, it would format the whole QMK tree. `.oxfmtrc.json` and `oxlint.config.ts` leave it out.
- **`commitlint` judges what is staged**, not the resulting commit: `git commit --amend` with only part of the change staged is judged by that part. Use `git reset --soft HEAD~1` and commit again with everything staged.
