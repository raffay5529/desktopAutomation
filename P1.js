// paint.js - drawing engine + command list for agent-cmd.js
//
// The AI writes SHORT drawing commands (one per line, like "sun 700 90 60"),
// this file turns them into a PNG and opens it in Microsoft Paint.
// No extra npm packages needed. Everything here uses only built-in Node modules.
//
// Exports:
//   PAINT_HELP   - the full list of commands (the AI reads this before drawing)
//   drawPicture  - runs a script, saves the PNG, opens Paint
//
// Where pictures are saved: the TEMP folder. To save somewhere else, set the
// PAINT_DIR environment variable or change SAVE_DIR below.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { exec } from "node:child_process";

export const SAVE_DIR = process.env.PAINT_DIR || os.tmpdir();

// =====================================================================
// COLORS
// =====================================================================
const CSS_COLORS =
  "aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000000 blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dodgerblue:1e90ff firebrick:b22222 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc gold:ffd700 goldenrod:daa520 gray:808080 grey:808080 green:008000 greenyellow:adff2f hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgray:d3d3d3 lightgrey:d3d3d3 lightgreen:90ee90 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32";

const hex2rgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const NAMED = {};
for (const s of CSS_COLORS.split(" ")) {
  const [n, h] = s.split(":");
  NAMED[n] = hex2rgb(h);
}
Object.assign(NAMED, {
  skin: [248, 205, 165], skin2: [224, 172, 120], skin3: [141, 85, 36], darkbrown: [100, 62, 32],
  wood: [150, 100, 55], brick: [178, 80, 60], grass: [95, 185, 85], leaf: [60, 160, 70],
  sand: [237, 210, 150], cream: [255, 248, 225], rose: [255, 102, 153], mint: [152, 255, 200],
  blonde: [240, 205, 110], ginger: [210, 100, 40], glass: [170, 220, 250], water: [70, 150, 220],
  night: [10, 15, 50], sunyellow: [255, 205, 50], steel: [150, 160, 175], peach: [255, 190, 150],
});

const shade = (c, k) => {
  if (!c) return c;
  const t = k > 0 ? 255 : 0, f = Math.abs(k);
  return [c[0] + (t - c[0]) * f, c[1] + (t - c[1]) * f, c[2] + (t - c[2]) * f, c[3]];
};
const alpha = (c, a) => [c[0], c[1], c[2], a];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];

// "red", "#ff8800", "#ff880080", "255,128,0", "red+" (lighter), "red--" (much darker), "blue@0.4" (40% opaque)
function parseColor(tok) {
  if (tok === null || tok === undefined) return undefined;
  let s = String(tok).trim().toLowerCase();
  if (s === "none" || s === "transparent" || s === "") return null;
  let a = 1;
  const at = s.indexOf("@");
  if (at >= 0) {
    a = parseFloat(s.slice(at + 1));
    s = s.slice(0, at);
    if (!(a >= 0)) a = 1;
    if (a > 1) a = 1;
  }
  let adj = 0;
  while (s.endsWith("+") || s.endsWith("-")) {
    adj += s.endsWith("+") ? 1 : -1;
    s = s.slice(0, -1);
  }
  let rgb;
  if (s[0] === "#" || /^[0-9a-f]{6}([0-9a-f]{2})?$/.test(s)) {
    let h = s.replace("#", "");
    if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) throw new Error(`unknown color '${tok}'`);
    rgb = hex2rgb(h);
    if (h.length === 8) a = Math.min(a, parseInt(h.slice(6, 8), 16) / 255);
  } else if (s.includes(",")) {
    const p = s.split(",").map(Number);
    if (p.length < 3 || p.some((v) => Number.isNaN(v))) throw new Error(`unknown color '${tok}'`);
    rgb = p.slice(0, 3);
    if (p.length > 3) a = p[3] > 1 ? p[3] / 255 : p[3];
  } else if (NAMED[s]) rgb = NAMED[s].slice();
  else throw new Error(`unknown color '${tok}' (use a name like red/skyblue/gold, or #rrggbb)`);
  let c = [rgb[0], rgb[1], rgb[2], a];
  for (let i = 0; i < Math.abs(adj); i++) c = shade(c, adj > 0 ? 0.28 : -0.28);
  return c;
}

