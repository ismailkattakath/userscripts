// Acceptance spec for google-photos-icon-nav.user.js — the gate lint and geometry are not.
//
// Run it (page-lab is not on PATH; Chromium must be on :9222 with a Photos tab open):
//
//   pl=$(ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | tail -1)
//   node "$pl/userscript-acceptance.mjs" --repeat 3 google-photos-icon-nav.acceptance.mjs
//
// This file is DATA, not a test runner — the runner lives in page-lab, so this repo keeps
// its "no build, no package manager, no test runner" shape. Nothing here is imported by
// the userscript and nothing ships to Greasy Fork.
//
// Why it exists at all: 3.0.0 passed `userscript-meta-lint.sh`, passed every geometry
// check, and shipped with search DEAD — present, 40x40, hit-testable, and inert under a
// real click. Presence is not behaviour. Every assertion below that can be made by
// operating the page is made that way.
//
// Run it on the GRID view (photos.google.com/u/<n>/). An album or item view builds a
// different shell and several anchors legitimately read differently there.

export const urlMatch = 'photos.google.com';
export const script = './google-photos-icon-nav.user.js';

const NAV = '[role="navigation"]';
const BAR = '[role="menubar"]';
const PANE = 'div:has(> [role="main"])';
const BURGER = '.nix-photos-burger';
const AVATAR = '[role="menubar"] a[href*="SignOutOptions"]';

/** The drawer animates (transform .18s). Never sleep at it — poll until x stops moving. */
const navX = (t) => t.settle(() => t.ev(`(()=>{const n=document.querySelector('${NAV}');
  return n?Math.round(n.getBoundingClientRect().x):null})()`));

