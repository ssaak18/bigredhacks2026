#!/usr/bin/env node

import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { pipeline, RawImage } from "@huggingface/transformers";
import { findCurvatureCandidates } from "../src/foreground/vision/curvature.js";
import { mergeCandidates, scoreCandidates } from "../src/foreground/vision/scoring.js";
import { createConstellationEdges, selectRepresentativePoints } from "../src/foreground/vision/selectPoints.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const targetPoints = 9;

const sourceColor = { semantic: "#83efff", curvature: "#ffbd75", corner: "#d6adff" };

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findImages(entryPath);
    return supportedExtensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
  }));
  return nested.flat();
}

async function loadImageForInference(file) {
  const { data, info } = await sharp(file)
    .rotate()
    .resize({ width: 896, height: 896, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 4);
}

function maskToBinary(mask) {
  const channels = mask.channels || Math.max(1, Math.round(mask.data.length / (mask.width * mask.height)));
  const binary = new Uint8Array(mask.width * mask.height);
  for (let index = 0; index < binary.length; index += 1) {
    const value = mask.data[index * channels + (channels === 4 ? 3 : 0)] || 0;
    binary[index] = value > 24 ? 1 : 0;
  }
  return binary;
}

function primarySubjectScore(mask, confidence) {
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    area += 1;
    sumX += index % mask.width;
    sumY += Math.floor(index / mask.width);
  }
  if (!area) return 0;
  const areaScore = Math.min(1, area / (mask.width * mask.height * 0.22));
  const centerX = sumX / area / mask.width;
  const centerY = sumY / area / mask.height;
  const centerBias = 0.55 + 0.45 * (1 - Math.min(1, Math.hypot(centerX - 0.5, centerY - 0.5) / Math.SQRT1_2));
  return (confidence ?? 0.5) * areaScore * centerBias;
}

/** Gets the largest connected component and a compact, ordered boundary. */
function traceSilhouette(binary, width, height) {
  const seen = new Uint8Array(binary.length);
  let largest = [];
  const adjacent = [-1, 0, 1, 0, -1];
  for (let start = 0; start < binary.length; start += 1) {
    if (!binary[start] || seen[start]) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (let step = 0; step < 4; step += 1) {
        const nextX = x + adjacent[step];
        const nextY = y + adjacent[step + 1];
        const nextIndex = nextY * width + nextX;
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height && binary[nextIndex] && !seen[nextIndex]) {
          seen[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length < 24) return [];

  let sumX = 0;
  let sumY = 0;
  const boundary = largest.filter((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    sumX += x; sumY += y;
    return x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
      !binary[index - 1] || !binary[index + 1] || !binary[index - width] || !binary[index + width];
  });
  const center = { x: sumX / largest.length, y: sumY / largest.length };
  // A polar ordering is a compact fallback for Node, where browser OpenCV is unavailable.
  const ordered = boundary.sort((a, b) => {
    const angleA = Math.atan2(Math.floor(a / width) - center.y, a % width - center.x);
    const angleB = Math.atan2(Math.floor(b / width) - center.y, b % width - center.x);
    return angleA - angleB;
  });
  const stride = Math.max(1, Math.ceil(ordered.length / 720));
  return ordered.filter((_, index) => index % stride === 0).map((index) => ({
    x: (index % width) / width,
    y: Math.floor(index / width) / height,
  }));
}

function createCornerCandidates(contour) {
  const count = Math.min(24, Math.max(8, Math.floor(contour.length / 12)));
  const stride = Math.max(1, Math.floor(contour.length / count));
  return contour.filter((_, index) => index % stride === 0).slice(0, 30).map((point) => ({
    ...point, source: "corner", semanticScore: 0, curvatureScore: 0.28,
    preservationScore: 0.5, spacingScore: 0, distinctivenessScore: 0.3, totalScore: 0,
  }));
}

function makeOverlaySvg(width, height, points, edges) {
  const lines = edges.map(([from, to]) => `<line x1="${points[from].x * width}" y1="${points[from].y * height}" x2="${points[to].x * width}" y2="${points[to].y * height}" />`).join("");
  const dots = points.map((point) => {
    const x = point.x * width;
    const y = point.y * height;
    const color = sourceColor[point.source] || "#f5f9ff";
    return `<circle cx="${x}" cy="${y}" r="11" fill="${color}" fill-opacity=".28"/><circle cx="${x}" cy="${y}" r="4.5" fill="#f5f9ff" stroke="${color}" stroke-width="3"/>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g stroke="#b9d2ff" stroke-width="3" stroke-linecap="round" opacity=".85">${lines}</g>${dots}</svg>`);
}

async function createSegmenter() {
  console.log("Loading the local segmentation model (first run downloads and caches it)…");
  return pipeline("image-segmentation", "Xenova/segformer-b0-finetuned-ade-512-512", {
    device: "cpu",
    dtype: "q8",
    progress_callback: ({ status, progress }) => {
      if (status === "progress" && Number.isFinite(progress)) process.stdout.write(`\rModel download: ${Math.round(progress)}%`);
    },
  });
}

async function annotateImage(segmenter, inputFile, outputFile) {
  const inferenceImage = await loadImageForInference(inputFile);
  const segments = await segmenter(inferenceImage, { subtask: "semantic" });
  const primary = segments.map((segment) => {
    const binary = maskToBinary(segment.mask);
    binary.width = segment.mask.width;
    binary.height = segment.mask.height;
    return { segment, binary, score: primarySubjectScore(binary, segment.score) };
  }).sort((a, b) => b.score - a.score)[0];
  if (!primary?.score) throw new Error("No usable foreground segment was found.");

  const contour = traceSilhouette(primary.binary, primary.binary.width, primary.binary.height);
  if (contour.length < 8) throw new Error("The selected segment did not have a usable silhouette.");
  const curvature = findCurvatureCandidates(contour);
  const candidates = scoreCandidates(mergeCandidates([...curvature, ...createCornerCandidates(contour)]), contour);
  const points = selectRepresentativePoints(candidates, { target: targetPoints });
  if (points.length < 2) throw new Error("Too few distinct points were found.");
  const edges = createConstellationEdges(points);

  const original = sharp(inputFile).rotate();
  const metadata = await original.metadata();
  await original.composite([{ input: makeOverlaySvg(metadata.width, metadata.height, points, edges), top: 0, left: 0 }]).png().toFile(outputFile);
  return { points: points.length, label: primary.segment.label || "subject" };
}

const inputDirectory = path.resolve(projectRoot, process.argv[2] || "test_images");
const outputDirectory = path.resolve(projectRoot, process.argv[3] || "test_images/output");
const images = await findImages(inputDirectory);
if (!images.length) throw new Error(`No JPG, PNG, or WebP files found in ${inputDirectory}.`);
await mkdir(outputDirectory, { recursive: true });
const segmenter = await createSegmenter();
console.log("");

let failures = 0;
for (const inputFile of images) {
  const relative = path.relative(inputDirectory, inputFile);
  const outputFile = path.join(outputDirectory, `${relative.replace(/\.[^.]+$/, "")}.constellation.png`);
  await mkdir(path.dirname(outputFile), { recursive: true });
  try {
    const result = await annotateImage(segmenter, inputFile, outputFile);
    console.log(`✓ ${relative}: ${result.points} points (${result.label}) → ${path.relative(projectRoot, outputFile)}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${relative}: ${error.message}`);
  }
}

if (failures) process.exitCode = 1;
