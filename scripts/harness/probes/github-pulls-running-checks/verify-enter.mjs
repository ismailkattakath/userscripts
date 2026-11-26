// Survival of human-speed diagonals from 10% into the title to the card's centre; card-vs-title clearance.
export default async ({ page, h }) => {
  const rows = []; let ok = 0, n = 0;
  for (const idx of [1, 3, 6, 9, 12]) for (const ms of [300, 600]) {
    const a = page.locator('a[data-hovercard-url$="/hovercard"]').nth(idx);
    await a.scrollIntoViewIfNeeded(); const b = await a.boundingBox();
    const px = b.x + b.width * 0.1, py = b.y + b.height / 2;
    let c = null;
    for (let k = 0; k < 4 && !c; k++) { await page.mouse.move(px, 5); await page.waitForTimeout(450); await page.mouse.move(px, py, { steps: 5 }); for (let i = 0; i < 20 && !c; i++) { await page.waitForTimeout(100); c = await h.card(); } }
    if (!c) { rows.push(`#${idx} never`); continue; }
    await page.waitForTimeout(1500); c = await h.card(); if (!c) { rows.push(`#${idx} closed stationary`); continue; }
    const above = c.y < b.y;
    await h.glide(px, py, c.x + c.w / 2, above ? c.y + c.h - 40 : c.y + 40, ms); await page.waitForTimeout(800);
    const alive = !!(await h.card()); n++; if (alive) ok++;
    rows.push(`#${idx} ${ms}ms ${above ? 'above' : 'below'} clearance ${Math.round(above ? b.y - (c.y + c.h) : c.y - (b.y + b.height))}px sec=${c.sec ? 'y' : 'n'} -> ${alive ? 'SURVIVED' : 'closed'}`);
    await page.mouse.move(1390, 20); await page.waitForTimeout(400);
  }
  rows.push(`TOTAL ${ok}/${n}`);
  return rows;
};
