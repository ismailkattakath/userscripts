## What it does

**You already have a MeTube. This puts it one click away, on the video page itself.**

```
┌───────────────────────────────────────┐
│Share button, measured by its icon path│
└───────────────────┬───────────────────┘
                    │                    
                    ▼                    
┌───────────────────────────────────────┐
│ relabelled Store, red chip, new glyph │
└───────────────────┬───────────────────┘
                    │                    
                    ▼                    
┌───────────────────────────────────────┐
│    Sharing moves to the dotted menu   │
└───────────────────────────────────────┘
```

YouTube's **Share** button on a watch page becomes **Store**. Clicking it hands the video to a [MeTube](https://github.com/alexta69/metube) instance running on `127.0.0.1:8081` instead of opening the share sheet.

| Click | Sends | Chip says |
|---|---|---|
| plain | audio, **mp3** | Storing audio |
| **Alt** (⌥) | video, **mp4** | Storing video |

The chip names the format *before* it sends, so the modifier is never silent about what it just did. Hovering the button says so too — its tooltip reads **Store — Alt (⌥) click for video**.

Nothing is added to the page and nothing is moved. One button changes what it says, what it looks like, and what it does — and it tells you how it went:

```
┌─────────────────────────────┐
│ click Store on a watch page │
└──────────────┬──────────────┘
               │               
               ▼               
┌─────────────────────────────┐
│ POST /add to 127.0.0.1:8081 │
└──────────────┬──────────────┘
               │               
               ▼               
┌─────────────────────────────┐
│  MeTube answers in the body │
└──────────────┬──────────────┘
               │               
               ▼               
┌─────────────────────────────┐
│chip flashes Stored or Failed│
└─────────────────────────────┘
```

- the label reads **Storing audio** or **Storing video**, then **Stored** or **Failed**, then settles back to **Store**
- the accessible name and YouTube's own hover tooltip say the same word at the same time, so a screen reader and a mouse agree with the pixels
- the chip takes YouTube's own red — the design token behind the masthead's notification badge, not a hardcoded hex, so it tracks the palette and both themes

**Sharing is not lost.** It is in the **⋯** menu, which is exactly where YouTube already sends Save when the window narrows.

## Why the Share button and not Save

Save looks like the obvious victim and is the wrong one. Measured on 2026‑09‑22, YouTube's action bar reflows with the window:

| Layout width | Visible chips | Where Save is |
|---|---|---|
| ~1378 px | like / dislike, Share, Ask, Save | in the bar |
| 758 px | like / dislike, Share | **gone** — only inside ⋯ |

Save does not shrink or hide at narrow widths; it **leaves the bar entirely** and materialises only once the ⋯ popup is opened. A one-click control cannot be one that disappears at some window sizes. Share stayed put at both widths, in the same container, so Share is the anchor.

## You need a MeTube

This script is the button. **[MeTube](https://github.com/alexta69/metube) is the thing that downloads**, and it must already be running and reachable at `http://127.0.0.1:8081`. If it is not, the chip flashes **Failed** and nothing else happens.

The port is a single constant at the top of the file — change `METUBE` if yours listens elsewhere, and change the `@connect` line to match.

## What it does not do

- **no third-party host.** One request, to `127.0.0.1`. That is the only address in `@connect`, and a userscript manager enforces it
- **no token, no account, no login**, no cookies read, no headers borrowed
- **no storage, no settings panel, no `@require`**, no vendored library
- **no polling and no observer on a big DOM.** YouTube's own navigation events drive the work; the two observers held are on a two-child button row and on a one-span tooltip
- nothing is hidden, moved or re-parented — the only writes are to one button's label, three of its attributes, and its icon's path
- **no `m.youtube.com`.** On a phone, `127.0.0.1` is the phone. The request could never reach the machine running MeTube, so a match there would only look supported

## Known limits

- **The format is sent by the script, not inherited from MeTube.** MeTube's own mp3/mp4 preference lives in its web UI's `localStorage`, on the `127.0.0.1` origin, which a script on `youtube.com` cannot read — and there is no endpoint that exposes it. Leaving the fields out does **not** fall back to your preference: MeTube then records `download_type: video, format: any`. So the two formats are the script's own choice, `AUDIO` and `VIDEO` at the top of the file, at `best` quality. Everything else — where files land, the naming template — is MeTube's and this script has no opinion about it.
- A **failed add still reports.** MeTube answers a refused URL with HTTP 200 and `{"status": "error"}` in the body, so the status code alone would read as success. The body is what decides here, and an unparseable body counts as a failure too — it means something other than MeTube is answering on that port.
- If YouTube redraws the share icon, the button is simply not found: **the bar renders stock and Share shares.** Verified by restoring on a live page — glyph, label, accessible name, tooltip and title all returned, and the native share sheet opened on the next click.

## Privacy

The only network request this script makes goes to `127.0.0.1`. Nothing is stored, nothing is sent anywhere else, and no page data leaves your machine. Read the source — it is one file, no build, no minification.

## Source

https://github.com/ismailkattakath/userscripts — MIT.
