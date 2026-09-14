## What and why

<!-- What changed, and the reason. "What" is visible in the diff; "why" is not.
     If you changed a selector, include the measurement that justified it. -->

Closes #

## Checklist

- [ ] `npm run lint` passes (both gates)
- [ ] `@version` bumped on every `.user.js` I changed — **a same-version
      re-install is a silent no-op**
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`
- [ ] README catalogue table updated, if I added or removed a script

### If this touches a selector or the DOM

- [ ] I measured the selector against the **live page with all userscripts
      disabled** — not against my own output
- [ ] The selector anchors on ARIA roles, `href` values or data attributes —
      **no generated class names, no `aria-label`** (it is localised)
- [ ] I confirmed the match count is exactly what I intend
- [ ] I exercised the site's **primary actions** afterwards — geometry proves a
      control is present, never that it works
- [ ] I broke the selector on purpose and confirmed the page degrades to
      **stock**, not mangled
- [ ] Date of measurement recorded in the script's header comment

### If this adds or changes metadata

- [ ] No `@downloadURL`, `@updateURL` or `@installURL` (all banned)
- [ ] `@version` is dotted-numeric and strictly higher than before
- [ ] `@match` used rather than `@include`
- [ ] Every `@grant`-ed API is actually used, and every used API is granted

## Testing

<!-- Browser + userscript manager + versions, and which pages you exercised. -->

- Browser:
- Userscript manager:
- Pages tested:
