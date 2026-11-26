// Primary actions under real (trusted) mouse clicks: the title still opens the PR; a link inside our section navigates.
export default async ({ page, h }) => {
  const out = [];
  const back = async () => { await page.goBack({ waitUntil: 'load' }); await page.waitForSelector('a[data-hovercard-url$="/hovercard"]'); };
  // 1. hover then click the title at 10% (where the bridge's base sits nearest)
  { const { b } = await h.openCard(6); await page.waitForTimeout(1500);
    const href = await page.locator('a[data-hovercard-url$="/hovercard"]').nth(6).getAttribute('href');
    await page.mouse.click(b.x + b.width * 0.1, b.y + b.height / 2); await page.waitForURL(/\/pull\/\d+/, { timeout: 8000 }).catch(() => {});
    out.push(`title click -> ${new URL(page.url()).pathname} (expected ${href.replace(/^https:\/\/github.com/, '')})`); await back(); }
  // 2. move into the card, click the section's summary link
  { const { b } = await h.openCard(6); await page.waitForTimeout(2500);
    const link = await page.evaluate(() => { const a = document.querySelector('[data-nix-ghchecks] .nix-ghchecks-title a'); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: a.getAttribute('href'), text: a.textContent }; });
    if (!link) out.push('no summary link'); else {
      await h.glide(b.x + b.width * 0.1, b.y + b.height / 2, link.x, link.y, 400); await page.waitForTimeout(300);
      await page.mouse.click(link.x, link.y); await page.waitForURL(/\/checks/, { timeout: 8000 }).catch(() => {});
      out.push(`summary link "${link.text}" click -> ${new URL(page.url()).pathname} (expected ${link.href})`); await back(); } }
  // 3. a job row link, when the card has one
  { let found = null;
    for (const idx of [0, 1, 2, 3, 4, 5, 7, 8]) { const { b } = await h.openCard(idx); await page.waitForTimeout(2500);
      const link = await page.evaluate(() => { const a = document.querySelector('[data-nix-ghchecks] a.nix-ghchecks-name'); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.x + Math.min(30, r.width / 2), y: r.y + r.height / 2, href: a.getAttribute('href') }; });
      if (link) { found = { b, link }; break; } await page.mouse.move(1390, 20); await page.waitForTimeout(300); }
    if (!found) out.push('no job row on these PRs'); else {
      await h.glide(found.b.x + found.b.width * 0.1, found.b.y + found.b.height / 2, found.link.x, found.link.y, 450); await page.waitForTimeout(300);
      await page.mouse.click(found.link.x, found.link.y); await page.waitForURL(/\/actions\/runs|\/checks|\/job\//, { timeout: 8000 }).catch(() => {});
      out.push(`job link click -> ${new URL(page.url()).pathname} (expected ${found.link.href.split('?')[0]})`); } }
  return out;
};
