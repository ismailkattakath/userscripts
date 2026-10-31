// ==UserScript==
// @name         YouTube — Store to MeTube, beside Share
// @namespace    kattakath.com
// @author       Ismail Kattakath
// @license      MIT
// @version      3.0.0
// @description  Adds a red Store chip beside YouTube's Share button on every watch page, however you got there. It hands the video to a MeTube instance on 127.0.0.1:8081: a plain click stores the audio as mp3, Alt-click stores the video as mp4. The chip changes icon and colour while storing, then shows stored or failed. Share is left alone. One local request, no token, no third-party host.
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @noframes
// ==/UserScript==

// WHAT AND WHY. The operator runs MeTube on 127.0.0.1:8081 and wanted one click
// on a watch page to put the video in it. This script adds ONE control of its
// own — a Store chip, right after Share in the watch action bar — and answers
// its click with a POST to MeTube. YouTube's own buttons are not touched.
//
// WHY A CHIP OF OUR OWN, NOT SHARE TAKEN OVER (3.0.0). Up to 2.1.1 the Share
// button itself was relabelled Store, on the premise that sharing stayed
// reachable in the ⋯ menu. Measured 2026-10-31 at 1512px, signed in, the ⋯
// menu holds only "Download, Report" — Share never overflows, so taking it
// over removed sharing from the watch page outright. The chip keeps both.
//
// WHERE THE CHIP GOES. Measured 2026-10-31 (1280px, signed out, en-US), the
// bar is icon-only and Share sits in
//
//   ytd-watch-metadata #actions ytd-menu-renderer #top-level-buttons-computed
//     > yt-button-view-model (margin-left 8px) > button-view-model > button
//
// The chip is inserted as the next sibling of that row child, and copies its
// look AT RUNTIME rather than from a stylesheet of ours: the button takes
// Share's class list, the icon wrapper is a clone of Share's
// .ytSpecButtonShapeNextIcon, and the host takes the row child's computed
// margin-left. A prototype built that way measured 40×40 with the same
// rgba(255,255,255,0.1) tonal fill as Share. Only the glyph and the fill are
// ours.
//
// THE ANCHOR IS GEOMETRY, NOT LANGUAGE. This repository bans aria-label as a
// selector because it is localised: a test for "Share" matches nothing on a
// non-English UI. Measured 2026-09-22 and again 2026-10-31, Share carries no
// id, no data attribute and no stable class — only the generated
// ytSpecButtonShapeNext* set. What it does carry is its ICON, and an SVG path
// reads the same in every locale. The share glyph's `d` begins:
//
//   M10 3.158V7.51c-5.428.223-8.27 3.75-8.875 11.199
//
// Counted 2026-10-31: 6 nodes document-wide carry that path — the watch bar's
// Share plus one in each sidebar video's ⋮ menu — and exactly 1 inside BAR, so
// the scope is load-bearing, not decoration.
//
// ANY ENTRY, NOT JUST A FRESH /watch LOAD. Up to 2.1.1 @match was
// https://www.youtube.com/watch*. A userscript manager injects per DOCUMENT
// load, and YouTube is a single-page app: measured 2026-10-31, loading the home
// page and clicking a video reached /watch with the script never injected. So
// @match is the whole site, and the work is gated on location.pathname ===
// '/watch' each time YouTube announces a navigation (yt-navigate-finish,
// yt-page-data-updated). Off /watch the script holds three document listeners
// and one window scroll listener, and nothing else.
//
// THE TOOLTIP IS OURS TOO. YouTube's hover tooltip is one shared <yt-tooltip>
// under <ytd-app>, a popover="manual" that YouTube positions and fills from its
// own data. Measured 2026-10-31 with a trusted hover: on Share it opened with
// "Share"; on a foreign button with Share's classes it stayed empty and closed.
// So the chip shows its own popover="manual" element, given the class list of
// YouTube's (ytd-app > yt-tooltip yt-popover) at runtime — measured identical:
// rgb(96,96,96), 8px padding, 4px radius, 12px/18px Roboto. It sits 16px under
// the button, centred, as YouTube's does. There is NO title attribute: a native
// tooltip on top of this one would be a double tooltip. If YouTube's tooltip is
// not in the page, there is no tooltip at all; the accessible name still is.
//
// FEEDBACK IS ON THE CHIP. The bar has had no text labels since at least
// 2026-10-31 (every action button measured 40px, textContent ""), so the 2.x
// "Storing audio / Stored / Failed" label had nowhere to show. Each state now
// has its own glyph and fill, and the accessible name and open tooltip follow:
//
//   idle      tray arrow   red   (--yt-sys-color-baseline--red-indicator)
//   storing   clock        stock tonal fill (the red is removed)
//   stored    check        green (--yt-sys-color-baseline--themed-green)
//   failed    cross        dark red (--…--error-indicator-inverse)
//
// The three tokens were read off <html> on 2026-10-31. Each literal after the
// comma is the measured value, used only if the token is renamed. Every glyph is
// drawn here in YouTube's idiom (one path, 24×24, flat fill); YouTube's own
// download glyph never renders for a non-Premium account, and a Material icon
// would pull Apache-2.0 art into an MIT file.
//
// THE FAILURE REPORT IS THE BODY, NOT THE STATUS CODE. Measured against the
// live MeTube on 2026-09-22, a refused add answers:
//
//   POST /add  {"url":"not-a-url",…}  ->  HTTP 200  {"status": "error", "msg": …}
//
// Two hundred, with the error in the body. accepted() reads the body, and
// anything that is not status:"ok" is a failure, an unparseable body included:
// that means something other than MeTube is answering on the port.
//
// THE FORMAT HAS TO BE SENT. MeTube's own mp3/mp4 preference lives in the
// localStorage of its web UI, on the 127.0.0.1 origin — a script on
// youtube.com cannot read it, and there is no server endpoint that exposes it
// (/config and /api/config both 404; only /version and /history answer).
// Leaving the fields out does NOT inherit that preference: measured 2026-09-22
// against the live instance, a body of url + auto_start alone is accepted and
// recorded as
//
//   download_type: "video"   format: "any"   quality: "best"
//
// so silence means video, not the user's default. The pair that selects audio
// is download_type + format together — download_type is the switch.
//
// Both paths verified end to end through a real install, 2026-09-22: a plain
// click queued download_type "audio" / format "mp3" and ran to done; an
// Alt-click queued "video" / "mp4". 3.0.0 sends the same body.
//
// NO m.youtube.com. The mobile DOM was never measured, and 127.0.0.1 on a phone
// is the PHONE, so the request could never reach the Mac's MeTube. A match that
// cannot work is worse than no match — it looks supported. Shorts are not
// supported either: /shorts/ fails the /watch gate and gets no chip.
//
// LIFECYCLE. One teardown, called at entry, never an "already initialised"
// early return — that would make a re-run a silent no-op and hide exactly the
// double-injection this contract exists to catch. A 2.x copy registered the
// same teardown name, so it is undone too and Share gets its own face back.
//   · ONE flag         `torn`, re-checked inside the coalescing frame, the
//                      flash timer and every GM_xmlhttpRequest callback,
//                      because all three OUTLIVE teardown.
//   · ONE controller   every listener carries { signal }, so teardown is one
//                      ac.abort().
//   · NOTHING OF YOUTUBE'S IS WRITTEN. The chip and its tooltip are our nodes;
//                      teardown removes them and the bar is stock.
//   · OBSERVERS. Two YouTube navigation events drive the pass. Measured
//                      2026-09-22, a subtree observer on ytd-shorts logged 331
//                      records for two reel advances, so the observers are
//                      narrow or short-lived:
//                      - childList on Share's row, so a rebuilt row gets the
//                        chip back;
//                      - a document subtree observer ONLY while on /watch and
//                        the bar is still missing after the 40-frame ladder
//                        (YouTube can draw Share after its last navigation
//                        event — measured 2026-10-31, ~3.5 s into a full
//                        load). It disconnects the moment Share is found or
//                        the route leaves /watch.
//
// FAILURE MODE. If YouTube redraws the share glyph or the icon wrapper class,
// shareButton() or the clone finds nothing and no chip is drawn: the bar
// renders stock. Nothing of YouTube's is hidden, moved, re-parented or
// rewritten.

