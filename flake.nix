# Development, gate and release toolkit for this repository.
#
#   nix develop              → shell with node, the pinned ESLint stack, gh, jq, shellcheck
#   nix develop .#verify     → the above plus page-lab's live-page runners and a browser launcher
#   nix flake check          → every gate CI enforces, run hermetically
#   nix run .#toolkit        → list every command
#
# WHY A FLAKE AT ALL, in a repository whose whole point is that there is no build.
# Nothing here compiles a userscript and nothing ever will — a manager copies the
# .user.js into extension storage verbatim, and a build step would change what a
# reviewer reads relative to what a user executes. What this flake pins is the
# MAINTENANCE side: the linters that decide whether a script is publishable, the
# Node that runs them, and the live-page runners the doctrine says to measure with.
# Three things were demonstrably drifting before it existed:
#
#   1. `npm ci` resolved ESLint from the registry at whatever moment CI ran, while
#      the local shell had no `eslint` on PATH at all (measured 2026-09-28:
#      `command -v eslint` found nothing). The documented gate `npm run lint`
#      could not be run locally without a network install.
#   2. CI pinned `node-version: 20`. Node 20 reached end of life on 2026-04-30 and
#      is REMOVED from nixpkgs — evaluating `nodejs_20` now throws. The gate was
#      running on an unsupported runtime. This flake pins Node 22 (Active LTS),
#      which also satisfies eslint 10.10's own `^20.19 || ^22.13 || >=24`.
#   3. Both CLAUDE.md files resolve page-lab with
#      `ls -d ~/.claude/plugins/cache/*/page-lab/*/scripts | sort -V | tail -1`.
#      The cache directories are git SHAs, not versions, so `sort -V` orders them
#      alphabetically. Measured 2026-09-28: it selects `ef4781431d8c` (installed
#      Sep 24 02:01) while the ACTIVE install recorded in installed_plugins.json is
#      `bd750eaa7f39` (Sep 24 17:34). Every agent following that line measured the
#      live page with a stale toolchain. Here page-lab is a pinned flake input, so
#      the version is written in flake.lock and bumped on purpose.
#
# WHY ESLINT COMES FROM package-lock.json AND NOT FROM nixpkgs.
# eslint.config.mjs imports `eslint-plugin-userscripts`, which validates the
# metadata block itself. That plugin is not packaged in nixpkgs, so `pkgs.eslint`
# alone cannot run this repository's config — it would fail at the import. The
# lockfile is therefore the source of truth and `importNpmLock` turns it into a
# derivation: same 80 packages, same integrity hashes, no network at build time,
# no `npm ci` step. The lockfile stays the thing dependabot bumps.
#
# WHAT THIS FLAKE DELIBERATELY DOES NOT DO.
# It does not vendor, concatenate, transpile or minify a userscript, and it must
# not start. `packages` here are OPERATIONS (lint, bump, preflight), never build
# artefacts. If a future change adds a derivation that emits a .user.js, the
# repository has silently acquired a build step — stop and open an issue first,
# for the same reason .gitignore refuses a `dist/` entry.
{
  description = "Userscripts — pinned dev shell, publish gates and release toolkit";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    # The page-lab plugin's scripts directory: selector-verify, the acceptance
    # runner, page-route and the CDP client the doctrine points at. Pinned as a
    # SOURCE input (flake = false) rather than globbed out of the Claude plugin
    # cache — see reason 3 in the header. `nix flake update page-lab` is the bump.
    page-lab = {
      url = "github:kattakath/skills";
      flake = false;
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      page-lab,
    }:
    let
      inherit (nixpkgs) lib;

      # `x86_64-darwin` is DELIBERATELY ABSENT. nixpkgs-unstable THROWS on that platform
      # since the 26.11 cycle, and because `forAll` is a genAttrs fold the throw happens on
      # EVALUATION — so listing it took down the WHOLE flake, not one platform, and
      # `--no-build` did not avoid it. Measured 2026-10-02. Upstream directs x86_64 Macs to
      # the `nixpkgs-26.05-darwin` branch instead:
      #   https://nixos.org/manual/nixpkgs/unstable/release-notes#x86_64-darwin-26.11
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAll = f: lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});

      owner = "ismailkattakath";
      repo = "userscripts";
      homepage = "https://github.com/${owner}/${repo}";

      # Every @version that must never be reused, because a build carrying it was
      # pushed into a Violentmonkey database somewhere. Violentmonkey NEVER
      # downgrades: re-using one of these numbers produces a silent no-op install —
      # right code, wrong browser, nothing says so. CLAUDE.md states the list in
      # prose; `nix run .#bump` refuses it mechanically.
      burnedVersions = {
        "google-photos-icon-nav" = [
          "2.3.2" # stranded in Violentmonkey by a test build (see 15e9ec6)
          "3.0.0" # installed during the v4 session; the build with a dead search
        ];
      };
      burnedTsv = lib.concatStringsSep "\n" (
        lib.concatLists (
          lib.mapAttrsToList (script: vers: map (v: "${script}\t${v}") vers) burnedVersions
        )
      );

      # Source for the hermetic checks. `lib.cleanSourceWith` rather than a fileset
      # union because node_modules/ genuinely exists in a working checkout (npm put
      # it there) and copying it would make the check both enormous and dependent
      # on whatever npm last resolved — the exact non-determinism this flake exists
      # to remove.
      cleanSrc = lib.cleanSourceWith {
        name = "userscripts-source";
        src = ./.;
        filter =
          path: _type:
          let
            base = baseNameOf (toString path);
          in
          !(builtins.elem base [
            "node_modules"
            ".git"
            ".direnv"
            ".nix-stack"
            ".eslintcache"
            ".DS_Store"
            "result"
          ]);
      };

      # Only the two files npm actually reads, so a userscript edit does not
      # invalidate the node_modules derivation and re-fetch 80 tarballs.
      npmRoot = lib.cleanSourceWith {
        name = "userscripts-npm-root";
        src = ./.;
        filter =
          path: _type:
          let
            base = baseNameOf (toString path);
          in
          builtins.elem base [
            "package.json"
            "package-lock.json"
          ];
      };
    in
    {
      formatter = forAll (_: pkgs: pkgs.nixfmt);

      packages = forAll (
        system: pkgs:
        let
          # Node 22, not 20: see reason 2 in the header. Not 24 either — 22 is the
          # conservative Active LTS and the repository's package.json says >=20.
          nodejs = pkgs.nodejs_22;

          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit nodejs;
            npmRoot = npmRoot;
          };

          burnedFile = pkgs.writeText "burned-versions.tsv" burnedTsv;
          pageLabScripts = "${page-lab}/plugins/page-lab/scripts";

          # Shared by every command. `export`, not plain assignment: each command
          # uses only part of this, and shellcheck flags an unexported unused name.
          #
          # The node_modules link is the one piece of state a command writes into
          # the working tree. ESM `import` does not honour NODE_PATH, so ESLint's
          # flat config — which does `import userscripts from
          # 'eslint-plugin-userscripts'` — can only resolve the plugin through a
          # real node_modules NEXT TO eslint.config.mjs. Linking the pinned store
          # path there is what makes `nix run .#lint` equal to the CI gate without
          # an `npm ci`. It never clobbers a real directory; sync-deps does that,
          # and only when asked.
          prelude = ''
            export PRJ="''${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
            export NODE_MODULES="${nodeModules}/node_modules"

            _link_node_modules() {
              local target="$PRJ/node_modules"
              if [ -L "$target" ]; then
                [ "$(readlink "$target")" = "$NODE_MODULES" ] || ln -sfn "$NODE_MODULES" "$target"
              elif [ -e "$target" ]; then
                echo "note: $target is a real directory (npm install). Using it as-is." >&2
                echo "      'nix run .#sync-deps' replaces it with the flake-pinned tree." >&2
              else
                ln -sfn "$NODE_MODULES" "$target"
              fi
            }

            # Every .user.js at the repository root, sorted, NUL-safe. One
            # definition so a command can never disagree with the gate about what
            # the set of scripts is.
            _scripts() { find "$PRJ" -maxdepth 1 -name '*.user.js' -print0 | sort -z; }

            _version_of() {
              sed -n 's|^// @version[[:space:]]*\([^[:space:]]*\).*|\1|p' "$1" | head -1
            }

            # Resolve "civitai-declutter", "civitai-declutter.user.js" or a path to
            # the file, so no command cares which spelling the operator typed.
            _resolve_script() {
              local n="$1"
              case "$n" in
                */*) [ -f "$n" ] && { printf '%s\n' "$n"; return 0; } ;;
              esac
              [ -f "$PRJ/$n" ] && { printf '%s\n' "$PRJ/$n"; return 0; }
              [ -f "$PRJ/$n.user.js" ] && { printf '%s\n' "$PRJ/$n.user.js"; return 0; }
              echo "no such script: $n" >&2
              return 1
            }
          '';

          mk =
            {
              name,
              deps ? [ ],
              text,
            }:
            pkgs.writeShellApplication {
              inherit name;
              runtimeInputs = [ pkgs.coreutils ] ++ deps;
              text = prelude + text;
            };
        in
        rec {
          # ── The two gates, exactly as CI runs them ──────────────────────────────

          lint = mk {
            name = "lint";
            deps = [ nodejs ];
            text = ''
              cd "$PRJ"
              _link_node_modules
              exec "$NODE_MODULES/.bin/eslint" "''${@:-.}"
            '';
          };

          lint-fix = mk {
            name = "lint-fix";
            deps = [ nodejs ];
            text = ''
              # The metadata block has an ENFORCED alignment
              # (userscripts/align-attributes) and an enforced blank line before the
              # code (userscripts/metadata-spacing). Both auto-fix, so hand-aligning
              # a header is wasted effort and arguing about it in review is worse.
              cd "$PRJ"
              _link_node_modules
              exec "$NODE_MODULES/.bin/eslint" --fix "''${@:-.}"
            '';
          };

          meta = mk {
            name = "meta";
            deps = [ nodejs ];
            text = ''
              cd "$PRJ"
              exec node scripts/meta-lint.mjs "$@"
            '';
          };

          parse = mk {
            name = "parse";
            deps = [ nodejs ];
            text = ''
              # Independent of ESLint on purpose: a userscript is copied verbatim
              # into the browser, so a syntax error is a script that silently never
              # runs, and ESLint could in principle be misconfigured into skipping a
              # file. `node --check` cannot be.
              cd "$PRJ"
              n=0
              while IFS= read -r -d "" f; do
                echo "parsing $(basename "$f")"
                node --check "$f"
                n=$((n + 1))
              done < <(_scripts)
              [ "$n" -gt 0 ] || { echo "no .user.js files found — the checkout is wrong" >&2; exit 1; }
              echo "parse passed — $n file(s)"
            '';
          };

          versions = mk {
            name = "versions";
            deps = [
              nodejs
              pkgs.git
            ];
            text = ''
              # @version monotonicity against a ref. Needs git history, so it is an
              # app and a CI step rather than a sandboxed check — a Nix build has no
              # .git to diff against.
              cd "$PRJ"
              exec node scripts/meta-lint.mjs --versions-against "''${1:-origin/main}"
            '';
          };

          gates = mk {
            name = "gates";
            deps = [ nodejs ];
            text = ''
              # Everything the branch ruleset requires, in the order that fails
              # cheapest first. The ruleset's two contexts are "eslint + meta" and
              # "node --check"; this is their local equivalent.
              echo "── eslint"; ${lint}/bin/lint
              echo "── meta";   ${meta}/bin/meta
              echo "── parse";  ${parse}/bin/parse
              echo "all gates passed"
            '';
          };

          # ── Release operations ──────────────────────────────────────────────────

          bump = mk {
            name = "bump";
            deps = [
              nodejs
              pkgs.gnused
            ];
            text = ''
              # usage: bump <script> <major|minor|patch|X.Y.Z>
              #
              # A same-version re-install is a SILENT no-op and Violentmonkey never
              # downgrades, so the version bump is the only signal that a change
              # reached the browser. This refuses any number recorded as burned.
              [ $# -ge 1 ] || { echo "usage: bump <script> [major|minor|patch|X.Y.Z]" >&2; exit 1; }
              file=$(_resolve_script "$1")
              name=$(basename "$file" .user.js)
              level="''${2:-patch}"

              cur=$(_version_of "$file")
              [ -n "$cur" ] || { echo "$name: no @version in the metadata block" >&2; exit 1; }

              case "$level" in
                major|minor|patch)
                  IFS=. read -r a b c _ <<< "$cur.0.0"
                  case "$level" in
                    major) next="$((a + 1)).0.0" ;;
                    minor) next="$a.$((b + 1)).0" ;;
                    patch) next="$a.$b.$((c + 1))" ;;
                  esac
                  ;;
                *)
                  printf '%s' "$level" | grep -qE '^[0-9]+(\.[0-9]+)*$' \
                    || { echo "'$level' is not dotted-numeric and not major/minor/patch" >&2; exit 1; }
                  next="$level"
                  ;;
              esac

              while IFS=$'\t' read -r bscript bver; do
                [ -n "$bscript" ] || continue
                if [ "$bscript" = "$name" ] && [ "$bver" = "$next" ]; then
                  echo "REFUSING $name $next — that version is BURNED." >&2
                  echo "A build carrying it reached a Violentmonkey database, which never" >&2
                  echo "downgrades, so installing it again is a silent no-op. Jump past it." >&2
                  exit 1
                fi
              done < ${burnedFile}

              tmp=$(mktemp)
              sed "s|^\(// @version[[:space:]]*\)$cur\([[:space:]]*\)$|\1$next\2|" "$file" > "$tmp"
              _version_of "$tmp" | grep -qx "$next" \
                || { rm -f "$tmp"; echo "rewrite did not take — is the @version line unusual?" >&2; exit 1; }
              cat "$tmp" > "$file"
              rm -f "$tmp"
              echo "$name: $cur → $next"
              echo "next: record it under '## $name' in CHANGELOG.md, then 'nix run .#preflight'"
            '';
          };

          listing = mk {
            name = "listing";
            text = ''
              # Greasy Fork requires a script to be properly described, and the
              # listing body is pasted into a form by hand — so it lives in git and
              # is reviewed like code. With no argument this asserts the pairing;
              # with one it prints the body ready to paste.
              cd "$PRJ"
              if [ $# -ge 1 ]; then
                file=$(_resolve_script "$1")
                name=$(basename "$file" .user.js)
                [ -f "listings/$name.md" ] || { echo "listings/$name.md does not exist" >&2; exit 1; }
                exec cat "listings/$name.md"
              fi
              rc=0
              while IFS= read -r -d "" f; do
                name=$(basename "$f" .user.js)
                if [ -f "listings/$name.md" ]; then
                  printf '  ok   %s\n' "$name"
                else
                  printf '  MISSING listings/%s.md\n' "$name" >&2
                  rc=1
                fi
              done < <(_scripts)
              [ "$rc" = 0 ] || { echo "every script needs a listing body" >&2; exit 1; }
              echo "every script has a listing"
            '';
          };

          preflight = mk {
            name = "preflight";
            deps = [
              nodejs
              pkgs.git
            ];
            text = ''
              # The whole ship checklist, so "is this ready to push?" is a command
              # rather than a memory exercise. Ship flow for this repository is:
              # commit on a branch, push, and the ismailkattakath-ci app opens and
              # merges the pull request. So being ON main is itself a finding.
              cd "$PRJ"
              base="''${1:-origin/main}"
              rc=0
              note() { printf '  %-4s %s\n' "$1" "$2"; [ "$1" = "FAIL" ] && rc=1; return 0; }

              branch=$(git rev-parse --abbrev-ref HEAD)
              if [ "$branch" = "main" ]; then
                note WARN "on main — the ship flow is: branch, push, the CI app opens the PR"
              else
                note ok "on branch $branch"
              fi

              if [ -n "$(git status --porcelain)" ]; then
                note WARN "working tree is dirty — commit before pushing"
              else
                note ok "working tree clean"
              fi

              echo "── gates"
              ${gates}/bin/gates || rc=1

              echo "── listings"
              ${listing}/bin/listing || rc=1

              echo "── versions vs $base"
              if git rev-parse --verify --quiet "$base" >/dev/null; then
                node scripts/meta-lint.mjs --versions-against "$base" || rc=1
                while IFS= read -r changed; do
                  [ -n "$changed" ] || continue
                  [ -f "$changed" ] || continue
                  name=$(basename "$changed" .user.js)
                  v=$(_version_of "$changed")
                  if grep -q "\[$v\]" CHANGELOG.md; then
                    note ok "CHANGELOG.md records $name $v"
                  else
                    note FAIL "CHANGELOG.md has no [$v] entry for $name"
                  fi
                done < <(git diff --name-only "$base...HEAD" -- '*.user.js')
              else
                note WARN "$base is not fetched — skipping version and changelog checks"
              fi

              echo
              [ "$rc" = 0 ] || { echo "preflight FAILED" >&2; exit 1; }
              echo "preflight passed — push the branch; the CI app opens and merges the PR"
            '';
          };

          new-script = mk {
            name = "new-script";
            deps = [ nodejs ];
            text = ''
              # Scaffolds a metadata block that already passes both gates, so the
              # first lint run is about the code rather than about eight missing
              # keys. It does NOT guess a selector: measure the live page first.
              [ $# -ge 1 ] || { echo "usage: new-script <name> [match-url]" >&2; exit 1; }
              name="''${1%.user.js}"
              match="''${2:-https://example.com/*}"
              file="$PRJ/$name.user.js"
              [ -e "$file" ] && { echo "$file already exists" >&2; exit 1; }

              cat > "$file" <<EOF
              // ==UserScript==
              // @name         $name
              // @namespace    kattakath.com
              // @version      1.0.0
              // @description  TODO — what it does, what it deliberately does not do.
              // @author       Ismail Kattakath
              // @license      MIT
              // @homepageURL  ${homepage}
              // @supportURL   ${homepage}/issues
              // @match        $match
              // @run-at       document-start
              // @grant        none
              // @noframes
              // ==/UserScript==

              (() => {
                'use strict';
                // Teardown contract: register a global and call any previous one at
                // entry. Never early-return on an "already init" flag — that makes a
                // re-run a silent no-op, and re-injection is the two-copy livelock test.
                window.__nix${"$"}{name}Teardown?.();
              })();
              EOF
              sed -i.bak 's|^              ||' "$file" && rm -f "$file.bak"

              mkdir -p "$PRJ/listings"
              cat > "$PRJ/listings/$name.md" <<EOF
              # $name

              TODO — what it does, what it deliberately does **not** do, how it differs
              from what is already on the shelf, and its known limits.
              EOF
              sed -i.bak 's|^              ||' "$PRJ/listings/$name.md" && rm -f "$PRJ/listings/$name.md.bak"

              echo "created $name.user.js and listings/$name.md"
              echo "next: add a row to README.md, measure the live page, then 'nix run .#gates'"
            '';
          };

          sync-deps = mk {
            name = "sync-deps";
            text = ''
              # Replaces a real node_modules/ (whatever npm last resolved) with the
              # tree this flake pins from package-lock.json. Destructive by request
              # only — the other commands never do this on their own.
              target="$PRJ/node_modules"
              [ -e "$target" ] && [ ! -L "$target" ] && rm -rf "$target"
              ln -sfn "$NODE_MODULES" "$target"
              echo "node_modules → $NODE_MODULES"
            '';
          };

          # ── Live-page verification ──────────────────────────────────────────────

          pagelab = mk {
            name = "pagelab";
            deps = [
              nodejs
              pkgs.curl
              pkgs.jq
            ];
            text = ''
              # Runs a page-lab script from the PINNED input. With no argument it
              # lists what is available. This replaces the plugin-cache glob in
              # CLAUDE.md, which selects a stale revision — see the header.
              dir=${pageLabScripts}
              if [ $# -eq 0 ]; then
                echo "page-lab scripts (pinned: ${page-lab.shortRev or page-lab.rev or "dirty"})"
                ls "$dir" | sed 's|^|  |'
                echo
                echo "usage: pagelab <script> [args...]   e.g. pagelab page-route.sh"
                exit 0
              fi
              s="$1"; shift
              [ -e "$dir/$s" ] || { echo "no such page-lab script: $s" >&2; exit 1; }
              case "$s" in
                *.sh)  exec bash "$dir/$s" "$@" ;;
                *.mjs) exec node "$dir/$s" "$@" ;;
                *)     exec "$dir/$s" "$@" ;;
              esac
            '';
          };

          browser = mk {
            name = "browser";
            deps = [ pkgs.curl ];
            text = ''
              # A throwaway Chromium for live-page measurement, OFF-SCREEN rather
              # than headless. Headless introduces a second variable — codec and
              # media differences, and headless fingerprinting on bot-gated sites —
              # at exactly the moment the goal is a clean signal. Off-screen gets the
              # same practical result (no visible window, no focus stealing) with
              # full headed fidelity. Do not "simplify" this to --headless.
              port="''${1:-9222}"
              profile="''${CHROME_PROFILE_DIR:-''${TMPDIR:-/tmp}/userscripts-chromium-$port}"
              mkdir -p "$profile"

              bin=""
              for candidate in \
                "/Applications/Chromium.app/Contents/MacOS/Chromium" \
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
                "$(command -v chromium || true)" \
                "$(command -v google-chrome || true)"; do
                [ -n "$candidate" ] && [ -x "$candidate" ] && { bin="$candidate"; break; }
              done
              [ -n "$bin" ] || { echo "no Chromium or Chrome found" >&2; exit 1; }

              if curl -sf "http://localhost:$port/json/version" >/dev/null 2>&1; then
                echo "a DevTools endpoint is already up on :$port — reusing it"
                exit 0
              fi

              "$bin" \
                --remote-debugging-port="$port" \
                --user-data-dir="$profile" \
                --no-first-run --no-default-browser-check \
                --no-usage-statistics \
                --window-position=-3000,-3000 \
                --window-size=1512,900 \
                about:blank &
              echo "chromium on :$port, profile $profile (off-screen, headed)"
              echo "targets: curl -s localhost:$port/json/list | jq -r '.[] | \"\\(.id) \\(.url)\"'"
            '';
          };

          verify = mk {
            name = "verify";
            deps = [
              nodejs
              pkgs.curl
            ];
            text = ''
              # Runs a script's acceptance spec through page-lab's runner. The spec
              # beside the script is DATA; page-lab owns the runner, which is what
              # keeps "no test runner in this repository" true.
              #
              # Geometry proves a control is PRESENT, never that it WORKS: v3.0.0 of
              # google-photos-icon-nav passed every geometry and hit-test check and
              # shipped with search completely dead. The spec must exercise the
              # host's primary actions under trusted events.
              [ $# -ge 1 ] || {
                echo "usage: verify <script> [--repeat N]" >&2
                echo "specs available:" >&2
                ls "$PRJ"/*.acceptance.mjs 2>/dev/null | sed 's|.*/|  |' >&2 || echo "  (none)" >&2
                exit 1
              }
              name="''${1%.user.js}"; name="''${name%.acceptance.mjs}"; shift
              spec="$PRJ/$name.acceptance.mjs"
              [ -f "$spec" ] || { echo "no acceptance spec: $spec" >&2; exit 1; }
              curl -sf http://localhost:9222/json/version >/dev/null 2>&1 \
                || { echo "no DevTools endpoint on :9222 — run 'nix run .#browser' first" >&2; exit 1; }
              cd "$PRJ"
              exec node ${pageLabScripts}/userscript-acceptance.mjs "''${@:---repeat}" "''${2:-3}" "$spec"
            '';
          };

          toolkit = mk {
            name = "toolkit";
            text = ''
              cat <<'EOF'
              userscripts toolkit — nix run .#<command>

                GATES (what the branch ruleset requires)
                  gates            eslint + meta + parse, in that order
                  lint [paths]     ESLint over the tree (pinned from package-lock.json)
                  lint-fix         ESLint --fix; run it before pushing, the header alignment is enforced
                  meta [files]     Greasy Fork publish-readiness lint
                  parse            node --check every .user.js
                  versions [ref]   @version monotonicity against a ref (default origin/main)

                RELEASE
                  bump <script> [major|minor|patch|X.Y.Z]   bump @version, refusing burned numbers
                  listing [script]                          assert every script has a listing, or print one
                  preflight [ref]                           the whole ship checklist
                  new-script <name> [match]                 scaffold a gate-passing script + listing

                LIVE PAGE
                  browser [port]   throwaway Chromium on :9222, off-screen (never headless)
                  pagelab [script] run a PINNED page-lab script; no argument lists them
                  verify <script>  run <script>.acceptance.mjs through page-lab's runner

                MAINTENANCE
                  sync-deps        replace node_modules/ with the flake-pinned tree
                  toolkit          this list

                nix develop          shell with all of the above on PATH
                nix develop .#verify shell that also carries page-lab and a browser
                nix flake check      every gate, hermetically
              EOF
            '';
          };
        }
      );

      apps = forAll (
        system: _:
        lib.mapAttrs (name: drv: {
          type = "app";
          program = "${drv}/bin/${name}";
        }) self.packages.${system}
      );

      devShells = forAll (
        system: pkgs:
        let
          nodejs = pkgs.nodejs_22;
          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit nodejs;
            npmRoot = npmRoot;
          };
          cmds = lib.attrValues self.packages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              nodejs
              pkgs.git
              pkgs.gh
              pkgs.jq
              pkgs.shellcheck
              pkgs.nixfmt
            ]
            ++ cmds;

            shellHook = ''
              # Link the pinned dependency tree next to eslint.config.mjs. ESM
              # import does not honour NODE_PATH, so the plugin the config imports
              # can only be found through a real node_modules here.
              if [ -L node_modules ] || [ ! -e node_modules ]; then
                ln -sfn "${nodeModules}/node_modules" node_modules
              else
                echo "note: node_modules is a real directory; 'sync-deps' pins it to the flake." >&2
              fi
              echo "userscripts — node $(node --version), eslint $("./node_modules/.bin/eslint" --version 2>/dev/null || echo '?')"
              echo "commands: nix run .#toolkit   (or just run them: gates, lint-fix, bump, preflight)"
            '';
          };

          # A second shell rather than packages in the first: it carries a browser
          # and the page-lab runners, which nothing in the lint path needs.
          verify = pkgs.mkShell {
            packages = [
              nodejs
              pkgs.git
              pkgs.jq
              pkgs.curl
            ]
            ++ cmds;
            shellHook = ''
              export PAGE_LAB_SCRIPTS="${page-lab}/plugins/page-lab/scripts"
              echo "verify shell — PAGE_LAB_SCRIPTS pinned at ${page-lab.shortRev or "source"}"
              echo "  browser        launch off-screen Chromium on :9222"
              echo "  pagelab        list/run a pinned page-lab script"
              echo "  verify <name>  run an acceptance spec"
            '';
          };
        }
      );

      # `nix flake check` = the CI gates, hermetically, PLUS every command built
      # (writeShellApplication runs shellcheck at build time, so a broken command
      # fails the flake check rather than the operator's afternoon).
      checks = forAll (
        system: pkgs:
        let
          nodejs = pkgs.nodejs_22;
          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit nodejs;
            npmRoot = npmRoot;
          };
        in
        self.packages.${system}
        // {
          gate-eslint = pkgs.runCommand "gate-eslint" { nativeBuildInputs = [ nodejs ]; } ''
            cp -r ${cleanSrc}/. work
            chmod -R u+w work
            cd work
            ln -sfn ${nodeModules}/node_modules node_modules
            ./node_modules/.bin/eslint .
            touch $out
          '';

          gate-meta = pkgs.runCommand "gate-meta" { nativeBuildInputs = [ nodejs ]; } ''
            cp -r ${cleanSrc}/. work
            chmod -R u+w work
            cd work
            node scripts/meta-lint.mjs
            touch $out
          '';

          gate-parse = pkgs.runCommand "gate-parse" { nativeBuildInputs = [ nodejs ]; } ''
            cd ${cleanSrc}
            n=0
            for f in *.user.js; do
              echo "parsing $f"
              node --check "$f"
              n=$((n + 1))
            done
            [ "$n" -gt 0 ] || { echo "no .user.js files — the source filter is wrong" >&2; exit 1; }
            touch $out
          '';

          gate-nixfmt = pkgs.runCommand "gate-nixfmt" { nativeBuildInputs = [ pkgs.nixfmt ]; } ''
            nixfmt --check ${./flake.nix}
            touch $out
          '';
        }
      );
    };
}
