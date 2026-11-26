# Design rules every script holds to

These are not style preferences. Each one is here because its absence broke
something real.

- **Anchor on ARIA roles, `href` values and data attributes — never a generated
  class name.** Framework class names are compiler output and rotate without
  notice. `aria-label` is not an anchor either: it is localised, so a selector
  built on one matches nothing on a non-English UI.
- **When a control has no anchor, its ICON is one.** A button with no id, no
  data attribute and only generated classes is not unanchorable: an SVG path's
  `d` reads the same in every locale, which is exactly what `aria-label` does
  not. Scope it — the same glyph repeats across a page — and record the match
  count with the date.
- **Bind colour to the site's own design token, never a hex.** The brand colour
  in the logo is rarely the colour in the palette, and a frozen hex stops
  tracking the site's themes. Read the token off a control that already has the
  colour you want, and keep the measured value as the `var()` fallback.
- **`!important` is not the top of the cascade — a running animation is.** A Web
  Animation on `transform` outranks author-important. Move things off-canvas with
  the `translate` longhand (composes) rather than `transform` (competes).
- **`:has()` matches ancestors.** Pair a content test with a structural one and
  confirm the match count is exactly what you intend before you hide anything.
- **Assert state from the DOM each pass, never latch it in a variable.**
- **Teardown contract.** Register a teardown on `window` and call any previous one
  at entry. Never early-return on an "already initialised" flag — that makes a
  re-run a silent no-op and hides double-injection bugs.
- **Observer discipline.** `childList`-only on `head`/`documentElement`; never
  `subtree` on a large or virtualised DOM.
- **Failure mode is always degrade to stock.** When a selector is renamed
  upstream, rules stop matching and the page renders as the site intended. A
  script that mangles the page on a miss is a defect, not a degradation.

Per-script reasoning — the measured, dated evidence for why each selector and
cascade trick is what it is — lives in that script's own header comments.
