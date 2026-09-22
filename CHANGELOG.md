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

## youtube-share-to-metube

### [2.0.0] - 2026-09-22

Moved in from a scratch directory and rebuilt to this repository's rules. The
`@version` continues the 1.x line it arrived on, jumped a major because the
control it takes over changed.

#### Changed

- **It takes over Share, not Save.** Measured 2026-09-22 on a watch page: at
  ~1378px Save sits in `#flexible-item-buttons`, and at 758px that container is
  **empty** - Save is not hidden but absent, materialising only inside the `⋯`
  popup. A one-click control cannot be one that vanishes at some window widths.
  Share held `#top-level-buttons-computed` at both widths, so Share is the
  anchor. The old "pin Save into second place" code is gone with it: it assumed
  a node that is no longer there.
- **The anchor is the icon path, not `aria-label`.** The old version matched the
  accessible name against `"Save"`/`"Save to playlist"`, which this repository
  bans because it is localised - the script was a silent no-op on any non-English
  UI. It now matches the share glyph's `d`, which reads the same in every locale.
  Counted the same day: 6 nodes carry that path document-wide (the bar plus each
  sidebar `⋮` menu) and exactly **1** inside
  `ytd-watch-metadata #actions ytd-menu-renderer`, so the scope is load-bearing.
- **The chip uses YouTube's red token, not `#FF0000`.** The logo red is not this
  palette's red: the masthead's notification badge computes to `rgb(225, 0, 45)`,
  declared on `<html>` for both themes as
  `--yt-sys-color-baseline--red-indicator`. Binding to the token tracks the
  palette; the hex is the fallback only. Glyph and label keep YouTube's own
  colours.
- **`@namespace`, `@homepageURL` and `@supportURL` point at this repository**
  rather than at MeTube's, and `@author`/`@license` were added.

#### Fixed

- **A rejected add no longer reports success.** MeTube answers a refused URL with
  **HTTP 200** and `{"status": "error"}` in the body (measured against the live
  instance, 2026-09-22), so the old status-code test flashed "Sent" on an add
  that had just failed. The body decides now, and an unparseable body counts as a
  failure - it means something other than MeTube is answering on that port.
- **Teardown actually tears down a previous copy.** The old file assigned its own
  `teardown` to `window` and then called it immediately, which undid nothing:
  the handle it needed was the *previous* copy's. Entry now calls whatever is
  already on `window`, and every listener goes through one `AbortController`.
- **The hover tooltip no longer says "Share".** YouTube's tooltip is not the
  `title` attribute - one `<yt-tooltip>` hangs off `<ytd-app>` and is reused by
  every control, refilled from YouTube's own data on hover. It is corrected while,
  and only while, our button is hovered or focused.

#### Removed

- **`@match https://m.youtube.com/watch*`.** The mobile DOM was never measured,
  and on a phone `127.0.0.1` is the phone - the request could never reach the
  machine running MeTube. A match that cannot work only looks supported.
- `download_type` from the request body; verified not required.

#### Notes

- Verified live on a watch page, 2026-09-22: the scoped anchor matched exactly
  one button; the chip rendered `rgb(225, 0, 45)`, identical to the notification
  badge; a capture-phase click was intercepted with **zero** share dialogs
  opened; and restoring put the glyph, label, `aria-label`, `title` and inline
  style back, after which the native share sheet opened on the next click.
- The MeTube leg is exercised by the script's own `GM_xmlhttpRequest`, which only
  a userscript manager can provide. The endpoint contract itself - `/add`
  accepting `url`/`quality`/`format`/`auto_start`, and its 200-with-error
  behaviour - was measured directly against the running instance.

## civitai-declutter

### [1.24.0] - 2026-09-14

#### Added

- **A teardown contract.** The script registered none. It now registers
  `window.__nixCivitaiDeclutterTeardown`, calls any previous one at entry, and
  never early-returns on an "already init" flag. Every listener - including the
  bootstrap ones - goes through one `AbortController`; the observer, both rAF
  ids and the viewer's `IntersectionObserver` are held and cancelled; the
  stylesheet handle is captured (with an exact-text fallback for a manager that
  returns nothing from `GM_addStyle`); and the two irreversible DOM moves - the
  relocated scroll bar and the removed footer - now record parent and next
  sibling and are put back. Marks are stripped before nodes go home, because a
  detached home is unreachable from `querySelectorAll`.
- Verified live: three copies injected back to back left **live** observers flat
  at two (ours plus the site's), one docked bar and one stylesheet; teardown
  restored 18 of 19 geometry and colour probes to stock on `/images` and a model
  page. The 19th is the site's bottom ad rail re-serving a taller creative into a
  hidden box - reproduced with the script absent, so it is not ours, and it is
  documented where it would otherwise be mistaken for a leak.

#### Notes

- The `body` + `subtree` observer was **measured and kept**, against doctrine's
  default, with the evidence written into the file. Narrowing to `#main` removes
  61% of mutation records and **0% of sweeps**: the virtualiser dirties the feed
  on the same frames the ad stack dirties `<body>`, and the rAF coalescer already
  collapses both. Cost is 77ms across 5.2s of hard scrolling, and an idle feed
  costs zero sweeps - the old comment claiming "one sweep per frame" was simply
  wrong and has been corrected.
- Follow-up recorded, not fixed here: the navigation gear is anchored on
  `aria-label="Customize navigation"`, which is localised and therefore matches
  nothing on a non-English UI. It cannot be re-anchored from a signed-out
  session, where no gear renders at all.

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
