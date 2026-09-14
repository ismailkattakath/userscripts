# Contributing

Thanks for considering a contribution. This document is the whole working
method — read the section that matches what you are doing.

- [Quick start](#quick-start)
- [Repository shape](#repository-shape)
- [The metadata block](#the-metadata-block)
- [Which fork does my script go to?](#which-fork-does-my-script-go-to)
- [The `@version` trap](#the-version-trap)
- [Measure the live page — never guess a selector](#measure-the-live-page--never-guess-a-selector)
- [Lint gates](#lint-gates)
- [Adding a new script](#adding-a-new-script)
- [Commit and PR conventions](#commit-and-pr-conventions)

## Quick start

```bash
git clone https://github.com/ismailkattakath/userscripts.git
cd userscripts
npm install          # devDependencies only — eslint and its userscript plugin
npm run lint         # both gates
```

There is **no build**. `npm install` exists solely to run the linters.

## Repository shape

```
.
├── <name>.user.js          one install unit per file, at the repo root
├── eslint.config.mjs       flat config, correctness + metadata rules
├── scripts/meta-lint.mjs   Greasy Fork publish-readiness checks
└── .github/workflows/      CI runs both gates on every PR
```

**One `.user.js` per install unit, at the root.** No `src/`, no `dist/`, no
bundler. The file that is committed is the file that runs; a reviewer reading the
diff is reading exactly what a user will execute. Do not introduce a build step
without opening an issue first — it changes the security properties of the whole
repository.

## The metadata block

Every script opens with a `// ==UserScript== … // ==/UserScript==` block. It is
metadata, not JavaScript, and both linters parse it.

### Required keys

| Key | Why |
|---|---|
| `@name` | Greasy Fork requires it |
| `@namespace` | Disambiguates scripts that share a name |
| `@version` | Dotted-numeric and **monotonic** — see below |
| `@description` | Greasy Fork requires it |
| `@license` | **MIT**, to match the repository |
| `@match` | Prefer over `@include`; `@include` takes no origin and over-matches |
| `@homepageURL` | Attribution — points at this repository |
| `@supportURL` | Where bugs go — points at this repository's issues |

### Banned keys

| Key | Why |
|---|---|
| `@downloadURL` | Stripped on upload by Greasy Fork. Pointed at a repo, it lets a push to `main` mutate every installed copy with no review. |
| `@updateURL` | Same. |
| `@installURL` | Same. |

This is enforced in CI. A PR that adds any of them fails.

### Other hard rules

- **Longest line ≤ 500 characters.** Greasy Fork reads longer lines as
  minified/bundled code and rejects the upload.
- **Vendored code needs a source URL within 5 lines of it.** Inline a library
  only when you must, and say where it came from.
- **No selectors built from ephemeral, tool-generated ids.** They evaporate on
  reload, so the script dies silently after the session it was written in.

## Which fork does my script go to?

[Greasy Fork](https://greasyfork.org) and [Sleazy Fork](https://sleazyfork.org)
are the **same application, same account, same rulebook** — Sleazy Fork exists
because advertisers will not sit next to adult content, so it is hidden from the
main site by default.

| Your script targets | Publish to |
|---|---|
| Any ordinary site | **Greasy Fork** |
| An adult site | **Sleazy Fork** |

Uploading an adult-site script to Greasy Fork gets it rejected or relocated.
Pick the right one up front. Record which in the README catalogue table.

## The `@version` trap

**This has bitten this project more than once. Read it.**

- **Bump `@version` in the same commit as any behaviour change.** A re-install at
  the same version is a **silent no-op** — the right code, the wrong browser, and
  nothing anywhere says so.
- **Violentmonkey never downgrades.** If a test build ever pushed a higher version
  into its database, jump *past* that number. Never reuse one.
- Greasy Fork rejects versions it cannot order. Use dotted-numeric
  (`1.4.0`, `2.0.0`), not `v1.4` or `1.4-beta`.

CI fails a PR that changes a `.user.js` without raising its `@version`.

## Measure the live page — never guess a selector

A selector that was not verified against the live page is a guess, and guesses
rot silently. Before you write one:

1. Open the target page **with every userscript disabled** — otherwise you are
   measuring your own output, not the site.
2. Confirm your selector matches **exactly** the node count you intend.
3. Confirm it does not rely on a generated class name.
4. Note the date you measured in the script's header comment.

A header comment asserting behaviour the code does not perform is a **defect**,
not stale documentation. Update the comment and the measurement together.

## Lint gates

Two gates, both run in CI on every pull request:

```bash
npm run lint:eslint   # correctness + metadata block validity
npm run lint:meta     # Greasy Fork publish-readiness
npm run lint          # both
npm run lint:fix      # auto-fix what can be auto-fixed
```

**Run `npm run lint:fix` before you push.** The metadata block has an enforced
alignment (`userscripts/align-attributes`) and requires a blank line before the
code (`userscripts/metadata-spacing`). Both are mechanical and both auto-fix, so
there is no reason to hand-align anything or to argue about it in review:

```
// ==UserScript==
// @name         Example
// @namespace    kattakath.com
// @version      1.0.0
// ==/UserScript==

(() => {
```

**1. ESLint** — `no-undef`, `no-unused-vars`, `eqeqeq`, `prefer-const` and
friends, plus [`eslint-plugin-userscripts`](https://github.com/Yash-Singh1/eslint-plugin-userscripts)
for metadata-block validity (`@grant` arguments, header names, `@match` shape).

Globals are **listed by hand** in `eslint.config.mjs` rather than pulled from the
`globals` package. The list documents exactly which platform APIs these scripts
depend on, and `@grant`-ed manager APIs are separate — an ungranted API is
`undefined` at runtime and `no-undef` should say so. If your script needs a
global that is not listed, add it **with a comment naming the script and the
reason**.

**2. Meta lint** — the Greasy Fork rules ESLint does not cover: the required key
set, the banned keys, the 500-character line cap, and version monotonicity.

## Adding a new script

1. **Measure the live page first.** See above.
2. Create `<name>.user.js` at the repo root. `@homepageURL` and `@supportURL`
   point at this repository.
3. Add a row to the README catalogue table, including which fork it publishes to.
4. Add a `CHANGELOG.md` entry under `## [Unreleased]`.
5. Run `npm run lint` — both gates must pass.
6. **Exercise the site's primary actions.** Geometry proves a control is
   *present*, never that it *works*. Click through every primary action on the
   redesigned page before opening the PR.
7. Confirm the failure mode: break your own selector on purpose and check the
   page renders **stock**, not mangled.

## Commit and PR conventions

- **Subject line**: `<script-name>: what changed` — e.g.
  `thumbwall: fix xhamster's new id scheme`. For repo-wide changes use a scope
  like `ci:`, `docs:` or `lint:`.
- **Body**: explain *why*, and include the measurement if you changed a selector.
  "What" is visible in the diff; "why" is not.
- **One logical change per PR.** A selector fix and a redesign are two PRs.
- Fill in the pull request template. The checklist is the review criteria.
- By contributing you agree your work is licensed under the MIT Licence.

### How pull requests get opened and merged

Nobody presses either button. The `automerge` workflow acts as the
**ismailkattakath-ci** GitHub App:

- **push a branch** (any name but `main`) and the bot **opens the pull request**
  from the head commit's message - first line as title, the rest as body;
- when `main`'s ruleset is satisfied (both required checks green:
  `eslint + meta`, `node --check`; every review thread resolved) the bot
  **squash-merges** it and deletes the branch;
- dependabot's pull requests are merged the same way.

Only pull requests authored by the two bots are auto-merged. A pull request
opened by a person is reviewed and merged by a maintainer once its checks pass.

"Up to date with `main`" is deliberately **not** required. CI is one linter on
one file with no runtime dependencies, so the only thing a stale branch can hide
is two pull requests bumping `@version` to the same number - which the push to
`main` lint run reports. A real conflict still blocks the merge; GitHub's
three-way merge, not check colour, is the gate.
