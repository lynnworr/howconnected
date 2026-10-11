import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const EXTENSION_ICON_SIZES = [16, 32, 48, 128];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ICON_DIR = path.join(PROJECT_ROOT, "extension", "icons");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function insideRoundedSquare(x, y) {
  const margin = 0.055;
  const radius = 0.23;
  if (x < margin || x > 1 - margin || y < margin || y > 1 - margin) return false;
  const cx = Math.min(Math.max(x, margin + radius), 1 - margin - radius);
  const cy = Math.min(Math.max(y, margin + radius), 1 - margin - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function composite(base, overlay) {
  const alpha = overlay[3];
  const outAlpha = alpha + base[3] * (1 - alpha);
  if (outAlpha === 0) return [0, 0, 0, 0];
  return [
    (overlay[0] * alpha + base[0] * base[3] * (1 - alpha)) / outAlpha,
    (overlay[1] * alpha + base[1] * base[3] * (1 - alpha)) / outAlpha,
    (overlay[2] * alpha + base[2] * base[3] * (1 - alpha)) / outAlpha,
    outAlpha,
  ];
}

function sampleIcon(x, y) {
  if (!insideRoundedSquare(x, y)) return [0, 0, 0, 0];

  const glow = Math.max(0, 1 - Math.hypot(x - 0.25, y - 0.18) / 0.72);
  let color = [14 + 10 * glow, 20 + 12 * glow, 30 + 18 * glow, 1];
  const start = [0.29, 0.63];
  const end = [0.71, 0.37];
  const lineDistance = distanceToSegment(x, y, ...start, ...end);

  if (lineDistance <= 0.047) color = composite(color, [235, 241, 247, 0.82]);
  if (Math.hypot(x - start[0], y - start[1]) <= 0.19) {
    color = composite(color, [255, 104, 70, 0.13]);
  }
  if (Math.hypot(x - end[0], y - end[1]) <= 0.19) {
    color = composite(color, [66, 173, 141, 0.12]);
  }
  if (Math.hypot(x - start[0], y - start[1]) <= 0.125) color = [255, 104, 70, 1];
  if (Math.hypot(x - end[0], y - end[1]) <= 0.125) color = [66, 193, 158, 1];

  return color;
}

export function createExtensionIconPng(size) {
  if (!EXTENSION_ICON_SIZES.includes(size)) throw new TypeError(`Unsupported icon size: ${size}`);
  const samples = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const color = sampleIcon(
            (x + (sx + 0.5) / samples) / size,
            (y + (sy + 0.5) / samples) / size,
          );
          totals[0] += color[0] * color[3];
          totals[1] += color[1] * color[3];
          totals[2] += color[2] * color[3];
          totals[3] += color[3];
        }
      }
      const alpha = totals[3] / (samples * samples);
      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = alpha ? Math.round(totals[0] / totals[3]) : 0;
      raw[pixelOffset + 1] = alpha ? Math.round(totals[1] / totals[3]) : 0;
      raw[pixelOffset + 2] = alpha ? Math.round(totals[2] / totals[3]) : 0;
      raw[pixelOffset + 3] = Math.round(alpha * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function generateExtensionIcons() {
  await mkdir(ICON_DIR, { recursive: true });
  await Promise.all(
    EXTENSION_ICON_SIZES.map((size) =>
      writeFile(path.join(ICON_DIR, `icon-${size}.png`), createExtensionIconPng(size)),
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateExtensionIcons();
  console.log(`Generated ${EXTENSION_ICON_SIZES.length} extension icons in ${ICON_DIR}`);
}
