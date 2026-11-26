// Is GitHub's spinner ring centred on its dot in our row, and does it spin?
const RUN = '<svg width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--fgColor-attention)" class="position-absolute js-check-step-icon-animation anim-rotate" aria-label="In progress"><g fill="none" fillrule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle opacity=".5" cx="8" cy="8" r="7"></circle><path d=" M 15 8 A 7 7 0 0 1 8 15"></path></g></g></svg><svg aria-label="This job is in progress" role="img" data-component="Octicon" height="16" viewBox="0 0 16 16" version="1.1" width="16" class="octicon octicon-dot-fill color-fg-attention"><path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"></path></svg>';
const body = JSON.stringify({ payload: { 'pullRequestsChecksRoute.Main': { value: `<details class="checks-list-item"><summary>CI <span>on: push</span></summary><div class="checks-list-item"><div class="checks-list-item-name">build</div><span class="checks-list-item-icon"><div class="d-flex flex-items-center flex-justify-center">${RUN}</div></span><a href="/x/y/actions/runs/1/job/11">x</a></div></details>` } } });
export default async ({ page, h }) => {
  await page.route(/\/pull\/\d+\/checks(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body }));
  for (const idx of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const { c } = await h.openCard(idx); if (!c) continue; await page.waitForTimeout(3000);
    const g = await page.evaluate(() => { const cell = document.querySelector('[data-nix-ghchecks] .nix-ghchecks-running .nix-ghchecks-icon'); if (!cell) return null; const [ring, dot] = cell.querySelectorAll('svg'); const a = ring.getBoundingClientRect(), b = dot.getBoundingClientRect(); return { ringCentre: [a.x + a.width / 2, a.y + a.height / 2], dotCentre: [b.x + b.width / 2, b.y + b.height / 2], anim: getComputedStyle(ring).animationName, state: getComputedStyle(ring).animationPlayState, ringClass: ring.getAttribute('class'), dotLabel: dot.getAttribute('aria-label'), ringHidden: ring.getAttribute('aria-hidden'), ringLabel: ring.getAttribute('aria-label'), rowName: cell.closest('.nix-ghchecks-job').innerText }; });
    if (g) return g;
    await page.mouse.move(1390, 20); await page.waitForTimeout(300);
  }
  return 'no running job on this page right now';
};
