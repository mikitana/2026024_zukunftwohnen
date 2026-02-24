import MarkdownIt from "markdown-it";

const NAVBAR_PATTERN = /^\s*<navbar:\s*(.+?)\s*>\s*$/i;
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+\S+/;
const FOOTER_OPEN_TAG = "<footer>";
const FOOTER_CLOSE_TAG = "</footer>";

export const IMAGE_BY_SLUG = {
  "zukunftwohnen": "assets/close-up-disabled-friend-wheelchair.jpg",
  "petition-unterstuetzen": "assets/img1.jpeg",
  "spenden-und-helfen": "assets/side-view-friends-meeting-outdoors.jpg",
  "glossar": "assets/close-up-hand-moving-wheel.jpg",
  "ueber-uns": "assets/img3.jpg"
};

function isNavbarLine(line) {
  return NAVBAR_PATTERN.test(line);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugifyLabel(label) {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMarkers(lines) {
  const markers = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const match = line.match(NAVBAR_PATTERN);
    if (!match) {
      continue;
    }

    const tokens = match[1]
      .split(",")
      .map((token) => normalizeWhitespace(token))
      .filter(Boolean);

    let hasLogo = false;
    const labels = [];

    for (const token of tokens) {
      if (token.toLowerCase() === "logo") {
        hasLogo = true;
      } else {
        labels.push(token);
      }
    }

    if (!labels.length) {
      throw new Error(`Navbar marker on line ${lineIndex + 1} has no chapter label.`);
    }

    markers.push({
      lineIndex,
      label: labels[0],
      hasLogo
    });
  }

  if (!markers.length) {
    throw new Error("No <navbar: ...> chapter markers were found in content.md.");
  }

  return markers;
}

function findChapterStarts(lines, markers) {
  const starts = [0];

  for (let index = 1; index < markers.length; index += 1) {
    const marker = markers[index];
    const previousStart = starts[index - 1];
    let start = -1;

    for (let cursor = marker.lineIndex; cursor > previousStart; cursor -= 1) {
      const line = lines[cursor];
      if (isNavbarLine(line)) {
        continue;
      }
      if (HEADING_PATTERN.test(line)) {
        start = cursor;
        break;
      }
    }

    if (start === -1) {
      start = markers[index - 1].lineIndex + 1;
    }

    if (start <= previousStart) {
      start = previousStart + 1;
    }

    starts.push(start);
  }

  return starts;
}

function normalizeMarkdownChunk(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitFooterFromMarkdown(markdown) {
  const lower = markdown.toLowerCase();
  const openIndex = lower.indexOf(FOOTER_OPEN_TAG);
  if (openIndex === -1) {
    return { bodyMarkdown: markdown, footerMarkdown: "" };
  }

  const footerStart = openIndex + FOOTER_OPEN_TAG.length;
  const closeIndex = lower.indexOf(FOOTER_CLOSE_TAG, footerStart);

  const bodyRaw = markdown.slice(0, openIndex).trimEnd();
  const bodyWithoutDivider = bodyRaw.replace(/\n-{3,}\s*$/g, "").trimEnd();

  const footerMarkdown = (closeIndex === -1
    ? markdown.slice(footerStart)
    : markdown.slice(footerStart, closeIndex)
  ).trim();

  return {
    bodyMarkdown: bodyWithoutDivider,
    footerMarkdown
  };
}

export function rewriteKnownLinks(markdown) {
  return markdown.replace(/\[([^\]]*atzung[^\]]*downloaden[^\]]*\(PDF\))\]\(#\)/gi, (_match, label) => {
    return `[${label}](documents/Satzung-FINAL-mit-Unterschriften.pdf)`;
  });
}

function appendClass(attributes, className) {
  if (/\bclass\s*=\s*/i.test(attributes)) {
    return attributes.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_match, quote, value) => {
      const classSet = new Set(value.split(/\s+/).filter(Boolean));
      classSet.add(className);
      return `class=${quote}${Array.from(classSet).join(" ")}${quote}`;
    });
  }
  return `${attributes} class="${className}"`.trim();
}

function ensureAttribute(attributes, key, value) {
  const pattern = new RegExp(`\\b${key}\\s*=`, "i");
  if (pattern.test(attributes)) {
    return attributes;
  }
  return `${attributes} ${key}="${escapeHtml(value)}"`.trim();
}

