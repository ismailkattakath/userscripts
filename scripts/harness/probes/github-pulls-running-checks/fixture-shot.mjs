// Visual: a failure-heavy card from a fixture (GitHub's own captured icon markup).
import { RUN, QUEUED, OK, FAIL } from './fixtures.mjs';
const job = (name, id, icon) => `<div class="checks-list-item"><div class="checks-list-item-name">${name}</div><span class="checks-list-item-icon">${icon}</span><a href="/x/y/actions/runs/1/job/${id}">x</a></div>`;
const grp = (name, trig, jobs) => `<details class="checks-list-item"><summary>${name} <span>on: ${trig}</span></summary>${jobs.join('')}</details>`;
const body = JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value:
  grp('CI — Lint, Type Check & Test', 'push', [job('Unit Tests (pytest)', 1, FAIL), job('Type Check (mypy)', 2, FAIL), job('Lint & Format (ruff)', 3, OK), job('Integration (postgres)', 4, RUN)]) +
  grp('CI — Lint, Type Check & Test', 'pull_request', [job('Unit Tests (pytest)', 5, FAIL), job('Build image', 6, QUEUED)]) +
  grp('Release train', 'pull_request', [job('Verify tree was tested', 7, FAIL), job('Manual approval (production gate)', 8, RUN)]) } } });
export default async ({ page, h, shots }) => {
  await page.route(/\/pull\/\d+\/checks(\?.*)?$/, (r) => /check_run_id/.test(r.request().url())
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<relative-time format="elapsed" datetime="${new Date(Date.now() - 754000).toISOString()}"></relative-time>` } } }) })
    : r.fulfill({ status: 200, contentType: 'application/json', body }));
  const { b } = await h.openCard(Number(process.env.IDX || 6)); await page.waitForTimeout(3000);
  const c = await h.card();
  await page.screenshot({ path: `${shots}/fixture-${process.env.SCHEME || 'dark'}-vh${process.env.VH || 900}.png`, clip: { x: Math.max(0, c.x - 150), y: Math.max(0, Math.min(c.y, b.y) - 10), width: c.w + 170, height: Math.max(c.y + c.h, b.y + b.height) - Math.max(0, Math.min(c.y, b.y) - 10) + 12 } });
  return { flipped: c.y > b.y, cardY: Math.round(c.y), titleY: Math.round(b.y) };
};
