# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each script carries its **own** `@version` and is versioned independently —
there is no repository-wide version number, because each `.user.js` is a separate
install unit that users update on its own schedule.

Entries are grouped by script. Within a release, use the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories: `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added

- Repository scaffolding: contribution guide, code of conduct, security policy,
  issue and pull request templates, and two CI lint gates.
- `automerge` workflow: dependabot's and the owner's pull requests are merged
  by the ismailkattakath-ci GitHub App once both required checks pass.

## github-pulls-running-checks

### [2.5.0] - 2026-09-14

#### Added

- **A teardown contract.** The script registered none, so a second injection
  left two listeners, two tickers and a duplicate section. It now registers
  `window.__nixGhChecksTeardown`, calls any previous one at entry, and never
  early-returns on an "already init" flag. One `AbortController` removes the
  capture listener and cancels in-flight fetches; a `torn` guard is checked
  inside both fetch continuations, because a `.then()` outlives the teardown
  that cancelled it and would otherwise re-stamp a clock onto a removed
  section. Verified live on `elastic/kibana` with real running CI: a second
  and third injection still produced one section, one sheet and two intervals,
  and a teardown taken with a card open returned it to its exact stock byte
  count with zero timers left.

#### Fixed

- The self-expiring watch interval left a stale id behind instead of clearing it.

#### Notes

- Audited for the public listing: **same-origin, path-relative requests only,
  no token, no `@connect`** - the only `api.github.com` strings in the file are
  comments saying it is deliberately not used. Requests are cached (10s TTL)
  and deduped, and only ever originate from a hover; re-hovering the same pull
  request fired zero requests.
- Known limit, measured and documented in the header rather than fixed here:
  the elapsed clock covers GitHub Actions jobs only. A third-party check links
  with `?check_run_id=`, which the id read misses, so its row renders with name
  and glyph but no clock - clean degradation. Widening it is a behaviour change
  and belongs in its own version.

<!--
When you publish a script, follow this shape:

## script-name

### [1.1.0] - YYYY-MM-DD

#### Fixed

- What broke, and the measurement that proved it. Link the issue.

### [1.0.0] - YYYY-MM-DD

#### Added

- Initial release.
-->
