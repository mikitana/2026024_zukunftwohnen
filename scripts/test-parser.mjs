import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSiteModel,
  slugifyLabel
} from "./site-lib.mjs";

const fileName = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(fileName);
const rootDir = path.resolve(scriptDir, "..");

test("slugifyLabel creates stable chapter slugs", () => {
  assert.equal(slugifyLabel("Petition unterstützen"), "petition-unterstuetzen");
  assert.equal(slugifyLabel("Über uns"), "ueber-uns");
});

test("buildSiteModel respects chapter IDs and marker stripping", async () => {
  const content = await readFile(path.join(rootDir, "CONTENT.md"), "utf8");
  const model = buildSiteModel(content);

  assert.equal(model.navItems.length, 6);
  assert.equal(model.logoPath, "assets/ZW_Logo_transparent.png");
  assert.deepEqual(model.navItems.map((item) => item.id), [
    "chapter-verein-zukunftwohnen",
    "chapter-unsere-stimmen",
    "chapter-petition-unterstuetzen",
    "chapter-spenden-und-helfen",
    "chapter-ueber-uns",
    "chapter-glossar"
  ]);

  const joinedSections = model.sections.map((section) => section.html).join("\n");
  assert.equal(joinedSections.includes("navbar-chapter"), false);
  assert.equal(joinedSections.includes("chapter-media"), false);
  assert.match(model.footerHtml, /Newsletter abonnieren/i);
  assert.match(joinedSections, /href="documents\/Zukunftwohnen_Mitgliedsantrag\.pdf"[^>]*target="_blank"/);
  assert.match(joinedSections, /href="https:\/\/www\.change\.org\/[^"]*"[^>]*target="_blank"/);
  assert.match(joinedSections, /<div class="video-container">\s*<iframe class="video-embed video-embed--youtube"/i);
  assert.match(joinedSections, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/f5g_yrX6dzo\?playsinline=1&rel=0"/i);
  assert.match(joinedSections, /data-video-provider="youtube"/i);
  assert.match(joinedSections, /data-video-id="f5g_yrX6dzo"/i);
  assert.doesNotMatch(joinedSections, /<p>\s*\(<iframe/i);
  assert.match(model.footerHtml, /href="#spenden"/);
  assert.doesNotMatch(model.footerHtml, /href="#spenden"[^>]*target="_blank"/);
  assert.equal(model.sections[0].imagePath, "assets/close-up-disabled-friend-wheelchair.jpg");
  assert.equal(model.sections[2].imagePath, "assets/img1.jpeg");
  assert.equal(model.sections[3].imagePath, "assets/side-view-friends-meeting-outdoors.jpg");
  assert.equal(model.sections[4].imagePath, "assets/img3.jpg");
  assert.equal(model.sections[5].imagePath, "assets/close-up-hand-moving-wheel.jpg");
});

test("buildSiteModel parses explicit chapter markers and separates media metadata", () => {
  const sample = `# Start\n::: navbar-chapter-with-logo="Start" | logo="assets/logo.png" :::\n::: chapter-media="assets/start.jpg" :::\nEinleitung.\n\n# Kapitel\n::: navbar-chapter="Kapitel" :::\n::: chapter-media="assets/kapitel.jpg" :::\nText.\n\n# Ohne Bild\n::: navbar-chapter="Ohne Bild" :::\nMehr Text.`;
  const model = buildSiteModel(sample);

  assert.equal(model.navItems.length, 3);
  assert.equal(model.firstSectionId, "chapter-start");
  assert.equal(model.hasLogoAction, true);
  assert.equal(model.logoPath, "assets/logo.png");
  assert.equal(model.sections[0].imagePath, "assets/start.jpg");
  assert.equal(model.sections[1].imagePath, "assets/kapitel.jpg");
  assert.equal(model.sections[2].imagePath, "");
});

test("buildSiteModel rejects legacy navbar markers", () => {
  const sample = `# Start\n::: navbar: Start\n:::\nText.`;

  assert.throws(
    () => buildSiteModel(sample),
    /Legacy ::: navbar: \.\.\. ::: markers are no longer supported/i
  );
});

test("footer parser tolerates missing closing tag", () => {
  const sample = `# Titel\n::: navbar-chapter-with-logo="Start" | logo="assets/logo.png" :::\nErster Absatz.\n\n:::footer\n- [Newsletter](/documents/newsletter.pdf)`;
  const model = buildSiteModel(sample);

  assert.match(model.sections[0].html, /Erster Absatz/);
  assert.match(model.footerHtml, /href="documents\/newsletter\.pdf"[^>]*target="_blank"/);
});

