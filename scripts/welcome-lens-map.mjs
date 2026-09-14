// Generates the displacement map used by the liquid glass panel on /welcome.
// R = horizontal displacement, G = vertical displacement, 128 = no displacement.
// The map is a rounded-rectangle "lens": neutral in the middle, bending
// outward along the edge so the refraction reads as a thick glass rim.
//
// Usage: node scripts/welcome-lens-map.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const W = 360;
const H = 240;
const RADIUS = 34; // matches the panel corner radius in px at map scale
const RIM = 46; // rim thickness where refraction happens
const OUT = "public/welcome/lens-map.png";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Signed distance from a point to a rounded rectangle centered at the origin.
function sdRoundedRect(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

const buf = Buffer.alloc(W * H * 4);
const hw = W / 2;
const hh = H / 2;
const EPS = 0.5;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const px = x + 0.5 - hw;
    const py = y + 0.5 - hh;
    const d = sdRoundedRect(px, py, hw, hh, RADIUS); // negative inside
    // Normal of the SDF via central differences.
    const nx =
      sdRoundedRect(px + EPS, py, hw, hh, RADIUS) -
      sdRoundedRect(px - EPS, py, hw, hh, RADIUS);
    const ny =
      sdRoundedRect(px, py + EPS, hw, hh, RADIUS) -
      sdRoundedRect(px, py - EPS, hw, hh, RADIUS);
    const len = Math.hypot(nx, ny) || 1;
    // Strength rises toward the rim, eased so the center stays still.
    const inside = -d; // distance from the edge, positive inside
    const f = 1 - smoothstep(0, RIM, inside);
    const strength = f * f; // sharper toward the very edge, like a thick lens
    const dx = (nx / len) * strength;
    const dy = (ny / len) * strength;
    const i = (y * W + x) * 4;
    buf[i] = Math.round(128 - dx * 127);
    buf[i + 1] = Math.round(128 - dy * 127);
    buf[i + 2] = 128;
    buf[i + 3] = 255;
  }
}

await mkdir("public/welcome", { recursive: true });
await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);
process.stdout.write(`wrote ${OUT} (${W}x${H})\n`);
