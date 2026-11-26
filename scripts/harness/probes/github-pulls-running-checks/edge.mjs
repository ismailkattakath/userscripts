// Edge cases on fixtures: start-time 404s (request cap), duplicate job names, and a title node replaced while its card is open.
const RUN = '<svg aria-label="In progress" class="position-absolute anim-rotate" width="18" height="18"></svg><svg aria-label="This job is in progress" role="img" class="octicon octicon-dot-fill color-fg-attention" width="16" height="16"></svg>';
const j = (name, id) => `<div class="checks-list-item"><div class="checks-list-item-name">${name}</div><span class="checks-list-item-icon">${RUN}</span><a href="/x/y/actions/runs/1/job/${id}">x</a></div>`;
const body = JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<details class="checks-list-item"><summary>CI <span>on: push</span></summary>${j('build (x)', 21)}${j('build (x)', 22)}${j('lint', 23)}</details>` } } });
export default async ({ page, h }) => {
  let panel = 0, starts = 0;
  await page.route(/\/pull\/\d+\/checks(\?.*)?$/, (r) => { if (/check_run_id/.test(r.request().url())) { starts++; return r.fulfill({ status: 404, body: 'nope' }); } panel++; return r.fulfill({ status: 200, contentType: 'application/json', body }); });
  const { b } = await h.openCard(6); await page.waitForTimeout(800);
  const cc = await h.card();
  await h.glide(b.x + b.width * 0.1, b.y + b.height / 2, cc.x + cc.w / 2, cc.y < b.y ? cc.y + cc.h - 30 : cc.y + 30, 400);
  await page.waitForTimeout(21000); // ~4 refreshes
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-nix-ghchecks] .nix-ghchecks-job')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  const out = [`404 starts: panel refreshes=${panel}, start lookups=${starts} (3 jobs x ${2} tries max = 6)`, `rows: ${JSON.stringify(rows)} (expect 3 incl. both "build (x)")`];
  // detached trigger: move back onto the title, replace the title node, then read geometry
  await h.glide(cc.x + cc.w / 2, cc.y < b.y ? cc.y + cc.h - 30 : cc.y + 30, b.x + b.width * 0.1, b.y + b.height / 2, 200); await page.waitForTimeout(300);
  const before = await h.card();
  await page.evaluate((i) => { const a = document.querySelectorAll('a[data-hovercard-url$="/hovercard"]')[i]; a.replaceWith(a.cloneNode(true)); }, 6);
  await page.waitForTimeout(800);
  const after = await h.card();
  const bridge = await page.evaluate(() => document.querySelector('.nix-ghchecks-bridge')?.getAttribute('style') || null);
  out.push(`detached title: card y ${before ? Math.round(before.y) : '-'} -> ${after ? Math.round(after.y) : 'closed'}; bridge style ${bridge ? bridge.slice(0, 60) : null}`);
  return out;
};
