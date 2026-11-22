// Bundle the game into one self-contained HTML file for screenshots.
// The headless Chrome in this VM cannot load http://localhost (its
// local-network check blocks it), but file:// works, so the eight ES
// modules are concatenated in dependency order into a single classic
// <script>: import lines are dropped and export keywords are stripped.
// The deliverable under game/ is untouched; this bundle is only the
// render the screenshots are taken from, the same code in one file.
// Usage: node bundle-shots.mjs [out-html]
import { readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "/tmp/heist-shot.html";
const SRC = "game/src";
// Dependency order: config first, then the leaves, then the modules
// that use them, then main.
const ORDER = ["config.js", "random.js", "input.js", "sound.js", "world.js", "render.js", "shots.js", "main.js"];

/** Drop import statements (they can span lines) and strip export keywords. */
function stripModule(source) {
  const lines = source.split("\n");
  const kept = [];
  let inImport = false;
  for (const line of lines) {
    if (inImport) {
      if (line.includes("from") && line.includes(";")) inImport = false;
      continue;
    }
    if (/^\s*import\s/.test(line)) {
      if (!line.includes(";")) inImport = true;
      continue;
    }
    kept.push(line.replace(/^(\s*)export\s+(function|const|class)\s/, "$1$2 "));
  }
  return kept.join("\n");
}

const parts = ORDER.map((file) => {
  const source = readFileSync(`${SRC}/${file}`, "utf8");
  return `// ---- ${file} ----\n` + stripModule(source);
});

const html = readFileSync("game/index.html", "utf8");
// A replacement function, not a string: the game's source holds $
// (template literals, 'Loot $'), and a string replacement would read
// those as $-patterns and corrupt the bundle.
const bundled = html.replace(
  '<script type="module" src="./src/main.js"></script>',
  () => `<script>\n${parts.join("\n\n")}\n</script>`,
);
if (bundled === html) {
  console.error("the script tag was not found in index.html");
  process.exit(1);
}
writeFileSync(OUT, bundled);
console.log("wrote", OUT, bundled.length, "bytes");
