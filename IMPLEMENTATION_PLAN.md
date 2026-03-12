# Build Plan: Zukunft Wohnen Single-Page Site From `content.md`

## Summary
Implement a static, single-page website generated from `content.md` using a Node build script (`markdown-it`), with chapter navigation from `::: navbar` plugins, bold campaign styling, German-first UI, and accessibility-compliant section navigation.  
The implementation will preserve authored markdown links as-is, including direct links to local PDFs under `/documents/`, while auto-mapping section hero images.

## Public Interfaces and Contracts
1. **Input content contract**
`CONTENT.md` is the only source for content + chapter metadata.
`::: navbar: logo, zukunftwohnen :::` defines the logo action and first chapter label.
Subsequent `::: navbar: ... :::` lines define later chapter labels in order.
Empty `::: navbar` (with no config) and closing `:::` lines are metadata-only and never rendered.
All `::: pluginName :::` blocks (including content) are removed from rendered output, allowing for content organization and future plugin processing.
2. **Section ID contract**
Slugging is deterministic and must produce:
`chapter-zukunftwohnen`
`chapter-unsere-stimmen`
`chapter-petition-unterstuetzen`
`chapter-spenden-und-helfen`
`chapter-ueber-uns`
`chapter-glossar`

4. **Link handling contract**
Markdown links are rendered directly by `markdown-it` without placeholder decoration.
Site-local document links such as `[Titel](/documents/datei.pdf)` are normalized to `documents/datei.pdf` in generated HTML so downloads work in static and local builds.
All non-hash content links open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

## Implementation Scope and File Plan
1. Add `package.json` with scripts:
`build` (generate site), `test` (parser + contract checks), `dev` (optional watch/rebuild).
2. Add `scripts/build-site.mjs`:
Parse markdown lines, extract `::: navbar:` plugins, split chapters, parse markdown to HTML via `markdown-it`, filter out all plugin blocks, inject into HTML template.
3. Add `scripts/test-parser.mjs` (or `node --test` file):
Assert plugin extraction, slug output, and Satzung link rewrite.
4. Add `src/template.html`:
Semantic structure with sticky nav, main sections, and footer mount.
5. Add `src/styles.css`:
Bold campaign visual system, responsive layout, horizontal mobile nav, focus states, and reduced-motion handling.
6. Add `src/app.js`:
Smooth-scroll (respecting reduced motion), scrollspy active section, `aria-current` updates, logo-to-first-section behavior.
7. Build output:
Generate `index.html` at repo root for deployment use, but do not commit generated artifacts by policy (source-only workflow).

## Data Flow and Parsing Details
1. Read `CONTENT.md` raw text.
2. Detect and store all `::: navbar: ... :::` plugin markers (both with config like `logo, zukunftwohnen` and empty).
3. Remove all `::: pluginName` block markers from rendered markdown body (both opening and closing `:::`).
4. Split content into chapter blocks based on navbar marker positions.
5. Convert each block with `markdown-it` (allow inline HTML needed for footer tag).
6. Convert authored markdown links to HTML anchors, normalize site-local `/documents/...` URLs to relative `documents/...` paths, and set non-hash content links to open in a new tab.
9. Emit full page with:
Navbar logo (using `assets/ZW_Logo_transparent.png`), chapter links, sections with required IDs, footer.

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
6. Navbar logo asset: `assets/ZW_Logo_transparent.png`.

## Accessibility and Behavior Requirements
1. Keyboard reachable nav and links.
2. Strong visible focus states.
3. `aria-current="true"` on active nav item.
4. Section landmarks and heading hierarchy preserved from markdown.
5. Reduced motion:
If `prefers-reduced-motion: reduce`, disable smooth animation and jump instantly.

## Test Cases and Scenarios
1. Navbar renders exactly five chapter entries in marker order (from `::: navbar:` plugins with config).
2. Plugin marker lines (all `::: pluginName` and closing `:::`) are absent from rendered content.
3. Clicking each nav item lands on the matching section ID.
4. Logo click always jumps to `chapter-zukunftwohnen`.
5. Active nav state updates correctly on scroll.
6. Authored document links such as `/documents/Zukunftwohnen_Mitgliedsantrag.pdf` are emitted as relative `documents/Zukunftwohnen_Mitgliedsantrag.pdf` URLs in generated HTML.
7. Non-hash content links open in a new tab; same-page anchors like `#spenden` stay in the current tab.
9. Mobile viewport keeps nav usable via horizontal scrolling.
10. Reduced-motion mode disables smooth scrolling.
11. Content inside `::: pluginName` blocks (e.g., video-container, newsletter) is preserved in output, only the plugin markers themselves are removed.

## Assumptions and Defaults
1. Browser support is modern evergreen only (Chrome/Edge/Firefox/Safari current versions).
2. No translation layer is implemented.
3. Document download URLs are authored explicitly in `CONTENT.md`; site-local `/documents/...` links are normalized to relative output paths.
4. Build is local/CI-driven; generated artifacts are not source-of-truth in git.
5. If future font files are added under `assets/fonts`, CSS variables can be switched with no template changes.
