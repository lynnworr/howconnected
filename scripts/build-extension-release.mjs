import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateExtensionIcons } from "./generate-extension-icons.mjs";
import {
  EXTENSION_RUNTIME_FILES,
  createDeterministicZip,
  readPngDimensions,
  sha256,
  validateExtensionManifest,
} from "./extension-release-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const EXTENSION_DIR = path.join(PROJECT_ROOT, "extension");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");

await generateExtensionIcons();

const manifest = JSON.parse(await readFile(path.join(EXTENSION_DIR, "manifest.json"), "utf8"));
const errors = validateExtensionManifest(manifest);
const files = await Promise.all(
  EXTENSION_RUNTIME_FILES.map(async (name) => ({
    name,
    data: await readFile(path.join(EXTENSION_DIR, ...name.split("/"))),
  })),
);

for (const size of [16, 32, 48, 128]) {
  const icon = files.find(({ name }) => name === `icons/icon-${size}.png`);
  const dimensions = icon ? readPngDimensions(icon.data) : null;
  if (dimensions?.width !== size || dimensions?.height !== size) errors.push(`icon-${size}.png has invalid dimensions`);
}

const sourceText = files
  .filter(({ name }) => /\.(?:html|js|mjs|json|css)$/.test(name))
  .map(({ data }) => data.toString("utf8"))
  .join("\n");
for (const forbidden of [/\.env/i, /NEO4J_(?:URI|USERNAME|PASSWORD)/, /RESEND_API_KEY/, /UPSTASH_/]) {
  if (forbidden.test(sourceText)) errors.push(`release contains forbidden pattern ${forbidden}`);
}
if (/<script[^>]+src=["']https?:/i.test(sourceText)) errors.push("release contains remotely hosted executable code");
if (errors.length) throw new Error(`Extension release validation failed:\n- ${errors.join("\n- ")}`);

const archive = createDeterministicZip(files);
const archiveName = `howconnected-extension-${manifest.version}.zip`;
const checksum = sha256(archive);
const checksumName = `${archiveName}.sha256`;
await mkdir(DIST_DIR, { recursive: true });
await writeFile(path.join(DIST_DIR, archiveName), archive);
await writeFile(path.join(DIST_DIR, checksumName), `${checksum}  ${archiveName}\n`, "utf8");
console.log(JSON.stringify({
  archive: path.join(DIST_DIR, archiveName),
  checksumFile: path.join(DIST_DIR, checksumName),
  version: manifest.version,
  files: files.map(({ name }) => name),
  bytes: archive.length,
  sha256: checksum,
}, null, 2));
