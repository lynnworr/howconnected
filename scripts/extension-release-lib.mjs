import { createHash } from "node:crypto";

export const EXTENSION_RUNTIME_FILES = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "core.mjs",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

const REQUIRED_ICON_SIZES = [16, 32, 48, 128];
const FORBIDDEN_MANIFEST_KEYS = ["background", "content_scripts", "externally_connectable", "optional_permissions"];

export function validateExtensionManifest(manifest) {
  const errors = [];
  if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) errors.push("version must use three numeric components");
  if (manifest.permissions !== undefined) errors.push("release must not request API permissions");
  if (JSON.stringify(manifest.host_permissions) !== JSON.stringify([
    "https://en.wikipedia.org/*",
    "https://www.howconnected.app/*",
  ])) errors.push("host permissions must remain limited to Wikipedia and HowConnected");
  for (const key of FORBIDDEN_MANIFEST_KEYS) {
    if (manifest[key] !== undefined) errors.push(`${key} is not allowed in the release manifest`);
  }
  for (const size of REQUIRED_ICON_SIZES) {
    const expected = `icons/icon-${size}.png`;
    if (manifest.icons?.[size] !== expected) errors.push(`missing ${size}px extension icon`);
    if (manifest.action?.default_icon?.[size] !== expected) errors.push(`missing ${size}px action icon`);
  }
  if (manifest.action?.default_popup !== "popup.html") errors.push("popup.html must remain the action popup");
  return errors;
}

export function readPngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createDeterministicZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of [...files].sort((left, right) => left.name.localeCompare(right.name))) {
    const normalizedName = name.replaceAll("\\", "/");
    const nameBuffer = Buffer.from(normalizedName, "utf8");
    const contents = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x5021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(contents.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, contents);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(contents.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + contents.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
