#!/usr/bin/env node
/**
 * Runs the real constellation pipeline over a folder of photos and writes each
 * photo back with its constellation drawn on top.
 *
 *   npm run test:images -- [--points 18] [--tap 0.5,0.6] [inputDir=test_images] [outputDir=test_images/output]
 *
 * --tap x,y (fractions of the photo) picks the subject under that point, like
 * tapping it in the app.
 */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { INFERENCE_SIZE, POINT_COUNT } from "../src/foreground/vision/config.js";
import { analyzeImage } from "../src/foreground/vision/analyze.js";
import { buildConstellation } from "../src/foreground/vision/constellation.js";
import { createModels } from "../src/foreground/vision/models.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const colors = { part: "#83efff", outline: "#ffffff", corner: "#d6adff" };

const args = process.argv.slice(2);
const flag = args.indexOf("--points");
const pointCount = flag >= 0 ? Number(args.splice(flag, 2)[1]) : POINT_COUNT.default;
const tapFlag = args.indexOf("--tap");
const [tapX, tapY] = tapFlag >= 0 ? args.splice(tapFlag, 2)[1].split(",").map(Number) : [];
const tap = tapFlag >= 0 ? { x: tapX, y: tapY } : undefined;
const inputDirectory = path.resolve(projectRoot, args[0] || "test_images");
const outputDirectory = path.resolve(projectRoot, args[1] || "test_images/output");

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === path.basename(outputDirectory) ? [] : findImages(full);
    return extensions.has(path.extname(entry.name).toLowerCase()) ? [full] : [];
  }));
  return nested.flat();
}

function overlaySvg(width, height, constellation) {
  const byId = new Map(constellation.points.map((point) => [point.id, point]));
  const px = (point) => `x="${point.x * width}" y="${point.y * height}"`;
  const lines = constellation.lines.map(({ from, to }) => {
    const a = byId.get(from);
    const b = byId.get(to);
    return `<line x1="${a.x * width}" y1="${a.y * height}" x2="${b.x * width}" y2="${b.y * height}"/>`;
  }).join("");
  const dots = constellation.points.map((point) => {
    const cx = point.x * width;
    const cy = point.y * height;
    const label = point.part ? `<text ${px({ x: point.x + 0.012, y: point.y - 0.012 })} fill="#83efff" font-size="${height * 0.03}" font-family="sans-serif">${point.part}</text>` : "";
    return `<circle cx="${cx}" cy="${cy}" r="${height * 0.02}" fill="${colors[point.kind]}" fill-opacity=".3"/><circle cx="${cx}" cy="${cy}" r="${height * 0.007}" fill="${colors[point.kind]}"/>${label}`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g stroke="#ffe08a" stroke-width="${height * 0.004}" stroke-linecap="round" opacity=".9">${lines}</g>${dots}</svg>`);
}

const images = await findImages(inputDirectory);
if (!images.length) throw new Error(`No JPG, PNG or WebP files found in ${inputDirectory}.`);
await mkdir(outputDirectory, { recursive: true });

const models = createModels({
  device: "cpu",
  onProgress: (message) => process.stdout.write(`\r${message}      `),
});

let failures = 0;
for (const file of images) {
  const name = path.relative(inputDirectory, file);
  try {
    const { data, info } = await sharp(file)
      .rotate()
      .resize({ width: INFERENCE_SIZE, height: INFERENCE_SIZE, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };

    const started = performance.now();
    const analysis = await analyzeImage(image, models, undefined, { point: tap, photoKey: name });
    const constellation = buildConstellation(analysis, pointCount);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);

    const output = path.join(outputDirectory, `${path.parse(name).name}.constellation.png`);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .composite([{ input: overlaySvg(info.width, info.height, constellation) }])
      .png()
      .toFile(output);

    const parts = constellation.points.filter((point) => point.part).map((point) => point.part).join(", ");
    console.log(`\n✓ ${name}: ${analysis.label}, ${constellation.points.length} points, ${constellation.lines.length} lines in ${seconds}s${parts ? ` [${parts}]` : ""}`);
    const { score, reason } = analysis.confidence;
    console.log(`  subject confidence ${score.toFixed(2)}${reason ? ` - ${reason}` : ``}`);
    if (analysis.warning) console.warn(`  ! ${analysis.warning}`);
  } catch (error) {
    failures += 1;
    console.error(`\n✗ ${name}: ${error.stack || error.message}`);
  }
}
process.exitCode = failures ? 1 : 0;
