#!/usr/bin/env bash
# Headless userscript harness. Usage (from anywhere in the repo):
#   nix run .#harness -- <probe> [stock|script|both] [url]
#   <probe> is a path, or a name under scripts/harness/probes/<script>/ (".mjs" optional)
# Env: USERSCRIPT (default github-pulls-running-checks.user.js), VH (viewport height),
#      SCHEME (dark|light). Playwright and the Chrome for Testing build it expects both
#      come from this repo's pinned nixpkgs, resolved on first use (not in CI's closure).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
SCRIPT="${USERSCRIPT:-github-pulls-running-checks.user.js}"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/userscripts-harness"
mkdir -p "$STATE/shots"
probe="${1:?usage: run.sh <probe> [stock|script|both] [url]}"; shift
if [[ ! -f "$probe" ]]; then probe="$HERE/probes/${SCRIPT%.user.js}/${probe%.mjs}.mjs"; fi
read -r PW BR < <(nix build --no-link --print-out-paths --inputs-from "$REPO" nixpkgs#playwright-test nixpkgs#playwright-driver.browsers | paste -sd' ' -)
# GM_addStyle shim: like Violentmonkey's, it queues until there is a root to append to,
# because addInitScript runs before <html> exists.
{
  cat <<'SHIM'
window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; const put = () => { const r = document.head || document.documentElement; if (r) { r.appendChild(s); return true; } return false; }; if (!put()) { const mo = new MutationObserver(() => { if (put()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); } return s; };
SHIM
  cat "$REPO/$SCRIPT"
} > "$STATE/inject.js"
node --check "$STATE/inject.js"
NODE_PATH="$PW/lib/node_modules" PLAYWRIGHT_BROWSERS_PATH="$BR" HARNESS_STATE="$STATE" \
  exec node "$HERE/runner.mjs" "$probe" "$@"