// =====================================================================
// SAFE EXPRESSION EVALUATOR  (used for {x+10}, loops, let)  - no eval()
// =====================================================================
function evalExpr(src, ctx) {
  const toks = String(src).match(/\d*\.?\d+|[A-Za-z_]\w*|[-+*/%^(),]|\S/g) || [];
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const D = Math.PI / 180;
  const fns = {
    sin: (x) => Math.sin(x * D), cos: (x) => Math.cos(x * D), tan: (x) => Math.tan(x * D),
    atan2: (y, x) => Math.atan2(y, x) / D, sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, pow: Math.pow,
    rnd: (a, b) => (a === undefined ? ctx.rnd() : b === undefined ? ctx.rnd() * a : a + ctx.rnd() * (b - a)),
  };
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next(), r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next(), r = unary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function unary() {
    if (peek() === "-") { next(); return -unary(); }
    if (peek() === "+") { next(); return unary(); }
    const b = atom();
    if (peek() === "^") { next(); return Math.pow(b, unary()); }
    return b;
  }
  function atom() {
    const t = next();
    if (t === undefined) throw new Error(`incomplete expression '${src}'`);
    if (t === "(") {
      const v = expr();
      if (next() !== ")") throw new Error(`missing ) in '${src}'`);
      return v;
    }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === "(") {
        next();
        const args = [];
        if (peek() !== ")") {
          for (;;) {
            args.push(expr());
            if (peek() === ",") { next(); continue; }
            break;
          }
        }
        if (next() !== ")") throw new Error(`missing ) in '${src}'`);
        if (!fns[t]) throw new Error(`unknown function '${t}'`);
        return fns[t](...args);
      }
      if (t === "pi") return Math.PI;
      if (t in ctx.vars) return ctx.vars[t];
      throw new Error(`unknown name '${t}'`);
    }
    throw new Error(`bad expression '${src}'`);
  }
  const v = expr();
  if (i < toks.length) throw new Error(`bad expression '${src}'`);
  if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`'${src}' is not a number`);
  return v;
}

