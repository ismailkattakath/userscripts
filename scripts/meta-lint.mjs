#!/usr/bin/env node
// Greasy Fork / Sleazy Fork publish-readiness lint.
//
// ESLint + eslint-plugin-userscripts already cover whether the metadata block is
// well-FORMED. This covers whether it is PUBLISHABLE — the host's own rulebook,
// which is about policy rather than syntax and which no plugin encodes:
//
//   * the required key set (Greasy Fork's, plus attribution and a bug path)
//   * banned keys that would let a push to main mutate installed copies
//   * the 500-character line cap that reads as minified code and gets rejected
//   * dotted-numeric, orderable @version
//   * vendored code carrying a source URL
//   * @version monotonicity against a git ref (--versions-against <ref>)
//
// Usage:
//   node scripts/meta-lint.mjs                          lint every *.user.js
//   node scripts/meta-lint.mjs a.user.js b.user.js      lint specific files
//   node scripts/meta-lint.mjs --versions-against origin/main
//
// Exit code 0 = clean, 1 = at least one error. Warnings never fail the build.

import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const REQUIRED_KEYS = [
  'name',
  'namespace',
  'version',
  'description',
  'license',
  'match',
  'homepageURL',
  'supportURL',
];

// Greasy Fork strips these on upload. Pointed at this repository they would let
// a push to main rewrite every installed copy on every user's machine with no
// review — the update path becomes whoever can merge.
const BANNED_KEYS = ['downloadURL', 'updateURL', 'installURL'];

const MAX_LINE = 500;
const VERSION_RE = /^\d+(\.\d+)*$/;
const VENDOR_HINT = /\b(vendored|bundled|adapted from|based on|copied from|minified)\b/i;
const URL_RE = /https?:\/\/\S+/;

let errors = 0;
let warnings = 0;

const err = (file, msg) => {
  console.error(`error  ${file}: ${msg}`);
  errors++;
};
const warn = (file, msg) => {
  console.warn(`warn   ${file}: ${msg}`);
  warnings++;
};

/** Pull the `// ==UserScript== … // ==/UserScript==` block out of a source file. */
function parseMetadata(source) {
  const start = source.indexOf('// ==UserScript==');
  if (start === -1) return null;
  const end = source.indexOf('// ==/UserScript==', start);
  if (end === -1) return null;

  const block = source.slice(start, end);
  const keys = new Map();
  for (const line of block.split('\n')) {
    const m = /^\/\/\s*@(\S+)\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, value] = m;
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(value.trim());
  }
  return { block, keys, endsAt: source.slice(0, end).split('\n').length };
}

/** Compare dotted-numeric versions. Returns <0, 0 or >0. */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function lintFile(path) {
  const file = basename(path);
  const source = readFileSync(path, 'utf8');

  if (!file.endsWith('.user.js')) {
    err(file, 'filename must end in .user.js — a manager will not offer to install anything else');
    return;
  }

  if (source.includes('\r')) {
    err(file, 'contains CR — the file is copied verbatim into the browser; see .gitattributes');
  }

  const meta = parseMetadata(source);
  if (!meta) {
    err(file, 'no // ==UserScript== … // ==/UserScript== metadata block');
    return;
  }

  for (const key of REQUIRED_KEYS) {
    if (!meta.keys.has(key)) err(file, `missing required @${key}`);
  }

  for (const key of BANNED_KEYS) {
    if (meta.keys.has(key)) {
      err(file, `@${key} is banned — Greasy Fork strips it, and it makes main a live update channel`);
    }
  }

  const version = meta.keys.get('version')?.[0];
  if (version && !VERSION_RE.test(version)) {
    err(file, `@version "${version}" is not dotted-numeric — Greasy Fork cannot order it`);
  }

  const license = meta.keys.get('license')?.[0];
  if (license && license !== 'MIT') {
    warn(file, `@license is "${license}" but the repository is MIT — these should agree`);
  }

  for (const key of ['homepageURL', 'supportURL']) {
    const value = meta.keys.get(key)?.[0];
    if (value && !URL_RE.test(value)) {
      err(file, `@${key} is not an absolute http(s) URL: "${value}"`);
    }
  }

  if (meta.keys.has('include') && !meta.keys.has('match')) {
    warn(file, '@include without @match — @include takes no origin and over-matches');
  }

  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (line.length > MAX_LINE) {
      err(file, `line ${i + 1} is ${line.length} chars (max ${MAX_LINE}) — reads as minified and is rejected`);
    }
  });

  // Vendored code needs an attribution URL near it.
  lines.forEach((line, i) => {
    if (!VENDOR_HINT.test(line)) return;
    const window = lines.slice(Math.max(0, i - 5), i + 6).join('\n');
    if (!URL_RE.test(window)) {
      warn(file, `line ${i + 1} looks like vendored code with no source URL within 5 lines`);
    }
  });
}

/** Every @version must strictly increase against `ref` for files that changed. */
function lintVersionsAgainst(ref, files) {
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`, '--', '*.user.js'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    warn('(git)', `could not diff against ${ref} — skipping the version-monotonicity check`);
    return;
  }

  for (const path of changed) {
    if (!files.includes(path)) continue; // deleted in HEAD
    const head = parseMetadata(readFileSync(path, 'utf8'))?.keys.get('version')?.[0];
    let base;
    try {
      base = parseMetadata(
        execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' }),
      )?.keys.get('version')?.[0];
    } catch {
      continue; // new file on this branch — nothing to compare
    }
    if (!head || !base) continue;
    if (compareVersions(head, base) <= 0) {
      err(
        basename(path),
        `@version did not increase (${base} → ${head}). A same-version re-install is a SILENT no-op.`,
      );
    }
  }
}

const argv = process.argv.slice(2);
const refIdx = argv.indexOf('--versions-against');
const ref = refIdx === -1 ? null : argv[refIdx + 1];
// refIdx === -1 means the flag is absent, so nothing is its value. Comparing
// against refIdx + 1 unguarded would drop argv[0] — the first file to lint.
const refValueIdx = refIdx === -1 ? -1 : refIdx + 1;
const explicit = argv.filter((a, i) => !a.startsWith('--') && i !== refValueIdx);

const files = explicit.length
  ? explicit
  : readdirSync('.').filter((f) => f.endsWith('.user.js')).sort();

if (files.length === 0) {
  console.log('meta-lint: no .user.js files to check');
  process.exit(0);
}

for (const f of files) {
  console.log(`checking ${f}`);
  lintFile(f);
}
if (ref) lintVersionsAgainst(ref, files);

const summary = `${files.length} file(s), ${errors} error(s), ${warnings} warning(s)`;
if (errors > 0) {
  console.error(`meta-lint FAILED — ${summary}`);
  process.exit(1);
}
console.log(`meta-lint passed — ${summary}`);
