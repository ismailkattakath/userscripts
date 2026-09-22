# userscripts

[![lint](https://github.com/ismailkattakath/userscripts/actions/workflows/lint.yml/badge.svg)](https://github.com/ismailkattakath/userscripts/actions/workflows/lint.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![conventions: Greasy Fork](https://img.shields.io/badge/conventions-Greasy%20Fork-670000.svg)](https://greasyfork.org/help/code-rules)

Userscripts that ship **alternative experiences for legacy web applications** —
redesigns, not tweaks.

One `.user.js` file per install unit at the repo root. **There is no build
step**: a userscript manager copies the file verbatim, so whatever is committed
here is exactly what runs in the browser. That is a deliberate constraint, not a
missing feature — it means the published artefact and the reviewable source are
the same bytes.

## Catalogue

<!-- Keep this table sorted by filename. One row per install unit. -->

| Script | Target | Published |
|---|---|---|
| `civitai-declutter.user.js` — **Civitai — media-only feed, icon-only top bar** | civitai.com · civitai.red · civitai.green — feed stripped to the media itself, one icon-only top bar, model pages keep carousel and gallery | [![Greasy Fork](https://img.shields.io/greasyfork/v/595761?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595761-civitai-media-only-feed-icon-only-top-bar) [![installs](https://img.shields.io/greasyfork/dt/595761)](https://greasyfork.org/en/scripts/595761-civitai-media-only-feed-icon-only-top-bar) |
| `github-pulls-running-checks.user.js` — **GitHub — running checks in the PR hovercard** | github.com — GitHub's own PR hovercard gains a checks section: failed jobs named, running jobs with a live elapsed clock | [![Greasy Fork](https://img.shields.io/greasyfork/v/595763?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595763-github-running-checks-in-the-pr-hovercard) [![installs](https://img.shields.io/greasyfork/dt/595763)](https://greasyfork.org/en/scripts/595763-github-running-checks-in-the-pr-hovercard) |
| `google-photos-icon-nav.user.js` — **Google Photos — full-bleed grid, nav in a drawer** | photos.google.com — full-bleed grid on black, top bar reduced to the avatar, Photos' labelled nav held off-canvas as a drawer | [![Greasy Fork](https://img.shields.io/greasyfork/v/595764?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595764-google-photos-full-bleed-grid-nav-in-a-drawer) [![installs](https://img.shields.io/greasyfork/dt/595764)](https://greasyfork.org/en/scripts/595764-google-photos-full-bleed-grid-nav-in-a-drawer) |
| `youtube-share-to-metube.user.js` — **YouTube — Share becomes Store, handing the video to MeTube** | www.youtube.com/watch — the Share button is relabelled Store on a red chip and hands the video to a local MeTube instead of opening the share sheet; sharing moves to the ⋯ menu | — *not yet listed* |

Everything here publishes to **[Greasy Fork](https://greasyfork.org)**. A script
targeting an adult site belongs on [Sleazy Fork](https://sleazyfork.org) instead
and lives in a different repository — Greasy Fork rejects or relocates those; see
[CONTRIBUTING.md](CONTRIBUTING.md#which-fork-does-my-script-go-to).

## Installing

1. Install a userscript manager. These are developed against
   **[Violentmonkey](https://violentmonkey.github.io/)**; Tampermonkey and
   Greasemonkey are expected to work but are not tested.
2. **Install from the listing linked in the catalogue** (the green *Install*
   button on Greasy Fork). That copy carries the fork's own
   `@updateURL`, so your manager picks up every new version automatically.

The files in this repository are the **source**, not the install channel.
There is **no `@updateURL` or `@downloadURL`** in any script here, by design:
pointed at a repository, those let a push to `main` mutate an installed copy on
every user's machine with no review. Installing a raw file from here works, but
it will never update itself — re-install by hand, or switch to the listing.

## Design rules every script holds to

These are not style preferences. Each one is here because its absence broke
something real.

- **Anchor on ARIA roles, `href` values and data attributes — never a generated
  class name.** Framework class names are compiler output and rotate without
  notice. `aria-label` is not an anchor either: it is localised, so a selector
  built on one matches nothing on a non-English UI.
- **When a control has no anchor, its ICON is one.** A button with no id, no
  data attribute and only generated classes is not unanchorable: an SVG path's
  `d` reads the same in every locale, which is exactly what `aria-label` does
  not. Scope it — the same glyph repeats across a page — and record the match
  count with the date.
- **Bind colour to the site's own design token, never a hex.** The brand colour
  in the logo is rarely the colour in the palette, and a frozen hex stops
  tracking the site's themes. Read the token off a control that already has the
  colour you want, and keep the measured value as the `var()` fallback.
- **`!important` is not the top of the cascade — a running animation is.** A Web
  Animation on `transform` outranks author-important. Move things off-canvas with
  the `translate` longhand (composes) rather than `transform` (competes).
- **`:has()` matches ancestors.** Pair a content test with a structural one and
  confirm the match count is exactly what you intend before you hide anything.
- **Assert state from the DOM each pass, never latch it in a variable.**
- **Teardown contract.** Register a teardown on `window` and call any previous one
  at entry. Never early-return on an "already initialised" flag — that makes a
  re-run a silent no-op and hides double-injection bugs.
- **Observer discipline.** `childList`-only on `head`/`documentElement`; never
  `subtree` on a large or virtualised DOM.
- **Failure mode is always degrade to stock.** When a selector is renamed
  upstream, rules stop matching and the page renders as the site intended. A
  script that mangles the page on a miss is a defect, not a degradation.

Per-script reasoning — the measured, dated evidence for why each selector and
cascade trick is what it is — lives in that script's own header comments.

## Contributing

New scripts and fixes are welcome. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**
— it covers the metadata block rules, the two lint gates, and the `@version`
trap that has bitten this project more than once.

- 🐛 [Report a bug](https://github.com/ismailkattakath/userscripts/issues/new?template=bug_report.yml)
- ✨ [Request a script](https://github.com/ismailkattakath/userscripts/issues/new?template=script_request.yml)
- 🔒 [Report a security issue](SECURITY.md) — **not** via a public issue
- 📜 [Code of Conduct](CODE_OF_CONDUCT.md)

## Licence

MIT — see [`LICENSE`](LICENSE). Contributions are accepted under the same terms.
