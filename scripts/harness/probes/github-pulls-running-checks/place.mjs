// What decides the card's x and side? Hover each title at two different x points, record title rect + card rect.
export default async ({ page, h }) => {
  const rows = [];
  for (const idx of [0, 1, 6, 12]) for (const fx of [0.1, 0.8]) {
    const a = page.locator('a[data-hovercard-url$="/hovercard"]').nth(idx);
    await a.scrollIntoViewIfNeeded(); const b = await a.boundingBox();
    const px = b.x + b.width * fx, py = b.y + b.height / 2;
    let c = null;
    for (let k = 0; k < 4 && !c; k++) { await page.mouse.move(px, 890); await page.waitForTimeout(500); await page.mouse.move(px, py, { steps: 5 }); for (let i = 0; i < 20 && !c; i++) { await page.waitForTimeout(100); c = await h.card(); } }
    if (!c) { rows.push(`#${idx} never`); continue; }
    rows.push(`#${idx} fx${fx} title x${Math.round(b.x)}-${Math.round(b.x + b.width)} (mid ${Math.round(b.x + b.width / 2)}) y${Math.round(b.y)} | ptr ${Math.round(px)} | card x${Math.round(c.x)} y${Math.round(c.y)}-${Math.round(c.y + c.h)} ${c.y > b.y ? 'BELOW' : 'above'} | left+24=${Math.round(c.x + 24)}`);
    await page.mouse.move(1390, 890); await page.waitForTimeout(400);
  }
  return rows;
};
