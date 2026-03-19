/**
 * Generate icon candidates as PNG files using Node.js built-in modules.
 * Usage: node scripts/generate-icons.mjs
 * Output: scripts/icon-candidates/ directory
 */
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "icon-candidates");
mkdirSync(outDir, { recursive: true });

// Background color: #5B8DBD (matching current icon's blue)
const BG = [91, 141, 189];
const WHITE = [255, 255, 255];
const DARK = [50, 80, 120]; // darker accent
const GRAY = [200, 215, 230]; // window/highlight color

/**
 * Create a minimal PNG from pixel data.
 * @param {number} width
 * @param {number} height
 * @param {number[][][]} pixels - [row][col] = [r, g, b]
 */
function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw image data with filter byte 0 per row
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3);
    raw[offset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const px = pixels[y][x];
      const pxOffset = offset + 1 + x * 3;
      raw[pxOffset] = px[0];
      raw[pxOffset + 1] = px[1];
      raw[pxOffset + 2] = px[2];
    }
  }
  const compressed = deflateSync(raw);

  // IEND
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    iend,
  ]);
}

/**
 * Scale up pixel art to target size
 */
function scaleUp(grid, gridSize, targetSize) {
  const scale = targetSize / gridSize;
  const pixels = [];
  for (let y = 0; y < targetSize; y++) {
    const row = [];
    for (let x = 0; x < targetSize; x++) {
      const gy = Math.floor(y / scale);
      const gx = Math.floor(x / scale);
      row.push(grid[gy][gx]);
    }
    pixels.push(row);
  }
  return pixels;
}

/**
 * Convert a string grid to pixel colors.
 * Characters: '.' = BG, '#' = WHITE, 'D' = DARK, 'G' = GRAY
 */
function parseGrid(lines) {
  return lines.map((line) =>
    line.split("").map((ch) => {
      switch (ch) {
        case "#":
          return WHITE;
        case "D":
          return DARK;
        case "G":
          return GRAY;
        default:
          return BG;
      }
    }),
  );
}

// ============================================================
// Design 1: "A-Bus Hybrid" — Letter A with bus wheels & headlights
// The A has rounded legs that end in wheels, giving a vehicle feel
// ============================================================
const design1 = parseGrid([
  //0123456789012345
  "................", // 0
  "......####......", // 1
  ".....######.....", // 2
  "....##....##....", // 3
  "...##......##...", // 4
  "...##......##...", // 5
  "...##########...", // 6
  "...##......##...", // 7
  "...##......##...", // 8
  "...##......##...", // 9
  "...##......##...", // 10
  "..####....####..", // 11
  "..#DD#....#DD#..", // 12
  "..####....####..", // 13
  "................", // 14
  "................", // 15
]);

// ============================================================
// Design 2: "Bus-front A" — Front-facing bus, with A in destination sign
// ============================================================
const design2 = parseGrid([
  //0123456789012345
  "................", // 0
  "....########....", // 1  destination sign area
  "....#.D##D.#....", // 2  "A" in sign
  "....#.#..#.#....", // 3
  "....########....", // 4
  "...############.", // 5  bus body top
  "...#GGGG#GGGG#..", // 6  windshield (two panes)
  "...#GGGG#GGGG#..", // 7
  "...############.", // 8
  "...#..........#.", // 9  bus body
  "...#DD#....#DD#.", // 10 headlights
  "...############.", // 11
  "...#..........#.", // 12
  "..D##D......D##D", // 13 wheels
  "..D##D......D##D", // 14
  "................", // 15
]);

// ============================================================
// Design 3: "A rides the bus" — Stylized A sitting on top of a bus
// Compact A on top, small bus silhouette below
// ============================================================
const design3 = parseGrid([
  //0123456789012345
  "................", // 0
  ".......##.......", // 1
  "......####......", // 2
  ".....##..##.....", // 3
  ".....######.....", // 4
  ".....##..##.....", // 5
  ".....##..##.....", // 6
  "................", // 7
  "..##############", // 8  bus roof
  "..#GGGG#GGGG#.#.", // 9  bus windows
  "..#GGGG#GGGG#.#.", // 10
  "..##############", // 11
  "..#............#", // 12
  "..D##D....D##D..", // 13 wheels
  "..D##D....D##D..", // 14
  "................", // 15
]);

