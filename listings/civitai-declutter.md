## What it does

**Civitai, reduced to the media.** Works on **civitai.com, civitai.red and civitai.green**.

```
┌────────────────────────────────────────────────────┐                   
│                  any Civitai page                  │                   
└──────────────────────────┬─────────────────────────┘                   
                           │                                             
                           ▼                                             
┌────────────────────────────────────────────────────┐                   
│         feed, model, image or video page?          │                   
└──────────────────────────┬─────────────────────────┘                   
                           │                                             
                           ├────────────────────────────────────┐        
                           │                                    │        
                          yes                                  no        
                           │                                    │        
                           ▼                                    ▼        
┌────────────────────────────────────────────────────┐ ┌────────────────┐
│MEDIA ONLY: the image or video, and one icon top bar│ │untouched, stock│
└────────────────────────────────────────────────────┘ └────────────────┘
```

On a page it takes:

```
┌─────────────────────────────────────────┐
│ cards: the image or video, nothing else │
└────────────────────┬────────────────────┘
                     │                     
                     ▼                     
┌─────────────────────────────────────────┐
│the top bar keeps icons and the route bar│
└────────────────────┬────────────────────┘
                     │                     
                     ▼                     
┌─────────────────────────────────────────┐
│    masonry fills the window, 8px gaps   │
└─────────────────────────────────────────┘
```

- **feed cards show only the image or the video** — no title, no stats, no reaction bar, no overlay chrome
- the **header, footer, chat, ads, announcements and comments** go
- whatever scrollable bar the route owns — the feed's tag chips, or a model's version picker — **docks into the top bar** instead of eating a row of its own
- a **model page keeps its carousel and its gallery**; that is the content
- gaps and page edges are a uniform 8px, surfaces are darkened, and the masonry fills the window's width

## What it does not do

- no downloading, no scraping, no auto-clicking, no Buzz farming
- no network calls, no storage, no settings panel, no `@require`
- does not bypass any gate, unlock anything, or change what the site would show you
- `@grant GM_addStyle` only — used because the stylesheet has to queue before `document.head` exists

## How it differs from what is already here

The Civitai shelf is mostly downloaders, metadata exporters and auto-clickers. The few layout scripts each take one bite — enlarge a thumbnail, delete the "Become a Member" card, strip a gradient — and most anchor on generated class names (`.mantine-…`, `.AspectRatioImageCard_content__…`) that change with any rebuild. This is a whole-page redesign anchored on ARIA roles and `href` shapes, and it is the only one that covers the `.red` and `.green` mirrors as well as `.com`.

## Known limits

- Civitai is a Next.js app whose class names are generated; when it rebuilds, a rule that no longer matches simply stops applying and that part renders **stock** — the page is never mangled.
- Built and verified on Chromium with Violentmonkey, signed out and signed in.

## Privacy

Zero requests of its own, zero storage. Read the source — one file, no build, no minification.

## Source

https://github.com/ismailkattakath/userscripts — MIT.
