import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSiteModel, renderPage } from "./site-lib.mjs";

const fileName = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(fileName);
const rootDir = path.resolve(scriptDir, "..");

async function main() {
  const [contentMarkdown, template, contactTemplate, impressumTemplate, contactFormHtml] = await Promise.all([
    readFile(path.join(rootDir, "CONTENT.md"), "utf8"),
    readFile(path.join(rootDir, "src/template.html"), "utf8"),
    readFile(path.join(rootDir, "src/contact-template.html"), "utf8"),
    readFile(path.join(rootDir, "src/impressum-template.html"), "utf8"),
    readFile(path.join(rootDir, "src/contact-form.html"), "utf8")
  ]);

  const model = buildSiteModel(contentMarkdown);
  const html = renderPage({
    template,
    model,
    pageTitle: "Zukunft Wohnen"
  });

  const contactHtml = contactTemplate
    .split("{{PAGE_TITLE}}").join("Kontakt | Zukunft Wohnen")
    .split("{{LOGO_PATH}}").join(model.logoPath || "")
    .split("{{CONTACT_FORM}}").join(contactFormHtml);

  const impressumHtml = impressumTemplate
    .split("{{PAGE_TITLE}}").join("Impressum | Zukunft Wohnen")
    .split("{{LOGO_PATH}}").join(model.logoPath || "");

  const outputPath = path.join(rootDir, "index.html");
  const contactOutputPath = path.join(rootDir, "contact.html");
  const impressumOutputPath = path.join(rootDir, "impressum.html");

  await Promise.all([
    writeFile(outputPath, html, "utf8"),
    writeFile(contactOutputPath, contactHtml, "utf8"),
    writeFile(impressumOutputPath, impressumHtml, "utf8")
  ]);

  console.log(`Generated index.html with ${model.sections.length} sections and ${model.navItems.length} nav items.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
