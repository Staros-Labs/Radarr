# Radarr Fork Agent Instructions

These instructions apply to automated builders and reviewers working in this repository.

## Session Startup

- Work from a git worktree, not directly in the main checkout.
- Read this file at the start of each session before making changes.
- Check `git status --short --branch` before editing.
- Assume the worktree may contain user changes. Do not revert or clean them up unless the user explicitly asks.

## Communication

- Keep updates concise and factual.
- Act like an involved collaborator, not a passive executor.
- Push back when a request is risky, underspecified, or likely to create avoidable maintenance problems.
- Use role-based language such as `builder` or `reviewer` if you need to describe automation.
- Do not use emojis in commits, pull requests, issues, comments, or docs.
- Do not mention assistant product names in commits, pull requests, comments, or repo files.

## Branch Workflow

- This fork uses `develop` as the integration branch and `master` as the production branch.
- Keep upstream-sync or vendor-tracking work separate from Staros-specific release work.
- Do not assume upstream defaults are the same as this fork's release process.

## Editing Standards

- Match the existing .NET, frontend, and GitHub Actions patterns already in the repo.
- Keep changes narrow and avoid unrelated cleanup in the same commit.
- Use `rg` for search and `apply_patch` for manual edits.
- Update docs or workflow guidance when branch behavior, release flow, or automation expectations change.

## Validation

- Run the smallest useful check for the files you changed.
- For workflow-only changes, use focused review plus `git diff --check`.
- If you cannot run a validation step, state that clearly and call out the remaining risk.
