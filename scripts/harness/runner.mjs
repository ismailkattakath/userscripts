// Launches Chrome for Testing HEADLESS ONLY, injects the userscript at document-start
// (unless mode=stock), and hands each page to a probe module's default export.
//
// Refuses to run unless the browser process carries --headless: a windowed browser
// takes the operator's focus (measured 2026-11-26 — a headed fallback from another
// tool grabbed it on every page). launchServer() is used because only a server
// exposes the spawned process's arguments to check.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(process.env.NODE_PATH + '/');
const { chromium } = require('playwright-core');
const STATE = process.env.HARNESS_STATE;
const [probeFile, modeArg = 'both', url = 'https://github.com/NixOS/nixpkgs/pulls'] = process.argv.slice(2);

const server = await chromium.launchServer({ headless: true });
if (!server.process().spawnargs.some((a) => a.startsWith('--headless'))) {
  await server.close();
  throw new Error('refusing: browser is not headless');
}
const browser = await chromium.connect(server.wsEndpoint());
const probe = (await import(path.resolve(probeFile))).default;
const out = {};
try {
  for (const mode of modeArg === 'both' ? ['stock', 'script'] : [modeArg]) {
    const ctx = await browser.newContext({
      viewport: { width: 1400, height: Number(process.env.VH || 900) },
      colorScheme: process.env.SCHEME || 'dark',
    });
    const inject = path.join(STATE, 'inject.js');
    if (mode === 'script') await ctx.addInitScript({ path: inject });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(url, { waitUntil: 'load' });
    out[mode] = await probe({ page, mode, h: helpers(page), inject, shots: path.join(STATE, 'shots') });
    if (errors.length) out[`${mode}:errors`] = errors;
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(out, null, 1));

function helpers(page) {
  const card = () =>
    page.evaluate(() => {
      const v = [...document.querySelectorAll('.js-hovercard-content')].find(
        (h) => getComputedStyle(h).display !== 'none' && h.querySelector('.Popover-message'),
      );
      if (!v) return null;
      const r = v.querySelector('.Popover-message').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, sec: !!v.querySelector('[data-nix-ghchecks]') };
    });
  // Hover a PR title until GitHub's card opens (hydration can eat the first hover;
  // after a back-navigation React re-renders the list, so the link is re-located).
  async function openCard(idx) {
    let b = null;
    for (let r = 0; r < 10 && !b; r++) {
      try {
        const a = page.locator('a[data-hovercard-url$="/hovercard"]').nth(idx);
        await a.scrollIntoViewIfNeeded({ timeout: 2000 });
        b = await a.boundingBox();
      } catch {
        await page.waitForTimeout(300);
      }
    }
    if (!b) return { b: null, c: null };
    for (let k = 0; k < 4; k++) {
      await page.mouse.move(1390, 890);
      await page.waitForTimeout(400);
      await page.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 3 });
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(100);
        const c = await card();
        if (c) return { b, c };
      }
    }
    return { b, c: null };
  }
  // A straight pointer path at ~60 samples a second.
  async function glide(x0, y0, x1, y1, ms) {
    const n = Math.max(3, Math.round(ms / 16));
    for (let s = 1; s <= n; s++) {
      await page.mouse.move(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n);
      await page.waitForTimeout(ms / n);
    }
  }
  return { card, openCard, glide };
}
