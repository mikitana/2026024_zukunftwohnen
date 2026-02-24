# Build Plan: Zukunft Wohnen Single-Page Site From `content.md`

## Summary
Implement a static, single-page website generated from `content.md` using a Node build script (`markdown-it`), with chapter navigation from `<navbar: ...>` markers, bold campaign styling, German-first UI, and accessibility-compliant section navigation.  
The implementation will keep placeholder links visible, label them as “Bald verfügbar”, auto-map section hero images, and wire the Satzung download link to the local PDF.

## Public Interfaces and Contracts
1. **Input content contract**
`content.md` is the only source for content + chapter metadata.
`<navbar: logo, zukunftwohnen>` defines the logo action and first chapter label.
Subsequent `<navbar: ...>` lines define later chapter labels in order.
Marker lines are metadata-only and never rendered.
2. **Section ID contract**
Slugging is deterministic and must produce:
`chapter-zukunftwohnen`
`chapter-petition-unterstuetzen`
`chapter-spenden-und-helfen`
`chapter-glossar`
`chapter-ueber-uns`
3. **Footer parsing contract**
If `<footer>` exists without `</footer>`, parser treats content from `<footer>` to EOF as footer.
4. **Link handling contract**
All `#` links remain visible and clickable.
Placeholder links get visual disabled style + `Bald verfügbar` badge + accessibility hint.
Known mapping is applied:
`[Vereinsatzung downloaden (PDF)](#)` → `documents/Satzung-FINAL-mit-Unterschriften.pdf`.

## Implementation Scope and File Plan
1. Add `package.json` with scripts:
`build` (generate site), `test` (parser + contract checks), `dev` (optional watch/rebuild).
2. Add `scripts/build-site.mjs`:
Parse markdown lines, extract navbar markers, split chapters, parse markdown to HTML via `markdown-it`, inject into HTML template.
3. Add `scripts/test-parser.mjs` (or `node --test` file):
Assert marker extraction, slug output, footer EOF behavior, and Satzung link rewrite.
4. Add `src/template.html`:
Semantic structure with sticky nav, main sections, and footer mount.
5. Add `src/styles.css`:
Bold campaign visual system, responsive layout, horizontal mobile nav, focus states, reduced-motion handling, placeholder badge styles.
6. Add `src/app.js`:
Smooth-scroll (respecting reduced motion), scrollspy active section, `aria-current` updates, logo-to-first-section behavior.
7. Build output:
Generate `index.html` at repo root for deployment use, but do not commit generated artifacts by policy (source-only workflow).

## Data Flow and Parsing Details
1. Read `content.md` raw text.
2. Detect and store all `<navbar: ...>` markers.
3. Remove marker lines from rendered markdown body.
4. Split content into chapter blocks based on marker positions.
5. Convert each block with `markdown-it` (allow inline HTML needed for footer tag).
6. Apply link rewrite rule for Satzung anchor text.
7. Mark placeholder anchors (`href="#"`) with class/state attributes used by CSS and accessibility text.
8. Extract footer segment:
If `<footer>` found, render as final page footer and exclude from chapter body flow.
9. Emit full page with:
Navbar logo (using `assets/ZW_Logo2.png`), chapter links, sections with required IDs, footer.

## Visual and UX Decisions
1. Visual direction: bold campaign style.
2. Language: German-first UI only.
3. Fonts: system fallback now, with CSS variables reserved for future self-hosted font files.
4. Mobile nav: horizontal scroll, no hamburger.
5. Images: deterministic chapter hero mapping:
`zukunftwohnen` → `assets/close-up-disabled-friend-wheelchair.jpg`
`petition-unterstuetzen` → `assets/img1.jpeg`
`spenden-und-helfen` → `assets/side-view-friends-meeting-outdoors.jpg`
`glossar` → `assets/close-up-hand-moving-wheel.jpg`
`ueber-uns` → `assets/img3.jpg`
6. Navbar logo asset: `assets/ZW_Logo2.png`.

## Accessibility and Behavior Requirements
1. Keyboard reachable nav and links.
2. Strong visible focus states.
3. `aria-current="true"` on active nav item.
4. Section landmarks and heading hierarchy preserved from markdown.
5. Reduced motion:
If `prefers-reduced-motion: reduce`, disable smooth animation and jump instantly.
6. Placeholder accessibility:
Add assistive text indicating link is not yet available.

## Test Cases and Scenarios
1. Navbar renders exactly five chapter entries in marker order.
2. Marker lines are absent from rendered content.
3. Clicking each nav item lands on the matching section ID.
4. Logo click always jumps to `chapter-zukunftwohnen`.
5. Active nav state updates correctly on scroll.
6. Footer content is rendered on the same page even with missing closing `</footer>`.
7. Satzung link points to `documents/Satzung-FINAL-mit-Unterschriften.pdf`.
8. All other placeholder `#` links remain present and display `Bald verfügbar`.
9. Mobile viewport keeps nav usable via horizontal scrolling.
10. Reduced-motion mode disables smooth scrolling.

## Assumptions and Defaults
1. Browser support is modern evergreen only (Chrome/Edge/Firefox/Safari current versions).
2. No translation layer is implemented.
3. No replacement of unresolved placeholder assets/URLs beyond the confirmed Satzung mapping.
4. Build is local/CI-driven; generated artifacts are not source-of-truth in git.
5. If future font files are added under `assets/fonts`, CSS variables can be switched with no template changes.
