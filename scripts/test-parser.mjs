import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSiteModel,
  decoratePlaceholderLinks,
  rewriteKnownLinks,
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
  const content = await readFile(path.join(rootDir, "content.md"), "utf8");
  const model = buildSiteModel(content);

  assert.equal(model.navItems.length, 5);
  assert.deepEqual(model.navItems.map((item) => item.id), [
    "chapter-zukunftwohnen",
    "chapter-petition-unterstuetzen",
    "chapter-spenden-und-helfen",
    "chapter-glossar",
    "chapter-ueber-uns"
  ]);

  const joinedSections = model.sections.map((section) => section.html).join("\n");
  assert.equal(joinedSections.includes("<navbar:"), false);
  assert.match(model.footerHtml, /Newsletter abonnieren/i);
});

test("footer parser tolerates missing closing tag", () => {
  const sample = `# Titel\n<navbar: logo, Start>\nErster Absatz.\n\n<footer>\n- [Newsletter](#)`;
  const model = buildSiteModel(sample);

  assert.match(model.sections[0].html, /Erster Absatz/);
  assert.match(model.footerHtml, /Newsletter/);
});

test("known Satzung placeholder is rewritten to local document", () => {
  const rewritten = rewriteKnownLinks("[Vereinsatzung downloaden (PDF)](#)");
  assert.match(rewritten, /documents\/Satzung-FINAL-mit-Unterschriften\.pdf/);
});

test("placeholder links are decorated with badge and metadata", () => {
  const decorated = decoratePlaceholderLinks("<p><a href=\"#\">Testlink</a></p>");
  assert.match(decorated, /Bald verfügbar/);
  assert.match(decorated, /data-placeholder="true"/);
});
