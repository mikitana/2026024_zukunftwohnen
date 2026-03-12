import MarkdownIt from "markdown-it";

const PLUGIN_OPEN_PATTERN = /^\s*:::\s*([\w-]+)(.*)$/i;
const PLUGIN_CLOSE_PATTERN = /^\s*:::\s*$/;
const LEGACY_NAVBAR_PLUGIN_NAME = "navbar";
const NAVBAR_CHAPTER_PLUGIN_NAME = "navbar-chapter";
const NAVBAR_CHAPTER_WITH_LOGO_PLUGIN_NAME = "navbar-chapter-with-logo";
const CHAPTER_MEDIA_PLUGIN_NAME = "chapter-media";
const FOOTER_PLUGIN_NAME = "footer";
const VIDEO_CONTAINER_PLUGIN_NAME = "video-container";
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+\S+/;

function parsePluginOpen(line) {
  const match = line.match(PLUGIN_OPEN_PATTERN);
  if (!match) return null;

  let config = (match[2] || "").trim();
  let selfClosing = false;

  if (config.endsWith(":::")) {
    selfClosing = true;
    config = config.slice(0, -3).trim();
  }

  if (config.startsWith(":")) {
    config = config.slice(1).trim();
  }

  return {
    name: match[1].toLowerCase(),
    config,
    selfClosing
  };
}

function isPluginClose(line) {
  return PLUGIN_CLOSE_PATTERN.test(line);
}

