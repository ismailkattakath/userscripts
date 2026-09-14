## What it does

**You already hover pull request links. This puts the CI answer in the card you already get.**

```
┌───────────────────────────────────┐
│    hover any pull request link    │
└─────────────────┬─────────────────┘
                  │                  
                  ▼                  
┌───────────────────────────────────┐
│   GitHub shows its own hovercard  │
└─────────────────┬─────────────────┘
                  │                  
                  ▼                  
┌───────────────────────────────────┐
│a checks section is added inside it│
└───────────────────────────────────┘
```

No second popup, no new button, no page to open. GitHub's own hovercard, with a checks section in GitHub's own section idiom.

Inside that section:

```
┌───────────────────────────────────────┐
│           failed jobs, named          │
└───────────────────┬───────────────────┘
                    │                    
                    ▼                    
┌───────────────────────────────────────┐
│running jobs, with a live elapsed clock│
└───────────────────┬───────────────────┘
                    │                    
                    ▼                    
┌───────────────────────────────────────┐
│  the rest summarised: skipped, passed │
└───────────────────────────────────────┘
```

- **failed jobs are named** — not "3 failing", the actual job names, so you know whether to care
- **running jobs carry a live elapsed clock**, ticking, so a job stuck at 40 minutes is obvious at a glance
- rows are **grouped by workflow**, and the `push` / `pull_request` twins of the same job are merged into **one** entry instead of listed twice
- everything settled is summarised on one line

## What it does not do

- **no token, no `api.github.com`, no `@connect`.** Same-origin, path-relative requests only — the same URL your browser would fetch, with your existing session
- **no polling.** Requests happen on hover, are deduped while in flight, and are cached for 10 seconds; re-hovering the same pull request fetches nothing
- no storage, no settings panel, no `@require`
- does not change the pull request page, the list, or any GitHub control

## Known limits

- The elapsed clock reads the run id from an Actions job link, so **third-party checks** (Azure Pipelines and friends) show name and status but no clock — they degrade cleanly, they do not break.
- If GitHub changes the hovercard's markup the section simply stops appearing and the native card renders exactly as it always did. Verified by deliberately rotting the selector: stock card, zero requests.

## Privacy

No third-party host is contacted, nothing is stored, nothing is sent anywhere. Read the source — it is one file, no build, no minification.

## Source

https://github.com/ismailkattakath/userscripts — MIT.
