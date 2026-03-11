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
  assert.deepEqual(model.navItems.map((item) => item.id), [
    "chapter-verein-zukunftwohnen",
    "chapter-unsere-stimmen",
    "chapter-petition-unterstuetzen",
    "chapter-spenden-und-helfen",
    "chapter-ueber-uns",
    "chapter-glossar"
  ]);

  const joinedSections = model.sections.map((section) => section.html).join("\n");
  assert.equal(joinedSections.includes("<navbar:"), false);
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
});

test("footer parser tolerates missing closing tag", () => {
  const sample = `# Titel\n:::navbar: logo, Start\nErster Absatz.\n\n:::footer\n- [Newsletter](/documents/newsletter.pdf)`;
  const model = buildSiteModel(sample);

  assert.match(model.sections[0].html, /Erster Absatz/);
  assert.match(model.footerHtml, /href="documents\/newsletter\.pdf"[^>]*target="_blank"/);
});

