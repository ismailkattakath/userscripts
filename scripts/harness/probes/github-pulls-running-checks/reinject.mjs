// Second copy injected over the first: the first must stand down — one section, one request per hover, two sheets not four.
import fs from 'node:fs';
export default async ({ page, h, inject }) => {
  const src = fs.readFileSync(inject, 'utf8');
  let hits = 0; page.on('request', (r) => { if (/\/pull\/\d+\/checks$/.test(r.url())) hits++; });
  const s0 = await page.evaluate(() => [...document.querySelectorAll('style')].filter((s) => s.textContent.includes('nix-ghchecks')).length);
  await page.evaluate((code) => (0, eval)(code), src);
  const s1 = await page.evaluate(() => [...document.querySelectorAll('style')].filter((s) => s.textContent.includes('nix-ghchecks')).length);
  const { c } = await h.openCard(6); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({ sections: document.querySelectorAll('[data-nix-ghchecks]').length, bridges: document.querySelectorAll('.nix-ghchecks-bridge').length }));
  return { opened: !!c, stylesBefore: s0, stylesAfterSecondCopy: s1, ...r, panelRequests: hits };
};
