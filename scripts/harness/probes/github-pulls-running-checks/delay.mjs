// GitHub's close delay after the pointer leaves the trigger, and whether a near-instant jump into the card survives.
export default async ({ page, h }) => {
  const rows = [];
  for (const idx of [4, 8]) {
    let { b, c } = await h.openCard(idx); await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__closedAt = 0; const t0 = performance.now(); window.__t0 = t0; const vis = () => [...document.querySelectorAll('.js-hovercard-content')].some((h) => getComputedStyle(h).display !== 'none' && h.querySelector('.Popover-message')); const mo = new MutationObserver(() => { if (!vis()) { window.__closedAt = performance.now() - t0; mo.disconnect(); } }); mo.observe(document.body, { subtree: true, attributes: true, childList: true }); });
    await page.mouse.move(40, b.y + b.height / 2); // off to the blank left gutter
    await page.waitForTimeout(1500);
    rows.push(`#${idx} leave->close ${Math.round(await page.evaluate(() => window.__closedAt))}ms`);
    ({ b, c } = await h.openCard(idx)); await page.waitForTimeout(1200); c = await h.card();
    await page.mouse.move(c.x + c.w / 2, c.y + 40); // one jump into the card
    await page.waitForTimeout(1500);
    rows.push(`#${idx} jump-in -> ${(await h.card()) ? 'SURVIVED' : 'closed'}`);
  }
  return rows;
};