export function decoratePlaceholderLinks(html) {
  return html.replace(/<a\s+([^>]*?)href="#"([^>]*)>([\s\S]*?)<\/a>/gi, (full, before, after, inner) => {
    if (inner.includes("placeholder-badge")) {
      return full;
    }

    let attributes = `${before}href="#"${after}`.replace(/\s+/g, " ").trim();
    attributes = appendClass(attributes, "placeholder-link");
    attributes = ensureAttribute(attributes, "data-placeholder", "true");

    const plainText = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plainText) {
      attributes = ensureAttribute(attributes, "aria-label", `${plainText} (Bald verfügbar)`);
    }

    return `<a ${attributes}>${inner}<span class="placeholder-badge" aria-hidden="true">Bald verfügbar</span><span class="sr-only"> Inhalt folgt in Kürze.</span></a>`;
  });
}

function createMarkdownRenderer(renderer) {
  if (renderer) {
    return renderer;
  }
  return new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false
  });
}

function renderMarkdownToHtml(renderer, markdown) {
  const rewritten = rewriteKnownLinks(markdown);
  const rawHtml = renderer.render(rewritten);
  return decoratePlaceholderLinks(rawHtml);
}

function buildChapterMarkdown(lines, start, end) {
  const slice = lines
    .slice(start, end + 1)
    .filter((line) => !isNavbarLine(line))
    .join("\n");
  return normalizeMarkdownChunk(slice);
}

export function buildSiteModel(rawMarkdown, options = {}) {
  if (typeof rawMarkdown !== "string") {
    throw new TypeError("buildSiteModel expects markdown text as a string.");
  }

  const lines = rawMarkdown.replace(/\r\n/g, "\n").split("\n");
  const markers = parseMarkers(lines);
  const chapterStarts = findChapterStarts(lines, markers);
  const renderer = createMarkdownRenderer(options.renderer);

  const navItems = markers.map((marker) => {
    const slug = slugifyLabel(marker.label);
    return {
      label: marker.label,
      slug,
      id: `chapter-${slug}`
    };
  });

  const sections = [];
  let footerMarkdown = "";

  for (let index = 0; index < navItems.length; index += 1) {
    const start = chapterStarts[index];
    const end = index < navItems.length - 1
      ? chapterStarts[index + 1] - 1
      : lines.length - 1;

    const sectionMarkdown = buildChapterMarkdown(lines, start, end);
    const footerSplit = splitFooterFromMarkdown(sectionMarkdown);

    if (footerSplit.footerMarkdown && !footerMarkdown) {
      footerMarkdown = footerSplit.footerMarkdown;
    }

    const html = renderMarkdownToHtml(renderer, footerSplit.bodyMarkdown || sectionMarkdown);

    sections.push({
      ...navItems[index],
      imagePath: IMAGE_BY_SLUG[navItems[index].slug] || "",
      html
    });
  }

  const footerHtml = footerMarkdown ? renderMarkdownToHtml(renderer, footerMarkdown) : "";

  return {
    navItems,
    sections,
    firstSectionId: navItems[0]?.id || "",
    footerHtml,
    hasLogoAction: markers[0]?.hasLogo || false
  };
}

function renderNav(navItems) {
  return navItems
    .map((item, index) => {
      const activeClass = index === 0 ? " is-active" : "";
      const currentAttr = index === 0 ? ' aria-current="true"' : "";
      return `<a class="nav-link${activeClass}" href="#${item.id}" data-nav-link data-target="${item.id}"${currentAttr}>${escapeHtml(item.label)}</a>`;
    })
    .join("\n");
}

function renderSections(sections) {
  return sections
    .map((section, index) => {
      const introClass = index === 0 ? " chapter--intro" : "";
      const flipClass = index % 2 === 1 ? " chapter--flip" : "";
      const image = section.imagePath
        ? `<figure class="chapter-media"><img src="${section.imagePath}" alt="Motiv zur Rubrik ${escapeHtml(section.label)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></figure>`
        : "";

      return `<section class="chapter${introClass}${flipClass}" id="${section.id}" data-section data-slug="${section.slug}">
${image}
<div class="chapter-content">
${section.html}
</div>
</section>`;
    })
    .join("\n");
}

export function renderPage({ template, model, logoPath, pageTitle }) {
  const replacements = {
    PAGE_TITLE: escapeHtml(pageTitle),
    LOGO_PATH: logoPath,
    LOGO_TARGET: model.firstSectionId,
    NAV_ITEMS: renderNav(model.navItems),
    CHAPTERS: renderSections(model.sections),
    FOOTER_CONTENT: model.footerHtml || "<p>Weitere Informationen folgen.</p>"
  };

  let page = template;
  for (const [key, value] of Object.entries(replacements)) {
    page = page.split(`{{${key}}}`).join(value);
  }

  return page;
}
