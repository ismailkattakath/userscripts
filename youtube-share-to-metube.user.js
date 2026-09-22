// ==UserScript==
// @name         YouTube — Share becomes Store, handing the video to MeTube
// @namespace    kattakath.com
// @author       Ismail Kattakath
// @license      MIT
// @version      2.0.0
// @description  Turns the Share button on a YouTube watch page into a Store button that hands the video to a MeTube instance on 127.0.0.1:8081 instead of opening the share sheet. Label, tooltip and icon all change — the chip takes YouTube's own red behind a new arrow-into-a-tray glyph — so the control says what it now does, and it reports back on itself: Sending, Stored, Failed. Sharing stays available in the ⋯ menu. One local request, no token, no third-party host, nothing stored.
// @homepageURL  https://github.com/ismailkattakath/userscripts
// @supportURL   https://github.com/ismailkattakath/userscripts/issues
// @match        https://www.youtube.com/watch*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @noframes
// ==/UserScript==

// WHAT AND WHY. The operator runs MeTube on 127.0.0.1:8081 and wanted one click
// on a watch page to put the video in it. YouTube's action bar has no spare
// control, so one is taken over: the SHARE button is relabelled Store, given a
// new icon on a red chip, and its click is answered by a POST to MeTube.
//
// WHY SHARE AND NOT SAVE. Save was the obvious candidate and is the wrong one.
// Measured 2026-09-22, signed in, en-US, www.youtube.com/watch, the action bar
// reflows with the layout width:
//
//   layout width   #top-level-buttons-computed   #flexible-item-buttons
//   ~1378px        like/dislike, Share           Ask, Save
//    758px         like/dislike, Share           (empty — Save is in ⋯)
//
// Save LEAVES the bar when the window narrows — not hidden, absent, and
// materialising only once the ⋯ popup is opened. A control that disappears at
// some window widths cannot be the one-click path, and dragging it back would
// mean fighting YouTube's overflow logic every reflow. Share held the same
// container at both widths, so Share is the anchor. Sharing is not lost: it is
// in the ⋯ menu, which is exactly where Save went.
//
// THE ANCHOR IS GEOMETRY, NOT LANGUAGE. This repository bans aria-label as a
// selector because it is localised: a test for "Share" matches nothing on a
// non-English UI. Measured 2026-09-22, the button carries no id, no data
// attribute and no stable class — only the generated ytSpecButtonShapeNext*
// set. What it does carry is its ICON, and an SVG path reads the same in every
// locale. The share glyph's `d` begins:
//
//   M10 3.158V7.51c-5.428.223-8.27 3.75-8.875 11.199
//
// Counted the same day: 6 nodes document-wide carry that path — the watch bar's
// Share plus one inside each sidebar video's ⋮ menu — and exactly 1 inside
//
//   ytd-watch-metadata #actions ytd-menu-renderer
//
// so the scope is load-bearing, not decoration. Drop it and the script would
// relabel five recommendation menus.
//
// THE ICON IS OURS. YouTube's own download glyph never renders for a
// non-Premium account, so there was nothing on the page to copy and copying a
// Material icon would pull Apache-2.0 art into an MIT file for no gain. STORE_D
// below is drawn here, in YouTube's idiom — one path, 24×24 viewBox, flat fill —
// an arrow descending into a tray. The CHIP behind it is filled from YouTube's
// own red design token — see BRAND_RED — and nothing else is recoloured: glyph
// and label keep YouTube's own treatment, so the button still reads as one of
// the bar's rather than as something bolted on, and it is the fill that marks it
// as no longer YouTube's.
//
// THE FAILURE REPORT IS THE BODY, NOT THE STATUS CODE. Measured against the
// live MeTube on 2026-09-22, a refused add answers:
//
//   POST /add  {"url":"not-a-url",…}  ->  HTTP 200  {"status": "error", "msg": …}
//
// Two hundred, with the error in the body. The previous version tested
// res.status and so flashed "Sent" on an add MeTube had just rejected —
// operation successful, patient died. accepted() reads the body instead, and
// anything that is not status:"ok" is a failure, an unparseable body included:
// that means something other than MeTube is answering on the port. The add
// needs only url, quality, format and auto_start — download_type, which the old
// version sent, is not required (verified the same day against the instance).
//
// NO m.youtube.com. The old header matched it. It is dropped for two reasons,
// the second sufficient on its own: the mobile DOM was never measured, and
// 127.0.0.1 on a phone is the PHONE, so the request could never reach the Mac's
// MeTube. A match that cannot work is worse than no match — it looks supported.
//
// LIFECYCLE. One teardown, called at entry, never an "already initialised"
// early return — that would make a re-run a silent no-op and hide exactly the
// double-injection this contract exists to catch.
//   · ONE flag         `torn`, re-checked inside the coalescing frame and in
//                      every GM_xmlhttpRequest callback, because a queued frame
//                      and an in-flight request both OUTLIVE teardown.
//   · ONE controller   every listener carries { signal }, so teardown is one
//                      ac.abort() rather than a removeEventListener list that
//                      rots the first time a listener is added and not mirrored.
//   · RECORD BEFORE WRITING. The button is YouTube's. Its icon path, label
//                      text and three attributes are recorded as they are
//                      overwritten and put back on teardown — an attribute that
//                      was ABSENT is removed again, never set to empty string,
//                      which is a different DOM.
//   · NO OBSERVER ON A BIG DOM. Two navigation events YouTube already fires
//                      (yt-navigate-finish, yt-page-data-updated) drive the
//                      pass. Measured 2026-09-22, that matters: a subtree
//                      observer on ytd-shorts logged 331 records for two reel
//                      advances, and ytd-watch-metadata is no cheaper on a live
//                      page. The two observers this script does hold are both
//                      on nodes small enough to name — childList on the
//                      two-child button row, and childList + characterData on
//                      the one-span tooltip, the latter only while the pointer
//                      or focus is actually on our button.
//
// FAILURE MODE. If YouTube redraws the share glyph, shareButton() finds nothing,
// the retry ladder expires, and the bar renders stock — a Share button that
// shares. Nothing is ever hidden, moved or re-parented: the only writes are one
// button's label, three of its attributes, its icon's `d`, and, while that
// button is hovered, the shared tooltip's text. Verified 2026-09-22 by restoring
// on a live watch page — every one of those returned to its recorded value and
// the native share sheet opened on the next click.

