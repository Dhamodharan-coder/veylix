// Builds the Veylix browser extension into extension/dist (load it unpacked).
// Usage: npm run build:extension  [-- --watch]
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extension");
const out = join(root, "dist");
const watch = process.argv.includes("--watch");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "icons"), { recursive: true });

for (const file of ["manifest.json", "popup.html", "popup.css"]) cpSync(join(root, file), join(out, file));
writeIcons(join(out, "icons"));

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

// ---------- icons: emerald rounded square with a white shield-check ----------

function writeIcons(dir) {
  for (const size of [16, 32, 48, 128]) writeFileSync(join(dir, `icon-${size}.png`), png(size, drawIcon(size)));
}

function drawIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const segDist = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };
  const stroke = 0.075;
  // Shield outline + check mark, in unit coordinates.
  const shield = [[0.5, 0.2], [0.74, 0.29], [0.72, 0.55], [0.5, 0.8], [0.28, 0.55], [0.26, 0.29], [0.5, 0.2]];
  const check = [[0.39, 0.5], [0.47, 0.58], [0.62, 0.42]];
  const polyDist = (x, y, pts) => Math.min(...pts.slice(1).map((p, i) => segDist(x, y, pts[i][0], pts[i][1], p[0], p[1])));

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size, y = (j + 0.5) / size;
      // Rounded-square background (signed distance).
      const r = 0.22, qx = Math.abs(x - 0.5) - (0.5 - r), qy = Math.abs(y - 0.5) - (0.5 - r);
      const bg = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      const bgA = clamp(0.5 - bg * size);
      const d = Math.min(polyDist(x, y, shield), polyDist(x, y, check)) - stroke / 2;
      const fg = clamp(0.5 - d * size);
      const o = (j * size + i) * 4;
      px[o] = Math.round(5 + (255 - 5) * fg); // #059669 → white
      px[o + 1] = Math.round(150 + (255 - 150) * fg);
      px[o + 2] = Math.round(105 + (255 - 105) * fg);
      px[o + 3] = Math.round(255 * bgA);
    }
  }
  return px;
}

function png(size, rgba) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
