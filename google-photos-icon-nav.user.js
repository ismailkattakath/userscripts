// ==UserScript==
// @name         Google Photos — full-bleed grid, nav in a drawer
// @namespace    kattakath.com
// @version      4.7.0
// @description  Full-bleed Google Photos: the grid takes the whole window on a black backdrop, the top bar is reduced to the account avatar, and Photos' own labelled nav is held off-canvas as a drawer holding search, Create, Help, Settings and Google apps. Memories row, date headings and the year scrubber are dropped. No breakpoint lifting, so search survives.
// @author       Ismail Kattakath
// @license      MIT
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        https://photos.google.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

// v4 is an ARCHITECTURE CHANGE, not a tuning pass. v1.x reimplemented the rail by
// selector and lost to JSCompiler churn. v2.x/v3.x lifted Photos' own narrow-viewport
// @media block out of document.styleSheets and re-served it unconditionally, which
// gave a real icon rail — and a DEAD SEARCH.
//
// Measured 2026-09-12 on the shipped v3.0.0 at 1512x949: the lifted 1007px block
// collapses search to a 40x40 button at x=1240; a trusted click on it opens nothing
// (both <input> stay 0x0 with the parent display:none), activeElement stays BODY.
// The collapsed button needs a narrow-viewport JS state that never arrives at a wide
// viewport, and no amount of CSS can summon it. So ANY design that lifts the header
// rules ships a broken search. That is not a trade worth an icon rail.
//
// v4 therefore lifts NOTHING. It never reads document.styleSheets and never mutates
// Google's sheets — collectBreakpointCss, muteAboveRail, the band constants, the
// media-condition regexes and the downgrade guard are all gone with the lift they
// served. What replaces them is measured too:
//
//   * Shell-only CSS reaches the SAME full bleed as the lift did (2026-09-12):
//     pane 0,0 1512x949, main 0,0 1496x933 — identical to the lifted result. The
//     lift was never what produced the full-bleed grid.
//   * The drawer is consequently Photos' stock 256px LABELLED nav, not an 80px icon
//     rail. Intended. A labelled drawer that opens on demand beats an icon rail that
//     is always there, and it costs nothing at rest.
//   * The top bar is reduced to the account cluster. Under v3 it was a 1318px-wide
//     click-eating strip over the grid holding ~120px of visible controls; reduced,
//     elementFromPoint at x=120/400/760/1100/1300 (y=32) returns grid content at
//     every one of them.
//   * The search field is RELOCATED into the drawer rather than hidden. Trusted
//     click at (150,44) + typed "dog" => input.value === "dog". It works there.
//
// @name WAS "icon-only nav rail" and said so for four majors, because Violentmonkey
// keys an install on @namespace + @name: renaming installs a SECOND entry beside the
// existing one — exactly the two-copy situation the last-in-head stand-down below
// exists to survive. It was corrected at 4.7.0, when the script moved to a Greasy Fork
// listing and every install became a fresh one from that page anyway; the old entry
// has to be uninstalled by hand, once. The name now describes what the script has
// actually done since the drawer landed: full-bleed grid, nav held off-canvas.
//
// Still true, and the reason this file survives Google's churn at all: NOT ONE Google
// or JSCompiler class name appears below. Every anchor is an ARIA role or an href.
// aria-label is deliberately NOT used as an anchor — it is localised, so it would
// match nothing on a non-English UI. We only ever SET aria-label, on nodes we create.
(() => {
  'use strict';

  // Undo a previous run before starting, and never early-return on an "already init"
  // flag — that turns a re-run into a silent no-op instead. Two copies of this script
  // otherwise stack observers and fight for last-in-head until the tab pegs (measured
  // 2026-09-04), which is reachable in the wild as a Greasy Fork install alongside a
  // manual one, and by any agent re-injecting the body.
  window.__nixGooglePhotosTeardown?.();

  // EVERY structural anchor in this design is a `:has()` selector. Where `:has()` is
  // unsupported those rules are dropped one by one — which would leave the drawer
  // rules (no `:has()`) applying while the pane keeps its 256px inset: a hidden nav
  // and a 256px empty gutter. That is a mangled page, not stock. So gate the whole
  // script on the feature instead of shipping a half-applied shell. Still registers a
  // teardown, so a second copy's entry call above finds one and does not throw.
  const supportsHas =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('selector(:has(*))');
  if (!supportsHas) {
    window.__nixGooglePhotosTeardown = () => {
      delete window.__nixGooglePhotosTeardown;
    };
    return;
  }

  // ---- Anchors (all verified 2026-09-12 @1512, all ARIA/href, zero class names) ----
  //
  //   pane    : matched exactly 1 node — the box Photos insets by `64px 0 0 256px` to
  //             clear the bar and the nav. Zeroing that inset is the full bleed.
  //   account : 96x48, also carries a[href*="about/products"]. NEVER reparented — see
  //             relocateSearch() below for the measurement that settled that.
  //   tools   : 1144x72, the bar child that owns the search <input> (it also carries
  //             Create / Help / a[href="./settings"]). This is the node we move.
  //
  // The wordmark group (`> *:has(a[href="./"])`, 240x64) needs no anchor of its own:
  // it is neither the account cluster nor the input owner, so the hide rule catches it
  // by elimination. That also catches any FOURTH widget Google adds to the bar later.
  const SEL_PANE = 'div:has(> [role="main"])';
  const SEL_NAV = '[role="navigation"]';
  const SEL_BAR = '[role="menubar"]';
  const SEL_ACCOUNT = '[role="menubar"] > *:has(a[href*="SignOutOptions"])';
  const SEL_TOOLS = '[role="menubar"] > *:has(input)';
  // The Google apps grid. Anchored on the href's stable path segment, not the host:
  // the domain is regional (google.ca here) and `intl/en` is localised, but
  // `about/products` is the same everywhere.
  const SEL_APPS = '[role="menubar"] a[href*="about/products"]';

  // The Memories carousel — the 1216x248 strip of "8 years ago" cards above the grid.
  // TWO conditions, and the second is not belt-and-braces decoration: measured
  // 2026-09-12, the content half ALONE (`c-wiz:has(a[href*="/memory/"])`) matched THREE
  // nodes, because `:has()` matches ancestors too and the row's own ancestors contain
  // those links — hiding on that selector would have taken the whole photo grid with it.
  // The structural half alone matched 1. Requiring both means the rule can only ever hit
  // a c-wiz that is BOTH immediately before the grid AND carries memory links, and if
  // either stops holding the row simply comes back: degrade to stock, never a blank page.
  //
  // `[data-show-grid-memories]` is a DATA ATTRIBUTE Google sets on the grid scroller
  // itself (measured: 1 node, the 889869px-tall virtualised list), not a JSCompiler
  // class, so it is a legitimate anchor by the same rule as an ARIA role or an href.
  const SEL_MEMORIES =
    'c-wiz:has(+ [data-show-grid-memories]):has(a[href*="/memory/"])';

  // The month (h1) and date (h2) headings inside the grid. Real semantic tags, so no
  // class is needed; scoped to the grid because the one h1/h2 OUTSIDE it is the
  // screen-reader hint ("Press question mark to see a list of keyboard shortcuts"),
  // which must not be touched. Measured 2026-09-12: 5 in-grid headings, all dates, and
  // the 22 select-all checkboxes that share those rows are untouched by this.
  const SEL_DATE_HEADS =
    '[data-show-grid-memories] h1,[data-show-grid-memories] h2';

  // The year scrubber down the right edge (2026 / 2025 / ... with tick dots). `role`
  // is an ARIA anchor, so no class is named — but scoped as a DIRECT CHILD of the pane
  // rather than left global, because `[role="slider"]` is a generic role Photos also
  // uses inside the item viewer and its editing tools. Measured 2026-09-12: the scoped
  // form and the global form both matched exactly 1 node here (x=1472, w=24); the scope
  // is insurance against the views this script does not sit on.
  const SEL_SCRUBBER = 'div:has(> [role="main"]) > [role="slider"]';


  const SHELL_ATTR = 'data-nix-photos-shell';
  const DRAWER_ATTR = 'data-nix-photos-drawer';
  const DRAWER_ID = 'nix-photos-drawer';
  const ON = ':root[' + SHELL_ATTR + '="on"] ';

  // A SECOND gate, for the one rule that hides by elimination (rule 3). Set only once
  // the tools group is provably sitting in our host, so the blanket hide can never
  // outlive the relocation that justifies it. See rule 3 for the failure this closes.
  const TOOLS_ATTR = 'data-nix-photos-tools';
  const ON_MOVED = ':root[' + SHELL_ATTR + '="on"][' + TOOLS_ATTR + '="moved"] ';

  // Every rule is scoped under an attribute this script sets only once all three
  // anchors above actually resolve. That is the difference between degrading to stock
  // and mangling the page, and it is specifically about ONE fail-open selector:
  // `> *:not(:has(a[href*="SignOutOptions"]))` hides MORE as it matches LESS. Rename
  // that URL — or sign the user out, where there is no account cluster at all — and an
  // ungated rule would empty the entire bar, avatar included. Gated, the whole
  // redesign stands down and Photos renders stock.
  //
  // The gate's cost is a real one and is accepted, not hidden: the shell applies a
  // frame or two after the bar exists rather than at document-start, so stock layout
  // can paint briefly first. UNMEASURED whether that is perceptible (Photos renders
  // its shell from script, so those frames have no grid in them yet). If it ever
  // proves visible, the fix is to narrow the gate to the bar rules — not to delete it.
  const SHELL_CSS = [
    // 1. Full bleed. Measured 2026-09-12 at ONE viewport, 1512x949: pane 0,0 1512x949,
    //    main 0,0 1496x933, against a stock pane of 256,64 1256x885. Stated as one
    //    viewport because that is all that was measured — an earlier draft of this
    //    comment claimed "at 1280 and 1512", which is not in the record and is
    //    self-contradicting anyway (a 1512x949 pane cannot be measured at 1280). In
    //    this file the comments ARE the evidence, so an unsourced number is a defect.
    //    If Google flattens the wrapper this stops matching and the inset comes back —
    //    stock, not broken.
    ON + 'div:has(> [role="main"]){inset:0!important}',

    // 1b. Drop the Memories carousel. Measured 2026-09-12 at 1280x800: the row is
    //     1216x248 at y=12 and the grid starts at y=260; hidden, the grid starts at
    //     y=12 — 248px of photographs reclaimed at the top of every session. `display`
    //     rather than `visibility` precisely because the space is the point.
    ON + SEL_MEMORIES + '{display:none!important}',

    // 1c. Hide the month and date headings — VISUALLY, not from assistive tech, and that
    //     distinction is free here. Measured 2026-09-12: the gap does NOT close either
    //     way. Photos absolutely-positions every date section with a JS-computed
    //     `transform: matrix(1,0,0,1,0,268)`, so tile positions were byte-identical
    //     before hiding, after hiding, and after a resize kick (372/728/728/1084/1084 in
    //     all three). The space is Google's layout model, not DOM flow, and CSS cannot
    //     reclaim it — closing those gaps would mean reimplementing the virtualiser,
    //     which is exactly what v1.x lost to.
    //
    //     So `display:none` would buy nothing a clip does not, while costing a screen
    //     reader the grid's entire heading structure — the one navigation aid a
    //     date-grouped gallery has. The clip-rect pattern leaves the accessibility tree
    //     intact and paints nothing. Operator's call, 2026-09-12: labels off, and the
    //     blank band they leave behind is understood and accepted.
    ON + SEL_DATE_HEADS +
      '{position:absolute!important;width:1px!important;height:1px!important;' +
      'overflow:hidden!important;clip:rect(0 0 0 0)!important;' +
      'clip-path:inset(50%)!important;white-space:nowrap!important}',

    // 1d. Drop the year scrubber and close the gutter it reserved.
    //
    //     Hiding the scrubber alone is NOT enough and that is measured: with it gone the
    //     grid stayed at x=16 w=1448, because the space is held by TWO separate insets
    //     that Photos keeps whether the scrubber paints or not — `[role="main"]` sits at
    //     `inset: 0 16px 16px 0` (so 1464 wide inside a 1512 pane) and then pads itself
    //     `12px 32px 0 16px`, an asymmetric 32px right against 16px left.
    //
    //     Both are overridden to ZERO on every axis — operator's call, 2026-09-12: tiles
    //     bleed to the window edge rather than sitting in Photos' gutter. Symmetric 16px
    //     was measured first (grid x=16 w=1480) and rejected in favour of edge-to-edge.
    //
    //     `width:auto` and `height:auto` are required alongside `inset:0` — the element
    //     is absolutely positioned with a COMPUTED `width:1464px`, and a stale explicit
    //     width wins over a new right edge, leaving the gutter exactly as it was. That is
    //     the whole reason this is not simply `inset:0`.
    ON + SEL_SCRUBBER + '{display:none!important}',
    ON +
      '[role="main"]{inset:0!important;width:auto!important;height:auto!important;' +
      'padding:0!important}',

    // 1e. Pure black behind the grid. Measured 2026-09-12, Photos paints its backdrop in
    //     THREE places and all three had to go or a seam shows: `body` and `[role="main"]`
    //     at #131314 (`--gm3-sys-color-background`), and the pane at #1e1f20
    //     (`--gm3-sys-color-surface-container`). Anchored on the element and the ARIA
    //     role, never a class.
    //
    //     The GM3 custom properties were the tempting lever — redefining
    //     `--gm3-sys-color-*` would cascade everywhere for free — and were rejected:
    //     `surface-container` also paints menus, dialogs and the account popover, so
    //     blackening the token would flatten those against the page they float over.
    //     Three explicit rules affect exactly the backdrop.
    //
    //     Unconditional, not gated on `prefers-color-scheme`. Photos carries its own
    //     in-app theme that does not track the OS, so a media query would miss the very
    //     case it is meant to catch. Consequence, stated rather than hidden: someone
    //     running Photos in LIGHT theme gets a black backdrop under light chrome. The
    //     operator asked for black; that is the trade.
    ON + 'body{background:#000!important}',
    ON + 'div:has(> [role="main"]){background:#000!important}',
    ON + '[role="main"]{background:#000!important}',

    // 2. The bar floats over the grid and eats no clicks. z-index 470 is load-bearing,
    //    not a round number: the account popover (iframe[name="account"], measured
    //    1068,65 424x860) lives INSIDE the bar's stacking context — its own wrapper
    //    carries z-index 991, but that is bounded by the bar's. So the bar must
    //    out-rank the drawer or the popover renders behind it. Fixed order, top down:
    //    scrim 440 < nav 450 < burger 460 < bar 470.
    //    Nothing here forces `display`. D7 measured the reduced bar with the hide rule
    //    ALONE and got the account cluster at 1400,8 96x48 — already parked at the
    //    right edge of a 1512 viewport, so Photos' own bar is already a flex line and
    //    rule 5's auto margin lands in it. Forcing `display:flex` would alter a
    //    configuration that was verified working.
    ON +
      '[role="menubar"]{position:fixed!important;top:0!important;left:0!important;' +
      'right:0!important;background:transparent!important;box-shadow:none!important;' +
      'pointer-events:none!important;z-index:470!important}',

    // 3. Reduce the bar to the account cluster. Steady state matches the measured D7
    //    result (wordmark display:none, account 1400,8 96x48) with the tools group gone
    //    from the bar entirely rather than merely hidden.
    //
    //    Gated on ON_MOVED, not ON, and that is a correctness fix rather than a tidy-up.
    //    This is the file's ONE rule that hides by ELIMINATION, and such a rule hides
    //    MORE as its anchors match LESS — the opposite of every other rule here. The
    //    `:not(:has(input))` half was originally trusted to cover that, but it only
    //    holds while the group still OWNS an input: ship a Photos whose search is a
    //    `[role="combobox"]` div or a contenteditable — a pattern already live
    //    elsewhere in Google's shell — and SEL_TOOLS matches nothing, so nothing is
    //    relocated, while `:not(:has(input))` simultaneously turns TRUE for that same
    //    bar child. Search, Create, Help and Settings would all vanish from the page
    //    with no route back: the mangle this repo's doctrine forbids, and strictly the
    //    likelier failure for a published script facing JSCompiler churn.
    //
    //    ON_MOVED is set only when the group is provably inside our host, so if the
    //    relocation never happens the hide never applies and the bar renders STOCK.
    //    Elimination is kept rather than swapped for a positive `:has(a[href="./"])`
    //    anchor because it also catches any FOURTH widget Google adds to the bar later;
    //    the gate is what makes that safe. `:not(:has(input))` stays as well, so a
    //    FRESH tools group rebuilt into the bar while the attribute is still "moved"
    //    stays visible and clickable until the next apply() re-homes it.
    ON_MOVED +
      '[role="menubar"] > *:not(:has(a[href*="SignOutOptions"])):not(:has(input))' +
      '{display:none!important}',

    // 4. Only reachable before (or instead of) relocation. Re-enabled at the DIRECT
    //    CHILD, never as an enumerated list of control types: measured 2026-09-12,
    //    enumerating `a,button,input,[role=button],[role=combobox]` left the field
    //    unclickable because the hit lands on a wrapper div that inherited `none` and
    //    the click fell through to the grid.
    ON + '[role="menubar"] > *:has(input){pointer-events:auto!important}',

    // 5. The avatar is the one control that stays in the bar. Logical margin, not
    //    `margin-left`, so an RTL locale pushes it to the correct edge.
    ON +
      '[role="menubar"] > *:has(a[href*="SignOutOptions"])' +
      '{pointer-events:auto!important;margin-inline-start:auto!important}',

    // 6. The nav becomes the drawer. `translateX(-110%)` + `visibility:hidden`, NOT
    //    `display:none`: the nav keeps its box so Photos never re-measures it as
    //    absent, the transition has something to animate, and — the accessibility half
    //    — `visibility:hidden` still removes its descendants from the tab order, so
    //    the closed drawer (search field included) cannot be tabbed into. Measured
    //    closed x=-282, open x=0, width 256, items 225-232px wide (labelled).
    //    `overflow-x:hidden;overflow-y:auto` because the relocated search row adds
    //    ~88px above a list that already filled 885px; `overscroll-behavior:contain`
    //    stops a flick at the end of the drawer from scrolling the photo grid behind.
    //
    //    NOT set here: a background. Photos' nav has never been an overlay, so it is
    //    not guaranteed to paint its own surface — but whether it does was NEVER
    //    measured (the dossier records the nav's geometry, not its background), and
    //    the fix for a guess is a measurement, not a colour invented at runtime and
    //    written onto Google's element. If the drawer ever reads as see-through over
    //    the scrim, measure the computed background first and put the finding here.
    //    Off-canvas via the `translate` LONGHAND, not `transform`, and that is a
    //    correctness fix rather than a style preference. Measured 2026-09-12: Photos runs
    //    a Web Animation on the nav's `transform` (getAnimations() -> one running effect
    //    whose keyframes carry `transform`), and an animation OUTRANKS `!important` in the
    //    cascade. While it runs, `transform:translateX(-110%)!important` computes to
    //    matrix(1,0,0,1,0,0) -- every other declaration in this same rule applied, only
    //    the transform lost -- and the drawer sat wide open across the grid. That is a
    //    mangled page, not a degrade to stock, so it cannot be left to chance.
    //
    //    `translate` is a separate longhand that composes with `transform` rather than
    //    competing for it, so Google's animation cannot touch it: measured x=-282 closed
    //    and x=0 open with their animation still pinning transform to identity. The
    //    `transform` line is kept BELOW it purely as the fallback for an engine without
    //    `translate` (CSS.supports said true here); where both work, translate decides.
    ON +
      '[role="navigation"]{position:fixed!important;top:0!important;bottom:0!important;' +
      'inset-inline-start:0!important;height:auto!important;max-height:none!important;' +
      'z-index:450!important;overflow-x:hidden!important;overflow-y:auto!important;' +
      'overscroll-behavior:contain;transform:translateX(-110%)!important;' +
      'translate:-110% 0!important;visibility:hidden!important;' +
      'transition:translate .18s ease-out,transform .18s ease-out!important}',

    // 7. RTL: `transform` has no logical form, so hide the drawer off the other edge.
    //    Ties rule 6 on specificity and wins on order; loses to rule 8, which is more
    //    specific, so the open state is direction-agnostic. Where `:dir()` is
    //    unsupported the rule is dropped and RTL simply gets the LTR animation.
    ON + '[role="navigation"]:dir(rtl)' +
      '{transform:translateX(110%)!important;translate:110% 0!important}',

    // 8. Open state. The drawer floats over photographs, so it needs its own edge —
    //    Photos' nav ships none, having never been an overlay.
    ':root[' + SHELL_ATTR + '="on"][' + DRAWER_ATTR + '="open"] [role="navigation"]' +
      '{transform:none!important;translate:none!important;visibility:visible!important;' +
      'box-shadow:0 0 28px rgba(0,0,0,.34)!important}',

    // Our own class names — the only ones in this file that are safe to write down,
    // because we mint them.
    //
    // The search host. Measured 2026-09-12: dropped into a flat flex row the group's
    // input collapses to 16x48; given its OWN full-width row it settles at 176x48 with
    // Create/Help/Settings wrapping to y=88. So the host is a full-width block and the
    // group is forced to 100% and allowed to wrap — nothing more. No `position` or
    // `transform` reset: the group may be the anchor for Photos' own suggestions
    // popover, and normalising that would misplace it for a cosmetic gain.
    // It is also the drawer's focus target (tabindex -1, set in JS), hence the
    // suppressed ring — a programmatic focus should not paint an outline.
    // padding-top clears the burger, and this is measured, not defensive. The burger is
    // fixed at (8,8) 48x48 with z-index 460; the drawer is 450, so the burger paints
    // OVER the drawer's first row. At the original 8px top padding the relocated search
    // field sat at y=20-68 and elementFromPoint at its centre returned
    // BUTTON.nix-photos-burger — clicking the search field CLOSED the drawer instead of
    // focusing the field (measured 2026-09-12, drawer open at 1512x949). Comparing x
    // alone is what hides this: the field starts at x=68, clear of the burger
    // horizontally, and overlaps it entirely in y. 64px puts the field at y=100, and
    // elementFromPoint then returns the INPUT; a trusted click plus keystrokes land in
    // it. The burger stays hit-testable at (32,32) over the open drawer, so it keeps
    // working as the close affordance.
    '.nix-photos-searchhost{display:block;box-sizing:border-box;width:100%;padding:64px 8px 4px}',
    '.nix-photos-searchhost:focus{outline:none}',
    // `:not(.nix-photos-apps)` because this rule is for the relocated GOOGLE group, and a
    // bare `> *` also caught our own proxy button — measured 2026-09-12: the 40px button
    // came out 256px wide at x=-21, i.e. stretched across the drawer and shoved
    // off-canvas, so a click aimed at it hit nothing at all. Our class is ours, so naming
    // it here is the one kind of class name this file is allowed to write down.
    '.nix-photos-searchhost > *:not(.nix-photos-apps){width:100%!important;' +
      'max-width:100%!important;min-width:0!important;margin:0!important;' +
      'flex-wrap:wrap!important}',
    // Wrapping the group alone is NOT enough, and that is measured, not assumed.
    // 2026-09-12, drawer open at 256px: the group wraps, but the flex row ONE LEVEL
    // INSIDE it stays `nowrap`, and that row is what holds the field beside the three
    // buttons — so the input still collapsed to 16px (52px with the group's padding
    // counted) and a trusted click + keystrokes landed nowhere. Wrapping that inner
    // row too takes the input to 136x48 and drops the buttons to their own line at
    // y=88. Measured alternatives that changed NOTHING on top of this, and are
    // therefore deliberately absent: forcing the group to `display:block`, and giving
    // the input a `min-width`.
    //
    // `> * > *` is depth, not identity — no class is named, so if Google flattens or
    // deepens that wrapper the rule simply stops matching and the field returns to
    // whatever width the group gives it. Degrades to cramped, never to broken.
    '.nix-photos-searchhost > *:not(.nix-photos-apps) > *{flex-wrap:wrap!important}',

    // The apps proxy. It has to sit on the SAME visual line as the Create / Help /
    // Settings buttons Photos wraps onto row two, so it is absolutely positioned against
    // the host rather than appended into Google's flex row — appending into that row
    // would make our node a child of a container Photos re-renders, and it would be gone
    // on the next pass. bottom/inset-inline-start place it after the third 40px button
    // plus the row's 12px padding; `inset-inline-start` rather than `left` so an RTL
    // locale mirrors with the rest of the drawer.
    '.nix-photos-searchhost{position:relative}',
    '.nix-photos-apps{position:absolute;bottom:8px;inset-inline-start:132px;width:40px;' +
      'height:40px;border:0;border-radius:50%;background:transparent;color:CanvasText;' +
      'cursor:pointer;padding:0;display:grid;grid-template-columns:repeat(3,4px);' +
      'grid-auto-rows:4px;gap:3px;place-content:center;justify-items:center}',
    '.nix-photos-apps:hover{background:color-mix(in srgb,CanvasText 14%,transparent)}',
    '.nix-photos-apps:focus-visible{outline:2px solid CanvasText;outline-offset:2px}',
    // Nine dots. `currentColor` so the CanvasText pairing above carries them into either
    // theme without tracking Photos' own.
    '.nix-photos-apps i{width:4px;height:4px;border-radius:50%;background:currentColor}',

    '.nix-photos-scrim{position:fixed;inset:0;z-index:440;background:rgba(0,0,0,.45);' +
      'opacity:0;pointer-events:none;transition:opacity .18s ease-out}',
    ':root[' + DRAWER_ATTR + '="open"] .nix-photos-scrim{opacity:1;pointer-events:auto}',

    // The burger. v3 painted a CanvasText glyph on a TRANSPARENT chip, which is only
    // legible over whatever happens to be behind it — and behind it is now the photo
    // grid, at full bleed, top-left. Canvas + CanvasText are the system foreground and
    // background keywords: pairing them guarantees they contrast with EACH OTHER
    // whatever the theme, which a hex pair or a lone CanvasText cannot. They track the
    // OS scheme rather than Photos' in-app one, so an OS-light/Photos-dark user gets a
    // light chip on a dark page — off-key, but still legible, which is the property
    // that matters for a control floating over arbitrary photographs. The bare
    // `background:Canvas` line before the `color-mix()` one is the fallback where
    // `color-mix()` is unsupported — opaque instead of frosted, still legible.
    // Photos' own "Main menu" button is not reusable: measured 40x40 at (20,12) under
    // the v3 lift, a trusted click left the nav transform at matrix(1,0,0,1,-281.6,0)
    // and aria-expanded at "false"; unlifted it is 0px wide. Under v3 ours sat ON TOP
    // of it — a double hamburger. Rule 3 hides the whole wordmark group that carries
    // it, so that collision is gone; keep it that way if rule 3 is ever narrowed.
    '.nix-photos-burger{position:fixed;top:8px;inset-inline-start:8px;z-index:460;' +
      'width:48px;height:48px;border:0;border-radius:50%;padding:0;cursor:pointer;' +
      'display:grid;place-items:center;color:CanvasText;background:Canvas;' +
      'background:color-mix(in srgb,Canvas 82%,transparent);' +
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
      'box-shadow:0 1px 3px rgba(0,0,0,.3)}',
    '.nix-photos-burger:hover{background:Canvas;' +
      'background:color-mix(in srgb,Canvas 94%,transparent)}',
    '.nix-photos-burger:focus-visible{outline:2px solid CanvasText;outline-offset:2px}',
    '.nix-photos-burger span{display:block;width:18px;height:2px;border-radius:2px;' +
      'background:currentColor;box-shadow:0 -6px 0 currentColor,0 6px 0 currentColor}',

    // Motion is an affordance, not decoration — but it is also a vestibular trigger.
    '@media (prefers-reduced-motion:reduce){' +
      ON + '[role="navigation"]{transition:none!important}' +
      '.nix-photos-scrim{transition:none}}',
  ].join('\n');

  const root = document.documentElement;

  let styleEl = null;
  let watchedHead = null;
  const observers = [];

  let host = null;
  let appsProxy = null;
  let moved = null;
  let movedParent = null;
  let movedNext = null;
  let moveCount = 0;
  let burger = null;
  let scrim = null;
  let navIdOwned = null;

  // A relocation budget. Measured 2026-09-12: Photos produced ZERO bar mutations in
  // the 1500ms after a move, so in practice this is spent once. It exists for the
  // version of Photos that does re-render the bar and puts a fresh tools group back:
  // without a cap, that script and this one would trade the node forever.
  const MOVE_BUDGET = 8;

  const q = (selector) => {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  };

  const isOpen = () => root.getAttribute(DRAWER_ATTR) === 'open';

  // ---- The relocation ---------------------------------------------------------
  //
  // Why move rather than restyle in place: the bar is `pointer-events:none` with one
  // live child, so a search field left in it would be a 1144px strip of dead pixels
  // over the grid; and a search field is a destination, not chrome — it belongs with
  // the navigation. Verified in the drawer with a trusted click and real keystrokes.
  //
  // Why the ACCOUNT cluster is never moved, however tidy that would be: measured
  // 2026-09-12, its avatar is an <a href="accounts.google.com/SignOutOptions?...">
  // whose popover is a delegated handler on an ancestor OUTSIDE the cluster. Reparent
  // it and the click stops opening the menu and starts navigating to sign-out — the
  // tab left the page twice while measuring. It stays exactly where Photos put it.
  const ensureHost = (nav) => {
    if (host === null) {
      host = document.createElement('div');
      host.className = 'nix-photos-searchhost';
      // -1: a focus target for an opening drawer, never a Tab stop of its own.
      host.tabIndex = -1;
    }
    // Re-prepend rather than prepend once. If Photos swaps the whole nav element the
    // host — and the relocated group riding inside it — is simply re-attached to the
    // new one, which is why the group is parked in a container we own instead of being
    // appended to Google's nav directly.
    if (host.parentNode !== nav || nav.firstChild !== host) {
      nav.insertBefore(host, nav.firstChild);
      return true;
    }
    return false;
  };

  // NO section packing, and this is a deliberate revert rather than an omission.
  //
  // 4.4.0-4.6.0 tried to close the 136px band between date groups by hiding the
  // header-only sections and pulling the rest up with the `translate` longhand. The idea
  // is sound as far as it goes — sections ARE packed contiguously, one of every pair IS
  // an 88px header band, and translate DOES survive Photos rewriting `transform`. It even
  // measured 136 -> 48 and held across a 20000px scroll.
  //
  // It fails on the shape of the tree. Measured 2026-09-12: this grid carries **18**
  // separate parents holding positioned sections, nested, not the single container the
  // first build assumed. Shrinking the contents of one holder does NOT shrink the
  // holder's own box — its parent positions that box by transform — so every packed
  // holder leaves a hole at its end exactly the size of what was removed, and the seam
  // to the next holder opens into a void. Measured gaps went 136/136/136/136 to
  // 48/48/400/48/16: two bands closed, one blown open to 400px, one crushed to 16px.
  // Worse in aggregate than the thing it fixed, and visibly so.
  //
  // Making it correct needs a recursive bottom-up pass that propagates each holder's
  // shrinkage to its later siblings and up into its own slot — which is Photos' layout
  // algorithm, reimplemented, kept in step on every scroll of a virtualised ~1.8MB DOM.
  // That is the v1.x mistake with extra steps. The 136px band stays.
  //
  // What survives from the attempt is written down where it is useful: the headings are
  // still hidden (§1c), and F-ANIMATION-BEATS-IMPORTANT in page-lab records the
  // translate-vs-transform property that made the offsets stick at all.

  const relocateSearch = (nav) => {
    const changed = ensureHost(nav);

    // Already parked. `host.contains` and not a stored flag, because the question is
    // about the live DOM: Photos may have taken the node back at any point.
    if (moved !== null && moved.isConnected && host.contains(moved)) return changed;

    // It was taken back, replaced, or detached. Forget it — do NOT try to restore a
    // node Photos now owns — and look for a fresh one in the bar.
    moved = null;
    movedParent = null;
    movedNext = null;

    if (moveCount >= MOVE_BUDGET) return changed;
    const group = q(SEL_TOOLS);
    if (group === null) return changed;

    movedParent = group.parentNode;
    movedNext = group.nextSibling;
    host.appendChild(group);
    moved = group;
    moveCount += 1;
    return true;
  };

  // Put Google's node back. Shared by the stand-down path and by teardown, because
  // both owe the page the same thing and the one outcome that is never acceptable is
  // deleting it along with our host. Original slot if it still exists, else whatever
  // menubar is live now, else leave it in the document where the drawer put it — our
  // wrapper goes, the node stays.
  //
  // `isConnected` gates the whole restore: a relocated node that is already detached
  // was discarded along with a nav Photos replaced, and Photos has since built a fresh
  // bar — putting the orphan back would give the page TWO search fields.
  const homeTools = () => {
    const node = moved;
    moved = null;
    if (node === null || !node.isConnected) {
      movedParent = null;
      movedNext = null;
      return;
    }
    const home =
      movedParent !== null && movedParent.isConnected ? movedParent : q(SEL_BAR);
    if (home !== null) {
      const before = movedNext !== null && movedNext.parentNode === home ? movedNext : null;
      home.insertBefore(node, before);
    } else if (host !== null && host.parentNode !== null) {
      host.parentNode.insertBefore(node, host);
    }
    movedParent = null;
    movedNext = null;
  };

  // ---- Open / close -----------------------------------------------------------
  //
  // No resize kick here, and no comment claiming one. v3.0.0's setOpen() carried a
  // paragraph about re-kicking so Photos would re-measure, and never called kick() —
  // caught 2026-09-12. With the lift gone the claim would be wrong even if the call
  // were there: the drawer is an OVERLAY, the pane keeps its full-bleed box whether it
  // is open or shut, so there is nothing for Photos to re-measure. The kick belongs to
  // apply(), where the pane really does go 1256 -> 1512 wide.

  // Land on the drawer's own header container, deliberately NOT on its first focusable
  // control — which, after the relocation, is the search <input>. Dropping the caret
  // into a text field hijacks typing from someone who opened the drawer to navigate;
  // from the container the very next Tab reaches search for someone who wanted it.
  const focusDrawer = () => {
    if (host === null || !host.isConnected) return;
    try {
      // preventScroll: the drawer is mid-transition, and letting the browser scroll to
      // a target inside a `translateX` would jolt the grid behind it.
      host.focus({ preventScroll: true });
    } catch {
      /* a focus() that throws is not worth failing the open for */
    }
  };

  // Only take focus back if it is still somewhere we put it. Stealing it from wherever
  // the user moved on to would be worse than leaving it.
  const restoreFocus = () => {
    const active = document.activeElement;
    if (active === null || burger === null) return;
    const nav = q(SEL_NAV);
    const inside =
      (nav !== null && nav.contains(active)) || (scrim !== null && scrim === active);
    if (!inside) return;
    try {
      burger.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  };

  // `keepFocus` exists for exactly one caller: the Google apps proxy, which closes the
  // drawer in order to hand focus to a panel Google is about to open. Taking focus back
  // to the burger there does not merely misplace it — measured 2026-09-12, it DISMISSES
  // that panel: the grid opened at 370x570 and was gone ~400ms later with activeElement
  // back on the apps anchor. Closing by attribute alone left it open and stable at 570
  // in all three orderings tried (click-only, close-then-click, click-then-close), which
  // is what isolated restoreFocus() as the cause. A synthetic resize was tested first and
  // ACQUITTED — the panel survives one — so this is a focus effect, not a layout one.
  const setOpen = (open, { keepFocus = false } = {}) => {
    if (open) root.setAttribute(DRAWER_ATTR, 'open');
    else root.removeAttribute(DRAWER_ATTR);
    if (burger !== null) burger.setAttribute('aria-expanded', String(open));
    if (keepFocus) return;
    // No focus trap, and that is a decision rather than an omission. A trap would
    // claim a modality this drawer does not have: the bar sits ABOVE the scrim at
    // z-index 470 with `pointer-events:auto` on the avatar, so the account menu is
    // still reachable by pointer while the drawer is open — a keyboard ring that
    // excluded it would be less capable than the mouse, not more correct. And the
    // field we just relocated is a combobox whose suggestions Photos may render
    // outside [role=navigation]; a capture-phase Tab handler would make them
    // unreachable and override Photos' own key handling in its own widget. What the
    // keyboard is owed is a round trip, and that is these two calls.
    if (open) focusDrawer();
    else restoreFocus();
  };

  const onKeydown = (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    // Close, but never swallow the key: Photos owns Escape elsewhere (the item viewer,
    // its own dialogs) and a capture-phase preventDefault here would break them.
    setOpen(false);
  };

  // Click-outside is the scrim's job. This is the other half: a drawer that stays open
  // after you have navigated away with it is a drawer you have to close twice.
  // Delegated on document rather than bound per link, because Photos re-renders the
  // nav's contents and per-node listeners would go stale.
  const onClick = (event) => {
    if (!isOpen()) return;
    const target = event.target;
    if (target === null || typeof target.closest !== 'function') return;
    const link = target.closest('a[href]');
    if (link === null) return;
    const nav = q(SEL_NAV);
    if (nav !== null && nav.contains(link)) setOpen(false);
  };

  // Re-appended rather than appended once, because Photos replaces body subtrees as it
  // lazy-loads views and would otherwise take ours with it.
  const ensureChrome = (nav) => {
    if (document.body === null) return false;
    let changed = false;

    if (burger === null) {
      burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'nix-photos-burger';
      // Set, never matched on. An aria-label is fine to author and fatal to anchor on.
      burger.setAttribute('aria-label', 'Toggle navigation');
      burger.setAttribute('aria-expanded', String(isOpen()));
      burger.appendChild(document.createElement('span'));
      burger.addEventListener('click', () => setOpen(!isOpen()));
    }
    if (!burger.isConnected) {
      document.body.appendChild(burger);
      changed = true;
    }

    if (scrim === null) {
      scrim = document.createElement('div');
      scrim.className = 'nix-photos-scrim';
      scrim.addEventListener('click', () => setOpen(false));
    }
    if (!scrim.isConnected) {
      document.body.appendChild(scrim);
      changed = true;
    }

    // The Google apps entry in the drawer is a PROXY, not the real control, and that is
    // the whole design. Three ways of actually moving it were measured 2026-09-12 and
    // all three are broken:
    //
    //   1. Move the <a> alone -> its popover is NOT inside the apps subtree (the apps-only
    //      wrapper is 44px and contains no iframe), so the anchor is orphaned. The click
    //      still fires, but the Google bar's own outside-click dismissal sees a target
    //      outside its root and shuts the panel in the same gesture: measured
    //      iframe[name="app"] at 370x0, visibility:hidden, still positioned at x=1122
    //      where the button used to be.
    //   2. Move the smallest wrapper that DOES own the popover -> that box is 96px wide
    //      because it holds the avatar too, so this drags the account cluster out of the
    //      bar. The panel then opens at its right size (370x570) but right-ALIGNED to an
    //      anchor now near the left edge: measured x=-400, off-screen.
    //   3. Re-anchor that panel with our own CSS -> Google's JS recomputes position on
    //      open and the dismissal keeps firing; measured 370x0 again.
    //
    // So the real control never moves. The proxy closes the drawer, then forwards the
    // click, and the panel opens exactly where Photos puts it: measured 370x570 at
    // (1122,65), hit-testable, drawer shut, no navigation. The one honest consequence:
    // the panel appears top-right, not beside the button that summoned it.
    //
    // The delay is the drawer's own transition (.18s) plus a frame — the panel measures
    // the viewport as it opens, and opening it mid-slide positions it against a layout
    // that is still moving.
    if (appsProxy === null) {
      appsProxy = document.createElement('button');
      appsProxy.type = 'button';
      appsProxy.className = 'nix-photos-apps';
      // Set, never matched on — same rule as the burger.
      appsProxy.setAttribute('aria-label', 'Google apps');
      for (let i = 0; i < 9; i += 1) appsProxy.appendChild(document.createElement('i'));
      appsProxy.addEventListener('click', () => {
        const real = q(SEL_APPS);
        // keepFocus: see setOpen — restoring focus to the burger here kills the panel.
        setOpen(false, { keepFocus: true });
        if (real !== null) window.setTimeout(() => real.click(), 220);
      });
    }
    // Only offered when the real control exists. Signed out there is no apps button at
    // all, and a proxy for nothing is a dead control.
    const realApps = q(SEL_APPS);
    if (realApps === null) {
      if (appsProxy.isConnected) {
        appsProxy.remove();
        changed = true;
      }
    } else if (host !== null && host.isConnected && appsProxy.parentNode !== host) {
      host.appendChild(appsProxy);
      changed = true;
    }

    // aria-controls needs an id, and minting one blindly is how you collide with the
    // page's own. Prefer whatever id Photos already gave the nav; only mint ours if the
    // nav has none AND nothing else in the document answers to the name. If neither
    // holds, ship the button without aria-controls — aria-expanded alone still tells a
    // screen reader the state, which is the part that matters. Re-derived every pass,
    // not latched: Photos can replace the nav, and an aria-controls pointing at an id
    // that no longer exists is worse than none at all.
    if (navIdOwned !== null && navIdOwned !== nav) {
      if (navIdOwned.getAttribute('id') === DRAWER_ID) navIdOwned.removeAttribute('id');
      navIdOwned = null;
    }
    let navId = nav.getAttribute('id');
    if ((navId === null || navId === '') && document.getElementById(DRAWER_ID) === null) {
      nav.setAttribute('id', DRAWER_ID);
      navIdOwned = nav;
      navId = DRAWER_ID;
    }
    if (navId !== null && navId !== '') {
      if (burger.getAttribute('aria-controls') !== navId) {
        burger.setAttribute('aria-controls', navId);
      }
    } else {
      burger.removeAttribute('aria-controls');
    }
    return changed;
  };

  // The dataset key is `nixGooglePhotosRail` and stays that way even though there is no
  // rail any more: a v3 copy running alongside this one recognises a rival by exactly
  // that key, and renaming it would re-arm the livelock it exists to break.
  const ensureStyle = () => {
    let changed = false;
    if (styleEl === null) {
      styleEl = document.createElement('style');
      styleEl.dataset.nixGooglePhotosRail = '';
    }
    // Re-asserted every pass, not written once: a payload some other actor empties
    // would otherwise never come back.
    if (styleEl.textContent !== SHELL_CSS) {
      styleEl.textContent = SHELL_CSS;
      changed = true;
    }

    // Ours has to stay LAST in head: Photos keeps appending <style> blocks as it
    // lazy-loads views, and while every rule here is `!important`, so are some of
    // theirs — at which point order is the tiebreak. Re-appending only when we are not
    // already last is also what stops the head observer from feeding itself.
    //
    // Stand down when the element already last is ANOTHER copy of this script. Two
    // copies — a Greasy Fork install plus a manual one, or an inject over a build too
    // old to have the teardown above — otherwise fight for the last slot forever, each
    // append waking the other's observer. Measured 2026-09-04: the tab pegs and stops
    // responding. Both copies serve the same CSS, so whichever holds the slot is right.
    const head = document.head;
    if (head === null) return changed;
    const last = head.lastElementChild;
    const rivalIsLast =
      last !== null && last !== styleEl && last.dataset?.nixGooglePhotosRail !== undefined;
    if (last !== styleEl && !rivalIsLast) {
      // Only the FIRST insertion moves a pixel. A later re-append restores order
      // without changing geometry, so it must not buy a resize kick — Photos appends
      // <style> blocks throughout its lazy-load and every one of them would otherwise
      // cost a relayout of a virtualised grid.
      if (!styleEl.isConnected) changed = true;
      head.appendChild(styleEl);
    }
    return changed;
  };

  const standDown = () => {
    root.removeAttribute(TOOLS_ATTR);
    if (!root.hasAttribute(SHELL_ATTR)) return false;
    root.removeAttribute(SHELL_ATTR);
    if (isOpen()) setOpen(false);
    // Standing down means standing ALL the way down: Google's search group goes back
    // to the bar BEFORE our host is removed, or a stock-looking page would be missing
    // its search field entirely.
    homeTools();
    if (host !== null) host.remove();
    if (burger !== null) burger.remove();
    if (scrim !== null) scrim.remove();
    return true;
  };

  const apply = () => {
    let changed = ensureStyle();

    const bar = q(SEL_BAR);
    const account = q(SEL_ACCOUNT);
    const pane = q(SEL_PANE);
    const nav = q(SEL_NAV);

    // Two states, not three, and the distinction is what stops the gate thrashing.
    //
    // DANGEROUS: a bar exists and carries no account cluster. That is the one shape
    // the fail-open hide rule would mangle, so stand the redesign down for it.
    if (bar !== null && account === null) return standDown() || changed;
    // NOT READY: an anchor is missing because the view has not built it yet. Hold
    // whatever state we are in rather than tearing the shell down and putting it back
    // — that round trip is a full stock/redesign flicker for a transient absence.
    if (pane === null || nav === null || account === null) return changed;

    // Relocate BEFORE the gate goes on, in the same task: once the attribute is set,
    // rule 3 is live, and a tools group still sitting in the bar at that instant would
    // flash from full-width search to nothing to a drawer row. Ordering it this way
    // means there is never a frame where the search field is hidden in the bar.
    if (relocateSearch(nav)) changed = true;
    if (ensureChrome(nav)) changed = true;

    // Rule 3's gate. Asserted from the DOM every pass rather than latched on the one
    // pass that moved the node: Photos can take the group back at any time, and a
    // latched flag would keep the blanket hide live over a bar that has rebuilt its
    // own controls. host.contains() — not just `moved.isConnected` — because a node
    // Photos reclaimed is still connected, just no longer ours.
    const parked = moved !== null && moved.isConnected && host !== null && host.contains(moved);
    if (parked) {
      if (root.getAttribute(TOOLS_ATTR) !== 'moved') {
        root.setAttribute(TOOLS_ATTR, 'moved');
        changed = true;
      }
    } else if (root.hasAttribute(TOOLS_ATTR)) {
      root.removeAttribute(TOOLS_ATTR);
      changed = true;
    }

    if (root.getAttribute(SHELL_ATTR) !== 'on') {
      root.setAttribute(SHELL_ATTR, 'on');
      changed = true;
    }

    return changed;
  };

  // Tile geometry AND the thumbnail request size (…=w126-h213-k-no) are computed from
  // the measured pane width, so taking the pane from 1256 to 1512 leaves the grid laid
  // out — and the images requested — for the old width until something makes Photos
  // re-measure. Coalesced into one rAF so a burst of mutations fires a single kick,
  // and fired only when apply() actually changed something: a resize event per <style>
  // Photos lazy-loads would be a re-layout storm over a ~1.8 MB DOM for nothing.
  let queued = false;
  const kick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      window.dispatchEvent(new Event('resize'));
    });
  };

  const applyAndKick = () => {
    if (apply()) kick();
  };

  // ---- When to run ------------------------------------------------------------
  //
  // childList-only on head, never `subtree` and never the grid: the photo grid is
  // virtualised and mutates continuously, so a subtree observer over this DOM would
  // fire thousands of times a scroll. Every sheet we care about arrives as a direct
  // child of head.
  const watchHead = () => {
    if (document.head === null || document.head === watchedHead) return false;
    const observer = new MutationObserver(applyAndKick);
    observer.observe(document.head, { childList: true });
    observers.push(observer);
    watchedHead = document.head;
    return true;
  };

  // A bounded sweep, because nothing else guarantees a signal at the moment the bar
  // finally renders: head mutations stop once Photos has loaded its sheets, and the
  // menubar can arrive after that. Backs off and stops — an unbounded poll on a page
  // this heavy is not a thing to leave running. Re-armed on navigation, and abandoned
  // early once the shell is up and the search field is parked.
  const SWEEP_DELAYS = [200, 500, 1200, 2500, 5000];
  let sweepIndex = 0;
  let sweepTimer = null;

  const settled = () =>
    root.getAttribute(SHELL_ATTR) === 'on' && moved !== null && moved.isConnected;

  const stopSweep = () => {
    if (sweepTimer === null) return;
    clearTimeout(sweepTimer);
    sweepTimer = null;
  };

  const stepSweep = () => {
    if (sweepIndex >= SWEEP_DELAYS.length) return;
    const delay = SWEEP_DELAYS[sweepIndex];
    sweepIndex += 1;
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      applyAndKick();
      if (!settled()) stepSweep();
    }, delay);
  };

  const armSweep = () => {
    stopSweep();
    sweepIndex = 0;
    stepSweep();
  };

  // documentElement gains ~two children in its life, so this is nearly free — and
  // unlike v3 it is never disconnected. Be precise about what that does and does not
  // buy, because v3's successor overclaimed it: `childList` here fires only if <body>
  // ITSELF is swapped, which is NOT measured and may never happen. Photos replacing
  // body's CHILDREN — which would take our burger and scrim with it — fires nothing
  // here.
  //
  // The sweep below is re-armed on `popstate`, which covers BACK/FORWARD ONLY.
  // pushState and replaceState emit no event, so a FORWARD in-app navigation is not
  // covered by anything here — say so plainly rather than implying the sweep is a
  // general recovery.
  //
  // That gap is currently theoretical, and the measurement is why it is left alone:
  // 2026-09-12, drawer opened and `./albums` clicked from inside it, then sampled at
  // 2 / 4 / 8 / 12s — path went to /u/2/albums and `.nix-photos-burger` and
  // `.nix-photos-scrim` BOTH stayed `isConnected`, the shell attribute stayed "on",
  // the drawer stayed closed at x=-282 and the pane stayed 1512 wide. So on this route
  // Photos does not replace body's children at all, and the premise inherited from v3
  // is unproven for forward navigation. If a route is ever found where our chrome does
  // disappear, the fix is one line — call armSweep() from onClick beside setOpen(false)
  // — not a body subtree observer, which is the one thing this file must never add.
  const rootObserver = new MutationObserver(() => {
    watchHead();
    applyAndKick();
    armSweep();
  });
  rootObserver.observe(root, { childList: true });
  observers.push(rootObserver);
  watchHead();

  applyAndKick();
  armSweep();
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', applyAndKick, { once: true });
  }
  window.addEventListener('load', applyAndKick, { once: true });
  // Back/forward inside the SPA can land on a view with a freshly built bar. Cheap,
  // passive, and no history patching — we re-check rather than assume.
  window.addEventListener('popstate', armSweep);
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onClick, true);

  // ---- Teardown ---------------------------------------------------------------
  //
  // Undo everything this run did. The hard part is the relocated node — it is
  // GOOGLE'S, so homeTools() above, not a remove(), is what deals with it.
  window.__nixGooglePhotosTeardown = () => {
    for (const observer of observers) observer.disconnect();
    observers.length = 0;
    watchedHead = null;
    stopSweep();

    window.removeEventListener('DOMContentLoaded', applyAndKick);
    window.removeEventListener('load', applyAndKick);
    window.removeEventListener('popstate', armSweep);
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onClick, true);

    homeTools();
    if (appsProxy !== null) appsProxy.remove();
    appsProxy = null;
    if (host !== null) host.remove();
    host = null;

    if (navIdOwned !== null) {
      if (navIdOwned.getAttribute('id') === DRAWER_ID) navIdOwned.removeAttribute('id');
      navIdOwned = null;
    }

    // Every attribute we set on the document. Leaving one behind would strand a
    // `:root[...]` selector nothing serves rules for any more.
    root.removeAttribute(DRAWER_ATTR);
    root.removeAttribute(SHELL_ATTR);
    root.removeAttribute(TOOLS_ATTR);
    if (burger !== null) burger.remove();
    if (scrim !== null) scrim.remove();
    burger = null;
    scrim = null;
    if (styleEl !== null) styleEl.remove();
    styleEl = null;
    delete window.__nixGooglePhotosTeardown;
  };
})();
