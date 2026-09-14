// ==UserScript==
// @name         GitHub — running checks in the PR hovercard
// @namespace    kattakath.com
// @version      2.4.0
// @description  Adds a checks section to GitHub's own PR hovercard, anywhere one appears: failed jobs named, jobs in progress with a live elapsed clock, grouped by workflow, with the push/pull_request twins merged into one entry instead of listed twice. Same-origin requests only, no token, no second popup.
// @author       Ismail Kattakath
// @license      MIT
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        https://github.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

// The problem, measured 2026-09-11 on
// github.com/Infin8-Information-Technologies/takeoff-api-infra/pulls (live DOM,
// logged in): a PR row's checks badge carries exactly one bit of information.
// Its accessible name is the whole payload —
//
//   aria-label="Status checks: pending"     svg.octicon-dot-fill
//
// "pending" for a repo whose CI is thirty-odd jobs across five workflows. Which
// job is running is not in the row, not in the badge, and not in the list route's
// embedded JSON.
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
// The answer is cached forever, keyed by check-run id, with no TTL: a job's
// start time is immutable, so a re-hover and the 10s group refresh both cost
// nothing. And it is capped (ELAPSED_MAX) so a wide matrix cannot turn one
// hover into twenty requests; jobs past the cap keep their row and lose only
// the clock.
//
// Once a start time is known the clock ticks locally, once a second, off
// Date.now() — no polling, no further requests, and it keeps counting while the
// card sits open.
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
(() => {
  'use strict';

  // The only gate. There is no path check: owner, repo and number all come from
  // the hovercard's own target URL, so anywhere GitHub decides to show a PR
  // hovercard — a repo's /pulls, the global /pulls dashboard, an issues list, a
  // PR page linking another PR, notifications — works with no special case. A
  // non-PR hovercard (a user, an issue, a repo) fails this and is left alone.
  const PR_HOVERCARD = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/hovercard/;

  const HOST = '.js-hovercard-content';
  const MARK = 'data-nix-ghchecks';
  const JOB = 'data-nix-job';
  const SINCE = 'data-nix-since';

  // The hovercard is fetched and rendered after the pointer lands, and re-rendered
  // if it is re-shown, so the section is re-asserted on a poll rather than
  // injected once and trusted. Cheap ticks, hard stop — a hover that never
  // produces a card costs 20 DOM reads and then nothing.
  const TICK = 120;
  const WATCH_MS = 8000;
  // A checks panel is worth re-reading often while a run is live, but not once
  // per re-hover. Long enough to make a second look instant, short enough that a
  // job finishing shows up.
  const TTL = 10000;
  // Ceiling on the per-job start-time lookups one hover may fire. Everyday CI
  // runs one to three jobs at a time; this exists so a fanned-out matrix cannot
  // turn a hover into twenty 62KB requests. Rows past it keep everything but
  // the clock.
  const ELAPSED_MAX = 5;
  // Ceiling on named failure rows, for the same reason: a card 360px wide has no
  // use for twenty of them. The overflow is counted, not dropped silently.
  const BROKEN_MAX = 6;

  // Status vocabulary. GitHub states the status in the icon's aria-label rather
  // than in a class, and the wording differs per check type ("In progress" for a
  // job, "This job succeeded", "This job was skipped"), so match on the word that
  // carries the meaning. RANK orders a merged twin's disagreement: whatever is
  // still moving outranks whatever has already settled, and a failure outranks a
  // pass, so a merged group never looks calmer than its worst half.
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
  // What the right-hand cell says for a job that has no clock to show.
  const STANDING = { queued: 'queued', failure: 'failed', cancelled: 'cancelled' };

  // Layout and type come from the card's own Primer utilities; only the status
  // colours and the two-column job row are ours, and those use Primer's tokens
  // so the section follows the user's light/dark/auto setting with no palette of
  // its own and no media query.
  GM_addStyle(`
    .nix-ghchecks-title { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .nix-ghchecks-wf { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-top: 4px; }
    .nix-ghchecks-wf-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nix-ghchecks-job { display: flex; gap: 6px; align-items: baseline; }
    .nix-ghchecks-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.nix-ghchecks-name { color: inherit; text-decoration: none; }
    a.nix-ghchecks-name:hover { text-decoration: underline; }
    .nix-ghchecks-glyph { flex: none; width: 1em; text-align: center; }
    /* The clock is right-aligned and tabular so the digits do not shuffle the
       row sideways once a second. */
    .nix-ghchecks-elapsed {
      flex: none;
      margin-left: auto;
      font-variant-numeric: tabular-nums;
      color: var(--fgColor-muted, #9198a1);
    }
    .nix-ghchecks-running > .nix-ghchecks-glyph,
    .nix-ghchecks-queued > .nix-ghchecks-glyph { color: var(--fgColor-attention, #d29922); }
    .nix-ghchecks-failure > .nix-ghchecks-glyph { color: var(--fgColor-danger, #f85149); }
    .nix-ghchecks-success > .nix-ghchecks-glyph { color: var(--fgColor-success, #3fb950); }
    .nix-ghchecks-cancelled > .nix-ghchecks-glyph,
    .nix-ghchecks-skipped > .nix-ghchecks-glyph,
    .nix-ghchecks-unknown > .nix-ghchecks-glyph { color: var(--fgColor-muted, #9198a1); }
  `);

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
      const icon = row && row.querySelector('.checks-list-item-icon svg');
      const link = row && row.querySelector('a[href]');
      const href = link ? link.getAttribute('href') : '';
      bucket.jobs.push({
        name: nameEl.textContent.replace(/\s+/g, ' ').trim(),
        status: classify(icon && icon.getAttribute('aria-label')),
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

  async function loadChecks(owner, repo, number) {
    const key = `${owner}/${repo}#${number}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.groups;
    if (inflight.has(key)) return inflight.get(key);

    const pending = (async () => {
      const res = await fetch(`/${owner}/${repo}/pull/${number}/checks`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
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
  // Keyed by check-run id and never evicted: a job's start instant is a fact
  // about the past, so unlike the checks panel it has nothing to go stale. The
  // map holds the PROMISE, which is also what collapses two hovers racing for
  // the same job into one request.
  const started = new Map();

  async function fetchStarted(ctx, id) {
    const res = await fetch(`/${ctx.owner}/${ctx.repo}/pull/${ctx.number}/checks?check_run_id=${id}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
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
    if (!started.has(id)) started.set(id, fetchStarted(ctx, id).catch(() => null));
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
  let ticker = 0;
  function tick() {
    const cells = document.querySelectorAll(`[${SINCE}]`);
    if (!cells.length) {
      clearInterval(ticker);
      ticker = 0;
      return;
    }
    for (const cell of cells) cell.textContent = elapsedText(Number(cell.getAttribute(SINCE)));
  }
  function ensureTicker() {
    if (!ticker) ticker = setInterval(tick, 1000);
  }

  // ---- the section ---------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function jobRow(job) {
    const row = el('div', `nix-ghchecks-job nix-ghchecks-${job.status}`);
    if (job.id) row.setAttribute(JOB, job.id);
    row.appendChild(el('span', 'nix-ghchecks-glyph', GLYPH[job.status] || GLYPH.unknown));
    if (job.href) {
      const link = el('a', 'nix-ghchecks-name', job.name);
      link.href = job.href;
      row.appendChild(link);
    } else {
      row.appendChild(el('span', 'nix-ghchecks-name', job.name));
    }
    // The right-hand cell is the clock for a running job. A job that is not
    // running has no clock, so it says why instead — queued means not started,
    // and a broken job's verdict belongs next to its name.
    row.appendChild(el('span', 'nix-ghchecks-elapsed f6', STANDING[job.status] || ''));
    return row;
  }

  // Fill in one row's clock once its start time is known, and start the ticker.
  // Re-queried from the section rather than closed over, because a re-render
  // between the request and its answer replaces the node.
  function paintElapsed(section, id, since) {
    if (!since || !section.isConnected) return;
    const cell = section.querySelector(`[${JOB}="${id}"] .nix-ghchecks-elapsed`);
    if (!cell) return;
    cell.setAttribute(SINCE, String(since));
    cell.textContent = elapsedText(since);
    ensureTicker();
  }

  function fill(section, groups, ctx) {
    section.textContent = '';

    const live = groups
      .map((group) => ({ group, jobs: group.jobs.filter((job) => isLive(job.status)) }))
      .filter((entry) => entry.jobs.length);
    const liveCount = live.reduce((n, entry) => n + entry.jobs.length, 0);

    const tally = {};
    for (const group of groups) for (const job of group.jobs) tally[job.status] = (tally[job.status] || 0) + 1;
    // Failures are enumerated by name below, so counting them here too would say
    // the same thing twice. The tally is for the outcomes nobody needs named.
    const settled = ['skipped', 'success', 'unknown']
      .filter((key) => tally[key])
      .map((key) => `${tally[key]} ${key}`)
      .join(' · ');

    // Broken jobs lead, flat and ungrouped. Which workflow a failure belongs to
    // is a detail; that it failed is not, and a flat list keeps the answer on
    // the first line instead of behind a workflow heading.
    const broken = groups.flatMap((group) => group.jobs.filter((job) => isBroken(job.status)));
    for (const job of broken.slice(0, BROKEN_MAX)) section.appendChild(jobRow(job));
    if (broken.length > BROKEN_MAX) {
      section.appendChild(el('div', 'f6 color-fg-muted', `+${broken.length - BROKEN_MAX} more failed`));
    }

    const head = el('div', 'nix-ghchecks-title f6 text-bold');
    if (broken.length) head.className += ' tmp-mt-2';
    head.appendChild(el('span', null, liveCount ? `${liveCount} running` : 'nothing running'));
    if (settled) head.appendChild(el('span', 'f6 text-normal color-fg-muted', settled));
    section.appendChild(head);

    // Only the running jobs, and only the workflows that have one. The settled
    // majority is already summarised in the header — repeating it here would put
    // thirty rows in a 360px card to say nothing.
    for (const entry of live) {
      const wf = el('div', 'nix-ghchecks-wf f6 color-fg-muted');
      wf.appendChild(el('span', 'nix-ghchecks-wf-name', entry.group.name));
      if (entry.group.triggers.length) {
        wf.appendChild(el('span', 'f6 flex-shrink-0', entry.group.triggers.join('+')));
      }
      section.appendChild(wf);
      for (const job of entry.jobs) section.appendChild(jobRow(job));
    }

    // Progressive: the rows are on screen already, the clocks arrive when their
    // lookups land. Only in-progress jobs have a start, and only the first few
    // are asked for.
    let budget = ELAPSED_MAX;
    for (const entry of live) {
      for (const job of entry.jobs) {
        if (job.status !== 'running' || !job.id) continue;
        if (budget-- <= 0) return;
        loadStarted(ctx, job.id).then((since) => paintElapsed(section, job.id, since));
      }
    }
  }

  function ensureSection(host, number) {
    const stack = host.querySelector('.Popover-message .tmp-p-3');
    if (!stack) return null;

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
      if (host.querySelector('.Popover-message .tmp-p-3')) return host;
    }
    return null;
  }

  // ---- trigger -------------------------------------------------------------
  let watch = 0;

  function watchFor(owner, repo, number) {
    clearInterval(watch);
    const deadline = Date.now() + WATCH_MS;
    let filled = null;

    watch = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(watch);
        return;
      }
      const host = visibleHost(number);
      if (!host) return;
      const section = ensureSection(host, number);
      // Re-asserted every tick because GitHub re-renders the card's contents
      // when it is re-shown, which silently drops the section. Once the data is
      // in hand the refill is a local DOM write, and the start times it needs
      // are already resolved promises — not another round of requests.
      if (!section || section === filled) return;
      loadChecks(owner, repo, number).then(
        (groups) => {
          if (!section.isConnected) return;
          fill(section, groups, { owner, repo, number });
          filled = section;
        },
        (err) => {
          if (!section.isConnected) return;
          section.textContent = '';
          section.appendChild(el('div', 'f6 color-fg-muted', `checks unavailable (${err.message})`));
          filled = section;
        },
      );
    }, TICK);
  }

  // One delegated listener for the life of the document, and nothing fires
  // until a PR hovercard is actually triggered — which is also why this needs no
  // path gate and survives client-side routing for free.
  document.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target && target.closest('[data-hovercard-url]');
      if (!trigger) return;
      const match = PR_HOVERCARD.exec(trigger.getAttribute('data-hovercard-url') || '');
      if (!match) return;
      watchFor(match[1], match[2], match[3]);
    },
    true,
  );
})();
