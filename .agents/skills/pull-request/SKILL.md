---
name: pull-request
description: Open a pull request, on the default branch or stacked on another one, or rewrite the title and description of an existing one, with text that stands on its own and describes only the change. Use whenever asked to open, create, publish, update or edit a pull request or its description, or to stack one on another. Never call `gh pr create` or `gh pr edit` directly; the skill's script checks the text and publishes it.
---

# Pull request

A pull request's title and description leave with the merge and keep their history of edits on GitHub, so they are checked here, before anything is published. Everything in this skill happens in the checkout; the last step is the only one that reaches GitHub.

## 1. Before writing

- The change is committed on a branch that is not the default one, and the branch is pushed (`git push -u origin <branch>`). Both need the user's explicit confirmation if the repository's guidelines ask for it.
- Read the diff against the branch the pull request is opened against (`git diff <base>...HEAD --stat`, then the files that matter). The description is written from the diff, not from memory of the conversation.

### Whether it is a stack

A branch cut from another branch instead of from the default one is opened against that branch. GitHub then shows only the commits it adds, and moves the pull request onto the default branch by itself once the one below merges, so a stack is merged bottom first and asks nothing else of anyone.

Stack when the second change reads better after the first — it builds on what the first introduced, or its own diff would otherwise carry the first's commits — and when each still has something of its own to say: a different reason, a different risk, a reader who would review one and not the other. Two steps of a single change are one pull request. Two changes that need nothing from each other are two branches off the default one, not a stack.

The base branch is pushed too, and each description covers only its own change and never mentions the other, so both still stand on their own once merged.

Settle the order before opening any of them. GitHub refuses to change the base branch of a pull request that is already part of a stack, so a stack cannot be rearranged afterwards: closing one to reopen it against a different base leaves the ones above pointing at the closed pull request and reporting `Unable to merge as a stack` until someone unstacks them by hand. Rebasing a branch before the order is settled is what leads there. When a tool refuses, say so and stop — closing, recreating or force-pushing a published pull request to get around a refusal is the user's call, never this skill's.

Two things keep a stack from running its checks. A workflow that filters `pull_request` by target branch skips every stacked pull request, whose base is a working branch rather than a deployable one; that filter is read from the default branch, so widening it changes nothing until the widening itself is merged. And moving a pull request onto another base emits `edited`, which is not among the `pull_request` types a workflow listens to by default, so the checks only start once the branch is pushed again.

## 2. Write the text to a file

One file, shaped like a commit message: the first line is the title, then a blank line, then the description. Write it in the repository's language for published text (English unless the repository says otherwise).

- **Title**: what the change does, as a headline that stands alone in a list of changes and completes "If applied, this pull request will …" in the repository's language ([the commit-subject test](https://cbea.ms/git-commit/#imperative)). It starts with a verb, in the form the repository uses ("Fix…", «Corregir…»), because a pull request title has no type prefix to supply one. When nothing in the change reaches the product (documentation, CI, tooling), the verb says so ("Document…", «Documentar…») instead of reading like a feature. No articles that add nothing, no trailing period, no type or scope prefix. A detail that does not fit goes in the description. A repository's own rules for titles take precedence.
- **Description**: what changes and why, for a reader who was not in the conversation and has only the repository and the diff. When the change alters a design decision, the reasoning goes here.
- **Nothing else.** No account of how the change came about, nothing discussed and left for later, no plans, no next steps, no "left as is" or "left to decide" sections, no mention of earlier pull requests or of the session. A follow-up gets its own pull request when it happens.
- **Name only what is in Git.** No file that is not tracked, no section number or numbered rule of a document outside the repository: say the thing in words, or point at a file that is in the repository.

## 3. Reread before publishing

Go through the description sentence by sentence and strike every one that fails a question:

1. Could a reader verify it from the diff and the repository alone?
2. Is it about the change, rather than about the conversation, the history or the future?
3. Does every file or document it names exist in Git?
4. Does it say the rule or the reason in words, instead of leaning on a number defined elsewhere?

## 4. Publish through the script

```bash
nub <skill directory>/scripts/pr.ts <file>                   # open a pull request from the current branch
nub <skill directory>/scripts/pr.ts --base <branch> <file>   # open it against another branch, as a stack
nub <skill directory>/scripts/pr.ts <file> <number>          # rewrite the title and description of pull request <number>
```

`<skill directory>` is the directory of this file (in a repository, `.agents/skills/pull-request`). Run it with `nub`; where nub is not available, `node` runs the script as well. The script:

- checks the text for a Markdown file name that Git does not track, a numbered rule or a section number of a document, and a heading that announces postponed work, and refuses to publish when it finds one;
- refuses to open a pull request from the default branch, from a branch without an upstream, against the branch it is opened from, or against a base the remote does not have;
- only then calls `gh pr create` (against the default branch, or the one `--base` names) or `gh pr edit`.

When it refuses, rewrite the text and run it again. Never work around it with `gh` directly: a published description cannot be unpublished.

## 5. Report

Give the user the pull request URL and, in a sentence, what the description says. Nothing about the checks unless one of them rejected a first draft and the rewrite matters to the user.