// =====================================================================
// PNG ENCODER
// =====================================================================
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// =====================================================================
// TRUETYPE FONT READER (for text)  - uses Arial from Windows\Fonts
// =====================================================================
function parseTTF(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  let off = 0;
  if (dv.getUint32(0) === 0x74746366) off = dv.getUint32(12); // .ttc collection: first font
  const nt = dv.getUint16(off + 4);
  const T = {};
  for (let i = 0; i < nt; i++) {
    const o = off + 12 + i * 16;
    T[tag(o)] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
  }
  if (!T.glyf || !T.loca || !T.head || !T.cmap || !T.hmtx || !T.hhea || !T.maxp) throw new Error("unsupported font");
  const upm = dv.getUint16(T.head.off + 18);
  const locFmt = dv.getInt16(T.head.off + 50);
  const numGlyphs = dv.getUint16(T.maxp.off + 4);
  const asc = dv.getInt16(T.hhea.off + 4);
  const numHM = dv.getUint16(T.hhea.off + 34);
  // cmap (format 4)
  let cmapOff = -1;
  const ncm = dv.getUint16(T.cmap.off + 2);
  for (let i = 0; i < ncm; i++) {
    const pid = dv.getUint16(T.cmap.off + 4 + i * 8), eid = dv.getUint16(T.cmap.off + 6 + i * 8);
    const o = T.cmap.off + dv.getUint32(T.cmap.off + 8 + i * 8);
    if (dv.getUint16(o) === 4 && ((pid === 3 && eid === 1) || pid === 0)) { cmapOff = o; if (pid === 3) break; }
  }
  if (cmapOff < 0) throw new Error("no cmap");
  const segX2 = dv.getUint16(cmapOff + 6), segN = segX2 / 2;
  const endO = cmapOff + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const gid = (cp) => {
    for (let i = 0; i < segN; i++) {
      if (cp <= dv.getUint16(endO + i * 2)) {
        const st = dv.getUint16(startO + i * 2);
        if (cp < st) return 0;
        const delta = dv.getInt16(deltaO + i * 2), ro = dv.getUint16(rangeO + i * 2);
        if (ro === 0) return (cp + delta) & 0xffff;
        const g = dv.getUint16(rangeO + i * 2 + ro + (cp - st) * 2);
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
    }
    return 0;
  };
  const adv = (g) => dv.getUint16(T.hmtx.off + 4 * Math.min(g, numHM - 1));
  const loca = (g) => (locFmt === 0 ? dv.getUint16(T.loca.off + g * 2) * 2 : dv.getUint32(T.loca.off + g * 4));

  function contours(g, depth) {
    if (g >= numGlyphs || depth > 6) return [];
    const o0 = loca(g), o1 = loca(g + 1);
    if (o0 === o1) return [];
    let p = T.glyf.off + o0;
    const nc = dv.getInt16(p);
    p += 10;
    if (nc >= 0) {
      const ends = [];
      for (let i = 0; i < nc; i++) { ends.push(dv.getUint16(p)); p += 2; }
      const n = nc ? ends[nc - 1] + 1 : 0;
      p += 2 + dv.getUint16(p);
      const flags = [];
      while (flags.length < n) {
        const f = dv.getUint8(p++);
        flags.push(f);
        if (f & 8) { let r = dv.getUint8(p++); while (r-- > 0) flags.push(f); }
      }
      const xs = [], ys = [];
      let v = 0;
      for (const f of flags) {
        if (f & 2) { const d = dv.getUint8(p++); v += f & 16 ? d : -d; }
        else if (!(f & 16)) { v += dv.getInt16(p); p += 2; }
        xs.push(v);
      }
      v = 0;
      for (const f of flags) {
        if (f & 4) { const d = dv.getUint8(p++); v += f & 32 ? d : -d; }
        else if (!(f & 32)) { v += dv.getInt16(p); p += 2; }
        ys.push(v);
      }
      const res = [];
      let s = 0;
      for (const e of ends) {
        const pts = [];
        for (let i = s; i <= e; i++) pts.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
        res.push(pts);
        s = e + 1;
      }
      return res;
    }
    let res = [], flags;
    do {
      flags = dv.getUint16(p);
      const gi = dv.getUint16(p + 2);
      p += 4;
      let dx, dy;
      if (flags & 1) { dx = dv.getInt16(p); dy = dv.getInt16(p + 2); p += 4; }
      else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
      if (!(flags & 2)) { dx = 0; dy = 0; }
      let a = 1, b = 0, c = 0, d = 1;
      const f2 = (q) => dv.getInt16(q) / 16384;
      if (flags & 8) { a = d = f2(p); p += 2; }
      else if (flags & 0x40) { a = f2(p); d = f2(p + 2); p += 4; }
      else if (flags & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8; }
      for (const ct of contours(gi, depth + 1)) {
        res.push(ct.map((q) => ({ x: a * q.x + c * q.y + dx, y: b * q.x + d * q.y + dy, on: q.on })));
      }
    } while (flags & 0x20);
    return res;
  }
  function flatten(pts, steps) {
    const n = pts.length;
    if (n < 2) return [];
    const st = pts.findIndex((q) => q.on);
    let arr;
    if (st < 0) arr = [{ x: (pts[0].x + pts[n - 1].x) / 2, y: (pts[0].y + pts[n - 1].y) / 2, on: true }, ...pts];
    else arr = pts.slice(st).concat(pts.slice(0, st));
    arr.push(arr[0]);
    const out = [[arr[0].x, arr[0].y]];
    let cur = arr[0];
    for (let k = 1; k < arr.length;) {
      const q = arr[k];
      if (q.on) { out.push([q.x, q.y]); cur = q; k++; continue; }
      const nx = arr[k + 1];
      let end;
      if (nx.on) { end = nx; k += 2; }
      else { end = { x: (q.x + nx.x) / 2, y: (q.y + nx.y) / 2, on: true }; k += 1; }
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        out.push([u * u * cur.x + 2 * u * t * q.x + t * t * end.x, u * u * cur.y + 2 * u * t * q.y + t * t * end.y]);
      }
      cur = end;
    }
    return out;
  }
  const cache = new Map();
  const polys = (g) => {
    if (!cache.has(g)) cache.set(g, contours(g, 0).map((c) => flatten(c, 6)).filter((c) => c.length > 2));
    return cache.get(g);
  };
  return { upm, asc, gid, adv, polys };
}

