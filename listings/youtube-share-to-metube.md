## What it does

**You already have a MeTube. This puts it one click away, on the video page itself.**

```
┌────────────────────────────────┐
│ Share, found by its icon path  │
└────────────────┬───────────────┘
                 │                
                 ▼                
┌────────────────────────────────┐
│a red Store chip added beside it│
└────────────────┬───────────────┘
                 │                
                 ▼                
┌────────────────────────────────┐
│      Share keeps sharing       │
└────────────────────────────────┘
```

A red **Store** chip appears right after YouTube's **Share** button on every watch page. Clicking it hands the video to a [MeTube](https://github.com/alexta69/metube) instance running on `127.0.0.1:8081`. Share is left exactly as YouTube made it.

| Click | Sends |
|---|---|
| plain | audio, **mp3** |
| **Alt** (⌥) | video, **mp4** |

Hovering the chip says so — its tooltip reads **Store — Alt (⌥) click for video**, in YouTube's own tooltip style.

It works however you reach the video: a direct link, the home page, search, a channel, a playlist, or the next related video.

## It tells you how it went

YouTube's action bar is icon-only, so the chip answers with its icon and colour:

| Chip | Means |
|---|---|
| red, tray arrow | ready |
| grey, clock | storing — the name and tooltip say audio or video |
| green, check | MeTube accepted it |
| dark red, cross | it failed — usually MeTube is not running |

```
┌───────────────────────────────────┐
│    click Store on a watch page    │
└─────────────────┬─────────────────┘
                  │                  
                  ▼                  
┌───────────────────────────────────┐
│    POST /add to 127.0.0.1:8081    │
└─────────────────┬─────────────────┘
                  │                  
                  ▼                  
┌───────────────────────────────────┐
│     MeTube answers in the body    │
└─────────────────┬─────────────────┘
                  │                  
                  ▼                  
┌───────────────────────────────────┐
│chip turns green check or red cross│
└───────────────────────────────────┘
```

- after a couple of seconds the chip settles back to **ready**
- the accessible name and the tooltip change with it, so a screen reader and a mouse agree with the pixels
- a second click while one is still storing is ignored, so a double-click never queues the same video twice
- the colours are YouTube's own design tokens, not hardcoded hexes, so they track the palette

## You need a MeTube

This script is the button. **[MeTube](https://github.com/alexta69/metube) is the thing that downloads**, and it must already be running and reachable at `http://127.0.0.1:8081`. If it is not, the chip shows the **cross** and nothing else happens.

The port is a single constant at the top of the file — change `METUBE` if yours listens elsewhere, and change the `@connect` line to match.

## What it does not do

- **no third-party host.** One request, to `127.0.0.1`. That is the only address in `@connect`, and a userscript manager enforces it
- **no token, no account, no login**, no cookies read, no headers borrowed
- **no storage, no settings panel, no `@require`**, no vendored library
- **no polling.** YouTube's own navigation events drive the work. Off a watch page the script watches nothing. On one it watches only the button row, plus — for the few seconds a fresh load can take to draw the bar — the page, until the bar appears
- **nothing of YouTube's is changed.** It adds one chip and its tooltip; it does not hide, move or rewrite any YouTube control
- **no `m.youtube.com`.** On a phone, `127.0.0.1` is the phone. The request could never reach the machine running MeTube, so a match there would only look supported
- **no Shorts.** The chip is added on `/watch` pages only

## Known limits

- **The format is sent by the script, not inherited from MeTube.** MeTube's own mp3/mp4 preference lives in its web UI's `localStorage`, on the `127.0.0.1` origin, which a script on `youtube.com` cannot read — and there is no endpoint that exposes it. Leaving the fields out does **not** fall back to your preference: MeTube then records `download_type: video, format: any`. So the two formats are the script's own choice, `AUDIO` and `VIDEO` at the top of the file, at `best` quality. Everything else — where files land, the naming template — is MeTube's and this script has no opinion about it.
- A **failed add still reports.** MeTube answers a refused URL with HTTP 200 and `{"status": "error"}` in the body, so the status code alone would read as success. The body is what decides here, and an unparseable body counts as a failure too — it means something other than MeTube is answering on that port.
- If YouTube redraws the share icon, the chip simply does not appear: **the bar renders stock.**

## Privacy

The only network request this script makes goes to `127.0.0.1`. Nothing is stored, nothing is sent anywhere else, and no page data leaves your machine. Read the source — it is one file, no build, no minification.

## Source

https://github.com/ismailkattakath/userscripts — MIT.
