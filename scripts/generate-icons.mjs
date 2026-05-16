import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceIcon = path.join(rootDir, "src/assets/app-logo.png");
const buildDir = path.join(rootDir, "build");
const publicDir = path.join(rootDir, "public");
const iconsetDir = path.join(buildDir, "icon.iconset");
const masterIcon = path.join(buildDir, "icon.png");
const macIcon = path.join(buildDir, "icon.icns");
const winIcon = path.join(buildDir, "icon.ico");

const iconsetSizes = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

const icoSizes = [16, 32, 48, 64, 128, 256];
const icnsTypesBySize = new Map([
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"],
]);

function resizePng(input, output, size) {
  execFileSync("sips", ["-z", String(size), String(size), input, "--out", output], {
    stdio: "ignore",
  });
}

function createIco(pngPaths, output) {
  const images = pngPaths.map((pngPath) => {
    const size = Number(path.basename(pngPath, ".png"));
    return {
      size,
      bytes: readFileSync(pngPath),
    };
  });

  const headerSize = 6;
  const directorySize = images.length * 16;
  let imageOffset = headerSize + directorySize;
  const directory = Buffer.alloc(directorySize);

  images.forEach((image, index) => {
    const offset = index * 16;
    directory.writeUInt8(image.size === 256 ? 0 : image.size, offset);
    directory.writeUInt8(image.size === 256 ? 0 : image.size, offset + 1);
    directory.writeUInt8(0, offset + 2);
    directory.writeUInt8(0, offset + 3);
    directory.writeUInt16LE(1, offset + 4);
    directory.writeUInt16LE(32, offset + 6);
    directory.writeUInt32LE(image.bytes.length, offset + 8);
    directory.writeUInt32LE(imageOffset, offset + 12);
    imageOffset += image.bytes.length;
  });

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  writeFileSync(output, Buffer.concat([header, directory, ...images.map((image) => image.bytes)]));
}

function createIcns(pngEntries, output) {
  const chunks = pngEntries.map(({ size, pngPath }) => {
    const type = icnsTypesBySize.get(size);
    if (!type) {
      throw new Error(`Unsupported ICNS size: ${size}`);
    }

    const data = readFileSync(pngPath);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([header, data]);
  });

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 8);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, 4, "ascii");
  fileHeader.writeUInt32BE(totalLength, 4);
  writeFileSync(output, Buffer.concat([fileHeader, ...chunks]));
}

if (!existsSync(sourceIcon)) {
  throw new Error(`Source icon not found: ${sourceIcon}`);
}

mkdirSync(buildDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });
rmSync(iconsetDir, { recursive: true, force: true });
mkdirSync(iconsetDir, { recursive: true });

resizePng(sourceIcon, masterIcon, 1024);

for (const [fileName, size] of iconsetSizes) {
  resizePng(masterIcon, path.join(iconsetDir, fileName), size);
}

const icnsPngs = [
  { size: 16, fileName: "icon_16x16.png" },
  { size: 32, fileName: "icon_32x32.png" },
  { size: 64, fileName: "icon_32x32@2x.png" },
  { size: 128, fileName: "icon_128x128.png" },
  { size: 256, fileName: "icon_256x256.png" },
  { size: 512, fileName: "icon_512x512.png" },
  { size: 1024, fileName: "icon_512x512@2x.png" },
].map(({ size, fileName }) => ({
  size,
  pngPath: path.join(iconsetDir, fileName),
}));
createIcns(icnsPngs, macIcon);

const icoTempDir = path.join(buildDir, "ico-sizes");
rmSync(icoTempDir, { recursive: true, force: true });
mkdirSync(icoTempDir, { recursive: true });

const icoPngs = icoSizes.map((size) => {
  const output = path.join(icoTempDir, `${size}.png`);
  resizePng(masterIcon, output, size);
  return output;
});

createIco(icoPngs, winIcon);
rmSync(icoTempDir, { recursive: true, force: true });

copyFileSync(winIcon, path.join(publicDir, "favicon.ico"));
resizePng(masterIcon, path.join(publicDir, "favicon-16x16.png"), 16);
resizePng(masterIcon, path.join(publicDir, "favicon-32x32.png"), 32);
resizePng(masterIcon, path.join(publicDir, "apple-touch-icon.png"), 180);
resizePng(masterIcon, path.join(publicDir, "icon-192.png"), 192);
resizePng(masterIcon, path.join(publicDir, "icon-512.png"), 512);

console.log("Generated platform icons:");
console.log(`- ${path.relative(rootDir, masterIcon)}`);
console.log(`- ${path.relative(rootDir, macIcon)}`);
console.log(`- ${path.relative(rootDir, winIcon)}`);
console.log("Generated web icons:");
console.log("- public/favicon.ico");
console.log("- public/apple-touch-icon.png");
console.log("- public/icon-192.png");
console.log("- public/icon-512.png");
