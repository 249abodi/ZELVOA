import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/app/icon.svg");
const mark = readFileSync(source, "utf8");
const markBase64 = Buffer.from(mark).toString("base64");

const fontCandidates = [
  "C:/Windows/Fonts/segoeuib.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];
const fontPath = fontCandidates.find((p) => {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
});
if (!fontPath) throw new Error("No bold TTF font found for brand asset generation");
const fontBase64 = readFileSync(fontPath).toString("base64");

const obj = (f) => "url(#" + f + ")";

/**
 * MarkSvg renders the approved mark (exact geometry) at the given x/y within a
 * viewBox of dimensions w x h. Geometry is copied verbatim from src/app/icon.svg.
 */
function markSvg(inner) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${inner.w} ${inner.h}" fill="none">` +
    `<defs><linearGradient id="zag" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">` +
    `<stop stop-color="#7c63f7"/><stop offset="1" stop-color="#2563eb"/>` +
    `</linearGradient></defs>` +
    `<rect x="${inner.x}" y="${inner.y}" width="${inner.s}" height="${inner.s}" rx="${(inner.s * 8) / 32}" fill="${obj("zag")}"/>` +
    `<path d="M${inner.x + (inner.s * 10) / 32} ${inner.y + (inner.s * 9) / 32}h${(inner.s * 12) / 32}` +
    `l-${(inner.s * 12) / 32} ${(inner.s * 14) / 32}h${(inner.s * 12) / 32}"` +
    ` stroke="white" stroke-width="${(inner.s * 2.6) / 32}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

function brandSvg({ w, h, mark: m, markWordmarkFill, taglineFill, bg }) {
  const fontFace = `<style>@font-face{font-family:Zelvoa;src:url(data:font/ttf;base64,${fontBase64}) format("truetype")}</style>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    fontFace +
    bg +
    m +
    `<text x="${m.x + m.s * 2}" y="${Math.round(h * 0.56)}" font-family="Zelvoa" font-size="${Math.round(w * 0.0625)}" ` +
    `font-weight="700" fill="${markWordmarkFill}" letter-spacing="2">ZELVOA</text>` +
    `<text x="${m.x + m.s * 2}" y="${Math.round(h * 0.68)}" font-family="Zelvoa" font-size="${Math.round(w * 0.02)}" ` +
    `font-weight="400" fill="${taglineFill}">Create. Schedule. Grow.</text>` +
    `</svg>`
  );
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

const out = (name) => resolve(root, name);
const brandDir = out("public/brand");

ensureDir(out("src/app"));
ensureDir(brandDir);

copyFileSync(source, resolve(brandDir, "logo-mark.svg"));

const iconSizes = [
  { size: 180, file: out("src/app/apple-icon.png") },
  { size: 192, file: out("src/app/icon-192.png") },
  { size: 512, file: out("src/app/icon-512.png") },
];

await Promise.all(
  iconSizes.map(async ({ size, file }) => {
    await sharp(Buffer.from(mark)).resize(size, size).png().toFile(file);
  })
);

await Promise.all([
  sharp(Buffer.from(mark)).resize(512, 512).png().toFile(out("public/brand/app-icon.png")),
  sharp(Buffer.from(mark)).resize(400, 400).png().toFile(out("public/brand/social-avatar.png")),
]);
writeFileSync(out("public/brand/favicon.svg"), mark);

const primaryMark = markSvg({ w: 560, h: 260, x: 40, y: 50, s: 160 });
const primary = brandSvg({
  w: 560,
  h: 260,
  mark: primaryMark,
  markWordmarkFill: "#1e2536",
  taglineFill: "#616c82",
  bg: `<rect width="560" height="260" fill="white"/>`,
});
writeFileSync(out("public/brand/logo-primary.svg"), primary);

const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 120"><style>@font-face{font-family:Zelvoa;src:url(data:font/ttf;base64,${fontBase64}) format("truetype")}</style><rect width="560" height="120" fill="white"/><text x="0" y="72" font-family="Zelvoa" font-size="48" font-weight="700" fill="#1e2536" letter-spacing="2">ZELVOA</text></svg>`;
writeFileSync(out("public/brand/logo-wordmark.svg"), wordmark);

const lightMark = markSvg({ w: 560, h: 260, x: 40, y: 50, s: 160 });
const light = brandSvg({
  w: 560,
  h: 260,
  mark: lightMark,
  markWordmarkFill: "#ffffff",
  taglineFill: "rgba(255,255,255,0.85)",
  bg: `<rect width="560" height="260" fill="#0b0e14"/>`,
});
writeFileSync(out("public/brand/logo-light.svg"), light);

writeFileSync(out("public/brand/logo-dark.svg"), primary);

const ogCard = () =>
  brandSvg({
    w: 1200,
    h: 630,
    mark: markSvg({ w: 1200, h: 630, x: 92, y: 118, s: 168 }),
    markWordmarkFill: "#ffffff",
    taglineFill: "rgba(255,255,255,0.85)",
    bg:
      `<rect width="1200" height="630" fill="#6d28d9"/>` +
      `<rect width="1200" height="630" fill="url(#bg-grad)"/>` +
      `<defs><linearGradient id="bg-grad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">` +
      `<stop stop-color="#7c63f7"/><stop offset="1" stop-color="#2563eb"/>` +
      `</linearGradient></defs>`,
  });

await sharp(Buffer.from(ogCard())).png().toFile(out("src/app/opengraph-image.png"));
copyFileSync(out("src/app/opengraph-image.png"), out("src/app/twitter-image.png"));

console.log("Generated brand assets from", markBase64.length > 0 ? source : "unknown");
console.log("- public/brand/logo-mark.svg (verbatim copy)");
console.log("- public/brand/logo-primary.svg, logo-wordmark.svg, logo-light.svg, logo-dark.svg");
console.log("- public/brand/app-icon.png, social-avatar.png, favicon.svg");
console.log("- src/app/apple-icon.png, icon-192.png, icon-512.png");
console.log("- src/app/opengraph-image.png, twitter-image.png");
console.log("Font:", fontPath);