function isNavbarMarkerLine(line) {
  const plugin = parsePluginOpen(line);
  return plugin?.name === NAVBAR_CHAPTER_PLUGIN_NAME
    || plugin?.name === NAVBAR_CHAPTER_WITH_LOGO_PLUGIN_NAME;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseQuotedDirectiveConfig(config) {
  let remaining = (config || "").trim();
  let primaryValue = "";

  if (remaining.startsWith("=")) {
    const primaryMatch = remaining.match(/^=\s*(["'])(.*?)\1/);
    if (!primaryMatch) {
      throw new Error(`Invalid directive config: ${config}`);
    }

    primaryValue = normalizeWhitespace(primaryMatch[2]);
    remaining = remaining.slice(primaryMatch[0].length).trim();
  }

  const attributes = {};
  const attributePattern = /([\w-]+)\s*=\s*(["'])(.*?)\2/g;

  for (const match of remaining.matchAll(attributePattern)) {
    attributes[match[1].toLowerCase()] = normalizeWhitespace(match[3]);
  }

  return {
    primaryValue,
    attributes
  };
}

function parseNavbarMarker(plugin) {
  const { primaryValue, attributes } = parseQuotedDirectiveConfig(plugin.config);

  if (!primaryValue) {
    throw new Error(`Missing quoted chapter label in ::: ${plugin.name}="..." ::: marker.`);
  }

  if (attributes.image) {
    throw new Error(`Image paths are no longer allowed in ::: ${plugin.name} ::: markers. Use ::: ${CHAPTER_MEDIA_PLUGIN_NAME}="..." ::: inside the chapter instead.`);
  }

  const hasLogo = plugin.name === NAVBAR_CHAPTER_WITH_LOGO_PLUGIN_NAME;

  return {
    hasLogo,
    label: primaryValue,
    logoPath: hasLogo ? attributes.logo || "" : ""
  };
}

function parseChapterMediaMarker(plugin) {
  const { primaryValue } = parseQuotedDirectiveConfig(plugin.config);

  if (!primaryValue) {
    throw new Error(`Missing quoted image path in ::: ${CHAPTER_MEDIA_PLUGIN_NAME}="..." ::: marker.`);
  }

  return primaryValue;
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
    const plugin = parsePluginOpen(line);

    if (!plugin) {
      continue;
    }

    if (plugin.name === LEGACY_NAVBAR_PLUGIN_NAME) {
      throw new Error(`Legacy ::: ${LEGACY_NAVBAR_PLUGIN_NAME}: ... ::: markers are no longer supported. Use ::: ${NAVBAR_CHAPTER_PLUGIN_NAME}="..." ::: or ::: ${NAVBAR_CHAPTER_WITH_LOGO_PLUGIN_NAME}="..." | logo="..." :::.`);
    }

    if (!isNavbarMarkerLine(line)) {
      continue;
    }

    const { hasLogo, label, logoPath } = parseNavbarMarker(plugin);

    markers.push({
      lineIndex,
      label,
      hasLogo,
      logoPath
    });
  }

  if (!markers.length) {
    throw new Error(`No ::: ${NAVBAR_CHAPTER_PLUGIN_NAME}="..." ::: markers were found in content.md.`);
  }

  return markers;
}

function findChapterMediaPath(lines, start, end) {
  let imagePath = "";

  for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
    const plugin = parsePluginOpen(lines[lineIndex]);
    if (!plugin || plugin.name !== CHAPTER_MEDIA_PLUGIN_NAME) {
      continue;
    }

    if (imagePath) {
      throw new Error("Only one ::: chapter-media=\"...\" ::: marker is allowed per chapter.");
    }

    imagePath = parseChapterMediaMarker(plugin);
  }

  return imagePath;
}

function findChapterStarts(lines, markers) {
  const starts = [0];

  for (let index = 1; index < markers.length; index += 1) {
    const marker = markers[index];
    const previousStart = starts[index - 1];
    let start = -1;

    for (let cursor = marker.lineIndex; cursor > previousStart; cursor -= 1) {
      const line = lines[cursor];
      if (isNavbarMarkerLine(line)) {
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

function shouldOpenInNewTab(href) {
  return Boolean(href && !href.startsWith("#"));
}

function configureRenderer(renderer) {
  const defaultLinkOpen = renderer.renderer.rules.link_open
    ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

  renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet("href") || "";

    if (shouldOpenInNewTab(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }

    return defaultLinkOpen(tokens, index, options, env, self);
  };

  return renderer;
}

function createMarkdownRenderer(renderer) {
  if (renderer) {
    return configureRenderer(renderer);
  }
  return configureRenderer(new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false
  }));
}

function normalizeLocalDocumentLinks(html) {
  return html.replace(/href=(['"])\/documents\//gi, "href=$1documents/");
}

function renderMarkdownToHtml(renderer, markdown) {
  return normalizeLocalDocumentLinks(renderer.render(markdown));
}

function extractAttribute(markup, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return markup.match(pattern)?.[2] || "";
}

function extractYouTubeVideoId(src) {
  if (!src) {
    return "";
  }

  const match = src.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

function normalizeYouTubeIframe(iframeMarkup) {
  const src = extractAttribute(iframeMarkup, "src");
  const videoId = extractYouTubeVideoId(src);
  if (!videoId) {
    return iframeMarkup;
  }

  const title = extractAttribute(iframeMarkup, "title") || "YouTube video player";
  const canonicalSrc = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0`;

  return `<iframe class="video-embed video-embed--youtube" width="560" height="315" src="${canonicalSrc}" title="${escapeHtml(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen data-video-provider="youtube" data-video-id="${videoId}"></iframe>`;
}

function normalizeIframeMarkup(markup) {
  if (!/^<iframe[\s\S]*<\/iframe>$/i.test(markup)) {
    return markup;
  }

  if (/youtube(?:-nocookie)?\.com\/embed\//i.test(markup)) {
    return normalizeYouTubeIframe(markup);
  }

  return markup;
}

function normalizeVideoContainerMarkup(lines) {
  const content = lines.join("\n").trim();
  if (!content) {
    return "";
  }

  const iframeOnlyMatch = content.match(/^\(\s*(<iframe[\s\S]*<\/iframe>)\s*\)$/i);
  const rawMarkup = (iframeOnlyMatch?.[1] || content).trim();
  return normalizeIframeMarkup(rawMarkup);
}

function renderPluginBlock(pluginName, lines) {
  if (pluginName === VIDEO_CONTAINER_PLUGIN_NAME) {
    const embedMarkup = normalizeVideoContainerMarkup(lines);
    if (!embedMarkup) {
      return [];
    }

    return [
      "<div class=\"video-container\">",
      embedMarkup,
      "</div>"
    ];
  }

  return lines;
}

function buildChapterMarkdown(lines, start, end) {
  const filtered = [];
  const footerLines = [];
  let inPluginBlock = null;
  let pluginLines = [];

  function flushPluginBlock() {
    if (!inPluginBlock) {
      return;
    }

    if (inPluginBlock === FOOTER_PLUGIN_NAME) {
      footerLines.push(...pluginLines);
    } else {
      filtered.push(...renderPluginBlock(inPluginBlock, pluginLines));
    }

    inPluginBlock = null;
    pluginLines = [];
  }

  for (let i = start; i <= end; i += 1) {
    const line = lines[i];

    const plugin = parsePluginOpen(line);
    if (plugin) {
      flushPluginBlock();

      if (plugin.selfClosing) {
        continue;
      }

      inPluginBlock = plugin.name;
      continue;
    }

    if (inPluginBlock && isPluginClose(line)) {
      flushPluginBlock();
      continue;
    }

    if (inPluginBlock) {
      pluginLines.push(line);
    } else {
      filtered.push(line);
    }
  }

  flushPluginBlock();

  let bodyMarkdown = normalizeMarkdownChunk(filtered.join("\n"));
  bodyMarkdown = bodyMarkdown.replace(/\n-{3,}\s*$/g, "").trimEnd();
  const footerMarkdown = normalizeMarkdownChunk(footerLines.join("\n"));

  return { bodyMarkdown, footerMarkdown };
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

    const { bodyMarkdown, footerMarkdown: chapterFooter } = buildChapterMarkdown(lines, start, end);

    if (chapterFooter && !footerMarkdown) {
      footerMarkdown = chapterFooter;
    }

    const html = renderMarkdownToHtml(renderer, bodyMarkdown);

    sections.push({
      ...navItems[index],
      imagePath: findChapterMediaPath(lines, start, end),
      html
    });
  }

  const footerHtml = footerMarkdown ? renderMarkdownToHtml(renderer, footerMarkdown) : "";

  return {
    navItems,
    sections,
    firstSectionId: navItems[0]?.id || "",
    footerHtml,
    hasLogoAction: markers[0]?.hasLogo || false,
    logoPath: markers[0]?.logoPath || ""
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
    LOGO_PATH: model.logoPath || logoPath || "",
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