(() => {
  'use strict';

  // Undo a previous copy before this one touches anything of YouTube's.
  const TEARDOWN = '__nixYoutubeShareToMetubeTeardown';
  if (typeof window[TEARDOWN] === 'function') {
    try { window[TEARDOWN](); } catch { /* the old copy is already gone */ }
  }

  const METUBE = 'http://127.0.0.1:8081/add';
  const QUALITY = 'best';
  const FORMAT = 'mp4';

  // The watch action bar. #actions and ytd-menu-renderer are structural, not
  // generated — see THE ANCHOR IS GEOMETRY above for the count that makes this
  // scope load-bearing.
  const BAR = 'ytd-watch-metadata #actions ytd-menu-renderer';

  // YouTube's share glyph, measured 2026-09-22. A prefix, not the whole path:
  // the tail carries the sub-path that YouTube has redrawn before, the opening
  // arrow has not moved, and matching the opening is enough to be unique inside
  // BAR while surviving a touch-up.
  const SHARE_D = 'M10 3.158V7.51c-5.428.223-8.27 3.75-8.875 11.199';

  // Ours, drawn in YouTube's idiom: one path, 24×24, flat fill. An arrow
  // descending into a tray.
  const STORE_D =
    'M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0' +
    'l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1Z' +
    'M4 15a1 1 0 0 1 1 1v3h14v-3a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z';

  // Our own attribute on YouTube's button. It is both the "already taken over"
  // test and the click delegate's selector — the glyph test cannot serve as
  // either, because the first pass overwrites the very path it matched on.
  const MARK = 'data-nix-metube';

  // The chip's fill, and the TOKEN rather than a hex. #FF0000 is the logo red
  // and is NOT this palette's red: measured 2026-09-22, the masthead's
  // notification count badge computes to rgb(225, 0, 45), which YouTube declares
  // on <html> for both themes as
  //
  //   [light], html · [dark], html[dark]
  //     --yt-sys-color-baseline--red-indicator: #e1002d
  //
  // so binding to the token tracks the palette instead of freezing today's
  // value; chip and badge were confirmed identical the same day. The literal is
  // the FALLBACK only — a renamed token degrades to the measured red, not to
  // transparent. Set inline because the stock background comes from a class
  // (ytSpecButtonShapeNextTonal), which an inline declaration outranks without
  // needing !important.
  const BRAND_RED = 'var(--yt-sys-color-baseline--red-indicator, #e1002d)';

  // YouTube's hover tooltip is NOT the title attribute. Measured 2026-09-22:
  // one <yt-tooltip> hangs off <ytd-app> and is REUSED by every control on the
  // page, its single <span> refilled from YouTube's own data the instant a
  // control is hovered. A rewritten title never reaches it, so without this the
  // red Store chip would hover as "Share" — the one surface still telling the
  // old story. It is corrected while, and only while, our button is hovered or
  // focused; see holdTooltip().
  const TOOLTIP = 'yt-tooltip';

  const LABEL = 'Store';
  const FLASH_MS = 1600;

  // Frames, not milliseconds: the bar is built during the navigation YouTube
  // has just announced, so the wait is for layout, not for the network.
  const RETRY_FRAMES = 40;

  let torn = false;
  let frame = 0;
  let retries = 0;
  let rowObserver = null;
  let rowHost = null;
  let tipObserver = null;

  const ac = new AbortController();
  const on = (target, type, fn, opts) =>
    target.addEventListener(type, fn, { ...opts, signal: ac.signal });

  // button -> what YouTube had before we wrote over it. A Map, not a WeakMap,
  // because teardown has to ENUMERATE it; pass() prunes detached buttons so a
  // long session of client-side navigation does not accumulate them.
  const original = new Map();

  // button -> the timer that will put LABEL back after a flash. Kept out of
  // `original` so a flash in progress cannot be mistaken for recorded state.
  const flashTimer = new WeakMap();

  const setAttr = (el, name, value) => {
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  };

  // The one way an event reaches our button. MARK is the selector because the
  // glyph test cannot be: the first pass overwrites the very path it matched on.
  const ourButton = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    return target ? target.closest(`button[${MARK}]`) : null;
  };

  // The label is the first non-empty text node in the button. Read positionally
  // rather than by comparing against "Share", which is localised and would make
  // this a no-op on a non-English UI.
  function labelNode(button) {
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.replace(/\s+/g, ' ').trim()) return node;
    }
    return null;
  }

  // Matches either glyph, so the same lookup works before and after the swap
  // and survives YouTube rebuilding the <svg> under a button it kept.
  function iconNode(button) {
    for (const path of button.querySelectorAll('svg path')) {
      const d = path.getAttribute('d') || '';
      if (d.startsWith(SHARE_D) || d.startsWith(STORE_D)) return path;
    }
    return null;
  }

  function shareButton() {
    const bar = document.querySelector(BAR);
    if (!bar) return null;
    const taken = bar.querySelector(`button[${MARK}]`);
    if (taken) return taken;
    for (const button of bar.querySelectorAll('button')) {
      if (iconNode(button)) return button;
    }
    return null;
  }

  // The word, on the label and the accessible name together. The hover tooltip
  // follows from the accessible name — see retitle() — so all three agree
  // without this function knowing the tooltip exists.
  function dress(button, word) {
    const state = original.get(button);
    let node = state && state.labelNode;
    if (!node || !node.isConnected) {
      node = labelNode(button);
      if (state) state.labelNode = node;
    }
    if (node) node.nodeValue = word;
    button.setAttribute('aria-label', word);
    button.setAttribute('title', word);
  }

  function flash(button, word) {
    dress(button, word);
    clearTimeout(flashTimer.get(button));
    flashTimer.set(
      button,
      setTimeout(() => {
        flashTimer.delete(button);
        if (!torn && button.isConnected) dress(button, LABEL);
      }, FLASH_MS),
    );
  }

  // Record first, then write. Re-entrant: a button already carrying MARK keeps
  // its recorded original and only has our label and icon re-asserted, which is
  // what makes this safe to run on every frame of the retry ladder.
  function takeOver(button) {
    const icon = iconNode(button);
    if (!original.has(button)) {
      const node = labelNode(button);
      original.set(button, {
        d: icon ? icon.getAttribute('d') : null,
        // The whole style ATTRIBUTE, not button.style.backgroundColor. Clearing
        // one property leaves style="" behind, which is a different DOM from no
        // attribute; restoring the attribute puts the node back byte for byte.
        // Recording the COMPUTED background instead would nail the chip to
        // today's theme and break when YouTube's dark mode flips.
        style: button.getAttribute('style'),
        labelNode: node,
        label: node ? node.nodeValue : null,
        aria: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
      });
      button.setAttribute(MARK, '');
    }

    if (icon && (icon.getAttribute('d') || '') !== STORE_D) icon.setAttribute('d', STORE_D);
    // Unconditional, not guarded by an equality test: a var() survives CSSOM
    // read-back today, and the moment it did not the guard would silently never
    // match. A property write is cheaper than a guard that needs re-measuring.
    button.style.backgroundColor = BRAND_RED;

    // A flash in progress owns the label. Overwriting it here would swallow the
    // one piece of feedback the click produces.
    if (!flashTimer.has(button)) dress(button, LABEL);
  }

  function tipSpan() {
    const tip = document.querySelector(TOOLTIP);
    return tip ? tip.querySelector('span') : null;
  }

  // The accessible name is the single source of the word, so a flash reaches the
  // tooltip too and the two never disagree. The !== guard is what stops the
  // observer re-entering on its own write.
  function retitle(button) {
    const span = tipSpan();
    const word = button.getAttribute('aria-label');
    if (span && word && span.textContent !== word) span.textContent = word;
  }

  // Attached on enter, dropped on the next enter anywhere else, so YouTube's
  // tooltip behaves exactly as it always did for every other control. The node
  // is one span, so childList + characterData on it is a cheap observation, not
  // the subtree observer the doctrine warns about.
  function holdTooltip(button) {
    releaseTooltip();
    const tip = document.querySelector(TOOLTIP);
    if (!tip) return;
    tipObserver = new MutationObserver(() => retitle(button));
    tipObserver.observe(tip, { childList: true, characterData: true, subtree: true });
    retitle(button);
  }

  function releaseTooltip() {
    if (tipObserver) tipObserver.disconnect();
    tipObserver = null;
  }

  // Re-assert on the two-child row only. childList, no subtree: YouTube rebuilds
  // the row wholesale when the bar reflows, and that is the only mutation that
  // can lose our label.
  function watchRow(button) {
    const row = button.closest('#top-level-buttons-computed, #flexible-item-buttons');
    if (!row || row === rowHost) return;
    if (rowObserver) rowObserver.disconnect();
    rowHost = row;
    rowObserver = new MutationObserver(schedule);
    rowObserver.observe(row, { childList: true });
  }

  function pass() {
    frame = 0;
    if (torn) return;

    for (const button of original.keys()) {
      if (!button.isConnected) original.delete(button);
    }

    const button = shareButton();
    if (!button) {
      // The bar has not been built yet, or the glyph is gone. Either way the
      // ladder expires and the page stays stock.
      if (retries++ < RETRY_FRAMES) schedule();
      return;
    }
    retries = 0;
    takeOver(button);
    watchRow(button);
  }

  function schedule() {
    if (torn || frame) return;
    frame = requestAnimationFrame(pass);
  }

  function watchUrl() {
    const id = new URL(location.href).searchParams.get('v');
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }

  // See THE FAILURE REPORT IS THE BODY above. An unparseable body is a failure
  // too: it means something other than MeTube answered on that port.
  function accepted(res) {
    if (!res || res.status < 200 || res.status >= 300) return false;
    try {
      return JSON.parse(res.responseText).status === 'ok';
    } catch {
      return false;
    }
  }

  function send(url, button) {
    flash(button, 'Sending');
    // One settle path for all four outcomes. A request in flight OUTLIVES
    // teardown, so `torn` is re-checked here and not only at the call site.
    const settle = (res) => {
      if (!torn) flash(button, accepted(res) ? 'Stored' : 'Failed');
    };
    GM_xmlhttpRequest({
      method: 'POST',
      url: METUBE,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ url, quality: QUALITY, format: FORMAT, auto_start: true }),
      onload: settle,
      onerror: settle,
      ontimeout: settle,
      onabort: settle,
    });
  }

  // Capture phase, and stopImmediatePropagation: YouTube's own handler is bound
  // on the button itself, so a bubble-phase listener would arrive after the
  // share sheet had already opened.
  function onClick(event) {
    if (torn) return;
    const button = ourButton(event);
    if (!button) return;

    // Not a watch URL — YouTube keeps the click and the share sheet opens. The
    // relabelled button is only ours where there is a video to store.
    const url = watchUrl();
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    send(url, button);
  }

  on(document, 'click', onClick, { capture: true });

  // One handler for both ways a tooltip is summoned. Delegated on the document,
  // so the pointer moving onto ANY other control releases our hold in the same
  // event that YouTube uses to refill the tooltip for that control.
  const aim = (event) => {
    if (torn) return;
    const button = ourButton(event);
    if (button) holdTooltip(button);
    else releaseTooltip();
  };
  on(document, 'mouseover', aim, { capture: true });
  on(document, 'focusin', aim, { capture: true });

  // YouTube's own navigation events, both of them: yt-navigate-finish fires on
  // every client-side route change, yt-page-data-updated on the re-render that
  // can follow one without a second navigate.
  const renavigate = () => {
    retries = 0;
    schedule();
  };
  on(document, 'yt-navigate-finish', renavigate);
  on(document, 'yt-page-data-updated', renavigate);

  schedule();

  // ---- teardown ------------------------------------------------------------
  //
  // Stop new work, then put YouTube's button back exactly as it was found: icon
  // path, label text, and the three attributes — aria-label, title and style,
  // each removed again if it was absent rather than set to an empty string,
  // which is a different DOM.
  window[TEARDOWN] = () => {
    torn = true;

    // Drops the delegated click AND the navigation listeners in one call.
    ac.abort();

    if (frame) cancelAnimationFrame(frame);
    frame = 0;

    if (rowObserver) rowObserver.disconnect();
    rowObserver = null;
    rowHost = null;
    releaseTooltip();

    for (const [button, state] of original) {
      clearTimeout(flashTimer.get(button));
      flashTimer.delete(button);

      const icon = iconNode(button);
      if (icon && state.d !== null) icon.setAttribute('d', state.d);

      const node = state.labelNode && state.labelNode.isConnected
        ? state.labelNode
        : labelNode(button);
      if (node && state.label !== null) node.nodeValue = state.label;

      // A tooltip left open across a teardown would keep our word until the
      // next hover refilled it. Put it back, but only if it is still showing
      // OURS — never overwrite a tooltip that has moved on to another control.
      const span = tipSpan();
      if (span && span.textContent === button.getAttribute('aria-label') && state.label !== null) {
        span.textContent = state.label.replace(/\s+/g, ' ').trim();
      }

      setAttr(button, 'aria-label', state.aria);
      setAttr(button, 'title', state.title);
      setAttr(button, 'style', state.style);
      button.removeAttribute(MARK);
    }
    original.clear();

    delete window[TEARDOWN];
  };
})();
