// Builds the Veylix browser extension into extension/dist (load it unpacked).
// Usage: npm run build:extension  [-- --watch]
import { build, context } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(repo, "extension");
const out = join(root, "dist");
const icons = join(repo, "brand", "extension");
const watch = process.argv.includes("--watch");

// Icons come from the shared brand logo (see scripts/brand.mjs).
if (!existsSync(join(icons, "icon-128.png"))) {
  execFileSync(process.execPath, [join(repo, "scripts", "brand.mjs")], { stdio: "inherit" });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of ["manifest.json", "popup.html", "popup.css"]) cpSync(join(root, file), join(out, file));
cpSync(icons, join(out, "icons"), { recursive: true });

const common = { bundle: true, target: "chrome116", minify: !watch, sourcemap: watch ? "inline" : false, logLevel: "info" };
const builds = [
  // Content scripts can't be ES modules, so bundle them as an IIFE.
  { ...common, entryPoints: [join(root, "src/content.ts")], outfile: join(out, "content.js"), format: "iife" },
  { ...common, entryPoints: [join(root, "src/background.ts")], outfile: join(out, "background.js"), format: "esm" },
  { ...common, entryPoints: [join(root, "src/popup.ts")], outfile: join(out, "popup.js"), format: "esm" },
];

if (watch) {
  for (const options of builds) await (await context(options)).watch();
  console.log("Watching extension sources…");
} else {
  await Promise.all(builds.map((options) => build(options)));
  console.log(`Extension built → ${out}`);
}