const fontCache = {};
function getFont(bold) {
  const key = bold ? "b" : "r";
  if (key in fontCache) return fontCache[key];
  const fd = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
  const list = bold
    ? [process.env.PAINT_FONT_BOLD, path.join(fd, "arialbd.ttf"), path.join(fd, "segoeuib.ttf"), path.join(fd, "tahomabd.ttf"), path.join(fd, "verdanab.ttf"),
       "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    : [process.env.PAINT_FONT, path.join(fd, "arial.ttf"), path.join(fd, "segoeui.ttf"), path.join(fd, "tahoma.ttf"), path.join(fd, "verdana.ttf"),
       "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];
  let font = null;
  for (const f of list) {
    if (f && fs.existsSync(f)) {
      try { font = parseTTF(fs.readFileSync(f)); break; } catch { /* try next */ }
    }
  }
  fontCache[key] = font;
  return font;
}

// =====================================================================
// PAINTER  (software rasterizer with 3x supersampling)
// =====================================================================
const orient = (poly) => {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s < 0 ? poly.slice().reverse() : poly;
};

function sampleStops(stops, t) {
  if (!(t > 0)) t = 0;
  if (t > 1) t = 1;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]);
      return mixc(a[1], b[1], f);
    }
  }
  return stops[stops.length - 1][1];
}

function catmull(pts, closed, steps = 14) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