(() => {
  'use strict';

  // Undo a previous copy before this one touches anything.
  const TEARDOWN = '__nixYoutubeShareToMetubeTeardown';
  if (typeof window[TEARDOWN] === 'function') {
    try { window[TEARDOWN](); } catch { /* the old copy is already gone */ }
  }

  const METUBE = 'http://127.0.0.1:8081/add';
  const QUALITY = 'best';

  // The two things a click can mean, each with the accessible name the chip
  // carries while it sends — so the modifier is never silent about what it
  // just did. See THE FORMAT HAS TO BE SENT above.
  const AUDIO = { download_type: 'audio', format: 'mp3', word: 'Storing audio' };
  const VIDEO = { download_type: 'video', format: 'mp4', word: 'Storing video' };

  // The watch action bar, and the row child that holds Share. #actions,
  // ytd-menu-renderer and the two row ids are structural, not generated —
  // measured 2026-09-22 and 2026-10-31.
  const BAR = 'ytd-watch-metadata #actions ytd-menu-renderer';
  const ROW_ITEM = '#top-level-buttons-computed > *, #flexible-item-buttons > *';
  const ROW = '#top-level-buttons-computed, #flexible-item-buttons';

  // Share's icon wrapper, cloned so the glyph sits exactly where Share's does.
  // Measured 2026-10-31.
  const ICON_WRAP = '.ytSpecButtonShapeNextIcon';

  // YouTube's tooltip bubble, whose class list our tooltip borrows. Measured
  // 2026-10-31 — see THE TOOLTIP IS OURS TOO.
  const YT_TIP = 'ytd-app > yt-tooltip yt-popover';
  // The gap between button and bubble, measured off YouTube's own: Share's
  // bottom at 650.45px, the bubble's top at 666px.
  const TIP_GAP = 16;

  // YouTube's share glyph, measured 2026-09-22, recounted 2026-10-31. A prefix:
  // the opening arrow has not moved, and it is unique inside BAR.
  const SHARE_D = 'M10 3.158V7.51c-5.428.223-8.27 3.75-8.875 11.199';

  // Ours, drawn in YouTube's idiom: one path, 24×24, flat fill.
  // An arrow descending into a tray.
  const STORE_D =
    'M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0' +
    'l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1Z' +
    'M4 15a1 1 0 0 1 1 1v3h14v-3a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z';
  // A clock: a ring and one hand. Drawn evenodd, so the inner circle is the hole.
  const CLOCK_D =
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z' +
    'M11 7h2v4.586l2.707 2.707-1.414 1.414L11 12.414V7Z';
  // A check mark.
  const CHECK_D = 'M9.5 15.6 5.4 11.5 4 12.9l5.5 5.5L20 7.9l-1.4-1.4-9.1 9.1Z';
  // A cross.
  const CROSS_D =
    'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z';

  // Fills, as YouTube's own design tokens with the measured value as fallback.
  // An empty fill means "no inline background", so the button shows Share's
  // own tonal fill from its class. Set inline because the stock background
  // comes from a class, which an inline declaration outranks without
  // !important.
  const RED = 'var(--yt-sys-color-baseline--red-indicator, #e1002d)';
  const GREEN = 'var(--yt-sys-color-baseline--themed-green, #2ba640)';
  const DARK_RED = 'var(--yt-sys-color-baseline--error-indicator-inverse, #c30027)';

  const LABEL = 'Store';
  // The idle accessible name, and therefore the idle tooltip. It opens with
  // the control's name, so speech and pixels agree.
  const HINT = `${LABEL} — Alt (⌥) click for video`;

  const LOOK = {
    idle: { d: STORE_D, fill: RED },
    storing: { d: CLOCK_D, fill: '' },
    stored: { d: CHECK_D, fill: GREEN },
    failed: { d: CROSS_D, fill: DARK_RED },
  };

  // Our attribute on our own button. The click delegate's selector, and what
  // tells shareButton() to skip the chip.
  const MARK = 'data-nix-metube';

  const FLASH_MS = 2400;

  // Frames, not milliseconds: the bar is built during the navigation YouTube
  // has just announced, so the wait is for layout, not for the network.
  const RETRY_FRAMES = 40;

  let torn = false;
  let frame = 0;
  let retries = 0;
  let rowObserver = null;
  let rowHost = null;
  let barObserver = null;
  let flashTimer = 0;
  let host = null;
  let button = null;
  let tip = null;
  let busy = false;

  const ac = new AbortController();
  const on = (target, type, fn, opts) =>
    target.addEventListener(type, fn, { ...opts, signal: ac.signal });

  const onWatch = () => location.pathname === '/watch';

  function shareButton() {
    const bar = document.querySelector(BAR);
    if (!bar) return null;
    for (const candidate of bar.querySelectorAll(`button:not([${MARK}])`)) {
      for (const path of candidate.querySelectorAll('svg path')) {
        if ((path.getAttribute('d') || '').startsWith(SHARE_D)) return candidate;
      }
    }
    return null;
  }

  // Built once, from Share's own parts. Returns null — and so no chip — when
  // Share's icon wrapper or its path is not where it was measured.
  function buildChip(share) {
    const wrap = share.querySelector(ICON_WRAP);
    if (!wrap) return null;
    const icon = wrap.cloneNode(true);
    const path = icon.querySelector('svg path');
    if (!path) return null;

    const btn = document.createElement('button');
    btn.setAttribute(MARK, '');
    btn.type = 'button';
    btn.appendChild(icon);

    const box = document.createElement('div');
    box.setAttribute(`${MARK}-host`, '');
    box.style.display = 'flex';
    box.appendChild(btn);

    host = box;
    button = btn;
    paint('idle', HINT);

    on(btn, 'pointerenter', showTip);
    on(btn, 'focus', showTip);
    on(btn, 'pointerleave', hideTip);
    on(btn, 'blur', hideTip);
    return box;
  }

  function paint(state, name) {
    if (!button) return;
    const look = LOOK[state];
    const path = button.querySelector('svg path');
    if (path) {
      path.setAttribute('d', look.d);
      // The clock's ring needs evenodd; the other glyphs are single contours
      // and render the same either way.
      path.setAttribute('fill-rule', 'evenodd');
    }
    button.style.backgroundColor = look.fill;
    button.setAttribute('data-nix-metube-state', state);
    button.setAttribute('aria-label', name);
    // An open tooltip follows the state change, in the same call.
    if (tip && tip.matches(':popover-open')) {
      tip.firstChild.textContent = name;
      placeTip();
    }
  }

  // Re-asserted every pass, so a restyled Share (theme switch, a new size
  // class) carries over to the chip.
  function placeChip(share) {
    const item = share.closest(ROW_ITEM);
    if (!item) return;
    if (!host && !buildChip(share)) return;
    if (button.className !== share.className) button.className = share.className;
    const margin = getComputedStyle(item).marginLeft;
    if (host.style.marginLeft !== margin) host.style.marginLeft = margin;
    if (item.nextElementSibling !== host) item.after(host);
    watchRow(item.parentElement);
  }

  function showTip() {
    if (torn || !button) return;
    const ref = document.querySelector(YT_TIP);
    if (!ref) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.setAttribute('popover', 'manual');
      tip.setAttribute(`${MARK}-tip`, '');
      tip.setAttribute('aria-hidden', 'true');
      tip.appendChild(document.createElement('span'));
      tip.style.position = 'fixed';
      tip.style.pointerEvents = 'none';
      document.body.appendChild(tip);
    }
    tip.className = ref.className;
    tip.firstChild.textContent = button.getAttribute('aria-label');
    if (!tip.matches(':popover-open')) tip.showPopover();
    placeTip();
  }

  function placeTip() {
    const b = button.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const left = Math.max(4, Math.min(window.innerWidth - t.width - 4, b.left + b.width / 2 - t.width / 2));
    tip.style.inset = `${Math.round(b.bottom + TIP_GAP)}px auto auto ${Math.round(left)}px`;
  }

  function hideTip() {
    if (tip && tip.matches(':popover-open')) tip.hidePopover();
  }

  // childList on the row only: YouTube rebuilds the row's children when the
  // bar reflows, and that is the one mutation that can drop the chip.
  function watchRow(row) {
    if (!row || !row.matches(ROW) || row === rowHost) return;
    unwatchRow();
    rowHost = row;
    rowObserver = new MutationObserver(schedule);
    rowObserver.observe(row, { childList: true });
  }

  function unwatchRow() {
    if (rowObserver) rowObserver.disconnect();
    rowObserver = null;
    rowHost = null;
  }

  function pass() {
    frame = 0;
    if (torn) return;

    if (!onWatch()) {
      // Off /watch nothing is watched. The chip stays in the hidden watch page
      // YouTube keeps around, which is where it is wanted on the way back.
      retries = 0;
      stopAwaitingBar();
      unwatchRow();
      hideTip();
      return;
    }

    const share = shareButton();
    if (!share) {
      if (retries++ < RETRY_FRAMES) schedule();
      else awaitBar();
      return;
    }
    retries = 0;
    stopAwaitingBar();
    placeChip(share);
  }

  // See OBSERVERS above: lives only while on /watch with Share missing, and
  // every mutation burst collapses into one frame through schedule().
  function awaitBar() {
    if (torn || barObserver || !onWatch()) return;
    barObserver = new MutationObserver(schedule);
    barObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopAwaitingBar() {
    if (barObserver) barObserver.disconnect();
    barObserver = null;
  }

  function schedule() {
    if (torn || frame) return;
    frame = requestAnimationFrame(pass);
  }

  function watchUrl() {
    const id = new URL(location.href).searchParams.get('v');
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }

  // See THE FAILURE REPORT IS THE BODY above.
  function accepted(res) {
    if (!res || res.status < 200 || res.status >= 300) return false;
    try {
      return JSON.parse(res.responseText).status === 'ok';
    } catch {
      return false;
    }
  }

  function send(url, kind) {
    busy = true;
    clearTimeout(flashTimer);
    paint('storing', kind.word);
    // One settle path for all four outcomes. A request in flight OUTLIVES
    // teardown, so `torn` is re-checked here and not only at the call site.
    const settle = (res) => {
      if (torn) return;
      busy = false;
      if (accepted(res)) paint('stored', 'Stored');
      else paint('failed', 'Failed — is MeTube running on 127.0.0.1:8081?');
      flashTimer = setTimeout(() => {
        if (!torn) paint('idle', HINT);
      }, FLASH_MS);
    };
    GM_xmlhttpRequest({
      method: 'POST',
      url: METUBE,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url,
        quality: QUALITY,
        download_type: kind.download_type,
        format: kind.format,
        auto_start: true,
      }),
      onload: settle,
      onerror: settle,
      ontimeout: settle,
      onabort: settle,
    });
  }

  // Capture phase, delegated: the chip sits inside YouTube's menu renderer,
  // and nothing of YouTube's should see a click that was ours.
  function onClick(event) {
    if (torn) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(`button[${MARK}]`)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const url = watchUrl();
    // One request at a time: a second click while storing would queue the same
    // video twice.
    if (!url || busy) return;

    // Alt, because it is the only modifier YouTube's action bar leaves alone.
    send(url, event.altKey ? VIDEO : AUDIO);
  }

  on(document, 'click', onClick, { capture: true });

  // YouTube's own navigation events: yt-navigate-finish fires on every
  // client-side route change, yt-page-data-updated on the re-render that can
  // follow one without a second navigate.
  const renavigate = () => {
    retries = 0;
    schedule();
  };
  on(document, 'yt-navigate-finish', renavigate);
  on(document, 'yt-page-data-updated', renavigate);
  on(window, 'scroll', hideTip, { passive: true });

  schedule();

  // ---- teardown ------------------------------------------------------------
  //
  // Stop new work, then remove the two nodes this script created. Nothing of
  // YouTube's was written, so there is nothing to put back.
  window[TEARDOWN] = () => {
    torn = true;
    ac.abort();

    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(flashTimer);

    unwatchRow();
    stopAwaitingBar();

    hideTip();
    if (tip) tip.remove();
    if (host) host.remove();
    tip = null;
    host = null;
    button = null;

    delete window[TEARDOWN];
  };
})();
