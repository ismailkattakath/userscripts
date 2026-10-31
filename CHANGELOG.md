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
- `publish` workflow: each `main` commit that passes both checks is
  fast-forwarded onto the `published` branch, which Greasy Fork's webhook syncs
  from. A version bump ships on merge, with no paste step.

## youtube-share-to-metube

### [3.0.0] - 2026-10-31

#### Renamed

- **@name** is now YouTube — Store to MeTube, beside Share. The old name ("Share becomes Store") is false since Share is no longer taken over. Violentmonkey matches an install by namespace and name, so 3.0.0 installs as a new entry beside 2.1.1; remove the old entry, or both run.

#### Changed

- **Share is Share again; Store is a chip of its own.** 2.x turned YouTube's
  Share button into Store on the premise that sharing stayed in the ⋯ menu.
  It did not: measured at 1512px, the ⋯ menu holds only "Download, Report",
  so 2.x removed sharing from the watch page. 3.0.0 leaves Share untouched and
  adds a red Store chip right after it. The chip copies Share's classes, icon
  wrapper and spacing at runtime, so it is the same 40px round button. Plain
  click is still audio/mp3, Alt-click still video/mp4, with the same request
  body.
- **Feedback moved onto the chip.** The bar is icon-only now, so 2.x's
  "Storing audio / Stored / Failed" label had nowhere to appear. Each state has
  its own glyph and fill: tray arrow on red (ready), clock on the stock grey
  (storing), check on green (stored), cross on dark red (failed). The
  accessible name and the open tooltip change in the same step. A click while
  one is still storing is ignored.
- **Own tooltip, YouTube's look.** YouTube's shared tooltip never fires for a
  control it did not build, so the chip shows its own popover with the class
  list of YouTube's, read at runtime: the same grey bubble, 16px below,
  centred. No `title` attribute, so no double tooltip.

#### Fixed

- **The chip appears however you reach the video.** 2.x matched only
  `/watch*`, and a userscript manager injects per page load, so home → click a
  video never armed it. `@match` is now `https://www.youtube.com/*` and the work
  is gated to `/watch` on each of YouTube's navigation events. Off `/watch` the
  script watches nothing; the page-wide observer for a late-drawn bar now runs
  only on `/watch` and only until Share appears.

#### Verified live

Signed out, 1280px, isolated context (no installed copy), bundle injected with
`GM_xmlhttpRequest` stubbed — no real request reached MeTube. Home → click a
video: chip after Share, Share's `aria-label` and glyph untouched. Stubbed ok,
error body and timeout gave check, cross, cross, each with matching name and
tooltip; Alt sent `video`/`mp4`, plain `audio`/`mp3`, a second click while
storing sent nothing. A trusted click on Share opened YouTube's share dialog,
Escape closed it. Related-video navigation kept the same chip node; a fresh
playlist load (injected at document start) drew the chip with no page-wide
observer left; theatre on and off kept it. Back to home: zero observers. A
second injection left one chip; teardown left the row stock.

## github-pulls-running-checks

### [2.5.1] - 2026-10-31

#### Fixed

- **Running jobs past the fifth had a blank right-hand cell.** Only five jobs
  get an elapsed clock (`ELAPSED_MAX`), and the rest looked broken. A running
  job's cell now says **running** until its clock arrives, and keeps it if no
  clock comes — past the cap, a failed lookup, or a check with no Actions job
  id.
- **A failed start-time lookup was remembered forever.** A non-2xx or network
  error was cached as "no start time", so that job never got a clock again in
  the tab. Only a found start time is cached now; a failure is retried on the
  next hover.
- Header text: the PR row's badge is now a progress count ("3/13 checks
  passing"), not one bit, and there is no 10-second group refresh — only the
  10-second panel cache.

#### Verified live

Signed out, isolated context, bundle injected. rust-lang/rust#165221 with ten
jobs running: five clocks ticking, five rows saying "running". With the
start-time requests forced to 503, all ten said "running"; re-triggering the
card (a synthetic `mouseover` on its trigger) re-asked the five start times
and the clocks appeared.

## google-photos-icon-nav

### [4.8.0] - 2026-10-26

#### Fixed

- **Opening a photo or video shows Google's own viewer, unmodified.** The viewer
  carries its own `[role="main"]` and `[role="menubar"]`, so 4.7.0's shell rules
  landed on it: both of the viewer toolbar's children were hidden and the bar went
  click-through, the backdrop turned black, and the burger floated over the photo.
  Every shell rule is now gated off while the URL has a `/photo/` segment, tracked
  with the Navigation API's `currententrychange` (pushState included). Closing the
  viewer restores the full-bleed grid with its scroll position intact.

## youtube-share-to-metube

### [2.1.1] - 2026-10-31

#### Fixed