// ============================================================
// Design 4: "Pixel A-Bus" — A formed from bus shape, more abstract
// The letter A's silhouette doubles as a bus front view
// ============================================================
const design4 = parseGrid([
  //0123456789012345
  "................", // 0
  ".....DDDDDD.....", // 1  roof rack / top
  "....D######D....", // 2  roof
  "....########....", // 3
  "...##......##...", // 4
  "...#GG....GG#...", // 5  headlights as eyes
  "...#GG....GG#...", // 6
  "...##########...", // 7  bumper = A crossbar
  "...##......##...", // 8
  "...##......##...", // 9
  "...##......##...", // 10
  "...##......##...", // 11
  "..D##D....D##D..", // 12 wheels
  "..D##D....D##D..", // 13
  "................", // 14
  "................", // 15
]);

// ============================================================
// Design 5: "Clean A with bus stop dot" — Minimal A with a bus-stop marker
// ============================================================
const design5 = parseGrid([
  //0123456789012345
  "................", // 0
  "......####......", // 1
  ".....##..##.....", // 2
  "....##....##....", // 3
  "....##....##....", // 4
  "....########....", // 5
  "....##....##....", // 6
  "....##....##....", // 7
  "....##....##....", // 8
  "................", // 9
  ".........#####..", // 10  small bus
  ".........#GGG#..", // 11
  ".........#####..", // 12
  "........D##.D##.", // 13
  "................", // 14
  "................", // 15
]);

// ============================================================
// Design 6: "A-shaped bus, side view" — Side bus where body forms an A
// ============================================================
const design6 = parseGrid([
  //0123456789012345
  "................", // 0
  "......##........", // 1  A peak / bus roof front
  ".....####.......", // 2
  "....##..##......", // 3
  "...##....######.", // 4  bus body extends right
  "...##....######.", // 5
  "...##########.#.", // 6  crossbar / window line
  "...#GG#GG#GG#.#.", // 7  windows
  "...#GG#GG#GG#.#.", // 8
  "...##########.#.", // 9
  "...############.", // 10
  "..D##D..D##D....", // 11  wheels
  "..D##D..D##D....", // 12
  "................", // 13
  "................", // 14
  "................", // 15
]);

const designs = [
  { name: "design1-a-bus-wheels", grid: design1, label: "A + Bus Wheels" },
  { name: "design2-bus-front-a", grid: design2, label: "Bus Front with A" },
  { name: "design3-a-rides-bus", grid: design3, label: "A on Bus" },
  {
    name: "design4-a-bus-face",
    grid: design4,
    label: "A-shaped Bus Front",
  },
  {
    name: "design5-a-with-mini-bus",
    grid: design5,
    label: "A + Mini Bus",
  },
  {
    name: "design6-a-bus-side",
    grid: design6,
    label: "A-shaped Side Bus",
  },
];

for (const { name, grid, label } of designs) {
  // Generate 512x512 version
  const pixels512 = scaleUp(grid, 16, 512);
  const png512 = createPNG(512, 512, pixels512);
  const path512 = join(outDir, `${name}-512.png`);
  writeFileSync(path512, png512);

  console.log(`Generated: ${path512} (${label})`);
}

// Also generate an HTML preview page
const htmlRows = designs
  .map(
    ({ name, label }) => `
  <div style="text-align:center; margin:20px;">
    <h3>${label}</h3>
    <img src="${name}-512.png" width="192" height="192" style="image-rendering:pixelated; border:1px solid #ccc; border-radius:16px;" />
  </div>
`,
  )
  .join("");

const html = `<!DOCTYPE html>
<html><head><title>Icon Candidates</title>
<style>body{font-family:sans-serif;background:#f5f5f5;display:flex;flex-wrap:wrap;justify-content:center;padding:20px;}
h1{width:100%;text-align:center;}
</style></head><body>
<h1>Athenai Icon Candidates - A + Bus</h1>
${htmlRows}
</body></html>`;

writeFileSync(join(outDir, "preview.html"), html);
console.log(`\nPreview page: ${join(outDir, "preview.html")}`);
