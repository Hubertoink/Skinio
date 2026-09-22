// Render exact authored pixel data, without resampling a photograph.
import fs from "node:fs";
import { deflateSync } from "node:zlib";
const target = new URL("../docs/examples/", import.meta.url);
const { rows, palette } = JSON.parse(
  fs.readFileSync(new URL("portrait-face.json", target)),
);
if (
  rows.length !== 8 ||
  rows.some((r) => r.length !== 8 || [...r].some((c) => !palette[c]))
)
  throw new Error("Invalid 8x8 face");
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}
for (const scale of [1, 64]) {
  const size = 8 * scale;
  const data = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = Buffer.from(
        palette[rows[Math.floor(y / scale)][Math.floor(x / scale)]].slice(1),
        "hex",
      );
      rgb.copy(data, y * (1 + size * 3) + 1 + x * 3);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  fs.writeFileSync(
    new URL(`portrait-face-${size}x${size}.png`, target),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(data)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
console.log("Authored face rendered: 8x8 PNG and exact 64x enlargement.");