- **Share stayed Share on a fresh page load.** YouTube now draws the Share
  button after its last `yt-page-data-updated` event (~3.5 s into a full load,
  measured). The script tried for 40 frames, then waited for a navigation event
  that never came. The selectors and icon path still matched. Dispatching that
  one event by hand marked the button at once, so only the trigger was missing.
  When the 40 frames run out, a `MutationObserver` on the document now keeps
  watching. It runs only while the button is missing, and it batches each burst
  of DOM changes into one check per frame.

## youtube-share-to-metube

### [2.1.0] - 2026-09-22

#### Fixed

- **A plain click stores mp3, not mp4.** 2.0.0 sent `format: "mp4"` and no
  `download_type`, so every click landed as video regardless of the operator's
  MeTube default. That default is unreachable: it lives in the `localStorage` of
  MeTube's web UI on the `127.0.0.1` origin, and no endpoint exposes it
  (`/config` and `/api/config` both 404; only `/version` and `/history` answer).
  Leaving the fields out does **not** inherit it either - measured against the
  live instance, a body of `url` + `auto_start` alone is accepted and recorded as
  `download_type: "video", format: "any"`. Silence means video. So the format is
  now stated, and `download_type` - the field 2.1.0's predecessor dropped as "not
  required" - is exactly the switch that selects audio.

#### Added

- **Alt-click stores the video instead.** A plain click sends
  `audio`/`mp3`, `Alt` (`⌥`) sends `video`/`mp4`. The chip names which before it
  sends - **Storing audio** / **Storing video** - so the modifier is never silent
  about what it just did, and the idle accessible name and tooltip read
  **Store — Alt (⌥) click for video** so the modifier is discoverable without
  being guessed. The accessible name opens with the visible label, keeping it a
  superset of the pixels rather than a second name for the same control.

#### Notes

- **Both paths verified end to end through a real install** - the MeTube leg that
  2.0.0 could only reason about, because `GM_xmlhttpRequest` exists solely inside
  a userscript manager. A plain click queued `download_type: "audio"`,
  `format: "mp3"` and ran to done; an Alt-click queued `"video"` / `"mp4"`.
- The chip widens while it names the format - 95px at "Store", 145px at
  "Storing audio". Nothing else in the bar moves: the `⋯` button held `x=718`
  across every word tested, so the growth is absorbed inside the row rather than
  shoving its neighbours for the 1.6s a flash lasts.

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

### [2.0.1] - 2026-10-31

#### Fixed

- **The sort-and-filters button was a 28px square beside the 32px round
  gear.** Mantine sizes its icon buttons through inline `--ai-size` and
  `--ai-radius` and colours them by `data-variant`; the button now copies
  those from the gear as well as its classes, and its icon is 16px like the
  gear's. Measured on the signed-in /images: 32px, 32px radius, same centre.

#### Verified live (2.0.0, signed in)

The button sits between the docked tag bar and the gear; one click showed
"Everyone · Most Reactions · Filters", a second hid it. Scrolling the
Notifications drawer by 1200px left the header shown.

### [2.0.0] - 2026-10-31

A UX study of every Civitai category (four read-only passes over feeds and
detail pages, 2026-10-31) found the image-feed treatment applied to every
route, because Civitai uses one masonry component almost everywhere. 2.0.0
scopes each rule to the route it was written for. The major version is
because cards on six route families change back to stock.

#### Changed

- **Route profiles.** `<html data-nix-civitai-route>` is set from the URL:
  `media` (/images, /videos) keeps media-only cards, the 8px grid and the
  width fit; `models` (/models, /3d-models) keeps the width fit with stock
  cards; `model` and `post` get their own rules; every other route gets the
  theme, the autohiding header and the chrome rules only.
- **Model page: slim sidebar.** Download (with variants and sizes), the
  Details panel (type, stats, reviews, published, base model, hash, trigger
  words) and the license are visible again. Create, Collection, Tensors,
  About this version, the creator card and the promo are hidden by name; a
  block the script cannot find stays visible. The model title shows.
- **Feed sort and filters**: one button beside the gear shows Civitai's own
  controls in place.
- **Viewer**: Enter opens the item's page (Cmd/Ctrl+Enter in a new tab); `i`
  shows the prompt, negative prompt, parameters and resources for the current
  slide; arrows move in reading order (rows, then columns); the current slide
  loads a sharp 1920px rendition; reaching the last slide loads more.
- **Post pages**: every image fits the window height.

#### Fixed

- **Clicking a card on /models, /3d-models, /articles, /comics and
  /challenges opened the image viewer** and never reached the page. The viewer
  now opens only for cards linking to /images/<id>, and never for a modified
  or non-primary click.
- **Search showed 0 of 982 results and /crucibles one row of 140px tiles**:
  the grid override (old rule 12b) is removed.
- **Collections overlapped by 43px** with the Filters button covered: the
  grid and zoom rules no longer run there.
- **Model, article and comic cards lost their titles**: rule 6 runs on the
  media feeds only.
