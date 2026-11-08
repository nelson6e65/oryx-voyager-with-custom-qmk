# Repository guidelines

Guidance for any AI agent working in this repository; Claude Code reads it through the `CLAUDE.md` symlink. Everything else is written once elsewhere:

- [README.md](./README.md) — what the firmware does, how a layout's folder is organized, and the day-to-day flow.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — prerequisites, commands and every convention.
- [docs/building.md](./docs/building.md) and [docs/flashing.md](./docs/flashing.md) — building the firmware and flashing it.
- `layouts/<keyboard>/<layout_id>/README.md` — the layers and combos of each layout.

Read CONTRIBUTING.md before changing anything; the rules below are on top of it, not instead of it.

## Rules for agents

- **Never create commits or push without the user's explicit confirmation.** Prepare the changes, show a summary and the proposed commit message, and wait — every time, including follow-up fixes within the same session.
- **Never commit on `main`.** If you are on it with work to commit, create the branch first.
- **Never skip or silence a check — resolve it.** No `--no-verify`, `git commit -n` or `HUSKY=0`, no disabling a lint rule, no `@ts-expect-error` or `any`. Fix the cause; if the rule itself looks wrong, stop and ask — loosening it is the user's call.
- **Force-push only to a branch of your own**, always with `--force-with-lease` and with the user's confirmation.
- **Everything that leaves this checkout stands on its own.** Pull request titles and descriptions, commit messages, repository documents and the code comments you add name only what is in Git: no git-ignored file, no local path, no other or private project, no numbered rule or section of a document outside the repository. `commitlint` and the `pull-request` skill reject the patterns met so far, but the rule is wider than the checks.
- **A commit message or a pull request describes the change and nothing else**: what changes and why, for a reader who was not in the conversation. Nothing about how the change came about, nothing left for later, no plans, no history of the session.
- **Pull requests are opened and edited only through the `pull-request` skill** (`.agents/skills/pull-request/`), never with `gh pr create` or `gh pr edit` directly.
- **The code never names this file, nor any AI tool.** Code, comments, configuration and workflows cite CONTRIBUTING.md when they need a convention.
- **Never edit the files Oryx generates, nor rewrite the published history of `main` or `oryx`.**
- **Flashing the keyboard is the user's step.** Build with `scripts/build.sh` and hand over the `.bin`; never run `zapp update` or `zapp flash` with an Oryx URL, which install Oryx's build without the custom code.
- **Nothing is done until `nub run lint` passes and, when the firmware changed, `scripts/build.sh` builds it.** Report what actually happened: if a check fails or was skipped, say so with its output.
- **Adding a dependency, a tool or a workflow is a design decision**: propose it and wait.
- When something in the code contradicts a design decision, say so instead of picking one side silently.
