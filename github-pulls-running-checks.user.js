// ==UserScript==
// @name         GitHub — running checks in the PR hovercard
// @namespace    kattakath.com
// @version      2.6.0
// @description  Adds a checks section to GitHub's own PR hovercard, anywhere one appears: failed jobs named, jobs in progress with a live elapsed clock and GitHub's own status icons, grouped by workflow, push/pull_request twins merged. The open card refreshes itself while anything is running, and is easy to move the pointer into. Same-origin requests only, no token, no second popup.
// @author       Ismail Kattakath
// @license      MIT
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        https://github.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

// The problem, measured 2026-09-11 on a busy private repo's pull-request list (live DOM,
// logged in): a PR row's checks badge carried exactly one bit of information.
// Its accessible name was the whole payload —
//
//   aria-label="Status checks: pending"     svg.octicon-dot-fill
//
// "pending" for a repo whose CI is thirty-odd jobs across five workflows.
// Re-measured 2026-10-31: the badge has since grown a progress count — "15/23"
// on NixOS/nixpkgs/pulls, "3/13 checks passing" as the accessible name on
// rust-lang/rust/pulls — so it now says HOW MANY have finished. It still does
// not say which job is running or for how long — not in the row, not in the
// badge, and not in the list route's embedded JSON. That is this script's job.
//
// WHERE IT GOES. v1 of this script opened its own card off the checks badge.
// Wrong surface: hovering a PR row already produces a card — GitHub's own PR
// hovercard, off the TITLE link, which is where the hand goes and where the eye
// already is. A second hover target with a second popup is one popup too many.
// So this version renders nothing of its own; it appends a section to the
// hovercard GitHub was going to show anyway, in GitHub's own section idiom
// (border-top tmp-mr-n3 tmp-ml-n3 tmp-mt-3 tmp-pt-3 tmp-px-3 — lifted from the
// card's own "You opened this pull request" footer), so it reads as another row
// of the card rather than as something bolted on.
//
// SOURCE. One same-origin request answers it, with the session cookie and no
// token — no PAT, no api.github.com (which ignores cookies), nothing to store:
//
//   GET /{owner}/{repo}/pull/{n}/checks     Accept: application/json
//   -> .payload["pullRequestsChecksRoute.Main"].value
//
// The value is a STRING of server-rendered HTML (~62KB), not JSON — it is the
// checks sidebar that /pull/{n}/checks itself renders. Sending
// Accept: application/json is the whole trick: a plain fetch of that path
// returns an empty 200, and Accept: text/html returns the full page shell.
// GitHub's own client also sends GitHub-Verified-Fetch, X-Requested-With and an
// X-Fetch-Nonce; all three were tested and none is required, so none is sent —
// a nonce this script cannot mint is a nonce it must not depend on.
//
// WHY NOT the endpoint the badge's own click uses. That one,
// /{owner}/{repo}/commit/{sha}/status-details, is smaller (~17KB) and is real
// JSON, but it returns check runs FLAT, with the workflow folded into the name
// and the trigger glued on the end:
//
//   in_progress :: CI — Lint, Type Check & Test / Unit Tests (pytest) (push)
//   in_progress :: CI — Lint, Type Check & Test / Unit Tests (pytest) (pull_request)
//
// Recovering "which workflow, which trigger, which job" from that means parsing
// a display string on two separators that are both legal inside a job name —
// this repo has jobs called "Lint & Format (ruff)" and "Type Check (mypy)", so
// the trailing-parenthesis rule is a guess, not a parse. It also needs the head
// SHA, which is a second lookup. The checks route hands over the same facts
// already structured, and costs one request instead of two.
//
// ELAPSED. A job's start time is in none of the cheap sources, and that was
// checked rather than assumed (2026-09-11): the sidebar HTML has zero
// <relative-time> elements and zero ISO timestamps anywhere in its 62KB; the
// status-details JSON says only "In progress" or "Queued" for a live check
// (it has "Successful in 4s" for settled ones, which is a duration, not a
// start); and job_rerun_dialogs_partial, 66KB covering every job in a run, has
// no timestamp at all. The start time appears only when a check run is SELECTED:
//
//   GET /{owner}/{repo}/pull/{n}/checks?check_run_id={id}   Accept: application/json
//   -> exactly one <relative-time format="elapsed" datetime="…">, inside
//      "<job name> Started <datetime> ago"
//
// So elapsed costs one extra request per IN-PROGRESS job. Three things keep that
// honest. It is only asked for jobs that are actually running — a queued job has
// not started, so there is nothing to ask and it is labelled "queued" instead.
// A found start time is cached forever, keyed by check-run id, with no TTL: a
// job's start time is immutable, so a re-hover after the panel's 10s TTL has
// lapsed re-reads the panel but not the clocks. A FAILED lookup is not cached —
// a failure is not a fact about the job — so the next hover asks again. And it is
// capped (ELAPSED_MAX) so a wide matrix cannot turn one hover into twenty
// requests; jobs past the cap keep their row and say "running" where the clock
// would be.
//
// Once a start time is known the clock ticks locally, once a second, off
// Date.now() — no further request for it, and it keeps counting while the card
// sits open.
//
// LIVE (2.6.0). Up to 2.5 the card was a snapshot: watching a run meant closing
// the card and hovering again. Now, while a card is OPEN and anything in it is
// still running or queued, the checks panel is re-read every 5s and the section
// is patched IN PLACE — rows keyed by workflow and job name, so the link under
// the pointer stays the same node and a spinner is not restarted. It stops by
// itself when the card closes, when nothing is left running, and on teardown;
// it pauses in a hidden tab; a failed refresh keeps the last good rows, says so
// in the header's tooltip, and backs off to 30s. This is the only polling the
// script does, and it lives exactly as long as a card someone is looking at.
//
// WHICH RUNNING JOBS GET A CLOCK, measured 2026-09-14 and narrower than it
// looks. The check-run id is read out of the job link's /job/{id} segment, and
// only GitHub ACTIONS prints that form. A third-party check — Azure Pipelines on
// microsoft/vscode, say — links straight to ?check_run_id={id} instead, the
// /job/ pattern does not match, and the row renders with a glyph and a name but
// no clock. It is a clean degradation, not a break, and it was left alone here
// rather than fixed in the same change as the lifecycle work: the id is sitting
// in that href in plain sight, and ?check_run_id= answers for those checks with
// the same single relative-time[format="elapsed"] (verified against
// microsoft/vscode#336110, datetime 2026-09-14T07:08:28Z), so widening the id
// read is a one-line change — and one that deserves its own measurement pass and
// its own version, not a ride on this one.
//
// STEPS were dropped deliberately. The step inside a running job is reachable —
// /{owner}/{repo}/actions/runs/{run}/jobs/{id}/steps returns
// [{name, status, conclusion, number}] — but {id} is an INTERNAL job id, not the
// check-run id in the job's own URL (103488497116 in the link, 83805835101 in
// the steps call; passing the former 404s). The mapping appears only inside a
// 66KB job_rerun_dialogs_partial, so a step costs two more requests per running
// job, one of them large, on an undocumented id pairing. Job-level is one
// request for the whole PR and answers the question that was asked.
//
// DEDUPLICATION is the point, not a nicety. Workflows triggered by both push and
// pull_request produce two complete, identical groups — on #2379, "CI — Lint,
// Type Check & Test" appeared twice with the same twelve jobs, so 24 of the 30
// rows in the checks panel were one workflow shown double. Groups sharing a
// workflow name are merged into one, labelled "push+pull_request", so the fact
// that it fired twice survives while the second copy does not. Job lists are
// unioned by job name, and where the twins disagree on a job the louder status
// wins (see RANK) — a run still going is the thing worth seeing. See dedupe()
// for why the merge key is the name alone and not the name plus the job list.
//
// Selectors. Two sets, both measured 2026-09-11, both deliberately avoiding the
// hashed CSS-module class names the React list is built from (those change per
// build; none is used here).
//
//   The hovercard, wherever one appears:
//     a[data-hovercard-url$="/hovercard"]   the trigger — the PR title link
//     div.js-hovercard-content              the card host, reused for every card
//       [data-hovercard-target-url]         /{owner}/{repo}/pull/{n}/hovercard
//       .Popover-message .tmp-p-3           the card's section stack
//         .f4.lh-condensed                  title block; our section goes after it
//
//   The checks sidebar, in the fetched HTML. Primer utility/legacy classes,
//   which is exactly why they are worth binding to — checks-list-item has
//   outlived several redesigns of the page around it:
//     details.checks-list-item              one workflow group
//       summary                             workflow name + span "on: <trigger>"
//       div.checks-list-item                one job row
//         a[href]                           .../actions/runs/{run}/job/{id}
//         .checks-list-item-name            job name
//         .checks-list-item-icon svg        status, in aria-label ("In progress",
//                                           "This job succeeded", "This job was skipped")
//
// FAILURES lead. Up to v2.2 the section named only the live jobs and folded
// everything settled into a count, which buried the one row that matters: on
// these PRs auto-merge is armed, so a red job is what is actually holding the
// merge, while a running one is just weather. Failed and cancelled jobs now get
// named rows above the running block, flat rather than under a workflow heading
// — which workflow broke is a detail, that something broke is not. They cost
// nothing extra: the status was already parsed out of the same 62KB.
//
// @match is the whole origin, and there is no path gate at all. Two reasons.
// github.com is an SPA, so Violentmonkey injects once per document load and a
// script matched to */pulls would never arm for someone who reaches the list by
// clicking "Pull requests". And nothing here needs to know what page it is on:
// the only trigger is a PR hovercard, and the hovercard's own URL carries the
// owner, repo and number. So it works on a repo's /pulls, the global dashboard,
// an issues list, a PR that links another PR, notifications — and stays inert
// everywhere else, because no PR hovercard means no work.
//
// LIFECYCLE. This script carries live state — two delegated listeners
// (mouseover to start, pointermove for the bridge), two intervals (the card
// watch, and a clock ticking once a second), a refresh timer, an animation
// frame, in-flight fetches whose answers paint into the DOM, a lift rule in a
// sheet of its own, and a section grafted into a host that is GitHub's, not
// ours. All of it is owned by a single teardown, window.__nixGhChecksTeardown,
// which is CALLED AT ENTRY before this copy arms anything.
//
// There is deliberately no "already init" flag and no early return. An early
// return makes a re-run a silent no-op, which is the exact failure a re-injection
// test exists to catch — and a script whose only update path is a manual
// re-install (no @updateURL, it is banned) cannot afford a no-op.
//
// Teardown STOPS NEW WORK BEFORE IT UNDOES THE DOM: it sets `torn`, aborts the
// controller (which both removes the delegated listeners and cancels every
// fetch in flight), clears both intervals and the session's refresh timer, and
// only then removes what was injected.
// The order matters because a fetch's .then() outlives the teardown that
// cancelled it — measured 2026-09-14 on github.com/home-assistant/core/pulls, a
// start-time lookup resolving after teardown would otherwise re-stamp a clock
// cell and restart the ticker on a section that is already gone. Every
// continuation therefore re-checks `torn` at entry rather than trusting that it
// cannot still be queued.
//
// Undoing the DOM is a plain removal and nothing else: NOT ONE node of GitHub's
// is moved, reparented or mutated. The section is created by this script and
// appended to the card's own stack; the bridge lives inside the section; the
// lift is a rule in a sheet this script owns, matched with :has() on the
// section's mark. So removing every [data-nix-ghchecks] node and both sheets
// leaves the hovercard byte-identical to stock — verified 2026-09-14 by
// screenshotting the same card before injection and after teardown, and
// re-verified for 2.6.0 by comparing the card's outerHTML after teardown with a
// stock card.
(() => {
  'use strict';

  // ---- lifecycle -----------------------------------------------------------
  // Undo the previous copy first. Reachable in the wild as a Greasy Fork install
  // sitting beside a manual one, and by any agent re-injecting this body. Two
  // live copies would mean two pointer listeners, two watch intervals, two
  // refresh loops and two clock tickers writing the same cells — the section
  // itself would still be single (ensureSection dedupes on MARK), which is
  // precisely why the duplicate is invisible until something stalls.
  if (typeof window.__nixGhChecksTeardown === 'function') {
    try {
      window.__nixGhChecksTeardown();
    } catch {
      /* the old copy is already gone; arming this one is still the right move */
    }
  }

  // Set before anything is undone, and re-checked by every continuation that can
  // outlive teardown: the interval and timer callbacks, every promise handler,
  // paintElapsed() and ensureTicker().
  let torn = false;
  // One controller for the whole copy. Both delegated listeners are added with
  // its signal (so teardown is an abort, not a hand-matched removeEventListener
  // with a capture flag to get wrong) and every fetch carries it too, so a card
  // closed mid-request cancels the request instead of paying for an answer
  // nobody wants.
  const ac = new AbortController();

  // The only gate. There is no path check: owner, repo and number all come from
  // the hovercard's own target URL, so anywhere GitHub decides to show a PR
  // hovercard — a repo's /pulls, the global /pulls dashboard, an issues list, a
  // PR page linking another PR, notifications — works with no special case. A
  // non-PR hovercard (a user, an issue, a repo) fails this and is left alone.
  const PR_HOVERCARD = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/hovercard/;

  const HOST = '.js-hovercard-content';
  const MESSAGE = '.Popover-message';
  const MARK = 'data-nix-ghchecks';
  const JOB = 'data-nix-job';
  const SINCE = 'data-nix-since';

  // The hovercard is fetched and rendered after the pointer lands, and re-rendered
  // if it is re-shown, so the section is re-asserted on a poll rather than
  // injected once and trusted. Cheap ticks; before the card first appears there
  // is a hard stop, so a hover that never produces a card costs 66 DOM reads and
  // then nothing. Once the card is up, the same tick keeps the lift and the
  // bridge in step with it, and ends the session the moment GitHub closes it.
  const TICK = 120;
  const WATCH_MS = 8000;
  // A checks panel is worth re-reading often while a run is live, but not once
  // per re-hover. Long enough to make a second look instant, short enough that a
  // job finishing shows up.
  const TTL = 10000;
  // While a card is OPEN and something in it is still running or queued, the
  // panel is re-read on this period, so the card can be watched instead of
  // re-hovered. Doubles on each failure up to the cap, and pauses in a hidden tab.
  const REFRESH_MS = 5000;
  const REFRESH_MAX_MS = 30000;
  // Ceiling on the per-job start-time lookups one open card may fire. Everyday CI
  // runs one to three jobs at a time; this exists so a fanned-out matrix cannot
  // turn a hover into twenty 62KB requests. Rows past it keep everything but
  // the clock, and say "running" in its place (STANDING).
  const ELAPSED_MAX = 5;
  // Ceiling on named failure rows, for the same reason: a card 360px wide has no
  // use for twenty of them. The overflow is counted, not dropped silently.
  const BROKEN_MAX = 6;
  // Half the width of the bridge's base on the title's edge, around the pointer.
  // The pointer is sampled, not continuous: the last sample on the title can sit
  // a few pixels from where it actually crossed the edge.
  const APEX_HALF = 20;
  // How close to the top of the viewport the lift may push the card.
  const LIFT_MARGIN = 8;
  // A pointer that STOPS inside the bridge is not on its way to the card — it is
  // aiming at whatever the bridge covers. After this long without movement the
  // bridge stands down (Floating UI's safePolygon `requireIntent`, same idea).
  const DWELL_MS = 150;
  // Start-time lookups that came back empty this many times for one job are not
  // asked again while this card is open; the row keeps saying "running".
  const STARTED_TRIES = 2;

  // Status vocabulary. GitHub states the status in the icon's aria-label rather
  // than in a class, and the wording differs per check type ("In progress" for a
  // job, "This job succeeded", "This job was skipped"), so match on the word that
  // carries the meaning. RANK orders a merged twin's disagreement: whatever is
  // still moving outranks whatever has already settled, and a failure outranks a
  // pass, so a merged group never looks calmer than its worst half.
  //
  // The glyphs are a FALLBACK. Each row shows GitHub's own status icon, adopted
  // from the same sidebar HTML (see ICONS); a glyph is drawn only for a row whose
  // icon could not be read.
  const STATUS = [
    ['running', /in progress|running/i, '◐'],
    ['queued', /queued|waiting|pending|expected/i, '◌'],
    ['failure', /fail|error/i, '✗'],
    ['cancelled', /cancel/i, '⊗'],
    ['skipped', /skip/i, '⊘'],
    ['success', /succeed|success|passed/i, '✓'],
  ];
  const RANK = { running: 6, queued: 5, failure: 4, cancelled: 3, skipped: 2, success: 1, unknown: 0 };
  const GLYPH = Object.fromEntries(STATUS.map(([k, , g]) => [k, g]).concat([['unknown', '•']]));
  // GitHub's own words for the counts, as its merge box prints them
  // ("2 in progress, 22 successful, 5 skipped checks").
  const WORD = { running: 'in progress', queued: 'queued', success: 'successful', skipped: 'skipped', unknown: 'other' };

  function classify(label) {
    const text = String(label || '');
    for (const [key, re] of STATUS) if (re.test(text)) return key;
    return 'unknown';
  }

  const isLive = (status) => status === 'running' || status === 'queued';
  // Broken, not merely finished. These get named rows of their own above the
  // running ones: on a repo with auto-merge armed, a red job is what is actually
  // holding the PR, so it outranks a job that is still going.
  const isBroken = (status) => status === 'failure' || status === 'cancelled';
  // What the right-hand cell says for a job that has no clock to show. A running
  // job starts out saying "running" too, and keeps it if it never gets a clock —
  // past ELAPSED_MAX, a failed lookup, or a check with no Actions job id. Before
  // 2.5.1 that cell was empty, and three of eight running rows on
  // NixOS/nixpkgs#581281 (2026-10-31) read as broken. Verified the same day on
  // rust-lang/rust#165221: ten running, five clocks, five "running".
  const STANDING = { running: 'running', queued: 'queued', failure: 'failed', cancelled: 'cancelled' };

  // Layout and type come from the card's own Primer utilities; only the row
  // geometry, the bridge and the fallback glyph colours are ours, and the colours
  // use Primer's tokens so the section follows the user's light/dark/auto setting
  // with no palette of its own and no media query.
  //
  // The return value is kept so teardown can remove the sheet. Violentmonkey and
  // Tampermonkey both hand back the <style> element they appended; a manager that
  // returns nothing leaves it in place, which is why every rule below is scoped
  // to a .nix-ghchecks-* class this script owns — an orphaned sheet then styles
  // nothing, rather than leaking a rule onto GitHub's own markup. GM_addStyle is
  // also what makes @run-at document-start safe: it queues until there is a head
  // to append to, which a hand-rolled createElement('style') would not.
  const styleEl = GM_addStyle(`
    .nix-ghchecks-title { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .nix-ghchecks-wf { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-top: 8px; }
    .nix-ghchecks-wf-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nix-ghchecks-job { display: flex; gap: 8px; align-items: center; min-height: 24px; }
    .nix-ghchecks-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* GitHub's running icon is two SVGs: a dot, and an 18px ring that is
       position:absolute and spins. An abspos child of a flex container is placed
       as if it were the only item, so centring the cell centres the ring on the
       dot — the same trick the checks sidebar's own wrapper uses. */
    .nix-ghchecks-icon {
      flex: none; position: relative; width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    /* The clock is right-aligned and tabular so the digits do not shuffle the
       row sideways once a second. */
    .nix-ghchecks-elapsed { flex: none; margin-left: auto; font-variant-numeric: tabular-nums; }
    /* Transparent, under the card's content (z-index -1 inside the card's own
       stacking context), over the page. See CATCHING THE CARD. */
    .nix-ghchecks-bridge { position: absolute; z-index: -1; }
    .nix-ghchecks-bridge[hidden] { display: none; }
    .nix-ghchecks-running > .nix-ghchecks-glyph,
    .nix-ghchecks-queued > .nix-ghchecks-glyph { color: var(--fgColor-attention, #d29922); }
    .nix-ghchecks-failure > .nix-ghchecks-glyph { color: var(--fgColor-danger, #f85149); }
    .nix-ghchecks-success > .nix-ghchecks-glyph { color: var(--fgColor-success, #3fb950); }
    .nix-ghchecks-cancelled > .nix-ghchecks-glyph,
    .nix-ghchecks-skipped > .nix-ghchecks-glyph,
    .nix-ghchecks-unknown > .nix-ghchecks-glyph { color: var(--fgColor-muted, #9198a1); }
  `);
  // A second sheet, empty until a card needs lifting, holding exactly one rule.
  // Ours, so the lift touches no node of GitHub's (see STAYING CLEAR OF THE TITLE).
  const liftEl = GM_addStyle('');

  // ---- fetch + cache -------------------------------------------------------
  // Two maps, two different jobs. `cache` holds parsed groups under a TTL so a
  // second hover paints without a request; `inflight` holds the promise so a
  // pointer wobbling over one title cannot start the same fetch twice.
  const cache = new Map();
  const inflight = new Map();

  // The route key has been pullRequestsChecksRoute.Main since this was written,
  // but a payload key is a build detail. If it is ever renamed, any entry whose
  // value is HTML carrying the sidebar's marker class is the same document.
  function routeHtml(json) {
    const payload = json && json.payload;
    if (!payload) return '';
    const named = payload['pullRequestsChecksRoute.Main'];
    const entries = named ? [named] : Object.values(payload);
    for (const entry of entries) {
      const value = entry && typeof entry === 'object' ? entry.value : entry;
      if (typeof value === 'string' && value.includes('checks-list-item')) return value;
    }
    return '';
  }

  // Workflow name and trigger out of a group's <summary>. The trigger is removed
  // from a CLONE rather than sliced off the text, because the name is free text
  // that can itself contain "on:" — and the trailing digits a summary may carry
  // are a count badge ("PR Hygiene on: pull_request_target 2"), not part of it.
  function groupHead(details) {
    const summary = details && details.querySelector('summary');
    if (!summary) return { name: 'Checks', trigger: '' };
    const clone = summary.cloneNode(true);
    let trigger = '';
    for (const span of clone.querySelectorAll('span')) {
      const text = span.textContent.trim();
      if (/^on:\s*\S/.test(text) && !span.querySelector('span')) {
        if (!trigger) trigger = text.replace(/^on:\s*/, '');
        span.remove();
      }
    }
    const name = clone.textContent.replace(/\s+/g, ' ').trim().replace(/\s+\d+$/, '');
    return { name: name || 'Checks', trigger };
  }

  // Every job row in the sidebar, bucketed by the group it sits in. Walking the
  // NAME nodes rather than the group nodes is what keeps a check that is not
  // inside a workflow group — a plain commit status, say — from being dropped.
  function parseGroups(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const order = [];
    const byGroup = new Map();

    for (const nameEl of doc.querySelectorAll('.checks-list-item-name')) {
      const details = nameEl.closest('details.checks-list-item');
      let bucket = byGroup.get(details);
      if (!bucket) {
        const head = groupHead(details);
        bucket = { name: head.name, triggers: head.trigger ? [head.trigger] : [], jobs: [] };
        byGroup.set(details, bucket);
        order.push(bucket);
      }
      const row = nameEl.closest('.checks-list-item') || nameEl.parentElement;
      const icons = row ? [...row.querySelectorAll('.checks-list-item-icon svg')] : [];
      const link = row && row.querySelector('a[href]');
      const href = link ? link.getAttribute('href') : '';
      // The status is in the SVGs' aria-labels. A running job carries two SVGs
      // ("In progress" on the spinner, "This job is in progress" on the dot), so
      // the labels are read together.
      bucket.jobs.push({
        name: nameEl.textContent.replace(/\s+/g, ' ').trim(),
        status: classify(icons.map((svg) => svg.getAttribute('aria-label') || '').join(' ')),
        icons,
        href,
        // The number in .../actions/runs/{run}/job/{id} IS the check-run id, which
        // is what ?check_run_id= wants — so the start-time lookup needs no id
        // mapping, only the link the sidebar already printed.
        id: (href.match(/\/job\/(\d+)/) || [])[1] || '',
      });
    }
    return order;
  }

  // The merge. Identity is the WORKFLOW NAME, and the job lists are unioned by
  // job name rather than compared position by position.
  //
  // An earlier version keyed on the name plus the exact job-name list, on the
  // theory that only identical groups are safely mergeable. Measured against a
  // live PR seconds after a push (#2381, 2026-09-11) that is wrong, and visibly
  // so: GitHub materialises a run's check runs as they are queued, so for the
  // first seconds the push copy had one job and the pull_request copy had four.
  // Different lists, no merge, and the hovercard showed the duplicate this
  // script exists to remove — exactly when someone is watching, because that is
  // when a run is new.
  //
  // Unioning is also the more correct answer for a workflow with conditional
  // jobs: one that only runs `if: github.event_name == 'pull_request'` exists in
  // one copy and not the other, and belongs in the merged group once, not in a
  // second copy of the whole workflow.
  function dedupe(groups) {
    const byName = new Map();
    const order = [];
    for (const group of groups) {
      const seen = byName.get(group.name);
      if (!seen) {
        byName.set(group.name, group);
        order.push(group);
        continue;
      }
      for (const trigger of group.triggers) if (!seen.triggers.includes(trigger)) seen.triggers.push(trigger);
      const at = new Map(seen.jobs.map((job, i) => [job.name, i]));
      for (const job of group.jobs) {
        const index = at.get(job.name);
        // Same job, two runs, two verdicts: keep the louder one, and the link
        // and check-run id that go with it, so both the clock and the click-
        // through follow the run worth looking at.
        if (index === undefined) {
          at.set(job.name, seen.jobs.length);
          seen.jobs.push(job);
        } else if (RANK[job.status] > RANK[seen.jobs[index].status]) {
          seen.jobs[index] = job;
        }
      }
    }
    return order;
  }

  // `fresh` skips the TTL: the live refresh asks for it, a hover does not. An
  // in-flight request is shared either way.
  async function loadChecks(owner, repo, number, fresh) {
    const key = `${owner}/${repo}#${number}`;
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < TTL) return hit.groups;
    if (inflight.has(key)) return inflight.get(key);

    const pending = (async () => {
      // Path-relative, so it is same-origin by construction — there is no host to
      // get wrong and no api.github.com anywhere in this file. credentials is
      // 'same-origin' to send the session cookie GitHub already set; no token is
      // read, minted or stored, and nothing is sent anywhere else. The signal is
      // the copy's own: teardown cancels a request in flight rather than letting
      // its answer paint into a card that is gone.
      const res = await fetch(`/${owner}/${repo}/pull/${number}/checks`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`checks ${res.status}`);
      const html = routeHtml(await res.json());
      if (!html) throw new Error('no checks payload');
      const groups = dedupe(parseGroups(html));
      cache.set(key, { at: Date.now(), groups });
      return groups;
    })();

    inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      inflight.delete(key);
    }
  }

  // ---- elapsed -------------------------------------------------------------
  // Keyed by check-run id and never evicted once answered: a job's start instant
  // is a fact about the past, so unlike the checks panel it has nothing to go
  // stale. The map holds the PROMISE, which is also what collapses two hovers
  // racing for the same job into one request — and what makes asking again on
  // every live refresh free. A null answer — a non-2xx, a missing timestamp, a
  // network error — is evicted when it lands, so it is retried on the next ask
  // instead of being remembered as "no start time".
  const started = new Map();

  async function fetchStarted(ctx, id) {
    const res = await fetch(`/${ctx.owner}/${ctx.repo}/pull/${ctx.number}/checks?check_run_id=${id}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const html = routeHtml(await res.json());
    if (!html) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // format="elapsed" is the selected run's "Started … ago" line, and it is the
    // only relative-time the document carries. The bare fallback is there in
    // case the format attribute moves, not because a second one is expected.
    const rel =
      doc.querySelector('relative-time[format="elapsed"][datetime]') ||
      doc.querySelector('relative-time[datetime]');
    const at = rel && Date.parse(rel.getAttribute('datetime'));
    return Number.isFinite(at) ? at : null;
  }

  function loadStarted(ctx, id) {
    if (!started.has(id)) {
      const pending = fetchStarted(ctx, id).catch(() => null);
      started.set(id, pending);
      // Identity-checked, so a teardown's clear() followed by a fresh lookup is
      // never evicted by the old promise settling late.
      pending.then((at) => {
        if (at === null && started.get(id) === pending) started.delete(id);
      });
    }
    return started.get(id);
  }

  function elapsedText(since) {
    const secs = Math.max(0, Math.round((Date.now() - since) / 1000));
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${String(secs % 60).padStart(2, '0')}s`;
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  }

  // One interval for the whole document, started on demand and stopping itself
  // as soon as no clock is on screen — a hovercard that closed leaves nothing
  // running behind it.
  //
  // That self-stop is only true because GitHub EMPTIES the card host on close
  // rather than merely hiding it, which was measured rather than assumed
  // (2026-09-14, github.com/nodejs/node/pulls): on close the single
  // div.js-hovercard-content drops from 5777 to 135 bytes of innerHTML, loses its
  // data-hovercard-target-url and goes display:none. Our section goes with it, so
  // the SINCE cells genuinely vanish and the next tick clears itself. Were GitHub
  // to start hiding instead of emptying, this loop would run for the life of the
  // tab — which is the other reason teardown clears it unconditionally rather
  // than trusting the self-stop.
  let ticker = 0;
  function tick() {
    if (torn) {
      clearInterval(ticker);
      ticker = 0;
      return;
    }
    const cells = document.querySelectorAll(`[${SINCE}]`);
    if (!cells.length) {
      clearInterval(ticker);
      ticker = 0;
      return;
    }
    for (const cell of cells) cell.textContent = elapsedText(Number(cell.getAttribute(SINCE)));
  }
  function ensureTicker() {
    if (torn || ticker) return;
    ticker = setInterval(tick, 1000);
  }

  // ---- icons ---------------------------------------------------------------
  // The rows wear GitHub's own status icons, not lookalikes: the sidebar HTML
  // this script already fetches carries them, so they are imported from that
  // document rather than redrawn. Measured 2026-11-26 across 14 NixOS/nixpkgs
  // PRs: octicon-check color-fg-success, octicon-x color-fg-danger, octicon-skip
  // color-fg-muted, and for a running job a PAIR — octicon-dot-fill
  // color-fg-attention plus an 18px ring, stroke var(--fgColor-attention),
  // class "anim-rotate", whose rotate-keyframes animation is styled on /pulls
  // itself (computed animation-name read there, logged out). Whatever state
  // GitHub adds next arrives with its own icon for free.
  //
  // What is imported is narrowed on the way in: SVG shape elements only, no
  // event-handler or link attributes, and the sidebar's own behaviour hooks
  // (js-*) and selection styling (selected-*) stripped. The labelled SVG keeps
  // its role="img" and aria-label, so a screen reader hears GitHub's own
  // "This job failed" once; the spinner ring is hidden from it.
  const SVG_PARTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);

  function adoptIcons(sources) {
    const out = [];
    for (const source of sources) {
      const svg = document.importNode(source, true);
      for (const node of [svg, ...svg.querySelectorAll('*')]) {
        if (!SVG_PARTS.has(node.localName)) {
          node.remove();
          continue;
        }
        for (const attr of [...node.attributes]) {
          if (/^on/i.test(attr.name) || /href$/i.test(attr.name)) node.removeAttribute(attr.name);
        }
      }
      for (const cls of [...svg.classList]) if (/^(js-|selected-)/.test(cls)) svg.classList.remove(cls);
      out.push(svg);
    }
    // One label per row. The running pair labels BOTH halves ("In progress" on
    // the ring, "This job is in progress" on the dot), which a screen reader
    // would read twice; the one GitHub marks role="img" speaks, the rest are
    // hidden from it.
    const voice = out.find((svg) => svg.getAttribute('role') === 'img' && svg.hasAttribute('aria-label')) || out.find((svg) => svg.hasAttribute('aria-label'));
    for (const svg of out) {
      if (svg === voice) continue;
      svg.removeAttribute('aria-label');
      svg.setAttribute('aria-hidden', 'true');
    }
    return out;
  }

  // ---- the section ---------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // What each row last showed, so a live refresh rewrites only what changed. The
  // spinner in particular must not be re-imported while the job is still running,
  // or its rotation restarts from zero every five seconds.
  const shown = new WeakMap();

  function jobRow() {
    const row = el('div', 'nix-ghchecks-job');
    row.appendChild(el('span', 'nix-ghchecks-icon'));
    row.appendChild(el('span', 'nix-ghchecks-name'));
    // The right-hand cell is the clock for a running job. A job that is not
    // running has no clock, so it says why instead — queued means not started,
    // and a broken job's verdict belongs next to its name.
    row.appendChild(el('span', 'nix-ghchecks-elapsed f6 color-fg-muted'));
    return row;
  }

  function paintRow(row, job) {
    const was = shown.get(row) || {};
    const [iconCell, , clock] = row.children;

    if (was.status !== job.status) {
      row.className = `nix-ghchecks-job nix-ghchecks-${job.status}`;
      const icons = adoptIcons(job.icons);
      if (icons.length) {
        iconCell.className = 'nix-ghchecks-icon';
        iconCell.replaceChildren(...icons);
      } else {
        iconCell.className = 'nix-ghchecks-icon nix-ghchecks-glyph';
        iconCell.textContent = GLYPH[job.status] || GLYPH.unknown;
      }
      // A job that stopped running loses its clock; one that started gets
      // "running" until its start time lands.
      clock.removeAttribute(SINCE);
      clock.textContent = STANDING[job.status] || '';
    }

    if (was.href !== job.href || was.name !== job.name) {
      const name = job.href ? el('a', 'nix-ghchecks-name Link--primary', job.name) : el('span', 'nix-ghchecks-name', job.name);
      if (job.href) name.href = job.href;
      row.replaceChild(name, row.children[1]);
    }

    if (was.id !== job.id) {
      // A merged twin can swap which run a row follows; a clock started off the
      // other run's id would be the wrong clock.
      if (job.id) row.setAttribute(JOB, job.id);
      else row.removeAttribute(JOB);
      if (clock.hasAttribute(SINCE)) {
        clock.removeAttribute(SINCE);
        clock.textContent = STANDING[job.status] || '';
      }
    }

    shown.set(row, { status: job.status, href: job.href, name: job.name, id: job.id });
  }

  // Fill in one row's clock once its start time is known, and start the ticker.
  // The row is re-checked rather than trusted, because by the time the answer
  // lands a refresh may have moved the row to another run or another status.
  function paintElapsed(row, id, since) {
    // `torn` first: this runs from a fetch's .then(), so it is reachable after
    // the teardown that cancelled the fetch, and without the guard it would
    // re-stamp a cell and restart the ticker on a section already removed.
    if (torn || !since || !row.isConnected || row.getAttribute(JOB) !== id) return;
    if ((shown.get(row) || {}).status !== 'running') return;
    const cell = row.lastChild;
    if (cell.getAttribute(SINCE) === String(since)) return;
    cell.setAttribute(SINCE, String(since));
    cell.textContent = elapsedText(since);
    ensureTicker();
  }

  // Render the groups into the open card's section, REUSING the nodes already
  // there. The first render and every live refresh go through here, and a
  // refresh that rebuilt the section from scratch would swap the link under the
  // pointer for a new one mid-hover and restart every spinner. Nodes are keyed
  // by workflow and job name — never by check-run id, which is empty for a
  // non-Actions check and changes when a merged twin swaps runs — and the
  // section's child list is only rewritten when membership or order changed.
  function render(s, groups) {
    const { section, nodes } = s;
    const want = [s.bridge];
    const keep = new Set();
    // Two jobs may share a name inside one workflow (a matrix GitHub did not
    // suffix). Keys carry an occurrence count, so the second is a row of its own
    // rather than a repaint of the first.
    const seen = new Map();
    const once = (base) => {
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return `${base}\u0000${n}`;
    };
    const rowOf = new Map();
    const node = (key, make) => {
      keep.add(key);
      let n = nodes.get(key);
      if (!n) nodes.set(key, (n = make()));
      return n;
    };

    const live = groups
      .map((group) => ({ group, jobs: group.jobs.filter((job) => isLive(job.status)) }))
      .filter((entry) => entry.jobs.length);

    const tally = {};
    for (const group of groups) for (const job of group.jobs) tally[job.status] = (tally[job.status] || 0) + 1;

    // Broken jobs lead, flat and ungrouped. Which workflow a failure belongs to
    // is a detail; that it failed is not, and a flat list keeps the answer on
    // the first line instead of behind a workflow heading.
    const broken = groups.flatMap((group) => group.jobs.filter((job) => isBroken(job.status)).map((job) => ({ group, job })));
    for (const { group, job } of broken.slice(0, BROKEN_MAX)) {
      const row = node(once(`x\u0000${group.name}\u0000${job.name}`), jobRow);
      paintRow(row, job);
      want.push(row);
    }
    if (broken.length > BROKEN_MAX) {
      const more = node('more', () => el('div', 'f6 color-fg-muted'));
      more.textContent = `+${broken.length - BROKEN_MAX} more failed`;
      want.push(more);
    }

    // The header names what is moving, in GitHub's own words, and the settled
    // remainder is a link to the full checks page — the summary of all checks
    // is the natural way into all of them. Failures are not in the tally: they
    // are already named above it.
    const head = node('head', () => {
      const h = el('div', 'nix-ghchecks-title f6');
      h.appendChild(el('span', 'text-bold'));
      const all = el('a', 'Link--muted');
      h.appendChild(all);
      return h;
    });
    head.classList.toggle('tmp-mt-2', broken.length > 0);
    const moving = ['running', 'queued'].filter((k) => tally[k]).map((k) => `${tally[k]} ${WORD[k]}`);
    // At rest, the verdict in the merge box's own sentences.
    const rest = broken.length ? 'Some checks were not successful' : 'All checks have passed';
    head.firstChild.textContent = moving.length ? moving.join(' · ') : rest;
    const settled = ['success', 'skipped', 'unknown'].filter((k) => tally[k]).map((k) => `${tally[k]} ${WORD[k]}`);
    head.lastChild.textContent = settled.length ? settled.join(' · ') : 'All checks';
    head.lastChild.href = `/${s.owner}/${s.repo}/pull/${s.number}/checks`;
    // A refresh that failed leaves the last good answer on screen, and says so.
    head.title = s.stale ? 'Last refresh failed — showing the previous answer' : '';
    want.push(head);

    // Only the running jobs, and only the workflows that have one. The settled
    // majority is already summarised in the header — repeating it here would put
    // thirty rows in a 360px card to say nothing.
    for (const { group, jobs } of live) {
      const wf = node(`w\u0000${group.name}`, () => {
        const w = el('div', 'nix-ghchecks-wf f6 color-fg-muted');
        w.appendChild(el('span', 'nix-ghchecks-wf-name', group.name));
        w.appendChild(el('span', 'flex-shrink-0'));
        return w;
      });
      wf.lastChild.textContent = group.triggers.join('+');
      want.push(wf);
      for (const job of jobs) {
        const row = node(once(`j\u0000${group.name}\u0000${job.name}`), jobRow);
        paintRow(row, job);
        rowOf.set(job, row);
        want.push(row);
      }
    }

    for (const key of [...nodes.keys()]) if (!keep.has(key)) nodes.delete(key);
    const same = want.length === section.children.length && want.every((n, i) => section.children[i] === n);
    if (!same) section.replaceChildren(...want);

    // Progressive: the rows are on screen already, the clocks arrive when their
    // lookups land. Only in-progress jobs have a start, and only the first few
    // distinct ones this card has seen are asked for. A job asked about once is
    // asked again for free on every refresh — the answer is a cached promise.
    for (const { jobs } of live) {
      for (const job of jobs) {
        if (job.status !== 'running' || !job.id) continue;
        if ((s.misses.get(job.id) || 0) >= STARTED_TRIES) continue;
        if (!s.asked.has(job.id)) {
          if (s.asked.size >= ELAPSED_MAX) continue;
          s.asked.add(job.id);
        }
        const row = rowOf.get(job);
        loadStarted(s, job.id).then((since) => {
          // A failed lookup is retried, but not forever: a 404 on every refresh
          // would be a 62KB request per job every five seconds.
          if (since === null) s.misses.set(job.id, (s.misses.get(job.id) || 0) + 1);
          paintElapsed(row, job.id, since);
        });
      }
    }
  }

  function ensureSection(stack, number) {
    const existing = stack.querySelector(`[${MARK}]`);
    if (existing) {
      if (existing.getAttribute(MARK) === String(number)) return existing;
      existing.remove();
    }

    const section = el('div', 'border-top tmp-mr-n3 tmp-ml-n3 tmp-mt-3 tmp-pt-3 tmp-px-3');
    section.setAttribute(MARK, String(number));
    section.appendChild(el('div', 'f6 color-fg-muted', 'checking runs…'));

    // Straight after the title and state, ahead of the PR body: the answer this
    // script exists to give should not be below the fold of a 360px card.
    const title = stack.querySelector('.f4.lh-condensed');
    if (title && title.nextSibling) stack.insertBefore(section, title.nextSibling);
    else stack.appendChild(section);
    return section;
  }

  // The visible card for this PR. There is more than one .js-hovercard-content
  // host in the document (an outlet and the positioned card), and a stale one
  // keeps its old target URL, so both the URL and the visibility are checked.
  function visibleHost(number) {
    for (const host of document.querySelectorAll(HOST)) {
      const target = host.getAttribute('data-hovercard-target-url') || '';
      if (!target.includes(`/pull/${number}/hovercard`)) continue;
      if (getComputedStyle(host).display === 'none') continue;
      if (host.querySelector(`${MESSAGE} .tmp-p-3`)) return host;
    }
    return null;
  }

  // ---- staying clear of the title ------------------------------------------
  // GitHub positions the card ONCE, for its stock height, and then leaves it
  // alone. When it opens ABOVE the title — every case measured on
  // NixOS/nixpkgs/pulls, 2026-11-26 — its bottom sits 12px over the title. The
  // section makes the card 50-80px taller, and a card that keeps its top while
  // growing grows DOWN: over the 12px gap and onto the title's own row
  // (card bottom 403 -> 483 against a title at y 415). So the card is lifted by
  // exactly what the section added, and its bottom stays where GitHub put it.
  //
  // The lift is a `translate` — a longhand that composes with any transform or
  // animation GitHub runs instead of competing with it — written as one rule
  // into a sheet this script owns, matched with :has() on the section's own
  // mark. No node of GitHub's is touched, and the rule stops matching by itself
  // the moment GitHub empties the card on close. A card that opens BELOW the
  // title grows away from it and is left alone.
  //
  // When there is no room above for the taller card — a title near the top of
  // the window; measured on the first rows, the card then sat 72px over its own
  // title — it is FLIPPED below the title instead, 12px clear, the side GitHub
  // itself picks when space runs out. Its caret pointed down at the title from
  // above and would now point at nothing, so the flip rule hides it. With no
  // room on either side the lift is clamped at the top of the window: a card
  // overlapping its title beats a card pushed off-screen.
  function setLift(s, px, flipped) {
    if (!liftEl || (s.lift === px && s.flipped === flipped)) return;
    s.lift = px;
    s.flipped = flipped;
    const card = `${HOST}:has([${MARK}="${s.number}"])`;
    liftEl.textContent =
      (px ? `${card} { translate: 0 ${px}px; }` : '') +
      (flipped ? ` ${card} ${MESSAGE}::before, ${card} ${MESSAGE}::after { display: none; }` : '');
  }

  // ---- catching the card ---------------------------------------------------
  // GitHub closes the card about 100ms after the pointer leaves the title, unless
  // the pointer has reached the card by then. Measured 2026-11-26, headless,
  // logged out, NixOS/nixpkgs/pulls: leave -> close 105-108ms in four of four
  // runs, stock and scripted alike. And the card is not placed at the pointer:
  // its left edge sits a fixed 33px left of the TITLE'S MIDPOINT, wherever on the
  // title the pointer is (four rows, pointer at 10% and at 80% of the title,
  // identical card x). So from a long title's left end the card starts 100-150px
  // to the right, past a 12px gap, and a person's diagonal into it takes longer
  // than 100ms. Stock GitHub dropped the card on most such paths, which is why
  // the card was hard to catch long before this script added anything to it.
  //
  // The fix is the long-standing safe-area pattern (Amazon's mega-menu "menu
  // aim"; Floating UI's safePolygon): an invisible region from the pointer to the
  // card, which the pointer is allowed to cross. Here it is a transparent element
  // INSIDE the card's own DOM, so GitHub's own logic counts the pointer as
  // already on the card the moment it leaves the title. Its shape is the convex
  // hull of a short segment on the title's edge, centred on the pointer, and the
  // card's four corners — every straight path from where the pointer left to
  // anywhere on the card stays inside it. A throwaway prototype of exactly this
  // shape, glided along 300ms and 600ms diagonals from 10% into the title:
  // stock 3/8 cards survived, with the bridge 8/8.
  //
  // It costs clicks: while it is up, the strip of page it covers cannot be hovered
  // or clicked — and that strip holds the rows above (or below) this one. The
  // first build stood down only when the pointer reached the card, and a glide
  // from one title onto the NEXT row's title followed by a click hit the bridge
  // 4/4 times, where stock GitHub opened that PR 4/4. So the bridge also has to
  // see intent: it holds while the pointer keeps moving, and stands down after
  // DWELL_MS at rest — someone travelling to the card does not stop halfway, and
  // someone aiming at the row beneath it does. It is also hidden the moment the
  // pointer is on the card proper, and re-armed only from the title. Its base
  // starts at the title's edge, so it never covers the title itself and a click
  // on the title still opens the PR.
  function hull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (const q of p.reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  // The title node the card belongs to. React may replace a row while its card is
  // open; a detached node measures as a zero rect at the viewport origin, which
  // would anchor the bridge there and fling the lift. So a detached trigger is
  // re-found by its hovercard URL, and if there is none, nothing is measured.
  function liveTrigger(s) {
    if (s.trigger && s.trigger.isConnected) return s.trigger;
    for (const node of document.querySelectorAll('[data-hovercard-url]')) {
      const match = PR_HOVERCARD.exec(node.getAttribute('data-hovercard-url') || '');
      if (match && match[1] === s.owner && match[2] === s.repo && match[3] === s.number) {
        s.trigger = node;
        return node;
      }
    }
    return null;
  }

  function placeBridge(s) {
    const bridge = s.bridge;
    const trigger = liveTrigger(s);
    if (!bridge || bridge.hidden || !bridge.isConnected || !trigger) return;
    const message = bridge.closest(MESSAGE);
    const origin = bridge.offsetParent;
    if (!message || !origin) return;
    const card = message.getBoundingClientRect();
    const title = trigger.getBoundingClientRect();
    const at = origin.getBoundingClientRect();
    // Which side of the title the card is on, by centres — so a card the lift
    // could not fully clear (overlapping its own title) still gets a side.
    const up = card.top + card.bottom < title.top + title.bottom;
    const edge = up ? title.top : title.bottom;
    // Only the part of the card BEYOND the title's edge goes into the hull. A
    // card overlapping its title would otherwise drag the hull across the title
    // and swallow clicks on it. Measured 2026-11-26 on a 529px card clamped over
    // its title: the pointer sat 48px left of the card and, with no bridge, the
    // card closed on the way in.
    const far = up ? card.top : card.bottom;
    const near = up ? Math.min(card.bottom, edge) : Math.max(card.top, edge);
    let geometry = 'width:0;height:0';
    if (Math.abs(near - far) >= 1) {
      const x = Math.min(Math.max(s.apex ? s.apex.x : title.left + APEX_HALF, title.left), title.right);
      const points = hull([
        [x - APEX_HALF, edge],
        [x + APEX_HALF, edge],
        [card.left, far],
        [card.right, far],
        [card.left, near],
        [card.right, near],
      ]);
      const left = Math.min(...points.map((q) => q[0]));
      const top = Math.min(...points.map((q) => q[1]));
      const width = Math.max(...points.map((q) => q[0])) - left;
      const height = Math.max(...points.map((q) => q[1])) - top;
      const polygon = points.map(([px, py]) => `${(px - left).toFixed(1)}px ${(py - top).toFixed(1)}px`).join(', ');
      geometry = `left:${(left - at.left).toFixed(1)}px;top:${(top - at.top).toFixed(1)}px;width:${width.toFixed(1)}px;height:${height.toFixed(1)}px;clip-path:polygon(${polygon})`;
    }
    if (bridge.getAttribute('style') !== geometry) bridge.setAttribute('style', geometry);
  }

  // Keep the lift and the bridge in step with the card. Runs every tick while the
  // card is open and after every render; writes only when something moved.
  function layout(s) {
    const message = s.section && s.section.closest(MESSAGE);
    if (!message || !s.stock) return;
    if (s.stock.above) {
      const height = message.getBoundingClientRect().height;
      const grew = Math.round(height - s.stock.height);
      const room = Math.round(s.stock.top - LIFT_MARGIN);
      const trigger = liveTrigger(s);
      if (!trigger) return;
      const title = trigger.getBoundingClientRect();
      const flipTop = title.bottom + s.stock.gap;
      if (grew <= room) setLift(s, -Math.max(0, grew), false);
      else if (flipTop + height <= window.innerHeight - LIFT_MARGIN) setLift(s, Math.round(flipTop - s.stock.top), true);
      else setLift(s, -Math.max(0, room), false);
    }
    placeBridge(s);
  }

  // ---- the open card -------------------------------------------------------
  // At most one card is open at a time, so there is one session: the PR, its
  // trigger, the section, the keyed nodes, the lift, the bridge and the refresh
  // timer. Ending it stops the refresh and drops the lift.
  let session = null;
  let watch = 0;

  function endSession() {
    if (!session) return;
    clearTimeout(session.refresh);
    clearTimeout(session.dwell);
    setLift(session, 0, false);
    cancelAnimationFrame(session.frame);
    session = null;
  }

  function scheduleRefresh(s, groups) {
    clearTimeout(s.refresh);
    s.refresh = 0;
    if (torn || session !== s) return;
    // Nothing left to watch: a settled PR stays settled until the next push.
    if (!groups.some((group) => group.jobs.some((job) => isLive(job.status)))) return;
    s.refresh = setTimeout(() => refresh(s), s.delay);
  }

  function refresh(s) {
    s.refresh = 0;
    if (torn || session !== s || !s.section || !s.section.isConnected) return;
    // A background tab is not watching. Check again later rather than spend a
    // request nobody sees.
    if (document.hidden) {
      s.refresh = setTimeout(() => refresh(s), s.delay);
      return;
    }
    loadChecks(s.owner, s.repo, s.number, true).then(
      (groups) => {
        if (torn || session !== s || !s.section.isConnected) return;
        s.delay = REFRESH_MS;
        s.stale = false;
        render(s, groups);
        layout(s);
        scheduleRefresh(s, groups);
      },
      () => {
        if (torn || session !== s || !s.section.isConnected) return;
        // Keep the last good rows, say they are stale, and back off.
        s.stale = true;
        const head = s.nodes.get('head');
        if (head) head.title = 'Last refresh failed — showing the previous answer';
        s.delay = Math.min(s.delay * 2, REFRESH_MAX_MS);
        s.refresh = setTimeout(() => refresh(s), s.delay);
      },
    );
  }

  function openCard(s, host) {
    const message = host.querySelector(MESSAGE);
    const stack = message && message.querySelector('.tmp-p-3');
    if (!stack) return;
    // Read the card's stock geometry BEFORE the section changes it; the lift is
    // measured against this.
    const card = message.getBoundingClientRect();
    const title = s.trigger.getBoundingClientRect();
    s.stock = { top: card.top, height: card.height, above: card.bottom <= title.top + 1, gap: Math.max(0, title.top - card.bottom) };

    const section = ensureSection(stack, s.number);
    s.section = section;
    s.nodes = new Map();
    s.bridge = el('div', 'nix-ghchecks-bridge');
    s.bridge.setAttribute('aria-hidden', 'true');
    section.prepend(s.bridge);
    placeBridge(s);

    loadChecks(s.owner, s.repo, s.number).then(
      (groups) => {
        if (torn || session !== s || s.section !== section || !section.isConnected) return;
        render(s, groups);
        layout(s);
        scheduleRefresh(s, groups);
      },
      (err) => {
        // The abort teardown fires lands here too. Saying "checks unavailable
        // (The user aborted a request.)" into a card that is on its way out
        // would be a lie about GitHub, so `torn` is checked before the message
        // is written, not only before the node is touched.
        if (torn || session !== s || s.section !== section || !section.isConnected) return;
        section.replaceChildren(s.bridge, el('div', 'f6 color-fg-muted', `checks unavailable (${err.message})`));
        layout(s);
      },
    );
  }

  function watchFor(owner, repo, number, trigger) {
    const current = session;
    if (current && current.owner === owner && current.repo === repo && current.number === number) {
      // The same card, re-entered: follow the trigger (React may have replaced
      // it) and re-arm the bridge, but do not restart anything.
      current.trigger = trigger;
      if (current.bridge) current.bridge.hidden = false;
      return;
    }
    endSession();
    clearInterval(watch);
    const s = (session = {
      owner, repo, number, trigger,
      section: null, nodes: new Map(), bridge: null, stock: null,
      apex: null, lift: 0, flipped: false, refresh: 0, delay: REFRESH_MS, stale: false,
      asked: new Set(), misses: new Map(), dwell: 0, frame: 0, seen: false,
    });
    const deadline = Date.now() + WATCH_MS;

    watch = setInterval(() => {
      if (torn || session !== s) {
        clearInterval(watch);
        watch = 0;
        return;
      }
      const host = visibleHost(number);
      if (!host) {
        // Gone after being seen: GitHub closed the card, and the session ends
        // with it. Never seen and out of time: the hover produced no card.
        if (s.seen || Date.now() > deadline) {
          clearInterval(watch);
          watch = 0;
          endSession();
        }
        return;
      }
      s.seen = true;
      // Re-asserted every tick because GitHub re-renders the card's contents
      // when it is re-shown, which silently drops the section. The re-render is
      // a local DOM write from the cache, not another request.
      if (!s.section || !s.section.isConnected) openCard(s, host);
      else layout(s);
    }, TICK);
  }

  // One delegated listener for the life of the document, and nothing fires
  // until a PR hovercard is actually triggered — which is also why this needs no
  // path gate and survives client-side routing for free.
  //
  // { capture: true, signal } rather than a bare `true`: the signal is what makes
  // teardown a single ac.abort() instead of a removeEventListener that has to
  // repeat both the identical function reference and the capture flag to match —
  // the classic way a "teardown" silently leaves its listener armed.
  document.addEventListener(
    'mouseover',
    (event) => {
      if (torn) return;
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target && target.closest('[data-hovercard-url]');
      if (!trigger) return;
      const match = PR_HOVERCARD.exec(trigger.getAttribute('data-hovercard-url') || '');
      if (!match) return;
      watchFor(match[1], match[2], match[3], trigger);
    },
    { capture: true, signal: ac.signal },
  );

  // The bridge's second listener: where the pointer is decides whether the bridge
  // is up. On the title it records the apex and re-arms; on the card proper it
  // stands the bridge down so the page beneath gets its clicks back. Passive,
  // rAF-coalesced, and it returns at once when no card is open.
  document.addEventListener(
    'pointermove',
    (event) => {
      const s = session;
      if (torn || !s || !s.bridge) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      clearTimeout(s.dwell);
      s.dwell = 0;
      if (s.trigger && s.trigger.contains(target)) {
        s.apex = { x: event.clientX, y: event.clientY };
        s.bridge.hidden = false;
        if (!s.frame) {
          s.frame = requestAnimationFrame(() => {
            s.frame = 0;
            if (!torn && session === s) placeBridge(s);
          });
        }
      } else if (target === s.bridge) {
        // In transit. Moving keeps it up; resting takes it down.
        s.dwell = setTimeout(() => {
          s.dwell = 0;
          if (!torn && session === s && s.bridge) s.bridge.hidden = true;
        }, DWELL_MS);
      } else if (!s.bridge.hidden && s.bridge.parentNode && target.closest(MESSAGE) === s.bridge.closest(MESSAGE)) {
        s.bridge.hidden = true;
      }
    },
    { capture: true, passive: true, signal: ac.signal },
  );

  // ---- teardown ------------------------------------------------------------
  //
  // Stop new work, then undo. Nothing of GitHub's is restored here because
  // nothing of GitHub's was ever taken: this script only ever APPENDED a section
  // it created (the bridge lives inside it) and wrote rules into two sheets it
  // owns, so removing every [data-nix-ghchecks] node and both sheets is the
  // whole restore and the card renders stock.
  //
  // Every marked node is removed, not just the one for the PR last hovered. There
  // is normally at most one — GitHub empties the host on close — but a teardown
  // that assumed that would be trusting a measurement of someone else's app to
  // hold, and the cost of the plural form is one querySelectorAll.
  window.__nixGhChecksTeardown = () => {
    torn = true;
    // Removes both delegated listeners AND rejects every fetch still in flight,
    // so no answer arrives for a copy that no longer exists.
    ac.abort();

    clearInterval(ticker);
    ticker = 0;
    clearInterval(watch);
    watch = 0;
    endSession();

    for (const node of document.querySelectorAll(`[${MARK}]`)) node.remove();

    // The caches hold answers and, in `started`, PROMISES — including ones this
    // abort is about to settle as null. Dropped so nothing outlives the copy.
    cache.clear();
    inflight.clear();
    started.clear();

    for (const sheet of [styleEl, liftEl]) if (sheet && typeof sheet.remove === 'function') sheet.remove();
    delete window.__nixGhChecksTeardown;
  };
})();
