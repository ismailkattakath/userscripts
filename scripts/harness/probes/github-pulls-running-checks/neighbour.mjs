// From 10% into title N, glide up-right onto the title of the row ABOVE and click it. Stock: opens that PR.
export default async ({ page, h }) => {
  const out = [];
  for (const idx of [6, 9]) for (const dx of [40, 90]) {
    await page.goto('https://github.com/NixOS/nixpkgs/pulls', { waitUntil: 'load' });
    const { b, c } = await h.openCard(idx); if (!c) { out.push(`#${idx} never`); continue; }
    await page.waitForTimeout(1500); const cc = await h.card();
    const up = page.locator('a[data-hovercard-url$="/hovercard"]').nth(idx - 1); const ub = await up.boundingBox(); const href = await up.getAttribute('href');
    const sx = b.x + b.width * 0.1, sy = b.y + b.height / 2, tx = Math.min(sx + dx, ub.x + ub.width - 5), ty = ub.y + ub.height / 2;
    const inCardX = cc && tx >= cc.x && tx <= cc.x + cc.w && ty >= cc.y && ty <= cc.y + cc.h;
    await h.glide(sx, sy, tx, ty, 300); await page.waitForTimeout(250);
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.nix-ghchecks-bridge') ? 'BRIDGE' : e.closest('.js-hovercard-content') ? 'card' : e.closest('a[href*="/pull/"]') ? 'title-link' : e.tagName.toLowerCase()) : null; }, [tx, ty]);
    await page.mouse.click(tx, ty); await page.waitForTimeout(2500);
    out.push(`#${idx} -> row above at +${dx}px (under card: ${inCardX}) hit=${hit} url=${new URL(page.url()).pathname} expected=${href.replace('https://github.com', '')}`);
  }
  return out;
};
