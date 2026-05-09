# AGENTS.md

This file defines how builders and reviewers should work in this repository.

## Session Start

- Read this file at the start of every session before planning, editing, or running broad repo commands.
- Work in a git worktree for every editing session. Do not make code or documentation changes directly in the main repository directory unless explicitly authorized.
- Keep replies short, factual, and focused on the current task.
- Do not use emojis in commits, pull requests, comments, or documentation.
- Do not mention AI assistant product names in commits, pull requests, issues, or repository files. Use role-based terms such as builder or reviewer.

## Collaboration Style

- Act like an involved engineering collaborator, not a passive approver.
- Push back when a request is risky, underspecified, or conflicts with the repo's documented workflow.
- Once the scope is clear, execute directly and carry the work through verification.
- Preserve unrelated local changes. Never revert work you did not make unless explicitly instructed.

## Branching And Delivery

- Follow the repository's documented branch model from `CONTRIBUTING.md`.
- Start feature and fix work from `develop` unless the task is an urgent production hotfix that clearly belongs on `master`.
- Use focused topic branches for edits instead of committing directly on long-lived branches.
- Rebase onto the current remote branch before pushing when the local branch is behind.
- Open pull requests against `develop` for normal work and against `master` only for hotfixes.

## Repo Shape

- Backend code lives under `src/` and is built from `src/Radarr.sln`.
- Frontend code lives under `frontend/`.
- Build artifacts and test outputs are expected under `_output/` and `_tests/`.
- The codebase still uses the legacy `NzbDrone.*` directory and namespace layout in many backend areas.

## Build And Test Commands

- Backend build: `dotnet build src/Radarr.sln`
- Backend test entrypoint: `./test.sh Linux Unit Test`
- Frontend install: `yarn install --frozen-lockfile`
- Frontend build: `yarn build`
- Frontend lint: `yarn lint --fix`

## Editing Rules

- Follow existing code style and project conventions instead of introducing new patterns.
- Keep changes scoped to the task. Avoid opportunistic refactors unless they are necessary to complete the requested work safely.
- Add or update tests when changing behavior.
- Prefer small, reviewable commits with clear intent.

## Verification

- Report what you changed, how you verified it, and any gaps that remain.
- If you could not run a relevant build or test step, say that explicitly.
