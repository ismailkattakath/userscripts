// ==UserScript==
// @name         Civitai — media-only feed, icon-only top bar
// @namespace    kattakath.com
// @author       Ismail Kattakath
// @license      MIT
// @version      1.23.0
// @description  Strips Civitai to media plus one icon-only top bar: feed cards show only the image or video, a model page keeps its carousel and gallery, and the header, footer, chat, ads, announcements, titles, stats and comments all go. The route's scrollable bar (feed tags, or a model's version picker) docks into the top bar, grid gaps and edges are a uniform 8px, surfaces are darkened, and the masonry fills the window's width.
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
(() => {
  'use strict';

  GM_addStyle(`
    /* 1. The header — nav, search, create button, notifications, buzz counter,
       account menu. On request, not a hide-for-decluttering choice like the
       other rules below, but the SAME mechanism: a plain rule beats a JS
       removal here too,
       because "header" is a stable tag-level handle (one per page, Civitai
       never uses a second <header>) and a stylesheet rule needs no observer to
       survive a route's remount — CSS just keeps matching whatever node is
       there. Measured 2026-09-06: header is a flex sibling of the scrolling
       column in a flex-column shell, and that column is already flex-1, so
       display:none reclaims its 60px the same way a DOM removal would —
       verified identical (scroll-area top 60→0, height +60) either way, with
       none of a JS removal's per-route re-application or single-frame flash
       on a fresh mount. */
    header {
      display: none !important;
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
    [class*="FeedFilters-module"] {
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
    #main div.sticky.top-0.z-50 .text-base.font-medium.capitalize {
      display: none !important;
    }
    #main div.sticky.top-0.z-50 a.mantine-Button-root {
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
    [class*="CosmeticWrapper-module"] {
      background: none !important;
      box-shadow: none !important;
    }
    [class*="CosmeticWrapper-module"]::before,
    [class*="CosmeticWrapper-module"]::after {
      background: none !important;
      box-shadow: none !important;
    }

    /* 6. Feed cards are MEDIA ONLY — and this is the one ALLOWLIST in the
       file, deliberately. Every other rule names a thing to hide, so each new
       piece of furniture Civitai ships renders raw until a rule catches up;
       this one names the two things to KEEP and hides the rest, so a new
       overlay fails closed. Same flip leolist-listings-only made at v1.51.0,
       for the same reason.

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
    [class*="MasonryContainer-module"] div.relative.flex.overflow-hidden.rounded-md > *:not(.relative.flex-1):not([class*="AspectRatioCard-module"]) {
      display: none !important;
    }
    [class*="MasonryContainer-module"] div.relative.flex.overflow-hidden.rounded-md > div.relative.flex-1 > *:not(a),
    [class*="MasonryContainer-module"] div.relative.flex.overflow-hidden.rounded-md > [class*="AspectRatioCard-module"] > *:not(a) {
      display: none !important;
    }
    [class*="MasonryContainer-module"] > * > [class*="mantine-Group-root"] {
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
    [class*="mainRegion"] > [class*="rail"] {
      display: none !important;
    }
    [class*="contentCol"] [class*="Grid-inner"] > [class*="Grid-col"]:not([class*="mainSection"]) {
      display: none !important;
    }
    [class*="contentCol"] > [class*="Stack-root"] > [class*="Stack-root"],
    [class*="contentCol"] > a,
    [class*="contentCol"] > div:not([class]),
    [class*="contentCol"] > div.flex.flex-col.gap-4 {
      display: none !important;
    }
    [class*="mainSection"] [class*="Spoiler-root"],
    [class*="mainSection"] .relative.w-full > *:not(a) {
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

    /* 10. The bottom ad rail (SEMRUSH etc.) — a direct child of the app shell and a
       SIBLING of the scrolling column, which is why it survives every route change.
       Identified by being the centered, top-bordered shell child rather than by its
       bg-gray-2/dark:bg-dark-9 pair, which is pure theming and likely to churn.
       Only rendered for a SIGNED-IN session: logged out the shell has just three
       children (header, the flex-1 column, a 0×0 absolute helper) and this matches
       nothing — a no-op, not a misfire. The site footer is nested inside the
       scrolling column, not here, so it is never caught by this rule. */
    #main > div > div.relative.flex.justify-center.border-t {
      display: none !important;
    }

    /* 11. Ad furniture that has NO durable class handle — hidden by MARKER, not by
       selector. The pass below only tags; this rule does the hiding. That split is
       the point: React re-creating a tagged node costs one re-tag, never a fight
       over a removal it will just undo. */
    [data-nix-civitai-ad] {
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
    [class*="MasonryContainer-module"] > * > * > .mx-auto.flex.justify-center {
      gap: 8px !important;
    }
    /* And the columns take the surplus, not the edges. The site sizes the feed
       for its own 16px gutter (320k + 16(k-1)) while these columns are a fixed
       320 each, so an 8px gutter leaves 8px per column unspent — measured as a
       24.6px margin against an 8px gap. Letting them flex to equal fractions
       spends it on the cards instead: 330px cards, 8px edges. */
    [class*="MasonryContainer-module"] .mx-auto.flex.justify-center > div {
      flex: 1 1 0 !important;
      width: auto !important;
    }
    [class*="MasonryContainer-module"] .flex.flex-col > div[style*="position: absolute"] {
      padding-top: 4px !important;
      padding-bottom: 4px !important;
    }
    [class*="MasonryContainer-module"] .flex.flex-col > div[style*="position: absolute"] > div.relative.flex.overflow-hidden.rounded-md {
      height: 100% !important;
    }
    #main div.\\@container[style*="padding-inline"] {
      padding-inline: 8px !important;
    }

    /* 12b. /models does not lay its feed out like rule 12's. It ships a spacer
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
    [class*="MasonryContainer-module"] div[style*="grid-template-columns"] {
      grid-template-columns: none !important;
      grid-auto-flow: column !important;
      grid-auto-columns: 1fr !important;
      column-gap: 8px !important;
    }
    [class*="MasonryContainer-module"] {
      width: 100% !important;
    }
    /* A creator cosmetic wraps its card in 6px of padding that a plain card
       does not have, so a wrapped card rendered 308px beside a neighbour's 320
       and the gutter alternated 28/16 down one row. Rule 5 already neutralises
       this wrapper's glow; dropping the padding is the rest of that job. */
    [class*="CosmeticWrapper-module"] {
      padding: 0 !important;
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
  `);

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
  const PLEA = 'img[alt="Please support civitai and creators by disabling adblock"]';
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
    '[class*="MasonryContainer-module"] .min-w-0.min-h-\\[26px\\]',
    '[class*="ModelVersionList-module"][class*="scrollContainer"]',
  ];
  const CUSTOMIZE_NAV_BTN = 'main > div.sticky.top-0.z-50 button[aria-label="Customize navigation"]'; // measured 2026-09-06

  const tag = (el) => {
    if (el.dataset.nixCivitaiAd === undefined) el.dataset.nixCivitaiAd = '';
  };

  const sweep = () => {
    for (const img of document.querySelectorAll(PLEA)) {
      // Stop at the first ancestor that RESERVES ad height or owns the pricing
      // link — those are the slot's own declarations, not incidental styling.
      let el = img.parentElement;
      for (let up = 0; el && up < MAX_UP; up++, el = el.parentElement) {
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
    if (footer) footer.remove();
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
          if (stale !== bar) stale.remove();
        }
        bar.dataset.nixCivitaiTagbar = '';
        row.insertBefore(bar, gear);
      }
    }
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
  const FEED = '[class*="MasonryContainer-module"]';
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

  // Coalesce a mutation burst into one sweep per frame. Cost is honest: the root
  // is body+subtree because neither container has a measured narrower home yet,
  // so a scroll through the virtualised feed pays one sweep per frame until it
  // does. Narrowing the root is the follow-up, and it needs a measurement.
  let queued = false;
  const kickSweep = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sweep();
    });
  };

  // ── Fullscreen slider ─────────────────────────────────────────────────────
  // A feed card links to /images/<id>, and that detail page is a whole route
  // load for one picture already on screen. So the click never gets there: it
  // opens a full-viewport slider over the grid, and Escape puts it back.
  //
  // This is leolist-listings-only's move (v1.34+, v1.43+) — one item per
  // viewport, y-mandatory scroll snapping, Escape to leave — but built as an
  // OVERLAY rather than by restyling the feed. There the list itself takes a
  // class because its rows are ordinary flow content; this masonry is
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
  const viewerCards = () =>
    [...document.querySelectorAll(FEED + ' ' + CARD_SEL)].filter((c) =>
      CIVITAI_MEDIA.test(mediaSrc(c.querySelector('img, video'))),
    );

  let viewEl = null;

  const closeView = () => {
    if (viewEl) viewEl.remove();
    viewEl = null;
  };

  const slideFor = (card) => {
    const media = card.querySelector('video, img');
    const slide = document.createElement('div');
    slide.className = 'nix-civitai-slide';
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

  const openView = (card) => {
    const cards = viewerCards();
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
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const v = e.target.querySelector('video');
          if (!v) continue;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      }, { root: viewEl, threshold: 0.5 });
      for (const slide of viewEl.children) io.observe(slide);
    }
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
  const start = () => {
    sweep();
    // Capture phase, because the card's own <a> would otherwise hand the click
    // to Next's router before it bubbles anywhere useful. Verified: the URL
    // does not change.
    document.addEventListener('click', (e) => {
      if (viewEl) return;
      const card = e.target.closest && e.target.closest(CARD_SEL);
      if (!card || !card.closest(FEED)) return;
      if (!CIVITAI_MEDIA.test(mediaSrc(card.querySelector('img, video')))) return;
      e.preventDefault();
      e.stopPropagation();
      openView(card);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (!viewEl) return;
      if (e.key === 'Escape') { e.preventDefault(); closeView(); return; }
      const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
        : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      stepView(dir);
    }, true);
    new MutationObserver(kickSweep).observe(document.body, { childList: true, subtree: true });
    // Civitai is a Next.js SPA: pushState never re-runs the script, and the
    // observer alone can miss a route that swaps a subtree in one batch.
    if (self.navigation) self.navigation.addEventListener('navigatesuccess', kickSweep);
    // A window resize changes R and nothing in the DOM, so no mutation reports
    // it; the site's own observer is debounced 100ms, so this lands first.
    window.addEventListener('resize', kickSweep);
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  // One more sweep at load, plus the masonry's resize: the feed is measured,
  // sizing its container once from the available box, so removing ~200px of
  // chrome above it can leave a stale height, and one coalesced resize makes
  // it re-measure. The sweep here is a backstop only — the observer has
  // normally run it long before load fires, which on an ad-heavy page can be
  // many seconds late (measured: not fired 7s in).
  const kick = () => requestAnimationFrame(() => {
    sweep();
    window.dispatchEvent(new Event('resize'));
  });
  if (document.readyState === 'complete') kick();
  else window.addEventListener('load', kick, { once: true });
})();