- **The header hid when the Notifications drawer or the generator panel
  scrolled**, and stayed hidden (1.26.0): only the page's own scroller counts.
- **Nav labels were back** (Civitai dropped the label's class): re-keyed on
  the link's shape.
- **A 181px blank band** sat above feeds, home and /challenges: the
  announcement wrapper collapses too.
- **Discussion leaked onto model pages**: found by its heading now.
- **A 90px empty ad box** on image pages: hidden by `data-adhesive-ad`.
- **Home's settings button has a different label**: matched by prefix.

#### Verified live

Clean isolated context at 1512px, with the bundle injected per route:
/models card click opened the model page (zoom cleared, sidebar 394px with
Download, Details and License; Create, Tensors and the creator card hidden;
Discussion hidden; title shown). Search: 12 cards at 320px in a 3-column
grid. /crucibles: tiles 320x411, matching stock. Collection: smallest
vertical gap 16px, title and Filters visible. /images viewer: first four
slides on one row in left-to-right order; current slide swapped to the
1920px rendition (2200x3215 natural); `i` panel showed prompt, parameters and
resources and followed ArrowRight; Enter opened /images/<id>; reaching the
end grew 25 slides to 71, all unique. /articles: 16 of 19 cards titled, a
click opened the article. Post: 12 images at 568x852 in a 949px window.
civitai.red home: 23 media items, no zoom, nothing tagged. Teardown left no
attribute, button, tag, stylesheet or global.

### [1.26.0] - 2026-10-31

#### Changed

- **The header autohides instead of being hidden for good.** Hiding it took
  Sign In, search, the account menu (settings, browsing level, sign out),
  notifications and Create with it, so a signed-out visitor had no way to sign
  in (operator report). It now hides while you scroll down and comes back when
  you scroll up, and it is always shown near the top. The rules match
  thumbwall's top bar. The mechanism differs because Civitai's header is a
  static flex item above the one scrolling column, not a fixed bar: its slot
  collapses through a negative top margin of its measured height, animated
  over 180 ms, instead of being translated away and leaving a blank band.
  Focus inside the header also shows it, but only after a real keydown or
  pointerdown.

#### Verified live

Signed out, 1280px, /images: header shown at the top, hidden after 1500px of
downward scroll, back after 180px up, hidden again on the next scroll down,
shown at the top. A trusted click on Sign In opened the login page (Discord,
Google, GitHub, email link). Two injections leave one stylesheet; 8 scroll
steps made 1 attribute write; teardown leaves no attribute, no custom property
and a 0px margin.

### [1.25.1] - 2026-10-31

#### Fixed

- **1.25.0 blanked the home page.** The new adblock placeholder is an
  `a[href="/pricing"]` wrapping its image. On the home page that link is a
  direct child of the container holding all 22 sections. 1.25.0's ad sweep
  walked up from the image to the first ancestor containing a `/pricing` link,
  which was that container, and hid it. The sweep now tags the link itself, or
  its card when the link is a feed card's only child. As a backstop, the walk
  never tags an element with more than one child. Measured on civitai.red/.

### [1.25.0] - 2026-10-31

#### Fixed

- **Most of the declutter had stopped working.** Civitai's build now minifies
  its CSS-module class names: `MasonryContainer-module-scss-module__<hash>__queries`
  became `Rvq10W_queries`. The script keyed on the component FILE names, which
  are gone, so the full-width fit, the media-only cards, the filter-group hide,
  the cosmetic-frame removal and the tag-bar dock all went dead. Only the
  header, footer and other plain-tag rules kept working. Every hook now keys on
  the LOCAL name instead (`_queries`, `_filtersWrapper`, `_cssFrame`, a card's
  `_content`, `_scrollContainer`), through `:is(old, new)` so either build
  matches. Measured on /images, /videos, /models and a model page.
- **Model page: the sidebar and title came back.** Mantine's `Grid-inner`,
  `Grid-col` and `Stack-root` became Civitai's own `gridInner`, `gridCol` and
  `_stack` there. Both forms now match.
- **Adblock placeholder tiles showed in the feed.** Their image alt changed to
  "Support Civitai creators" (3 per /videos page). The ad sweep matches both alts.

#### Verified live

Isolated context, signed out, 1280px: the masonry filled 1253 of 1269px at zoom
0.9435 (stock: 992px, centred), 0 of 70 card overlays left showing, cosmetic
gradients gone, filter group hidden. /models: header and footer hidden on every
card, 8px column gap. Model page: sidebar and title hidden, media shown. Signed
in, the tag bar docks beside the settings gear (710px). Two injections leave
one stylesheet; a card click opens one viewer, Escape closes it; teardown
returns the page to stock.

## civitai-declutter

### [1.24.1] - 2026-10-30

#### Changed

- **Header comments only, no behaviour change.** Three comments compared this
  script with scripts that are not in this repository; those references are
  gone. The version moves so the published copy matches the source.

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
