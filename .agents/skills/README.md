# Agent skills

This folder holds [agent skills](https://skills.sh): instruction sets, each with the scripts it needs, that AI coding agents load on demand. They are written in the universal format and committed here; Claude Code reads them through the committed `.claude/skills` symlink (`../.agents/skills`), other agents read this folder directly, and nothing is copied per agent.

A skill is a directory with a `SKILL.md` (frontmatter `name` and `description`, then the instructions) and, when it needs them, `scripts/` or `references/`. Scaffold a new one with `nubx skills init <name>`, then write it. The skills are formatted and linted with the rest of the repository.

The rules the skills implement are the ones in [AGENTS.md](../../AGENTS.md); a skill is the procedure, never the only place a rule is written.
