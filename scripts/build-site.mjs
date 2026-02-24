import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSiteModel, renderPage } from "./site-lib.mjs";

const fileName = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(fileName);
const rootDir = path.resolve(scriptDir, "..");

async function main() {
  const [contentMarkdown, template] = await Promise.all([
    readFile(path.join(rootDir, "content.md"), "utf8"),
    readFile(path.join(rootDir, "src/template.html"), "utf8")
  ]);

  const model = buildSiteModel(contentMarkdown);
  const html = renderPage({
    template,
    model,
    logoPath: "assets/ZW_Logo2.png",
    pageTitle: "Zukunft Wohnen"
  });

  const outputPath = path.join(rootDir, "index.html");
  await writeFile(outputPath, html, "utf8");

  console.log(`Generated index.html with ${model.sections.length} sections and ${model.navItems.length} nav items.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