class Painter {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.ss = w * h <= 640000 ? 3 : 2;
    this.W = w * this.ss; this.H = h * this.ss;
    this.buf = new Uint8ClampedArray(this.W * this.H * 3).fill(255);
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.alpha = 1;
    this.vars = {};
    this.seed(1);
  }
  seed(n) { this._s = (Math.floor(n) | 0) || 1; }
  rnd() {
    this._s = (this._s + 0x6d2b79f5) | 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // ---- transform ----
  get sc() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1e-9; }
  tl(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  tp(x, y) { const m = this.m, s = this.ss; return [(m[0] * x + m[2] * y + m[4]) * s, (m[1] * x + m[3] * y + m[5]) * s]; }
  push() { this.stack.push({ m: this.m.slice(), alpha: this.alpha }); }
  pop() { const s = this.stack.pop(); if (s) { this.m = s.m; this.alpha = s.alpha; } }
  mul(n) { const m = this.m; this.m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  translate(x, y) { this.mul([1, 0, 0, 1, x, y]); }
  scale(sx, sy = sx) { this.mul([sx, 0, 0, sy, 0, 0]); }
  rotate(deg) { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); this.mul([c, s, -s, c, 0, 0]); }
  at(x, y, s, fn) { this.push(); this.translate(x, y); this.scale(s); fn(); this.pop(); }

  // ---- low level fill ----
  span(y, x0, x1, paint) {
    const W = this.W, buf = this.buf;
    let idx = (y * W + x0) * 3;
    if (paint.c) {
      const r = paint.c[0], g = paint.c[1], b = paint.c[2], a = paint.c[3] * this.alpha;
      if (a >= 0.999) { for (let x = x0; x <= x1; x++) { buf[idx++] = r; buf[idx++] = g; buf[idx++] = b; } }
      else if (a > 0.002) {
        const ia = 1 - a, ra = r * a, ga = g * a, ba = b * a;
        for (let x = x0; x <= x1; x++) {
          buf[idx] = buf[idx] * ia + ra; idx++;
          buf[idx] = buf[idx] * ia + ga; idx++;
          buf[idx] = buf[idx] * ia + ba; idx++;
        }
      }
    } else {
      const ss = this.ss, yy = (y + 0.5) / ss;
      for (let x = x0; x <= x1; x++) {
        const c = paint.fn((x + 0.5) / ss, yy);
        const a = c[3] * this.alpha;
        if (a > 0.002) {
          const ia = 1 - a;
          buf[idx] = buf[idx] * ia + c[0] * a; idx++;
          buf[idx] = buf[idx] * ia + c[1] * a; idx++;
          buf[idx] = buf[idx] * ia + c[2] * a; idx++;
        } else idx += 3;
      }
    }
  }
  fillDev(polys, paint, evenodd = false) {
    const edges = [];
    let minY = Infinity, maxY = -Infinity;
    for (const p of polys) {
      const n = p.length;
      for (let i = 0; i < n; i++) {
        let a = p[i], b = p[(i + 1) % n], dir = 1;
        if (a[1] === b[1]) continue;
        if (a[1] > b[1]) { const t = a; a = b; b = t; dir = -1; }
        edges.push({ x0: a[0], y0: a[1], y1: b[1], dir, slope: (b[0] - a[0]) / (b[1] - a[1]) });
        if (a[1] < minY) minY = a[1];
        if (b[1] > maxY) maxY = b[1];
      }
    }
    if (!edges.length) return;
    edges.sort((e, f) => e.y0 - f.y0);
    const yStart = Math.max(0, Math.floor(minY)), yEnd = Math.min(this.H - 1, Math.ceil(maxY));
    let ei = 0, active = [];
    const W = this.W;
    for (let y = yStart; y <= yEnd; y++) {
      const yc = y + 0.5;
      while (ei < edges.length && edges[ei].y0 <= yc) active.push(edges[ei++]);
      let j = 0;
      for (let k = 0; k < active.length; k++) if (active[k].y1 > yc) active[j++] = active[k];
      active.length = j;
      if (!j) continue;
      const xs = active.map((e) => [e.x0 + (yc - e.y0) * e.slope, e.dir]);
      xs.sort((p, q) => p[0] - q[0]);
      let wind = 0;
      for (let k = 0; k < xs.length - 1; k++) {
        wind += xs[k][1];
        if (evenodd ? k % 2 === 0 : wind !== 0) {
          let xa = Math.ceil(xs[k][0] - 0.5), xb = Math.ceil(xs[k + 1][0] - 0.5) - 1;
          if (xa < 0) xa = 0;
          if (xb > W - 1) xb = W - 1;
          if (xa <= xb) this.span(y, xa, xb, paint);
        }
      }
    }
  }
  strokeDev(pts, wDev, closed) {
    const polys = [], hw = wDev / 2, n = pts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      const nx = (-dy / L) * hw, ny = (dx / L) * hw;
      polys.push(orient([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]));
    }
    const N = Math.max(8, Math.min(48, Math.ceil(hw * 1.2) + 6));
    for (const p of pts) {
      const c = [];
      for (let k = 0; k < N; k++) { const t = (k / N) * Math.PI * 2; c.push([p[0] + hw * Math.cos(t), p[1] + hw * Math.sin(t)]); }
      polys.push(orient(c));
    }
    return polys;
  }

  // ---- shape helpers (local coordinates) ----
  asPaint(f) { return Array.isArray(f) ? { c: f } : f; }
  fillPoly(pts, fill, evenodd) { if (fill && pts.length > 2) this.fillDev([pts.map((p) => this.tp(p[0], p[1]))], this.asPaint(fill), evenodd); }
  strokePoly(pts, lw, color, closed) {
    if (!color || !(lw > 0) || pts.length < 2) return;
    this.fillDev(this.strokeDev(pts.map((p) => this.tp(p[0], p[1])), lw * this.sc * this.ss, closed), { c: color });
  }
  draw(pts, fill, stroke, lw = 3, closed = true) {
    if (fill) this.fillPoly(pts, fill);
    if (stroke) this.strokePoly(pts, lw, stroke, closed);
  }
  arcPts(cx, cy, rx, ry, a0, a1) {
    const rd = Math.max(rx, ry) * this.sc * this.ss;
    const sweep = Math.abs(a1 - a0);
    const full = sweep >= 360;
    const n = Math.max(full ? 16 : 6, Math.min(600, Math.ceil((rd * sweep * Math.PI) / 180 / 4)));
    const pts = [];
    for (let i = 0; i <= (full ? n - 1 : n); i++) {
      const t = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }
  rrectPts(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r < 0.5) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    return [
      ...this.arcPts(x + w - r, y + r, r, r, -90, 0), ...this.arcPts(x + w - r, y + h - r, r, r, 0, 90),
      ...this.arcPts(x + r, y + h - r, r, r, 90, 180), ...this.arcPts(x + r, y + r, r, r, 180, 270),
    ];
  }
  rect(x, y, w, h, fill, stroke, lw) { this.draw([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, lw); }
  rrect(x, y, w, h, r, fill, stroke, lw) { this.draw(this.rrectPts(x, y, w, h, r), fill, stroke, lw); }
  ellipse(cx, cy, rx, ry, fill, stroke, lw) { this.draw(this.arcPts(cx, cy, rx, ry, 0, 360), fill, stroke, lw); }
  circle(cx, cy, r, fill, stroke, lw) { this.ellipse(cx, cy, r, r, fill, stroke, lw); }
  poly(pts, fill, stroke, lw) { this.draw(pts, fill, stroke, lw); }
  line(x1, y1, x2, y2, color, lw = 3) { this.strokePoly([[x1, y1], [x2, y2]], lw, color, false); }
  polyline(pts, color, lw = 3) { this.strokePoly(pts, lw, color, false); }
  curve(pts, color, lw = 3) { this.strokePoly(catmull(pts, false), lw, color, false); }
  blob(pts, fill, stroke, lw) { this.draw(catmull(pts, true), fill, stroke, lw); }
  arc(cx, cy, rx, ry, a0, sweep, color, lw = 3) { this.strokePoly(this.arcPts(cx, cy, rx, ry, a0, a0 + sweep), lw, color, false); }
  pie(cx, cy, rx, ry, a0, sweep, fill, stroke, lw) { this.draw([[cx, cy], ...this.arcPts(cx, cy, rx, ry, a0, a0 + sweep)], fill, stroke, lw); }
  dashed(x1, y1, x2, y2, color, lw = 3, len = 12) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1e-6) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    for (let d = 0; d < L; d += len * 2) {
      const e = Math.min(d + len, L);
      this.line(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e, color, lw);
    }
  }
  // ---- gradients (return paints) ----
  linGrad(x0, y0, x1, y1, stops) {
    const a = this.tl(x0, y0), b = this.tl(x1, y1);
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    return { fn: (x, y) => sampleStops(stops, ((x - a[0]) * dx + (y - a[1]) * dy) / L2) };
  }
  radGrad(cx, cy, r, stops, fx = cx, fy = cy) {
    const c = this.tl(fx, fy), R = r * this.sc || 1;
    return { fn: (x, y) => sampleStops(stops, Math.hypot(x - c[0], y - c[1]) / R) };
  }
  // ---- text ----
  measure(str, size, bold) {
    const f = getFont(bold) || getFont(!bold);
    if (!f) return str.length * size * 0.55;
    let w = 0;
    for (const ch of String(str)) w += f.adv(f.gid(ch.codePointAt(0)));
    return (w * size) / f.upm;
  }
  text(str, x, y, size, color, bold = true, align = "left") {
    const f = getFont(bold) || getFont(!bold);
    if (!f) throw new Error("no TrueType font found (set the PAINT_FONT environment variable to a .ttf file)");
    if (!color) return;
    const lines = String(str).split(/\||\\n|\n/);
    const k = size / f.upm;
    lines.forEach((ln, li) => {
      const w = this.measure(ln, size, bold);
      let pen = align === "center" ? -w / 2 : align === "right" ? -w : 0;
      const base = y + li * size * 1.2 + f.asc * k;
      const polys = [];
      for (const ch of ln) {
        const g = f.gid(ch.codePointAt(0));
        for (const c of f.polys(g)) polys.push(c.map((p) => this.tp(x + pen + p[0] * k, base - p[1] * k)));
        pen += f.adv(g) * k;
      }
      if (polys.length) this.fillDev(polys, { c: color });
    });
  }
  // ---- output ----
  toPNG() {
    const { ss, W, w, h } = this, out = new Uint8Array(w * h * 3), src = this.buf, n = ss * ss;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let j = 0; j < ss; j++) {
          let idx = ((y * ss + j) * W + x * ss) * 3;
          for (let i = 0; i < ss; i++) { r += src[idx++]; g += src[idx++]; b += src[idx++]; }
        }
        const o = (y * w + x) * 3;
        out[o] = (r / n + 0.5) | 0; out[o + 1] = (g / n + 0.5) | 0; out[o + 2] = (b / n + 0.5) | 0;
      }
    }
    return encodePNG(w, h, out);
  }
}