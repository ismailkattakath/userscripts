#!/usr/bin/env bash
# Every probe for github-pulls-running-checks, in sequence, condensed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
run() { echo "=== ${VH:+VH=$VH }$*"; "$HERE/run.sh" "$@" 2>&1 | grep -v 'warning: Git tree' | grep -v -E '^\s*[][{}],?$' | cut -c1-200; }
run verify-enter both
run clicks script
run neighbour both
run live script
run lifecycle script
run reinject script
run icon-geom script
run edge script
VH=520 run verify-enter script
echo "windowed Chrome for Testing processes: $(ps -axo command | grep 'Google Chrome for Testing --' | grep -v grep | grep -vc -- --headless)"
