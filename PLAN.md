# Spec Plan: Single-Page Chapter Navigation Site (`spec.md`)

## Summary
Create `spec.md` at the repository root as the implementation contract for a simple, single-page website that renders all content from `content.md`, builds a chapter navbar from `<navbar: ...>` markers, supports chapter jump navigation, and makes the logo return to the first chapter.

## What `spec.md` Will Contain
1. **Goal and Scope**
- One-page site only.
- Source content is `content.md`.
- No content rewriting; placeholders and `#` links remain as-is.
- Footer in `content.md` is rendered on the same page.

2. **Information Architecture**
- Define chapter boundaries using `<navbar: ...>` marker lines.
- Marker at line 2 (`<navbar: logo, zukunftwohnen>`) defines:
- `logo` as a special navbar action (jump to first chapter).
- `zukunftwohnen` as the first chapter nav label.
- Subsequent markers define nav labels for subsequent chapters:
- `Petition unterstützen`
- `Spenden und Helfen`
- `Glossar`
- `Über uns`
- Marker lines are metadata only and must not appear in rendered content.

3. **Content Processing Rules (Build-Time)**
- Build-time conversion from Markdown to semantic HTML.
- Keep heading/list/link formatting from markdown.
- Preserve inline links and placeholder targets.
- Treat `<footer>...</footer>` block from `content.md` as rendered footer section in-page.

4. **Navbar and Navigation Behavior**
- Sticky top navbar.
- Left: clickable logo image.
- Right: chapter items using marker labels above.
- Clicking chapter item smooth-scrolls to matching section.
- Clicking logo scrolls to first chapter section.
- Active-section highlighting while scrolling.
- Mobile behavior: horizontal scrollable navbar (no hamburger requirement).

5. **Section/Anchor Contract (Public Interface for Implementers)**
- Section IDs generated from nav labels using deterministic slugging.
- Required IDs:
- `chapter-zukunftwohnen`
- `chapter-petition-unterstuetzen`
- `chapter-spenden-und-helfen`
- `chapter-glossar`
- `chapter-ueber-uns`
- Navbar links must target those exact IDs.
- Reserved keyword: `logo` in marker syntax is never a chapter label.

6. **Assets and Branding**
- Default navbar logo asset: `assets/ZW_logo_text.png`.
- Alt text requirement in spec: `Zukunft Wohnen`.

7. **Accessibility and UX Requirements**
- Keyboard-accessible nav links.
- Visible focus states.
- `aria-current="true"` (or equivalent) for active nav item.
- Respect reduced motion preference for smooth scroll fallback.

8. **Out of Scope**
- CMS/admin editing.
- Content translation.
- Replacing placeholder links/media.
- Multi-page routing.

## Test Cases and Scenarios in `spec.md`
1. All five chapter nav items render in marker-defined order.
2. Marker lines are absent from visual content.
3. Clicking each nav item lands on the correct section ID.
4. Clicking logo always returns to `chapter-zukunftwohnen`.
5. Active nav state updates as user scrolls through sections.
6. Footer content from `content.md` is visible on the same page.
7. Mobile viewport keeps navbar usable via horizontal scrolling.
8. Placeholder links (`#`) remain rendered and clickable as-is.

## Assumptions and Defaults (Explicit)
- `content.md` is the single source of truth for content and nav labels.
- Conversion is done at build-time (not runtime fetch).
- The deliverable for this task is the `spec.md` document, not page implementation.
- Styling is intentionally simple; behavior correctness is prioritized over advanced visual design.
