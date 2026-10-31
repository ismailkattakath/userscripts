// ==UserScript==
// @name         Civitai — media-only feed, icon-only top bar
// @namespace    kattakath.com
// @author       Ismail Kattakath
// @license      MIT
// @version      2.0.0
// @description  Strips Civitai's image and video feeds to media plus one icon-only top bar, and keeps every other page usable: model, article and challenge cards stay stock and open their own page, a model page keeps Download and Details in a slim sidebar, and the header autohides. Image cards open a fullscreen viewer (arrows, Enter to open, i for the prompt). Surfaces are darkened; ads, footer and announcements go.
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        *://civitai.com/*
// @match        *://*.civitai.com/*
// @match        *://civitai.red/*
// @match        *://*.civitai.red/*
// @match        *://civitai.green/*
// @match        *://*.civitai.green/*
// @run-at       document-start
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

// The goal, in one line: MEDIA ONLY, plus the one icon-only top bar. Two jobs
// serve it, both about screen real estate.
//
// VERTICAL (rules 1-13): chrome that eats the first screen on every landing.
// Unlike Google Photos, Civitai ships readable Tailwind utilities, so each
// piece is reachable by class — but a long utility chain breaks the moment one
// utility changes, so each selector below is trimmed to the shortest subset
// that still isolates the node. CSS-first on purpose: Civitai is a Next.js SPA,
// and a stylesheet keeps applying to nodes a client-side route change creates
// later, which a DOM removal does not. Rules 1-10 and 12-13 need no JS at all (rule 4's
// sizing is CSS; the MOVE it sizes is JS, in sweep() below); rule 11 exists
// only because its targets are identifiable by TEXT, which no selector can
// express, so a JS pass tags them and the stylesheet still does the hiding.
// The sticky footer is the one REMOVAL, not a hide — see the footer note below.
//
// Rule 6 is the only ALLOWLIST, and it carries the "media only" goal inside a
// feed card: it names what to KEEP and hides the rest, so
// furniture Civitai adds later fails closed instead of rendering raw until a
// rule catches up. Every other rule is a blocklist because it targets ONE known
// node, where an allowlist would have to enumerate the whole page to say what
// stays.
//
// HORIZONTAL (rule 14 + fit() below). Measured 2026-09-06 on civitai.com/images
// at 1452px and 1920px: the masonry never fills the window. The site's own
// MasonryProvider (chunk 26viv-cf_1s0t.js, read the same day) computes
//   columns = min(floor((w + 16) / (320 + 16)), 7)
// from a ResizeObserver on its own padded box and centres a block of
// 320·k + 16·(k−1) px — a 92px dead gutter at 1452, 224px at 1920, up to one
// column minus a gap at any width. Column and card heights are inline px
// computed for that 320px column, so stretching columns in CSS crops every
// image (object-fit: cover). No condition makes the site render a filled feed,
// so this is constructed, with ONE property: a CSS zoom on `main`, sized so the
// site's own math lands on k columns whose block fills the width exactly. The
// site keeps doing the layout; no inline value is fought.
//
// ROUTE PROFILES (2.0.0). A UX study of every category on 2026-10-31 found
// one masonry component (the "_queries" element) under /models, /3d-models,
// /articles, /comics, /challenges, /crucibles, /search, /collections and the
// home page, not only /images and /videos. Applying the image-feed treatment
// to all of them broke the site: a card click opened the image viewer instead
// of the model, article or challenge; model and article cards lost their
// names; search rendered 0 of 982 results and crucibles one row of 140px
// tiles (rule 12b turned their grids into one column per card); collections
// overlapped by 43px. So <html> now carries data-nix-civitai-route, set from
// location.pathname at entry and on every navigation:
//   media    /images, /videos   media-only cards (rule 6), 8px grid (rule 12),
//                               width fit (rule 14)
//   models   /models, /3d-models   width fit only; cards stay stock
//   model    /models/<id>       rule 7, plus the slim sidebar
//   post     /posts/<id>        each image fits the screen height
//   other    everything else    theme, autohide and the chrome rules only
// The viewer opens only for a card that links to /images/<id> (videos are
// image records too), and never for a modified or non-primary click.
//
// CLASS-NAME DRIFT, measured 2026-10-31 on civitai.com /images, /videos,
// /models and /models/3005406. Civitai's build now MINIFIES its CSS-module
// classes: "MasonryContainer-module-scss-module__<hash>__queries" became
// "Rvq10W_queries". The FILE name this script keyed on is gone; the hash still
// churns; the LOCAL name — the SCSS class the component author wrote — survives,
// so every hook below now keys on the local name. Each rule matches the old
// and the new form through :is(old, new), because the .red and .green mirrors
// are separate deployments that need not ship the same build on the same day.
//   [class*="_queries"]            the masonry (1 per feed; was MasonryContainer)
//   [class*="_filtersWrapper"]     sort/filter group (1 per feed; was FeedFilters)
//   [class*="_cssFrame"]           creator cosmetic frame (always paired with
//                                  _wrapper and _glow; was CosmeticWrapper)
//   card > [class*="_content"]     /models media pane (siblings _header and
//                                  _footer; was AspectRatioCard). Scoped as a
//                                  card's direct child because "content" alone
//                                  is generic
//   [class*="scrollContainer"].mantine-ScrollArea-root   version picker, 1 on
//                                  a model page (was ModelVersionList)
//   [class*="gridInner"] > [class*="gridCol"]   model page columns; Mantine's
//                                  Grid-inner and Grid-col are gone there
//   [class*="_stack"]              model page title stack; Mantine Stack-root gone
//   img[alt="Support Civitai creators"]   the adblock placeholder, linking
//                                  /pricing; its old alt no longer appears
// "_queries" is the weakest of these: a generic name. It is unique on all three
// feeds today, and fit() still refuses any match whose inline width is not
// 320·k + 16·(k−1), so a stray match degrades to stock instead of a wrong zoom.
//
// LIFECYCLE — one teardown, called at entry. Added 2026-09-14; this file had
// none, alone in this family. A second copy is reachable in the wild (a Greasy
// Fork install beside a manual one) and by any agent re-injecting the body, and
// measured 2026-09-14 on civitai.com/images that second copy produced: 2
// MutationObservers on body+subtree, 2 click captures, 2 keydown captures, and
// TWO stacked fullscreen overlays per card click — of which Escape closed one,
// leaving the page under a dead matte.
//
// The contract, matching google-photos-icon-nav:
//   · ONE flag         `torn`, re-checked inside every coalescing frame. A
//                      queued requestAnimationFrame OUTLIVES teardown and would
//                      otherwise rebuild exactly what it just undid.
//   · ONE controller   every listener is added with { signal }, so teardown is
//                      one ac.abort() and not a removeEventListener list that
//                      rots the first time a listener is added and not mirrored.
//                      The bootstrap listeners (DOMContentLoaded, load) carry it
//                      too — a copy torn down before it started must not mount.
//   · NO "already init" flag. An early return would make a re-run a silent
//                      no-op, which is the exact failure a re-injection test
//                      exists to catch.
//   · STOP NEW WORK BEFORE UNDOING THE DOM: torn, abort, disconnect, cancel —
//                      and only then put nodes back.
//
// TWO of the SITE's own nodes are moved or removed by sweep(), and each is
// recorded with its parent + nextSibling at the moment it is touched, so
// teardown returns it to where React expects it rather than to a guess:
//   · the route's scrollable bar, docked into the sub-nav
//   · footer[data-app-footer], removed outright
// The footer is restored only while the document holds no other one — React may
// have mounted a replacement meanwhile, and two footers is mangled, not stock.
// A recorded parent that is itself DETACHED is still the right home: that tree
// is the site's, React discarded it, and the live sub-nav returns to stock
// either way.
(() => {
  'use strict';

  // Undo a previous copy before this one touches anything. Never an "already
  // init" early return — see LIFECYCLE above.
  const TEARDOWN = '__nixCivitaiDeclutterTeardown';
  if (typeof window[TEARDOWN] === 'function') {
    try { window[TEARDOWN](); } catch { /* the old copy is already gone */ }
  }

  let torn = false;
  const ac = new AbortController();
  const on = (target, type, fn, opts) =>
    target.addEventListener(type, fn, { ...opts, signal: ac.signal });

  const SHEET_CSS = `
    /* 1. The header AUTOHIDES — it is no longer hidden outright. 1.25 and
       earlier hid it for good, which took Sign In, search, the account menu
       (settings, browsing level, sign out), notifications and Create with it:
       there was no way to sign in at all (operator report, 2026-10-31).

       Hidden while scrolling DOWN, back on scroll UP, always shown within
       HDR_TOP_PX of the top — the same rules as thumbwall's top bar. The
       MECHANISM differs, because the layout does. Measured 2026-10-31: header
       is position:static, the first child of a flex column ("flex h-full
       flex-1 flex-col") whose second child holds div.scroll-area, the ONE
       scroller (the document itself never scrolls: 949/949). thumbwall's bar
       is position:fixed, so translate moves it off for free; translating this
       one would leave its 60px slot behind as a blank band. So the slot itself
       collapses: a negative top margin of the header's own measured height,
       which the scroll column absorbs as height. The content shifts the way
       the reader is already scrolling, which is why it reads as motion and
       not as a jump.

       The JS below writes ONE attribute on <html> and the measured height as
       a custom property; nothing here is a pixel guess beyond the fallback. */
    html[data-nix-civitai-hdr="hidden"] header {
      margin-top: calc(-1 * var(--nix-civitai-hdr-h, 60px)) !important;
    }
    header {
      transition: margin-top 180ms ease;
    }

    /* 2. The feed's sort/NSFW-toggle/Filters group ("Everyone · Most
       Reactions · Filters") inside the sticky sub-nav bar. Its own class is a
       Next.js CSS-module hash ("-Hp08W-") that WILL churn on Civitai's next
       build, so the shipped selector is the substring that survives that:
       "FeedFilters-module" is the component's source name, stable the same
       way "MasonryContainer-module" is stable in rule 14 below — that pairing
       is the precedent for using [class*=] instead of the exact class here.
       Measured 2026-09-06: matches exactly ONE node on /images, /models and
       /videos (present on all three — Civitai reuses this bar for every feed,
       "Highest Rated" swapped in for "Most Reactions" on /models) and ZERO on
       home — a real absence, not a misfire. Its parent is "justify-between"
       with the nav-links group and a settings icon as the other two children,
       so hiding it just widens that gap; nothing needs to fill the space. */
    html:not([data-nix-civitai-filters]) :is([class*="FeedFilters-module"], [class*="_filtersWrapper"]) {
      display: none !important;
    }

    /* 3. Nav-link text labels ("home", "models", "images", …) forced OFF —
       icon-only, on request. Civitai's own "Show labels" switch (Customize
       navigation panel) already does this, and measured 2026-09-06 it is a real
       DOM-DIFFERS toggle, not a class flip: with labels ON each link has a
       ".text-base.font-medium.capitalize" span AND the <a> carries asymmetric
       "pl-3 pr-4" padding (room for the label); with labels OFF that span is
       gone entirely and the <a>'s padding is symmetric "px-3" (8px 12px both
       sides, measured). Reproducing only the text-hide and leaving the old
       padding would sit every icon off-centre in a pill sized for a label that
       is no longer there — so this rule does both halves of the site's own
       diff. Verified 2026-09-06: with the toggle forced back ON, this pair
       reproduces the true icon-only row within 1-3px (642px vs 639px measured,
       rounding only). Scoped to the sticky sub-nav so it can't catch a
       ".text-base.font-medium.capitalize" span anywhere else on the page; the
       "More" trigger's own label lives in a different span and is untouched,
       matching the site's own behaviour (More keeps its text either way).
       Belt-and-suspenders: the account's real "Show labels" preference was
       also set to off through the site's own panel while measuring this, so
       normally this rule never has anything to correct — it exists for
       whatever flips that preference back (a future default change, a
       different browser/session, an accidental click in that panel). */
    /* RE-MEASURED 2026-10-31: the label is now a CLASSLESS span after the
       link's svg ("a > svg + span"), and Mantine's Button class is gone, so
       the old pair matched 0 nodes and every label came back. Keyed on the
       shape instead of a class. The More trigger is a button, not a link, so
       it keeps its text as before. */
    main > div.sticky.top-0.z-50 a[href] > svg + span {
      display: none !important;
    }
    main > div.sticky.top-0.z-50 a[href]:has(> svg + span) {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }

    /* 4. Sizing for whichever horizontal bar sweep() docks into the sub-nav —
       the feed's tag-filter bar, or a model detail page's version picker (the
       move itself is JS; CSS cannot reparent). flex-grow fills exactly the gap
       rule 2's hidden FeedFilters group leaves between the nav links and the
       settings gear — measured 2026-09-06 at 1512px: the docked bar spans
       460→1468 of a 452→1476 slot. Both bars scroll their own content
       horizontally (the tag chips already overflow at full width; the version
       picker packs 6698px of chips into a 1025px box), so a squeeze costs
       nothing: less width is the point. Growing also settles the auto margin
       the site puts on the gear when the slot would otherwise be empty —
       flex-grow leaves no free space for "ml-auto" to absorb, so the gear
       stays pinned right without a rule of its own. */
    [data-nix-civitai-tagbar] {
      flex: 1 1 0%;
    }

    /* 5. Card cosmetic frame/glow — a creator-equipped decoration, present on
       /models (12 of 33 sampled cards) AND /images alike, absent from a plain
       card ENTIRELY (measured 2026-09-06: a plain card's own wrapper carries
       none of CosmeticWrapper's classes and has no ::before/::after at all —
       this is purely additive, never load-bearing layout). CosmeticWrapper is
       the OUTER element (its own single child is the plain card shell) —
       scoping this to "inside AspectRatioCard" was tried and measured WRONG
       (the nesting runs the other way, so that selector never matched
       anything, silently) — unscoped is both correct and matches what was
       actually wanted: /images' own instance wraps a real image card
       (\`data-remix-card\`), not something unrelated. Its inline style sets TWO
       things — "--bgGradient" and "aspect-ratio"/"height" — only the first is
       touched; the sizing property is unrelated to the decoration. The
       variable feeds the wrapper's OWN background and ::before's
       radial-gradient bloom directly (computed style resolves both to the
       inline value verbatim); the wrapper's OWN box-shadow and ::after's are
       a THIRD and FOURTH, independent consumer — hardcoded rgba, not
       variable-based. Neutralizing the consuming properties (background,
       box-shadow) on the wrapper AND both pseudo-elements is what makes this
       robust to whichever property a future cosmetic variant drives, rather
       than chasing the variable name — verified 2026-09-06 down to zero
       remaining background-image or box-shadow on all three. */
    :is([class*="CosmeticWrapper-module"], [class*="_cssFrame"]) {
      background: none !important;
      box-shadow: none !important;
    }
    :is([class*="CosmeticWrapper-module"], [class*="_cssFrame"])::before,
    :is([class*="CosmeticWrapper-module"], [class*="_cssFrame"])::after {
      background: none !important;
      box-shadow: none !important;
    }

    /* 6. Feed cards are MEDIA ONLY — and this is the one ALLOWLIST in the
       file, deliberately. Every other rule names a thing to hide, so each new
       piece of furniture Civitai ships renders raw until a rule catches up;
       this one names the two things to KEEP and hides the rest, so a new
       overlay fails closed.

       Measured 2026-09-06. One card root serves all three feeds —
       "div.relative.flex.overflow-hidden.rounded-md" (plus theme utilities
       that are pure churn, so the selector stops at the four structural
       ones) — with exactly TWO inner shapes beneath it:
         · /images + /videos → "div.relative.flex-1" holds an <a> wrapping the
           img/video, plus three absolute overlay siblings (top-left badges,
           top-right ⋮/Remix buttons, bottom-right chip); a sibling
           "div.flex.items-center" is the 👍-reaction bar.
         · /models → "AspectRatioCard-module…__content" holds an <a> wrapping
           the img, plus "__header" (type/base-model badges AND the ⋮/copy
           button stack) and "__footer" (creator, title, stats).
       So: keep the media pane, keep the <a> inside it, hide everything else.
       ONE <a> per pane, verified — the media's, never a second link.

       The reaction bar is the only child with real height (42px), and losing
       it costs NOTHING: the card root is flex-column with a height set from
       outside by the masonry, and the media pane is flex-1, so it ABSORBS the
       42px instead of leaving a gap — measured, card 556px before and after
       while the image grew 512→554 (object-fit:cover, so it fills). The
       overlays are all position:absolute and cost no height at all.

       A masonry also carries its own heading row where one is embedded in a
       page rather than being the page — a model's "Gallery · Add Post · Add
       Review · Most Reactions · Filters" (measured 2026-09-06). It is a
       mantine Group directly under the masonry's stack, and a feed's tag bar
       in that same position is NOT a Group (it is ".min-w-0.min-h-[26px]"),
       so naming the Group cannot catch the bar this script wants kept. */
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) div.relative.flex.overflow-hidden.rounded-md > *:not(.relative.flex-1):not(:is([class*="AspectRatioCard-module"], [class*="_content"])) {
      display: none !important;
    }
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) div.relative.flex.overflow-hidden.rounded-md > div.relative.flex-1 > *:not(a),
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) div.relative.flex.overflow-hidden.rounded-md > :is([class*="AspectRatioCard-module"], [class*="_content"]) > *:not(a) {
      display: none !important;
    }
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) > * > [class*="mantine-Group-root"] {
      display: none !important;
    }

    /* 7. A model DETAIL page is media only too — the carousel, its arrows and
       the gallery masonry below survive; the article around them does not.
       Every line NAMES a block. That is not a style choice, it is the fix for
       a crash this file caused on 2026-09-07.

       WHAT HAPPENED. The first version of this rule was an allowlist, the same
       shape as rule 6: keep the branch holding the media column, hide every
       sibling via ":not(:has(mainSection))". It put Civitai's own "Whoops!
       Something went wrong :(" boundary on EVERY model page. Caught at last
       from the page's own console, at document-start, with the rule injected
       and nothing else changed:

         TypeError: Cannot read properties of undefined (reading 'right')

       ".right" is a rect. The carousel measures its slides on mount, and an
       allowlist DEFAULTS TO HIDDEN — ":not(:has(mainSection))" is TRUE for a
       container that does not hold the media column YET, and a model page is
       server-rendered, so it fills in progressively. For one moment the rule
       hid the carousel's own ancestor; the carousel measured an empty slide
       list inside a display:none box, indexed it, and threw. A blocklist
       cannot do this: naming a node to hide is FALSE until that node exists,
       so the media branch is never hidden even for a frame. That is the whole
       difference, and it is why rule 6 is safe on a feed (cards mount
       complete, client-side) while the same idea is not safe here.

       Two narrower fixes were tried first and BOTH still crashed — naming the
       title instead of the broad selector, and deferring the rule until the
       media existed — which is what finally pointed at the shape rather than
       any one selector.

       THE BLOCKS, measured 2026-09-06/07 on /models/1145743 and /models/958009,
       and re-verified together at document-start with zero errors and the
       carousel intact at 378x567:
         · rail — the 330x661 ad column beside the article
         · Grid-col that is NOT mainSection — the Create/sale/Download/
           Collection/Details sidebar. The media column carries "mainSection",
           so excluding it by NAME (never by ":has") keeps it out of reach.
         · Stack directly inside the contentCol Stack — title, stats, tag chips.
           The media hangs off a Grid-container, which is not a Stack, so this
           cannot reach it.
         · <a> children of contentCol — the two 275px ad banners.
         · classless <div> child — "Suggested Resources".
         · "flex flex-col gap-4" child — Discussion / Add Comment.
         · Spoiler — the description under the carousel.
         · a slide's non-<a> children — the Remix button, reaction bar and
           corner chip, exactly the overlays rule 6 clears on a feed card.
       The version picker is deliberately NOT hidden: sweep() docks it into the
       sub-nav, and its emptied container collapses to 0px on its own. */
    /* 2.0.0: the sidebar is no longer hidden — Download, the Details panel
       (type, base model, trigger words, hash) and the license are the reason
       to open a model page, and hiding the column also left 55% of the width
       blank (measured 2026-10-31). sweep() slims it by name instead: it finds
       those three blocks and tags their SIBLINGS data-nix-civitai-off (rule 11),
       so a block it cannot find stays visible rather than taking the rest
       with it. The title row stays too, minus its stats and buttons.
       Discussion moved outside contentCol (measured 2026-10-31), so it and
       Suggested Resources are found by their headings in the same pass. */
    html[data-nix-civitai-route="model"] [class*="mainRegion"] > [class*="rail"] {
      display: none !important;
    }
    html[data-nix-civitai-route="model"] [class*="_titleWrapper"] > :not(h1),
    html[data-nix-civitai-route="model"] [class*="_titleWrapper"] ~ *,
    html[data-nix-civitai-route="model"] [class*="contentCol"] > a,
    html[data-nix-civitai-route="model"] [class*="contentCol"] > div:not([class]),
    html[data-nix-civitai-route="model"] [class*="contentCol"] > div.flex.flex-col.gap-4 {
      display: none !important;
    }
    html[data-nix-civitai-route="model"] [class*="mainSection"] [class*="Spoiler-root"],
    html[data-nix-civitai-route="model"] [class*="mainSection"] .relative.w-full > *:not(a) {
      display: none !important;
    }

    /* 8. The sticky "BONUS REWARDS ACTIVE · 2x BUZZ" strip — the BUTTON only, never
       its wrapper. Measured: that "sticky top-0 z-50 mb-3" wrapper is 72px and holds
       TWO children — this 32px promo button and the 40px category-nav row
       (Home/Models/Images/…). Hiding the wrapper would take the nav with it. Because
       the nav keeps the wrapper alive, dropping the button leaves no residual gap. */
    #main div.sticky.top-0.z-50 > button {
      display: none !important;
    }

    /* 9. The announcement carousel ("Sticker Book", "See what's in it", dots).
       "announcements" is a semantic class, not a Tailwind utility — the single
       most durable handle on this page. */
    #main div.announcements {
      display: none !important;
    }
    /* Its wrapper ("mb-3 min-h-[203px]") kept 181px of empty band above every
       feed, home and /challenges once the carousel inside was gone (measured
       2026-10-31 by three of the four study agents). */
    main div:has(> div.announcements) {
      min-height: 0 !important;
      margin: 0 !important;
    }

    /* 10. The bottom ad rail (SEMRUSH etc.) — a direct child of the app shell and a
       SIBLING of the scrolling column, which is why it survives every route change.
       Identified by being the centered, top-bordered shell child rather than by its
       bg-gray-2/dark:bg-dark-9 pair, which is pure theming and likely to churn.
       "Only rendered for a SIGNED-IN session" was true when this was written and
       is NOT true any more — RE-MEASURED 2026-09-14, signed OUT and with no
       content blocker, the column has FOUR children and the fourth is this rail,
       1512x97 and captioned "Close Ad". The rule matches, and hiding it is
       wanted either way; only the old "no-op when logged out" note was stale.
       The site footer is nested inside the scrolling column, not here, so it is
       never caught by this rule.

       KNOWN RESIDUE, and it is the AD STACK's, not ours: while this rail is
       display:none the ad network keeps re-serving into the hidden box and
       settles on a TALLER creative, so dropping the rule (a teardown, or an
       uninstall) reveals a rail that has grown. Measured 2026-09-14 on /images
       with ONLY this one declaration in a bare <style> and nothing else from
       this script: 97px stock -> hidden 4s -> 201px on unhide, stable. Nothing
       in this file sets that height and nothing in teardown can put it back; the
       page is otherwise byte-for-byte stock (see LIFECYCLE at the top). */
    #main > div > div.relative.flex.justify-center.border-t,
    [data-adhesive-ad] {
      display: none !important;
    }

    /* 11. Ad furniture that has NO durable class handle — hidden by MARKER, not by
       selector. The pass below only tags; this rule does the hiding. That split is
       the point: React re-creating a tagged node costs one re-tag, never a fight
       over a removal it will just undo. */
    [data-nix-civitai-ad],
    [data-nix-civitai-off] {
      display: none !important;
    }

    /* 12. Grid spacing — one number everywhere, half of Civitai's. Measured
       2026-09-07 on /videos, from rendered rects rather than class names: the
       site is ALREADY uniform at 16 CSS px — column gap, the gap between cards
       down a column, and the container's left/right padding all 16 (they render
       as 18 because rule 14's zoom scales them). So "half" is 8, and 8 is also
       what the left and right edges get, so the inset matches the gap exactly.

       Three different mechanisms produce that one number, which is why this
       needs four declarations rather than one:
         · the column gap is a plain flex "gap-4" on the row — a real gap
         · the outer inset is padding-inline on the masonry's @container box
         · the VERTICAL gap is not a gap at all. Each card sits in an
           unclassed wrapper the virtualiser positions absolutely (inline
           "top", "height", "left:-8px", "width:calc(100% + 16px)",
           "padding:8px"), so the column's own "gap-4" never applies — flex
           gaps skip absolutely-positioned children. Two adjacent 8px paddings
           ARE the 16px gutter, so halving that padding halves the gutter.
       Only the vertical padding is touched: the 8px left/right is load-bearing,
       cancelling the -8px offset so the card lands exactly 320px wide, and
       changing it would drag every card sideways.

       The card then has to fill its wrapper, or nothing is gained: its own
       height is inline and was computed for 8px padding (571px inside a 587px
       wrapper), so with 4px padding it would keep 8px of slack and the gutter
       would stay 16. "height: 100%" spends that slack on the image instead —
       the one inline value this file overrides, and a bounded one. Verified
       after: every vertical gap 9px rendered, horizontal 9px, no overlap. */
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) > * > * > .mx-auto.flex.justify-center {
      gap: 8px !important;
    }
    /* And the columns take the surplus, not the edges. The site sizes the feed
       for its own 16px gutter (320k + 16(k-1)) while these columns are a fixed
       320 each, so an 8px gutter leaves 8px per column unspent — measured as a
       24.6px margin against an 8px gap. Letting them flex to equal fractions
       spends it on the cards instead: 330px cards, 8px edges. */
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) .mx-auto.flex.justify-center > div {
      flex: 1 1 0 !important;
      width: auto !important;
    }
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) .flex.flex-col > div[style*="position: absolute"] {
      padding-top: 4px !important;
      padding-bottom: 4px !important;
    }
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) .flex.flex-col > div[style*="position: absolute"] > div.relative.flex.overflow-hidden.rounded-md {
      height: 100% !important;
    }
    html[data-nix-civitai-route="media"] #main div.\\@container[style*="padding-inline"] {
      padding-inline: 8px !important;
    }

    /* 12b. REMOVED in 2.0.0 — the grid override below was written for the
       /models row bands, but search and /crucibles render their results in the
       same kind of inline grid under the same masonry, and it turned search's
       grid into 982 columns of 0px (0 of 982 results visible) and crucibles
       into one row of 140px tiles (measured 2026-10-31). /models cards are
       stock again in 2.0.0, so the stock 16px gutter and fit()'s zoom already
       fill the width. The original note follows for the record.

       /models does not lay its feed out like rule 12's. It ships a spacer
       div of the total computed height holding row BANDS that are absolutely
       positioned by inline transform, each a grid of "repeat(k, 320px)" with a
       16px column-gap. So the horizontal gap needs naming here, and inline
       loses to !important.

       Letting the columns be equal fractions rather than fixed 320s is what
       fixes the MARGIN: the site reserves 336px per column (320 + its own gap)
       and picks the column count from that alone, so an 8px gutter leaves 8px
       per column unspent, and it used to collect at the edges — 28.5px margins
       against an 8px gap. Spent on the cards instead, the edges come back to 8.

       The other unevenness was the cosmetic wrapper: a creator cosmetic wraps
       its card in 6px of padding a plain card does not have, so a wrapped card
       rendered 308px beside a neighbour's 320 and the gutter alternated 28/16
       down one row. Rule 5 already neutralises that wrapper's glow; dropping
       the padding is the rest of that job.

       THE VERTICAL GAP IS LEFT ALONE, and that is a decision, not an oversight.
       It measures ~62px because the site positions rows while RESERVING each
       card's footer, which rule 6 hides — so ~46px of empty reserved space plus
       its own 16px falls between rows, and no element spans it to be shrunk.
       Taking the layout over does fix it: give the spacer "height: auto" and
       return the bands to normal flow with a margin, and every gap and margin
       measures 8. It also BREAKS SCROLLING, measured 2026-09-07 — the
       virtualiser unmounts off-screen rows, so in normal flow the page
       collapses under the scrollbar and the browser clamps back. Scrolling down
       in 3000px steps went 4163 -> 4011 -> 3096 -> 2339, backwards, with
       scrollHeight oscillating 6122/5647/7554/5488, versus reaching 27519 with
       this rule as it stands. The spacer's fixed height is what makes the feed
       scrollable at all; a tighter row rhythm needs those per-row offsets
       recomputed in JS, not CSS. */
    html[data-nix-civitai-route="media"] :is([class*="MasonryContainer-module"], [class*="_queries"]) {
      width: 100% !important;
    }
    /* A creator cosmetic wraps its card in 6px of padding that a plain card
       does not have, so a wrapped card rendered 308px beside a neighbour's 320
       and the gutter alternated 28/16 down one row. Rule 5 already neutralises
       this wrapper's glow; dropping the padding is the rest of that job. */
    :is([class*="CosmeticWrapper-module"], [class*="_cssFrame"]) {
      padding: 0 !important;
    }

    /* 12d. A post page stacks its images at column width, each 728x1092 in a
       949px window (measured 2026-10-31 on /posts/31881390), so not one of them
       is ever seen whole. Each image box carries the site's own inline
       aspect-ratio, so capping its height lets that ratio set the width. */
    html[data-nix-civitai-route="post"] main div.relative[style*="aspect-ratio"]:has(> a > img) {
      max-height: calc(100vh - 96px);
      margin-inline: auto;
    }
    html[data-nix-civitai-route="post"] main div.relative[style*="aspect-ratio"] > a > img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* 12c. The in-page viewer's own chrome (the JS that opens it is below).
       Fixed above everything, on the darkest rung from rule 13 so the media is
       the only lit thing, and the media is contained rather than cropped —
       this is the one place the whole frame matters more than filling the box. */
    .nix-civitai-view {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: #08090A;
      overflow-x: hidden;
      overflow-y: auto;
      scroll-snap-type: y mandatory;
    }
    .nix-civitai-slide {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      scroll-snap-align: start;
      scroll-snap-stop: always;
    }
    /* width/height rather than max-*: an <img> will not scale UP past its
       natural size from a max- constraint, so the slides rendered at the card's
       own 450px in the middle of the screen. The feed's source is all there is
       (nothing is fetched, by design), so it gets upscaled and contained. */
    .nix-civitai-view-media {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    /* The i key's generation-data panel. Plain text only: everything in it
       is the poster's own data, written with textContent, never as markup. */
    .nix-civitai-info {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      width: min(420px, 40vw);
      overflow-y: auto;
      z-index: 2147483647;
      background: rgba(13, 14, 15, 0.92);
      color: #C1C2C5;
      border: 1px solid #25262B;
      border-radius: 12px;
      padding: 16px;
      font: 13px/1.5 system-ui, sans-serif;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .nix-civitai-info h4 {
      margin: 12px 0 4px;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #909296;
    }
    .nix-civitai-info h4:first-child {
      margin-top: 0;
    }
    .nix-civitai-info p {
      margin: 0;
      user-select: text;
    }

    /* 13. Surfaces, half as bright. Measured 2026-09-07: the page is Mantine's
       "--mantine-color-dark-7" (#1A1B1E) and both the top bar and the card are
       Tailwind's "dark-6" (#25262B) — TWO palettes, and the Tailwind one
       compiles to literal rgb() with no variable to hook, so each needs its own
       override. Every value is its own channels halved, which is what "twice as
       dark" means arithmetically and keeps the rungs' relative order intact.
       Rungs 0-3 are deliberately untouched: those are TEXT (#C1C2C5 and
       friends), and halving them would put dark grey on near-black. */
    :root, [data-mantine-color-scheme="dark"] {
      --mantine-color-dark-4: #1C1D20 !important;
      --mantine-color-dark-5: #16171A !important;
      --mantine-color-dark-6: #131316 !important;
      --mantine-color-dark-7: #0D0E0F !important;
      --mantine-color-dark-8: #0A0B0C !important;
      --mantine-color-dark-9: #08090A !important;
    }
    .bg-dark-4, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-4 { background-color: #1C1D20 !important; }
    .bg-dark-5, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-5 { background-color: #16171A !important; }
    .bg-dark-6, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-6 { background-color: #131316 !important; }
    .bg-dark-7, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-7 { background-color: #0D0E0F !important; }
    .bg-dark-8, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-8 { background-color: #0A0B0C !important; }
    .bg-dark-9, [data-mantine-color-scheme="dark"] .dark\\:bg-dark-9 { background-color: #08090A !important; }

    /* 14. Feed width. \`main\` (measured 2026-09-06: one per page, class "min-w-0
       flex-1") hosts the zoom because BOTH masonry providers measure boxes inside
       it — FeedLayout's (class "z-10 m-0 flex-1", chunk 1t51nljfgomzh.js) and
       MasonryContainer's padded "@container" box — and the outer one caps the
       inner one, so a zoom above both moves both. The value is computed by fit()
       and lands on a custom property so this sheet stays static; unset = stock. */
    main {
      zoom: var(--nix-civitai-zoom, 1);
    }
  `;

  // Violentmonkey and Tampermonkey both RETURN the <style> they append, and that
  // element is the handle teardown removes. The fallback is an identity match on
  // the exact text this run injected — never a guess at which <style> is ours —
  // so a manager that returns nothing still gets a clean teardown.
  const sheet = GM_addStyle(SHEET_CSS);
  const dropSheet = () => {
    const el = sheet && sheet.nodeType === 1
      ? sheet
      : [...document.querySelectorAll('style')].find((s) => s.textContent === SHEET_CSS);
    if (el) el.remove();
  };

  // Two ad containers are identifiable only by their own CONTENT, and CSS has no
  // text selector — which is the whole reason this pass is JS:
  //   · the "Become a Member to turn off ads today" upsell card
  //   · the fixed-height support slot wrapping Civitai's own adblock-plea image
  //
  // BORROWED MEASUREMENT, not mine: both handles were read off
  // sleazyfork.org/en/scripts/567182 ("Civitai Real Complete Ad Blocker" v6.0) on
  // 2026-08-31 — a live-page measurement by its author, cited rather than trusted
  // blind. Three of its choices are deliberately NOT adopted: it removes nodes
  // (React puts them back), so it polls on a 1s setInterval to keep up, and it
  // walks up to <body> unbounded — which blanks the page the day its predicate
  // stops matching. Tagging makes the poll unnecessary; MAX_UP bounds the walk.
  const PLEA = 'img[alt="Please support civitai and creators by disabling adblock"], img[alt="Support Civitai creators"]';
  const UPSELL = 'Become a Member to turn off ads today';
  const CARD = '.relative.flex.overflow-hidden';
  const MAX_UP = 6;
  const FOOTER = 'footer[data-app-footer]'; // measured 2026-09-06 — the site's own handle
  // The sub-nav's middle slot takes whichever horizontal bar THIS route offers,
  // first match wins — they are mutually exclusive, measured 2026-09-06 on a
  // HARD-RELOADED page of each kind, which is the only way to tell a route's own
  // bar from one a previous route's sweep already parked in the sub-nav:
  //   · a feed (/images, /models, /videos) renders the tag bar and NO version bar
  //   · a model detail page renders the version bar and NO tag bar (0 matches)
  // The tag bar's grandparent IS the FEED element fit() already tracks.
  // ".min-w-0.min-h-[26px]" is plain Tailwind, but was verified page-wide UNIQUE
  // on all three feeds — scoped to FEED anyway so a future coincidence elsewhere
  // on the page can't false-match it. VERSIONBAR is the model's version picker
  // ("赤佬 3.0", "H3 A2A-RED MCP", …), a Mantine ScrollArea whose own viewport
  // scrolls (6698px of chips in a 1025px box, measured) — so it survives being
  // squeezed into the slot exactly as the tag bar does, and it is worth the slot
  // because every chip leads to more media.
  const BARS = [
    ':is([class*="MasonryContainer-module"], [class*="_queries"]) .min-w-0.min-h-\\[26px\\]',
    '[class*="scrollContainer"]:is([class*="ModelVersionList-module"], .mantine-ScrollArea-root)',
  ];
  // "Customize navigation", and "Customize page and navigation" on the home
  // page (measured 2026-10-31) — so a prefix, not an exact label.
  const CUSTOMIZE_NAV_BTN = 'main > div.sticky.top-0.z-50 button[aria-label^="Customize"]';

  const tag = (el) => {
    if (el.dataset.nixCivitaiAd === undefined) el.dataset.nixCivitaiAd = '';
  };

  // Where a SITE node was before this script moved or removed it. Parent AND
  // nextSibling, read at the moment of the move: a parent alone would append,
  // and "appended to the end of the sub-nav's owner" is not where React left it.
  let barHome = null;
  let footerHome = null;
  const notedHome = (node) => ({ node, parent: node.parentNode, next: node.nextSibling });
  // insertBefore(node, null) appends, which is exactly right when the recorded
  // sibling has itself been removed since — the node lands back in its own
  // parent, last, rather than throwing NotFoundError on a sibling that is no
  // longer a child.
  const goHome = (rec) => {
    if (!rec || !rec.parent) return;
    const next = rec.next && rec.next.parentNode === rec.parent ? rec.next : null;
    rec.parent.insertBefore(rec.node, next);
  };

  // ── Route profile ─────────────────────────────────────────────────────────
  // See ROUTE PROFILES at the top. Read from the URL, never from the DOM, so
  // it is right before the page has rendered anything.
  const ROUTE_ATTR = 'data-nix-civitai-route';
  const routeOf = (path) => {
    const p = path.replace(/\/+$/, '') || '/';
    if (p === '/images' || p === '/videos') return 'media';
    if (p === '/models' || p === '/3d-models') return 'models';
    if (/^\/models\/\d+/.test(p)) return 'model';
    if (/^\/posts\/\d+/.test(p)) return 'post';
    return 'other';
  };
  let routeNow = '';
  const setRoute = () => {
    const r = routeOf(location.pathname);
    if (r === routeNow) return;
    routeNow = r;
    document.documentElement.setAttribute(ROUTE_ATTR, r);
  };
  setRoute();

  const OFF = 'data-nix-civitai-off';
  const off = (el) => {
    if (el && !el.hasAttribute(OFF)) el.setAttribute(OFF, '');
  };

  // The model page's sidebar, slimmed by NAME (measured 2026-10-31 on
  // /models/362745, a LoRA with 4 trigger words, and /models/4201): its outer
  // stack holds [a stack of the Create card + the Download card], an Accordion
  // [Collection, Details, Tensors, About this version], the creator card, the
  // License group and a /pricing promo. Kept: the card holding the download
  // link, the Details item, the License group. Every other block on the way
  // up from those three to the sidebar is tagged off. Nothing is tagged until
  // the download link exists, so a sidebar still mounting stays stock.
  const slimModel = () => {
    for (const sb of document.querySelectorAll('[class*="_sidebarSection"]')) {
      const dl = sb.querySelector('a[href*="/api/download/models/"]');
      if (!dl) continue;
      const keep = [dl.closest('[class*="Card-root"], [class*="_card"]') || dl];
      for (const item of sb.querySelectorAll('[class*="Accordion-item"], [class*="_item"]')) {
        const label = (item.querySelector('button, [class*="control"]') || item).textContent.trim();
        if (/^Details/.test(label)) keep.push(item);
      }
      for (const el of sb.querySelectorAll('div')) {
        if (/^License:/.test(el.textContent.trim()) && el.children.length <= 3) { keep.push(el); break; }
      }
      const path = new Set();
      for (const k of keep) for (let n = k; n && n !== sb; n = n.parentElement) path.add(n);
      for (const n of path) {
        const parent = n.parentElement;
        if (!parent) continue;
        for (const sib of parent.children) if (!path.has(sib)) off(sib);
      }
    }
    // Headings are the most durable hook for whole sections: Discussion has
    // moved containers once already (2026-10-31), its heading text has not.
    for (const h of document.querySelectorAll('main h2')) {
      const t = h.textContent.trim();
      if (t === 'Discussion') off(h.closest('div.flex.flex-col.gap-4'));
      else if (t === 'Suggested Resources') {
        const feed = h.closest(FEED);
        off(feed && feed.parentElement);
      }
    }
  };

  // One button of ours beside the gear, shown only where the route HAS the
  // site's sort/filter group. It toggles an attribute that rule 2 reads, so
  // the site's own controls appear in place: nothing of the site's is moved.
  const FILTER_BTN = 'nix-civitai-filters-btn';
  const FILTER_ATTR = 'data-nix-civitai-filters';
  const FILTER_SVG = 'M4 5h16l-6 7v6l-4 2v-8z';
  const filtersButton = (gear, row) => {
    const has = !!document.querySelector('[class*="_filtersWrapper"], [class*="FeedFilters-module"]');
    let btn = document.querySelector('.' + FILTER_BTN);
    if (!has || !row || !gear) {
      if (btn) btn.remove();
      root.removeAttribute(FILTER_ATTR);
      return;
    }
    if (btn && btn.parentElement === row) return;
    if (btn) btn.remove();
    btn = document.createElement('button');
    btn.type = 'button';
    // The gear's own classes, read at runtime, so the button matches whatever
    // the site's icon buttons look like this build.
    btn.className = gear.className + ' ' + FILTER_BTN;
    btn.setAttribute('aria-label', 'Sort and filters');
    btn.setAttribute('title', 'Sort and filters');
    btn.setAttribute('aria-pressed', root.hasAttribute(FILTER_ATTR) ? 'true' : 'false');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', FILTER_SVG);
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.addEventListener('click', () => {
      const on = !root.hasAttribute(FILTER_ATTR);
      if (on) root.setAttribute(FILTER_ATTR, '');
      else root.removeAttribute(FILTER_ATTR);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }, { signal: ac.signal });
    row.insertBefore(btn, gear);
  };

  const sweep = () => {
    setRoute();
    for (const img of document.querySelectorAll(PLEA)) {
      // The 2026-10 placeholder IS a link: img inside a[href="/pricing"]. On a
      // feed that link is a card's only child, so the card goes; on the home
      // page (measured 2026-10-31, civitai.red) the link sits DIRECTLY in the
      // 22-section page container, so the link alone goes. 1.25.0 walked up
      // instead and tagged that container, which blanked the whole home page.
      const link = img.parentElement;
      if (link && link.matches('a[href="/pricing"]')) {
        const box = link.parentElement;
        tag(box && box.children.length === 1 && box.matches(CARD) ? box : link);
        continue;
      }
      // Stop at the first ancestor that RESERVES ad height or owns the pricing
      // link — those are the slot's own declarations, not incidental styling.
      // Never past an element that holds more than one child: an ad slot wraps
      // one creative, and a wider tag hides real content with it.
      let el = img.parentElement;
      for (let up = 0; el && up < MAX_UP && el.children.length <= 1; up++, el = el.parentElement) {
        const min = el.style.minHeight || '';
        if (min.includes('250') || min.includes('280') || el.querySelector('a[href="/pricing"]')) {
          tag(el);
          break;
        }
      }
    }
    // Last because it is the only unscoped scan here; no match means no tag —
    // never a guessed parentElement, so a copy change degrades to stock.
    for (const p of document.querySelectorAll('p')) {
      if (!p.textContent.includes(UPSELL)) continue;
      const card = p.closest(CARD);
      if (card) tag(card);
    }
    // The sticky footer goes as a NODE, on request — not a hide. Measured
    // 2026-09-06: footer[data-app-footer] is "sticky bottom-0 z-50", 45px, the
    // LAST child of div.scroll-area beside `main`, and it carries the chat
    // button plus its 500px panel as absolute children, so they leave with it.
    // Removing a React-managed node is only safe while React never re-inserts
    // around it. Measured the same day: `main` and .scroll-area keep their
    // identity across /models, /images, an image detail page and Back, with
    // zero error events — the footer lives in the persistent app layout. If
    // the site ever remounts it, the observer below removes it again.
    const footer = document.querySelector(FOOTER);
    if (footer) {
      // Recorded before the remove, and OVERWRITTEN on each later removal: only
      // the most recent footer is the one the live tree is missing. An earlier
      // one React has already abandoned is not ours to put back anywhere.
      footerHome = notedHome(footer);
      footer.remove();
    }
    // This route's horizontal bar → into the sub-nav gap between the (now
    // icon-only) nav links and the settings gear. Stress-tested empirically,
    // not just once, 2026-09-06: 11,000px of scroll (virtualised image
    // loading), route changes across all three feeds and a model detail page,
    // and clicking a TAG WITHIN the moved bar itself (which updates the ?tags=
    // URL and re-renders the bar in place) — zero error events throughout.
    // React patched the SAME moved node in place rather than fighting to
    // insert a sibling next to it, matching the footer's already-proven
    // "React never re-inserts around this node" finding, on a subtree that
    // mutates far more than the footer's ever does.
    //
    // "Not already in the row" is BOTH the search filter and the idempotence
    // guard: a docked bar stops being a candidate, so a re-run is a no-op.
    //
    // The eviction is not optional. A route change UNMOUNTS the feed that
    // owned the docked bar, but React cannot reclaim a node that no longer
    // sits where its tree expects — so the old bar just stays, and the next
    // route docks its own beside it. Measured: three bars accumulated in the
    // row that way, each flex-grow'ing to a third of the slot. Evicting every
    // OTHER marked bar keeps it at exactly one, verified across a
    // detail→images→models→videos walk (dockedBars: 1 at every step).
    // Rule 4 above does the flex-sizing; the reparent is JS because no CSS
    // mechanism moves a node between containers.
    const gear = document.querySelector(CUSTOMIZE_NAV_BTN);
    const row = gear && gear.parentElement;
    if (row) {
      let bar = null;
      for (const sel of BARS) {
        bar = [...document.querySelectorAll(sel)].find((el) => !row.contains(el)) || null;
        if (bar) break;
      }
      if (bar) {
        for (const stale of row.querySelectorAll('[data-nix-civitai-tagbar]')) {
          if (stale !== bar) {
            // Evicted: its own feed was unmounted, so its recorded home is a
            // tree React has already discarded. Drop the record with the node —
            // a teardown that restored it would resurrect a dead route's bar.
            if (barHome && barHome.node === stale) barHome = null;
            stale.remove();
          }
        }
        barHome = notedHome(bar);
        bar.dataset.nixCivitaiTagbar = '';
        row.insertBefore(bar, gear);
      }
    }
    if (routeNow === 'model') slimModel();
    filtersButton(gear, row);
    fit();
  };

  // ── Feed width ────────────────────────────────────────────────────────────
  // Every number here is the site's own, read 2026-09-06:
  //   FEED  the div MasonryContainer gives an inline width of 320·k + 16·(k−1).
  //         "MasonryContainer-module" is the component's file name in the
  //         Turbopack CSS-module class ("MasonryContainer-module-scss-module__
  //         <hash>__queries"); the hash churns per build, the file name does not.
  //   box   FEED's parentElement — the provider's padded box (padding 16/16),
  //         the element its ResizeObserver reads.
  //   COL / SITE_GAP / MAX_COLS  MasonryProvider defaults; cardSizes.image is 320.
  const FEED = ':is([class*="MasonryContainer-module"], [class*="_queries"])';
  const HOST = 'main';
  const COL = 320;
  // The site's own gap, and the ONLY one this math may use. Rule 12 renders an
  // 8px gutter, but Civitai still reserves 336px per column whatever CSS does —
  // it sizes the feed and picks the column count from that number alone. Sizing
  // the box to the tighter 328 therefore asks for a column count it will never
  // choose: measured 2026-09-07 on /models, the box came out 1633px wide, the
  // site still rendered 4 columns into a 1328px feed, and the 305px left over
  // became a 172px margin down each side. So the zoom targets the site's
  // geometry and the narrower gutter is spent as a little extra edge instead.
  const SITE_GAP = 16;
  const SITE_PITCH = COL + SITE_GAP;
  const MAX_COLS = 7;
  // Two column counts fill any width: the site's own k (zoom > 1, bigger cards)
  // and k + 1 (zoom < 1, one more column). 'nearest' takes whichever scale is
  // closer to 1 — the least visible change; 'more' / 'fewer' force a side.
  const DENSITY = 'nearest';
  // Outside this band the fit would read as a wrong browser zoom: above 1.5 the
  // 450px sources start to look soft, below 0.75 the card text stops being text.
  const ZOOM_MIN = 0.75;
  const ZOOM_MAX = 1.5;
  const ZOOM_VAR = '--nix-civitai-zoom';
  const root = document.documentElement;

  // Write-guarded: the site's ResizeObserver reacts to every zoom change, and
  // a rewrite of the same value would still be a change to it.
  const setZoom = (z) => {
    const next = z ? z.toFixed(4) : '';
    if (root.style.getPropertyValue(ZOOM_VAR) === next) return;
    if (next) root.style.setProperty(ZOOM_VAR, next);
    else root.style.removeProperty(ZOOM_VAR);
  };

  const fit = () => {
    // Detail pages carry masonries too (a model's gallery and Suggested
    // Resources), and so do search, collections and storylines — where a zoom
    // shrank the page or overlapped the cards. Only the two feed families fit.
    if (routeNow !== 'media' && routeNow !== 'models') return setZoom(0);
    const feed = document.querySelector(FEED);
    const host = feed && feed.closest(HOST);
    const box = feed && feed.parentElement;
    if (!feed || !host || !box) return setZoom(0); // not a feed page → stock
    const combined = parseFloat(feed.style.width);
    // No width yet (first mount, or the single-column layout under 672px):
    // keep whatever is set rather than flashing to stock and back.
    if (!Number.isFinite(combined)) return;
    // The site's own declaration doubles as the drift check: (320·k + 16·(k−1)
    // + 16) / 336 is an integer only while COL and GAP still hold. Anything
    // else means the site retuned its masonry — degrade to stock, never guess.
    if (!Number.isInteger((combined + SITE_GAP) / SITE_PITCH)) return setZoom(0);
    const cs = window.getComputedStyle(box);
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    // Bounding rects are in real (zoomed) px; computed padding is in the box's
    // own (unzoomed) px. R is therefore the width the box fills whatever the
    // zoom, and the one number every candidate is derived from.
    const R = box.getBoundingClientRect().width;
    if (!(R > 0)) return;
    const stock = Math.min(Math.floor((R - pad + SITE_GAP) / SITE_PITCH), MAX_COLS);
    // Exactly k columns fill R when the box measures k·PITCH − GAP + pad of its
    // own px. The −1 keeps float rounding from landing the site on k − 1: the
    // block ends up 1 real px short of the box, never 1 px over.
    // The SITE's pitch, not ours. It reserves 336px per column whatever CSS
    // renders, so sizing the box to our tighter 328 asks it for a column count
    // it will never choose: measured 2026-09-07 on /models, the box came out
    // 1633px, the site still picked 4 columns and stamped a 1328px feed inside
    // it, and the 305px left over showed up as 172px margins down both sides.
    const zoomFor = (k) => (R - 1) / (k * SITE_PITCH - SITE_GAP + pad);
    const ok = (k) => k >= 1 && k <= MAX_COLS && zoomFor(k) >= ZOOM_MIN && zoomFor(k) <= ZOOM_MAX;
    const order = DENSITY === 'more' ? [stock + 1, stock]
      : DENSITY === 'fewer' ? [stock, stock + 1]
        : [stock, stock + 1].sort((a, b) => Math.abs(Math.log(zoomFor(a))) - Math.abs(Math.log(zoomFor(b))));
    const k = order.find(ok);
    setZoom(k ? zoomFor(k) : 0);
  };

  // Coalesce a mutation burst into one sweep per frame.
  //
  // THE OBSERVER ROOT IS document.body + subtree, AND THAT IS NOW A MEASURED
  // DECISION, not a pending follow-up. Doctrine here is "childList-only on
  // head/documentElement; never subtree on a large or virtualised DOM", and
  // Civitai's feed IS virtualised — so this is the documented exception, and it
  // earns that by numbers taken 2026-09-14 (throwaway Chromium 152, 1512x900,
  // signed out, no content blocker, ~2900 nodes under #main).
  //
  // STOCK page, three counting observers attached at once, records received:
  //
  //   root                        idle 10s     scroll 13.9k px in 5.2s
  //   body      + subtree             3                1447
  //   #main     + subtree             2                 563
  //   .scroll-area + subtree          0                 563
  //
  // So 886 of the 1447 (61%) come from OUTSIDE #main. Enumerated: all 201 nodes
  // outside #main are ad-tech — zero-height divs, tracking pixels (iiq_pixel,
  // quantserve, ad-score, flashtalking) and cross-origin iframes appended
  // straight to <body>. Nothing this pass looks for lives there.
  //
  // AND NARROWING THE ROOT BUYS NOTHING. Same page, this script injected, sweep
  // timed at its own entry and exit:
  //
  //   /images   root=body   idle: 0 sweeps  ·  scroll: 127 kicks -> 47 sweeps,
  //                         77.3ms total, p50 1.1, p95 5.8, max 18.8
  //   /images   root=#main  idle: 0 sweeps  ·  scroll: 129 kicks -> 49 sweeps,
  //                         71.3ms total, p50 1.3, p95 4.3, max 5.9
  //   /models   root=body   idle: 0 sweeps  ·  scroll:  47 kicks -> 43 sweeps,
  //                         40.8ms total, p50 0.8, p95 1.7, max 2.4
  //   /models   root=#main  idle: 0 sweeps  ·  scroll:  41 kicks -> 41 sweeps,
  //                         37.7ms total, p50 0.8, p95 1.7, max 2.0
  //
  // 61% fewer RECORDS, 0% fewer SWEEPS — because the virtualiser dirties the
  // feed on the same frames the ad stack dirties <body>, and this coalescer has
  // already collapsed both into one sweep. 77.3ms of sweep across 5.2s of
  // continuous hard scrolling is 1.4% of wall clock, and an IDLE feed costs
  // exactly zero sweeps, not "a sweep per frame" as the old comment here
  // claimed. The saving is inside the noise; the risk is not:
  //   · #main would need a fallback branch for a route that has not built it,
  //   · and the ad slots this pass tags would have to be proven to live inside
  //     it forever. Measured 2026-09-14 with the ad CDN blocked, the "Become a
  //     Member to turn off ads today" upsell rendered 3x on /models and every
  //     instance was inside #main — but the adblock-plea <img> never rendered at
  //     all in this rig, so half that proof is missing.
  // Trading a real correctness surface for an unmeasurable gain is the wrong
  // way round. Re-open this only if a sweep ever costs more than a frame:
  // /images' max of 18.8ms is the one sample that did, once in 47.
  //
  // (#main, main, div.scroll-area and body all kept node identity across
  // /images -> /models -> /videos -> an image detail page -> Back, so root
  // choice is not what would make this rot.)
  let queued = 0;
  const kickSweep = () => {
    if (torn || queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      // A queued frame outlives teardown, and a sweep after it would re-dock the
      // bar and re-remove the footer teardown had just put back.
      if (torn) return;
      sweep();
    });
  };

  // ── Fullscreen slider ─────────────────────────────────────────────────────
  // A feed card links to /images/<id>, and that detail page is a whole route
  // load for one picture already on screen. So the click never gets there: it
  // opens a full-viewport slider over the grid, and Escape puts it back.
  //
  // One item per viewport, y-mandatory scroll snapping, Escape to leave —
  // built as an OVERLAY rather than by restyling the feed. This masonry is
  // virtualised, every card carrying an inline top/height the site computed,
  // and restyling it in place is the fight that already broke scrolling once
  // (see rule 12b). An overlay leaves that geometry untouched, which is also
  // what makes the return free: the grid never moved, so there is no scroll
  // position to restore.
  //
  // NOTHING IS FETCHED. Each slide reuses the card's own src verbatim, so the
  // browser serves it from cache and opening the slider costs no network. An
  // earlier version rewrote the URL's "width=450" to 1920 for the native file;
  // that is a download per slide, and sharpness is not worth the wait.
  const CARD_SEL = 'div.relative.flex.overflow-hidden.rounded-md';
  const CIVITAI_MEDIA = /image\.civitai\.com/;

  const mediaSrc = (el) => {
    if (!el) return '';
    const inner = el.querySelector ? el.querySelector('source') : null;
    return String(el.currentSrc || el.src || (inner && inner.src) || el.poster || '');
  };
  // Only cards whose media is Civitai's own. The feed also carries promo tiles
  // (a "/pricing" card served from /_next/image, measured 2026-09-07) and
  // sliding one of those full-screen would be nonsense.
  const IMAGE_HREF = /^\/images\/(\d+)/;
  const cardLink = (card) => card.querySelector('a[href^="/images/"]');
  // The clicked card's OWN feed (home carries eleven), only cards that link to
  // an image record, in reading order: rows top to bottom, then left to right.
  // The DOM order is column-major — the first ten cards measured 2026-10-31
  // all sat in column 1 — so ArrowRight used to walk down one column.
  const viewerCards = (feed) =>
    [...feed.querySelectorAll(CARD_SEL)]
      .filter((c) => cardLink(c) && CIVITAI_MEDIA.test(mediaSrc(c.querySelector('img, video'))))
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .sort((a, b) => (Math.abs(a.r.top - b.r.top) > 4 ? a.r.top - b.r.top : a.r.left - b.r.left))
      .map((x) => x.c);

  let viewEl = null;
  let passClick = false;
  let viewFeed = null;
  let viewCur = null;
  let infoEl = null;
  let moreTimer = 0;
  const genCache = new Map();
  // Held, not discarded: an IntersectionObserver whose root is removed keeps
  // observing detached slides until it is collected, and a torn-down copy must
  // leave nothing that can still call play() on a node the page no longer owns.
  let viewIo = null;

  const closeView = () => {
    if (viewIo) viewIo.disconnect();
    viewIo = null;
    if (moreTimer) clearTimeout(moreTimer);
    moreTimer = 0;
    if (viewEl) viewEl.remove();
    viewEl = null;
    viewFeed = null;
    viewCur = null;
    infoEl = null;
  };

  const slideFor = (card) => {
    const media = card.querySelector('video, img');
    const slide = document.createElement('div');
    slide.className = 'nix-civitai-slide';
    slide.dataset.href = cardLink(card).getAttribute('href');
    const isVideo = media.tagName === 'VIDEO';
    const node = document.createElement(isVideo ? 'video' : 'img');
    node.className = 'nix-civitai-view-media';
    node.src = mediaSrc(media);
    if (isVideo) {
      node.loop = true;
      node.muted = true;
      node.playsInline = true;
      node.controls = true;
      // Only the slide being looked at plays. Autoplaying every video in the
      // list at once is how a gallery of forty becomes a stalled tab.
      node.preload = 'none';
    }
    slide.appendChild(node);
    return slide;
  };

  // Sharp media for the slide being looked at, and only that one: the feed's
  // src is a 450px (video) or 800px (image) rendition. width=1920 is served for
  // both, capped at the source's own size — measured 2026-10-31: an image went
  // 800px to a 1.0 MB JPEG (original=true is a 2.3 MB PNG), a video 450 to its
  // native 1080 (0.76 MB to 1.47 MB). The swap happens after the bigger file
  // has loaded, so the slide never goes blank.
  const SHARP = 'width=1920';
  const sharpen = (slide) => {
    const node = slide.querySelector('.nix-civitai-view-media');
    if (!node || slide.dataset.sharp) return;
    slide.dataset.sharp = '1';
    const parts = node.src.split('/');
    if (parts.length < 2 || !/width=\d+/.test(parts[parts.length - 2])) return;
    parts[parts.length - 2] = parts[parts.length - 2].replace(/width=\d+/, SHARP);
    const url = parts.join('/');
    if (node.tagName === 'VIDEO') {
      const t = node.currentTime;
      node.src = url;
      node.currentTime = t;
      if (slide === viewCur) node.play().catch(() => {});
      return;
    }
    const pre = document.createElement('img');
    pre.onload = () => { if (node.isConnected) node.src = url; };
    pre.src = url;
  };

  const appendSlides = (cards) => {
    const have = new Set([...viewEl.children].map((s) => s.dataset && s.dataset.href));
    for (const c of cards) {
      const href = cardLink(c).getAttribute('href');
      if (have.has(href)) continue;
      have.add(href);
      const slide = slideFor(c);
      viewEl.insertBefore(slide, infoEl);
      if (viewIo) viewIo.observe(slide);
    }
  };

  // The feed is virtualised and infinite: reaching the last slide scrolls the
  // grid underneath to its end, which is what makes the site load the next
  // page, then appends whatever new cards arrived. Three tries, a second apart.
  const loadMore = (tries) => {
    if (!viewEl || !viewFeed || tries <= 0) return;
    const scroller = viewFeed.closest('.scroll-area');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    moreTimer = setTimeout(() => {
      moreTimer = 0;
      if (!viewEl) return;
      const before = viewEl.querySelectorAll('.nix-civitai-slide').length;
      appendSlides(viewerCards(viewFeed));
      if (viewEl.querySelectorAll('.nix-civitai-slide').length === before) loadMore(tries - 1);
    }, 1000);
  };

  const fillInfo = () => {
    if (!infoEl || !viewCur) return;
    const m = IMAGE_HREF.exec(viewCur.dataset.href || '');
    const id = m && Number(m[1]);
    const render = (data) => {
      if (!infoEl) return;
      infoEl.textContent = '';
      const add = (head, text) => {
        if (!text) return;
        const h = document.createElement('h4');
        h.textContent = head;
        const p = document.createElement('p');
        p.textContent = text;
        infoEl.append(h, p);
      };
      if (!data) { add('Generation data', 'Not available for this item.'); return; }
      const meta = data.meta || {};
      add('Prompt', meta.prompt);
      add('Negative prompt', meta.negativePrompt);
      const params = [
        meta.sampler && 'Sampler: ' + meta.sampler,
        meta.steps && 'Steps: ' + meta.steps,
        meta.cfgScale && 'CFG: ' + meta.cfgScale,
        meta.seed && 'Seed: ' + meta.seed,
        meta.width && meta.height && 'Size: ' + meta.width + ' x ' + meta.height,
      ].filter(Boolean).join('\n');
      add('Parameters', params);
      const res = (data.resources || []).map((r) =>
        [r.modelName || r.name, r.versionName && '(' + r.versionName + ')', r.modelType || r.type,
          r.strength != null && 'x' + r.strength].filter(Boolean).join(' '));
      add('Resources', res.join('\n'));
      if (!infoEl.childElementCount) add('Generation data', 'None recorded.');
    };
    if (!id) return render(null);
    if (genCache.has(id)) return render(genCache.get(id));
    infoEl.textContent = 'Loading...';
    // The detail page's own tRPC call, image.getGenerationData, same-origin
    // with the session cookie (measured 2026-10-31: 200, prompt, sampler, seed
    // and resources). The public /api/v1/images returned meta: null for all
    // 20 images sampled, which is why it is not used. Any failure renders
    // "not available" — the viewer itself never depends on this.
    const input = encodeURIComponent(JSON.stringify({ json: { id, authed: true } }));
    fetch('/api/trpc/image.getGenerationData?input=' + input, { credentials: 'same-origin', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const data = j && j.result && j.result.data && j.result.data.json;
        genCache.set(id, data || null);
        if (viewCur && (IMAGE_HREF.exec(viewCur.dataset.href || '') || [])[1] === String(id)) render(data);
      })
      .catch(() => render(null));
  };

  const toggleInfo = () => {
    if (!viewEl) return;
    if (infoEl) { infoEl.remove(); infoEl = null; return; }
    infoEl = document.createElement('div');
    infoEl.className = 'nix-civitai-info';
    viewEl.appendChild(infoEl);
    fillInfo();
  };

  const openView = (card) => {
    viewFeed = card.closest(FEED);
    const cards = viewerCards(viewFeed);
    const start = Math.max(0, cards.indexOf(card));
    viewEl = document.createElement('div');
    viewEl.className = 'nix-civitai-view';
    for (const c of cards) viewEl.appendChild(slideFor(c));
    // Clicking the matte closes; clicking the media itself does not, so a
    // video's own controls stay usable.
    viewEl.addEventListener('click', (e) => {
      if (e.target === viewEl || e.target.classList.contains('nix-civitai-slide')) closeView();
    });
    document.body.appendChild(viewEl);
    // Jump to the clicked one BEFORE snapping is observed, so opening does not
    // animate a scroll through everything above it.
    const target = viewEl.children[start];
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (self.IntersectionObserver) {
      viewIo = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const v = e.target.querySelector('video');
          if (e.isIntersecting) {
            viewCur = e.target;
            sharpen(e.target);
            if (v) v.play().catch(() => {});
            if (infoEl) fillInfo();
            const slides = viewEl.querySelectorAll('.nix-civitai-slide');
            if (e.target === slides[slides.length - 1] && !moreTimer) loadMore(3);
          } else if (v) v.pause();
        }
      }, { root: viewEl, threshold: 0.5 });
      for (const slide of viewEl.children) viewIo.observe(slide);
    }
  };

  // Enter leaves the viewer for the item's own page — the site's own link is
  // clicked when it is still mounted, so it is a client-side route change.
  // Cmd/Ctrl+Enter opens it in a new tab and keeps the viewer.
  const openCurrent = (newTab) => {
    const href = viewCur && viewCur.dataset.href;
    if (!href) return;
    if (newTab) { window.open(href, '_blank', 'noopener'); return; }
    closeView();
    const a = document.querySelector('a[href="' + CSS.escape(href) + '"]');
    // The card's own link is clicked so the site routes client-side — and
    // that click must not be read as a fresh card click and reopen the viewer
    // (it did, measured 2026-10-31), hence the one-shot pass.
    if (a) { passClick = true; a.click(); passClick = false; }
    else location.assign(href);
  };

  // Snapping already handles the wheel and the trackpad; this is for the keys.
  // Paging by viewport height lands on the next snap point without needing to
  // track an index that the list could invalidate.
  const stepView = (dir) => {
    if (!viewEl) return;
    viewEl.scrollBy({ top: dir * viewEl.clientHeight, behavior: 'instant' });
  };

  // @run-at is document-start so rule 1-3 beat first paint, but this pass needs
  // body — hence the one gate, rather than a second script at document-end.
  let observer = null;
  // ── Header autohide (rule 1) ─────────────────────────────────────────────
  //
  // ONE writer for the attribute, from two inputs that cannot clobber each
  // other: scroll direction and keyboard focus inside the header. Writes only
  // on a state change. Focus is gated on the reader having acted (a keydown or
  // pointerdown) — thumbwall measured a site autofocusing its search box, which
  // made a plain :focus-within reveal true from load; the gate costs nothing
  // here and keeps that failure from ever arriving with a Civitai change.
  const HDR_ATTR = 'data-nix-civitai-hdr';
  const HDR_VAR = '--nix-civitai-hdr-h';
  const HDR_TOP_PX = 48;          // thumbwall's NIX_TOPBAR_BAND
  const HDR_DELTA_MIN = 6;        // under a fast wheel step, over trackpad noise
  let hdrScrollShow = true;
  let hdrFocusShow = false;
  let hdrHidden = false;
  let hdrLastY = 0;
  let hdrActed = false;
  const hdrSync = () => {
    const hide = !(hdrScrollShow || hdrFocusShow);
    if (hide === hdrHidden) return;
    const header = document.querySelector('header');
    // Measured at the moment it hides, while it still has its height: the
    // signed-out and signed-in headers need not match, and a fixed 60 would
    // leave a sliver or eat a row the day one of them changes.
    if (hide && header && header.offsetHeight) {
      root.style.setProperty(HDR_VAR, header.offsetHeight + 'px');
    }
    hdrHidden = hide;
    if (hide) root.setAttribute(HDR_ATTR, 'hidden');
    else root.removeAttribute(HDR_ATTR);
  };
  const hdrOnScroll = (e) => {
    const el = e.target;
    if (torn || !el || el.nodeType !== 1 || !el.classList.contains('scroll-area')) return;
    // The page's own scroller only. The Notifications drawer and the
    // generator panel are .scroll-area too (measured 2026-10-31): scrolling
    // either hid the header, and it stayed hidden after the drawer closed.
    if (!el.querySelector('main')) return;
    const y = el.scrollTop;
    const delta = y - hdrLastY;
    hdrLastY = y;
    if (y <= HDR_TOP_PX) hdrScrollShow = true;
    else if (delta > HDR_DELTA_MIN) hdrScrollShow = false;
    else if (delta < -HDR_DELTA_MIN) hdrScrollShow = true;
    hdrSync();
  };
  const hdrFocus = () => {
    const header = document.querySelector('header');
    hdrFocusShow = !!(hdrActed && header && header.contains(document.activeElement));
    hdrSync();
  };

  const start = () => {
    // A copy torn down before its bootstrap listener fired must NOT mount. The
    // { signal } on that listener already removes it, so this is belt to those
    // braces — and free.
    if (torn) return;
    sweep();
    // Capture phase, because the card's own <a> would otherwise hand the click
    // to Next's router before it bubbles anywhere useful. Verified: the URL
    // does not change.
    on(document, 'click', (e) => {
      if (viewEl || passClick) return;
      // A modified or non-primary click is the reader asking for the link
      // itself (new tab, new window, download): never intercepted.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const card = e.target.closest && e.target.closest(CARD_SEL);
      if (!card || !card.closest(FEED) || !cardLink(card)) return;
      if (!CIVITAI_MEDIA.test(mediaSrc(card.querySelector('img, video')))) return;
      e.preventDefault();
      e.stopPropagation();
      openView(card);
    }, { capture: true });
    on(document, 'keydown', (e) => {
      if (!viewEl) return;
      if (e.key === 'Escape') { e.preventDefault(); closeView(); return; }
      if (e.key === 'Enter') { e.preventDefault(); openCurrent(e.metaKey || e.ctrlKey); return; }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleInfo(); return; }
      const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
        : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      stepView(dir);
    }, { capture: true });
    observer = new MutationObserver(kickSweep);
    observer.observe(document.body, { childList: true, subtree: true });
    // Civitai is a Next.js SPA: pushState never re-runs the script, and the
    // observer alone can miss a route that swaps a subtree in one batch.
    if (self.navigation) on(self.navigation, 'navigatesuccess', kickSweep);
    // A window resize changes R and nothing in the DOM, so no mutation reports
    // it; the site's own observer is debounced 100ms, so this lands first.
    on(window, 'resize', kickSweep);
    // scroll does not bubble; capture sees the one .scroll-area wherever a
    // route remounts it, with no node of the site's held between routes.
    on(document, 'scroll', hdrOnScroll, { capture: true, passive: true });
    on(document, 'keydown', () => { hdrActed = true; }, { capture: true });
    on(document, 'pointerdown', () => { hdrActed = true; }, { capture: true });
    on(document, 'focusin', hdrFocus);
    on(document, 'focusout', () => requestAnimationFrame(hdrFocus));
    // A route change starts the new page at the top with the header shown.
    if (self.navigation) on(self.navigation, 'navigatesuccess', () => { setRoute(); hdrScrollShow = true; hdrLastY = 0; hdrSync(); });
  };
  if (document.body) start();
  else on(document, 'DOMContentLoaded', start, { once: true });

  // One more sweep at load, plus the masonry's resize: the feed is measured,
  // sizing its container once from the available box, so removing ~200px of
  // chrome above it can leave a stale height, and one coalesced resize makes
  // it re-measure. The sweep here is a backstop only — the observer has
  // normally run it long before load fires, which on an ad-heavy page can be
  // many seconds late (measured: not fired 7s in).
  let kickFrame = 0;
  const kick = () => {
    kickFrame = requestAnimationFrame(() => {
      kickFrame = 0;
      if (torn) return;
      sweep();
      window.dispatchEvent(new Event('resize'));
    });
  };
  if (document.readyState === 'complete') kick();
  else on(window, 'load', kick, { once: true });

  // ── Teardown ──────────────────────────────────────────────────────────────
  //
  // Registered LAST, once everything it closes over exists. Order inside is the
  // contract: stop new work, then undo. Every step is written to be a no-op
  // against a page this copy never got far enough to change, because the entry
  // call above can land on a copy that threw or was torn mid-pass.
  window[TEARDOWN] = () => {
    torn = true;
    ac.abort();                                   // every listener, incl. bootstrap
    if (observer) observer.disconnect();
    observer = null;
    if (queued) cancelAnimationFrame(queued);
    queued = 0;
    if (kickFrame) cancelAnimationFrame(kickFrame);
    kickFrame = 0;
    closeView();                                  // overlay + its IntersectionObserver
    root.removeAttribute(HDR_ATTR);
    root.style.removeProperty(HDR_VAR);
    root.removeAttribute(ROUTE_ATTR);
    root.removeAttribute(FILTER_ATTR);
    for (const el of document.querySelectorAll('.' + FILTER_BTN)) el.remove();
    for (const el of document.querySelectorAll('[' + OFF + ']')) el.removeAttribute(OFF);

    // Our own marks come off FIRST, while every marked node is still in the
    // document: the bar goes home next, and a home whose parent React already
    // discarded is unreachable from document.querySelectorAll afterwards.
    for (const el of document.querySelectorAll('[data-nix-civitai-ad]')) {
      el.removeAttribute('data-nix-civitai-ad');
    }
    for (const el of document.querySelectorAll('[data-nix-civitai-tagbar]')) {
      el.removeAttribute('data-nix-civitai-tagbar');
    }

    goHome(barHome);
    barHome = null;
    // Only while nothing else fills the slot — React may have mounted a
    // replacement footer since, and two footers is mangled, not stock.
    if (footerHome && !document.querySelector(FOOTER)) goHome(footerHome);
    footerHome = null;

    root.style.removeProperty(ZOOM_VAR);
    dropSheet();
    delete window[TEARDOWN];
  };
})();
