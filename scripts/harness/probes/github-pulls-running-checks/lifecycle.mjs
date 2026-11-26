// Refresh stops on close and pauses while hidden; teardown returns the card to stock outerHTML.
const RUN = '<svg aria-label="In progress" class="position-absolute anim-rotate" width="18" height="18" fill="none" stroke="var(--fgColor-attention)"><circle cx="9" cy="9" r="7"></circle></svg><svg aria-label="This job is in progress" role="img" class="octicon octicon-dot-fill color-fg-attention" width="16" height="16" viewBox="0 0 16 16"><path d="M8 4a4 4 0 1 1 0 8Z"></path></svg>';
const body = JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<details class="checks-list-item"><summary>CI <span>on: push</span></summary><div class="checks-list-item"><div class="checks-list-item-name">build</div><span class="checks-list-item-icon">${RUN}</span><a href="/x/y/actions/runs/1/job/11">x</a></div></details>` } } });
export default async ({ page, h }) => {
  let hits = 0;
  await page.route(/\/pull\/\d+\/checks(\?.*)?$/, (r) => { if (!/check_run_id/.test(r.request().url())) hits++; return r.fulfill({ status: 200, contentType: 'application/json', body }); });
  const out = [];
  // A. close: open, sit in card 6s (one refresh), leave; count requests for 12s
  await h.openCard(6); await page.waitForTimeout(6500);
  const h1 = hits; await page.mouse.move(1390, 20); await page.waitForTimeout(12000);
  out.push(`A close: ${h1} requests while open; +${hits - h1} in 12s after close (expect 0); card ${(await h.card()) ? 'OPEN' : 'shut'}`);
  // B. hidden: open, then fake a hidden tab; pointer stays on title
  await h.openCard(6); await page.waitForTimeout(800);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  const h2 = hits; await page.waitForTimeout(12000);
  const hiddenHits = hits - h2;
  await page.evaluate(() => { delete document.hidden; });
  await page.waitForTimeout(6000);
  out.push(`B hidden 12s: +${hiddenHits} requests (expect 0); visible again 6s: +${hits - h2 - hiddenHits} (expect >=1)`);
  // C. teardown: snapshot the scripted card, tear down, compare with a stock re-render of the same card
  const html = () => page.evaluate(() => [...document.querySelectorAll('.js-hovercard-content')].find((v) => getComputedStyle(v).display !== 'none' && v.querySelector('.Popover-message'))?.outerHTML || null);
  const withSection = await html();
  const styles0 = await page.evaluate(() => document.querySelectorAll('style').length);
  await page.evaluate(() => window.__nixGhChecksTeardown());
  const afterTeardown = await html();
  const styles1 = await page.evaluate(() => document.querySelectorAll('style').length);
  await page.mouse.move(1390, 20); await page.waitForTimeout(700);
  await h.openCard(6); await page.waitForTimeout(1200);
  const stockAgain = await html();
  const norm = (s) => (s || '').replace(/\s(style)="[^"]*"/g, '');
  out.push(`C teardown: section present before=${/data-nix-ghchecks/.test(withSection)}; after teardown outerHTML === fresh stock card (style attr ignored, it holds position): ${norm(afterTeardown) === norm(stockAgain)}; <style> count ${styles0} -> ${styles1}; global gone=${await page.evaluate(() => typeof window.__nixGhChecksTeardown)}`);
  const h3 = hits; await page.waitForTimeout(7000); out.push(`C after teardown 7s: +${hits - h3} requests (expect 0)`);
  return out;
};
