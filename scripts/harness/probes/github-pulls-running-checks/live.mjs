import { RUN, QUEUED, OK, FAIL } from './fixtures.mjs';
// Live refresh against a scripted fixture sequence served for every /pull/N/checks request.
const job = (name, id, icon) => `<div class="d-flex checks-list-item"><div class="checks-list-item-name">${name}</div><span class="checks-list-item-icon">${icon}</span><a href="/NixOS/nixpkgs/actions/runs/1/job/${id}">x</a></div>`;
const page_ = (jobs) => JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<details class="checks-list-item"><summary>CI <span>on: pull_request</span></summary>${jobs.join('')}</details>` } } });
const SEQ = [
  { body: page_([job('build', 11, RUN), job('test', 12, QUEUED)]) },
  { body: page_([job('build', 11, RUN), job('test', 12, RUN), job('lint', 13, QUEUED)]) },
  { status: 500 },
  { body: page_([job('build', 11, OK), job('test', 12, FAIL), job('lint', 13, OK)]) },
];
export default async ({ page, h }) => {
  let step = 0, panelHits = 0; const stamps = [];
  await page.route(/\/pull\/\d+\/checks(\?.*)?$/, (route) => {
    const url = route.request().url();
    if (/check_run_id=/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<div class="checks-list-item"></div><relative-time format="elapsed" datetime="${new Date(Date.now() - 95000).toISOString()}"></relative-time>` } } }) });
    panelHits++; stamps.push(Date.now());
    const f = SEQ[Math.min(step++, SEQ.length - 1)];
    return f.status ? route.fulfill({ status: f.status, body: 'boom' }) : route.fulfill({ status: 200, contentType: 'application/json', body: f.body });
  });
  const snap = () => page.evaluate(() => {
    const sec = document.querySelector('[data-nix-ghchecks]'); if (!sec) return null;
    const rows = [...sec.querySelectorAll('.nix-ghchecks-job')];
    const build = rows.find((r) => r.children[1].textContent === 'build');
    if (!window.__build && build) { window.__build = build; window.__spin = build.querySelector('svg.anim-rotate'); }
    return { text: sec.innerText.replace(/\s+/g, ' ').trim(), head: sec.querySelector('.nix-ghchecks-title')?.title || '', sameBuildRow: build ? build === window.__build : null, sameSpinner: build && build.querySelector('svg.anim-rotate') ? build.querySelector('svg.anim-rotate') === window.__spin : null, spinAnim: build?.querySelector('svg.anim-rotate') ? getComputedStyle(build.querySelector('svg.anim-rotate')).animationName : null };
  });
  const { b } = await h.openCard(6);
  const c = await h.card();
  await h.glide(b.x + b.width * 0.1, b.y + b.height / 2, c.x + c.w / 2, c.y < b.y ? c.y + c.h - 30 : c.y + 30, 400); // into the card; stays there
  const log = [];
  const t0 = Date.now();
  for (const at of [1500, 7000, 12000, 22500, 40000]) { await page.waitForTimeout(at - (Date.now() - t0)); log.push(`t+${(at / 1000).toFixed(1)}s hits=${panelHits} ${JSON.stringify(await snap())}`); }
  // settled at the last fixture: no further panel requests while the card stays open
  const settledHits = panelHits; await page.waitForTimeout(12000);
  log.push(`after settle, 12s more open: +${panelHits - settledHits} panel requests (expect 0); card ${(await h.card()) ? 'OPEN' : 'shut'}`);
  log.push('gaps(ms): ' + stamps.slice(1).map((t, i) => t - stamps[i]).join(','));
  return log;
};
