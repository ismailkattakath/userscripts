<!--
Ported 2026-09-14 from kattakath/userscripts, which held this repository's
scripts before they were published on Greasy Fork and which has since been
deleted. Paths and repo names are updated; the doctrine and its measured
evidence are verbatim. The nix consumer it describes is gone too - nothing
materialises these scripts any more, they install from their listings.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role

Work here as a **FAANG-grade, highly experienced UI/UX designer-engineer** — deep web-platform
knowledge (CSS cascade and containment, ARIA, layout and compositing, the DOM event model) paired
with genuine **artistic taste**. The author is known for shipping **alternative experiences for
legacy web applications** as userscripts, with a large following on **greasyfork.org**,
**sleazyfork.org** and similar indexes.

What that changes about the work:

- **Design judgement is part of the job.** Don't just make the selector match — decide what the
  interface should *feel* like. Spacing, rhythm, motion, contrast, affordance and restraint are
  the deliverable, not decoration on top of it.
- **Every script is published, not private.** Assume thousands of installs on browsers, themes,
  locales and viewports you will never see. That is why the lint gate is Greasy Fork's rulebook
  and why anchors must be **ARIA roles and `href` values**, never a generated class.
  - **`aria-label` is not an anchor.** It is *localised*, so a selector built on it matches
    nothing on a non-English UI. Use `[role="navigation"]`, `a[href="./settings"]`,
    `a[href*="SignOutOptions"]`. Setting `aria-label` on a node **we** create is fine and
    expected; reading one to find a node is not.
- **You are redesigning someone else's app, uninvited.** Respect the host: reuse the site's own
  CSS and tokens wherever it already ships what is wanted, construct only what it genuinely does
  not, and **degrade to stock** rather than mangle.
- **Taste is measured, not asserted.** Geometry, contrast and hit-testing get verified on the live
  page before they ship — see "Measuring the live page" below.
- **Exercise the host's primary actions; don't just measure them.** Geometry proves a control is
  *present*, never that it *works*. v3.0.0 of `google-photos-icon-nav` passed every geometry and
  hit-test check and shipped with **search completely dead** — nobody had ever clicked it. A
  redesign is not verified until each primary action still works under a **trusted** event
  (CDP `Input.dispatchMouseEvent`, not `el.click()`). For Photos that means: open the profile
  menu, click into search and type, open an album.
- **"Minimal changes" means minimal risk surface, not minimal diff.** Deleting machinery counts
  as minimal. v4 answered a "change as little as possible" request by removing roughly half the
  file, and that was the smaller change in every sense that matters.
- **Accessibility is not optional polish.** Keep focus order, labels, `aria-expanded`, Esc and
  click-outside working; a redesign that strands a keyboard or screen-reader user is a regression
  however good it looks.

## What this repo is

Public Violentmonkey userscripts, **one `.user.js` per script at the repo root**. There is
no build, no package manager, no test runner — a userscript manager copies the file into
extension storage **verbatim**, so whatever is committed is what runs.

A `<name>.acceptance.mjs` beside a script is **data, not a runner**: page-lab owns the
runner, this repo owns the assertions. That is what keeps the sentence above true.