export default async function run(t) {
  // The grid path we must still be on at the end. Typing into a live search field can
  // commit a query -- it did, once, landing on /u/<n>/search/<token>, which builds a
  // DIFFERENT shell and made every later assertion fail for the wrong reason. So the
  // search block below returns here rather than leaving the page wherever it drifted.
  const startPath = await t.ev('location.pathname');

  // ---- stock baseline, for the teardown comparison at the end ----------------------
  await t.teardown();
  await t.sleep(400);
  await t.ev('window.dispatchEvent(new Event("resize")); true');
  await t.sleep(600);
  const stock = await t.ev(`(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;
    const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),
      w:Math.round(b.width),h:Math.round(b.height)}};
    return {nav:R('${NAV}'), pane:R('${PANE}'),
      searchInBar:!!document.querySelector('${BAR} input'),
      barKids:document.querySelectorAll('${BAR} > *').length}})()`);

  await t.inject();
  await navX(t);

  const vp = await t.ev('({w:innerWidth,h:innerHeight})');
  const pane = await t.rect(PANE);
  t.check('full-bleed pane == viewport',
    pane && pane.x === 0 && pane.y === 0 && pane.w === vp.w && pane.h === vp.h, { pane, vp });

  const closedNav = await t.rect(NAV);
  const attr = await t.ev(`document.documentElement.getAttribute('data-nix-photos-drawer')`);
  t.check('drawer hidden by default', closedNav && closedNav.x < 0 && !attr, { closedNav, attr });

  const barKids = await t.ev(`[...document.querySelectorAll('${BAR} > *')]
    .filter(c=>c.getBoundingClientRect().width>0)
    .map(c=>({w:Math.round(c.getBoundingClientRect().width),
      hasSignOut:!!c.querySelector('a[href*="SignOutOptions"]')}))`);
  t.check('bar reduced to the account cluster only',
    barKids.length === 1 && barKids[0].hasSignOut, barKids);

  const burger = await t.rect(BURGER);
  t.check('our burger exists', !!burger, burger);
  t.check('burger aria-expanded=false when closed',
    (await t.ev(`document.querySelector('${BURGER}')?.getAttribute('aria-expanded')`)) === 'false');

  t.check('search relocated into the drawer',
    !!(await t.ev(`!!document.querySelector('${NAV} input')`)));

  // The v3 defect this repo shipped: a 1318px transparent strip that ate every click over
  // the top of the grid. Assert the point is OUTSIDE the bar — "looks like grid markup"
  // once passed here while every point was still inside it.
  // Sampled as FRACTIONS of the viewport, not fixed pixels. A hardcoded x=1300 read back
  // null under a 1280-wide device emulation — a spec that only holds at the author's own
  // window is not a spec. The last sample stops short of the account cluster, which is
  // the one part of the bar that SHOULD still take clicks.
  const hits = {};
  for (const f of [0.09, 0.31, 0.59, 0.79, 0.88]) {
    const x = Math.round(vp.w * f);
    hits['x' + x] = await t.hit(x, 32, BAR);
  }
  t.check('top strip click-through (5 points land outside the bar)',
    Object.values(hits).every((h) => h && h.inside === false), hits);

  // ---- the Memories carousel is gone, and the grid took its space --------------------
  // Asserted as a RECLAIM, not merely "the row is hidden": the whole point is the 248px,
  // so the check that matters is where the grid now starts.
  const mem = await t.ev(`(()=>{
    const row=document.querySelector('c-wiz:has(+ [data-show-grid-memories]):has(a[href*="/memory/"])');
    const grid=document.querySelector('[data-show-grid-memories]');
    if(!grid)return null;
    return {rowFound:!!row, rowH:row?Math.round(row.getBoundingClientRect().height):0,
      gridY:Math.round(grid.getBoundingClientRect().y),
      memoryLinks:document.querySelectorAll('[data-show-grid-memories] ~ * a[href*="/memory/featured/"]').length}})()`);
  t.check('Memories carousel is hidden and the grid starts at the top',
    mem !== null && mem.rowH === 0 && mem.gridY < 40, mem);

  // ---- month/date headings are hidden from SIGHT but not from a screen reader --------
  // Both halves are the assertion. Painting nothing is what was asked for; staying in the
  // accessibility tree is what stops it being a regression, since those headings are the
  // only navigation structure a date-grouped gallery has. Gaps are NOT asserted to close
  // -- measured, they do not, because Photos positions each section with a JS transform.
  const heads = await t.ev(`(()=>{
    const hs=[...document.querySelectorAll('[data-show-grid-memories] h1,[data-show-grid-memories] h2')];
    if(!hs.length)return null;
    return {n:hs.length,
      maxPaintedW:Math.max(...hs.map(h=>Math.round(h.getBoundingClientRect().width))),
      maxPaintedH:Math.max(...hs.map(h=>Math.round(h.getBoundingClientRect().height))),
      textKept:hs.every(h=>(h.textContent||'').trim().length>0),
      // Scope, asserted directly rather than inferred from paint. Photos' OWN
      // screen-reader hint ("Press question mark...") is an h2 that is already 1px
      // wide by Photos' own sr-only styling, so "is it 1px?" wrongly reads as "did we
      // hide it?" -- that false positive is why this asks the selector instead.
      selectorStaysInGrid:[...document.querySelectorAll(
        '[data-show-grid-memories] h1,[data-show-grid-memories] h2')]
        .every(h=>h.closest('[data-show-grid-memories]') !== null)}})()`);
  t.check('date headings painted away but text retained',
    heads !== null && heads.maxPaintedW <= 1 && heads.maxPaintedH <= 1 &&
      heads.textKept && heads.selectorStaysInGrid, heads);

  // ---- the one control the operator called non-negotiable ---------------------------
  const av = await t.clickSel(AVATAR);
  if (av === null) {
    t.check('profile popover opens, on top, no navigation', false, 'avatar not found');
  } else {
    // stableFor 3, not 2: this popover grows in steps and read the SAME height twice
    // mid-growth (210px) before settling at 622px.
    const pop = await t.settle(
      () => t.ev(`(()=>{const f=document.querySelector('iframe[name="account"]');if(!f)return null;
        const b=f.getBoundingClientRect();
        const top=document.elementFromPoint(Math.round(b.x+b.width/2),Math.round(b.y+b.height/2));
        return {w:Math.round(b.width),h:Math.round(b.height),onTop:top===f,
          path:location.pathname}})()`),
      // `onTop` in the accept, not just a stable height. This popover pauses while it
      // grows — measured stable at 622px for three consecutive reads before continuing
      // to its real 860px, and at that intermediate size the probe point is not yet over
      // the iframe, so the assertion fired against a popover that was merely still
      // opening. Settling on the property being asserted is what makes it honest.
      { stableFor: 3, accept: (v) => v !== null && v.h > 100 && v.onTop === true },
    );
    t.check('profile popover opens, on top, no navigation',
      pop && pop.w > 100 && pop.onTop && pop.path.startsWith('/u/'), pop);
    await t.key('Escape');
    await t.sleep(500);
  }

  // ---- the drawer as an interface ---------------------------------------------------
  await t.click(burger.x + burger.w / 2, burger.y + burger.h / 2);
  await navX(t);
  t.check('burger opens the drawer',
    (await t.rect(NAV)).x === 0 &&
      (await t.ev(`document.documentElement.getAttribute('data-nix-photos-drawer')`)) === 'open');

  // Count wide links rather than sampling the first few: the relocated Settings link sits
  // in the drawer header at 48px and is not a nav item.
  const wide = await t.ev(`[...document.querySelectorAll('${NAV} a[href]')]
    .filter(a=>a.getBoundingClientRect().width>=200).length`);
  t.check('drawer shows LABELLED nav items (>=5 links at >=200px)', wide >= 5, { wide });

  t.check('burger aria-expanded=true when open',
    (await t.ev(`document.querySelector('${BURGER}')?.getAttribute('aria-expanded')`)) === 'true');

  await t.key('Escape');
  await navX(t);
  t.check('Escape closes the drawer', (await t.rect(NAV)).x < 0);

  await t.click(burger.x + burger.w / 2, burger.y + burger.h / 2);
  await navX(t);
  await t.click(Math.round(vp.w * 0.6), Math.round(vp.h * 0.7));
  await navX(t);
  t.check('click-outside closes the drawer', (await t.rect(NAV)).x < 0);

  // ---- search actually works where we put it ----------------------------------------
  await t.ev(`document.documentElement.setAttribute('data-nix-photos-drawer','open'); true`);
  await navX(t);
  // Photos ships a DISABLED decoy input beside the live one; targeting the widest input
  // picked the decoy and reported a working field as broken.
  const probe = await t.ev(`(()=>{const n=document.querySelector('${NAV}');if(!n)return null;
    const live=[...n.querySelectorAll('input')]
      .filter(i=>!i.disabled&&!i.readOnly&&i.getBoundingClientRect().width>40)
      .sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
    if(!live)return null; live.dataset.nixProbe='1';
    const b=live.getBoundingClientRect();
    return {x:b.x+b.width/2,y:b.y+b.height/2,w:Math.round(b.width),before:live.value}})()`);
  if (probe === null) {
    t.check('search in the drawer accepts typing', false, 'no live input in the drawer');
  } else {
    await t.click(probe.x, probe.y);
    await t.sleep(800);
    await t.type('dog');
    await t.sleep(600);
    const after = await t.ev(`document.querySelector('input[data-nix-probe="1"]')?.value ?? null`);
    // Delta, not equality: this is a controlled input — text lands at the CARET and a
    // `value = ''` reset is reverted, so an exact assertion accumulates across runs.
    t.check('search in the drawer accepts typing',
      typeof after === 'string' && after.length === probe.before.length + 3 && after.includes('dog'),
      { before: probe.before, after });
    await t.clearInput('input[data-nix-probe="1"]');
    await t.ev(`(()=>{const i=document.querySelector('input[data-nix-probe="1"]');
      if(i)delete i.dataset.nixProbe;
      document.documentElement.removeAttribute('data-nix-photos-drawer');return true})()`);
    await t.key('Escape');
    await navX(t);
    // Back to the grid if a query got committed, and re-inject: a real navigation takes
    // our injected copy with it, and every remaining check assumes the shell is up.
    const here = await t.ev('location.pathname');
    if (here !== startPath) {
      t.check('search typing did not commit a query', false, { startPath, here });
      await t.ev(`location.href = ${JSON.stringify('https://photos.google.com')} + ${JSON.stringify(startPath)}; true`);
      await t.settle(() => t.ev('location.pathname + ":" + document.readyState'),
        { stableFor: 3, gap: 600, accept: (v) => v === startPath + ':complete' });
      await t.inject();
      await navX(t);
    }
  }

  // ---- the Google apps proxy opens the real panel -------------------------------------
  // It is a proxy on purpose: moving the real control orphans its popover (the apps-only
  // wrapper owns no iframe) and moving the wrapper that DOES own it drags the avatar out
  // of the bar and right-aligns the panel off-screen. So assert the outcome a user cares
  // about -- the panel opens, on top, drawer shut, no navigation -- not where the node is.
  await t.ev(`document.documentElement.setAttribute('data-nix-photos-drawer','open'); true`);
  await navX(t);
  const proxy = await t.rect('.nix-photos-apps');
  t.check('Google apps proxy is in the drawer', !!proxy && proxy.w > 0, proxy);
  if (proxy) {
    await t.click(proxy.x + proxy.w / 2, proxy.y + proxy.h / 2);
    const panel = await t.settle(
      () => t.ev(`(()=>{const f=document.querySelector('iframe[name="app"]');if(!f)return null;
        const b=f.getBoundingClientRect();
        const top=document.elementFromPoint(Math.round(b.x+b.width/2),Math.round(b.y+b.height/2));
        return {w:Math.round(b.width),h:Math.round(b.height),onTop:top===f,
          drawer:document.documentElement.getAttribute('data-nix-photos-drawer'),
          path:location.pathname}})()`),
      { stableFor: 3, accept: (v) => v !== null && v.h > 100 },
    );
    t.check('Google apps panel opens, on top, drawer shut, no navigation',
      panel && panel.w > 100 && panel.h > 100 && panel.onTop &&
        panel.drawer === null && panel.path.startsWith('/u/'), panel);
    await t.key('Escape');
    await t.sleep(700);
  }
  await t.ev(`document.documentElement.removeAttribute('data-nix-photos-drawer'); true`);
  await navX(t);

  // ---- a second copy must not livelock (the Greasy Fork + manual install case) -------
  const t0 = Date.now();
  await t.ev(`(0,eval)(${JSON.stringify(t.source.replace(/^\s*\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/m, ''))}); true`);
  await t.sleep(600);
  await navX(t);
  const dbl = await t.rect(PANE);
  t.check('second run is not a no-op and does not livelock',
    dbl && dbl.w === vp.w && Date.now() - t0 < 8000, { pane: dbl, ms: Date.now() - t0 });

  // ---- teardown owes the page its stock self back ------------------------------------
  await t.teardown();
  await t.sleep(500);
  await t.ev('window.dispatchEvent(new Event("resize")); true');
  await t.sleep(900);
  const after = await t.ev(`(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;
    const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),
      w:Math.round(b.width),h:Math.round(b.height)}};
    return {nav:R('${NAV}'), pane:R('${PANE}'),
      searchBackInBar:!!document.querySelector('${BAR} input'),
      barKids:document.querySelectorAll('${BAR} > *').length,
      ourChrome:document.querySelectorAll('[class*="nix-photos"]').length,
      ourStyle:document.querySelectorAll('style[data-nix-google-photos-rail]').length,
      attrs:['data-nix-photos-drawer','data-nix-photos-shell','data-nix-photos-tools']
        .filter(a=>document.documentElement.hasAttribute(a))}})()`);
  t.check('teardown: nav back to stock position',
    after.nav && after.nav.x === stock.nav.x && after.nav.w === stock.nav.w,
    { after: after.nav, stock: stock.nav });
  t.check('teardown: pane back to stock inset',
    after.pane && after.pane.x === stock.pane.x && after.pane.y === stock.pane.y,
    { after: after.pane, stock: stock.pane });
  t.check('teardown: search group back in the bar',
    after.searchBackInBar === true && after.barKids === stock.barKids,
    { after, stock: { s: stock.searchInBar, k: stock.barKids } });
  t.check('teardown: our chrome, style and attributes all gone',
    after.ourChrome === 0 && after.ourStyle === 0 && after.attrs.length === 0, after);
}
