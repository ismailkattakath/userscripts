// Flat ESLint config for the userscripts in this repository.
//
// Two concerns, one config:
//
//   1. eslint-plugin-userscripts validates the `// ==UserScript== …` METADATA
//      block — header names, @grant arguments, @match shape. Reused rather than
//      hand-rolled: it is the community-standard plugin and already encodes
//      what each userscript manager actually supports.
//   2. Core ESLint rules cover the JavaScript itself.
//
// Greasy Fork rules that are about PUBLISHING rather than code — required key
// set, banned keys, the 500-character line cap, version monotonicity — live in
// scripts/meta-lint.mjs instead. See CONTRIBUTING.md § Lint gates.

import userscripts from 'eslint-plugin-userscripts';

// Platform APIs the scripts use, listed by hand rather than pulled from the
// `globals` package. The list is short, and an explicit one documents exactly
// which APIs these scripts depend on. Add an entry WITH A COMMENT naming the
// script and the reason.
const browser = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  CSS: 'readonly',
  CSSStyleSheet: 'readonly',
  DOMParser: 'readonly',
  Element: 'readonly',
  Event: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  Node: 'readonly',
  // youtube-share-to-metube walks the Share button's text nodes to find its
  // label positionally. Reading it by comparing against "Share" would be an
  // aria-label-class selector: localised, and a no-op on a non-English UI.
  NodeFilter: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  atob: 'readonly',
  caches: 'readonly',
  // Teardown must cancel a coalescing frame before it undoes the DOM: a queued
  // rAF outlives teardown and would rebuild exactly what it just removed.
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  getComputedStyle: 'readonly',
  // Forward SPA navigation emits no native event, so scripts patch
  // history.pushState/replaceState once to detect it.
  history: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  requestAnimationFrame: 'readonly',
  self: 'readonly',
  sessionStorage: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

// Manager APIs reach a script ONLY through its own @grant header. Keep this list
// to what some script in the repository actually grants — an ungranted API is
// undefined at runtime, and no-undef should say so rather than let it through.
const userscriptManager = {
  GM_addStyle: 'readonly',
  // youtube-share-to-metube POSTs to MeTube on 127.0.0.1. fetch/XHR cannot:
  // the page is https and the target is http, so the browser blocks it as mixed
  // content. GM_xmlhttpRequest is the manager-side path, gated by @connect.
  GM_xmlhttpRequest: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**'],
  },

  // Metadata block — the plugin's recommended set, with two deliberate opt-outs.
  {
    files: ['**/*.user.js'],
    plugins: { userscripts: { rules: userscripts.rules } },
    rules: {
      ...userscripts.configs.recommended.rules,

      // OFF on purpose. This rule wants @updateURL alongside @downloadURL.
      // Greasy Fork STRIPS both on upload, and pointed at this repository they
      // would let a push to main mutate every installed copy with no review.
      // scripts/meta-lint.mjs bans all three URL keys outright.
      'userscripts/require-download-url': 'off',

      // OFF on purpose, same reason: it pairs @homepage with @homepageURL. We
      // ship @homepageURL only, which is the key Greasy Fork actually renders.
      'userscripts/use-homepage-and-url': 'off',
    },
    settings: {
      // These are developed against Violentmonkey; compat rules score against it.
      userscriptVersions: {
        violentmonkey: '*',
      },
    },
  },

  // The JavaScript itself.
  {
    files: ['**/*.user.js'],
    languageOptions: {
      ecmaVersion: 2023,
      // Userscripts are injected as a classic script, not a module.
      sourceType: 'script',
      globals: { ...browser, ...userscriptManager },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // The two that catch real rot: dead lookups, unset dataset keys,
      // constants that lost their last reader.
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'after-used' }],

      // Correctness
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-sparse-arrays': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',

      // Injecting page-controlled data is the whole security surface here.
      // See SECURITY.md.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Style that is really about avoiding surprises.
      'eqeqeq': ['error', 'smart'],
      'no-implicit-globals': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // no-use-before-define is deliberately ABSENT. A script is one IIFE whose
      // module-scope consts are referenced from closures defined earlier in the
      // file. Evaluation completes before any observer, timer or handler runs,
      // so the rule would flag the file's shape rather than a defect.
    },
  },

  // Repository tooling is Node, ESM, and not a userscript.
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
    rules: {
      'no-unused-vars': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