Consumed as a **source-only flake input** (`flake = false`) by
[`kattakath/nix-config`](https://github.com/kattakath/nix-config); this repo has no
`flake.nix` of its own.

## Commands

The linter is **not on `PATH`**. Resolve it first — a bare glob would expand to
several installed versions and pass the extras as lint targets:

```bash
lint=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts/userscript-meta-lint.sh | tail -1)

bash "$lint" .                                 # the only gate; same script CI runs
bash "$lint" google-photos-icon-nav.user.js    # single file
node --check google-photos-icon-nav.user.js    # parse check only (what the lint wraps)
```

The **acceptance spec** is the gate the linter is not — lint and geometry both passed on the
build that shipped a dead search. The runner lives in page-lab so this repo stays
runner-free; the spec beside the script is just data:

```bash
pl=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | tail -1)

node "$pl/userscript-acceptance.mjs" --repeat 3 google-photos-icon-nav.acceptance.mjs
```

Needs Chromium on `:9222` with a Photos tab on the **grid** view — an album or item view
builds a different shell. It scores 19/19 on the current build and 14/19 on 3.0.0, so it
discriminates rather than rubber-stamping. Nothing imports it and nothing ships to Greasy
Fork; the linter only walks `*.user.js`.

CI equivalent lives **outside this repo**: `checks.<system>.userscripts` in
`nix-config/modules/parts/checks.nix` runs the same linter against this repo's **pinned
rev**. A fix here is not gated until nix-config bumps the input.

## Editing rules the linter enforces

| Rule | Why |
|---|---|
| Required keys: `@name @namespace @version @description @license @match @homepageURL @supportURL` | Greasy Fork's required set + attribution/bug-reporting path |
| **Banned**: `@downloadURL` `@updateURL` `@installURL` | Stripped on upload; pointed at the repo they let a push to `main` mutate an installed copy with no review |
| `@version` dotted-numeric, **monotonic** | Greasy Fork rejects unorderable versions |
| Longest line ≤ 500 chars | Reads as minified/bundled — Greasy Fork rejects it |
| No `kapture-N` selectors | Kapture *mints* those ids; they evaporate on reload, so the script silently dies after the session it was written in |
| Vendored code needs a source URL within 5 lines | Greasy Fork attribution rule for inline libraries |

## The `@version` trap (has bitten twice)

- **Bump `@version` before asking for a re-install.** A same-version re-install is a
  **silent no-op** — right code, wrong browser, nothing says so.
- Violentmonkey **never downgrades**. If a test build pushed a higher version into its
  database, the repo must jump *past* it, not re-use the number.
- **Burned versions of `google-photos-icon-nav`** — never reuse these numbers; jump past them:

  | Version | How it was burned |
  |---|---|
  | `2.3.2` | stranded in Violentmonkey by a test build (see `15e9ec6`) |
  | `3.0.0` | installed during the v4 session; the shipped build that had a dead search |

## Design doctrine — read before touching `google-photos-icon-nav.user.js`

The script is an argument, not a pile of tweaks. The comments carry measured evidence and
dates; **preserve them** and add the measurement when you change behaviour. A comment that
asserts behaviour the code does not perform is a **defect** — v3.0.0 shipped exactly that.

**What the script does now (v4.0.0).** Full-bleed grid; the top bar reduced to the account
cluster alone and otherwise click-through; Photos' own **stock 256px labelled** nav held
off-canvas as a drawer behind a hamburger we ship; the search field plus Create / Help /
Settings **relocated into that drawer**, where they keep working.

- **Name zero Google class names.** v1.x reimplemented the rail by selector and lost to
  JSCompiler churn + `overflow-x:hidden` clipping. Every anchor is an ARIA role or an `href`.
  Verified `UNIQUE` on the live page 2026-09-12 — re-verify before trusting them:

  | Anchor | What it is |
  |---|---|
  | `div:has(> [role="main"])` | the pane Photos insets by `64px 0 0 256px`; zeroing that is the full bleed |
  | `[role="menubar"] > *:has(a[href*="SignOutOptions"])` | the account cluster — **never reparented** |
  | `[role="menubar"] > *:has(input)` | the tools group we relocate (also carries `a[href="./settings"]`) |
  | `[role="menubar"] > *:has(a[href="./"])` | the wordmark group |

- **The script lifts nothing, and must not start again.** It never reads
  `document.styleSheets` and never mutates Google's sheets. See "Rejected" below before
  reaching for that idea a fourth time.
- **`!important` is not the top of the cascade — a running animation is.** Photos runs a Web
  Animation on the nav's `transform`, and an animation outranks author-important, so
  `transform:translateX(-110%)!important` computed to identity while every other declaration
  in the same rule applied — the drawer sat open across the grid. The drawer is therefore
  off-canvas via the **`translate` longhand**, which composes with `transform` instead of
  competing for it. The tell is always the same: one declaration loses while its neighbours
  win. Check `el.getAnimations()` before believing a selector is wrong.
- **Rejected: packing the date sections (4.4.0-4.6.0).** Closing the 136px band by hiding
  the header-only sections and pulling the rest up with `translate` looks right and even
  measures right in one place — 136 to 48, holding across a 20000px scroll. It fails on the
  tree: this grid has **18** nested parents holding positioned sections, and shrinking a
  holder's contents does not shrink the holder's own box, because its parent positions that
  box by transform. So each packed holder leaves a hole the size of what was removed.
  Measured 136/136/136/136 becoming 48/48/**400**/48/**16** — two bands closed, one blown
  open to 400px. Correctness needs a recursive bottom-up pass propagating every holder's
  shrinkage into its own slot, kept in step on every scroll: Photos' layout, reimplemented.
  Do not try again without that.
- **The photo grid is virtualised — CSS can hide, it cannot reflow.** Every date section is
  absolutely positioned by a JS-computed `transform: matrix(1,0,0,1,0,N)`. Measured
  2026-09-12: hiding the month/date headings left tile positions byte-identical before, after,
  and after a resize kick. So the headings are hidden **visually** (clip-rect, so the
  accessibility tree keeps the only navigation structure a date-grouped gallery has) and the
  gaps stay. Closing them means reimplementing the virtualiser — what v1.x lost to.
- **`:has()` matches ANCESTORS — count before you hide.** `c-wiz:has(a[href*="/memory/"])`
  matched **3** nodes, the row's own ancestors included, and hiding on it would have taken the
  whole grid. The shipped anchor pairs the content test with a structural one
  (`c-wiz:has(+ [data-show-grid-memories]):has(...)`) and matches exactly 1. Always count.
- **`[data-show-grid-memories]` is a data attribute, not a JSCompiler class**, so it is a
  legitimate anchor by the same rule as an ARIA role or an href.
- **Google's popovers do not survive being moved, and the apps grid proves it.** Its panel is
  not inside the apps-only wrapper (44px, no iframe), so moving the button orphans it and the
  bar's own outside-click dismissal shuts it in the same gesture. The wrapper that *does* own
  the panel is 96px because it holds the avatar too. So the drawer's Google-apps entry is a
  **proxy**: it closes the drawer and forwards the click to the real control, which never
  moves. Panel opens top-right, where Photos puts it — stated, not hidden.
- **Do not restore focus when handing off to one of those panels.** `restoreFocus()` pulling
  focus back to the burger *dismissed* the apps grid ~400ms after it opened. `setOpen` takes
  `keepFocus` for exactly that caller. A synthetic resize was tested first and acquitted.
- **Gate rules that hide by ELIMINATION.** `> *:not(:has(X))` hides **more** as it matches
  **less** — the opposite of every other rule here, and the one shape that mangles instead of
  degrading. The bar-reduction rule is scoped under `data-nix-photos-tools="moved"`, set only
  when the tools group is provably inside our host, so a failed relocation renders **stock**.
- **Assert state from the DOM each pass, never latch it.** Photos can reclaim a relocated node
  at any time, and a latched flag keeps a blanket hide alive over a bar that has rebuilt
  itself. Check `host.contains(node)`, not merely `node.isConnected` — a node Photos took back
  is still connected, just no longer ours.
- **Teardown contract**: register `window.__nixGooglePhotosTeardown` and call any previous one
  at entry. Never early-return on an "already init" flag — that makes a re-run a silent no-op.
  Teardown must also put the **relocated node back** at its original parent and next-sibling.
- **Two-copy livelock**: a Greasy Fork install alongside a manual one. The style tag must stay
  **last in head**, but stand down when the element already last is another copy of this
  script (`data-nix-google-photos-rail`), or the two fight forever and the tab pegs.
- **Observer discipline**: `childList`-only on `head` and `documentElement`. Never `subtree`,
  never the grid — the photo grid is virtualised over a ~1.8 MB DOM. `popstate` covers
  **back/forward only**; `pushState` emits no event, so forward SPA navigation is covered by
  nothing. A bounded, self-cancelling sweep is the fallback — not a body subtree observer.
- **rAF-coalesced `resize` kick**: tile geometry *and* thumbnail request sizes come from the
  measured pane width, so Photos must be told to re-measure after the pane widens.
- **z-order is load-bearing**, not decorative: scrim `440` < nav `450` < burger `460` <
  bar `470`. The account popover renders **inside** the bar's stacking context, so the bar has
  to out-rank the drawer or the profile menu paints behind it.
- **Check overlaps in both axes.** The burger is fixed at `(8,8) 48×48`; the drawer's first row
  sits at `y 20–68`. Clear in `x`, fully overlapping in `y` — and clicking the search field
  closed the drawer until the header got `64px` top clearance. Comparing one axis is how that
  hid.
- Failure mode must always be **degrade to stock**: a renamed selector makes rules stop
  matching. Never mangle the page.

### Rejected: the breakpoint lift (v1.x–v3.0.0)

v2.x/v3.x lifted Photos' narrow-viewport `@media` block out of `document.styleSheets` and
re-served it unconditionally, muting `min-width` blocks above it with `mediaText = 'not all'`.
It produced a real 80px icon rail. **Do not bring it back.** Measured 2026-09-12 at 1512×949:

- **It kills search.** The lifted `1007px` block collapses search to a 40×40 button; a trusted
  click on that button opens nothing — both `<input>` stay `0×0` under a `display:none` parent
  and `activeElement` stays `BODY`. The collapsed button needs a narrow-viewport JS state that
  never arrives at a wide viewport, and no CSS can summon it.
- **It was never what produced the full bleed.** Shell-only CSS reaches the identical result:
  pane `0,0 1512×949`, main `0,0 1496×933`.
- **It forced the sheet mutation.** `muteAboveRail` existed only to cancel a nav overhang the
  lift itself created. Stop lifting the nav rules and the whole pass — the riskiest code in the
  file — deletes.

Recorded because it is a genuinely attractive idea that fails for a non-obvious reason. If a
future change wants the compact header back, it has to solve the dead search first.

## Measuring the live page

The doctrine says "measure first, never guess a selector" but never said *with what*. Chromium
runs with `--remote-debugging-port=9222`; everything below is already installed.

```bash
pl=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | tail -1)

bash "$pl/page-route.sh"          # FIRST — which browser route is up. Most "broken
                                  # selector" reports are an unreachable browser.
node "$pl/selector-verify.mjs" --target-id "$tid" '<sel>' ...
bash "$pl/devtools-doctor.sh"     # triage when the route is down
```

`selector-verify.mjs` returns `UNIQUE` / `AMBIGUOUS` / `DEAD` / **`GENERATED`** — that last
verdict *mechanically enforces* the no-Google-class-names rule this file states in prose. Use
it rather than eyeballing.

**Three traps, all hit for real:**

- **`--target-id` is not optional.** The default ("first page target") silently scores against
  a Violentmonkey extension page — Chromium holds three page targets here. Same selectors,
  same instant: `DEAD` without it, `UNIQUE` with it. A reader who trusts the default will
  rewrite a working selector. Get the id from `curl -s localhost:9222/json/list`.
- **Verify against a *stock* page.** Tear the script down first
  (`window.__nixGooglePhotosTeardown?.()`). `[role="menubar"] > *:has(input)` reads `DEAD`
  while the script is live — because the script already moved that node into the drawer. You
  would be measuring your own output.
- **`chrome-devtools-mcp` points at the wrong browser.** It is launched with
  `--userDataDir=…/com.operasoftware.OperaAir`. The page under test is in **Chromium on
  `:9222`**. Kapture (`mcp__kapture__*`) is also live but needs an operator click to attach a
  tab — and its `kapture-N` ids are banned (see the linter table).

**There is no generic "eval in page" tool.** page-lab ships a zero-dependency CDP client at
`scripts/lib/cdp.mjs` (`browserSocket` / `connect` / `attach`); a ~30-line wrapper over it is
the intended path, not a gap to fill with a library.

**Injecting ≠ installing.** An agent cannot install, so it verifies by `eval`-ing the IIFE body
via `Runtime.evaluate`. That differs from a real install in ways that produce **false
failures**:

- Strip the `// ==UserScript== … ==/UserScript==` block first — metadata, not JS.
- Injected at `readyState: complete`, the drawer's `transition: transform .18s` is still
  mid-flight. Measured `x: 0` at 200ms, `x: -88` at 800ms. **Poll until the value stops
  changing**; a fixed sleep races it. Same for the account popover, which grows for ~600ms —
  two equal reads are not proof it finished, require three.
- Photos' search is a **controlled** input: `value = ''` is reverted, select-all is swallowed,
  and typed text lands at the **caret**. Assert the delta, then clear via the native value
  setter plus an `input` event.
- Re-injection is exactly the two-copy livelock the teardown contract exists for, so it
  doubles as the livelock test.

## Consumers and the install reality

- `nix-config`'s `programs.ungoogledChromium.userScripts.scripts` materialises each script
  into `~/.local/share/userscripts/<name>.user.js` with a generated `index.html`.
- Nix owns the **files**; Violentmonkey owns the **database**. There is no declarative
  import on Chromium.
- **An agent cannot install a script or flip a browser toggle** — that click is the
  operator's. Ask; don't attempt it.

## Adding a script

1. Measure the live page first (`page-lab:userscript` / `userscript-author` skill, or
   `/page-lab:pick` to have the operator point at an element and get a dated, verified
   selector back) — never guess a selector. See "Measuring the live page" above.
2. New `<name>.user.js` at the repo root; `@homepageURL`/`@supportURL` point at the
   `kattakath/nix-config` repo/issues.
3. Add a row to the README table.
4. Lint, then write `<name>.acceptance.mjs` and **exercise the host's primary actions with
   trusted events** — lint and geometry both passed on the build that shipped a dead search.
5. Declare it by name in `nix-config`'s `userScripts.scripts`.
