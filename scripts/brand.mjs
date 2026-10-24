// Generates every logo/icon size from ONE source image.
//
//   1. Put your logo at brand/logo.png (square, ideally 1024×1024, transparent
//      background). brand/logo.svg is used if there's no PNG.
//   2. Run: npm run brand
//
// Outputs:
//   src/app/icon.png         browser tab icon (Next.js file convention)
//   src/app/apple-icon.png   iOS home screen / bookmarks (opaque background)
//   public/logo.png          in-app logo (<LogoMark />)
//   brand/extension/*.png    browser-extension icons (16/32/48/128)
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = ["brand/logo.png", "brand/logo.svg"].map((p) => join(root, p)).find(existsSync);
if (!source) {
  console.error("No logo found. Add brand/logo.png (or brand/logo.svg) and run again.");
  process.exit(1);
}

// Render SVGs at high density so small sizes stay crisp.
const load = () => sharp(source, { density: 600 });
const meta = await load().metadata();
if (meta.width && meta.height && Math.abs(meta.width - meta.height) > 2) {
  console.warn(`⚠ ${source} is ${meta.width}×${meta.height}; it will be centered on a square canvas.`);
}

const square = (size, background = { r: 0, g: 0, b: 0, alpha: 0 }) =>
  load().resize(size, size, { fit: "contain", background }).png({ compressionLevel: 9 });

const outputs = [
  ["src/app/icon.png", square(512)],
  // Apple strips transparency, so give it a white background.
  ["src/app/apple-icon.png", square(180, { r: 255, g: 255, b: 255, alpha: 1 }).flatten({ background: "#ffffff" })],
  ["public/logo.png", square(512)],
  ...[16, 32, 48, 128].map((s) => [`brand/extension/icon-${s}.png`, square(s)]),
];

for (const [path, image] of outputs) {
  const out = join(root, path);
  mkdirSync(dirname(out), { recursive: true });
  await image.toFile(out);
  console.log(`✓ ${path}`);
}
console.log(`\nGenerated from ${source.replace(`${root}/`, "")}. Restart \`npm run dev\` and run \`npm run build:extension\` to pick it up.`);
