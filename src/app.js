const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
const logoLink = document.querySelector("[data-logo-link]");
const siteNav = document.querySelector(".site-nav");
const navToggle = document.querySelector("[data-nav-toggle]");
const mobileNavQuery = window.matchMedia("(max-width: 42rem)");

let closeNavigationMenu = () => {};

if (siteNav && navToggle) {
  const setNavigationMenuState = (isOpen) => {
    siteNav.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  closeNavigationMenu = () => {
    setNavigationMenuState(false);
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setNavigationMenuState(!isOpen);
  });

  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (siteNav.contains(target) || navToggle.contains(target)) {
      return;
    }

    closeNavigationMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavigationMenu();
    }
  });

  const handleViewportChange = (event) => {
    if (!event.matches) {
      closeNavigationMenu();
    }
  };

  if (typeof mobileNavQuery.addEventListener === "function") {
    mobileNavQuery.addEventListener("change", handleViewportChange);
  } else {
    mobileNavQuery.addListener(handleViewportChange);
  }
}

document.documentElement.classList.add("js-ready");

const youtubePreviews = Array.from(document.querySelectorAll("[data-youtube-preview]"));

function shouldInlineYouTubeEmbed() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function createYouTubeIframe(preview) {
  const src = preview.dataset.videoSrc || "";
  const title = preview.dataset.videoTitle || "YouTube video player";
  const videoId = preview.dataset.videoId || "";
  const iframe = document.createElement("iframe");

  iframe.className = "video-embed video-embed--youtube";
  iframe.width = "560";
  iframe.height = "315";
  iframe.src = src;
  iframe.title = title;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
  iframe.setAttribute("allowfullscreen", "");
  iframe.dataset.videoProvider = "youtube";
  iframe.dataset.videoId = videoId;

  return iframe;
}

for (const preview of youtubePreviews) {
  const activateButton = preview.querySelector("[data-video-activate]");
  if (!(activateButton instanceof HTMLButtonElement)) {
    continue;
  }

  activateButton.addEventListener("click", () => {
    const watchUrl = preview.dataset.videoWatchUrl || "";

    if (!shouldInlineYouTubeEmbed()) {
      if (watchUrl) {
        window.open(watchUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const iframe = createYouTubeIframe(preview);
    preview.replaceWith(iframe);
  });
}

if (navLinks.length && sections.length) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smoothBehavior = reduceMotion ? "auto" : "smooth";

  function setActive(targetId) {
    for (const link of navLinks) {
      const isActive = link.dataset.target === targetId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function scrollToTarget(targetId) {
    const section = document.getElementById(targetId);
    if (!section) {
      return;
    }

    section.scrollIntoView({
      behavior: smoothBehavior,
      block: "start"
    });
  }

  function onNavigationClick(event, targetId) {
    event.preventDefault();
    setActive(targetId);
    scrollToTarget(targetId);
    closeNavigationMenu();

    if (history.replaceState) {
      history.replaceState(null, "", `#${targetId}`);
    }
  }

  for (const link of navLinks) {
    link.addEventListener("click", (event) => {
      onNavigationClick(event, link.dataset.target);
    });
  }

  if (logoLink && logoLink.dataset.target) {
    logoLink.addEventListener("click", (event) => {
      onNavigationClick(event, logoLink.dataset.target);
    });
  }

  if ("IntersectionObserver" in window) {
    const visibility = new Map();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        } else {
          visibility.delete(entry.target.id);
        }
      }

      if (!visibility.size) {
        return;
      }

      let winnerId = "";
      let winnerScore = -1;

      for (const [id, ratio] of visibility.entries()) {
        const element = document.getElementById(id);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const distanceFromViewportCenter = Math.abs(rect.top - window.innerHeight * 0.35);
        const positionScore = 1 - Math.min(distanceFromViewportCenter / window.innerHeight, 1);
        const score = ratio * 0.8 + positionScore * 0.2;

        if (score > winnerScore) {
          winnerScore = score;
          winnerId = id;
        }
      }

      if (winnerId) {
        setActive(winnerId);
      }
    }, {
      rootMargin: "-35% 0px -50% 0px",
      threshold: [0.1, 0.25, 0.45, 0.65]
    });

    for (const section of sections) {
      observer.observe(section);
    }
  } else {
    let ticking = false;

    function updateActiveFallback() {
      ticking = false;
      let winner = sections[0]?.id || "";
      let winnerDistance = Number.POSITIVE_INFINITY;

      for (const section of sections) {
        const distance = Math.abs(section.getBoundingClientRect().top - 120);
        if (distance < winnerDistance) {
          winnerDistance = distance;
          winner = section.id;
        }
      }

      if (winner) {
        setActive(winner);
      }
    }

    window.addEventListener("scroll", () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(updateActiveFallback);
    }, { passive: true });
  }

  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && document.getElementById(initialHash)) {
    setActive(initialHash);
  } else if (navLinks[0]) {
    setActive(navLinks[0].dataset.target);
  }

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setActive(hash);
    }
  });
}
