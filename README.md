# userscripts

[![lint: build status on main](https://github.com/ismailkattakath/userscripts/actions/workflows/lint.yml/badge.svg?branch=main&event=push)](https://github.com/ismailkattakath/userscripts/actions/workflows/lint.yml)
[![license: from the repository's LICENSE file](https://img.shields.io/github/license/ismailkattakath/userscripts)](LICENSE)
[![conventions: Greasy Fork code rules](https://img.shields.io/badge/conventions-Greasy%20Fork-670000.svg)](https://greasyfork.org/help/code-rules)

Userscripts that ship alternative experiences for legacy web apps: redesigns, not tweaks. Published on Greasy Fork.

## Background

One `.user.js` file per install unit at the repo root. **There is no build
step**: a userscript manager copies the file verbatim, so whatever is committed
here is exactly what runs in the browser. That is a deliberate constraint, not a
missing feature — it means the published artefact and the reviewable source are
the same bytes.

Every script holds to the same [design rules](docs/explanation/design-rules.md):
stable anchors, the site's own tokens, and a page that degrades to stock when an
anchor goes missing.

## Install

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

## Usage

Install a script from its listing below; it runs on the sites in its *Target* column.

### Catalogue

<!-- Keep this table sorted by filename. One row per install unit. -->

| Script | Target | Published |
|---|---|---|
| `civitai-declutter.user.js` — **Civitai — media-only feed, icon-only top bar** | civitai.com · civitai.red · civitai.green — image and video feeds stripped to the media, one icon-only top bar with an autohiding header; every other page keeps its cards and links, and a model page keeps Download and Details | [![Greasy Fork](https://img.shields.io/greasyfork/v/595761?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595761-civitai-media-only-feed-icon-only-top-bar) [![installs](https://img.shields.io/greasyfork/dt/595761)](https://greasyfork.org/en/scripts/595761-civitai-media-only-feed-icon-only-top-bar) |
| `github-pulls-running-checks.user.js` — **GitHub — running checks in the PR hovercard** | github.com — GitHub's own PR hovercard gains a checks section: failed jobs named, running jobs with a live elapsed clock and GitHub's own icons, refreshing while the card is open | [![Greasy Fork](https://img.shields.io/greasyfork/v/595763?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595763-github-running-checks-in-the-pr-hovercard) [![installs](https://img.shields.io/greasyfork/dt/595763)](https://greasyfork.org/en/scripts/595763-github-running-checks-in-the-pr-hovercard) |
| `google-photos-icon-nav.user.js` — **Google Photos — full-bleed grid, nav in a drawer** | photos.google.com — full-bleed grid on black, top bar reduced to the avatar, Photos' labelled nav held off-canvas as a drawer | [![Greasy Fork](https://img.shields.io/greasyfork/v/595764?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/595764-google-photos-full-bleed-grid-nav-in-a-drawer) [![installs](https://img.shields.io/greasyfork/dt/595764)](https://greasyfork.org/en/scripts/595764-google-photos-full-bleed-grid-nav-in-a-drawer) |
| `youtube-share-to-metube.user.js` — **YouTube — Store to MeTube, beside Share** | www.youtube.com — a Store chip beside YouTube's own Share button hands the video to a local MeTube (click for audio, Alt-click for video) and shows storing, stored or failed on the chip; Share is left as it is | [![Greasy Fork](https://img.shields.io/greasyfork/v/601485?label=Greasy%20Fork)](https://greasyfork.org/en/scripts/601485) [![installs](https://img.shields.io/greasyfork/dt/601485)](https://greasyfork.org/en/scripts/601485) |

Everything here publishes to **[Greasy Fork](https://greasyfork.org)**. A script
targeting an adult site belongs on [Sleazy Fork](https://sleazyfork.org) instead
and lives in a different repository — Greasy Fork rejects or relocates those; see
[CONTRIBUTING.md](CONTRIBUTING.md#which-fork-does-my-script-go-to).

## Contributing

New scripts and fixes are welcome. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**
— it covers the metadata block rules, the lint gates, and the `@version`
trap that has bitten this project more than once.

- 🐛 [Report a bug](https://github.com/ismailkattakath/userscripts/issues/new?template=bug_report.yml)
- ✨ [Request a script](https://github.com/ismailkattakath/userscripts/issues/new?template=script_request.yml)
- 🔒 [Report a security issue](SECURITY.md) — **not** via a public issue
- 📜 [Code of Conduct](https://github.com/ismailkattakath/.github/blob/main/.github/CODE_OF_CONDUCT.md) (the owner-wide default)

## Licence

MIT — see [`LICENSE`](LICENSE). Contributions are accepted under the same terms.
