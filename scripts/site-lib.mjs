import MarkdownIt from "markdown-it";

const PLUGIN_OPEN_PATTERN = /^\s*:::\s*([\w-]+)(?::\s*(.*?))?\s*$/i;
const PLUGIN_CLOSE_PATTERN = /^\s*:::\s*$/;
const NAVBAR_PLUGIN_NAME = "navbar";
const FOOTER_PLUGIN_NAME = "footer";
const VIDEO_CONTAINER_PLUGIN_NAME = "video-container";
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+\S+/;

export const IMAGE_BY_SLUG = {
  "zukunftwohnen": "assets/close-up-disabled-friend-wheelchair.jpg",
  "verein-zukunftwohnen": "assets/close-up-disabled-friend-wheelchair.jpg",
  "petition-unterstuetzen": "assets/img1.jpeg",
  "spenden-und-helfen": "assets/side-view-friends-meeting-outdoors.jpg",
  "glossar": "assets/close-up-hand-moving-wheel.jpg",
  "ueber-uns": "assets/img3.jpg"
};

function parsePluginOpen(line) {
  const match = line.match(PLUGIN_OPEN_PATTERN);
  if (!match) return null;
  return {
    name: match[1].toLowerCase(),
    config: (match[2] || "").trim()
  };
}

function isPluginClose(line) {
  return PLUGIN_CLOSE_PATTERN.test(line);
}

function isNavbarMarkerLine(line) {
  const plugin = parsePluginOpen(line);
  return plugin?.name === NAVBAR_PLUGIN_NAME;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseNavbarConfig(config) {
  if (!config) {
    return {
      hasLogo: false,
      label: "",
      imagePath: ""
    };
  }

  if (config.includes("|")) {
    const parts = config
      .split("|")
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    let hasLogo = false;
    let label = "";
    let imagePath = "";

    for (const part of parts) {
      if (part.toLowerCase() === "logo") {
        hasLogo = true;
        continue;
      }

      const separatorIndex = part.indexOf("=");
      if (separatorIndex !== -1) {
        const key = normalizeWhitespace(part.slice(0, separatorIndex)).toLowerCase();
        const value = normalizeWhitespace(part.slice(separatorIndex + 1));

        if (key === "image") {
          imagePath = value;
        }

        continue;
      }

      if (!label) {
        label = part;
      }
    }

    return {
      hasLogo,
      label,
      imagePath
    };
  }

  const tokens = config
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

  return {
    hasLogo,
    label: labels[0] || "",
    imagePath: ""
  };
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
    
    if (!plugin || plugin.name !== NAVBAR_PLUGIN_NAME) {
      continue;
    }

    const { hasLogo, label, imagePath } = parseNavbarConfig(plugin.config);

    // Skip navbar plugins without labels (empty navbar markers)
    if (!label) {
      continue;
    }

    markers.push({
      lineIndex,
      label,
      hasLogo,
      imagePath
    });
  }

  if (!markers.length) {
    throw new Error("No ::: navbar plugins with labels were found in content.md.");
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
      imagePath: markers[index].imagePath || IMAGE_BY_SLUG[navItems[index].slug] || "",
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
