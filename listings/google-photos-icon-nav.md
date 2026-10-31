## What it does

**Google Photos, with the photos taking the whole window** — in any window 1008px or wider.

```
┌────────────────────────────────────────────────────────────────────┐
│                 photo grid, edge to edge on black                  │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │                                  
                                   ▼                                  
┌────────────────────────────────────────────────────────────────────┐
│             top bar: the account avatar, nothing else              │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │                                  
                                   ▼                                  
┌────────────────────────────────────────────────────────────────────┐
│nav, search, Create, Help, Settings: off-canvas behind one hamburger│
└────────────────────────────────────────────────────────────────────┘
```

- the grid runs **edge to edge on a black backdrop** — no side rail eating the left third, no letterboxing
- the top bar is reduced to the **account avatar** alone
- Photos' own labelled nav is held **off-canvas as a drawer** behind a fixed hamburger — and **search, Create, Help, Settings and the Google apps launcher are relocated into that drawer, where they keep working**
- the memories row, the date headings and the year scrubber are dropped

Nothing is rebuilt: every control on the main grid is the site's own, moved, with its own handlers intact. Keyboard focus order and labels still work, and Escape closes the search suggestions first and the drawer second.

Everywhere else Photos is left exactly as Google ships it:

- **albums, shared albums, search results (Favorites, Videos and Recently added included), document categories and the app-downloads page** keep their own toolbar (Back, Share, Add photos, More options) — those views already cover the whole window
- **an opened photo or video** shows Google's own viewer
- **below 1008px wide**, where Photos switches to its own compact icon rail, the script stands down entirely

## What it does not do

- no downloading, no uploading, no automation, no account access
- no network calls, no storage, no settings panel, no `@require` — `@grant none`
- does not touch a photo, an album, or any Photos data

## How it differs from what is already here

Nothing else on Greasy Fork targets photos.google.com structurally — the existing Google Photos scripts are single-feature tweaks (a dark repaint, one extra button, a delete shortcut). This is a layout redesign: grid, chrome and navigation, measured against the live app.

## Known limits

- Google Photos ships obfuscated, generated class names that change without notice, so **every anchor here is an ARIA role or an `href`** — never a class. When Google does change something, the affected rule stops matching and that part renders stock; the page is never mangled.
- The redesign applies to the main photo grid in windows 1008px and wider; see the list above for where it deliberately stays out of the way.
- Built and verified on Chromium with Violentmonkey.

## Privacy

Zero requests of its own, zero storage. CSS plus DOM moves; read it.

## Source

https://github.com/ismailkattakath/userscripts — MIT.
