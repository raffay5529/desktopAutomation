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
// =====================================================================
// COMMAND REGISTRY
// The argument names in each signature decide how a value is read:
//   color names (fill, stroke, color, c1, skin ...) -> colors
//   str, label, mood, pose, preset, style, dir        -> text
//   everything else                                   -> numbers
//   [name] = optional,  name... = takes many values
// =====================================================================
const CMDS = new Map();
const GROUPS = [];
const COLOR_ARGS = new Set(["fill", "stroke", "color", "c1", "c2", "c3", "skin", "hair", "shirt", "pants", "wall", "roof", "petal", "center", "top", "bottom", "textcolor", "body", "leaf", "trunk", "hull", "sail", "snow"]);
const STR_ARGS = new Set(["str", "label", "mood", "pose", "preset", "style", "dir"]);

function parseSig(sig) {
  return sig.split(/\s+/).filter(Boolean).map((t) => {
    let opt = false, rest = false, name = t;
    if (t.startsWith("[")) { opt = true; name = t.slice(1, -1); }
    if (name.endsWith("...")) { rest = true; name = name.slice(0, -3); }
    const type = rest ? (name === "items" ? "raw" : "num") : COLOR_ARGS.has(name) ? "color" : STR_ARGS.has(name) ? "str" : "num";
    return { name, opt, rest, type };
  });
}
function def(group, name, sig, desc, fn) {
  if (!GROUPS.includes(group)) GROUPS.push(group);
  CMDS.set(name, { group, name, sig, desc, fn, spec: parseSig(sig) });
}
const ALIASES = {
  rectangle: "rect", square: "rect", oval: "ellipse", triangle: "tri", background: "bg", centertext: "textc", text_center: "textc",
  write: "text", kid: "person", child: "person", man: "person", woman: "person", boy: "person", girl: "person",
  smiley: "face", head: "face", cat: "catface", dog: "dogface", repeat_end: "end", polygonal: "polygon", dot: "circle",
  bar: "barchart", pie_chart: "piechart", line_chart: "linechart", wave: "sea", clouds: "cloud",
};

const C = parseColor;
const PALETTE = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"].map(parseColor);
const RAINBOW = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#3949ab", "#8e24aa"].map(parseColor);
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const autoText = (f) => (lum(f) > 150 ? C("#1d2733") : C("white"));
const BLACK = (a) => [0, 0, 0, a];
const WHITE = (a = 1) => [255, 255, 255, a];

// ---------------------------------------------------------------------
// CANVAS & BACKGROUND
// ---------------------------------------------------------------------
def("Canvas", "bg", "color", "fill the whole picture with one color", (a, P) => P.rect(0, 0, P.w, P.h, a.color));
def("Canvas", "bggrad", "top bottom", "top-to-bottom gradient over the whole picture", (a, P) => P.rect(0, 0, P.w, P.h, P.linGrad(0, 0, 0, P.h, [[0, a.top], [1, a.bottom]])));
const SKIES = {
  day: [[0, "#2f86e0"], [1, "#d4f0ff"]],
  sunset: [[0, "#2b1a5c"], [0.45, "#c2477a"], [0.75, "#ff8a4c"], [1, "#ffd98a"]],
  night: [[0, "#03061a"], [1, "#1c2a5e"]],
  dawn: [[0, "#3b4a8c"], [0.5, "#f08a9b"], [1, "#ffe2b5"]],
  cloudy: [[0, "#6f7c8c"], [1, "#d5dbe2"]],
};
function starsFn(P, n, color) {
  for (let i = 0; i < n; i++) {
    const x = P.rnd() * P.w, y = P.rnd() * P.h * 0.7, r = 0.6 + P.rnd() * 1.8, t = P.rnd();
    if (t > 0.94) P.circle(x, y, r * 4, P.radGrad(x, y, r * 4, [[0, alpha(color, 0.5)], [1, alpha(color, 0)]]));
    P.circle(x, y, r, alpha(color, 0.5 + P.rnd() * 0.5));
  }
}
def("Canvas", "sky", "[preset]", "ready-made sky gradient: day (default), sunset, night (adds stars), dawn, cloudy", (a, P) => {
  const name = (a.preset || "day").toLowerCase();
  const st = SKIES[name];
  if (!st) throw new Error("sky preset must be day, sunset, night, dawn or cloudy");
  P.rect(0, 0, P.w, P.h, P.linGrad(0, 0, 0, P.h, st.map(([t, c]) => [t, C(c)])));
  if (name === "night") starsFn(P, 130, WHITE());
});
def("Canvas", "stars", "[n] [color]", "random twinkling stars in the upper sky (n = how many, default 80)", (a, P) => starsFn(P, a.n ?? 80, a.color || WHITE()));
def("Canvas", "ground", "y color", "flat ground from y down to the bottom", (a, P) => {
  P.rect(0, a.y, P.w, P.h - a.y + 2, a.color);
  P.rect(0, a.y, P.w, 4, shade(a.color, -0.2));
});
def("Canvas", "grass", "y [color]", "grass field from y down to the bottom edge (with blades)", (a, P) => {
  const c = a.color || C("grass"), H = P.h;
  P.rect(0, a.y, P.w, H - a.y + 2, P.linGrad(0, a.y, 0, H, [[0, shade(c, 0.15)], [1, shade(c, -0.25)]]));
  const n = Math.floor(P.w / 5);
  for (let i = 0; i < n; i++) {
    const x = P.rnd() * P.w, y = a.y + 3 + P.rnd() * (H - a.y), s = 4 + ((y - a.y) / (H - a.y + 1)) * 12;
    P.poly([[x - s * 0.25, y], [x + s * 0.05, y - s], [x + s * 0.25, y]], shade(c, -0.15 + P.rnd() * 0.35));
  }
});
def("Canvas", "sea", "y [color]", "sea / water from y down, with little waves", (a, P) => {
  const c = a.color || C("water"), H = P.h;
  P.rect(0, a.y, P.w, H - a.y + 2, P.linGrad(0, a.y, 0, H, [[0, shade(c, 0.2)], [1, shade(c, -0.3)]]));
  for (let i = 0; i < 70; i++) {
    const x = P.rnd() * P.w, y = a.y + 6 + P.rnd() * (H - a.y), w = 10 + ((y - a.y) / (H - a.y + 1)) * 26;
    P.curve([[x - w, y], [x - w / 2, y - 3], [x, y], [x + w / 2, y - 3], [x + w, y]], WHITE(0.35), 2);
  }
});
def("Canvas", "road", "y h", "road with edge lines and a dashed center line (from y, height h)", (a, P) => {
  P.rect(0, a.y, P.w, a.h, C("#3b3f45"));
  P.rect(0, a.y + 5, P.w, 3, WHITE(0.8));
  P.rect(0, a.y + a.h - 8, P.w, 3, WHITE(0.8));
  P.dashed(0, a.y + a.h / 2, P.w, a.y + a.h / 2, C("#f5d442"), 4, 28);
});
def("Canvas", "border", "color [lw]", "frame around the whole picture", (a, P) => {
  const lw = a.lw ?? 10;
  P.rect(lw / 2, lw / 2, P.w - lw, P.h - lw, null, a.color, lw);
});

// ---------------------------------------------------------------------
// BASIC SHAPES
// ---------------------------------------------------------------------
def("Shapes", "rect", "x y w h fill [stroke] [lw]", "rectangle. x,y = top-left corner. fill/stroke can be none", (a, P) => P.rect(a.x, a.y, a.w, a.h, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "rrect", "x y w h r fill [stroke] [lw]", "rounded rectangle, r = corner radius", (a, P) => P.rrect(a.x, a.y, a.w, a.h, a.r, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "circle", "cx cy r fill [stroke] [lw]", "circle (cx,cy = center)", (a, P) => P.circle(a.cx, a.cy, a.r, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "ellipse", "cx cy rx ry fill [stroke] [lw]", "ellipse (rx = horizontal radius, ry = vertical radius)", (a, P) => P.ellipse(a.cx, a.cy, a.rx, a.ry, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "line", "x1 y1 x2 y2 color [lw]", "straight line with round ends (lw = thickness, default 3)", (a, P) => P.line(a.x1, a.y1, a.x2, a.y2, a.color, a.lw ?? 3));
def("Shapes", "dash", "x1 y1 x2 y2 color [lw] [len]", "dashed line (len = dash length, default 12)", (a, P) => P.dashed(a.x1, a.y1, a.x2, a.y2, a.color, a.lw ?? 3, a.len ?? 12));
def("Shapes", "polyline", "color lw pts...", "connected straight lines through points: x1 y1 x2 y2 x3 y3 ...", (a, P) => {
  if (a.pts.length < 4 || a.pts.length % 2) throw new Error("polyline needs pairs of numbers x y (at least 2 points)");
  P.polyline(pairs(a.pts), a.color, a.lw);
});
def("Shapes", "poly", "fill pts...", "filled polygon through points: x1 y1 x2 y2 x3 y3 ...", (a, P) => {
  if (a.pts.length < 6 || a.pts.length % 2) throw new Error("poly needs pairs of numbers x y (at least 3 points)");
  P.poly(pairs(a.pts), a.fill);
});
def("Shapes", "polyo", "color lw pts...", "polygon OUTLINE only (closed): x1 y1 x2 y2 x3 y3 ...", (a, P) => {
  if (a.pts.length < 6 || a.pts.length % 2) throw new Error("polyo needs pairs of numbers x y (at least 3 points)");
  P.poly(pairs(a.pts), null, a.color, a.lw);
});
def("Shapes", "tri", "x1 y1 x2 y2 x3 y3 fill [stroke] [lw]", "triangle from 3 corner points", (a, P) => P.poly([[a.x1, a.y1], [a.x2, a.y2], [a.x3, a.y3]], a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "curve", "color lw pts...", "smooth curved line through points: x1 y1 x2 y2 x3 y3 ... (3+ points)", (a, P) => {
  if (a.pts.length < 6 || a.pts.length % 2) throw new Error("curve needs pairs of numbers x y (at least 3 points)");
  P.curve(pairs(a.pts), a.color, a.lw);
});
def("Shapes", "blob", "fill pts...", "smooth rounded filled shape through points (organic shapes: leaves, clouds, bodies)", (a, P) => {
  if (a.pts.length < 6 || a.pts.length % 2) throw new Error("blob needs pairs of numbers x y (at least 3 points)");
  P.blob(pairs(a.pts), a.fill);
});
def("Shapes", "bezier", "color lw x1 y1 cx1 cy1 cx2 cy2 x2 y2", "bezier curve from (x1,y1) to (x2,y2) with two control points", (a, P) => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    pts.push([u * u * u * a.x1 + 3 * u * u * t * a.cx1 + 3 * u * t * t * a.cx2 + t * t * t * a.x2, u * u * u * a.y1 + 3 * u * u * t * a.cy1 + 3 * u * t * t * a.cy2 + t * t * t * a.y2]);
  }
  P.polyline(pts, a.color, a.lw);
});
def("Shapes", "arc", "cx cy rx ry start sweep color [lw]", "curved line along an ellipse. angles in degrees: 0 = right, 90 = down, 180 = left, 270 = up. sweep goes clockwise", (a, P) => P.arc(a.cx, a.cy, a.rx, a.ry, a.start, a.sweep, a.color, a.lw ?? 3));
def("Shapes", "pie", "cx cy rx ry start sweep fill [stroke] [lw]", "filled pie slice / half circle (same angles as arc)", (a, P) => P.pie(a.cx, a.cy, a.rx, a.ry, a.start, a.sweep, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "ring", "cx cy r thick color", "ring / donut (r = middle radius, thick = thickness)", (a, P) => P.circle(a.cx, a.cy, a.r, null, a.color, a.thick));
def("Shapes", "star", "cx cy r fill [stroke] [lw] [points]", "star (default 5 points)", (a, P) => {
  const n = Math.max(3, Math.round(a.points ?? 5)), pts = [];
  for (let i = 0; i < n * 2; i++) {
    const R = i % 2 === 0 ? a.r : a.r * (n === 5 ? 0.42 : 0.5), t = ((-90 + (i * 180) / n) * Math.PI) / 180;
    pts.push([a.cx + R * Math.cos(t), a.cy + R * Math.sin(t)]);
  }
  P.poly(pts, a.fill, a.stroke, a.lw ?? 2);
});
def("Shapes", "polygon", "cx cy r sides fill [stroke] [lw] [rot]", "regular polygon: sides 3=triangle 5=pentagon 6=hexagon 8=octagon (rot = rotation degrees)", (a, P) => {
  const n = Math.max(3, Math.round(a.sides)), pts = [];
  for (let i = 0; i < n; i++) {
    const t = ((-90 + (i * 360) / n + (a.rot ?? 0)) * Math.PI) / 180;
    pts.push([a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)]);
  }
  P.poly(pts, a.fill, a.stroke, a.lw ?? 3);
});
function heartPts(cx, cy, s) {
  const pts = [], k = s / 16;
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2;
    pts.push([cx + k * 16 * Math.pow(Math.sin(t), 3), cy - k * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) + k * 1.5]);
  }
  return pts;
}
def("Shapes", "heart", "cx cy size fill [stroke] [lw]", "heart (size = half width)", (a, P) => P.poly(heartPts(a.cx, a.cy, a.size), a.fill, a.stroke, a.lw ?? 3));
const pairs = (arr) => { const o = []; for (let i = 0; i + 1 < arr.length; i += 2) o.push([arr[i], arr[i + 1]]); return o; };

// ---------------------------------------------------------------------
// GRADIENTS, GLOW, SHADOW
// ---------------------------------------------------------------------
def("Effects", "gradrect", "x y w h c1 c2 [angle]", "rectangle with a color gradient. angle: 90 = top to bottom (default), 0 = left to right", (a, P) => {
  const ang = ((a.angle ?? 90) * Math.PI) / 180, dx = Math.cos(ang), dy = Math.sin(ang);
  const half = (Math.abs(a.w * dx) + Math.abs(a.h * dy)) / 2, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  P.rect(a.x, a.y, a.w, a.h, P.linGrad(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half, [[0, a.c1], [1, a.c2]]));
});
def("Effects", "radial", "cx cy r c1 c2", "round disc with a radial gradient (c1 in the middle, c2 at the edge)", (a, P) => P.circle(a.cx, a.cy, a.r, P.radGrad(a.cx, a.cy, a.r, [[0, a.c1], [1, a.c2]])));
def("Effects", "glow", "cx cy r color", "soft glowing light (fades out to nothing at radius r)", (a, P) => P.circle(a.cx, a.cy, a.r, P.radGrad(a.cx, a.cy, a.r, [[0, alpha(a.color, a.color[3] * 0.85)], [1, alpha(a.color, 0)]])));
def("Effects", "shadow", "cx cy rx ry [a]", "soft dark ellipse for ground shadows (a = darkness 0..1, default 0.3)", (a, P) => {
  P.push();
  P.translate(a.cx, a.cy);
  P.scale(1, a.ry / a.rx);
  P.circle(0, 0, a.rx, P.radGrad(0, 0, a.rx, [[0, BLACK(a.a ?? 0.3)], [1, BLACK(0)]]));
  P.pop();
});
def("Effects", "sparkle", "cx cy r [color]", "4-point sparkle / twinkle", (a, P) => {
  const c = a.color || C("#fff6b0"), r = a.r, q = r * 0.2;
  P.circle(a.cx, a.cy, r * 1.4, P.radGrad(a.cx, a.cy, r * 1.4, [[0, alpha(c, 0.5)], [1, alpha(c, 0)]]));
  P.poly([[a.cx, a.cy - r], [a.cx + q, a.cy - q], [a.cx + r, a.cy], [a.cx + q, a.cy + q], [a.cx, a.cy + r], [a.cx - q, a.cy + q], [a.cx - r, a.cy], [a.cx - q, a.cy - q]], c);
});
def("Effects", "fireworks", "cx cy r [color]", "firework burst (no color = multicolor)", (a, P) => {
  const n = 18;
  P.circle(a.cx, a.cy, a.r * 0.5, P.radGrad(a.cx, a.cy, a.r * 0.5, [[0, WHITE(0.7)], [1, WHITE(0)]]));
  for (let k = 0; k < n; k++) {
    const t = (k * 2 * Math.PI) / n, c = a.color || RAINBOW[k % 7], c0 = a.r * 0.22, c1 = a.r * 0.85;
    P.line(a.cx + c0 * Math.cos(t), a.cy + c0 * Math.sin(t), a.cx + c1 * Math.cos(t), a.cy + c1 * Math.sin(t), alpha(c, 0.9), Math.max(2, a.r * 0.035));
    P.circle(a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t), Math.max(2.5, a.r * 0.045), c);
  }
});
def("Effects", "confetti", "[n]", "colorful confetti pieces everywhere (n = how many, default 120)", (a, P) => {
  const n = a.n ?? 120;
  for (let i = 0; i < n; i++) {
    const x = P.rnd() * P.w, y = P.rnd() * P.h, c = PALETTE[Math.floor(P.rnd() * PALETTE.length)];
    P.push(); P.translate(x, y); P.rotate(P.rnd() * 360);
    P.rect(-4, -2, 9, 5, c);
    P.pop();
  }
});
def("Effects", "bubbles", "x y w h [n]", "soap bubbles inside a rectangle area", (a, P) => {
  const n = a.n ?? 14;
  for (let i = 0; i < n; i++) {
    const x = a.x + P.rnd() * a.w, y = a.y + P.rnd() * a.h, r = 6 + P.rnd() * 20;
    P.circle(x, y, r, P.radGrad(x, y, r, [[0, WHITE(0.05)], [0.8, C("#bfe9ff@0.25")], [1, WHITE(0.45)]]), WHITE(0.75), 1.5);
    P.ellipse(x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.1, WHITE(0.8));
  }
});

// ---------------------------------------------------------------------
// TEXT
// ---------------------------------------------------------------------
def("Text", "text", "str x y size color [style]", "write text (x,y = top-left). style: bold (default) or normal. use | for a new line", (a, P) => P.text(a.str, a.x, a.y, a.size, a.color, a.style !== "normal", "left"));
def("Text", "textc", "str cx y size color [style]", "text centered horizontally on cx (y = top of text)", (a, P) => P.text(a.str, a.cx, a.y, a.size, a.color, a.style !== "normal", "center"));
def("Text", "label", "str cx cy [size] [color]", "text centered exactly on the point cx,cy (size default 24, color default dark)", (a, P) => {
  const size = a.size ?? 24, nl = String(a.str).split(/\||\\n/).length;
  P.text(a.str, a.cx, a.cy - size * 0.55 - (nl - 1) * size * 0.6, size, a.color || C("#222"), true, "center");
});
def("Text", "title", "str [color] [size]", "big centered title at the top of the picture", (a, P) => {
  const size = a.size ?? Math.round(Math.min(P.h * 0.08, 56));
  P.text(a.str, P.w / 2, size * 0.45, size, a.color || C("#222"), true, "center");
});

// ---------------------------------------------------------------------
// TRANSFORMS & PROGRAM CONTROL
// ---------------------------------------------------------------------
def("Control", "alpha", "a", "transparency for everything drawn next: 1 = solid, 0.5 = half see-through. alpha 1 to reset", (a, P) => { P.alpha = Math.max(0, Math.min(1, a.a)); });
def("Control", "push", "", "save the current move/rotate/scale/alpha state", (a, P) => P.push());
def("Control", "pop", "", "go back to the state saved by the last push", (a, P) => P.pop());
def("Control", "translate", "x y", "move the origin: everything after is shifted by x,y (use between push and pop)", (a, P) => P.translate(a.x, a.y));
def("Control", "rotate", "deg", "rotate everything after by deg degrees (clockwise) around the current origin", (a, P) => P.rotate(a.deg));
def("Control", "scale", "sx [sy]", "scale everything after (scale -1 1 mirrors left-right)", (a, P) => P.scale(a.sx, a.sy ?? a.sx));
def("Control", "seed", "n", "change the random pattern (for stars, grass, confetti ...)", (a, P) => P.seed(a.n));

// ---------------------------------------------------------------------
// NATURE
// ---------------------------------------------------------------------
def("Nature", "sun", "cx cy r", "bright sun with glow and rays (r = size of the round disc)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  P.circle(0, 0, 260, P.radGrad(0, 0, 260, [[0, C("#ffe066@0.55")], [1, C("#ffe066@0")]]));
  for (let k = 0; k < 12; k++) {
    const t = (k * 30 * Math.PI) / 180, r1 = 128, r2 = k % 2 ? 168 : 192;
    P.line(r1 * Math.cos(t), r1 * Math.sin(t), r2 * Math.cos(t), r2 * Math.sin(t), C("#ffc533"), k % 2 ? 9 : 13);
  }
  P.circle(0, 0, 100, P.radGrad(0, 0, 130, [[0, C("#fff7b0")], [0.6, C("#ffd83d")], [1, C("#ffb300")]], -30, -30));
}));
function arcBetween(cx, cy, r, pa, qa, tx, ty, tr, wantInside) {
  const TAU = Math.PI * 2, norm = (x) => ((x % TAU) + TAU) % TAU;
  let sweep = norm(qa - pa);
  const mid = pa + sweep / 2;
  const inside = Math.hypot(cx + r * Math.cos(mid) - tx, cy + r * Math.sin(mid) - ty) < tr;
  if (inside !== wantInside) sweep = -(TAU - sweep);
  const out = [];
  for (let i = 0; i <= 60; i++) { const t = pa + (sweep * i) / 60; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return out;
}
def("Nature", "moon", "cx cy r [color]", "crescent moon with soft glow", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#fff1b8"), c1 = [0, 0, 100], c2 = [42, -14, 84];
  P.circle(0, 0, 230, P.radGrad(0, 0, 230, [[0, alpha(c, 0.4)], [1, alpha(c, 0)]]));
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const aa = (c1[2] ** 2 - c2[2] ** 2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, c1[2] ** 2 - aa * aa));
  const mx = c1[0] + (aa * dx) / d, my = c1[1] + (aa * dy) / d;
  const p = [mx + (hh * dy) / d, my - (hh * dx) / d], q = [mx - (hh * dy) / d, my + (hh * dx) / d];
  const ang = (cc, pt) => Math.atan2(pt[1] - cc[1], pt[0] - cc[0]);
  const outer = arcBetween(c1[0], c1[1], c1[2], ang(c1, p), ang(c1, q), c2[0], c2[1], c2[2], false);
  const inner = arcBetween(c2[0], c2[1], c2[2], ang(c2, q), ang(c2, p), c1[0], c1[1], c1[2], true);
  P.poly([...outer, ...inner], c);
}));
def("Nature", "cloud", "cx cy w [color]", "fluffy cloud (w = width)", (a, P) => {
  const c = a.color || C("white");
  P.at(a.cx, a.cy, a.w / 200, () => {
    const lump = (col, dy) => {
      P.rrect(-95, 2 + dy, 190, 38, 19, col);
      P.circle(-55, 4 + dy, 32, col); P.circle(-12, -14 + dy, 44, col); P.circle(32, -6 + dy, 38, col); P.circle(66, 10 + dy, 28, col);
    };
    lump(shade(c, -0.12), 5);
    lump(c, 0);
  });
});
def("Nature", "rainbow", "cx baseY r", "rainbow arch (r = outer radius, baseY = where it touches the ground)", (a, P) => {
  const w = a.r * 0.075;
  RAINBOW.forEach((c, i) => P.arc(a.cx, a.baseY, a.r - i * w, a.r - i * w, 180, 180, alpha(c, 0.85), w * 1.05));
});
def("Nature", "mountain", "cx baseY w h [color] [snow]", "mountain with shading and snow cap (snow none = no snow)", (a, P) => {
  const c = a.color || C("slategray"), { cx, baseY: by, w, h } = a, L = cx - w / 2, R = cx + w / 2, T = by - h;
  P.poly([[L, by], [cx, T], [R, by]], c);
  P.poly([[cx, T], [R, by], [cx + w * 0.06, by], [cx + w * 0.02, by - h * 0.5]], shade(c, -0.25));
  const sn = a.snow === undefined ? C("white") : a.snow;
  if (sn) {
    P.poly([[cx, T], [cx + w * 0.15, T + h * 0.3], [cx + w * 0.08, T + h * 0.24], [cx + w * 0.02, T + h * 0.34], [cx - w * 0.06, T + h * 0.25], [cx - w * 0.15, T + h * 0.3]], sn);
    P.poly([[cx, T], [cx + w * 0.15, T + h * 0.3], [cx + w * 0.08, T + h * 0.24], [cx + w * 0.02, T + h * 0.34]], shade(sn, -0.12));
  }
});
def("Nature", "hill", "cx baseY w h color", "round hill (half ellipse sitting on baseY)", (a, P) => {
  P.pie(a.cx, a.baseY, a.w / 2, a.h, 180, 180, a.color);
  P.pie(a.cx - a.w * 0.05, a.baseY, a.w * 0.4, a.h * 0.82, 180, 180, alpha(shade(a.color, 0.25), 0.5));
});
def("Nature", "tree", "cx baseY h [leaf] [trunk]", "leafy round tree (h = total height)", (a, P) => {
  const lf = a.leaf || C("leaf"), tk = a.trunk || C("wood");
  P.at(a.cx, a.baseY, a.h / 105, () => {
    P.poly([[-6, 0], [6, 0], [4, -48], [-4, -48]], tk);
    P.line(0, -34, -14, -52, tk, 3.5); P.line(0, -38, 15, -56, tk, 3.5);
    const dk = shade(lf, -0.18), lt = shade(lf, 0.18);
    P.circle(0, -64, 31, dk); P.circle(-20, -52, 23, dk); P.circle(20, -52, 23, dk); P.circle(0, -82, 24, dk);
    P.circle(-3, -67, 28, lf); P.circle(-19, -56, 19, lf); P.circle(19, -56, 19, lf); P.circle(1, -84, 21, lf);
    P.circle(-11, -76, 11, alpha(lt, 0.8)); P.circle(-22, -60, 8, alpha(lt, 0.7)); P.circle(8, -92, 7, alpha(lt, 0.7));
  });
});
def("Nature", "pine", "cx baseY h [color]", "pine / fir tree (h = total height)", (a, P) => {
  const c = a.color || C("#2f7d4a");
  P.at(a.cx, a.baseY, a.h / 100, () => {
    P.rect(-4, -14, 8, 14, C("wood"));
    [[-10, -48, 34, -0.18], [-34, -74, 28, -0.08], [-58, -100, 20, 0.02]].forEach(([y0, y1, hw, k]) => {
      P.poly([[-hw, y0], [hw, y0], [0, y1]], shade(c, k));
      P.poly([[0, y1], [hw, y0], [0, y0]], BLACK(0.16));
    });
  });
});
def("Nature", "palm", "cx baseY h", "palm tree", (a, P) => P.at(a.cx, a.baseY, a.h / 100, () => {
  const tk = C("#9a6b3d"), lf = C("#3aa14a");
  P.curve([[0, 0], [3, -30], [9, -62], [8, -92]], tk, 8.5);
  for (let i = 1; i < 7; i++) P.line(-5 + i * 0.5, -i * 13, 5 + i * 0.5, -i * 13 - 0, alpha(shade(tk, -0.3), 0.6), 1.6);
  [-170, -138, -104, -62, -24, 12, 160].forEach((ang) => {
    P.push(); P.translate(8, -94); P.rotate(ang);
    if (Math.cos((ang * Math.PI) / 180) < 0) P.scale(1, -1);
    P.blob([[0, 0], [18, -9], [42, -10], [66, -2], [88, 12], [62, 2], [40, 7], [18, 6]], lf, shade(lf, -0.3), 1.5);
    P.pop();
  });
  P.circle(4, -90, 5, C("#6d4c2a")); P.circle(12, -89, 5, C("#6d4c2a"));
}));
def("Nature", "bush", "cx baseY w [color]", "round bush", (a, P) => {
  const c = a.color || C("#3c9a46");
  P.at(a.cx, a.baseY, a.w / 100, () => {
    [[-30, -18, 22], [30, -18, 22], [0, -26, 28], [-14, -12, 20], [14, -12, 20]].forEach(([x, y, r]) => P.circle(x, y, r, shade(c, -0.15)));
    [[-30, -22, 19], [30, -22, 19], [0, -31, 25], [-12, -17, 17], [12, -17, 17]].forEach(([x, y, r]) => P.circle(x, y, r, c));
    P.circle(-8, -38, 10, alpha(shade(c, 0.3), 0.7));
  });
});
def("Nature", "flower", "cx cy r petal [center]", "flower with stem and leaf (r = petal-head radius, cx cy = head center)", (a, P) => {
  const pc = a.petal, cc = a.center || C("gold");
  P.at(a.cx, a.cy, a.r / 20, () => {
    P.line(0, 10, 0, 90, C("#3c9a3c"), 3.2);
    P.blob([[0, 62], [22, 48], [36, 56], [16, 68]], C("#4cb04c"));
    for (let k = 0; k < 8; k++) { P.push(); P.rotate(k * 45); P.ellipse(0, -14, 7, 11, pc, shade(pc, -0.25), 1); P.pop(); }
    P.circle(0, 0, 7.5, cc, shade(cc, -0.3), 1.2);
  });
});
def("Nature", "bird", "x y s [color]", "flying bird, simple 'v' wings (s = half wingspan)", (a, P) => {
  const c = a.color || C("#333"), lw = Math.max(2, a.s * 0.11);
  P.curve([[a.x - a.s, a.y - a.s * 0.15], [a.x - a.s * 0.5, a.y - a.s * 0.55], [a.x, a.y]], c, lw);
  P.curve([[a.x, a.y], [a.x + a.s * 0.5, a.y - a.s * 0.55], [a.x + a.s, a.y - a.s * 0.15]], c, lw);
});
def("Nature", "butterfly", "cx cy s [c1] [c2]", "butterfly (s = about half its width)", (a, P) => P.at(a.cx, a.cy, a.s / 100, () => {
  const c1 = a.c1 || C("orange"), c2 = a.c2 || C("#8e44ad"), dk = C("#3b2a20");
  for (const sg of [-1, 1]) {
    P.push(); P.scale(sg, 1);
    P.push(); P.translate(42, -30); P.rotate(-25); P.ellipse(0, 0, 52, 36, c1, shade(c1, -0.35), 2); P.circle(6, -4, 9, c2); P.pop();
    P.push(); P.translate(30, 34); P.rotate(25); P.ellipse(0, 0, 32, 24, c2, shade(c2, -0.35), 2); P.circle(4, 2, 6, c1); P.pop();
    P.curve([[0, -28], [8 * 1, -48], [16, -54]], dk, 2);
    P.pop();
  }
  P.ellipse(0, 0, 6, 30, dk);
}));
def("Nature", "fish", "cx cy s color [dir]", "fish (s = half body length). dir = left or right (default right)", (a, P) => P.at(a.cx, a.cy, a.s / 100, () => {
  const c = a.color;
  if (a.dir === "left") P.scale(-1, 1);
  P.poly([[-70, 0], [-125, -38], [-118, 0], [-125, 38]], shade(c, -0.15));
  P.poly([[-10, -42], [22, -82], [48, -40]], shade(c, -0.2));
  P.ellipse(0, 0, 85, 50, c);
  P.ellipse(4, 22, 66, 24, alpha(shade(c, 0.5), 0.4));
  P.arc(28, 0, 18, 34, 100, 160, shade(c, -0.3), 3);
  P.circle(50, -12, 9, WHITE()); P.circle(52, -12, 4.5, C("black"));
}));
def("Nature", "rain", "x y w h [n] [color]", "rain drops inside a rectangle area", (a, P) => {
  const c = a.color || C("#6fa8dc@0.85");
  for (let i = 0; i < (a.n ?? 60); i++) { const x = a.x + P.rnd() * a.w, y = a.y + P.rnd() * a.h; P.line(x, y, x - 4, y + 14, c, 2); }
});
def("Nature", "snow", "x y w h [n]", "falling snow inside a rectangle area", (a, P) => {
  for (let i = 0; i < (a.n ?? 70); i++) P.circle(a.x + P.rnd() * a.w, a.y + P.rnd() * a.h, 1.5 + P.rnd() * 3, WHITE(0.6 + P.rnd() * 0.4));
});
def("Nature", "lightning", "x y h [color]", "lightning bolt (x,y = top, h = length)", (a, P) => P.at(a.x, a.y, a.h / 100, () => {
  const c = a.color || C("#ffe14d");
  P.circle(0, 50, 90, P.radGrad(0, 50, 90, [[0, alpha(c, 0.4)], [1, alpha(c, 0)]]));
  P.poly([[0, 0], [-22, 48], [-4, 48], [-18, 100], [24, 38], [4, 38], [22, 0]], c, C("#fff8c8"), 1.5);
}));

// ---------------------------------------------------------------------
// ANIMALS
// ---------------------------------------------------------------------
def("Animals", "catface", "cx cy r [color]", "cat face (r = head radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#f0a14a"), dk = shade(c, -0.35), pink = C("#ff9fb5");
  P.poly([[-95, -30], [-80, -112], [-28, -78]], c, dk, 2); P.poly([[95, -30], [80, -112], [28, -78]], c, dk, 2);
  P.poly([[-82, -48], [-74, -92], [-48, -72]], pink); P.poly([[82, -48], [74, -92], [48, -72]], pink);
  P.ellipse(0, 0, 100, 88, c, dk, 2);
  P.poly([[-8, -86], [-14, -58], [-2, -64]], dk); P.poly([[8, -86], [14, -58], [2, -64]], dk); P.poly([[0, -88], [0, -60], [6, -66]], dk);
  P.ellipse(0, 34, 42, 30, shade(c, 0.55));
  for (const s of [-1, 1]) {
    P.ellipse(s * 38, -8, 17, 20, C("#a6e86a"), dk, 2); P.ellipse(s * 38, -8, 4.5, 15, C("#111")); P.circle(s * 38 + 5, -14, 4, WHITE());
    P.line(s * 30, 36, s * 96, 20, C("#ffffff@0.9"), 2); P.line(s * 30, 44, s * 98, 44, C("#ffffff@0.9"), 2); P.line(s * 30, 52, s * 94, 68, C("#ffffff@0.9"), 2);
  }
  P.poly([[-10, 18], [10, 18], [0, 30]], pink, shade(pink, -0.3), 1.5);
  P.line(0, 30, 0, 40, dk, 2.5); P.arc(-12, 40, 12, 10, 0, 180, dk, 2.5); P.arc(12, 40, 12, 10, 0, 180, dk, 2.5);
}));
def("Animals", "dogface", "cx cy r [color]", "dog face (r = head radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#d9a066"), ear = shade(c, -0.4);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 88, -8); P.rotate(s * 14); P.ellipse(0, 0, 27, 60, ear, shade(ear, -0.3), 2); P.pop(); }
  P.ellipse(0, 0, 88, 84, c, shade(c, -0.3), 2);
  P.ellipse(-34, -22, 26, 28, ear);
  P.ellipse(0, 32, 50, 38, C("#f7e8d2"));
  P.ellipse(0, 14, 19, 13, C("#222")); P.ellipse(-5, 10, 6, 3, WHITE(0.7));
  P.line(0, 26, 0, 46, C("#333"), 2.5); P.arc(-12, 46, 12, 9, 0, 180, C("#333"), 2.5); P.arc(12, 46, 12, 9, 0, 180, C("#333"), 2.5);
  P.ellipse(0, 62, 12, 15, C("#ff7a93"), C("#c9506b"), 1.5); P.line(0, 50, 0, 66, C("#c9506b"), 1.5);
  for (const s of [-1, 1]) { P.circle(s * 34, -20, 10, C("#222")); P.circle(s * 34 + 3, -24, 3.5, WHITE()); P.line(s * 22, -42, s * 46, -46 + s * 0, shade(c, -0.5), 3); }
}));

// ---------------------------------------------------------------------
// PEOPLE
// ---------------------------------------------------------------------
const MOOD_ALIAS = { happy: "smile", laughing: "laugh", lol: "laugh", haha: "laugh", shocked: "surprised", wow: "surprised", crying: "cry", mad: "angry", sleeping: "sleep", tired: "sleep", heart: "love", kiss: "love", sunglasses: "cool", normal: "neutral", ok: "neutral", sadness: "sad" };
function faceDraw(P, cx, cy, r, mood, skin, hair) {
  const sk = skin || C("skin"), hc = hair === undefined ? C("darkbrown") : hair, dark = C("#3b2314"), red = C("#a82838");
  mood = (mood || "smile").toLowerCase();
  mood = MOOD_ALIAS[mood] || mood;
  P.at(cx, cy, r / 100, () => {
    if (hc) { P.ellipse(0, -27, 107, 87, hc); P.ellipse(-13, -111, 14, 17, hc); P.ellipse(10, -116, 13, 19, hc); P.ellipse(33, -111, 14, 17, hc); }
    for (const s of [-1, 1]) { P.ellipse(s * 102, -4, 16, 23, shade(sk, -0.06), shade(sk, -0.25), 2); P.ellipse(s * 103, -2, 7, 12, shade(sk, -0.18)); }
    P.ellipse(0, 0, 100, 93, sk, shade(sk, -0.25), 2.5);
    if (hc) P.poly([[-100, -25], [-92, -67], [-60, -93], [0, -100], [60, -93], [92, -67], [100, -25], [80, -57], [53, -45], [27, -63], [0, -43], [-30, -63], [-57, -45], [-79, -57]], hc);
    const browC = hc ? shade(hc, -0.1) : dark;
    const eyeOpen = (x) => { P.ellipse(x, -12, 8, 10, dark); P.circle(x - 2.5, -15.5, 3, WHITE()); };
    const eyeJoy = (x) => P.arc(x, -12, 19, 13, 180, 180, dark, 5.5);
    const eyeShut = (x) => P.arc(x, -14, 17, 10, 0, 180, dark, 4.5);
    const cheeks = (al) => { P.ellipse(-59, 14, 21, 13, C("#ff5064@" + al)); P.ellipse(59, 14, 21, 13, C("#ff5064@" + al)); };
    const nose = () => P.ellipse(0, 6, 8, 6, shade(sk, -0.14));
    const smile = (w = 36, h = 26) => P.arc(0, 14, w, h, 20, 140, dark, 5);
    const brows = (y = -36, tilt = 0) => { P.arc(-38, y + 4, 17, 9, 200, 140, browC, 3.5); P.arc(38, y + 4, 17, 9, 200, 140, browC, 3.5); };
    if (mood === "laugh") {
      eyeJoy(-38); eyeJoy(38); brows(-36); cheeks(0.4); nose();
      P.pie(0, 38, 47, 37, 0, 180, red);
      P.rect(-36, 38, 72, 9, WHITE());
      P.ellipse(0, 64, 19, 8, C("#eb5f73"));
      P.pie(0, 38, 47, 37, 0, 180, null, C("#641420"), 2.7);
      P.ellipse(-64, -4, 4, 7, C("#82cdff")); P.ellipse(64, -4, 4, 7, C("#82cdff"));
    } else if (mood === "smile") {
      eyeOpen(-38); eyeOpen(38); brows(-38); cheeks(0.3); nose(); smile();
    } else if (mood === "sad") {
      eyeOpen(-38); eyeOpen(38);
      P.line(-54, -30, -26, -43, browC, 4); P.line(26, -43, 54, -30, browC, 4);
      nose(); P.arc(0, 62, 28, 22, 200, 140, dark, 5); P.ellipse(-52, 12, 4.5, 8, C("#82cdff"));
    } else if (mood === "cry") {
      eyeShut(-38); eyeShut(38);
      P.line(-54, -30, -26, -43, browC, 4); P.line(26, -43, 54, -30, browC, 4);
      nose(); P.rrect(-60, -2, 9, 54, 4.5, C("#74c0ff@0.85")); P.rrect(51, -2, 9, 54, 4.5, C("#74c0ff@0.85"));
      P.ellipse(0, 52, 18, 13, red, C("#641420"), 2);
    } else if (mood === "angry") {
      P.ellipse(0, 0, 100, 93, C("#ff3b30@0.16"));
      eyeOpen(-38); eyeOpen(38);
      P.line(-56, -42, -24, -26, browC, 6); P.line(24, -26, 56, -42, browC, 6);
      nose(); P.arc(0, 64, 26, 18, 200, 140, dark, 5);
    } else if (mood === "surprised") {
      for (const s of [-1, 1]) { P.circle(s * 38, -12, 12, WHITE(), dark, 2.5); P.circle(s * 38, -12, 5.5, dark); }
      brows(-52); nose(); P.ellipse(0, 46, 12, 17, red, C("#641420"), 2.5);
    } else if (mood === "wink") {
      eyeOpen(-38); eyeJoy(38); brows(-38); cheeks(0.3); nose(); smile(38, 28);
    } else if (mood === "sleep") {
      eyeShut(-38); eyeShut(38); nose(); P.ellipse(0, 46, 8, 6, C("#c0505e"));
      P.text("Z", 78, -118, 34, C("#3b6fd8")); P.text("z", 108, -150, 24, C("#3b6fd8"));
    } else if (mood === "love") {
      P.poly(heartPts(-38, -12, 15), C("#e91e63")); P.poly(heartPts(38, -12, 15), C("#e91e63"));
      cheeks(0.5); nose(); smile(38, 28);
    } else if (mood === "cool") {
      P.rrect(-66, -30, 54, 30, 10, C("#111")); P.rrect(12, -30, 54, 30, 10, C("#111")); P.line(-12, -22, 12, -22, C("#111"), 4);
      P.line(-56, -24, -42, -24, WHITE(0.45), 3); P.line(22, -24, 36, -24, WHITE(0.45), 3);
      nose(); smile(34, 24);
    } else { // neutral
      P.circle(-38, -12, 5.5, dark); P.circle(38, -12, 5.5, dark); nose(); P.line(-18, 46, 18, 46, dark, 4.5);
    }
  });
}
def("People", "face", "cx cy r [mood] [skin] [hair]", "cartoon head. mood: smile laugh sad cry angry surprised wink sleep love cool neutral. hair none = bald", (a, P) => faceDraw(P, a.cx, a.cy, a.r, a.mood, a.skin, a.hair));
def("People", "person", "cx baseY h [mood] [shirt] [pants] [skin] [hair] [pose]", "whole cartoon person standing on baseY. pose: down (default), up, wave", (a, P) => {
  const sk = a.skin || C("skin"), sc = a.shirt || C("#e74c3c"), pc = a.pants || C("#2c3e8f"), pose = (a.pose || "down").toLowerCase();
  P.at(a.cx, a.baseY, a.h / 104, () => {
    P.ellipse(0, 0, 26, 4.5, BLACK(0.2));
    const arm = (sx, sy, ex, ey) => { P.line(sx, sy, ex, ey, sk, 6.5); P.line(sx, sy, sx + (ex - sx) * 0.4, sy + (ey - sy) * 0.4, sc, 9.5); P.circle(ex, ey, 4.2, sk); };
    P.rrect(-13, -42, 11, 40, 4.5, pc); P.rrect(2, -42, 11, 40, 4.5, pc);
    P.ellipse(-8, -2, 10, 5, C("#2b2b2b")); P.ellipse(8, -2, 10, 5, C("#2b2b2b"));
    P.rrect(-16, -72, 32, 36, 9, sc);
    if (pose === "up" || pose === "cheer") { arm(-15, -68, -32, -92); arm(15, -68, 32, -92); }
    else if (pose === "wave" || pose === "hello") { arm(-15, -68, -21, -44); arm(15, -68, 34, -90); }
    else { arm(-15, -68, -21, -44); arm(15, -68, 21, -44); }
    P.rect(-4, -77, 8, 10, sk);
    faceDraw(P, 0, -87, 14, a.mood, sk, a.hair);
  });
});
def("People", "stick", "cx baseY h [color]", "simple stick figure", (a, P) => P.at(a.cx, a.baseY, a.h / 100, () => {
  const c = a.color || C("#222");
  P.circle(0, -88, 12, WHITE(), c, 4);
  P.line(0, -76, 0, -38, c, 4.5); P.line(0, -68, -24, -46, c, 4.5); P.line(0, -68, 24, -46, c, 4.5);
  P.line(0, -38, -16, 0, c, 4.5); P.line(0, -38, 16, 0, c, 4.5);
}));

// ---------------------------------------------------------------------
// BUILDINGS & OBJECTS
// ---------------------------------------------------------------------
function windowDraw(P, x, y, w, h) {
  P.rect(x - w * 0.08, y - h * 0.08, w * 1.16, h * 1.16, C("#f6f2e8"), C("#8a8a80"), 1.5);
  P.rect(x, y, w, h, P.linGrad(x, y, x + w, y + h, [[0, C("#bfe6ff")], [1, C("#6fb4e8")]]));
  P.line(x + w / 2, y, x + w / 2, y + h, C("#f6f2e8"), Math.max(2, w * 0.05));
  P.line(x, y + h / 2, x + w, y + h / 2, C("#f6f2e8"), Math.max(2, w * 0.05));
  P.poly([[x + w * 0.08, y + h * 0.08], [x + w * 0.4, y + h * 0.08], [x + w * 0.08, y + h * 0.4]], WHITE(0.35));
}
def("Buildings", "house", "x y w h [wall] [roof]", "house with roof, door, 2 windows, chimney. x,y = top-left of the walls (roof goes above y)", (a, P) => {
  const { x, y, w, h } = a, wc = a.wall || C("#f3d9a4"), rc = a.roof || C("#b5452f"), wood = C("wood");
  P.rect(x + w * 0.68, y - h * 0.55, w * 0.1, h * 0.45, C("#8d4a37"), C("#5d3224"), 2);
  P.rect(x, y, w, h, wc, shade(wc, -0.4), 2.5);
  P.rect(x, y + h * 0.9, w, h * 0.1, BLACK(0.08));
  P.poly([[x - w * 0.08, y], [x + w * 0.5, y - h * 0.58], [x + w * 1.08, y]], rc, shade(rc, -0.4), 2.5);
  P.poly([[x + w * 0.5, y - h * 0.58], [x + w * 1.08, y], [x + w * 0.5, y]], BLACK(0.14));
  P.circle(x + w * 0.5, y - h * 0.22, w * 0.06, C("glass"), C("#f4f1ea"), 3);
  const dw = w * 0.2, dh = h * 0.52;
  P.rrect(x + w * 0.4, y + h - dh, dw, dh, 3, wood, shade(wood, -0.4), 2.5);
  P.circle(x + w * 0.4 + dw * 0.8, y + h - dh * 0.45, Math.max(2, w * 0.012), C("gold"));
  windowDraw(P, x + w * 0.1, y + h * 0.2, w * 0.2, h * 0.28);
  windowDraw(P, x + w * 0.7, y + h * 0.2, w * 0.2, h * 0.28);
});
def("Buildings", "building", "x y w h [color]", "tall building with rows of lit windows. x,y = top-left", (a, P) => {
  const c = a.color || C("#5d6d7e");
  P.rect(a.x, a.y, a.w, a.h, c, shade(c, -0.4), 2);
  P.rect(a.x, a.y, a.w, Math.max(4, a.h * 0.03), shade(c, -0.2));
  const cols = Math.max(1, Math.floor(a.w / 26)), rows = Math.max(1, Math.floor((a.h - 20) / 34)), ww = a.w / cols;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) P.rect(a.x + k * ww + ww * 0.2, a.y + 14 + r * 34, ww * 0.6, 20, P.rnd() > 0.45 ? C("#ffe27a") : C("#2c3e50"));
});
def("Buildings", "window", "x y w h", "window with frame, cross bars and glass shine", (a, P) => windowDraw(P, a.x, a.y, a.w, a.h));
def("Buildings", "door", "x y w h [color]", "door with knob (x,y = top-left)", (a, P) => {
  const c = a.color || C("wood");
  P.rrect(a.x, a.y, a.w, a.h, Math.min(6, a.w / 5), c, shade(c, -0.4), 2.5);
  P.rect(a.x + a.w * 0.15, a.y + a.h * 0.1, a.w * 0.7, a.h * 0.35, null, shade(c, -0.25), 2);
  P.circle(a.x + a.w * 0.8, a.y + a.h * 0.55, Math.max(2, a.w * 0.06), C("gold"));
});
def("Buildings", "castle", "cx baseY w [color]", "castle with towers, gate and flags (w = total width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#b9b4a8"), dk = shade(c, -0.3), rf = C("#c0392b");
  P.rect(-62, -56, 124, 56, c, dk, 2);
  P.rect(-34, -112, 68, 112, shade(c, 0.08), dk, 2);
  for (let i = 0; i < 5; i++) P.rect(-34 + i * 15.5, -122, 10, 10, shade(c, 0.08), dk, 1.5);
  for (const s of [-1, 1]) {
    P.rect(s * 80 - 20, -86, 40, 86, c, dk, 2);
    P.poly([[s * 80 - 27, -86], [s * 80, -134], [s * 80 + 27, -86]], rf, shade(rf, -0.35), 2);
    P.line(s * 80, -134, s * 80, -152, C("#555"), 2.5); P.poly([[s * 80, -152], [s * 80 + 16, -146], [s * 80, -140]], C("#f1c40f"));
    P.rrect(s * 80 - 4, -64, 8, 18, 3, C("#2c3e50"));
  }
  P.pie(0, -28, 14, 28, 180, 180, C("#3b2a1a")); P.rect(-14, -28, 28, 28, C("#3b2a1a"));
  P.rrect(-5, -92, 10, 22, 4, C("#2c3e50"));
  P.line(0, -122, 0, -150, C("#555"), 2.5); P.poly([[0, -150], [18, -143], [0, -136]], rf);
}));
def("Buildings", "fence", "x baseY w [color]", "wooden picket fence starting at x, w wide", (a, P) => {
  const c = a.color || C("#f3ead3");
  P.rect(a.x, a.baseY - 38, a.w, 6, shade(c, -0.12)); P.rect(a.x, a.baseY - 16, a.w, 6, shade(c, -0.12));
  for (let px = a.x; px + 14 <= a.x + a.w + 0.1; px += 20) P.poly([[px, a.baseY], [px + 14, a.baseY], [px + 14, a.baseY - 48], [px + 7, a.baseY - 58], [px, a.baseY - 48]], c, shade(c, -0.35), 1.5);
});
def("Buildings", "streetlight", "x baseY h", "street lamp with glowing light", (a, P) => P.at(a.x, a.baseY, a.h / 100, () => {
  P.circle(19, -96, 46, P.radGrad(19, -96, 46, [[0, C("#ffe9a0@0.6")], [1, C("#ffe9a0@0")]]));
  P.rect(-6, -5, 12, 5, C("#333")); P.rect(-2.5, -100, 5, 96, C("#444"));
  P.poly([[-2, -102], [20, -108], [20, -104], [-2, -98]], C("#444"));
  P.poly([[10, -108], [28, -108], [24, -98], [14, -98]], C("#333")); P.ellipse(19, -97, 5.5, 2.8, C("#fff3b0"));
}));
def("Buildings", "flag", "x baseY h color", "flag on a pole (h = pole height)", (a, P) => {
  const top = a.baseY - a.h, fw = a.h * 0.5, fh = a.h * 0.3, up = [], dn = [];
  for (let i = 0; i <= 10; i++) { const o = Math.sin(i * 0.7) * a.h * 0.025; up.push([a.x + 3 + (fw * i) / 10, top + 4 + o]); dn.push([a.x + 3 + (fw * i) / 10, top + 4 + fh + o]); }
  P.line(a.x, a.baseY, a.x, top, C("#777"), 4); P.circle(a.x, top - 2, 4, C("gold"));
  P.poly([...up, ...dn.reverse()], a.color, shade(a.color, -0.35), 1.5);
});

// ---------------------------------------------------------------------
// VEHICLES & THINGS
// ---------------------------------------------------------------------
def("Vehicles", "car", "cx baseY w [color]", "side-view car facing right (cx = middle, baseY = ground line, w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#d62828"), gl = C("#bfe6ff");
  P.ellipse(0, -1, 100, 8, BLACK(0.22));
  P.rrect(-100, -62, 200, 38, 12, c, shade(c, -0.4), 2);
  P.poly([[-64, -62], [-40, -96], [32, -96], [66, -62]], shade(c, 0.05), shade(c, -0.4), 2);
  P.poly([[-54, -65], [-37, -91], [-4, -91], [-4, -65]], gl, shade(c, -0.4), 1.5);
  P.poly([[4, -65], [4, -91], [30, -91], [54, -65]], gl, shade(c, -0.4), 1.5);
  P.line(-4, -62, -4, -28, shade(c, -0.4), 2); P.line(8, -50, 20, -50, shade(c, -0.5), 3);
  P.ellipse(96, -48, 6, 8, C("#fff3a8")); P.rect(-101, -52, 6, 12, C("#ff3b30"));
  P.rrect(-102, -34, 204, 9, 4, C("#444"));
  for (const x of [-60, 62]) { P.circle(x, -20, 22, C("#222")); P.circle(x, -20, 12, C("#c8ccd2")); P.circle(x, -20, 4.5, C("#555")); }
}));
def("Vehicles", "bus", "cx baseY w [color]", "side-view bus (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 260, () => {
  const c = a.color || C("#f4b400");
  P.ellipse(0, -1, 130, 8, BLACK(0.22));
  P.rrect(-130, -100, 260, 76, 10, c, shade(c, -0.4), 2);
  P.rect(-130, -50, 260, 7, shade(c, -0.2));
  for (let i = 0; i < 5; i++) P.rrect(-118 + i * 38, -90, 30, 32, 4, C("#bfe6ff"), shade(c, -0.4), 1.5);
  P.rrect(88, -90, 32, 52, 4, C("#bfe6ff"), shade(c, -0.4), 1.5);
  P.ellipse(126, -38, 5, 8, C("#fff3a8"));
  for (const x of [-80, 74]) { P.circle(x, -22, 22, C("#222")); P.circle(x, -22, 11, C("#c8ccd2")); }
}));
def("Vehicles", "boat", "cx baseY w [hull] [sail]", "sailing boat (baseY = water line, w = hull length)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const h = a.hull || C("#8d4a2b"), s = a.sail || C("white");
  P.line(0, -26, 0, -158, C("#6b4a2a"), 4.5);
  P.poly([[5, -152], [5, -34], [86, -34]], s, shade(s, -0.3), 1.5);
  P.poly([[-5, -140], [-5, -34], [-62, -34]], shade(s, -0.08), shade(s, -0.3), 1.5);
  P.poly([[0, -158], [18, -152], [0, -146]], C("#e53935"));
  P.poly([[-100, -26], [100, -26], [76, 0], [-76, 0]], h, shade(h, -0.4), 2);
  P.rect(-92, -18, 184, 5, WHITE(0.8));
  P.ellipse(0, 2, 118, 7, C("#2b7bd8@0.35"));
}));
def("Vehicles", "plane", "cx cy w [color]", "airplane side view facing right", (a, P) => P.at(a.cx, a.cy, a.w / 220, () => {
  const c = a.color || C("#d62828");
  P.poly([[-95, -4], [-118, -48], [-96, -48], [-52, -8]], c, shade(c, -0.4), 2);
  P.poly([[-6, 6], [-48, 52], [-22, 52], [34, 6]], shade(c, -0.15), shade(c, -0.5), 2);
  P.ellipse(0, 0, 112, 22, C("#f2f4f7"), C("#9aa3ad"), 2);
  P.arc(70, -8, 30, 14, 200, 120, C("#7fb8e8"), 5);
  P.rect(-100, 4, 190, 5, c);
  for (let x = -62; x <= 44; x += 14) P.circle(x, -5, 3.2, C("#6fb4e8"));
  P.poly([[10, -8], [-34, -34], [-14, -34], [38, -8]], shade(c, -0.05), shade(c, -0.5), 2);
}));
def("Vehicles", "rocket", "cx cy h [body]", "upright rocket with flame (cx,cy = center, h = body height)", (a, P) => P.at(a.cx, a.cy, a.h / 100, () => {
  const b = a.body || C("#e8e8ee");
  P.poly([[-9, 24], [9, 24], [0, 56]], C("#ff9a1f")); P.poly([[-5, 24], [5, 24], [0, 42]], C("#ffe14d"));
  P.poly([[-14, 5], [-36, 34], [-14, 26]], C("#d62828")); P.poly([[14, 5], [36, 34], [14, 26]], C("#d62828"));
  P.rect(-14, -32, 28, 58, b, shade(b, -0.35), 1.5);
  P.poly([[0, -52], [14, -32], [-14, -32]], C("#d62828"), shade(C("#d62828"), -0.35), 1.5);
  P.rect(3, -32, 11, 58, BLACK(0.1));
  P.circle(0, -12, 8, WHITE(), C("#8a93a0"), 2); P.circle(0, -12, 5.5, C("#46a0e6"));
}));
def("Vehicles", "ufo", "cx cy w", "flying saucer with light beam", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  P.poly([[-30, 8], [30, 8], [74, 110], [-74, 110]], C("#fff176@0.25"));
  P.pie(0, -6, 46, 42, 180, 180, C("#bfe9ff@0.85"), C("#7fb8d8"), 2);
  P.ellipse(0, 6, 100, 24, C("#aab4c4"), C("#7d889a"), 2);
  P.ellipse(0, 1, 80, 12, alpha(WHITE(), 0.35));
  [-62, -31, 0, 31, 62].forEach((x, i) => P.circle(x, 9, 5, i % 2 ? C("#ffd23f") : C("#ff5a5a")));
}));
def("Vehicles", "balloon", "cx cy r color", "hot-air style balloon with string (r = horizontal radius)", (a, P) => {
  P.curve([[a.cx, a.cy + a.r * 1.5], [a.cx + a.r * 0.3, a.cy + a.r * 2.2], [a.cx - a.r * 0.2, a.cy + a.r * 3], [a.cx, a.cy + a.r * 3.6]], C("#666"), 1.8);
  P.poly([[a.cx, a.cy + a.r * 1.15], [a.cx - a.r * 0.18, a.cy + a.r * 1.45], [a.cx + a.r * 0.18, a.cy + a.r * 1.45]], shade(a.color, -0.2));
  P.ellipse(a.cx, a.cy, a.r, a.r * 1.2, P.radGrad(a.cx, a.cy, a.r * 1.6, [[0, shade(a.color, 0.3)], [1, shade(a.color, -0.15)]], a.cx - a.r * 0.35, a.cy - a.r * 0.4));
  P.ellipse(a.cx - a.r * 0.4, a.cy - a.r * 0.5, a.r * 0.14, a.r * 0.26, WHITE(0.55));
});

// ---------------------------------------------------------------------
// SPACE
// ---------------------------------------------------------------------
def("Space", "planet", "cx cy r color [c2]", "planet with shading. give c2 to add a ring in that color", (a, P) => {
  P.at(a.cx, a.cy, a.r / 100, () => {
    P.push(); P.rotate(-18);
    if (a.c2) P.arc(0, 0, 175, 42, 180, 180, alpha(a.c2, 0.9), 14);
    P.pop();
    P.circle(0, 0, 100, P.radGrad(0, 0, 140, [[0, shade(a.color, 0.4)], [0.55, a.color], [1, shade(a.color, -0.55)]], -35, -35));
    P.arc(0, -20, 90, 10, 200, 140, alpha(shade(a.color, -0.3), 0.35), 8);
    P.arc(0, 30, 96, 12, 20, 140, alpha(shade(a.color, 0.3), 0.3), 8);
    P.push(); P.rotate(-18);
    if (a.c2) P.arc(0, 0, 175, 42, 0, 180, alpha(a.c2, 0.95), 14);
    P.pop();
  });
});
def("Space", "earth", "cx cy r", "planet Earth (blue ocean, green land, white clouds)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  P.circle(0, 0, 150, P.radGrad(0, 0, 150, [[0.6, C("#6fc3ff@0.45")], [1, C("#6fc3ff@0")]]));
  P.circle(0, 0, 100, P.radGrad(0, 0, 140, [[0, C("#4aa8ff")], [0.7, C("#1e5fbf")], [1, C("#0b2a63")]], -30, -30));
  P.blob([[-60, -50], [-30, -66], [-8, -40], [-20, -10], [-48, -4], [-70, -24]], C("#4caf50"));
  P.blob([[10, 6], [40, -6], [66, 12], [58, 52], [30, 70], [12, 40]], C("#43a047"));
  P.blob([[-50, 40], [-30, 34], [-20, 56], [-40, 70]], C("#66bb6a"));
  P.arc(-20, -70, 40, 10, 190, 150, WHITE(0.7), 6); P.arc(30, 20, 50, 9, 200, 130, WHITE(0.6), 6); P.arc(-30, 60, 40, 8, 30, 110, WHITE(0.6), 5);
}));

// ---------------------------------------------------------------------
// FOOD
// ---------------------------------------------------------------------
def("Food", "apple", "cx cy r [color]", "apple with stem and leaf (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#d62828");
  P.line(0, -70, 6, -108, C("#6d4c2a"), 6);
  P.blob([[8, -96], [34, -116], [56, -100], [32, -90]], C("#4caf50"), C("#2e7d32"), 1.5);
  P.ellipse(-30, 6, 74, 88, c); P.ellipse(30, 6, 74, 88, c);
  P.ellipse(0, 30, 76, 66, c);
  P.ellipse(-36, -12, 14, 26, WHITE(0.35));
  P.ellipse(0, -68, 12, 7, shade(c, -0.4));
}));
def("Food", "icecream", "cx baseY h [c1] [c2]", "ice cream cone with 2 scoops and cherry (c1 bottom scoop, c2 top scoop)", (a, P) => P.at(a.cx, a.baseY, a.h / 118, () => {
  const c1 = a.c1 || C("#ffb3c7"), c2 = a.c2 || C("#fff2c4");
  P.poly([[-24, -54], [24, -54], [0, 0]], C("#e0a85a"), C("#b8863c"), 2);
  for (let i = 1; i < 4; i++) { P.line(-24 + i * 4, -54 + i * 13, 24 - i * 4 + 6, -54 + i * 13 + 4, C("#b8863c"), 1.5); P.line(24 - i * 4, -54 + i * 13, -24 + i * 4 - 6, -54 + i * 13 + 4, C("#b8863c"), 1.5); }
  P.blob([[-30, -56], [-20, -44], [-8, -52], [4, -42], [18, -52], [30, -56]], c1);
  P.circle(0, -68, 30, c1, shade(c1, -0.3), 2);
  P.circle(0, -94, 24, c2, shade(c2, -0.3), 2);
  P.circle(-9, -75, 7, WHITE(0.4)); P.circle(-7, -100, 6, WHITE(0.5));
  P.circle(0, -122, 8, C("#d62828")); P.line(2, -129, 12, -142, C("#4a7a2a"), 2);
}));
def("Food", "cake", "cx baseY w [color]", "birthday cake with candles (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#f6a6c0"), cream = C("#fff3e0");
  P.ellipse(0, 0, 112, 9, C("#c9c9d0"));
  P.rrect(-90, -50, 180, 50, 8, c, shade(c, -0.35), 2);
  P.rrect(-66, -96, 132, 46, 8, shade(c, 0.2), shade(c, -0.35), 2);
  P.blob([[-90, -50], [-72, -38], [-54, -50], [-36, -36], [-18, -50], [0, -38], [18, -50], [36, -36], [54, -50], [72, -38], [90, -50]], cream);
  P.blob([[-66, -96], [-50, -84], [-34, -96], [-16, -84], [0, -96], [16, -84], [34, -96], [50, -84], [66, -96]], cream);
  [-36, 0, 36].forEach((x, i) => {
    P.rect(x - 4, -128, 8, 32, [C("#4fc3f7"), C("#ffd54f"), C("#81c784")][i], C("#555"), 1);
    P.ellipse(x, -135, 5, 9, C("#ff9a1f")); P.ellipse(x, -133, 2.5, 5, C("#ffe14d"));
  });
  for (let x = -76; x <= 76; x += 38) P.circle(x, -28, 5, C("#d62828"));
}));

// ---------------------------------------------------------------------
// DIAGRAMS (flowcharts, mind maps, charts)
// ---------------------------------------------------------------------
function fitText(P, label, cx, cy, w, h, color, maxSize = 30) {
  const lines = String(label).split(/\||\\n/);
  const longest = lines.reduce((m, s) => (s.length > m.length ? s : m), "");
  let size = Math.min(maxSize, (h * 0.78) / (lines.length * 1.2));
  while (size > 9 && P.measure(longest, size, true) > w * 0.9) size -= 1;
  size = Math.max(9, size);
  P.text(label, cx, cy - size * 0.55 - (lines.length - 1) * size * 0.6, size, color, true, "center");
}
function arrowHead(P, x1, y1, x2, y2, color, lw) {
  const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(10, lw * 4.2), W = L * 0.5;
  const bx = x2 - L * Math.cos(ang), by = y2 - L * Math.sin(ang);
  P.poly([[x2, y2], [bx + W * Math.sin(ang), by - W * Math.cos(ang)], [bx - W * Math.sin(ang), by + W * Math.cos(ang)]], color);
}
def("Diagram", "box", "x y w h label [fill] [textcolor]", "rounded box with centered text (use | for 2 lines). x,y = top-left", (a, P) => {
  const f = a.fill || C("skyblue"), r = Math.min(14, a.h / 4);
  P.rrect(a.x + 3, a.y + 4, a.w, a.h, r, BLACK(0.12));
  P.rrect(a.x, a.y, a.w, a.h, r, f, shade(f, -0.35), 2.5);
  fitText(P, a.label, a.x + a.w / 2, a.y + a.h / 2, a.w, a.h, a.textcolor || autoText(f));
});
def("Diagram", "pill", "x y w h label [fill] [textcolor]", "pill-shaped box (flowchart start / end). x,y = top-left", (a, P) => {
  const f = a.fill || C("#a5d6a7");
  P.rrect(a.x + 3, a.y + 4, a.w, a.h, a.h / 2, BLACK(0.12));
  P.rrect(a.x, a.y, a.w, a.h, a.h / 2, f, shade(f, -0.35), 2.5);
  fitText(P, a.label, a.x + a.w / 2, a.y + a.h / 2, a.w - a.h * 0.4, a.h, a.textcolor || autoText(f));
});
def("Diagram", "diamond", "cx cy w h label [fill] [textcolor]", "diamond (flowchart decision), cx,cy = center", (a, P) => {
  const f = a.fill || C("#ffe082"), pts = [[a.cx, a.cy - a.h / 2], [a.cx + a.w / 2, a.cy], [a.cx, a.cy + a.h / 2], [a.cx - a.w / 2, a.cy]];
  P.poly(pts.map(([x, y]) => [x + 3, y + 4]), BLACK(0.12));
  P.poly(pts, f, shade(f, -0.35), 2.5);
  fitText(P, a.label, a.cx, a.cy, a.w * 0.62, a.h * 0.7, a.textcolor || autoText(f), 24);
});
def("Diagram", "node", "cx cy r label [fill] [textcolor]", "circle with text inside (mind-map / graph node), cx,cy = center", (a, P) => {
  const f = a.fill || C("#ce93d8");
  P.circle(a.cx + 3, a.cy + 4, a.r, BLACK(0.12));
  P.circle(a.cx, a.cy, a.r, f, shade(f, -0.35), 2.5);
  fitText(P, a.label, a.cx, a.cy, a.r * 1.5, a.r * 1.4, a.textcolor || autoText(f), 26);
});
def("Diagram", "arrow", "x1 y1 x2 y2 [color] [lw]", "line with an arrow head pointing at x2,y2", (a, P) => {
  const c = a.color || C("#333"), lw = a.lw ?? 3, ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(10, lw * 4.2) * 0.7;
  P.line(a.x1, a.y1, a.x2 - Math.cos(ang) * L, a.y2 - Math.sin(ang) * L, c, lw);
  arrowHead(P, a.x1, a.y1, a.x2, a.y2, c, lw);
});
def("Diagram", "elbow", "x1 y1 x2 y2 [color] [lw]", "arrow that goes horizontally first, then vertically, ending at x2,y2", (a, P) => {
  const c = a.color || C("#333"), lw = a.lw ?? 3, L = Math.max(10, lw * 4.2) * 0.7, dir = Math.sign(a.y2 - a.y1) || 1;
  P.polyline([[a.x1, a.y1], [a.x2, a.y1], [a.x2, a.y2 - dir * L]], c, lw);
  arrowHead(P, a.x2, a.y1, a.x2, a.y2, c, lw);
});
def("Diagram", "elbowv", "x1 y1 x2 y2 [color] [lw]", "arrow that goes vertically first, then horizontally, ending at x2,y2", (a, P) => {
  const c = a.color || C("#333"), lw = a.lw ?? 3, L = Math.max(10, lw * 4.2) * 0.7, dir = Math.sign(a.x2 - a.x1) || 1;
  P.polyline([[a.x1, a.y1], [a.x1, a.y2], [a.x2 - dir * L, a.y2]], c, lw);
  arrowHead(P, a.x1, a.y2, a.x2, a.y2, c, lw);
});
def("Diagram", "grid", "x y w h step [color]", "graph-paper grid lines", (a, P) => {
  const c = a.color || C("#c8d0d8@0.8");
  for (let gx = 0; gx <= a.w + 0.1; gx += a.step) P.line(a.x + gx, a.y, a.x + gx, a.y + a.h, c, 1.2);
  for (let gy = 0; gy <= a.h + 0.1; gy += a.step) P.line(a.x, a.y + gy, a.x + a.w, a.y + gy, c, 1.2);
});
function chartAxes(P, x, y, w, h, top, ticks = 4) {
  const padL = 46, padB = 34, padT = 16, px = x + padL, py = y + padT, pw = w - padL - 8, ph = h - padT - padB;
  for (let i = 0; i <= ticks; i++) {
    const gy = py + ph - (ph * i) / ticks, v = (top * i) / ticks;
    P.line(px, gy, px + pw, gy, i === 0 ? C("#444") : C("#d5dbe1"), i === 0 ? 2.5 : 1.2);
    P.text(String(Math.round(v * 100) / 100), px - 8, gy - 8, 14, C("#555"), false, "right");
  }
  P.line(px, py, px, py + ph, C("#444"), 2.5);
  return { px, py, pw, ph };
}
function niceTop(max) {
  if (!(max > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
function labelValues(items, name) {
  if (items.length < 2 || items.length % 2) throw new Error(`${name} needs pairs: label value label value ...`);
  const out = [];
  for (let i = 0; i < items.length; i += 2) {
    const v = Number(items[i + 1]);
    if (Number.isNaN(v)) throw new Error(`${name}: '${items[i + 1]}' is not a number`);
    out.push([String(items[i]), v]);
  }
  return out;
}
def("Charts", "barchart", "x y w h style items...", "bar chart. style = a color name or multi. items = label value label value ... (x,y,w,h = whole chart area)", (a, P) => {
  const data = labelValues(a.items, "barchart"), top = niceTop(Math.max(...data.map((d) => d[1])));
  const { px, py, pw, ph } = chartAxes(P, a.x, a.y, a.w, a.h, top);
  const slot = pw / data.length, bw = Math.min(slot * 0.62, 90), one = a.style && a.style !== "multi" ? C(a.style) : null;
  data.forEach(([lab, v], i) => {
    const c = one || PALETTE[i % PALETTE.length], bh = (ph * v) / top, bx = px + slot * i + (slot - bw) / 2;
    P.rect(bx, py + ph - bh, bw, bh, c, shade(c, -0.3), 1.5);
    P.text(String(Math.round(v * 100) / 100), bx + bw / 2, py + ph - bh - 20, 15, C("#222"), true, "center");
    P.text(lab, bx + bw / 2, py + ph + 8, 15, C("#333"), false, "center");
  });
});
def("Charts", "linechart", "x y w h color values...", "line chart through the numbers (x,y,w,h = whole chart area)", (a, P) => {
  const vals = a.values, top = niceTop(Math.max(...vals));
  if (vals.length < 2) throw new Error("linechart needs at least 2 values");
  const { px, py, pw, ph } = chartAxes(P, a.x, a.y, a.w, a.h, top);
  const pts = vals.map((v, i) => [px + (pw * (i + 0.5)) / vals.length, py + ph - (ph * v) / top]);
  P.poly([[pts[0][0], py + ph], ...pts, [pts[pts.length - 1][0], py + ph]], alpha(a.color, 0.18));
  P.polyline(pts, a.color, 4);
  pts.forEach((p, i) => { P.circle(p[0], p[1], 6, WHITE(), a.color, 3); P.text(String(i + 1), p[0], py + ph + 8, 14, C("#333"), false, "center"); });
});
def("Charts", "piechart", "cx cy r items...", "pie chart with percent and legend. items = label value label value ...", (a, P) => {
  const data = labelValues(a.items, "piechart"), total = data.reduce((s, d) => s + d[1], 0);
  if (!(total > 0)) throw new Error("piechart values must add up to more than 0");
  let ang = -90;
  data.forEach(([lab, v], i) => {
    const sw = (v / total) * 360, c = PALETTE[i % PALETTE.length], mid = ((ang + sw / 2) * Math.PI) / 180;
    P.pie(a.cx, a.cy, a.r, a.r, ang, sw, c, WHITE(), 2.5);
    if (sw > 22) P.text(Math.round((v / total) * 100) + "%", a.cx + a.r * 0.62 * Math.cos(mid), a.cy + a.r * 0.62 * Math.sin(mid) - 10, 18, WHITE(), true, "center");
    ang += sw;
  });
  const lx = a.cx + a.r + 30, ly = a.cy - (data.length * 30) / 2;
  data.forEach(([lab, v], i) => {
    P.rect(lx, ly + i * 30, 18, 18, PALETTE[i % PALETTE.length], shade(PALETTE[i % PALETTE.length], -0.3), 1.5);
    P.text(`${lab} (${Math.round(v * 100) / 100})`, lx + 28, ly + i * 30 - 1, 17, C("#222"), false, "left");
  });
});
// =====================================================================
// PART 3a - EXTRA COMMANDS (more things people like to ask for)
// =====================================================================
// "cat" and "dog" now mean the WHOLE animal (catface / dogface are the heads only)
delete ALIASES.cat;
delete ALIASES.dog;

def("Objects", "cat", "cx baseY h [color]", "whole sitting cat with tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#f0a14a"), dk = shade(c, -0.35);
  P.ellipse(0, -1, 62, 7, BLACK(0.2));
  P.curve([[38, -16], [74, -22], [90, -56], [74, -96]], dk, 17);
  P.curve([[38, -16], [74, -22], [90, -56], [74, -96]], c, 12);
  P.ellipse(0, -48, 50, 50, c, dk, 2.5);
  P.ellipse(0, -40, 28, 36, shade(c, 0.5));
  for (const s of [-1, 1]) {
    P.ellipse(s * 22, -9, 15, 10, c, dk, 2);
    P.line(s * 22 - 4, -6, s * 22 - 4, -12, dk, 1.6); P.line(s * 22 + 4, -6, s * 22 + 4, -12, dk, 1.6);
  }
  CMDS.get("catface").fn({ cx: 0, cy: -104, r: 46, color: c }, P);
}));
def("Objects", "dog", "cx baseY h [color]", "whole sitting dog with wagging tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#d9a066"), dk = shade(c, -0.35);
  P.ellipse(0, -1, 62, 7, BLACK(0.2));
  P.curve([[38, -14], [66, -24], [78, -52], [72, -76]], dk, 15);
  P.curve([[38, -14], [66, -24], [78, -52], [72, -76]], c, 10);
  P.ellipse(0, -46, 48, 48, c, dk, 2.5);
  P.ellipse(0, -38, 26, 34, C("#f7e8d2"));
  for (const s of [-1, 1]) {
    P.ellipse(s * 22, -9, 15, 10, c, dk, 2);
    P.line(s * 22 - 4, -6, s * 22 - 4, -12, dk, 1.6); P.line(s * 22 + 4, -6, s * 22 + 4, -12, dk, 1.6);
  }
  P.rrect(-24, -88, 48, 8, 4, C("#e53935"));
  CMDS.get("dogface").fn({ cx: 0, cy: -106, r: 44, color: c }, P);
}));

def("Objects", "speech", "cx cy w h str [fill] [textcolor]", "speech bubble with a tail pointing down-left and text inside (use | for 2 lines)", (a, P) => {
  const f = a.fill || WHITE(), ln = C("#333"), x = a.cx - a.w / 2, by = a.cy + a.h / 2, bx = a.cx - a.w * 0.25;
  P.poly([[bx - 16, by], [bx + 16, by], [bx - 22, by + a.h * 0.45]], f, ln, 3);
  P.rrect(x, a.cy - a.h / 2, a.w, a.h, Math.min(26, a.h / 3), f, ln, 3);
  P.rect(bx - 14, by - 2, 29, 5, f);
  fitText(P, a.str, a.cx, a.cy, a.w - 14, a.h, a.textcolor || C("#222"), 40);
});

def("Objects", "snowman", "cx baseY h", "snowman with top hat, red scarf and carrot nose (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 154, () => {
  const ed = C("#aebfd6"), br = C("#6d4c2a"), red = C("#d62828");
  const ball = (y, r) => P.circle(0, y, r, P.radGrad(0, y, r * 1.3, [[0, WHITE()], [1, C("#c4d4ec")]], -r * 0.3, y - r * 0.4), ed, 2.5);
  P.ellipse(0, -1, 52, 6, BLACK(0.15));
  for (const s of [-1, 1]) {
    P.line(s * 20, -76, s * 64, -98, br, 4); P.line(s * 44, -89, s * 50, -105, br, 3); P.line(s * 52, -93, s * 62, -90, br, 2.5);
  }
  ball(-32, 34); ball(-78, 25); ball(-112, 19);
  P.circle(-7, -116, 2.8, C("#222")); P.circle(7, -116, 2.8, C("#222"));
  P.poly([[0, -111], [23, -107], [0, -104]], C("#ff8a1f"), C("#c95a00"), 1);
  [[-9, -102], [-5, -99], [0, -98], [5, -99], [9, -102]].forEach(([x, y]) => P.circle(x, y, 1.8, C("#222")));
  [-82, -72, -62].forEach((y) => P.circle(0, y, 3.2, C("#222")));
  [-40, -26].forEach((y) => P.circle(0, y, 3.4, C("#222")));
  P.rrect(-22, -99, 44, 9, 4.5, red, shade(red, -0.3), 1.5);
  P.rrect(7, -94, 11, 30, 4, red, shade(red, -0.3), 1.5);
  P.ellipse(0, -128, 25, 5, C("#222"));
  P.rrect(-15, -153, 30, 26, 3, C("#222"));
  P.rect(-15, -136, 30, 6, red);
}));

def("Objects", "robot", "cx baseY h [body]", "friendly robot with glowing eyes and antenna (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 186, () => {
  const b = a.body || C("#9fb4c7"), dk = shade(b, -0.5), mid = shade(b, -0.2), glow = C("#59f0ff");
  P.ellipse(0, -1, 58, 6, BLACK(0.2));
  for (const s of [-1, 1]) {
    P.rrect(s * 20 - 9, -36, 18, 34, 4, mid, dk, 2); P.ellipse(s * 22, -4, 19, 7, dk);
    P.rrect(s * 56 - 8, -104, 16, 54, 8, mid, dk, 2); P.circle(s * 56, -48, 9, shade(b, 0.3), dk, 2); P.circle(s * 47, -100, 9, mid, dk, 2);
  }
  P.rrect(-42, -108, 84, 76, 12, b, dk, 2.5);
  P.rrect(-36, -102, 9, 64, 4.5, WHITE(0.28));
  P.rrect(-26, -94, 52, 32, 6, C("#2b3a4a"), dk, 2);
  P.circle(-14, -78, 5.5, C("#ff5252")); P.circle(0, -78, 5.5, C("#ffd740")); P.circle(14, -78, 5.5, C("#69f0ae"));
  [-52, -45, -38].forEach((y) => P.rrect(-22, y, 44, 4, 2, dk));
  P.rect(-9, -118, 18, 12, dk);
  P.rrect(-44, -142, 8, 22, 3, dk); P.rrect(36, -142, 8, 22, 3, dk);
  P.rrect(-36, -166, 72, 48, 14, b, dk, 2.5);
  P.rrect(-28, -157, 56, 26, 10, C("#16222e"));
  for (const x of [-13, 13]) {
    P.circle(x, -144, 17, P.radGrad(x, -144, 17, [[0, alpha(glow, 0.55)], [1, alpha(glow, 0)]]));
    P.circle(x, -144, 8, glow); P.circle(x - 2, -146, 3, WHITE());
  }
  P.rrect(-12, -125, 24, 5, 2.5, dk);
  P.line(0, -166, 0, -181, dk, 3.5);
  P.circle(0, -183, 10, P.radGrad(0, -183, 10, [[0, C("#ff5252@0.6")], [1, C("#ff5252@0")]]));
  P.circle(0, -183, 5, C("#ff5252"), dk, 1.5);
}));

def("Objects", "tent", "cx baseY w [color]", "camping tent with open door and flag (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#e8743b"), ln = shade(c, -0.45);
  P.ellipse(0, 1, 118, 9, BLACK(0.2));
  P.poly([[-100, 0], [0, -130], [100, 0]], c, ln, 3);
  P.poly([[0, -130], [100, 0], [30, 0], [0, -62]], shade(c, -0.2));
  P.poly([[-28, 0], [0, -80], [28, 0]], C("#2b2230"));
  P.poly([[-28, 0], [0, -80], [-8, 0]], shade(c, 0.12), ln, 2);
  P.poly([[28, 0], [0, -80], [8, 0]], shade(c, -0.05), ln, 2);
  P.line(0, -130, 0, -152, C("#6b4a2a"), 4); P.poly([[0, -152], [24, -145], [0, -138]], C("#e53935"));
  for (const s of [-1, 1]) { P.line(s * 100, 0, s * 128, 8, C("#777"), 2); P.line(s * 128, 3, s * 128, 12, C("#555"), 3.5); }
}));

def("Objects", "campfire", "cx baseY s", "campfire with logs, stones and flames (s = about the width)", (a, P) => P.at(a.cx, a.baseY, a.s / 130, () => {
  P.circle(0, -44, 130, P.radGrad(0, -44, 130, [[0, C("#ffb347@0.55")], [1, C("#ff8c00@0")]]));
  [[-62, -4, 12], [-40, 3, 11], [-16, 6, 10], [16, 6, 10], [40, 3, 11], [62, -4, 12]].forEach(([x, y, r], i) => P.ellipse(x, y, r * 1.15, r * 0.85, i % 2 ? C("#8a8f98") : C("#a3a8b0"), C("#5d626b"), 1.5));
  for (const s of [-1, 1]) { P.push(); P.translate(0, -9); P.rotate(s * 22); P.rrect(-54, -8, 108, 16, 8, C("#6b4423"), C("#3e2612"), 2); P.ellipse(s * 52, 0, 5, 8, C("#c9a06a")); P.pop(); }
  P.blob([[-30, -10], [-40, -46], [-18, -72], [-14, -108], [6, -78], [24, -94], [34, -48], [30, -10]], C("#e53935"));
  P.blob([[-20, -10], [-26, -40], [-8, -62], [-4, -90], [10, -64], [20, -74], [24, -40], [20, -10]], C("#ff9a1f"));
  P.blob([[-10, -10], [-14, -32], [0, -50], [12, -32], [10, -10]], C("#ffe14d"));
  [[-44, -90, 3], [40, -110, 2.5], [22, -128, 2], [-24, -124, 2]].forEach(([x, y, r]) => P.circle(x, y, r, C("#ffd54f")));
}));

def("Objects", "umbrella", "cx cy r [color]", "open umbrella (cx,cy = middle of the canopy edge, r = half width)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#e53935"), hd = C("#5a3a22");
  P.line(0, 0, 0, 112, hd, 5); P.arc(-14, 112, 14, 14, 0, 180, hd, 5);
  const xs = [-100, -86.6, -50, 0, 50, 86.6, 100];
  for (let k = 0; k < 6; k++) {
    const col = k % 2 ? WHITE() : c, mx = (xs[k] + xs[k + 1]) / 2, hw = Math.abs(xs[k + 1] - xs[k]) / 2;
    P.pie(mx, 0, hw, 12, 0, 180, col, shade(c, -0.35), 1.5);
    P.pie(0, 0, 100, 80, 180 + k * 30, 30, col, shade(c, -0.35), 1.5);
  }
  P.line(0, -80, 0, -98, C("#555"), 4);
}));

def("Objects", "gift", "cx baseY w [color]", "gift box with ribbon and bow (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 120, () => {
  const c = a.color || C("#2e86de"), rb = C("#ffd23f"), rl = shade(rb, -0.3), dk = shade(c, -0.35);
  P.ellipse(0, 1, 70, 6, BLACK(0.18));
  P.rect(-50, -62, 100, 62, c, dk, 2.5); P.rect(-8, -62, 16, 62, rb, rl, 1.5);
  P.rect(-56, -84, 112, 24, shade(c, 0.12), dk, 2.5); P.rect(-8, -84, 16, 24, rb, rl, 1.5);
  for (const s of [-1, 1]) { P.push(); P.translate(0, -88); P.rotate(s * -28); P.ellipse(s * 20, 0, 22, 12, rb, rl, 2); P.pop(); }
  P.circle(0, -88, 8, shade(rb, -0.1), rl, 2);
}));

def("Objects", "trophy", "cx baseY h", "golden trophy cup with star (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 120, () => {
  const g = C("#ffc83d"), ln = shade(g, -0.5);
  P.ellipse(0, 1, 40, 5, BLACK(0.2));
  P.rrect(-34, -14, 68, 14, 3, C("#7b4a22"), C("#4a2a12"), 2);
  P.rect(-7, -44, 14, 32, g, ln, 2); P.rrect(-20, -50, 40, 10, 3, g, ln, 2);
  P.arc(-40, -88, 16, 20, 90, 180, g, 6); P.arc(40, -88, 16, 20, 270, 180, g, 6);
  P.poly([[-42, -112], [42, -112], [36, -72], [20, -52], [-20, -52], [-36, -72]], g, ln, 2.5);
  P.poly([[-36, -108], [-24, -108], [-18, -72], [-12, -56], [-18, -56], [-30, -72]], WHITE(0.35));
  P.ellipse(0, -112, 42, 6, shade(g, 0.3), ln, 2);
  CMDS.get("star").fn({ cx: 0, cy: -86, r: 15, fill: C("#fff3b0"), stroke: ln, lw: 1.5 }, P);
}));

def("Objects", "clock", "cx cy r [hour] [min]", "wall clock showing a time (default 10:10)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const hh = a.hour ?? 10, mm = a.min ?? 10, dk = C("#2b2b2b");
  P.circle(5, 7, 100, BLACK(0.15));
  P.circle(0, 0, 100, C("#6d4c2a"), C("#3e2612"), 3);
  P.circle(0, 0, 86, C("#fffaf0"), C("#b8a78a"), 2);
  for (let k = 0; k < 12; k++) {
    const t = (k * 30 * Math.PI) / 180, big = k % 3 === 0, r1 = big ? 64 : 72;
    P.line(Math.sin(t) * r1, -Math.cos(t) * r1, Math.sin(t) * 79, -Math.cos(t) * 79, dk, big ? 5 : 2.5);
  }
  P.text("12", 0, -60, 20, dk, true, "center"); P.text("6", 0, 40, 20, dk, true, "center");
  P.text("3", 50, -11, 20, dk, true, "center"); P.text("9", -50, -11, 20, dk, true, "center");
  const ha = (((hh % 12) + mm / 60) * 30 * Math.PI) / 180, ma = (mm * 6 * Math.PI) / 180;
  P.line(0, 0, Math.sin(ha) * 44, -Math.cos(ha) * 44, dk, 7);
  P.line(0, 0, Math.sin(ma) * 64, -Math.cos(ma) * 64, dk, 4.5);
  P.circle(0, 0, 6.5, C("#d62828"));
}));

def("Objects", "windmill", "cx baseY h [color]", "windmill with four sails (h = total height incl. sails)", (a, P) => P.at(a.cx, a.baseY, a.h / 210, () => {
  const wall = a.color || C("#d9c3a0"), roof = C("#8b3a2b"), wood = C("#6b4a2a");
  P.ellipse(0, 1, 66, 7, BLACK(0.2));
  P.poly([[-44, 0], [44, 0], [28, -112], [-28, -112]], wall, shade(wall, -0.4), 2.5);
  P.poly([[44, 0], [28, -112], [8, -112], [18, 0]], BLACK(0.1));
  P.rrect(-12, -36, 24, 36, 6, wood, shade(wood, -0.4), 2);
  P.circle(0, -78, 9, C("glass"), C("#f4f1ea"), 3);
  P.poly([[-34, -112], [0, -148], [34, -112]], roof, shade(roof, -0.4), 2.5);
  for (let k = 0; k < 4; k++) {
    P.push(); P.translate(0, -122); P.rotate(k * 90 + 20);
    P.rect(-2.5, -84, 5, 84, wood);
    P.rect(3, -82, 22, 54, C("#f6efe0"), wood, 1.8);
    for (const y of [-68, -55, -42]) P.line(3, y, 25, y, wood, 1.2);
    P.line(14, -82, 14, -28, wood, 1.2);
    P.pop();
  }
  P.circle(0, -122, 8, C("#4a3420"), C("#2a1c10"), 2);
}));

def("Objects", "lighthouse", "cx baseY h", "striped lighthouse with light beams (h = tower height)", (a, P) => P.at(a.cx, a.baseY, a.h / 156, () => {
  const hw = (y) => 26 - (-y) * (10 / 110), red = C("#d62828");
  P.poly([[-70, 0], [-46, -22], [-10, -30], [30, -24], [68, 0]], C("#6b7078"), C("#444"), 2);
  for (let k = 0; k < 4; k++) {
    const y0 = -k * 27.5, y1 = -(k + 1) * 27.5;
    P.poly([[-hw(y0), y0], [hw(y0), y0], [hw(y1), y1], [-hw(y1), y1]], k % 2 ? red : C("#f4f4f4"), C("#555"), 1.5);
  }
  P.rect(-24, -118, 48, 7, C("#333"));
  P.poly([[0, -130], [230, -176], [230, -84]], C("#fff3b0@0.28"));
  P.poly([[0, -130], [-230, -176], [-230, -84]], C("#fff3b0@0.28"));
  P.circle(0, -130, 34, P.radGrad(0, -130, 34, [[0, C("#fff3b0@0.8")], [1, C("#fff3b0@0")]]));
  P.rect(-12, -141, 24, 24, C("#ffe27a"), C("#555"), 2);
  P.poly([[-17, -141], [0, -158], [17, -141]], red, shade(red, -0.4), 2);
}));

def("Objects", "pizza", "cx cy r", "pizza seen from above with pepperoni (r = radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  P.circle(5, 7, 100, BLACK(0.15));
  P.circle(0, 0, 100, C("#d9a066"), C("#a8742f"), 3);
  P.circle(0, 0, 86, C("#f6c453"), C("#e0a526"), 2);
  for (let k = 0; k < 8; k++) { const t = ((k * 45 + 22.5) * Math.PI) / 180; P.line(0, 0, 86 * Math.cos(t), 86 * Math.sin(t), C("#e0a526"), 2); }
  [[-40, -42], [24, -52], [54, -8], [34, 40], [-18, 54], [-56, 12], [0, 2], [-12, -20]].forEach(([x, y]) => {
    P.circle(x, y, 16, C("#c0392b"), C("#8e2a20"), 2); P.circle(x - 4, y - 3, 3, C("#e57368")); P.circle(x + 5, y + 4, 2.5, C("#8e2a20"));
  });
  [[-20, -18], [42, 22], [-38, 36], [12, -34], [60, -34]].forEach(([x, y]) => { P.rect(x - 4, y - 2, 8, 4, C("#3c9a46")); });
}));

def("Objects", "laptop", "cx baseY w [color]", "laptop computer with a glowing screen (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 250, () => {
  const c = a.color || C("#b9c2cc"), dk = shade(c, -0.5);
  P.ellipse(0, 1, 134, 7, BLACK(0.18));
  P.rrect(-90, -132, 180, 120, 8, C("#2b3138"), C("#15191d"), 2);
  P.rect(-82, -124, 164, 102, P.linGrad(-82, -124, 82, -22, [[0, C("#4facfe")], [1, C("#7b4dff")]]));
  P.rrect(-68, -112, 62, 44, 4, WHITE(0.9)); P.rect(-60, -102, 46, 5, C("#4facfe")); P.rect(-60, -92, 34, 5, C("#cfd8e3")); P.rect(-60, -82, 40, 5, C("#cfd8e3"));
  P.circle(40, -90, 22, WHITE(0.25)); P.circle(40, -90, 12, WHITE(0.4));
  P.rrect(-124, -14, 248, 14, 5, c, dk, 2); P.rrect(-24, -14, 48, 5, 2.5, shade(c, -0.25));
}));

def("Objects", "crown", "cx cy w [color]", "golden crown with jewels (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 112, () => {
  const c = a.color || C("#ffc83d"), ln = shade(c, -0.5);
  P.poly([[-50, 30], [-56, -34], [-26, -6], [0, -44], [26, -6], [56, -34], [50, 30]], c, ln, 3);
  P.poly([[-44, 24], [-48, -22], [-30, -2], [-30, 24]], WHITE(0.25));
  P.rect(-50, 14, 100, 16, shade(c, -0.15), ln, 2.5);
  P.circle(-28, 22, 5.5, C("#e53935"), ln, 1.5); P.circle(0, 22, 6.5, C("#1e88e5"), ln, 1.5); P.circle(28, 22, 5.5, C("#43a047"), ln, 1.5);
  [[-56, -38], [0, -48], [56, -38]].forEach(([x, y]) => P.circle(x, y, 6.5, C("#fff3b0"), ln, 2));
}));

def("Objects", "check", "cx cy s [color]", "check mark (green by default, s = size)", (a, P) => {
  P.polyline([[a.cx - a.s * 0.5, a.cy + a.s * 0.02], [a.cx - a.s * 0.12, a.cy + a.s * 0.4], [a.cx + a.s * 0.5, a.cy - a.s * 0.4]], a.color || C("#2e9e4f"), Math.max(3, a.s * 0.22));
});
def("Objects", "xmark", "cx cy s [color]", "X / cross mark (red by default, s = size)", (a, P) => {
  const c = a.color || C("#e53935"), w = Math.max(3, a.s * 0.22), h = a.s * 0.42;
  P.line(a.cx - h, a.cy - h, a.cx + h, a.cy + h, c, w); P.line(a.cx + h, a.cy - h, a.cx - h, a.cy + h, c, w);
});

// =====================================================================
// PART 3b - SCRIPT RUNNER  (reads the script the AI writes and draws it)
// =====================================================================
const MAX_COMMANDS = 20000; // safety: stop runaway scripts
const MAX_MS = 40000;
const CLAMPS = { n: [0, 3000], len: [2, 10000], step: [4, 10000], points: [3, 60], sides: [3, 100] };
const END_WORDS = new Set(["end", "endrepeat", "endloop", "endfor", "next"]);

const fatal = (msg) => Object.assign(new Error(msg), { fatal: true });

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(name) {
  let best = null, bd = 99;
  for (const k of [...CMDS.keys(), ...Object.keys(ALIASES)]) {
    const d = lev(name, k);
    if (d < bd) { bd = d; best = k; }
  }
  return bd <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

// split one line into tokens. "quoted text" stays one token, {math} stays one token
function tokenizeLine(line) {
  const toks = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const ch = line[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (toks.length && (line.startsWith("//", i) || (ch === "#" && (i + 1 >= n || /\s/.test(line[i + 1]))))) break; // comment at end of line
    if (ch === '"' || ch === "'") {
      let j = i + 1, s = "";
      while (j < n && line[j] !== ch) s += line[j++];
      toks.push({ text: s, quoted: true });
      i = j + 1;
      continue;
    }
    let s = "";
    while (i < n && !/\s/.test(line[i])) {
      if (line[i] === "{") {
        let depth = 0;
        while (i < n) {
          s += line[i];
          if (line[i] === "{") depth++;
          else if (line[i] === "}" && --depth === 0) { i++; break; }
          i++;
        }
      } else s += line[i++];
    }
    toks.push({ text: s, quoted: false });
  }
  return toks;
}

function splitStatements(script) {
  const out = [];
  String(script).replace(/\r/g, "").split("\n").forEach((raw, idx) => {
    let line = raw.trim();
    if (!line || line.startsWith("```") || line.startsWith("//") || line.startsWith("#") || line.startsWith(";")) return;
    line = line.replace(/;+\s*$/, "");
    const m = !/[{"']/.test(line) && line.match(/^([A-Za-z_]\w*)\s*\((.*)\)$/); // tolerate: circle(100, 200, 50, red)
    if (m) line = m[1] + " " + m[2].replace(/,/g, " ");
    const toks = tokenizeLine(line);
    if (toks.length) out.push({ n: idx + 1, raw: raw.trim(), toks });
  });
  return out;
}

function interp(text, P) {
  if (!text.includes("{")) return text;
  return text.replace(/\{([^{}]*)\}/g, (m, e) => String(Math.round(evalExpr(e, P) * 1000) / 1000));
}
function toNum(s, P, name) {
  const t = String(s).trim();
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return parseFloat(t);
  let v;
  try { v = evalExpr(t, P); } catch (e) { throw new Error(`'${t}' is not a number (value for '${name}'). If text has spaces, put it in "double quotes"`); }
  if (!Number.isFinite(v)) throw new Error(`'${t}' is not a usable number (value for '${name}')`);
  return v;
}

function parseArgs(cmd, toks, P) {
  const a = {};
  let ti = 0;
  for (const s of cmd.spec) {
    if (s.rest) {
      const vals = toks.slice(ti).map((t) => interp(t.text, P));
      a[s.name] = s.type === "raw" ? vals : vals.map((v) => toNum(v, P, s.name));
      ti = toks.length;
      continue;
    }
    if (ti >= toks.length) {
      if (!s.opt) {
        const need = cmd.spec.filter((q) => !q.opt && !q.rest).map((q) => q.name).join(" ");
        throw new Error(`missing '${s.name}' - this command needs: ${need}${cmd.spec.some((q) => q.rest) ? " + a list of values" : ""} (you gave ${toks.length} value${toks.length === 1 ? "" : "s"})`);
      }
      continue;
    }
    const tok = toks[ti++];
    const raw = interp(tok.text, P);
    if (s.opt && !tok.quoted && raw === "_") continue; // "_" = use the default
    if (s.type === "num") a[s.name] = toNum(raw, P, s.name);
    else if (s.type === "color") {
      try { a[s.name] = parseColor(raw); } catch (e) { throw new Error(`${e.message} (value for '${s.name}')`); }
    } else a[s.name] = raw;
  }
  if (ti < toks.length) {
    const extra = toks.slice(ti).map((t) => t.text).join(" ");
    throw new Error(`too many values (extra: ${extra.slice(0, 40)})`);
  }
  return a;
}

function execOne(st, P) {
  const head = st.head;
  if (head === "canvas" || head === "size") return; // already handled before drawing
  const assign = head === "let" || head === "set" || head === "var";
  if (assign || (st.toks[1] && st.toks[1].text === "=" && /^[A-Za-z_]\w*$/.test(st.toks[0].text))) {
    const nameTok = assign ? st.toks[1] : st.toks[0];
    let rest = st.toks.slice(assign ? 2 : 1);
    if (rest[0] && rest[0].text === "=") rest = rest.slice(1);
    if (!nameTok || !/^[A-Za-z_]\w*$/.test(nameTok.text) || nameTok.text === "pi") throw new Error("let needs a variable name and a value, like: let size = 40");
    const expr = interp(rest.map((t) => t.text).join(" "), P);
    if (!expr.trim()) throw new Error("let needs a value, like: let size = 40");
    P.vars[nameTok.text] = evalExpr(expr, P);
    return;
  }
  const cmd = CMDS.get(head);
  if (!cmd) {
    const sg = suggest(head);
    throw new Error(`unknown command '${st.toks[0].text}'${sg ? ` - did you mean '${sg}'?` : ""} (use only commands from the list)`);
  }
  let a;
  try { a = parseArgs(cmd, st.toks.slice(1), P); } catch (e) { throw new Error(`${e.message}\n      usage: ${cmd.name} ${cmd.sig}`); }
  if (cmd.name !== "seed") for (const k in CLAMPS) if (typeof a[k] === "number") a[k] = Math.max(CLAMPS[k][0], Math.min(CLAMPS[k][1], a[k]));
  try { cmd.fn(a, P); } catch (e) { throw new Error(`${cmd.name} failed: ${e.message}\n      usage: ${cmd.name} ${cmd.sig}`); }
}

function runStatements(stmts, P, errors) {
  // 1) turn "repeat ... end" blocks into a tree
  const root = [], stack = [root], open = [];
  for (const st of stmts) {
    let head = st.toks[0].text.toLowerCase();
    head = ALIASES[head] || head;
    st.head = head;
    if (head === "repeat") {
      const node = { st, body: [] };
      stack[stack.length - 1].push(node);
      stack.push(node.body);
      open.push(st);
    } else if (END_WORDS.has(head)) {
      if (stack.length > 1) { stack.pop(); open.pop(); }
      else errors.push({ line: st.n, text: st.raw, msg: "'end' without a matching 'repeat'" });
    } else stack[stack.length - 1].push({ st });
  }
  for (const st of open) errors.push({ line: st.n, text: st.raw, msg: "this 'repeat' has no 'end' line (add a line with just: end)" });

  // 2) run it
  const t0 = Date.now();
  let count = 0;
  const run = (nodes) => {
    for (const node of nodes) {
      if (++count > MAX_COMMANDS) throw fatal(`too many drawing commands (limit ${MAX_COMMANDS}) - use smaller loops`);
      if ((count & 63) === 0 && Date.now() - t0 > MAX_MS) throw fatal("drawing took too long - make the picture simpler");
      const st = node.st;
      try {
        if (node.body) {
          if (!st.toks[1]) throw new Error("repeat needs a count, like: repeat 10 i");
          const n = Math.min(2000, Math.max(0, Math.floor(toNum(interp(st.toks[1].text, P), P, "count"))));
          const vn = st.toks[2] ? st.toks[2].text : "i";
          if (!/^[A-Za-z_]\w*$/.test(vn)) throw new Error(`bad loop variable name '${vn}'`);
          const old = P.vars[vn], before = errors.length;
          for (let k = 0; k < n; k++) {
            P.vars[vn] = k;
            run(node.body);
            if (errors.length > before) break; // do not repeat the same mistake 100 times
          }
          if (old === undefined) delete P.vars[vn]; else P.vars[vn] = old;
        } else execOne(st, P);
      } catch (e) {
        if (e.fatal) throw e;
        errors.push({ line: st.n, text: st.raw, msg: e.message });
      }
    }
  };
  run(root);
  return count;
}

// script text -> PNG bytes (+ list of problems). Never throws.
export function renderScript(script) {
  try {
    const stmts = splitStatements(script);
    if (!stmts.length) return { fatal: "the script is empty. Write one drawing command per line." };
    const errors = [];
    let w = 800, h = 600;
    const cv = stmts.find((s) => ["canvas", "size"].includes(s.toks[0].text.toLowerCase()));
    if (cv) {
      const nums = cv.toks.slice(1, 3).map((t) => Number(t.text));
      if (nums.length === 2 && nums.every((v) => Number.isFinite(v) && v > 0)) {
        w = Math.max(100, Math.min(2000, Math.round(nums[0])));
        h = Math.max(100, Math.min(2000, Math.round(nums[1])));
      } else errors.push({ line: cv.n, text: cv.raw, msg: "canvas needs two plain numbers: canvas 800 600" });
    }
    const P = new Painter(w, h);
    Object.assign(P.vars, { W: w, H: h, CX: w / 2, CY: h / 2 });
    const count = runStatements(stmts, P, errors);
    const seen = new Set();
    const list = errors.filter((e) => { const k = e.line + "|" + e.msg; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 15);
    return { png: P.toPNG(), w, h, count, errors: list };
  } catch (e) {
    return { fatal: e.message };
  }
}

// =====================================================================
// PART 3c - drawPicture: render, save, open in Paint
// =====================================================================
function stamp() {
  const d = new Date(), p = (n, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${p(d.getMilliseconds(), 3)}`;
}
function openInPaint(file) {
  if (process.platform !== "win32") return false;
  exec(`start "" mspaint "${file}"`, { windowsHide: true }, () => {});
  return true;
}

// script: the text of the drawing script. opts.openAnyway = open Paint even if some lines had problems.
// Returns { ok, message, path? }  - "message" is what the AI is told.
export async function drawPicture(script, opts = {}) {
  try {
    if (Array.isArray(script)) script = script.join("\n");
    script = String(script ?? "");
    if (!script.includes("\n") && script.includes("\\n")) script = script.replace(/\\n/g, "\n"); // model double-escaped the newlines
    const r = renderScript(script);
    if (r.fatal) return { ok: false, message: "NOT DRAWN: " + r.fatal };
    const problems = r.errors.map((e) => `line ${e.line}: ${e.text}\n   -> ${e.msg}`).join("\n");
    if (r.errors.length && !opts.openAnyway) {
      return {
        ok: false,
        message: `NOT DRAWN yet: ${r.errors.length} line(s) have problems. Fix ONLY these lines and call draw again with the FULL corrected script:\n${problems}`,
      };
    }
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    const file = path.join(SAVE_DIR, `draw_${stamp()}.png`);
    fs.writeFileSync(file, r.png);
    const opened = opts.open !== false && openInPaint(file);
    let msg = `OK: ${r.count} commands drawn, ${r.w}x${r.h} picture saved to ${file}` + (opened ? " and opened in Paint." : " (Paint opens only on Windows).");
    if (r.errors.length) msg += `\nNOTE: ${r.errors.length} line(s) were skipped because of problems, so the picture is not complete:\n${problems}\nTell the user honestly that some parts were skipped.`;
    return { ok: true, path: file, message: msg };
  } catch (e) {
    return { ok: false, message: "NOT DRAWN: " + e.message };
  }
}


// =====================================================================
// PART 4 - MORE COMMANDS: animals, country flags, vehicles, objects, landmarks
// PASTE THIS WHOLE BLOCK INTO paint.js RIGHT BEFORE the line "// PART 3d" section
// (after drawPicture, before HELP_INTRO). Nothing else needs changing.
// =====================================================================
const x4eyes = (P, x, y, r, c = C("#222")) => {
  for (const s of [-1, 1]) { P.circle(s * x, y, r, c); P.circle(s * x + r * 0.3, y - r * 0.3, r * 0.35, WHITE()); }
};
const x4star = (P, x, y, r, f) => CMDS.get("star").fn({ cx: x, cy: y, r, fill: f, lw: 0 }, P);
const x4cres = (P, cx, cy, r, fg, bg, dx, dy, r2) => { P.circle(cx, cy, r, fg); P.circle(cx + dx, cy + dy, r2, bg); };

// ---------------- ANIMALS ----------------
def("Animals", "rabbit", "cx baseY h [color]", "sitting rabbit with long ears (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 178, () => {
  const c = a.color || C("#f4f1ea"), dk = shade(c, -0.4), pk = C("#ffb3c1");
  P.ellipse(0, -1, 54, 6, BLACK(0.2));
  P.circle(42, -24, 12, WHITE(), dk, 1.5);
  P.ellipse(0, -38, 44, 38, c, dk, 2.5);
  P.ellipse(22, -20, 22, 18, shade(c, -0.06), dk, 1.5);
  P.ellipse(-26, -6, 20, 8, c, dk, 2); P.ellipse(20, -5, 20, 8, c, dk, 2);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 14, -108); P.rotate(s * 9); P.ellipse(0, -30, 11, 38, c, dk, 2); P.ellipse(0, -28, 5, 29, pk); P.pop(); }
  P.circle(0, -88, 31, c, dk, 2.5);
  x4eyes(P, 12, -94, 4.5);
  P.ellipse(0, -82, 5, 3.5, pk);
  P.arc(-4, -79, 5, 4, 0, 180, dk, 1.6); P.arc(4, -79, 5, 4, 0, 180, dk, 1.6);
  P.ellipse(-20, -82, 7, 4.5, C("#ff7a93@0.4")); P.ellipse(20, -82, 7, 4.5, C("#ff7a93@0.4"));
  for (const s of [-1, 1]) { P.line(s * 8, -80, s * 34, -84, dk, 1.2); P.line(s * 8, -77, s * 34, -74, dk, 1.2); }
}));
def("Animals", "bear", "cx baseY h [color]", "sitting teddy-style bear (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 156, () => {
  const c = a.color || C("#a9703f"), dk = shade(c, -0.4), lt = shade(c, 0.4);
  P.ellipse(0, -1, 60, 6, BLACK(0.2));
  for (const s of [-1, 1]) { P.ellipse(s * 28, -10, 22, 13, c, dk, 2); P.ellipse(s * 28, -9, 11, 6, lt); }
  P.ellipse(0, -48, 48, 50, c, dk, 2.5); P.ellipse(0, -44, 30, 34, lt);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 50, -58); P.rotate(s * -22); P.ellipse(0, 0, 14, 28, c, dk, 2); P.pop(); }
  for (const s of [-1, 1]) { P.circle(s * 31, -141, 15, c, dk, 2); P.circle(s * 31, -141, 8, lt); }
  P.circle(0, -112, 38, c, dk, 2.5);
  P.ellipse(0, -100, 19, 15, lt, dk, 1.5);
  x4eyes(P, 16, -118, 4.5);
  P.ellipse(0, -106, 7, 5, C("#222"));
  P.line(0, -101, 0, -95, C("#222"), 2); P.arc(-5, -95, 5, 4, 0, 180, C("#222"), 2); P.arc(5, -95, 5, 4, 0, 180, C("#222"), 2);
}));
def("Animals", "panda", "cx baseY h", "sitting giant panda (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 156, () => {
  const bk = C("#222"), wh = C("#fafafa"), gr = C("#999");
  P.ellipse(0, -1, 60, 6, BLACK(0.2));
  for (const s of [-1, 1]) P.ellipse(s * 28, -10, 22, 13, bk);
  P.ellipse(0, -48, 48, 50, wh, gr, 2);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 50, -58); P.rotate(s * -22); P.ellipse(0, 0, 14, 28, bk); P.pop(); }
  P.rect(-46, -66, 92, 14, bk);
  for (const s of [-1, 1]) P.circle(s * 31, -141, 15, bk);
  P.circle(0, -112, 38, wh, gr, 2);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 16, -116); P.rotate(s * -25); P.ellipse(0, 0, 11, 15, bk); P.pop(); P.circle(s * 16, -116, 4, WHITE()); P.circle(s * 16 + 1, -116, 2, bk); }
  P.ellipse(0, -104, 8, 5.5, bk);
  P.line(0, -100, 0, -94, bk, 2); P.arc(-5, -94, 5, 4, 0, 180, bk, 2); P.arc(5, -94, 5, 4, 0, 180, bk, 2);
}));
def("Animals", "penguin", "cx baseY h [body]", "standing penguin (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 130, () => {
  const b = a.body || C("#2b3a55"), og = C("#ff9a1f");
  P.ellipse(0, -1, 46, 6, BLACK(0.2));
  P.ellipse(-16, -4, 15, 7, og, shade(og, -0.3), 1.5); P.ellipse(16, -4, 15, 7, og, shade(og, -0.3), 1.5);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 40, -62); P.rotate(s * -20); P.ellipse(0, 0, 11, 34, shade(b, -0.1), shade(b, -0.5), 2); P.pop(); }
  P.ellipse(0, -62, 42, 62, b, shade(b, -0.5), 2.5);
  P.ellipse(0, -54, 29, 48, C("#f7f7f2"));
  for (const s of [-1, 1]) { P.circle(s * 12, -96, 8, WHITE(), shade(b, -0.5), 1.5); P.circle(s * 12 + 1, -96, 3.5, C("#111")); }
  P.poly([[-9, -86], [9, -86], [0, -73]], og, shade(og, -0.3), 1.5);
}));
def("Animals", "elephant", "cx baseY h [color]", "elephant facing right with trunk and tusk (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#9aa6b5"), dk = shade(c, -0.4), lt = shade(c, 0.25);
  P.ellipse(0, -1, 92, 7, BLACK(0.2));
  P.curve([[-66, -86], [-80, -70], [-78, -48]], dk, 4);
  for (const x of [-46, -18, 28, 54]) P.rrect(x - 12, -56, 24, 56, 8, shade(c, x > 0 ? 0 : -0.1), dk, 2);
  P.ellipse(0, -78, 72, 50, c, dk, 2.5);
  P.curve([[78, -92], [102, -70], [104, -36], [92, -14]], dk, 22);
  P.curve([[78, -92], [102, -70], [104, -36], [92, -14]], c, 17);
  P.circle(64, -102, 34, c, dk, 2.5);
  P.ellipse(40, -100, 24, 34, lt, dk, 2); P.ellipse(40, -98, 14, 24, C("#e7a9b3@0.6"));
  P.poly([[84, -78], [112, -60], [104, -56], [80, -68]], C("#fffbe8"), C("#cfc59a"), 1.5);
  P.circle(76, -112, 4.5, C("#222")); P.circle(77.5, -113.5, 1.5, WHITE());
}));
def("Animals", "lion", "cx cy r [color]", "lion head with big mane (r = face radius)", (a, P) => P.at(a.cx, a.cy, a.r / 72, () => {
  const mane = a.color || C("#a8581c"), face = C("#f2b457"), dk = shade(face, -0.45);
  for (let k = 0; k < 18; k++) { P.push(); P.rotate(k * 20); P.ellipse(0, -84, 22, 34, k % 2 ? shade(mane, -0.12) : mane, shade(mane, -0.4), 1.5); P.pop(); }
  P.circle(0, 0, 92, mane, shade(mane, -0.4), 2);
  for (const s of [-1, 1]) { P.circle(s * 54, -52, 17, face, dk, 2); P.circle(s * 54, -52, 9, C("#e58c8c")); }
  P.circle(0, 0, 70, face, dk, 2.5);
  P.ellipse(0, 26, 32, 24, C("#fbe3b3"));
  for (const s of [-1, 1]) { P.ellipse(s * 26, -12, 10, 8, C("#4a2c0a")); P.circle(s * 26 + 2, -14, 2.5, WHITE()); P.line(s * 14, -28, s * 40, -34, dk, 3.5); }
  P.poly([[-11, 8], [11, 8], [0, 22]], C("#7a3d2a"), dk, 1.5);
  P.line(0, 22, 0, 34, dk, 2.5); P.arc(-10, 34, 10, 9, 0, 180, dk, 2.5); P.arc(10, 34, 10, 9, 0, 180, dk, 2.5);
}));
def("Animals", "owl", "cx baseY h [color]", "owl sitting on a branch (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#8d6a45"), dk = shade(c, -0.4), cr = C("#f3e2bf"), og = C("#ff9a1f");
  P.rrect(-80, -4, 160, 10, 5, C("#5d3d22"), C("#3a2412"), 2);
  P.ellipse(-16, -8, 12, 6, og); P.ellipse(16, -8, 12, 6, og);
  P.ellipse(0, -62, 50, 60, c, dk, 2.5);
  P.ellipse(0, -52, 33, 44, cr);
  for (let r = 0; r < 4; r++) for (let k = -1; k <= 1; k++) P.arc(k * 15, -66 + r * 14, 8, 6, 0, 180, shade(cr, -0.3), 2);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 46, -62); P.rotate(s * -12); P.ellipse(0, 0, 14, 40, shade(c, -0.12), dk, 2); P.pop(); }
  P.poly([[-44, -108], [-26, -138], [-14, -112]], c, dk, 2); P.poly([[44, -108], [26, -138], [14, -112]], c, dk, 2);
  for (const s of [-1, 1]) { P.circle(s * 20, -96, 19, WHITE(), dk, 2); P.circle(s * 20, -96, 12, C("#ffc933")); P.circle(s * 20, -96, 6.5, C("#111")); P.circle(s * 20 + 2, -98, 2, WHITE()); }
  P.poly([[-7, -88], [7, -88], [0, -72]], og, shade(og, -0.35), 1.5);
}));
def("Animals", "duck", "cx baseY h [color]", "yellow duck on water (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 100, () => {
  const c = a.color || C("#ffd93d"), dk = shade(c, -0.4), og = C("#ff8a1f");
  P.ellipse(0, 2, 88, 10, C("#4aa3e8@0.55")); P.arc(0, 2, 98, 12, 0, 180, WHITE(0.6), 2);
  P.poly([[-54, -40], [-82, -62], [-60, -26]], c, dk, 2);
  P.ellipse(0, -28, 62, 30, c, dk, 2.5);
  P.ellipse(-6, -24, 32, 17, shade(c, -0.12), dk, 2);
  P.circle(40, -68, 26, c, dk, 2.5);
  P.ellipse(70, -62, 19, 8, og, shade(og, -0.35), 2);
  P.circle(46, -76, 4.5, C("#222")); P.circle(47.5, -77.5, 1.5, WHITE());
}));
def("Animals", "turtle", "cx baseY h [color]", "turtle with patterned shell (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 66, () => {
  const c = a.color || C("#4caf50"), sk = C("#9ccc65"), dk = shade(c, -0.45);
  P.ellipse(0, 0, 90, 7, BLACK(0.2));
  P.poly([[-60, -18], [-86, -12], [-60, -8]], sk, shade(sk, -0.4), 1.5);
  P.ellipse(-36, -8, 16, 11, sk, shade(sk, -0.4), 2); P.ellipse(34, -8, 16, 11, sk, shade(sk, -0.4), 2);
  P.ellipse(76, -34, 22, 16, sk, shade(sk, -0.4), 2);
  P.circle(82, -38, 3.5, C("#222"));
  P.pie(0, -14, 64, 52, 180, 180, c, dk, 2.5);
  P.line(-64, -14, 64, -14, dk, 4);
  P.poly([[-14, -48], [14, -48], [22, -30], [0, -20], [-22, -30]], shade(c, 0.2), dk, 2);
  P.line(-22, -30, -44, -20, dk, 2); P.line(22, -30, 44, -20, dk, 2); P.line(0, -20, 0, -14, dk, 2);
  P.line(-14, -48, -30, -56, dk, 2); P.line(14, -48, 30, -56, dk, 2);
}));
def("Animals", "pig", "cx baseY h [color]", "pink pig facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 100, () => {
  const c = a.color || C("#ffb3c1"), dk = shade(c, -0.4);
  P.ellipse(0, -1, 76, 6, BLACK(0.2));
  P.curve([[-62, -52], [-78, -62], [-70, -74], [-80, -80]], dk, 3);
  for (const x of [-38, -18, 22, 42]) P.rrect(x - 8, -28, 16, 28, 5, shade(c, -0.08), dk, 2);
  P.ellipse(0, -52, 66, 40, c, dk, 2.5);
  P.circle(56, -58, 30, c, dk, 2.5);
  P.poly([[40, -80], [52, -100], [62, -78]], shade(c, -0.1), dk, 2);
  P.ellipse(80, -52, 14, 12, shade(c, 0.12), dk, 2);
  P.ellipse(77, -52, 2.6, 4, dk); P.ellipse(84, -52, 2.6, 4, dk);
  P.circle(58, -66, 4.5, C("#222")); P.circle(59.5, -67.5, 1.5, WHITE());
  P.ellipse(48, -48, 7, 4, C("#ff7a93@0.4"));
}));
def("Animals", "giraffe", "cx baseY h", "tall giraffe with spots (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 230, () => {
  const c = C("#f4c04a"), sp = C("#a8631f"), dk = C("#a8761f");
  P.ellipse(0, -1, 70, 6, BLACK(0.2));
  P.curve([[-50, -118], [-62, -100], [-60, -80]], dk, 3);
  for (const x of [-38, -20, 22, 40]) P.rrect(x - 7, -100, 14, 100, 5, c, dk, 2);
  P.ellipse(0, -124, 54, 32, c, dk, 2.5);
  P.poly([[22, -134], [46, -134], [60, -204], [40, -210]], c, dk, 2.5);
  P.ellipse(56, -212, 24, 15, c, dk, 2.5);
  P.ellipse(76, -208, 10, 8, shade(c, 0.2), dk, 1.5);
  for (const x of [44, 56]) { P.line(x, -224, x - 2, -240, dk, 2.5); P.circle(x - 2, -241, 3.5, sp); }
  P.ellipse(40, -222, 6, 10, c, dk, 1.5);
  P.circle(60, -216, 3.5, C("#222"));
  [[-30, -130, 10], [-6, -116, 8], [20, -128, 9], [-40, -108, 6], [10, -142, 7], [46, -160, 6], [50, -186, 5], [-12, -138, 5], [34, -112, 6]].forEach(([x, y, r]) => P.circle(x, y, r, sp));
}));
def("Animals", "dino", "cx baseY h [color]", "friendly cartoon dinosaur facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 130, () => {
  const c = a.color || C("#58b368"), dk = shade(c, -0.4), bl = shade(c, 0.35);
  P.ellipse(0, -1, 92, 7, BLACK(0.2));
  P.poly([[-50, -68], [-132, -26], [-124, -18], [-40, -38]], c, dk, 2.5);
  for (const x of [-26, 30]) P.rrect(x - 14, -44, 28, 44, 9, shade(c, -0.08), dk, 2.5);
  P.ellipse(0, -64, 62, 40, c, dk, 2.5); P.ellipse(6, -50, 40, 24, bl);
  P.poly([[24, -82], [58, -96], [64, -122], [36, -108]], c, dk, 2.5);
  P.ellipse(70, -112, 34, 24, c, dk, 2.5);
  P.circle(76, -122, 5, WHITE(), dk, 1.5); P.circle(77.5, -122, 2.3, C("#111"));
  P.arc(80, -108, 15, 8, 10, 130, dk, 2.2);
  [[-30, -100, 14], [-6, -108, 17], [18, -106, 15], [-44, -90, 11]].forEach(([x, y, s]) => P.poly([[x - s * 0.6, y + s * 0.6], [x, y - s], [x + s * 0.6, y + s * 0.6]], C("#e8a33d"), shade(C("#e8a33d"), -0.4), 1.5));
}));

// ---------------- COUNTRY FLAGS ----------------
const FLAGS = {
  pakistan: (P) => {
    const g = C("#01411c");
    P.rect(-150, -100, 300, 200, g); P.rect(-150, -100, 75, 200, WHITE());
    x4cres(P, 15, 0, 56, WHITE(), g, 17, -7, 47);
    x4star(P, 58, -26, 21, WHITE());
  },
  usa: (P) => {
    for (let i = 0; i < 13; i++) P.rect(-150, -100 + (i * 200) / 13, 300, 200 / 13 + 0.6, i % 2 ? WHITE() : C("#b22234"));
    P.rect(-150, -100, 120, 108, C("#3c3b6e"));
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) x4star(P, -138 + k * 20, -88 + r * 22, 6, WHITE());
  },
  uk: (P) => {
    const bl = C("#012169"), rd = C("#c8102e");
    P.rect(-150, -100, 300, 200, bl);
    P.poly([[-150, -100], [-114, -100], [150, 76], [150, 100], [114, 100], [-150, -76]], WHITE());
    P.poly([[150, -100], [114, -100], [-150, 76], [-150, 100], [-114, 100], [150, -76]], WHITE());
    P.poly([[-150, -100], [-130, -100], [150, 86], [150, 100], [130, 100], [-150, -86]], rd);
    P.poly([[150, -100], [130, -100], [-150, 86], [-150, 100], [-130, 100], [150, -86]], rd);
    P.rect(-150, -30, 300, 60, WHITE()); P.rect(-40, -100, 80, 200, WHITE());
    P.rect(-150, -18, 300, 36, rd); P.rect(-24, -100, 48, 200, rd);
  },
  india: (P) => {
    const nv = C("#000080");
    P.rect(-150, -100, 300, 67, C("#ff9933")); P.rect(-150, -33.5, 300, 67, WHITE()); P.rect(-150, 33, 300, 67, C("#138808"));
    P.circle(0, 0, 22, null, nv, 2.5);
    for (let k = 0; k < 12; k++) { const t = (k * 30 * Math.PI) / 180; P.line(0, 0, 22 * Math.cos(t), 22 * Math.sin(t), nv, 1.4); }
    P.circle(0, 0, 4, nv);
  },
  japan: (P) => { P.rect(-150, -100, 300, 200, WHITE()); P.circle(0, 0, 60, C("#bc002d")); },
  china: (P) => {
    const y = C("#ffde00");
    P.rect(-150, -100, 300, 200, C("#de2910"));
    x4star(P, -100, -50, 32, y);
    [[-50, -88], [-34, -66], [-34, -38], [-50, -16]].forEach(([x, yy]) => x4star(P, x, yy, 10, y));
  },
  germany: (P) => { P.rect(-150, -100, 300, 67, C("#111")); P.rect(-150, -33.5, 300, 67, C("#dd0000")); P.rect(-150, 33, 300, 67, C("#ffce00")); },
  france: (P) => { P.rect(-150, -100, 100, 200, C("#0055a4")); P.rect(-50, -100, 100, 200, WHITE()); P.rect(50, -100, 100, 200, C("#ef4135")); },
  italy: (P) => { P.rect(-150, -100, 100, 200, C("#009246")); P.rect(-50, -100, 100, 200, WHITE()); P.rect(50, -100, 100, 200, C("#ce2b37")); },
  russia: (P) => { P.rect(-150, -100, 300, 67, WHITE()); P.rect(-150, -33.5, 300, 67, C("#0039a6")); P.rect(-150, 33, 300, 67, C("#d52b1e")); },
  canada: (P) => {
    const r = C("#d80621");
    P.rect(-150, -100, 300, 200, WHITE()); P.rect(-150, -100, 75, 200, r); P.rect(75, -100, 75, 200, r);
    P.poly([[0, -48], [9, -28], [22, -34], [18, -10], [36, -16], [30, 4], [42, 14], [10, 22], [8, 44], [-8, 44], [-10, 22], [-42, 14], [-30, 4], [-36, -16], [-18, -10], [-22, -34], [-9, -28]], r);
  },
  brazil: (P) => {
    P.rect(-150, -100, 300, 200, C("#009739"));
    P.poly([[0, -80], [130, 0], [0, 80], [-130, 0]], C("#fedd00"));
    P.circle(0, 0, 44, C("#012169"));
    P.arc(0, -12, 36, 26, 20, 140, WHITE(), 6);
  },
  turkey: (P) => {
    const r = C("#e30a17");
    P.rect(-150, -100, 300, 200, r);
    x4cres(P, -34, 0, 52, WHITE(), r, 17, 0, 42);
    x4star(P, 28, 0, 22, WHITE());
  },
  bangladesh: (P) => { P.rect(-150, -100, 300, 200, C("#006a4e")); P.circle(-12, 0, 58, C("#f42a41")); },
  sweden: (P) => { P.rect(-150, -100, 300, 200, C("#006aa7")); P.rect(-90, -100, 34, 200, C("#fecc00")); P.rect(-150, -17, 300, 34, C("#fecc00")); },
};
const FLAG_NAMES = { us: "usa", america: "usa", gb: "uk", england: "uk", britain: "uk", pk: "pakistan", pakistani: "pakistan", indian: "india", chinese: "china", german: "germany", french: "france", italian: "italy", russian: "russia", brazilian: "brazil", turkish: "turkey", swedish: "sweden", japanese: "japan", bd: "bangladesh" };
def("Flags", "countryflag", "cx cy w preset", "national flag. preset = " + Object.keys(FLAGS).join(" ") + ". cx,cy = center, w = width (height is 2/3 of w)", (a, P) => {
  let n = String(a.preset || "").toLowerCase();
  n = FLAG_NAMES[n] || n;
  const f = FLAGS[n];
  if (!f) throw new Error("unknown flag '" + a.preset + "'. Use one of: " + Object.keys(FLAGS).join(" "));
  P.at(a.cx, a.cy, a.w / 300, () => { P.rect(-152, -98, 304, 204, BLACK(0.12)); f(P); P.rect(-150, -100, 300, 200, null, C("#00000055"), 2); });
});

// ---------------- VEHICLES ----------------
def("Vehicles", "bicycle", "cx baseY w [color]", "side-view bicycle (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 190, () => {
  const c = a.color || C("#e53935"), tire = C("#222"), R = [-66, -40], F = [66, -40], B = [-6, -40], S = [-26, -100], H = [46, -100];
  P.ellipse(0, -1, 94, 5, BLACK(0.2));
  for (const w of [R, F]) {
    P.circle(w[0], w[1], 40, null, tire, 5);
    for (let k = 0; k < 12; k++) { const t = (k * 30 * Math.PI) / 180; P.line(w[0], w[1], w[0] + 38 * Math.cos(t), w[1] + 38 * Math.sin(t), C("#9aa3ad"), 1); }
    P.circle(w[0], w[1], 5, C("#555"));
  }
  P.polyline([R, B, H, S, R], c, 6); P.line(S[0], S[1], B[0], B[1], c, 6); P.line(H[0], H[1], F[0], F[1], c, 6);
  P.polyline([[H[0] - 4, H[1] - 6], [H[0] - 8, H[1] - 24], [H[0] + 12, H[1] - 28]], C("#333"), 5);
  P.rrect(S[0] - 18, S[1] - 12, 34, 9, 4, C("#222"));
  P.line(S[0], S[1] - 3, S[0] + 2, S[1] - 12, C("#555"), 4);
  P.circle(B[0], B[1], 9, null, C("#555"), 3); P.line(B[0] - 14, B[1] + 14, B[0] + 14, B[1] - 14, C("#555"), 4);
  P.rrect(B[0] - 22, B[1] + 11, 16, 6, 3, C("#222")); P.rrect(B[0] + 8, B[1] - 17, 16, 6, 3, C("#222"));
}));
def("Vehicles", "train", "cx baseY w [color]", "side-view train: locomotive + 2 carriages facing right (w = total length)", (a, P) => P.at(a.cx, a.baseY, a.w / 310, () => {
  const c = a.color || C("#1e6fd9"), dk = shade(c, -0.4), gl = C("#bfe6ff");
  P.rect(-160, -4, 320, 5, C("#555")); for (let x = -156; x < 160; x += 14) P.rect(x, 0, 8, 4, C("#6b4a2a"));
  for (const x0 of [-150, -50]) {
    P.rrect(x0, -72, 92, 56, 6, shade(c, 0.1), dk, 2);
    for (let i = 0; i < 3; i++) P.rrect(x0 + 8 + i * 28, -62, 22, 22, 3, gl, dk, 1.5);
    P.rect(x0, -30, 92, 5, dk); P.line(x0 + 92, -42, x0 + 100, -42, C("#444"), 3);
    for (const x of [x0 + 18, x0 + 74]) { P.circle(x, -10, 11, C("#222")); P.circle(x, -10, 5, C("#c8ccd2")); }
  }
  P.rrect(60, -64, 70, 48, 5, c, dk, 2);
  P.rrect(60, -92, 38, 30, 4, c, dk, 2); P.rrect(68, -86, 22, 18, 3, gl, dk, 1.5);
  P.rect(112, -88, 14, 26, C("#333")); P.rect(108, -94, 22, 7, C("#333"));
  P.poly([[130, -64], [150, -16], [130, -16]], shade(c, -0.15), dk, 2);
  P.ellipse(136, -48, 5, 6, C("#fff3a8"));
  for (const x of [76, 104, 128]) { P.circle(x, -10, 12, C("#222")); P.circle(x, -10, 5.5, C("#c8ccd2")); }
  for (const [x, y] of [[112, -100], [120, -118], [132, -136]]) P.circle(x, y, 10 + (-y - 100) * 0.4, WHITE(0.7));
}));
def("Vehicles", "helicopter", "cx cy w [color]", "helicopter side view facing left (cx,cy = middle of body, w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 260, () => {
  const c = a.color || C("#d62828"), dk = shade(c, -0.45);
  P.ellipse(0, -60, 124, 8, C("#9aa3ad@0.35"));
  P.line(-124, -60, 124, -60, C("#555"), 5);
  P.rect(-4, -60, 8, 28, C("#555"));
  P.poly([[40, -8], [118, -22], [124, -12], [40, 14]], c, dk, 2);
  P.poly([[108, -22], [124, -52], [132, -50], [122, -12]], c, dk, 2);
  P.circle(128, -30, 14, C("#9aa3ad@0.4")); P.line(128, -46, 128, -14, C("#555"), 3);
  P.ellipse(0, 0, 62, 36, c, dk, 2.5);
  P.pie(-24, -2, 34, 26, 180, 180, C("#bfe6ff"), dk, 2);
  P.line(-24, -2, -24, -28, dk, 2);
  P.line(-52, 44, 52, 44, C("#444"), 5); P.line(-30, 28, -34, 44, C("#444"), 4); P.line(30, 28, 34, 44, C("#444"), 4);
  P.line(-60, 44, -70, 38, C("#444"), 5);
}));

// ---------------- OBJECTS & LANDMARKS ----------------
def("Objects", "cactus", "cx baseY h [color]", "desert cactus in sand with a flower (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 130, () => {
  const c = a.color || C("#3f9a52"), dk = shade(c, -0.4), lt = shade(c, 0.25);
  P.ellipse(0, 2, 62, 9, C("#e6c77c"), shade(C("#e6c77c"), -0.2), 1.5);
  P.rrect(-42, -78, 14, 40, 7, c, dk, 2); P.rrect(-42, -50, 36, 14, 7, c, dk, 2);
  P.rrect(28, -96, 14, 50, 7, c, dk, 2); P.rrect(6, -58, 36, 14, 7, c, dk, 2);
  P.rrect(-16, -122, 32, 124, 16, c, dk, 2.5);
  P.rrect(-9, -112, 6, 100, 3, alpha(lt, 0.5));
  for (const [x, y] of [[-8, -100], [8, -88], [-6, -70], [9, -52], [-8, -34], [7, -18], [-35, -66], [35, -80], [-30, -44], [24, -52]]) { P.line(x - 3, y - 2, x + 3, y + 2, C("#f3ecc3"), 1.4); P.line(x - 3, y + 2, x + 3, y - 2, C("#f3ecc3"), 1.4); }
  P.circle(0, -126, 8, C("#ff6fa5"), C("#c63a73"), 1.5); P.circle(0, -126, 3, C("#ffd23f"));
}));
def("Objects", "volcano", "cx baseY w", "erupting volcano with lava, fire and smoke (w = width at the bottom)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const rock = C("#6b4a3a");
  for (const [x, y, r] of [[-20, -190, 28], [10, -214, 34], [-6, -246, 30], [30, -270, 24]]) P.circle(x, y, r, C("#6b6b72@0.75"));
  P.circle(0, -150, 100, P.radGrad(0, -150, 100, [[0, C("#ff7a1a@0.6")], [1, C("#ff7a1a@0")]]));
  P.poly([[-100, 0], [-30, -120], [30, -120], [100, 0]], rock, shade(rock, -0.4), 2.5);
  P.poly([[30, -120], [100, 0], [50, 0], [18, -70]], BLACK(0.18));
  P.ellipse(0, -120, 32, 9, C("#ff9a1f"), shade(rock, -0.4), 2);
  P.blob([[-20, -118], [-26, -90], [-14, -60], [-24, -30], [-6, 0], [8, 0], [2, -34], [14, -62], [8, -92], [20, -118]], C("#ff5a1a"));
  P.blob([[-4, -116], [-8, -80], [2, -50], [-2, -20], [4, 0], [10, -22], [8, -52], [14, -82], [10, -114]], C("#ffd23f"));
  P.blob([[-12, -122], [-26, -170], [-6, -156], [0, -196], [10, -156], [26, -172], [14, -122]], C("#ff7a1a"));
  for (const [x, y, r] of [[-50, -160, 5], [48, -176, 4], [-34, -204, 4], [58, -140, 4]]) P.circle(x, y, r, C("#ffb347"));
}));
def("Objects", "phone", "cx cy h [color]", "smartphone with colorful screen and apps (h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 200, () => {
  const c = a.color || C("#1f2430");
  P.rrect(-52, -96, 108, 200, 20, BLACK(0.15));
  P.rrect(-56, -100, 112, 200, 20, c, shade(c, -0.5), 2.5);
  P.rrect(-48, -90, 96, 180, 12, P.linGrad(-48, -90, 48, 90, [[0, C("#4facfe")], [0.55, C("#7b4dff")], [1, C("#ff6fa5")]]));
  P.rrect(-20, -96, 40, 8, 4, c);
  P.text("12:30", 0, -78, 22, WHITE(), true, "center");
  const cols = [C("#ffd23f"), C("#43a047"), C("#e53935"), C("#29b6f6"), C("#ab47bc"), C("#ff9800"), C("#26a69a"), C("#ec407a")];
  for (let k = 0; k < 8; k++) P.rrect(-38 + (k % 4) * 22, -30 + Math.floor(k / 4) * 28, 18, 18, 5, cols[k]);
  P.rrect(-34, 62, 68, 18, 9, WHITE(0.3));
}));
def("Objects", "guitar", "cx cy h [body]", "acoustic guitar standing upright (cx,cy = middle of the body, h = total height)", (a, P) => P.at(a.cx, a.cy, a.h / 250, () => {
  const b = a.body || C("#c9772b"), dk = shade(b, -0.5), wood = C("#4a2c12");
  P.ellipse(0, 52, 52, 56, b, dk, 3); P.ellipse(0, 4, 38, 40, b, dk, 3);
  P.ellipse(0, 28, 36, 40, b);
  P.ellipse(-16, 40, 12, 30, WHITE(0.14));
  P.rrect(-9, -120, 18, 132, 4, wood, C("#2a1808"), 2);
  P.rrect(-14, -156, 28, 44, 6, shade(wood, 0.1), C("#2a1808"), 2);
  for (const s of [-1, 1]) for (const y of [-148, -134, -120]) P.circle(s * 18, y, 3.5, C("#d9d9d9"), C("#777"), 1);
  P.circle(0, 38, 17, C("#1b1008"), shade(b, 0.2), 4);
  P.rrect(-22, 84, 44, 8, 3, wood);
  for (let k = -2; k <= 2; k++) P.line(k * 3.2, -112, k * 3.6, 88, C("#e8e8e8"), 1.1);
  for (const y of [-90, -64, -40, -18]) P.line(-9, y, 9, y, C("#aaa"), 1.5);
}));
def("Objects", "mug", "cx baseY w [color]", "coffee mug with steam (w = width of cup)", (a, P) => P.at(a.cx, a.baseY, a.w / 80, () => {
  const c = a.color || C("#e53935"), dk = shade(c, -0.4);
  P.ellipse(0, 1, 56, 7, BLACK(0.2));
  P.arc(40, -42, 24, 26, -90, 180, dk, 12); P.arc(40, -42, 24, 26, -90, 180, c, 8);
  P.rrect(-40, -80, 80, 80, 10, c, dk, 2.5);
  P.ellipse(0, -80, 40, 8, C("#6b3e1e"), dk, 2);
  P.rrect(-32, -66, 10, 50, 5, WHITE(0.3));
  P.curve([[-12, -92], [-4, -108], [-14, -122], [-6, -138]], WHITE(0.7), 4);
  P.curve([[12, -92], [20, -108], [10, -122], [18, -138]], WHITE(0.6), 4);
}));
def("Objects", "book", "cx baseY w [color]", "closed book standing up (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 100, () => {
  const c = a.color || C("#2e6fd8"), dk = shade(c, -0.45);
  P.ellipse(4, 1, 64, 6, BLACK(0.2));
  P.rect(40, -134, 12, 130, C("#fff8e3"), C("#bfb596"), 1.5);
  for (let y = -128; y < -8; y += 7) P.line(40, y, 52, y, C("#d8cfae"), 1);
  P.rrect(-48, -138, 90, 138, 5, c, dk, 2.5);
  P.rect(-48, -138, 12, 138, dk);
  P.rect(-24, -112, 54, 8, C("#ffd23f")); P.rect(-18, -96, 42, 5, WHITE(0.7));
  x4star(P, 3, -52, 20, C("#ffd23f"));
}));
def("Objects", "tv", "cx baseY w [color]", "television with antenna and a colorful picture (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 170, () => {
  const c = a.color || C("#4a4f5a"), dk = shade(c, -0.5);
  P.ellipse(0, 1, 60, 5, BLACK(0.2));
  P.rect(-30, -14, 60, 12, dk); P.rrect(-50, -8, 100, 8, 4, c, dk, 2);
  P.line(0, -126, -34, -168, C("#555"), 3); P.line(0, -126, 34, -168, C("#555"), 3);
  P.rrect(-84, -126, 168, 112, 12, c, dk, 3);
  P.rrect(-74, -116, 148, 92, 8, P.linGrad(-74, -116, 74, -24, [[0, C("#29b6f6")], [0.5, C("#ab47bc")], [1, C("#ff7043")]]));
  P.ellipse(-30, -94, 30, 8, WHITE(0.3));
  P.circle(60, -18, 3, C("#69f0ae")); P.circle(74, -18, 3, C("#ff5252"));
}));
def("Objects", "ball", "cx cy r", "soccer ball (r = radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const k = C("#222");
  P.ellipse(0, 100, 80, 10, BLACK(0.2));
  P.circle(0, 0, 100, P.radGrad(0, 0, 130, [[0, WHITE()], [1, C("#cfd4dc")]], -30, -30), k, 3);
  const pent = (x, y, r, rot) => { const pts = []; for (let i = 0; i < 5; i++) { const t = ((rot - 90 + i * 72) * Math.PI) / 180; pts.push([x + r * Math.cos(t), y + r * Math.sin(t)]); } P.poly(pts, k); };
  pent(0, 0, 32, 0);
  for (let i = 0; i < 5; i++) { const t = ((-90 + i * 72) * Math.PI) / 180; P.line(32 * Math.cos(t), 32 * Math.sin(t), 62 * Math.cos(t), 62 * Math.sin(t), k, 3); pent(76 * Math.cos(t), 76 * Math.sin(t), 20, i * 72 + 36); }
  P.circle(-34, -40, 14, WHITE(0.35));
}));
def("Objects", "mushroom", "cx baseY h [color]", "red mushroom with white dots (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 100, () => {
  const c = a.color || C("#e53935");
  P.ellipse(0, 1, 44, 6, BLACK(0.2));
  P.rrect(-16, -56, 32, 56, 12, C("#f6ecd6"), C("#c9b995"), 2);
  P.pie(0, -52, 52, 46, 180, 180, c, shade(c, -0.4), 2.5);
  P.ellipse(0, -52, 52, 7, shade(c, -0.15), shade(c, -0.4), 2);
  [[-26, -76, 8], [4, -90, 9], [28, -72, 7], [-6, -66, 5]].forEach(([x, y, r]) => P.circle(x, y, r, WHITE()));
}));
def("Objects", "pyramid", "cx baseY w [color]", "desert pyramid (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#e2b45c"), dk = shade(c, -0.4);
  P.ellipse(0, 2, 120, 8, BLACK(0.18));
  P.poly([[-100, 0], [0, -120], [100, 0]], c, dk, 2.5);
  P.poly([[0, -120], [100, 0], [24, 0]], shade(c, -0.22));
  for (let r = 1; r < 6; r++) { const y = -r * 20, hw = 100 - (100 * -y) / 120; P.line(-hw, y, hw, y, alpha(dk, 0.5), 1.4); }
}));
def("Objects", "ghost", "cx baseY h", "cute floating ghost (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 110, () => {
  const w = C("#f4f6ff"), ln = C("#a9b2d6");
  P.circle(0, -60, 90, P.radGrad(0, -60, 90, [[0, C("#c5ccff@0.45")], [1, C("#c5ccff@0")]]));
  P.pie(0, -66, 44, 44, 180, 180, w, ln, 2.5);
  P.rect(-44, -68, 88, 54, w);
  P.line(-44, -66, -44, -18, ln, 2.5); P.line(44, -66, 44, -18, ln, 2.5);
  for (const x of [-30, 0, 30]) P.circle(x, -18, 14.5, w, ln, 2.5);
  P.rect(-40, -30, 80, 14, w);
  for (const s of [-1, 1]) P.ellipse(s * 16, -70, 6, 9, C("#222"));
  P.ellipse(0, -48, 8, 11, C("#222"));
  P.ellipse(-28, -54, 8, 5, C("#ff9fb5@0.6")); P.ellipse(28, -54, 8, 5, C("#ff9fb5@0.6"));
}));
def("Objects", "pumpkin", "cx baseY w", "Halloween pumpkin with a carved face (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 140, () => {
  const o = C("#ff8a1f"), dk = shade(o, -0.4);
  P.ellipse(0, 1, 70, 7, BLACK(0.2));
  P.ellipse(-40, -44, 36, 44, shade(o, -0.1), dk, 2); P.ellipse(40, -44, 36, 44, shade(o, -0.1), dk, 2);
  P.ellipse(-18, -44, 36, 48, o, dk, 2); P.ellipse(18, -44, 36, 48, o, dk, 2);
  P.rrect(-6, -102, 12, 22, 4, C("#4a7a2a"), C("#2a4a14"), 2);
  P.poly([[-34, -52], [-14, -52], [-24, -70]], C("#3a1d05")); P.poly([[34, -52], [14, -52], [24, -70]], C("#3a1d05"));
  P.poly([[-4, -42], [4, -42], [0, -50]], C("#3a1d05"));
  P.poly([[-40, -30], [-24, -22], [-12, -28], [0, -18], [12, -28], [24, -22], [40, -30], [30, -12], [0, -6], [-30, -12]], C("#3a1d05"));
  P.rect(-8, -26, 8, 8, C("#ffd23f")); P.rect(10, -26, 8, 8, C("#ffd23f"));
}));
def("Objects", "xmastree", "cx baseY h", "decorated Christmas tree with star and lights (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 180, () => {
  const g = C("#1f8a4c");
  P.ellipse(0, 2, 56, 6, BLACK(0.2));
  P.rect(-10, -22, 20, 22, C("#6b4423"), C("#3e2612"), 2);
  [[-70, -22, -86, 70], [-56, -66, -126, 56], [-40, -110, -160, 40]].forEach(([y0, y1, y2, hw], i) => { P.poly([[-hw, y0 + (i ? 12 : 0)], [hw, y0 + (i ? 12 : 0)], [0, y2]], shade(g, i * 0.06), shade(g, -0.4), 2); });
  P.poly([[-70, -22], [70, -22], [0, -86]], g, shade(g, -0.4), 2);
  P.poly([[-56, -66], [56, -66], [0, -126]], shade(g, 0.06), shade(g, -0.4), 2);
  P.poly([[-40, -110], [40, -110], [0, -160]], shade(g, 0.12), shade(g, -0.4), 2);
  x4star(P, 0, -166, 15, C("#ffd23f"));
  const cols = [C("#e53935"), C("#29b6f6"), C("#ffd23f"), C("#ab47bc")];
  [[-36, -34], [30, -40], [-6, -52], [-22, -80], [26, -88], [4, -108], [-14, -128], [14, -136], [48, -32], [-50, -30]].forEach(([x, y], i) => P.circle(x, y, 6, cols[i % 4], WHITE(0.6), 1.2));
}));
def("Landmarks", "mosque", "cx baseY w [color]", "mosque with a big dome, two minarets and crescent (w = total width)", (a, P) => P.at(a.cx, a.baseY, a.w / 300, () => {
  const c = a.color || C("#f3ead2"), dk = shade(c, -0.4), dome = C("#1f8a6a"), gold = C("#ffc83d");
  P.ellipse(0, 2, 150, 8, BLACK(0.18));
  for (const s of [-1, 1]) {
    const x = s * 120;
    P.rect(x - 12, -150, 24, 150, c, dk, 2); P.rect(x - 17, -104, 34, 7, dk); P.rect(x - 17, -150, 34, 7, dk);
    P.pie(x, -156, 14, 26, 180, 180, dome, shade(dome, -0.4), 2);
    P.line(x, -180, x, -196, gold, 2.5); P.arc(x, -202, 6, 6, 150, 260, gold, 2.5);
    P.rrect(x - 4, -132, 8, 16, 4, C("#2c3e50")); P.rrect(x - 4, -86, 8, 16, 4, C("#2c3e50")); P.rrect(x - 4, -48, 8, 16, 4, C("#2c3e50"));
  }
  P.rect(-92, -72, 184, 72, c, dk, 2.5);
  P.pie(-60, -72, 24, 22, 180, 180, dome, shade(dome, -0.4), 2); P.pie(60, -72, 24, 22, 180, 180, dome, shade(dome, -0.4), 2);
  P.rect(-34, -90, 68, 20, c, dk, 2);
  P.pie(0, -90, 52, 62, 180, 180, dome, shade(dome, -0.4), 2.5);
  P.pie(-10, -90, 30, 50, 180, 180, WHITE(0.14));
  P.line(0, -152, 0, -170, gold, 3); P.arc(0, -178, 9, 9, 150, 260, gold, 3.5);
  P.pie(0, -30, 16, 18, 180, 180, C("#3b2a1a")); P.rect(-16, -30, 32, 30, C("#3b2a1a"));
  for (const x of [-74, -50, 50, 74]) { P.pie(x, -34, 8, 12, 180, 180, dome); P.rect(x - 8, -34, 16, 24, dome); }
}));
def("Landmarks", "eiffel", "cx baseY h [color]", "Eiffel Tower (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 200, () => {
  const c = a.color || C("#5b4a3a"), dk = shade(c, -0.4);
  P.ellipse(0, 2, 64, 6, BLACK(0.18));
  P.poly([[-54, 0], [-34, 0], [-9, -125], [9, -125], [34, 0], [54, 0], [14, -170], [4, -200], [-4, -200], [-14, -170]], c, dk, 2);
  P.pie(0, 0, 22, 46, 180, 180, BLACK(0.4));
  P.rect(-40, -64, 80, 7, dk); P.rect(-22, -125, 44, 6, dk); P.rect(-10, -172, 20, 5, dk);
  for (const [y, hw] of [[-20, 48], [-45, 38], [-90, 24], [-108, 18]]) { P.line(-hw, y, hw * 0.4, y - 22, alpha(dk, 0.7), 1.5); P.line(hw, y, -hw * 0.4, y - 22, alpha(dk, 0.7), 1.5); }
  P.line(0, -200, 0, -214, dk, 2.5);
}));

// short names people use
Object.assign(ALIASES, {
  bunny: "rabbit", hare: "rabbit", teddy: "bear", dinosaur: "dino", trex: "dino", flagofcountry: "countryflag", nationalflag: "countryflag",
  bike: "bicycle", cycle: "bicycle", cellphone: "phone", mobile: "phone", smartphone: "phone", iphone: "phone",
  coffee: "mug", cup: "mug", television: "tv", soccer: "ball", football: "ball", xmas: "xmastree", christmastree: "xmastree",
  masjid: "mosque", halloween: "pumpkin", eiffeltower: "eiffel", chopper: "helicopter", locomotive: "train",
});

// extra hints appended to the help text (agent-cmd.js adds this after PAINT_HELP)
export const PAINT_EXTRA_HELP = `

MORE WHAT-TO-USE HINTS (new commands)
- rabbit bear panda penguin elephant lion owl duck turtle pig giraffe dino -> animals. (lion = head only, others are whole animals.)
- A national flag -> countryflag cx cy w NAME  (names: ${Object.keys(FLAGS).join(" ")}). Example: countryflag 400 300 520 pakistan
- bicycle train helicopter -> vehicles.  mosque eiffel pyramid -> landmarks.
- cactus volcano phone guitar mug book tv ball mushroom ghost pumpkin xmastree -> objects.

ANCHOR RULES (what the first numbers mean)
- Things that stand on the ground take  cx baseY h|w  : cx = horizontal middle, baseY = the ground line they stand on, then size.
- Round or floating things take  cx cy r|w|h  : cx cy = the middle of the thing.
- Boxes, windows, houses take  x y w h  : x y = TOP-LEFT corner.
- Keep the main subject big: for an 800x600 canvas use h or w of 250-450 for the star of the picture, and put baseY around 500-560.
- To draw something that is not in the list, combine shapes (circle ellipse rect rrect poly blob curve arc) back to front.`;
// =====================================================================
// PART 5 - MORE COMMANDS: sea animals, farm/desert animals, food, fantasy,
// furniture, vehicles, plants, buildings.
// Save as P5.js next to P1-P4 and run:  node Join.js
// (no imports, only def(...) commands; helpers are prefixed x5 so they never clash)
// =====================================================================
const x5eyes = (P, x, y, r, c = C("#222")) => {
  for (const s of [-1, 1]) { P.circle(s * x, y, r, c); P.circle(s * x + r * 0.3, y - r * 0.3, r * 0.35, WHITE()); }
};
const x5star = (P, x, y, r, f, st, lw) => CMDS.get("star").fn({ cx: x, cy: y, r, fill: f, stroke: st, lw: lw ?? 0 }, P);

// ---------------- SEA ----------------
def("Sea", "shark", "cx cy w [color]", "shark swimming right (cx,cy = middle, w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 300, () => {
  const c = a.color || C("#6f8fa8"), dk = shade(c, -0.4);
  P.poly([[-110, 0], [-160, -48], [-140, -4], [-156, 44]], shade(c, -0.1), dk, 2);
  P.poly([[-60, -26], [-92, -58], [-40, -30]], shade(c, -0.1), dk, 2);
  P.poly([[-6, -34], [28, -88], [46, -30]], c, dk, 2);
  P.blob([[-118, 0], [-60, -30], [20, -40], [90, -20], [128, 4], [90, 22], [20, 36], [-60, 24]], c, dk, 2.5);
  P.blob([[-70, 14], [0, 22], [80, 16], [120, 6], [80, 24], [10, 36], [-60, 26]], C("#eef3f7"));
  P.poly([[0, 24], [-34, 66], [34, 34]], shade(c, -0.1), dk, 2);
  P.circle(88, -6, 5, C("#111")); P.circle(89.5, -7.5, 1.6, WHITE());
  for (let k = 0; k < 3; k++) P.line(44 - k * 7, -18, 38 - k * 7, 4, dk, 2);
  P.arc(108, 6, 22, 9, 10, 140, dk, 2.5);
  for (let k = 0; k < 4; k++) P.poly([[98 + k * 7, 12], [103 + k * 7, 12], [100.5 + k * 7, 19]], WHITE());
}));
def("Sea", "whale", "cx cy w [color]", "blue whale with water spout (cx,cy = middle, w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 330, () => {
  const c = a.color || C("#3d6fa8"), dk = shade(c, -0.4), wt = C("#bfe9ff@0.9");
  P.curve([[70, -50], [66, -80], [54, -102]], wt, 5); P.curve([[70, -50], [76, -80], [92, -98]], wt, 5);
  for (const [x, y] of [[50, -108], [96, -104], [72, -96]]) P.circle(x, y, 4, wt);
  P.curve([[-120, 12], [-158, 2], [-172, -30]], c, 20);
  P.poly([[-172, -30], [-204, -62], [-178, -22]], c, dk, 2); P.poly([[-172, -30], [-146, -66], [-160, -24]], c, dk, 2);
  P.blob([[-125, 14], [-95, -30], [-20, -52], [60, -44], [118, -12], [124, 20], [72, 52], [-10, 58], [-85, 42]], c, dk, 2.5);
  P.blob([[-60, 34], [10, 46], [80, 42], [116, 24], [70, 56], [0, 60]], C("#cfe0ee"));
  for (let k = 0; k < 5; k++) P.line(-30 + k * 22, 40, -34 + k * 22, 54, alpha(dk, 0.5), 1.5);
  P.ellipse(-6, 26, 32, 9, shade(c, -0.15), dk, 2);
  P.circle(82, -2, 5, C("#111")); P.circle(83.5, -3.5, 1.7, WHITE());
  P.arc(66, 16, 52, 14, 10, 120, dk, 2.5);
}));
def("Sea", "octopus", "cx cy r [color]", "octopus with 8 arms (cx,cy = middle of the head, r = head size)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  const c = a.color || C("#b45fcb"), dk = shade(c, -0.4), lt = shade(c, 0.35);
  for (let k = 0; k < 8; k++) {
    const x = -52 + k * 15, d = k % 2 ? 1 : -1;
    P.curve([[x * 0.8, 24], [x * 1.3 + 8 * d, 62], [x * 1.5 - 10 * d, 96], [x * 1.9 + 8 * d, 122]], dk, 15);
    P.curve([[x * 0.8, 24], [x * 1.3 + 8 * d, 62], [x * 1.5 - 10 * d, 96], [x * 1.9 + 8 * d, 122]], c, 11);
    P.circle(x * 1.3 + 8 * d, 62, 2.5, lt);
  }
  P.ellipse(0, -8, 50, 54, c, dk, 2.5);
  P.ellipse(-16, -30, 14, 10, WHITE(0.25));
  for (const [x, y, r] of [[-26, -34, 4], [24, -40, 5], [0, -52, 3.5], [30, -18, 3.5]]) P.circle(x, y, r, lt);
  for (const s of [-1, 1]) { P.circle(s * 20, -4, 12, WHITE(), dk, 2); P.circle(s * 20 + 1, -3, 6, C("#111")); P.circle(s * 20 + 3, -6, 2, WHITE()); }
  P.arc(0, 20, 14, 8, 20, 140, dk, 2.5);
}));
def("Sea", "jellyfish", "cx cy r [color]", "glowing jellyfish with tentacles (cx,cy = middle of the dome)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  const c = a.color || C("#ff8fd0");
  P.circle(0, 10, 110, P.radGrad(0, 10, 110, [[0, alpha(c, 0.35)], [1, alpha(c, 0)]]));
  for (let k = -3; k <= 3; k++) P.curve([[k * 14, 14], [k * 14 + 8, 50], [k * 14 - 8, 86], [k * 14 + 6, 124]], alpha(shade(c, 0.2), 0.75), 3.5);
  for (const k of [-24, 0, 24]) P.curve([[k, 12], [k - 10, 44], [k + 10, 70], [k - 6, 100]], alpha(shade(c, 0.4), 0.9), 7);
  P.pie(0, 12, 56, 58, 180, 180, alpha(c, 0.85), shade(c, -0.25), 2.5);
  P.ellipse(0, 12, 56, 8, shade(c, -0.15), shade(c, -0.25), 2);
  P.ellipse(-18, -22, 14, 8, WHITE(0.5));
  for (const [x, y] of [[-20, -6], [10, -24], [26, -4]]) P.circle(x, y, 4, WHITE(0.5));
}));
def("Sea", "crab", "cx baseY w [color]", "red crab with big claws (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const c = a.color || C("#e5482f"), dk = shade(c, -0.4);
  P.ellipse(0, -1, 84, 6, BLACK(0.18));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P.polyline([[s * 38, -34 + k * 6], [s * (64 + k * 6), -50 + k * 10], [s * (82 + k * 8), -8]], dk, 5);
  for (const s of [-1, 1]) {
    P.line(s * 52, -50, s * 76, -82, c, 10);
    P.circle(s * 84, -96, 22, c, dk, 2.5);
    P.poly([[s * 78, -112], [s * 100, -126], [s * 98, -100]], shade(c, 0.1), dk, 2);
    P.poly([[s * 92, -86], [s * 108, -80], [s * 86, -74]], shade(c, -0.1), dk, 2);
  }
  P.ellipse(0, -34, 54, 36, c, dk, 2.5);
  P.ellipse(0, -26, 36, 18, shade(c, 0.2));
  for (const s of [-1, 1]) { P.line(s * 14, -64, s * 16, -80, dk, 3); P.circle(s * 16, -84, 8, WHITE(), dk, 2); P.circle(s * 16, -84, 3.5, C("#111")); }
  P.arc(0, -40, 14, 8, 20, 140, dk, 2.5);
}));
def("Sea", "starfish", "cx cy r [color]", "orange starfish with dots (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#ff9a3c"), dk = shade(c, -0.4);
  P.ellipse(4, 8, 96, 90, BLACK(0.12));
  x5star(P, 0, 0, 100, c, dk, 3);
  for (let k = 0; k < 5; k++) {
    const t = ((-90 + k * 72) * Math.PI) / 180;
    P.line(0, 0, 70 * Math.cos(t), 70 * Math.sin(t), shade(c, 0.3), 5);
    for (const d of [30, 48, 64]) P.circle(d * Math.cos(t), d * Math.sin(t), 3, shade(c, -0.3));
  }
  P.circle(0, 0, 10, shade(c, -0.15));
}));

// ---------------- FARM & DESERT ANIMALS ----------------
def("Animals", "horse", "cx baseY h [color]", "horse facing right with mane and tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 200, () => {
  const c = a.color || C("#a8662f"), dk = shade(c, -0.4), mane = C("#2a1a10");
  P.ellipse(0, -1, 84, 6, BLACK(0.2));
  P.curve([[-66, -116], [-94, -104], [-100, -62], [-88, -32]], mane, 14);
  for (const x of [-52, -28, 24, 48]) { P.rrect(x - 9, -86, 18, 80, 7, shade(c, x > 0 ? 0 : -0.1), dk, 2); P.rect(x - 9, -10, 18, 10, C("#222")); }
  P.poly([[30, -126], [64, -140], [90, -180], [64, -186]], c, dk, 2.5);
  P.ellipse(0, -110, 76, 38, c, dk, 2.5);
  P.blob([[40, -176], [58, -190], [54, -150], [66, -134], [48, -128], [38, -150]], mane);
  P.push(); P.translate(94, -176); P.rotate(32); P.ellipse(0, 0, 34, 15, c, dk, 2.5); P.pop();
  P.poly([[70, -194], [76, -214], [84, -190]], c, dk, 2);
  P.circle(88, -184, 4, C("#111")); P.circle(89.5, -185.5, 1.4, WHITE());
  P.ellipse(112, -168, 3.5, 2.5, dk);
}));
def("Animals", "cow", "cx baseY h", "black and white cow facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const dk = C("#222"), pk = C("#ffb3c1");
  P.ellipse(0, -1, 84, 6, BLACK(0.2));
  P.curve([[-72, -92], [-86, -70], [-82, -44]], dk, 4); P.circle(-82, -40, 6, dk);
  for (const x of [-52, -28, 28, 52]) { P.rrect(x - 9, -64, 18, 64, 6, WHITE(), dk, 2); P.rect(x - 9, -8, 18, 8, dk); }
  P.ellipse(0, -90, 76, 40, WHITE(), dk, 2.5);
  P.blob([[-48, -108], [-20, -122], [-8, -98], [-34, -84], [-54, -92]], dk);
  P.blob([[20, -70], [46, -80], [56, -62], [34, -54]], dk);
  P.ellipse(8, -52, 16, 9, pk, shade(pk, -0.3), 1.5);
  P.ellipse(80, -104, 30, 26, WHITE(), dk, 2.5);
  P.blob([[62, -118], [86, -126], [90, -108], [70, -102]], dk);
  P.ellipse(98, -92, 19, 14, pk, shade(pk, -0.3), 2);
  P.ellipse(94, -92, 2.4, 3.5, dk); P.ellipse(103, -92, 2.4, 3.5, dk);
  P.poly([[66, -126], [60, -146], [76, -130]], C("#f3ead3"), dk, 1.5);
  P.ellipse(58, -108, 16, 8, WHITE(), dk, 2);
  P.circle(84, -112, 4, C("#111")); P.circle(85.4, -113.4, 1.3, WHITE());
}));
def("Animals", "chicken", "cx baseY h [color]", "chicken with red comb facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 120, () => {
  const c = a.color || C("#fbfbf6"), dk = shade(c, -0.4), og = C("#ff9a1f"), rd = C("#e53935");
  P.ellipse(0, -1, 46, 5, BLACK(0.18));
  P.polyline([[-8, -22], [-10, -4]], og, 3); P.polyline([[10, -22], [12, -4]], og, 3);
  for (const x of [-10, 12]) { P.line(x, -4, x - 8, -1, og, 3); P.line(x, -4, x + 8, -1, og, 3); }
  P.poly([[-34, -46], [-58, -78], [-50, -50], [-62, -56], [-40, -36]], shade(c, -0.1), dk, 2);
  P.ellipse(0, -46, 42, 34, c, dk, 2.5);
  P.ellipse(-4, -44, 24, 16, shade(c, -0.1), dk, 2);
  P.circle(30, -84, 18, c, dk, 2.5);
  for (const [x, y] of [[26, -102], [34, -104], [42, -98]]) P.circle(x, y, 6, rd, shade(rd, -0.3), 1.5);
  P.poly([[46, -86], [64, -80], [46, -76]], og, shade(og, -0.35), 1.5);
  P.ellipse(44, -70, 5, 9, rd);
  P.circle(36, -88, 3.6, C("#111"));
}));
def("Animals", "frog", "cx baseY h [color]", "green frog sitting (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 80, () => {
  const c = a.color || C("#58b84a"), dk = shade(c, -0.4), lt = shade(c, 0.4);
  P.ellipse(0, -1, 62, 6, BLACK(0.18));
  for (const s of [-1, 1]) { P.ellipse(s * 46, -14, 24, 14, c, dk, 2); P.ellipse(s * 62, -4, 18, 6, c, dk, 2); }
  P.ellipse(0, -34, 52, 34, c, dk, 2.5);
  P.ellipse(0, -26, 34, 20, lt);
  for (const s of [-1, 1]) { P.ellipse(s * 20, -30, 9, 16, c, dk, 2); P.ellipse(s * 20, -4, 12, 6, c, dk, 2); }
  for (const s of [-1, 1]) { P.circle(s * 26, -60, 14, c, dk, 2.5); P.circle(s * 26, -61, 9, WHITE(), dk, 1.5); P.circle(s * 26, -61, 4.5, C("#111")); }
  P.arc(0, -42, 30, 14, 15, 150, dk, 3);
  P.circle(-5, -54, 1.8, dk); P.circle(5, -54, 1.8, dk);
  P.ellipse(-34, -38, 7, 4, C("#ff7a93@0.4")); P.ellipse(34, -38, 7, 4, C("#ff7a93@0.4"));
}));
def("Animals", "bee", "cx cy s", "bee seen from the side (cx,cy = middle, s = half length)", (a, P) => P.at(a.cx, a.cy, a.s / 50, () => {
  const y = C("#ffd23f"), k = C("#222");
  for (const s of [-1, 1]) { P.push(); P.translate(s * 6, -22); P.rotate(s * 22); P.ellipse(0, -14, 15, 26, C("#cfe9ff@0.7"), C("#8bb6d8"), 1.5); P.pop(); }
  P.poly([[44, -5], [64, 0], [44, 5]], k);
  P.ellipse(8, 0, 42, 28, y, shade(y, -0.5), 2.5);
  for (const x of [-4, 14, 30]) P.ellipse(x, 0, 6, Math.max(4, 28 * Math.sqrt(1 - ((x - 8) / 42) ** 2) - 1.5), k);
  P.circle(-42, 2, 18, k);
  P.circle(-48, -3, 5, WHITE()); P.circle(-47, -3, 2.3, k);
  P.curve([[-50, -14], [-60, -34], [-52, -44]], k, 2.5); P.curve([[-40, -16], [-38, -36], [-28, -44]], k, 2.5);
  P.arc(-50, 10, 7, 5, 10, 140, y, 2);
}));
def("Animals", "ladybug", "cx cy r", "ladybug seen from above (r = body radius)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  const k = C("#222"), rd = C("#e52b2b");
  P.ellipse(4, 8, 50, 50, BLACK(0.15));
  for (const s of [-1, 1]) { P.curve([[s * 12, -52], [s * 22, -74], [s * 34, -80]], k, 2.5); P.circle(s * 34, -80, 3, k); }
  P.circle(0, 6, 48, rd, shade(rd, -0.45), 3);
  P.pie(0, -34, 26, 20, 180, 180, k);
  for (const s of [-1, 1]) P.circle(s * 11, -44, 5, WHITE());
  P.line(0, -30, 0, 54, k, 3);
  for (const [x, y, r] of [[-24, -6, 8], [24, -6, 8], [-28, 26, 7], [28, 26, 7], [-10, 40, 5], [10, 40, 5]]) P.circle(x, y, r, k);
  P.ellipse(-18, -18, 10, 6, WHITE(0.35));
}));
def("Animals", "snail", "cx baseY w [color]", "snail with a spiral shell (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 160, () => {
  const sh = a.color || C("#c9772b"), sk = C("#e8d38a"), dk = shade(sk, -0.4);
  P.ellipse(0, -1, 78, 5, BLACK(0.15));
  P.ellipse(0, -9, 80, 12, sk, dk, 2);
  P.curve([[50, -10], [72, -34], [70, -62]], dk, 18); P.curve([[50, -10], [72, -34], [70, -62]], sk, 14);
  P.circle(70, -66, 13, sk, dk, 2);
  for (const s of [-1, 1]) { P.line(66 + s * 6, -76, 66 + s * 14, -98, dk, 2.5); P.circle(66 + s * 14, -100, 4, C("#222")); }
  P.arc(74, -62, 6, 4, 20, 140, dk, 2);
  P.circle(-8, -52, 44, sh, shade(sh, -0.45), 3);
  P.arc(-8, -52, 30, 30, 0, 300, shade(sh, -0.45), 3.5);
  P.arc(-8, -52, 18, 18, 60, 300, shade(sh, -0.45), 3.5);
  P.circle(-8, -52, 5, shade(sh, -0.45));
  P.ellipse(-24, -72, 12, 6, WHITE(0.3));
}));
def("Animals", "camel", "cx baseY h [color]", "one-hump camel facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 190, () => {
  const c = a.color || C("#d3a35f"), dk = shade(c, -0.4);
  P.ellipse(0, -1, 84, 6, BLACK(0.2));
  P.curve([[-66, -108], [-80, -86], [-76, -60]], dk, 4);
  for (const x of [-52, -28, 28, 52]) { P.rrect(x - 8, -100, 16, 100, 6, shade(c, x > 0 ? 0 : -0.1), dk, 2); P.ellipse(x, -4, 11, 5, dk); }
  P.curve([[44, -116], [66, -146], [70, -176]], dk, 24); P.curve([[44, -116], [66, -146], [70, -176]], c, 19);
  P.ellipse(0, -112, 68, 32, c, dk, 2.5);
  P.ellipse(-8, -146, 24, 24, c, dk, 2.5);
  P.ellipse(-8, -112, 40, 20, shade(c, 0.12));
  P.push(); P.translate(84, -180); P.rotate(12); P.ellipse(0, 0, 25, 14, c, dk, 2.5); P.pop();
  P.ellipse(60, -190, 5, 8, c, dk, 1.5);
  P.circle(80, -186, 3.5, C("#111")); P.ellipse(106, -178, 3, 2, dk);
  P.line(60, -114, 120, -114, C("#00000000"), 1);
}));

// ---------------- FOOD ----------------
def("Food", "banana", "cx cy w [color]", "banana (cx,cy = middle, w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#ffe14d"), dk = shade(c, -0.45);
  const pts = [[-92, -34], [-44, 26], [40, 30], [92, -40]];
  P.curve(pts, dk, 34); P.curve(pts, c, 28);
  P.curve([[-80, -22], [-40, 16], [38, 20], [82, -30]], shade(c, 0.35), 6);
  P.circle(-93, -36, 8, C("#5a3a1a")); P.circle(93, -42, 7, C("#5a3a1a"));
}));
def("Food", "strawberry", "cx cy r", "strawberry with leaves and seeds (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 56, () => {
  const rd = C("#e0303f"), gr = C("#3c9a46");
  P.ellipse(4, 10, 46, 52, BLACK(0.12));
  P.blob([[0, 58], [-34, 34], [-52, -6], [-38, -34], [0, -42], [38, -34], [52, -6], [34, 34]], rd, shade(rd, -0.4), 2.5);
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r + 1; k++) P.ellipse(-((r + 1) * 9) + k * 18, -22 + r * 20, 2.6, 4, C("#ffe27a"));
  for (const [x, y] of [[-6, -6], [10, 8], [-12, 14]]) P.ellipse(x, y, 2.6, 4, C("#ffe27a"));
  for (let k = -2; k <= 2; k++) P.poly([[0, -42], [k * 20 - 8, -58 + Math.abs(k) * 5], [k * 20 + 8, -54 + Math.abs(k) * 5]], gr, shade(gr, -0.4), 1.5);
  P.line(0, -42, 2, -70, C("#2e7d32"), 4);
  P.ellipse(-24, -14, 8, 18, WHITE(0.3));
}));
def("Food", "watermelon", "cx cy w", "watermelon half-slice (cx,cy = middle of the flat top edge, w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  P.pie(0, 0, 100, 100, 0, 180, C("#2e8b3a"), C("#1b5a24"), 2.5);
  P.pie(0, 0, 90, 90, 0, 180, C("#f4f9d8"));
  P.pie(0, 0, 82, 82, 0, 180, C("#ee3b4a"));
  for (const [x, y, r] of [[-50, 30, 0], [-20, 50, 0], [14, 36, 0], [46, 54, 0], [-34, 70, 0], [30, 74, 0], [60, 24, 0], [-62, 56, 0], [0, 18, 0]]) P.ellipse(x, y, 4, 7, C("#2a1a10"));
  P.line(-100, 0, 100, 0, C("#1b5a24"), 3);
}));
def("Food", "burger", "cx baseY w", "hamburger with cheese, lettuce and tomato (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const bun = C("#e8a950"), dk = shade(bun, -0.4);
  P.ellipse(0, 2, 100, 6, BLACK(0.18));
  P.rrect(-90, -28, 180, 28, 12, shade(bun, -0.08), dk, 2.5);
  P.rrect(-96, -50, 192, 24, 12, C("#5a2d14"), C("#341608"), 2);
  P.poly([[-96, -52], [96, -52], [60, -34], [30, -52], [0, -30], [-30, -52], [-60, -34]], C("#ffcf33"), shade(C("#ffcf33"), -0.4), 1.5);
  P.blob([[-100, -64], [-70, -56], [-40, -66], [-10, -56], [20, -66], [50, -56], [80, -66], [100, -60], [90, -72], [-90, -72]], C("#5cb85c"), C("#3a8a3a"), 1.5);
  P.rrect(-88, -78, 176, 14, 7, C("#e53935"), shade(C("#e53935"), -0.4), 1.5);
  P.pie(0, -76, 94, 66, 180, 180, bun, dk, 2.5);
  for (const [x, y] of [[-50, -110], [-20, -128], [18, -124], [50, -108], [0, -104], [-70, -94], [70, -92]]) P.ellipse(x, y, 5, 3, C("#fff3d6"));
  P.ellipse(-40, -122, 22, 8, WHITE(0.25));
}));
def("Food", "donut", "cx cy r [color]", "donut with icing and sprinkles (cx,cy = middle, r = outer radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const ic = a.color || C("#ff8fb8");
  P.circle(5, 8, 100, null, BLACK(0.12), 56);
  P.circle(0, 0, 72, null, C("#e0a85a"), 56);
  P.circle(0, 0, 72, null, shade(C("#e0a85a"), -0.3), 2);
  P.circle(0, 0, 72, null, ic, 46);
  for (let k = 0; k < 14; k++) {
    const t = (k * 25.7 * Math.PI) / 180, r = 58 + (k % 3) * 14, cols = [C("#fff"), C("#ffd23f"), C("#4fc3f7"), C("#69f0ae"), C("#ab47bc")];
    P.push(); P.translate(r * Math.cos(t), r * Math.sin(t)); P.rotate(k * 47); P.rrect(-6, -2, 12, 4, 2, cols[k % 5]); P.pop();
  }
  P.circle(0, 0, 44, null, WHITE(0.25), 2);
}));
def("Food", "cupcake", "cx baseY w [color]", "cupcake with swirly frosting and cherry (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 120, () => {
  const fr = a.color || C("#ff9ec7"), wr = C("#4fc3f7");
  P.ellipse(0, 2, 62, 5, BLACK(0.18));
  P.poly([[-50, -52], [50, -52], [38, 0], [-38, 0]], wr, shade(wr, -0.4), 2.5);
  for (let k = -3; k <= 3; k++) P.line(k * 13, -52, k * 10, 0, shade(wr, -0.25), 2);
  P.ellipse(0, -52, 56, 10, shade(fr, -0.1), shade(fr, -0.4), 2);
  P.ellipse(0, -66, 46, 14, fr, shade(fr, -0.4), 2); P.ellipse(0, -82, 34, 12, shade(fr, 0.08), shade(fr, -0.4), 2);
  P.ellipse(0, -96, 20, 10, shade(fr, 0.15), shade(fr, -0.4), 2);
  P.circle(0, -112, 9, C("#d62828"), C("#8e1a1a"), 1.5); P.line(1, -120, 10, -132, C("#4a7a2a"), 2);
  P.ellipse(-14, -70, 10, 4, WHITE(0.4));
}));

// ---------------- FANTASY ----------------
def("Fantasy", "dragon", "cx baseY h [color]", "fire-breathing dragon facing right with wings (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 200, () => {
  const c = a.color || C("#4caf50"), dk = shade(c, -0.45), bl = C("#e8d38a");
  P.ellipse(0, -1, 92, 6, BLACK(0.2));
  P.poly([[100, -170], [180, -196], [152, -172], [190, -160], [150, -158], [172, -140], [100, -156]], C("#ff8a1f@0.9"));
  P.poly([[104, -166], [150, -178], [136, -166], [158, -156], [104, -160]], C("#ffe14d"));
  P.poly([[-6, -104], [-70, -196], [-44, -164], [-34, -206], [-12, -156], [8, -184], [24, -104]], shade(c, -0.2), dk, 2.5);
  for (const [x, y] of [[-34, -164], [-12, -156]]) P.line(-6, -104, x, y, dk, 2.5);
  P.curve([[-50, -66], [-110, -40], [-140, -74], [-168, -62]], dk, 20); P.curve([[-50, -66], [-110, -40], [-140, -74], [-168, -62]], c, 15);
  P.poly([[-168, -62], [-190, -80], [-188, -46]], shade(c, -0.1), dk, 2);
  for (const x of [-30, 34]) P.rrect(x - 13, -50, 26, 50, 9, shade(c, -0.1), dk, 2.5);
  P.curve([[40, -92], [68, -128], [66, -158]], dk, 30); P.curve([[40, -92], [68, -128], [66, -158]], c, 25);
  P.ellipse(0, -72, 62, 42, c, dk, 2.5); P.ellipse(8, -56, 40, 24, bl);
  P.ellipse(82, -168, 30, 20, c, dk, 2.5);
  P.poly([[70, -184], [60, -212], [80, -188]], C("#f3ead3"), dk, 1.5); P.poly([[88, -186], [86, -214], [100, -186]], C("#f3ead3"), dk, 1.5);
  P.circle(88, -174, 5, C("#ffd23f"), dk, 1.5); P.circle(89, -174, 2.2, C("#111"));
  P.ellipse(106, -166, 3.5, 2.5, dk);
  [[-34, -108, 14], [-10, -118, 17], [16, -118, 15], [-52, -96, 11]].forEach(([x, y, s]) => P.poly([[x - s * 0.6, y + s * 0.6], [x, y - s], [x + s * 0.6, y + s * 0.6]], C("#e8a33d"), shade(C("#e8a33d"), -0.4), 1.5));
}));
def("Fantasy", "astronaut", "cx baseY h", "astronaut in a white suit with a visor (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 170, () => {
  const wh = C("#f4f6fa"), gr = C("#9aa3b0");
  P.ellipse(0, -1, 40, 5, BLACK(0.18));
  P.rrect(-42, -112, 16, 62, 6, C("#c9d0da"), gr, 2); P.rrect(26, -112, 16, 62, 6, C("#c9d0da"), gr, 2);
  for (const s of [-1, 1]) { P.rrect(s * 14 - 12, -52, 24, 40, 9, wh, gr, 2.5); P.rrect(s * 14 - 14, -14, 28, 14, 6, gr, shade(gr, -0.4), 2); }
  for (const s of [-1, 1]) { P.line(s * 28, -100, s * 46, -62, gr, 20); P.line(s * 28, -100, s * 46, -62, wh, 16); P.circle(s * 47, -58, 9, gr, shade(gr, -0.4), 2); }
  P.rrect(-32, -108, 64, 62, 16, wh, gr, 2.5);
  P.rrect(-18, -92, 36, 22, 4, C("#2b3a4a"), gr, 1.5);
  P.circle(-8, -82, 3.5, C("#ff5252")); P.circle(2, -82, 3.5, C("#ffd740")); P.circle(12, -82, 3.5, C("#69f0ae"));
  P.circle(0, -134, 34, wh, gr, 3);
  P.ellipse(2, -134, 24, 20, P.radGrad(2, -134, 28, [[0, C("#4a6fa8")], [1, C("#101a30")]], -6, -142), gr, 2.5);
  P.ellipse(-8, -142, 8, 4, WHITE(0.6));
  P.rrect(-12, -168, 24, 6, 3, gr);
}));
def("Fantasy", "sword", "cx cy h [color]", "upright knight sword with a red gem (cx,cy = middle, h = total length)", (a, P) => P.at(a.cx, a.cy, a.h / 200, () => {
  const g = a.color || C("#ffc83d"), st = C("#cfd6df");
  P.poly([[0, -108], [11, -88], [11, 30], [-11, 30], [-11, -88]], st, C("#7f8a99"), 2.5);
  P.line(0, -96, 0, 26, C("#7f8a99"), 2.5);
  P.poly([[0, -108], [11, -88], [0, -88]], WHITE(0.35));
  P.rrect(-34, 30, 68, 12, 6, g, shade(g, -0.5), 2.5);
  P.rrect(-6, 42, 12, 36, 4, C("#6b3e1e"), C("#3a2412"), 2);
  for (let k = 0; k < 3; k++) P.line(-6, 50 + k * 9, 6, 54 + k * 9, C("#3a2412"), 1.5);
  P.circle(0, 84, 10, g, shade(g, -0.5), 2.5);
  P.circle(0, 36, 4, C("#e53935"), shade(C("#e53935"), -0.4), 1);
}));
def("Fantasy", "shield", "cx cy h [color]", "heraldic shield with a star (cx,cy = middle, h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 200, () => {
  const bl = a.color || C("#1e5fbf"), rd = C("#d62828"), g = C("#ffc83d");
  P.poly([[-60, -94], [64, -90], [64, 6], [4, 104], [-56, 6]], BLACK(0.18));
  P.poly([[-62, -96], [62, -96], [62, 4], [0, 100], [-62, 4]], bl);
  P.poly([[0, -96], [62, -96], [62, 4], [0, 100]], rd);
  P.poly([[-62, -96], [62, -96], [62, 4], [0, 100], [-62, 4]], null, g, 7);
  x5star(P, 0, -8, 34, g, shade(g, -0.5), 2);
  P.line(-62, -96, 62, -96, shade(g, 0.3), 3);
}));

// ---------------- FURNITURE & THINGS ----------------
def("Objects", "bed", "cx baseY w [color]", "bed with pillow and blanket (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 240, () => {
  const bl = a.color || C("#4a90d9"), wd = C("#7b4a22");
  P.ellipse(0, 2, 124, 6, BLACK(0.18));
  P.rrect(-118, -90, 16, 90, 5, wd, shade(wd, -0.4), 2); P.rrect(104, -50, 14, 50, 5, wd, shade(wd, -0.4), 2);
  P.rrect(-112, -40, 226, 16, 6, wd, shade(wd, -0.4), 2);
  P.rrect(-104, -66, 208, 30, 10, C("#f4f1ea"), C("#b8b2a0"), 2);
  P.rrect(-96, -78, 60, 20, 10, WHITE(), C("#b8b2a0"), 2);
  P.rrect(-40, -70, 144, 34, 8, bl, shade(bl, -0.4), 2.5);
  P.rrect(-40, -70, 40, 34, 8, shade(bl, 0.25), shade(bl, -0.4), 2);
  for (const x of [-10, 20, 50, 80]) P.line(x, -66, x, -40, shade(bl, -0.2), 2);
}));
def("Objects", "chair", "cx baseY h [color]", "wooden chair (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#a8662f"), dk = shade(c, -0.45);
  P.ellipse(0, 2, 56, 5, BLACK(0.18));
  P.rrect(-38, -74, 8, 74, 3, c, dk, 2); P.rrect(30, -74, 8, 74, 3, c, dk, 2);
  P.rrect(-34, -150, 68, 70, 8, c, dk, 2.5);
  for (const x of [-18, 0, 18]) P.rrect(x - 4, -138, 8, 48, 3, shade(c, 0.2), dk, 1.5);
  P.rrect(-44, -80, 88, 14, 5, shade(c, 0.1), dk, 2.5);
  P.rrect(-42, -38, 8, 38, 3, shade(c, -0.1), dk, 2); P.rrect(34, -38, 8, 38, 3, shade(c, -0.1), dk, 2);
}));
def("Objects", "lamp", "cx baseY h [color]", "table lamp with warm glow (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 160, () => {
  const sh = a.color || C("#ffd966");
  P.circle(0, -108, 100, P.radGrad(0, -108, 100, [[0, C("#ffe9a0@0.55")], [1, C("#ffe9a0@0")]]));
  P.ellipse(0, 2, 40, 6, BLACK(0.2));
  P.ellipse(0, -4, 36, 9, C("#5a4a3a"), C("#2a2018"), 2); P.rect(-6, -70, 12, 66, C("#8a7a6a"), C("#4a3a2a"), 2);
  P.poly([[-30, -148], [30, -148], [52, -76], [-52, -76]], sh, shade(sh, -0.4), 2.5);
  P.poly([[-30, -148], [-10, -148], [-26, -76], [-52, -76]], WHITE(0.25));
  P.ellipse(0, -76, 52, 8, shade(sh, -0.15), shade(sh, -0.4), 2);
}));
def("Objects", "camera", "cx cy w [color]", "photo camera with lens and flash (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#3a3f48"), sv = C("#c9d0da");
  P.rrect(-86, -50, 176, 108, 14, BLACK(0.15));
  P.rrect(-90, -54, 180, 108, 14, c, shade(c, -0.5), 2.5);
  P.rrect(-90, -54, 180, 34, 12, sv, shade(sv, -0.5), 2.5);
  P.rrect(-70, -74, 34, 22, 5, c, shade(c, -0.5), 2);
  P.rrect(-70, -78, 28, 6, 3, C("#e53935"));
  P.circle(0, 8, 44, C("#1b1f26"), C("#8a93a0"), 5);
  P.circle(0, 8, 32, P.radGrad(0, 8, 32, [[0, C("#4a6fa8")], [1, C("#0f1830")]], -8, 0), C("#555"), 3);
  P.circle(-10, -2, 8, WHITE(0.45));
  P.rrect(52, -42, 26, 14, 4, C("#fff3b0"), shade(c, -0.5), 1.5);
  P.circle(70, -62, 8, C("#e53935"), shade(C("#e53935"), -0.4), 2);
}));
def("Objects", "headphones", "cx cy w [color]", "over-ear headphones (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#e53935"), dk = shade(c, -0.5);
  P.arc(0, 10, 76, 90, 180, 180, dk, 16); P.arc(0, 10, 76, 90, 180, 180, C("#3a3f48"), 11);
  for (const s of [-1, 1]) {
    P.ellipse(s * 76, 20, 28, 44, c, dk, 3);
    P.ellipse(s * 76, 20, 17, 32, shade(c, -0.25), dk, 2);
    P.ellipse(s * 70, 4, 8, 14, WHITE(0.25));
  }
}));
def("Objects", "key", "cx cy w [color]", "golden key lying horizontally (w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 220, () => {
  const g = a.color || C("#ffc83d"), dk = shade(g, -0.5);
  P.circle(-82, 0, 28, null, dk, 18); P.circle(-82, 0, 28, null, g, 13);
  P.rect(-56, -7, 150, 14, g, dk, 2.5);
  P.rect(60, 4, 14, 26, g, dk, 2.5); P.rect(82, 4, 12, 20, g, dk, 2.5); P.rect(40, 4, 10, 16, g, dk, 2.5);
  P.line(-52, -3, 90, -3, WHITE(0.4), 2.5);
  P.circle(-82, 0, 7, shade(g, 0.2));
}));

// ---------------- VEHICLES ----------------
def("Vehicles", "motorcycle", "cx baseY w [color]", "side-view motorcycle facing right (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 220, () => {
  const c = a.color || C("#d62828"), tire = C("#222"), dk = shade(c, -0.45);
  P.ellipse(0, -1, 100, 5, BLACK(0.2));
  for (const x of [-68, 70]) { P.circle(x, -36, 36, null, tire, 9); P.circle(x, -36, 28, null, C("#9aa3ad"), 2); P.circle(x, -36, 8, C("#555")); for (let k = 0; k < 8; k++) { const t = (k * 45 * Math.PI) / 180; P.line(x, -36, x + 28 * Math.cos(t), -36 + 28 * Math.sin(t), C("#9aa3ad"), 1); } }
  P.polyline([[70, -36], [56, -74], [36, -92]], C("#8a93a0"), 7);
  P.polyline([[-68, -36], [-30, -48], [14, -44], [30, -62]], C("#555"), 8);
  P.poly([[-70, -60], [-34, -76], [10, -70], [20, -52], [-20, -42], [-64, -48]], c, dk, 2.5);
  P.blob([[-4, -90], [30, -100], [46, -82], [18, -66], [-8, -72]], c, dk, 2.5);
  P.rrect(-60, -74, 56, 12, 6, C("#2b2b2b"));
  P.polyline([[30, -96], [38, -112], [56, -114]], C("#444"), 5);
  P.circle(70, -86, 11, C("#fff3a8"), dk, 2.5);
  P.rrect(-92, -34, 54, 9, 4, C("#9aa3ad"), C("#555"), 1.5);
  P.circle(-10, -38, 11, C("#555"), C("#333"), 2);
}));
def("Vehicles", "firetruck", "cx baseY w [color]", "red fire truck with ladder (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 280, () => {
  const c = a.color || C("#d62828"), dk = shade(c, -0.45), gl = C("#bfe6ff");
  P.ellipse(0, -1, 130, 7, BLACK(0.22));
  P.rrect(-130, -80, 168, 56, 6, c, dk, 2.5);
  P.rect(-130, -50, 168, 6, WHITE(0.85));
  P.rrect(40, -92, 86, 68, 8, c, dk, 2.5);
  P.rrect(88, -84, 30, 28, 4, gl, dk, 1.5); P.rrect(50, -84, 30, 28, 4, gl, dk, 1.5);
  P.rect(40, -50, 86, 6, WHITE(0.85));
  P.rrect(-124, -108, 154, 10, 3, C("#c9d0da"), C("#7f8a99"), 2);
  for (let k = 0; k < 12; k++) P.line(-118 + k * 12.5, -108, -118 + k * 12.5, -98, C("#7f8a99"), 2);
  P.circle(-96, -62, 16, C("#ffd23f"), dk, 2.5);
  P.circle(76, -100, 6, C("#2e86de")); P.circle(98, -100, 6, C("#ff5252"));
  P.rect(124, -42, 8, 14, C("#fff3a8"));
  for (const x of [-90, -30, 70, 110]) { P.circle(x, -20, 20, C("#222")); P.circle(x, -20, 10, C("#c8ccd2")); }
}));
def("Vehicles", "submarine", "cx cy w [color]", "yellow submarine with periscope and bubbles (w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 240, () => {
  const c = a.color || C("#ffd23f"), dk = shade(c, -0.45);
  for (const [x, y, r] of [[-150, -20, 6], [-162, -44, 4], [-146, -68, 5], [-158, -92, 3]]) P.circle(x, y, r, C("#bfe9ff@0.6"), WHITE(0.8), 1.5);
  P.line(0, -44, 0, -84, C("#8a93a0"), 5); P.line(0, -84, 18, -84, C("#8a93a0"), 5);
  P.rrect(-26, -62, 52, 34, 10, c, dk, 2.5);
  P.ellipse(0, 0, 112, 38, c, dk, 3);
  P.ellipse(-10, -16, 80, 8, WHITE(0.3));
  for (const x of [-60, -20, 20, 60]) { P.circle(x, 0, 11, C("#8ec5ff"), C("#7f8a99"), 3); P.ellipse(x - 3, -3, 3, 4, WHITE(0.6)); }
  P.poly([[-110, -8], [-134, -30], [-134, 30], [-110, 8]], shade(c, -0.15), dk, 2.5);
  P.ellipse(-138, 0, 6, 28, C("#8a93a0"), C("#555"), 2);
  P.poly([[-30, 34], [10, 34], [0, 50], [-24, 50]], shade(c, -0.2), dk, 2);
}));
def("Vehicles", "tractor", "cx baseY w [color]", "green farm tractor facing right (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 220, () => {
  const c = a.color || C("#3c9a46"), dk = shade(c, -0.45), tire = C("#222");
  P.ellipse(0, -1, 100, 6, BLACK(0.2));
  P.rrect(-4, -66, 100, 30, 8, c, dk, 2.5);
  P.rrect(-20, -112, 56, 56, 6, c, dk, 2.5);
  P.rrect(-12, -104, 40, 32, 4, C("#bfe6ff"), dk, 2);
  P.rect(-24, -116, 64, 8, dk);
  P.rect(82, -92, 8, 28, C("#555")); P.rect(80, -96, 12, 6, C("#333"));
  P.circle(92, -50, 7, C("#fff3a8"), dk, 1.5);
  P.rrect(-20, -50, 112, 12, 6, shade(c, -0.15), dk, 2);
  P.circle(-44, -44, 44, tire); P.circle(-44, -44, 26, C("#e8c13a"), shade(C("#e8c13a"), -0.4), 2.5); P.circle(-44, -44, 7, C("#555"));
  P.circle(74, -26, 26, tire); P.circle(74, -26, 15, C("#e8c13a"), shade(C("#e8c13a"), -0.4), 2.5); P.circle(74, -26, 5, C("#555"));
  for (let k = 0; k < 14; k++) { const t = (k * 25.7 * Math.PI) / 180; P.line(-44 + 40 * Math.cos(t), -44 + 40 * Math.sin(t), -44 + 46 * Math.cos(t), -44 + 46 * Math.sin(t), C("#444"), 4); }
}));

// ---------------- PLANTS & NATURE ----------------
def("Nature", "sunflower", "cx baseY h", "tall sunflower with leaves (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 160, () => {
  const gr = C("#3c9a3c"), y = C("#ffcf33");
  P.line(0, 0, 0, -110, gr, 7);
  P.blob([[0, -40], [34, -62], [56, -46], [30, -30]], C("#4cb04c"), shade(gr, -0.3), 1.5);
  P.blob([[0, -64], [-34, -86], [-56, -70], [-30, -54]], C("#4cb04c"), shade(gr, -0.3), 1.5);
  for (let k = 0; k < 18; k++) { P.push(); P.translate(0, -122); P.rotate(k * 20); P.ellipse(0, -30, 9, 20, k % 2 ? shade(y, -0.1) : y, shade(y, -0.45), 1.2); P.pop(); }
  P.circle(0, -122, 26, C("#6b3e1e"), C("#3a2010"), 2);
  for (let k = 0; k < 24; k++) { const t = (k * 137.5 * Math.PI) / 180, r = 3 + k * 0.85; P.circle(r * Math.cos(t), -122 + r * Math.sin(t), 1.8, C("#3a2010")); }
}));
def("Nature", "rose", "cx baseY h [color]", "rose flower with stem and leaves (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#e0243f"), dk = shade(c, -0.45), gr = C("#2e8b3a");
  P.curve([[0, 0], [-4, -50], [2, -96]], gr, 5);
  P.blob([[-2, -34], [-34, -50], [-44, -36], [-18, -28]], C("#3c9a3c"), shade(gr, -0.3), 1.5);
  P.blob([[2, -58], [32, -76], [46, -62], [20, -52]], C("#3c9a3c"), shade(gr, -0.3), 1.5);
  for (const [x, y] of [[-6, -20], [4, -44]]) P.poly([[x, y], [x - 6, y - 3], [x, y - 7]], gr);
  P.circle(0, -116, 30, c, dk, 2.5);
  P.circle(-8, -112, 20, shade(c, 0.1), dk, 2);
  P.arc(0, -118, 14, 14, 200, 280, dk, 2.5); P.arc(2, -116, 8, 8, 20, 280, dk, 2.5);
  P.arc(-6, -108, 22, 18, 30, 120, dk, 2);
  for (const s of [-1, 1]) P.poly([[s * 22, -98], [s * 36, -92], [s * 20, -86]], gr, shade(gr, -0.3), 1);
}));
def("Nature", "snowflake", "cx cy r [color]", "six-armed ice snowflake (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const c = a.color || C("#bfe9ff");
  P.circle(0, 0, 110, P.radGrad(0, 0, 110, [[0, alpha(c, 0.35)], [1, alpha(c, 0)]]));
  for (let k = 0; k < 6; k++) {
    P.push(); P.rotate(k * 60);
    P.line(0, 0, 0, -100, c, 6);
    for (const [y, l] of [[-36, 26], [-62, 20], [-84, 12]]) { P.line(0, y, -l, y - l * 0.8, c, 4); P.line(0, y, l, y - l * 0.8, c, 4); }
    P.circle(0, -100, 5, WHITE());
    P.pop();
  }
  P.circle(0, 0, 12, WHITE(), c, 3);
}));
def("Nature", "island", "cx baseY w", "small tropical island with two palm trees (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 240, () => {
  P.ellipse(0, 6, 140, 16, C("#4aa3e8@0.45"));
  P.ellipse(0, 0, 112, 26, C("#f0d58a"), shade(C("#f0d58a"), -0.3), 2);
  P.ellipse(0, -12, 90, 14, shade(C("#f0d58a"), 0.15));
  P.ellipse(-30, -2, 30, 8, shade(C("#f0d58a"), -0.12));
  CMDS.get("palm").fn({ cx: -26, baseY: -14, h: 150 }, P);
  CMDS.get("palm").fn({ cx: 34, baseY: -10, h: 110 }, P);
  P.ellipse(60, -8, 12, 6, C("#8a8f98"), C("#5d626b"), 1.5);
  P.ellipse(-76, -6, 9, 5, C("#a3a8b0"), C("#5d626b"), 1.5);
}));

// ---------------- BUILDINGS ----------------
def("Buildings", "bridge", "cx baseY w [color]", "stone arch bridge over water (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 300, () => {
  const c = a.color || C("#b9b0a0"), dk = shade(c, -0.4);
  P.rect(-170, -4, 340, 20, C("#4aa3e8@0.6"));
  P.rect(-150, -50, 300, 50, c, dk, 2.5);
  for (const x of [-90, 0, 90]) P.pie(x, 0, 36, 40, 180, 180, C("#1b3a5c"), dk, 2);
  P.rect(-156, -64, 312, 14, shade(c, 0.1), dk, 2.5);
  for (let x = -148; x <= 140; x += 24) P.rrect(x, -88, 10, 26, 3, shade(c, 0.05), dk, 1.5);
  P.rect(-156, -92, 312, 8, shade(c, 0.15), dk, 2);
  for (let r = 0; r < 2; r++) for (let x = -140; x <= 130; x += 30) P.line(x + r * 15, -48 + r * 14, x + r * 15 + 18, -48 + r * 14, alpha(dk, 0.35), 1.2);
}));
def("Buildings", "igloo", "cx baseY w", "snow igloo with entrance (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const w = C("#f1f9ff"), ln = C("#a7c7dc");
  P.ellipse(0, 2, 112, 8, BLACK(0.14));
  P.pie(0, 0, 100, 82, 180, 180, w, ln, 2.5);
  for (const [ry, rx] of [[26, 94], [52, 84], [74, 54]]) P.arc(0, 0, rx, ry * 1.1, 180, 180, ln, 2);
  for (const x of [-60, -20, 20, 60]) P.line(x, -2, x * 0.9, -34, ln, 1.6);
  for (const x of [-46, 0, 46]) P.line(x * 0.85, -34, x * 0.78, -58, ln, 1.6);
  P.pie(62, 0, 40, 44, 180, 180, shade(w, -0.04), ln, 2.5);
  P.pie(62, 0, 24, 30, 180, 180, C("#2b4a66"), ln, 2);
  P.ellipse(-30, -50, 22, 8, WHITE(0.7));
}));

Object.assign(ALIASES, {
  pony: "horse", hen: "chicken", rooster: "chicken", ladybird: "ladybug", squid: "octopus", jelly: "jellyfish",
  sub: "submarine", motorbike: "motorcycle", fireengine: "firetruck", melon: "watermelon", spaceman: "astronaut",
  flake: "snowflake", headset: "headphones", keys: "key", wyvern: "dragon", sofa: "chair",
});
// =====================================================================
// PART 6 - MORE COMMANDS: animals, fantasy, food, objects, vehicles,
// landmarks, nature, shapes, effects, text styles, diagrams, charts, UI.
// Save as p6.js next to p1-p5 (and use the new join.js that reads p6.js).
// Only def(...) commands + ALIASES. Helpers are prefixed x6 so nothing clashes.
// =====================================================================
const x6eyes = (P, x, y, r, c = C("#222")) => {
  for (const s of [-1, 1]) { P.circle(s * x, y, r, c); P.circle(s * x + r * 0.3, y - r * 0.3, r * 0.35, WHITE()); }
};
const x6star = (P, x, y, r, f, st, lw) => CMDS.get("star").fn({ cx: x, cy: y, r, fill: f, stroke: st, lw: lw ?? 0 }, P);
const x6sh = (P, rx) => P.ellipse(0, -1, rx, Math.max(4, rx * 0.1), BLACK(0.2));
const x6ball = (P, x, y, r, c) => P.circle(x, y, r, P.radGrad(x, y, r * 1.5, [[0, shade(c, 0.35)], [1, shade(c, -0.2)]], x - r * 0.3, y - r * 0.3), shade(c, -0.45), 2);

delete ALIASES.sofa;

// ---------------- ANIMALS ----------------
def("Animals", "fox", "cx baseY h [color]", "sitting fox with a bushy tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#e8731f"), dk = shade(c, -0.4), wh = C("#fff6e8"), br = C("#3b2314");
  x6sh(P, 62);
  P.blob([[-30, -12], [-76, -22], [-102, -62], [-84, -102], [-52, -80], [-40, -44]], c, dk, 2.5);
  P.blob([[-84, -102], [-100, -80], [-90, -64], [-72, -90]], wh);
  P.ellipse(0, -46, 38, 48, c, dk, 2.5);
  P.ellipse(8, -40, 20, 36, wh);
  for (const s of [-1, 1]) P.ellipse(s * 16, -7, 14, 8, br, dk, 1.5);
  P.poly([[-36, -108], [-32, -150], [-8, -122]], c, dk, 2); P.poly([[36, -108], [32, -150], [8, -122]], c, dk, 2);
  P.poly([[-30, -118], [-29, -140], [-17, -124]], br); P.poly([[30, -118], [29, -140], [17, -124]], br);
  P.ellipse(0, -100, 40, 32, c, dk, 2.5);
  P.poly([[-40, -96], [-8, -72], [0, -62], [8, -72], [40, -96], [0, -86]], wh);
  P.ellipse(0, -66, 6, 5, br);
  for (const s of [-1, 1]) { P.ellipse(s * 17, -104, 4, 5.5, br); P.circle(s * 17 + 1.2, -106, 1.4, WHITE()); }
}));
def("Animals", "monkey", "cx baseY h [color]", "sitting monkey with a curly tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 140, () => {
  const c = a.color || C("#8d5a2b"), dk = shade(c, -0.4), fc = C("#f1c796");
  x6sh(P, 56);
  const tail = [[34, -20], [78, -14], [92, -50], [72, -72], [60, -54]];
  P.curve(tail, dk, 11); P.curve(tail, c, 7);
  P.ellipse(0, -50, 38, 44, c, dk, 2.5); P.ellipse(0, -44, 23, 31, fc);
  for (const s of [-1, 1]) {
    P.ellipse(s * 22, -8, 16, 9, c, dk, 2);
    P.push(); P.translate(s * 42, -60); P.rotate(s * -20); P.ellipse(0, 0, 10, 30, c, dk, 2); P.pop();
    P.circle(s * 38, -108, 15, c, dk, 2); P.circle(s * 38, -108, 8.5, fc);
  }
  P.circle(0, -102, 35, c, dk, 2.5);
  P.ellipse(0, -94, 27, 23, fc, shade(fc, -0.3), 1.5);
  x6eyes(P, 11, -108, 4.5);
  P.circle(-4, -97, 1.8, dk); P.circle(4, -97, 1.8, dk);
  P.arc(0, -90, 10, 6, 20, 140, dk, 2);
}));
def("Animals", "zebra", "cx baseY h", "zebra facing right with stripes (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 215, () => {
  const bk = C("#222"), wh = C("#fafafa");
  x6sh(P, 80);
  P.curve([[-66, -106], [-84, -84], [-80, -54]], bk, 4);
  for (const x of [-46, -24, 24, 46]) { P.rrect(x - 8, -82, 16, 82, 6, wh, bk, 2); P.rect(x - 8, -14, 16, 14, bk); }
  P.ellipse(0, -102, 72, 36, wh, bk, 2.5);
  for (let k = -3; k <= 3; k++) { const x = k * 18, hh = 36 * Math.sqrt(1 - (x / 72) ** 2) - 4; P.line(x - 3, -102 - hh, x + 3, -102 + hh, bk, 5); }
  P.poly([[30, -120], [54, -128], [72, -176], [48, -182]], wh, bk, 2.5);
  P.line(46, -140, 60, -146, bk, 4); P.line(52, -158, 66, -162, bk, 4);
  P.blob([[44, -184], [56, -198], [64, -176], [52, -150], [40, -162]], bk);
  P.push(); P.translate(78, -180); P.rotate(30); P.ellipse(0, 0, 30, 14, wh, bk, 2.5); P.pop();
  P.poly([[62, -188], [64, -208], [74, -188]], wh, bk, 2);
  P.circle(84, -186, 3.5, bk); P.ellipse(102, -170, 4, 3, bk);
}));
def("Animals", "sheep", "cx baseY h [color]", "fluffy sheep facing right (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 90, () => {
  const w = a.color || C("#f6f3ec"), bk = C("#2b2b2b");
  x6sh(P, 56);
  for (const x of [-26, -10, 20, 36]) P.rrect(x - 3.5, -30, 7, 30, 3, bk);
  for (const [x, y, r] of [[-34, -50, 20], [-14, -62, 24], [12, -62, 24], [34, -52, 20], [-20, -38, 22], [8, -38, 24], [28, -40, 18]]) P.circle(x, y, r, w, shade(w, -0.25), 1.5);
  P.ellipse(40, -66, 12, 5, bk);
  P.ellipse(56, -60, 17, 14, bk);
  P.circle(46, -76, 9, w, shade(w, -0.25), 1.5);
  P.circle(60, -64, 2.4, WHITE());
}));
def("Animals", "dolphin", "cx cy w [color]", "dolphin swimming right (cx,cy = middle, w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 270, () => {
  const c = a.color || C("#5b8fb9"), dk = shade(c, -0.4);
  P.poly([[-108, 6], [-142, -24], [-128, 4], [-146, 28]], c, dk, 2);
  P.blob([[-116, 8], [-70, -26], [-10, -44], [50, -34], [96, -12], [124, -6], [96, 6], [50, 22], [-10, 34], [-70, 26]], c, dk, 2.5);
  P.blob([[-60, 20], [0, 28], [56, 16], [100, 0], [56, 22], [0, 34], [-50, 28]], C("#e8f2fa"));
  P.poly([[-6, -40], [22, -76], [34, -36]], shade(c, -0.1), dk, 2);
  P.poly([[10, 22], [-6, 56], [30, 30]], shade(c, -0.1), dk, 2);
  P.circle(70, -14, 4, C("#111")); P.circle(71.4, -15.4, 1.4, WHITE());
  P.arc(100, 0, 26, 8, 10, 120, dk, 2);
}));
def("Animals", "parrot", "cx baseY h", "colorful parrot sitting on a branch (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 145, () => {
  const rd = C("#e53935"), bl = C("#1e88e5"), dk = shade(rd, -0.45), og = C("#ffb300");
  P.rrect(-60, -4, 120, 9, 4, C("#5d3d22"), C("#3a2412"), 2);
  P.poly([[-16, -50], [-44, -2], [-30, 0], [-4, -40]], bl, shade(bl, -0.4), 1.5);
  P.poly([[0, -50], [-20, 0], [-6, 0], [10, -40]], rd, dk, 1.5);
  P.ellipse(0, -66, 32, 52, rd, dk, 2.5);
  P.ellipse(-6, -60, 18, 38, bl, shade(bl, -0.4), 2); P.ellipse(-6, -54, 11, 22, C("#ffd23f"));
  P.circle(6, -118, 24, rd, dk, 2.5);
  P.ellipse(12, -116, 13, 15, WHITE(), dk, 1.5); P.circle(14, -118, 4.5, C("#111")); P.circle(15.5, -119.5, 1.4, WHITE());
  P.blob([[22, -130], [46, -124], [48, -108], [36, -100], [28, -110]], og, shade(og, -0.4), 2);
  P.line(-6, -18, -6, -4, C("#888"), 4); P.line(10, -18, 10, -4, C("#888"), 4);
}));
def("Animals", "flamingo", "cx baseY h [color]", "pink flamingo standing on one leg (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 215, () => {
  const c = a.color || C("#ff8fb0"), dk = shade(c, -0.4), lg = shade(c, -0.15);
  P.ellipse(0, 1, 40, 5, BLACK(0.18));
  P.line(0, -76, 0, 0, lg, 4); P.line(0, -1, 16, -1, lg, 4);
  P.polyline([[8, -80], [26, -62], [10, -52]], lg, 4);
  P.poly([[-44, -112], [-68, -96], [-44, -86]], c, dk, 2);
  P.ellipse(-4, -100, 46, 30, c, dk, 2.5); P.ellipse(-10, -100, 28, 18, shade(c, 0.12), dk, 1.5);
  const neck = [[20, -110], [44, -140], [36, -176], [50, -198]];
  P.curve(neck, dk, 13); P.curve(neck, c, 9);
  P.circle(52, -202, 10, c, dk, 2);
  P.poly([[58, -207], [80, -196], [66, -190], [56, -198]], C("#fff3d6"), dk, 1.5);
  P.poly([[72, -199], [80, -196], [68, -191]], C("#222"));
  P.circle(54, -204, 2.2, C("#111"));
}));
def("Animals", "swan", "cx baseY w", "white swan on water (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  const wh = C("#fafafa"), ln = C("#9aa7b8"), og = C("#ff8a1f");
  P.ellipse(0, 2, 100, 8, C("#4aa3e8@0.5"));
  P.blob([[-70, -20], [-50, -44], [0, -50], [50, -40], [72, -60], [60, -24], [20, -4], [-40, -4]], wh, ln, 2.5);
  P.blob([[-50, -30], [-10, -44], [30, -34], [0, -14], [-40, -16]], C("#eef2f8"), ln, 1.5);
  const neck = [[56, -50], [84, -74], [70, -110], [84, -130]];
  P.curve(neck, ln, 16); P.curve(neck, wh, 12);
  P.circle(86, -134, 11, wh, ln, 2);
  P.poly([[94, -136], [116, -130], [94, -126]], og, shade(og, -0.35), 1.5);
  P.circle(95, -134, 3, C("#222")); P.circle(88, -137, 2, C("#111"));
}));
def("Animals", "snake", "cx cy w [color]", "green snake in an S shape (cx,cy = middle, w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 240, () => {
  const c = a.color || C("#58b84a"), dk = shade(c, -0.45);
  const pts = [[-110, 40], [-70, 0], [-30, 40], [10, 0], [50, 40], [90, 6], [110, -26]];
  P.curve(pts, dk, 26); P.curve(pts, c, 20); P.curve(pts, shade(c, 0.3), 5);
  for (const [x, y] of pts.slice(1, -1)) P.circle(x, y, 6, shade(c, -0.25));
  P.polyline([[134, -34], [150, -34]], C("#e53935"), 2.5); P.line(150, -34, 158, -40, C("#e53935"), 2.5); P.line(150, -34, 158, -28, C("#e53935"), 2.5);
  P.ellipse(118, -34, 20, 14, c, dk, 2.5);
  P.circle(124, -40, 3.5, WHITE(), dk, 1); P.circle(125, -40, 1.6, C("#111"));
}));
def("Animals", "crocodile", "cx baseY w [color]", "crocodile facing right with teeth (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 260, () => {
  const c = a.color || C("#5a9a3c"), dk = shade(c, -0.45);
  x6sh(P, 110);
  P.poly([[-100, -52], [-156, -14], [-100, -22]], c, dk, 2.5);
  for (const x of [-60, 50]) P.rrect(x - 10, -32, 20, 32, 6, shade(c, -0.1), dk, 2);
  P.rrect(-110, -62, 200, 42, 16, c, dk, 2.5);
  P.rrect(-100, -34, 190, 10, 5, C("#d9e8a5"));
  P.poly([[80, -60], [150, -52], [150, -36], [80, -28]], c, dk, 2.5);
  for (let k = 0; k < 6; k++) P.poly([[90 + k * 10, -38], [96 + k * 10, -38], [93 + k * 10, -30]], WHITE());
  for (let x = -100; x <= 60; x += 20) P.poly([[x, -62], [x + 8, -72], [x + 16, -62]], shade(c, -0.2), dk, 1);
  P.circle(96, -66, 6, C("#ffd23f"), dk, 1.5); P.ellipse(96, -66, 1.8, 5, C("#111"));
  P.circle(144, -50, 2.5, dk);
}));
def("Animals", "koala", "cx baseY h [color]", "koala sitting with big ears (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 135, () => {
  const gr = a.color || C("#9aa3ad"), dk = shade(gr, -0.4), lt = shade(gr, 0.4);
  x6sh(P, 52);
  for (const s of [-1, 1]) P.ellipse(s * 26, -8, 18, 10, gr, dk, 2);
  P.ellipse(0, -44, 38, 44, gr, dk, 2.5); P.ellipse(0, -40, 23, 30, lt);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 42, -54); P.rotate(s * -20); P.ellipse(0, 0, 10, 26, gr, dk, 2); P.pop(); }
  for (const s of [-1, 1]) { P.circle(s * 40, -108, 22, gr, dk, 2); P.circle(s * 40, -108, 12, C("#f1d5dc")); }
  P.ellipse(0, -100, 42, 38, gr, dk, 2.5);
  x6eyes(P, 16, -106, 4.5);
  P.ellipse(0, -90, 11, 15, C("#2b2b2b")); P.ellipse(-3, -95, 3, 4, WHITE(0.4));
}));
def("Animals", "hedgehog", "cx baseY w [color]", "hedgehog with spiky back facing right (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 170, () => {
  const br = a.color || C("#7a5230"), tan = C("#e8c9a0");
  x6sh(P, 70);
  for (let k = 0; k < 22; k++) {
    const t = Math.PI + (Math.PI * k) / 21;
    P.line(Math.cos(t) * 62, -34 + Math.sin(t) * 46, Math.cos(t) * 86, -34 + Math.sin(t) * 70, k % 2 ? br : shade(br, -0.3), 7);
  }
  P.ellipse(0, -34, 66, 46, br, shade(br, -0.4), 2);
  for (const x of [-20, 30]) P.ellipse(x, -2, 12, 6, tan, shade(tan, -0.4), 1.5);
  P.ellipse(52, -24, 34, 22, tan, shade(tan, -0.4), 2);
  P.ellipse(40, -44, 7, 9, tan, shade(tan, -0.4), 1.5);
  P.circle(82, -22, 5, C("#222")); P.circle(60, -32, 3.5, C("#111"));
}));
def("Animals", "spider", "cx cy r [color]", "spider with 8 legs and red eyes (r = body size)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  const c = a.color || C("#2b2b2b"), dk = shade(c, -0.5);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) P.polyline([[s * 16, -6 + k * 7], [s * (46 + k * 3), -34 + k * 18], [s * (64 + k * 4), -4 + k * 22]], dk, 3.5);
  P.ellipse(0, 18, 30, 34, c, dk, 2); P.circle(0, -14, 20, c, dk, 2);
  P.circle(0, 22, 6, C("#d62828")); P.ellipse(-10, 8, 6, 10, WHITE(0.18));
  for (const s of [-1, 1]) { P.circle(s * 8, -18, 5, WHITE()); P.circle(s * 8, -18, 2.5, C("#d62828")); }
}));
def("Animals", "bat", "cx cy w [color]", "flying bat with open wings (w = wingspan)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#3a2f4a"), dk = shade(c, -0.5);
  for (const s of [-1, 1]) P.poly([[s * 14, -6], [s * 54, -40], [s * 100, -30], [s * 88, -6], [s * 72, -14], [s * 58, 6], [s * 40, -6], [s * 28, 14]], c, dk, 2);
  P.poly([[-12, -30], [-8, -52], [-2, -30]], c, dk, 1.5); P.poly([[12, -30], [8, -52], [2, -30]], c, dk, 1.5);
  P.ellipse(0, 0, 20, 30, c, dk, 2); P.circle(0, -22, 16, c, dk, 2);
  for (const s of [-1, 1]) P.circle(s * 6, -24, 3.5, C("#ffd23f"));
  P.poly([[-5, -14], [-2, -7], [1, -14]], WHITE()); P.poly([[1, -14], [3, -7], [6, -14]], WHITE());
}));

// ---------------- FANTASY ----------------
def("Fantasy", "unicorn", "cx baseY h [color]", "unicorn with horn, rainbow mane and tail (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 250, () => {
  CMDS.get("horse").fn({ cx: 0, baseY: 0, h: 200, color: a.color || C("#fbfbff") }, P);
  P.curve([[-66, -116], [-94, -104], [-100, -62], [-88, -32]], C("#8e5cf5"), 14);
  P.curve([[-70, -112], [-98, -100], [-102, -62], [-92, -34]], C("#ff6fa5"), 6);
  P.blob([[40, -176], [58, -190], [54, -150], [66, -134], [48, -128], [38, -150]], C("#ff6fa5"));
  P.blob([[44, -172], [56, -182], [52, -152], [58, -142], [46, -140]], C("#8e5cf5"));
  const g = C("#ffc83d");
  P.poly([[72, -192], [88, -190], [94, -252]], g, shade(g, -0.5), 2);
  P.line(76, -206, 90, -204, shade(g, -0.5), 2); P.line(78, -222, 91, -220, shade(g, -0.5), 2); P.line(81, -238, 92, -236, shade(g, -0.5), 2);
  CMDS.get("sparkle").fn({ cx: 120, cy: -230, r: 12 }, P);
}));
def("Fantasy", "alien", "cx baseY h [color]", "friendly green alien with big eyes and antennae (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 205, () => {
  const g = a.color || C("#7ed957"), dk = shade(g, -0.45);
  x6sh(P, 40);
  for (const s of [-1, 1]) { P.rrect(s * 10 - 6, -46, 12, 46, 5, g, dk, 2); P.line(s * 22, -80, s * 46, -52, dk, 9); P.line(s * 22, -80, s * 46, -52, g, 6); }
  P.ellipse(0, -70, 26, 34, g, dk, 2.5);
  for (const s of [-1, 1]) { P.line(s * 12, -172, s * 20, -196, dk, 3); P.circle(s * 20, -198, 5, C("#ff5252")); }
  P.ellipse(0, -130, 42, 48, g, dk, 2.5);
  for (const s of [-1, 1]) { P.push(); P.translate(s * 20, -126); P.rotate(s * -25); P.ellipse(0, 0, 13, 22, C("#111")); P.ellipse(-s * 3, -7, 4, 7, WHITE(0.7)); P.pop(); }
  P.arc(0, -106, 10, 5, 20, 140, dk, 2);
}));
def("Fantasy", "treasure", "cx baseY w", "open treasure chest full of gold coins (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 180, () => {
  const wd = C("#8a5a2b"), dk = shade(wd, -0.45), g = C("#ffc83d"), gd = shade(g, -0.5);
  P.circle(0, -70, 100, P.radGrad(0, -70, 100, [[0, C("#ffe27a@0.6")], [1, C("#ffe27a@0")]]));
  P.ellipse(0, 1, 90, 7, BLACK(0.2));
  P.poly([[-80, -62], [-70, -130], [70, -130], [80, -62]], shade(wd, 0.12), dk, 2.5);
  P.rrect(-80, -60, 160, 60, 6, wd, dk, 2.5);
  for (const x of [-50, 38]) P.rect(x, -60, 12, 60, g, gd, 1.5);
  P.rect(-80, -40, 160, 8, g, gd, 1.5);
  P.ellipse(0, -62, 76, 12, g, gd, 1.5);
  for (const [x, y] of [[-40, -70], [-14, -76], [20, -72], [46, -68], [0, -66], [-60, -66]]) P.circle(x, y, 7, shade(g, 0.1), gd, 1.5);
  P.rrect(-10, -52, 20, 18, 3, g, gd, 1.5); P.circle(0, -44, 3, dk);
}));
def("Fantasy", "wand", "cx cy h", "magic wand with a glowing star (cx,cy = middle, h = length)", (a, P) => P.at(a.cx, a.cy, a.h / 200, () => {
  const g = C("#ffc83d"), gd = shade(g, -0.5);
  P.rotate(35);
  P.circle(0, -100, 60, P.radGrad(0, -100, 60, [[0, C("#fff3a0@0.7")], [1, C("#fff3a0@0")]]));
  P.rrect(-5, -90, 10, 180, 5, C("#3a2412"), C("#1a0f08"), 2);
  P.rect(-6, -60, 12, 6, g, gd, 1); P.rect(-6, 56, 12, 6, g, gd, 1);
  x6star(P, 0, -104, 28, g, gd, 2);
  for (const [x, y, r] of [[-36, -130, 6], [38, -80, 5], [30, -146, 4]]) CMDS.get("sparkle").fn({ cx: x, cy: y, r }, P);
}));
def("Fantasy", "crystalball", "cx baseY r", "glowing crystal ball on a stand (r = ball radius)", (a, P) => P.at(a.cx, a.baseY, a.r / 60, () => {
  const wd = C("#6b3e1e");
  P.poly([[-40, 0], [40, 0], [26, -22], [-26, -22]], wd, shade(wd, -0.4), 2.5);
  P.ellipse(0, -22, 30, 7, shade(wd, 0.15), shade(wd, -0.4), 2);
  P.circle(0, -82, 60, P.radGrad(0, -82, 70, [[0, C("#e8d6ff")], [0.6, C("#9b6bff")], [1, C("#3b1d8a")]], -18, -100), C("#2a1260"), 2.5);
  P.arc(0, -82, 28, 18, 200, 240, WHITE(0.5), 4);
  for (const [x, y] of [[-20, -70], [14, -96], [24, -66]]) x6star(P, x, y, 6, WHITE(0.8));
  P.ellipse(-24, -110, 14, 8, WHITE(0.55));
}));

// ---------------- FOOD ----------------
function x6citrus(P, cx, cy, r, c, lemon) {
  P.at(cx, cy, r / 50, () => {
    const dk = shade(c, -0.4);
    if (lemon) {
      P.poly([[-48, -4], [-64, 0], [-48, 6]], c, dk, 2); P.poly([[48, -4], [64, 0], [48, 6]], c, dk, 2);
      P.ellipse(0, 0, 52, 38, P.radGrad(0, 0, 70, [[0, shade(c, 0.3)], [1, shade(c, -0.12)]], -16, -14), dk, 2.5);
    } else {
      P.circle(0, 0, 46, P.radGrad(0, 0, 70, [[0, shade(c, 0.3)], [1, shade(c, -0.15)]], -16, -18), dk, 2.5);
      for (let k = 0; k < 14; k++) { const t = k * 2.4, d = 10 + (k % 4) * 8; P.circle(Math.cos(t) * d, Math.sin(t) * d, 1.4, alpha(dk, 0.5)); }
    }
    P.blob([[0, -40], [16, -60], [40, -54], [22, -38]], C("#4caf50"), C("#2e7d32"), 1.5);
    P.ellipse(-16, -14, 9, 15, WHITE(0.3));
  });
}
def("Food", "orange", "cx cy r [color]", "orange with leaf (r = radius)", (a, P) => x6citrus(P, a.cx, a.cy, a.r, a.color || C("#ff9a1f"), false));
def("Food", "lemon", "cx cy r [color]", "lemon with leaf (r = half height)", (a, P) => x6citrus(P, a.cx, a.cy, a.r, a.color || C("#ffe14d"), true));
def("Food", "grapes", "cx cy r [color]", "bunch of grapes with leaf (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  const c = a.color || C("#7b3fa0");
  P.line(0, -44, 0, -70, C("#6d4c2a"), 5);
  P.blob([[2, -62], [28, -84], [52, -70], [30, -56]], C("#4caf50"), C("#2e7d32"), 1.5);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4 - r; k++) {
    const x = (k - (3 - r) / 2) * 26, y = -34 + r * 24;
    P.circle(x, y, 15, P.radGrad(x, y, 22, [[0, shade(c, 0.3)], [1, c]], x - 5, y - 5), shade(c, -0.4), 1.5);
    P.circle(x - 5, y - 5, 3.5, WHITE(0.45));
  }
}));
def("Food", "cherry", "cx cy r", "two red cherries with stems (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 40, () => {
  const rd = C("#d61f3a");
  P.curve([[-18, 10], [-8, -30], [14, -56]], C("#4a7a2a"), 3); P.curve([[22, 16], [22, -24], [14, -56]], C("#4a7a2a"), 3);
  P.blob([[14, -56], [36, -72], [52, -60], [34, -50]], C("#4caf50"), C("#2e7d32"), 1.5);
  for (const [x, y] of [[-20, 22], [24, 28]]) { P.circle(x, y, 20, P.radGrad(x, y, 28, [[0, shade(rd, 0.3)], [1, shade(rd, -0.2)]], x - 6, y - 6), shade(rd, -0.45), 2); P.circle(x - 6, y - 7, 5, WHITE(0.5)); }
}));
def("Food", "carrot", "cx cy h", "orange carrot with green leaves (h = total height)", (a, P) => P.at(a.cx, a.cy, a.h / 170, () => {
  const g = C("#4caf50"), og = C("#ff8a1f"), dk = C("#c95a00");
  P.rotate(35);
  for (const dx of [-14, 0, 14]) P.blob([[dx * 0.4, -60], [dx - 9, -96], [dx, -112], [dx + 9, -96]], g, C("#2e7d32"), 1.5);
  P.poly([[-18, -60], [18, -60], [0, 60]], og, dk, 2.5);
  for (const y of [-40, -18, 4, 26]) { const hw = (18 * (60 - y)) / 120; P.line(-hw * 0.7, y, hw * 0.1, y + 2, dk, 1.8); }
}));
def("Food", "pineapple", "cx baseY h", "pineapple with crown of leaves (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 170, () => {
  const gr = C("#3c9a46"), y = C("#f2b632"), dk = C("#a8741f");
  for (let k = -3; k <= 3; k++) P.poly([[k * 10 - 7, -108], [k * 16, -160 + Math.abs(k) * 8], [k * 10 + 7, -108]], gr, shade(gr, -0.4), 1.5);
  P.ellipse(0, -56, 38, 54, y, dk, 2.5);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
    const x = (c - 2) * 14 + (r % 2 ? 7 : 0), yy = -96 + r * 16;
    if ((x / 34) ** 2 + ((yy + 56) / 50) ** 2 < 1) P.poly([[x, yy - 6], [x + 6, yy], [x, yy + 6], [x - 6, yy]], null, dk, 1.2);
  }
}));
def("Food", "cookie", "cx cy r", "chocolate chip cookie (r = radius)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  P.circle(3, 5, 50, BLACK(0.15));
  P.circle(0, 0, 50, P.radGrad(0, 0, 70, [[0, C("#d9993d")], [1, C("#a8681f")]], -10, -10), C("#7a4a12"), 3);
  for (const [x, y] of [[-18, -20], [16, -26], [24, 6], [-26, 10], [0, 0], [-4, 28], [20, 32], [-32, -4]]) P.ellipse(x, y, 6, 5, C("#3a1d05"));
}));
def("Food", "lollipop", "cx baseY h [color]", "swirly lollipop on a stick (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 150, () => {
  const c = a.color || C("#ff4f8b");
  P.rrect(-3, -90, 6, 90, 3, WHITE(), C("#bbb"), 1.5);
  P.circle(0, -112, 38, c, shade(c, -0.4), 2.5);
  for (let k = 0; k < 6; k++) P.pie(0, -112, 36, 36, k * 60, 30, WHITE(0.85));
  P.circle(0, -112, 7, shade(c, -0.1));
  P.ellipse(-16, -132, 10, 6, WHITE(0.5));
}));
def("Food", "hotdog", "cx cy w", "hot dog with mustard (w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const bun = C("#e8a950"), dk = shade(bun, -0.4), sg = C("#c0392b");
  P.rrect(-90, -24, 180, 50, 24, bun, dk, 2.5);
  P.rrect(-104, -22, 208, 22, 11, sg, shade(sg, -0.4), 2.5);
  P.rrect(-92, -8, 184, 34, 17, shade(bun, -0.06), dk, 2.5);
  const z = [];
  for (let k = 0; k <= 10; k++) z.push([-90 + k * 18, -16 + (k % 2 ? 6 : -2)]);
  P.polyline(z, C("#ffd23f"), 5);
}));
def("Food", "friedegg", "cx cy r", "fried egg (r = size)", (a, P) => P.at(a.cx, a.cy, a.r / 60, () => {
  P.blob([[-60, -10], [-48, -44], [-10, -56], [30, -48], [58, -20], [50, 26], [16, 52], [-24, 48], [-56, 24]], C("#fffdf5"), C("#d9d4c0"), 2.5);
  P.circle(-2, -4, 24, P.radGrad(-2, -4, 28, [[0, C("#ffd23f")], [1, C("#ff9a1f")]], -8, -10), C("#d98a00"), 1.5);
  P.ellipse(-10, -14, 7, 4, WHITE(0.6));
}));

// ---------------- OBJECTS ----------------
def("Objects", "lightbulb", "cx cy r", "glowing light bulb (r = bulb radius)", (a, P) => P.at(a.cx, a.cy, a.r / 46, () => {
  P.circle(0, -12, 120, P.radGrad(0, -12, 120, [[0, C("#fff3a0@0.6")], [1, C("#fff3a0@0")]]));
  for (let k = 0; k < 9; k++) { const t = ((-180 + k * 22.5) * Math.PI) / 180; P.line(Math.cos(t) * 62, -12 + Math.sin(t) * 62, Math.cos(t) * 82, -12 + Math.sin(t) * 82, C("#ffc533"), 4); }
  P.circle(0, -12, 46, P.radGrad(0, -12, 50, [[0, C("#fffbe0")], [1, C("#ffd83d")]], -10, -22), C("#d9a800"), 2.5);
  P.poly([[-20, 24], [20, 24], [16, 38], [-16, 38]], C("#ffe58a"), C("#d9a800"), 2);
  P.polyline([[-10, 26], [-10, -4], [-4, -14], [4, -4], [10, -14], [10, 26]], C("#d97706"), 2.5);
  for (const [y, w] of [[38, 40], [48, 34], [56, 24]]) P.rrect(-w / 2, y, w, 9, 3, C("#9aa3ad"), C("#555"), 1.5);
}));
def("Objects", "magnifier", "cx cy r", "magnifying glass (cx,cy = center of the lens, r = lens radius)", (a, P) => P.at(a.cx, a.cy, a.r / 50, () => {
  P.line(36, 36, 84, 84, C("#6b3e1e"), 14); P.line(36, 36, 54, 54, C("#9aa3ad"), 16);
  P.circle(0, 0, 46, C("#bfe9ff@0.35"));
  P.circle(0, 0, 50, null, C("#555"), 9);
  P.arc(0, 0, 30, 30, 200, 70, WHITE(0.75), 5);
}));
def("Objects", "pencil", "cx cy w [color]", "pencil lying at an angle (w = length)", (a, P) => P.at(a.cx, a.cy, a.w / 190, () => {
  const c = a.color || C("#ffd23f"), dk = shade(c, -0.45);
  P.rotate(-35);
  P.rect(-80, -12, 130, 24, c, dk, 2); P.line(-80, -4, 50, -4, shade(c, 0.3), 3); P.line(-80, 6, 50, 6, shade(c, -0.2), 3);
  P.rect(-80, -12, 14, 24, C("#c9d0da"), C("#7f8a99"), 1.5);
  P.rrect(-100, -12, 22, 24, 6, C("#ff8fb0"), C("#b8526f"), 2);
  P.poly([[50, -12], [84, 0], [50, 12]], C("#f1d5a8"), C("#a8864e"), 2);
  P.poly([[74, -3], [84, 0], [74, 3]], C("#2b2b2b"));
}));
def("Objects", "envelope", "cx cy w", "closed letter envelope with a heart seal (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  P.rrect(-100, -66, 200, 132, 8, C("#fff8e3"), C("#b8a97e"), 2.5);
  P.line(-100, 66, -30, -4, C("#b8a97e"), 2); P.line(100, 66, 30, -4, C("#b8a97e"), 2);
  P.poly([[-100, -60], [0, 16], [100, -60]], C("#f1e3b8"), C("#b8a97e"), 2.5);
  P.poly(heartPts(0, 14, 14), C("#e53935"));
}));
def("Objects", "bell", "cx cy h [color]", "golden bell (cx,cy = middle, h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 130, () => {
  const g = a.color || C("#ffc83d"), dk = shade(g, -0.5);
  P.circle(0, -58, 8, null, dk, 4);
  P.blob([[0, -50], [28, -40], [36, 0], [52, 30], [58, 40], [-58, 40], [-52, 30], [-36, 0], [-28, -40]], g, dk, 2.5);
  P.rrect(-62, 36, 124, 12, 6, shade(g, -0.1), dk, 2);
  P.circle(0, 56, 10, shade(g, -0.2), dk, 2);
  P.ellipse(-18, -6, 6, 26, WHITE(0.35));
}));
def("Objects", "anchor", "cx cy h [color]", "ship anchor (cx,cy = middle, h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 160, () => {
  const c = a.color || C("#37474f");
  P.circle(0, -70, 10, null, c, 5);
  P.line(0, -60, 0, 50, c, 9); P.line(-26, -44, 26, -44, c, 8);
  P.arc(0, 10, 56, 52, 0, 180, c, 9);
  P.poly([[-56, 10], [-72, -8], [-40, 0]], c); P.poly([[56, 10], [72, -8], [40, 0]], c);
}));
def("Objects", "compass", "cx cy r", "navigation compass with N E S W (r = radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const g = C("#c9a227"), dk = C("#2b2b2b");
  P.circle(5, 7, 100, BLACK(0.15));
  P.circle(0, 0, 100, g, shade(g, -0.5), 4); P.circle(0, 0, 84, C("#fffaf0"), shade(g, -0.4), 2);
  for (let k = 0; k < 36; k++) { const t = (k * 10 * Math.PI) / 180, r1 = k % 9 === 0 ? 66 : 74; P.line(Math.sin(t) * r1, -Math.cos(t) * r1, Math.sin(t) * 80, -Math.cos(t) * 80, dk, k % 9 === 0 ? 3 : 1.4); }
  P.text("N", 0, -64, 20, C("#d62828"), true, "center"); P.text("S", 0, 44, 20, dk, true, "center");
  P.text("E", 54, -10, 20, dk, true, "center"); P.text("W", -54, -10, 20, dk, true, "center");
  P.poly([[0, -52], [10, 0], [-10, 0]], C("#d62828")); P.poly([[0, 52], [10, 0], [-10, 0]], C("#37474f"));
  P.circle(0, 0, 6, g, shade(g, -0.5), 1.5);
}));
def("Objects", "hourglass", "cx cy h", "sand timer hourglass (cx,cy = middle, h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 140, () => {
  const wd = C("#8a5a2b"), sd = C("#f2c14e");
  P.line(-40, -58, -40, 58, wd, 5); P.line(40, -58, 40, 58, wd, 5);
  P.poly([[-34, -58], [34, -58], [4, 0], [34, 58], [-34, 58], [-4, 0]], C("#cfeaff@0.5"), C("#6b8fb0"), 2.5);
  P.poly([[-26, -52], [26, -52], [6, -14], [-6, -14]], sd);
  P.line(0, -8, 0, 30, sd, 2);
  P.poly([[-30, 56], [30, 56], [14, 30], [-14, 30]], sd);
  P.rrect(-46, -70, 92, 12, 3, wd, shade(wd, -0.4), 2); P.rrect(-46, 58, 92, 12, 3, wd, shade(wd, -0.4), 2);
}));
def("Objects", "glasses", "cx cy w [color]", "eye glasses (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#222");
  P.line(-90, -6, -112, -16, c, 6); P.line(90, -6, 112, -16, c, 6);
  P.circle(-52, 0, 38, C("#bfe9ff@0.3"), c, 7); P.circle(52, 0, 38, C("#bfe9ff@0.3"), c, 7);
  P.arc(0, -6, 18, 12, 200, 140, c, 6);
  P.arc(-52, 0, 26, 26, 200, 50, WHITE(0.7), 4); P.arc(52, 0, 26, 26, 200, 50, WHITE(0.7), 4);
}));
def("Objects", "tshirt", "cx cy w [color]", "t-shirt (w = width incl. sleeves)", (a, P) => P.at(a.cx, a.cy, a.w / 200, () => {
  const c = a.color || C("#2e86de"), dk = shade(c, -0.4);
  P.poly([[-40, -90], [-14, -90], [0, -76], [14, -90], [40, -90], [100, -56], [80, -14], [54, -28], [54, 86], [-54, 86], [-54, -28], [-80, -14], [-100, -56]], c, dk, 2.5);
  P.pie(0, -90, 14, 16, 0, 180, shade(c, -0.25), dk, 2);
  P.line(-54, -28, -80, -14, dk, 1.5); P.line(54, -28, 80, -14, dk, 1.5);
}));
def("Objects", "gem", "cx cy w [color]", "sparkling cut gem / diamond jewel (w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 140, () => {
  const c = a.color || C("#3fc1ff"), dk = shade(c, -0.5);
  P.poly([[-40, -40], [40, -40], [24, -4], [-24, -4]], shade(c, 0.45));
  P.poly([[-40, -40], [-24, -4], [-70, -4]], shade(c, 0.3)); P.poly([[40, -40], [70, -4], [24, -4]], shade(c, -0.15));
  P.poly([[-70, -4], [-24, -4], [0, 70]], shade(c, -0.05)); P.poly([[70, -4], [24, -4], [0, 70]], shade(c, -0.3));
  P.poly([[-24, -4], [24, -4], [0, 70]], shade(c, 0.05));
  P.poly([[-40, -40], [40, -40], [70, -4], [0, 70], [-70, -4]], null, dk, 2.5);
  P.line(-70, -4, 70, -4, dk, 1.5);
  CMDS.get("sparkle").fn({ cx: -30, cy: -52, r: 10 }, P);
}));
def("Objects", "medal", "cx cy r [color]", "gold medal on a ribbon with a star (cx,cy = middle of the disc)", (a, P) => P.at(a.cx, a.cy, a.r / 44, () => {
  const g = a.color || C("#ffc83d"), gd = shade(g, -0.5);
  P.poly([[-30, -96], [-6, -96], [18, -20], [-6, -20]], C("#e53935"), shade(C("#e53935"), -0.4), 1.5);
  P.poly([[30, -96], [6, -96], [-18, -20], [6, -20]], C("#1e88e5"), shade(C("#1e88e5"), -0.4), 1.5);
  P.circle(0, 0, 44, g, gd, 3); P.circle(0, 0, 34, null, shade(g, -0.2), 2);
  x6star(P, 0, 0, 24, shade(g, 0.4), gd, 1.5);
}));
def("Objects", "drum", "cx baseY w [color]", "drum with two sticks (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 140, () => {
  const c = a.color || C("#d62828"), dk = shade(c, -0.45), wd = C("#c9a06a");
  x6sh(P, 74);
  P.line(-30, -134, 10, -96, wd, 6); P.line(34, -134, -2, -96, wd, 6);
  P.ellipse(0, -2, 70, 12, c, dk, 2.5);
  P.rect(-70, -90, 140, 88, c);
  P.line(-70, -90, -70, -2, dk, 2.5); P.line(70, -90, 70, -2, dk, 2.5);
  for (let k = 0; k < 7; k++) P.line(-70 + k * 20, -86, -50 + k * 20, -10, WHITE(0.7), 4);
  P.rect(-70, -90, 140, 8, C("#c9d0da")); P.rect(-70, -12, 140, 8, C("#c9d0da"));
  P.ellipse(0, -90, 70, 14, C("#f3ead3"), dk, 2.5);
}));
def("Objects", "kite", "cx cy w [color]", "diamond kite with a long bow tail (cx,cy = middle of the kite, w = width)", (a, P) => P.at(a.cx, a.cy, a.w / 120, () => {
  const c = a.color || C("#e53935"), bl = C("#1e88e5"), yl = C("#ffd23f");
  P.curve([[0, 80], [-20, 110], [16, 140], [-12, 172], [10, 200]], C("#555"), 2.5);
  for (const [x, y, k] of [[-20, 110, c], [16, 140, bl], [-12, 172, yl]]) P.poly([[x - 8, y - 6], [x + 8, y + 6], [x + 8, y - 6], [x - 8, y + 6]], k);
  P.poly([[0, -90], [60, -10], [0, 80], [-60, -10]], c, shade(c, -0.4), 2.5);
  P.poly([[0, -90], [60, -10], [0, -10]], yl); P.poly([[0, -10], [0, 80], [-60, -10]], yl);
  P.poly([[0, -90], [60, -10], [0, 80], [-60, -10]], null, shade(c, -0.4), 2.5);
  P.line(0, -90, 0, 80, shade(c, -0.5), 2); P.line(-60, -10, 60, -10, shade(c, -0.5), 2);
}));
def("Objects", "dice", "cx cy s [n]", "white dice showing n dots 1-6 (s = half size, default n = 5)", (a, P) => P.at(a.cx, a.cy, a.s / 50, () => {
  const n = Math.max(1, Math.min(6, Math.round(a.n ?? 5)));
  const p = { 1: [[0, 0]], 2: [[-24, -24], [24, 24]], 3: [[-24, -24], [0, 0], [24, 24]], 4: [[-24, -24], [24, -24], [-24, 24], [24, 24]], 5: [[-24, -24], [24, -24], [0, 0], [-24, 24], [24, 24]], 6: [[-24, -26], [24, -26], [-24, 0], [24, 0], [-24, 26], [24, 26]] };
  P.rrect(-46, -42, 100, 100, 14, BLACK(0.15));
  P.rrect(-50, -50, 100, 100, 14, WHITE(), C("#8a93a0"), 3);
  for (const [x, y] of p[n]) P.circle(x, y, 7.5, n === 1 ? C("#d62828") : C("#222"));
}));
def("Objects", "lock", "cx cy h [color]", "closed padlock (cx,cy = middle, h = height)", (a, P) => P.at(a.cx, a.cy, a.h / 130, () => {
  const g = a.color || C("#ffc83d"), gd = shade(g, -0.5);
  P.line(-28, -24, -28, 0, C("#9aa3ad"), 12); P.line(28, -24, 28, 0, C("#9aa3ad"), 12);
  P.arc(0, -24, 28, 34, 180, 180, C("#9aa3ad"), 12);
  P.rrect(-46, -4, 92, 76, 10, g, gd, 2.5);
  P.circle(0, 26, 9, C("#2b2b2b")); P.poly([[-5, 30], [5, 30], [8, 54], [-8, 54]], C("#2b2b2b"));
}));
def("Objects", "trafficlight", "cx baseY h [preset]", "traffic light on a pole. preset = red (default), yellow or green is lit", (a, P) => P.at(a.cx, a.baseY, a.h / 175, () => {
  const lit = String(a.preset || "red").toLowerCase();
  P.rect(-5, -50, 10, 50, C("#555"));
  P.rrect(-26, -172, 52, 124, 10, C("#2b2b2b"), C("#111"), 2.5);
  [["red", -146, "#e53935", "#5a1a18"], ["yellow", -110, "#ffd23f", "#5f5014"], ["green", -74, "#43d17a", "#14502a"]].forEach(([n, y, on, off]) => {
    if (n === lit) P.circle(0, y, 34, P.radGrad(0, y, 34, [[0, alpha(C(on), 0.55)], [1, alpha(C(on), 0)]]));
    P.circle(0, y, 15, C(n === lit ? on : off), C("#111"), 2);
    if (n === lit) P.circle(-4, y - 5, 4, WHITE(0.6));
  });
}));
def("Objects", "mailbox", "cx baseY h [color]", "mailbox on a post with a red flag (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 130, () => {
  const c = a.color || C("#2e6fd8"), dk = shade(c, -0.45);
  P.rect(-5, -60, 10, 60, C("#8a5a2b"), C("#4a2c12"), 1.5);
  P.rect(34, -130, 6, 40, C("#e53935")); P.rect(34, -130, 22, 12, C("#e53935"));
  P.rrect(-36, -112, 72, 52, 16, c, dk, 2.5);
  P.rrect(-20, -98, 40, 6, 3, BLACK(0.4));
}));
def("Objects", "table", "cx baseY w [color]", "wooden table (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 180, () => {
  const c = a.color || C("#a8662f"), dk = shade(c, -0.45);
  x6sh(P, 90);
  for (const x of [-70, 70]) P.rrect(x - 5, -56, 10, 56, 3, shade(c, -0.15), dk, 2);
  for (const x of [-80, 80]) P.rrect(x - 5, -56, 10, 56, 3, c, dk, 2);
  P.rrect(-90, -70, 180, 14, 4, shade(c, 0.1), dk, 2.5);
}));
def("Objects", "sofa", "cx baseY w [color]", "comfy sofa with cushions (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 230, () => {
  const c = a.color || C("#7b5ea7"), dk = shade(c, -0.45);
  x6sh(P, 118);
  for (const x of [-96, 96]) P.rect(x - 4, -6, 8, 10, C("#3a2412"));
  P.rrect(-100, -88, 200, 70, 18, c, dk, 2.5);
  for (const s of [-1, 1]) P.rrect(s * 98 - 17, -62, 34, 62, 14, shade(c, -0.08), dk, 2.5);
  P.rrect(-84, -44, 168, 44, 12, shade(c, 0.1), dk, 2.5);
  P.line(0, -44, 0, 0, dk, 2);
  P.rrect(-72, -80, 40, 36, 10, C("#ffd23f"), shade(C("#ffd23f"), -0.4), 2);
}));
def("Objects", "cricket", "cx baseY h", "cricket bat, ball and stumps (h = bat height)", (a, P) => P.at(a.cx, a.baseY, a.h / 200, () => {
  const wd = C("#e8c98a"), dk = C("#9a7a3a");
  x6sh(P, 90);
  for (const x of [-70, -58, -46]) P.rect(x - 2, -90, 4, 90, C("#e8c98a"), dk, 1);
  P.rect(-70, -94, 12, 3, dk); P.rect(-58, -94, 12, 3, dk);
  P.push(); P.translate(10, 0); P.rotate(14);
  P.rrect(-5, -198, 10, 54, 4, C("#2b3a8a"), C("#14204d"), 2);
  for (let k = 0; k < 4; k++) P.line(-5, -190 + k * 12, 5, -186 + k * 12, C("#14204d"), 1.5);
  P.rrect(-17, -148, 34, 148, 6, wd, dk, 2.5);
  P.line(0, -140, 0, -8, dk, 1.5);
  P.pop();
  x6ball(P, 74, -18, 18, C("#c0392b"));
  P.arc(74, -18, 18, 7, 200, 140, WHITE(0.85), 1.6);
}));
def("Objects", "basketball", "cx cy r", "basketball (r = radius)", (a, P) => P.at(a.cx, a.cy, a.r / 100, () => {
  const k = C("#3a1d05");
  P.ellipse(0, 100, 80, 10, BLACK(0.2));
  P.circle(0, 0, 100, P.radGrad(0, 0, 130, [[0, C("#ffa24d")], [1, C("#c4560f")]], -30, -30), k, 3);
  P.line(-100, 0, 100, 0, k, 4); P.line(0, -100, 0, 100, k, 4);
  P.arc(-130, 0, 92, 100, -47, 94, k, 4); P.arc(130, 0, 92, 100, 133, 94, k, 4);
}));

// ---------------- VEHICLES ----------------
def("Vehicles", "truck", "cx baseY w [color]", "cargo truck facing right (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 260, () => {
  const c = a.color || C("#d62828"), dk = shade(c, -0.45), gl = C("#bfe6ff");
  x6sh(P, 130);
  P.rrect(-130, -112, 170, 86, 6, C("#f4f4f4"), C("#888"), 2.5);
  P.rect(-130, -64, 170, 10, c);
  P.poly([[44, -26], [44, -98], [84, -98], [112, -62], [124, -62], [124, -26]], c, dk, 2.5);
  P.poly([[52, -90], [82, -90], [104, -64], [52, -64]], gl, dk, 1.5);
  P.rrect(-132, -32, 262, 10, 3, C("#444"));
  P.rect(120, -54, 6, 12, C("#fff3a8"));
  for (const x of [-90, -50, 66, 100]) { P.circle(x, -20, 20, C("#222")); P.circle(x, -20, 10, C("#c8ccd2")); }
}));
def("Vehicles", "ambulance", "cx baseY w", "ambulance with red cross and siren (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 240, () => {
  const rd = C("#e53935"), gl = C("#bfe6ff"), ln = C("#8a93a0");
  x6sh(P, 126);
  P.rrect(-110, -92, 200, 68, 8, WHITE(), ln, 2.5);
  P.poly([[86, -26], [86, -84], [106, -84], [126, -52], [126, -26]], WHITE(), ln, 2.5);
  P.poly([[92, -78], [104, -78], [118, -54], [92, -54]], gl, ln, 1.5);
  P.rect(-110, -36, 236, 6, rd);
  P.rect(-62, -66, 44, 12, rd); P.rect(-46, -82, 12, 44, rd);
  P.rrect(-14, -102, 28, 10, 4, rd); P.rect(0, -102, 14, 10, C("#2e86de"));
  for (const x of [-70, 80]) { P.circle(x, -20, 20, C("#222")); P.circle(x, -20, 10, C("#c8ccd2")); }
}));
def("Vehicles", "policecar", "cx baseY w [color]", "police car with light bar (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 200, () => {
  CMDS.get("car").fn({ cx: 0, baseY: 0, w: 200, color: a.color || C("#1f3a8a") }, P);
  P.rect(-98, -48, 196, 10, WHITE(0.85));
  P.rrect(-20, -104, 36, 10, 3, C("#222"));
  P.rect(-18, -102, 16, 6, C("#e53935")); P.rect(0, -102, 16, 6, C("#2e86de"));
}));
def("Vehicles", "rickshaw", "cx baseY w [color]", "auto rickshaw (tuk-tuk) facing right (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 180, () => {
  const c = a.color || C("#2e9e4f"), dk = shade(c, -0.45), gl = C("#bfe6ff");
  x6sh(P, 90);
  P.rrect(-90, -84, 100, 56, 8, c, dk, 2.5);
  P.poly([[-96, -84], [-86, -112], [30, -112], [40, -84]], C("#222"));
  P.poly([[10, -28], [10, -84], [46, -84], [78, -44], [78, -28]], c, dk, 2.5);
  P.poly([[16, -78], [44, -78], [66, -48], [16, -48]], gl, dk, 1.5);
  P.rect(-90, -52, 168, 6, C("#ffd23f"));
  P.circle(78, -44, 5, C("#fff3a8"));
  P.circle(-56, -18, 18, C("#222")); P.circle(-56, -18, 8, C("#c8ccd2"));
  P.circle(62, -14, 14, C("#222")); P.circle(62, -14, 6, C("#c8ccd2"));
}));
def("Vehicles", "ship", "cx baseY w [hull]", "big ship with funnel, decks and portholes (baseY = water line, w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 260, () => {
  const h = a.hull || C("#1f4e8c"), dk = shade(h, -0.45), gl = C("#bfe6ff");
  P.rrect(-60, -86, 110, 24, 4, WHITE(), C("#8a93a0"), 2);
  P.rrect(-12, -122, 28, 38, 4, C("#e53935"), shade(C("#e53935"), -0.4), 2); P.rect(-12, -122, 28, 8, C("#222"));
  P.rrect(-90, -62, 170, 26, 4, WHITE(), C("#8a93a0"), 2);
  for (let x = -76; x < 72; x += 20) P.rect(x, -56, 12, 10, gl);
  for (let x = -46; x < 40; x += 20) P.rect(x, -80, 12, 10, gl);
  P.poly([[-130, -36], [130, -36], [104, 0], [-108, 0]], h, dk, 2.5);
  P.rect(-124, -30, 246, 5, WHITE(0.8));
  for (let x = -100; x <= 100; x += 24) P.circle(x, -16, 5, gl, C("#8a93a0"), 1.5);
  P.ellipse(0, 2, 140, 7, C("#2b7bd8@0.35"));
}));

// ---------------- BUILDINGS & LANDMARKS ----------------
def("Buildings", "barn", "cx baseY w [wall] [roof]", "red farm barn with white X doors (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 180, () => {
  const wl = a.wall || C("#b5302a"), rf = a.roof || shade(wl, -0.35), dk = shade(wl, -0.5);
  P.ellipse(0, 1, 100, 6, BLACK(0.18));
  P.rect(-80, -80, 160, 80, wl, dk, 2.5);
  P.poly([[-90, -80], [-60, -122], [60, -122], [90, -80]], rf, shade(rf, -0.4), 2.5);
  P.rect(-14, -110, 28, 22, C("#fff6e0"), dk, 2); P.line(-14, -99, 14, -99, dk, 2);
  P.rect(-30, -60, 60, 60, WHITE(), dk, 2.5);
  P.line(-30, -60, 30, 0, dk, 3); P.line(30, -60, -30, 0, dk, 3);
  P.rect(-30, -60, 60, 60, null, C("#f4f1ea"), 4);
}));
def("Buildings", "church", "cx baseY w [wall] [roof]", "church with steeple, cross and arched door (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 140, () => {
  const wl = a.wall || C("#f3ead2"), rf = a.roof || C("#7a3b2a"), dk = shade(wl, -0.45);
  P.ellipse(0, 1, 90, 6, BLACK(0.18));
  P.rect(-60, -70, 120, 70, wl, dk, 2.5);
  P.poly([[-70, -70], [0, -110], [70, -70]], rf, shade(rf, -0.4), 2.5);
  P.rect(-24, -120, 48, 120, shade(wl, 0.04), dk, 2.5);
  P.poly([[-30, -120], [0, -190], [30, -120]], rf, shade(rf, -0.4), 2.5);
  P.line(0, -190, 0, -214, C("#ffc83d"), 3); P.line(-8, -204, 8, -204, C("#ffc83d"), 3);
  P.circle(0, -96, 9, C("glass"), dk, 2);
  P.pie(0, -30, 14, 16, 180, 180, C("#5a3a1a")); P.rect(-14, -30, 28, 30, C("#5a3a1a"));
  for (const x of [-42, 42]) { P.pie(x, -44, 8, 10, 180, 180, C("glass"), dk, 1.5); P.rect(x - 8, -44, 16, 18, C("glass"), dk, 1.5); }
}));
def("Landmarks", "taj", "cx baseY w [color]", "Taj Mahal with big dome and four minarets (w = total width)", (a, P) => P.at(a.cx, a.baseY, a.w / 300, () => {
  const c = a.color || C("#f6f1e6"), dk = shade(c, -0.4), gd = C("#ffc83d");
  P.ellipse(0, 2, 160, 8, BLACK(0.16));
  P.rect(-150, -20, 300, 20, shade(c, -0.05), dk, 2);
  for (const s of [-1, 1]) {
    const x = s * 112;
    P.rect(x - 8, -126, 16, 106, c, dk, 1.5); P.rect(x - 11, -80, 22, 5, dk); P.rect(x - 11, -126, 22, 5, dk);
    P.pie(x, -126, 10, 14, 180, 180, c, dk, 1.5); P.line(x, -140, x, -152, gd, 2);
  }
  P.rect(-60, -86, 120, 66, c, dk, 2);
  P.pie(0, -50, 22, 32, 180, 180, C("#2b3a4a")); P.rect(-22, -50, 44, 30, C("#2b3a4a"));
  for (const x of [-46, 46]) { P.pie(x, -56, 8, 14, 180, 180, C("#5b6b7a")); P.rect(x - 8, -56, 16, 36, C("#5b6b7a")); }
  for (const x of [-52, 52]) P.pie(x, -86, 12, 18, 180, 180, c, dk, 1.5);
  P.pie(0, -86, 46, 58, 180, 180, c, dk, 2);
  P.pie(-10, -86, 26, 48, 180, 180, WHITE(0.3));
  P.line(0, -144, 0, -166, gd, 3); P.circle(0, -150, 4, gd);
}));
def("Landmarks", "bigben", "cx baseY h", "Big Ben clock tower (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 320, () => {
  const t = C("#d3b98a"), dk = shade(t, -0.45), gr = C("#3f6b5a");
  P.ellipse(0, 2, 44, 5, BLACK(0.18));
  P.rect(-26, -152, 52, 152, t, dk, 2.5);
  for (const y of [-120, -80, -40]) P.rrect(-6, y, 12, 22, 6, C("#5a4a3a"));
  P.rect(-34, -212, 68, 62, shade(t, 0.05), dk, 2.5);
  P.circle(0, -182, 23, C("#fffaf0"), dk, 3);
  P.line(0, -182, 0, -200, dk, 3); P.line(0, -182, 11, -178, dk, 3);
  for (let k = 0; k < 12; k++) { const r = (k * 30 * Math.PI) / 180; P.line(Math.sin(r) * 17, -182 - Math.cos(r) * 17, Math.sin(r) * 20, -182 - Math.cos(r) * 20, dk, 1.5); }
  P.rect(-28, -252, 56, 40, t, dk, 2.5);
  for (const x of [-16, 0, 16]) P.pie(x, -226, 5, 9, 180, 180, C("#3a2f24")), P.rect(x - 5, -226, 10, 14, C("#3a2f24"));
  P.poly([[-30, -252], [0, -320], [30, -252]], gr, shade(gr, -0.4), 2.5);
  P.line(0, -320, 0, -334, C("#ffc83d"), 2.5);
}));
def("Landmarks", "kaaba", "cx baseY w", "the Kaaba: black cube with gold band and door (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 150, () => {
  const g = C("#ffc83d"), gd = shade(g, -0.45);
  P.rect(-76, 0, 152, 8, C("#d8d2c4"), C("#999"), 1.5);
  P.rect(-70, -110, 140, 110, C("#1a1a1a"), C("#000"), 2.5);
  P.rect(-72, -116, 144, 8, C("#111"));
  for (let x = -56; x < 70; x += 28) P.line(x, -108, x, -2, C("#333"), 1.5);
  P.rect(-70, -92, 140, 16, g, gd, 1.5);
  for (let x = -62; x < 62; x += 14) P.rect(x, -88, 8, 8, shade(g, 0.25));
  P.rrect(22, -66, 32, 62, 3, g, gd, 2); P.rrect(27, -60, 22, 50, 2, shade(g, -0.2), gd, 1.5);
}));
def("Landmarks", "pisa", "cx baseY h", "Leaning Tower of Pisa (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 220, () => {
  const w = C("#f2eee4"), dk = C("#a49e8c");
  P.ellipse(0, 2, 50, 5, BLACK(0.18));
  P.rotate(6);
  P.rect(-24, -24, 48, 24, w, dk, 1.5);
  for (let k = 1; k < 7; k++) {
    P.rect(-24, -k * 24 - 24, 48, 24, w, dk, 1.5);
    for (let j = -2; j <= 2; j++) P.rrect(j * 9 - 3, -k * 24 - 20, 6, 14, 3, C("#6b6b6b@0.6"));
  }
  P.rect(-18, -208, 36, 16, shade(w, -0.04), dk, 1.5);
  P.rect(-14, -216, 28, 8, shade(w, -0.08), dk, 1.5);
}));

// ---------------- NATURE ----------------
def("Nature", "waterfall", "x y w h", "waterfall between rocks with mist. x,y = top-left of the falling water", (a, P) => {
  const { x, y, w, h } = a;
  P.poly([[x - w * 0.6, y - 12], [x, y - 12], [x + w * 0.04, y + h], [x - w * 0.6, y + h]], C("#6b6f78"), C("#4a4d55"), 2);
  P.poly([[x + w, y - 12], [x + w * 1.6, y - 12], [x + w * 1.6, y + h], [x + w * 0.96, y + h]], C("#7a7e88"), C("#4a4d55"), 2);
  P.rect(x, y, w, h, P.linGrad(x, y, x, y + h, [[0, C("#9bd8ff")], [1, C("#e8f6ff")]]));
  for (let i = 0; i < 14; i++) { const sx = x + P.rnd() * w, sy = y + P.rnd() * h * 0.5; P.line(sx, sy, sx, sy + h * (0.25 + P.rnd() * 0.3), WHITE(0.6), 2.5); }
  P.ellipse(x + w / 2, y + h, w * 0.75, h * 0.07, C("#6fc3ff@0.85"));
  P.circle(x + w / 2, y + h, w * 0.55, P.radGrad(x + w / 2, y + h, w * 0.55, [[0, WHITE(0.75)], [1, WHITE(0)]]));
});
def("Nature", "rock", "cx baseY w [color]", "grey boulder with shading (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 140, () => {
  const c = a.color || C("#8a8f98"), dk = shade(c, -0.45);
  x6sh(P, 74);
  P.blob([[-60, 0], [-70, -30], [-40, -62], [10, -70], [56, -48], [70, -12], [60, 0]], c, dk, 2.5);
  P.poly([[10, -70], [56, -48], [70, -12], [20, -20]], shade(c, -0.2));
  P.poly([[-40, -62], [10, -70], [-6, -40], [-34, -34]], shade(c, 0.25));
  P.blob([[-50, -4], [-30, -12], [-10, -6], [-30, 0]], C("#5ca05a@0.8"));
}));
def("Nature", "log", "cx baseY w [color]", "fallen tree log with growth rings (w = length)", (a, P) => P.at(a.cx, a.baseY, a.w / 160, () => {
  const c = a.color || C("#8a5a2b"), dk = shade(c, -0.45);
  x6sh(P, 90);
  P.rect(-80, -44, 150, 44, c, dk, 2);
  for (const y of [-34, -24, -14, -6]) P.line(-70, y, 66, y, alpha(dk, 0.4), 1.5);
  P.ellipse(-80, -22, 16, 22, C("#e0b878"), dk, 2.5);
  P.ellipse(-80, -22, 10, 14, null, dk, 1.5); P.ellipse(-80, -22, 4, 6, null, dk, 1.5);
}));
def("Nature", "sakura", "cx baseY h", "cherry blossom tree full of pink flowers (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 200, () => {
  const br = C("#5a3a2a");
  P.curve([[0, 0], [-6, -50], [10, -90], [0, -120]], br, 12);
  P.curve([[4, -80], [40, -100], [60, -130]], br, 6); P.curve([[-2, -70], [-44, -96], [-64, -120]], br, 6);
  for (let i = 0; i < 80; i++) {
    const t = P.rnd() * Math.PI * 2, rr = Math.sqrt(P.rnd());
    P.circle(Math.cos(t) * 92 * rr, -150 + Math.sin(t) * 48 * rr, 6 + P.rnd() * 8, i % 3 ? C("#ffc0d8@0.85") : C("#ff9ec4@0.85"));
  }
  for (let i = 0; i < 12; i++) P.ellipse(-60 + P.rnd() * 120, -2 - P.rnd() * 4, 4, 2, C("#ffc0d8"));
}));
def("Nature", "tornado", "cx baseY h", "tornado funnel with dark storm cloud (h = total height)", (a, P) => P.at(a.cx, a.baseY, a.h / 230, () => {
  P.ellipse(0, 0, 44, 8, C("#9aa0a6@0.7"));
  for (let k = 0; k < 10; k++) P.ellipse(Math.sin(k * 1.3) * 10, -k * 20, 12 + k * 13, 9, C("#6b7280@0.85"), C("#4b5563@0.7"), 2);
  P.ellipse(0, -208, 140, 28, C("#4b5563")); P.ellipse(-52, -218, 62, 22, C("#59606b")); P.ellipse(54, -216, 66, 22, C("#59606b"));
  for (const [x, y] of [[-40, -14], [34, -30], [-20, -60]]) P.rect(x, y, 8, 4, C("#6b4a2a"));
}));
def("Nature", "aurora", "x y w h", "northern lights ribbons (green, blue, purple) inside the area x y w h", (a, P) => {
  const cols = [C("#5cff9e"), C("#3ddcff"), C("#9d6bff")];
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([a.x + (a.w * i) / 8, a.y + a.h * (0.35 + 0.2 * k) + Math.sin(i * 0.9 + k * 1.7) * a.h * 0.14]);
    for (let j = 0; j < 4; j++) P.curve(pts, alpha(cols[k], 0.12), a.h * (0.34 - j * 0.07));
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, idx = Math.min(7, Math.floor(t * 8)), f = t * 8 - idx, y = pts[idx][1] * (1 - f) + pts[idx + 1][1] * f, x = a.x + a.w * t;
      P.line(x, y, x, y - a.h * (0.2 + 0.25 * P.rnd()), alpha(cols[k], 0.1), 5);
    }
  }
});
def("Nature", "comet", "cx cy r", "comet with glowing head and long tail going up-right (r = head radius)", (a, P) => P.at(a.cx, a.cy, a.r / 22, () => {
  P.poly([[0, -20], [320, -120], [320, -70], [0, 20]], P.linGrad(0, 0, 320, -95, [[0, C("#fff6c0@0.9")], [1, C("#fff6c0@0")]]));
  P.poly([[0, -8], [320, -70], [320, -40], [0, 10]], P.linGrad(0, 0, 320, -55, [[0, C("#7fd0ff@0.8")], [1, C("#7fd0ff@0")]]));
  P.circle(0, 0, 60, P.radGrad(0, 0, 60, [[0, C("#fff6c0@0.8")], [1, C("#fff6c0@0")]]));
  P.circle(0, 0, 22, C("#fffbe8"), C("#ffe9a0"), 3);
}));
def("Nature", "iceberg", "cx baseY w", "iceberg floating on the water line (w = width)", (a, P) => P.at(a.cx, a.baseY, a.w / 220, () => {
  P.poly([[-110, 0], [110, 0], [70, 60], [0, 100], [-70, 60]], C("#6fb5e8@0.55"));
  P.poly([[-110, 0], [-70, -60], [-30, -50], [0, -120], [40, -70], [70, -90], [110, 0]], C("#eaf6ff"), C("#9cc6e0"), 2);
  P.poly([[0, -120], [40, -70], [20, 0], [-10, -50]], C("#cfe8f8"));
  P.poly([[70, -90], [110, 0], [50, 0], [56, -60]], C("#bcd9ee"));
  P.line(-130, 0, 130, 0, C("#2b7bd8"), 2.5);
}));
def("Nature", "dunes", "y [color]", "desert sand dunes from y down to the bottom edge", (a, P) => {
  const c = a.color || C("#e9c27a");
  for (let k = 0; k < 3; k++) {
    const base = a.y + k * (P.h - a.y) * 0.22, col = shade(c, 0.12 - k * 0.14), pts = [];
    for (let x = 0; x <= P.w; x += 20) pts.push([x, base + Math.sin((x / P.w) * Math.PI * (1.4 + k * 0.5) + k * 2) * (18 + k * 8)]);
    P.poly([...pts, [P.w + 1, P.h + 1], [-1, P.h + 1]], col);
    P.polyline(pts, alpha(shade(col, 0.3), 0.6), 2.5);
  }
});
def("Nature", "leaf", "cx cy s [color]", "single leaf with veins and stem (s = half height)", (a, P) => P.at(a.cx, a.cy, a.s / 70, () => {
  const c = a.color || C("#43a047"), dk = shade(c, -0.45);
  P.line(0, 60, 0, 84, dk, 4);
  P.blob([[0, -60], [30, -30], [34, 10], [0, 60], [-34, 10], [-30, -30]], c, dk, 2.5);
  P.line(0, -56, 0, 64, dk, 2.5);
  for (let k = 0; k < 4; k++) { P.line(0, -30 + k * 20, 18, -44 + k * 20, dk, 1.8); P.line(0, -30 + k * 20, -18, -44 + k * 20, dk, 1.8); }
}));
def("Nature", "fog", "x y w h [n]", "soft drifting fog / mist inside a rectangle area", (a, P) => {
  for (let i = 0; i < (a.n ?? 12); i++) {
    const cx = a.x + P.rnd() * a.w, cy = a.y + P.rnd() * a.h, rx = a.w * (0.12 + P.rnd() * 0.18);
    P.push(); P.translate(cx, cy); P.scale(1, 0.4);
    P.circle(0, 0, rx, P.radGrad(0, 0, rx, [[0, WHITE(0.5)], [1, WHITE(0)]]));
    P.pop();
  }
});
def("Nature", "galaxy", "cx cy r [color]", "spiral galaxy with glowing core (r = radius)", (a, P) => {
  const cols = [C("#ffffff"), C("#bfd8ff"), C("#ffd1e8")];
  P.push(); P.translate(a.cx, a.cy); P.rotate(-20);
  P.circle(0, 0, a.r, P.radGrad(0, 0, a.r, [[0, alpha(a.color || C("#7b4dff"), 0.35)], [1, alpha(a.color || C("#7b4dff"), 0)]]));
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 4, rr = a.r * (t / (Math.PI * 4)), an = t + arm * Math.PI, j = (P.rnd() - 0.5) * a.r * 0.14;
    P.circle(Math.cos(an) * rr + j, Math.sin(an) * rr * 0.55 + j * 0.5, 0.8 + P.rnd() * 1.6, alpha(cols[i % 3], 0.4 + P.rnd() * 0.6));
  }
  P.circle(0, 0, a.r * 0.35, P.radGrad(0, 0, a.r * 0.35, [[0, C("#fff3d0")], [0.4, C("#ffb86b@0.7")], [1, C("#7b4dff@0")]]));
  P.pop();
});

// ---------------- SHAPES ----------------
def("Shapes", "cross", "cx cy r fill [stroke] [lw]", "plus / cross shape (r = half size)", (a, P) => {
  const r = a.r, t = r * 0.33;
  P.poly([[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]].map(([x, y]) => [a.cx + x, a.cy + y]), a.fill, a.stroke, a.lw ?? 3);
});
def("Shapes", "gear", "cx cy r fill [stroke] [lw] [points]", "gear / cog with a hole (points = number of teeth, default 10)", (a, P) => {
  const n = Math.max(3, Math.round(a.points ?? 10)), step = 360 / n, rin = a.r * 0.78, out = [], hole = [];
  const pt = (deg, rad) => [a.cx + rad * Math.cos((deg * Math.PI) / 180), a.cy + rad * Math.sin((deg * Math.PI) / 180)];
  for (let i = 0; i < n; i++) { const b = i * step - 90; out.push(pt(b - 0.3 * step, rin), pt(b - 0.17 * step, a.r), pt(b + 0.17 * step, a.r), pt(b + 0.3 * step, rin)); }
  for (let i = 0; i < 24; i++) hole.push(pt(i * 15, a.r * 0.3));
  if (a.fill) P.fillDev([out.map((p) => P.tp(p[0], p[1])), hole.map((p) => P.tp(p[0], p[1]))], { c: a.fill }, true);
  if (a.stroke) { P.strokePoly(out, a.lw ?? 3, a.stroke, true); P.strokePoly(hole, a.lw ?? 3, a.stroke, true); }
});
def("Shapes", "spiral", "cx cy r color [lw] [turns]", "spiral line (turns default 4)", (a, P) => {
  const turns = a.turns ?? 4, pts = [], N = Math.max(40, Math.round(turns * 40));
  for (let i = 0; i <= N; i++) { const t = i / N, an = t * turns * Math.PI * 2; pts.push([a.cx + a.r * t * Math.cos(an), a.cy + a.r * t * Math.sin(an)]); }
  P.polyline(pts, a.color, a.lw ?? 3);
});
def("Shapes", "zigzag", "x1 y1 x2 y2 color [lw] [amp] [step]", "zigzag line from point 1 to point 2 (amp = height of zigs, step = distance between zigs)", (a, P) => {
  const L = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  if (L < 1) return;
  const ux = (a.x2 - a.x1) / L, uy = (a.y2 - a.y1) / L, amp = a.amp ?? 10, st = a.step ?? 14, pts = [[a.x1, a.y1]];
  for (let d = st, i = 0; d < L; d += st, i++) { const o = i % 2 ? amp : -amp; pts.push([a.x1 + ux * d - uy * o, a.y1 + uy * d + ux * o]); }
  pts.push([a.x2, a.y2]);
  P.polyline(pts, a.color, a.lw ?? 3);
});
def("Shapes", "wavy", "x1 y1 x2 y2 color [lw] [amp] [len]", "wavy line from point 1 to point 2 (amp = wave height, len = wave length)", (a, P) => {
  const L = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  if (L < 1) return;
  const ux = (a.x2 - a.x1) / L, uy = (a.y2 - a.y1) / L, amp = a.amp ?? 8, wl = a.len ?? 40, pts = [], N = Math.max(10, Math.ceil(L / 4));
  for (let i = 0; i <= N; i++) { const d = (L * i) / N, o = Math.sin((d / wl) * Math.PI * 2) * amp; pts.push([a.x1 + ux * d - uy * o, a.y1 + uy * d + ux * o]); }
  P.polyline(pts, a.color, a.lw ?? 3);
});
def("Shapes", "burst", "cx cy r fill [stroke] [lw] [points]", "starburst / explosion / sale sticker shape (points default 12)", (a, P) => {
  const n = Math.max(3, Math.round(a.points ?? 12)), pts = [];
  for (let i = 0; i < n * 2; i++) { const R = i % 2 === 0 ? a.r : a.r * 0.68, t = ((-90 + (i * 180) / n) * Math.PI) / 180; pts.push([a.cx + R * Math.cos(t), a.cy + R * Math.sin(t)]); }
  P.poly(pts, a.fill, a.stroke, a.lw ?? 3);
});
def("Shapes", "capsule", "x y w h fill [stroke] [lw]", "capsule / fully rounded bar. x,y = top-left", (a, P) => P.rrect(a.x, a.y, a.w, a.h, Math.min(a.w, a.h) / 2, a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "blockarrow", "cx cy w h fill [stroke] [lw] [rot]", "fat block arrow pointing right (rot = rotation in degrees: 90 = down, 180 = left, 270 = up)", (a, P) => {
  const sh = a.h * 0.22;
  P.push(); P.translate(a.cx, a.cy); P.rotate(a.rot ?? 0);
  P.poly([[-a.w / 2, -sh], [a.w * 0.1, -sh], [a.w * 0.1, -a.h / 2], [a.w / 2, 0], [a.w * 0.1, a.h / 2], [a.w * 0.1, sh], [-a.w / 2, sh]], a.fill, a.stroke, a.lw ?? 3);
  P.pop();
});
def("Shapes", "trapezoid", "cx cy w1 w2 h fill [stroke] [lw]", "trapezoid: w1 = top width, w2 = bottom width", (a, P) => P.poly([[a.cx - a.w1 / 2, a.cy - a.h / 2], [a.cx + a.w1 / 2, a.cy - a.h / 2], [a.cx + a.w2 / 2, a.cy + a.h / 2], [a.cx - a.w2 / 2, a.cy + a.h / 2]], a.fill, a.stroke, a.lw ?? 3));
def("Shapes", "thought", "cx cy w h str [fill] [textcolor]", "thought bubble with little bubbles trailing down-left (use | for 2 lines)", (a, P) => {
  const f = a.fill || WHITE(), ln = C("#333"), rx = a.w / 2, ry = a.h / 2, r = Math.min(a.w, a.h) * 0.22;
  for (const pass of [0, 1]) {
    const k = pass ? 0 : 2.5, col = pass ? f : ln;
    for (let i = 0; i < 12; i++) { const t = (i * Math.PI) / 6; P.circle(a.cx + rx * 0.82 * Math.cos(t), a.cy + ry * 0.78 * Math.sin(t), r + k, col); }
    P.ellipse(a.cx, a.cy, rx * 0.84, ry * 0.8, col);
    P.circle(a.cx - a.w * 0.22, a.cy + ry + 16, 10 + k, col); P.circle(a.cx - a.w * 0.3, a.cy + ry + 34, 6 + k, col);
  }
  fitText(P, a.str, a.cx, a.cy, a.w * 0.8, a.h * 0.75, a.textcolor || C("#222"), 36);
});

// ---------------- EFFECTS ----------------
def("Effects", "vignette", "[a]", "dark soft edges around the whole picture (a = darkness 0..1, default 0.45). use near the end", (a, P) => {
  P.rect(0, 0, P.w, P.h, P.radGrad(P.w / 2, P.h / 2, Math.hypot(P.w, P.h) / 2, [[0, BLACK(0)], [0.5, BLACK(0)], [1, BLACK(a.a ?? 0.45)]]));
});
def("Effects", "rays", "cx cy color [n]", "sunburst rays from a point across the whole picture (n = number of rays, default 18). use color@0.2 for soft rays", (a, P) => {
  const n = Math.max(2, Math.round(a.n ?? 18)), L = Math.hypot(P.w, P.h) * 1.2, step = (Math.PI * 2) / n;
  for (let k = 0; k < n; k += 2) {
    const t0 = k * step, t1 = t0 + step;
    P.poly([[a.cx, a.cy], [a.cx + L * Math.cos(t0), a.cy + L * Math.sin(t0)], [a.cx + L * Math.cos(t1), a.cy + L * Math.sin(t1)]], a.color);
  }
});
def("Effects", "stripes", "x y w h c1 c2 [step] [dir]", "striped rectangle. dir = h (horizontal bands, default) or v (vertical bands)", (a, P) => {
  const st = a.step ?? 20, v = String(a.dir || "h").toLowerCase() === "v";
  P.rect(a.x, a.y, a.w, a.h, a.c1);
  for (let d = st; d < (v ? a.w : a.h); d += st * 2) v ? P.rect(a.x + d - st, a.y, st, a.h, a.c2) : P.rect(a.x, a.y + d - st, a.w, st, a.c2);
});
def("Effects", "checker", "x y w h c1 c2 [step]", "checkerboard rectangle (step = square size, default 40)", (a, P) => {
  const st = Math.max(8, a.step ?? 40);
  P.rect(a.x, a.y, a.w, a.h, a.c1);
  for (let r = 0; r * st < a.h; r++) for (let c = 0; c * st < a.w; c++) if ((r + c) % 2) P.rect(a.x + c * st, a.y + r * st, Math.min(st, a.w - c * st), Math.min(st, a.h - r * st), a.c2);
});
def("Effects", "dots", "x y w h color [r] [gap]", "polka dot pattern inside a rectangle (r = dot radius, gap = distance, default 5 and 24)", (a, P) => {
  const r = a.r ?? 5, gap = Math.max(8, a.gap ?? 24);
  for (let row = 0, y = a.y + gap / 2; y < a.y + a.h; y += gap, row++) for (let x = a.x + gap / 2 + (row % 2 ? gap / 2 : 0); x < a.x + a.w; x += gap) P.circle(x, y, r, a.color);
});
def("Effects", "beam", "cx y w h [color]", "spotlight / light beam cone from the top point (cx,y) widening down to width w, fading out over height h", (a, P) => {
  const c = a.color || C("#fff6c0");
  P.poly([[a.cx - 6, a.y], [a.cx + 6, a.y], [a.cx + a.w / 2, a.y + a.h], [a.cx - a.w / 2, a.y + a.h]], P.linGrad(0, a.y, 0, a.y + a.h, [[0, alpha(c, 0.6)], [1, alpha(c, 0)]]));
});

// ---------------- TEXT STYLES ----------------
def("Text", "textoutline", "str cx y size color [stroke] [style]", "centered text with a thick outline (stroke default black). great for titles on pictures", (a, P) => {
  const st = a.stroke || C("black"), b = a.style !== "normal", o = Math.max(2, a.size * 0.07);
  for (let k = 0; k < 12; k++) { const t = (k * Math.PI) / 6; P.text(a.str, a.cx + o * Math.cos(t), a.y + o * Math.sin(t), a.size, st, b, "center"); }
  P.text(a.str, a.cx, a.y, a.size, a.color, b, "center");
});
def("Text", "textshadow", "str cx y size color [style]", "centered text with a soft drop shadow", (a, P) => {
  const b = a.style !== "normal", o = Math.max(2, a.size * 0.06);
  P.text(a.str, a.cx + o, a.y + o, a.size, BLACK(0.35), b, "center");
  P.text(a.str, a.cx, a.y, a.size, a.color, b, "center");
});
def("Text", "banner", "cx cy w h str [fill] [textcolor]", "ribbon banner with folded tails and text (use | for 2 lines)", (a, P) => {
  const f = a.fill || C("#e53935"), dk = shade(f, -0.4), x = a.cx - a.w / 2, y = a.cy - a.h / 2, t = a.h * 0.25, d = a.h * 0.2;
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x : x + a.w, far = ex + s * a.h * 0.5;
    P.poly([[far, y + d], [ex - s * (-t) - s * t * 0 + s * 0, y + d], [ex, y + a.h + d], [far, y + a.h + d], [ex + s * (a.h * 0.5 - a.h * 0.22), y + a.h / 2 + d]], shade(f, -0.2), dk, 2);
    P.poly([[ex, y + a.h], [ex - s * t, y + a.h], [ex, y + a.h + d]], shade(f, -0.55));
  }
  P.rect(x, y, a.w, a.h, f, dk, 2.5);
  fitText(P, a.str, a.cx, a.cy, a.w, a.h, a.textcolor || autoText(f), 40);
});
def("Text", "badge", "cx cy r str [fill] [textcolor]", "round scalloped badge / sticker with text (use | for 2 lines)", (a, P) => {
  const f = a.fill || C("#ffc83d"), dk = shade(f, -0.4);
  for (let k = 0; k < 20; k++) { const t = (k * Math.PI) / 10; P.circle(a.cx + a.r * 0.9 * Math.cos(t), a.cy + a.r * 0.9 * Math.sin(t), a.r * 0.14, f, dk, 2); }
  P.circle(a.cx, a.cy, a.r * 0.92, f);
  P.circle(a.cx, a.cy, a.r * 0.8, null, WHITE(0.75), 2.5);
  fitText(P, a.str, a.cx, a.cy, a.r * 1.5, a.r * 1.2, a.textcolor || autoText(f), 40);
});

// ---------------- DIAGRAMS & UI ----------------
def("Diagram", "cylinder", "x y w h label [fill] [textcolor]", "database cylinder with text (use | for 2 lines). x,y = top-left", (a, P) => {
  const f = a.fill || C("#90caf9"), ln = shade(f, -0.4), ry = Math.min(a.h * 0.18, a.w * 0.25), cx = a.x + a.w / 2;
  P.ellipse(cx, a.y + a.h - ry, a.w / 2, ry, f, ln, 2.5);
  P.rect(a.x, a.y + ry, a.w, a.h - 2 * ry, f);
  P.line(a.x, a.y + ry, a.x, a.y + a.h - ry, ln, 2.5); P.line(a.x + a.w, a.y + ry, a.x + a.w, a.y + a.h - ry, ln, 2.5);
  P.ellipse(cx, a.y + ry, a.w / 2, ry, shade(f, 0.15), ln, 2.5);
  fitText(P, a.label, cx, a.y + a.h / 2 + ry * 0.4, a.w, a.h - ry * 2, a.textcolor || autoText(f));
});
def("Diagram", "actor", "cx cy h label [color]", "stick-figure user / actor with a name under it (cx,cy = middle of the figure)", (a, P) => {
  const c = a.color || C("#222"), top = a.cy - a.h / 2, r = a.h * 0.12, bot = a.cy + a.h / 2, nk = top + r * 2, hip = a.cy + a.h * 0.12;
  P.circle(a.cx, top + r, r, WHITE(), c, 3.5);
  P.line(a.cx, nk, a.cx, hip, c, 3.5); P.line(a.cx - a.h * 0.22, nk + a.h * 0.12, a.cx + a.h * 0.22, nk + a.h * 0.12, c, 3.5);
  P.line(a.cx, hip, a.cx - a.h * 0.17, bot, c, 3.5); P.line(a.cx, hip, a.cx + a.h * 0.17, bot, c, 3.5);
  P.text(a.label, a.cx, bot + 8, Math.max(14, a.h * 0.16), c, true, "center");
});
def("Diagram", "cloudbox", "cx cy w h label [fill] [textcolor]", "cloud shape with text (cloud service in diagrams). cx,cy = center", (a, P) => {
  const f = a.fill || C("#e3f2fd"), ln = shade(f, -0.45);
  P.push(); P.translate(a.cx, a.cy); P.scale(a.w / 200, a.h / 120);
  for (const pass of [0, 1]) {
    const k = pass ? 0 : 3, col = pass ? f : ln;
    for (const [x, y, r] of [[-55, 14, 34], [-20, -14, 44], [28, -10, 40], [62, 16, 30]]) P.circle(x, y, r + k, col);
    P.rrect(-75 - k, 14 - k, 150 + 2 * k, 34 + 2 * k, 17, col);
  }
  P.pop();
  fitText(P, a.label, a.cx, a.cy + a.h * 0.08, a.w * 0.7, a.h * 0.55, a.textcolor || autoText(f));
});
def("Diagram", "document", "x y w h label [fill] [textcolor]", "document / page shape with wavy bottom and text. x,y = top-left", (a, P) => {
  const f = a.fill || WHITE(), ho = Math.min(14, a.h * 0.12), pts = [[a.x, a.y], [a.x + a.w, a.y]];
  for (let i = 0; i <= 20; i++) pts.push([a.x + a.w - (a.w * i) / 20, a.y + a.h - ho + Math.sin((i / 20) * Math.PI * 2) * ho * 0.8]);
  P.poly(pts.map(([x, y]) => [x + 3, y + 4]), BLACK(0.12));
  P.poly(pts, f, shade(f, -0.45), 2.5);
  fitText(P, a.label, a.x + a.w / 2, a.y + (a.h - ho) / 2, a.w, a.h - ho, a.textcolor || autoText(f));
});
def("Diagram", "note", "x y w h str [fill] [textcolor]", "yellow sticky note with folded corner (use | for new lines). x,y = top-left", (a, P) => {
  const f = a.fill || C("#fff176"), fc = Math.min(22, a.w * 0.2, a.h * 0.2);
  P.poly([[a.x + 4, a.y + 5], [a.x + a.w + 4, a.y + 5], [a.x + a.w + 4, a.y + a.h + 5], [a.x + 4, a.y + a.h + 5]], BLACK(0.12));
  P.poly([[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h - fc], [a.x + a.w - fc, a.y + a.h], [a.x, a.y + a.h]], f, shade(f, -0.35), 2);
  P.poly([[a.x + a.w - fc, a.y + a.h], [a.x + a.w - fc, a.y + a.h - fc], [a.x + a.w, a.y + a.h - fc]], shade(f, -0.18), shade(f, -0.35), 1.5);
  fitText(P, a.str, a.x + a.w / 2, a.y + a.h / 2, a.w - 10, a.h - 10, a.textcolor || C("#3b3b00"), 30);
});
def("Diagram", "table", "x y w h cols items...", "table. cols = number of columns, items = cell texts row by row (first row = header)", (a, P) => {
  const cols = Math.max(1, Math.round(a.cols)), cells = a.items;
  if (!cells.length) throw new Error("table needs cell texts after cols");
  const rows = Math.ceil(cells.length / cols), cw = a.w / cols, rh = a.h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = cells[r * cols + c], f = r === 0 ? C("#4e79a7") : r % 2 ? WHITE() : C("#eef2f7");
    P.rect(a.x + c * cw, a.y + r * rh, cw, rh, f, C("#9aa5b1"), 1.5);
    if (t !== undefined) fitText(P, t, a.x + (c + 0.5) * cw, a.y + (r + 0.5) * rh, cw, rh, r === 0 ? WHITE() : C("#222"), 20);
  }
});
def("Diagram", "progress", "x y w h pct [color] [textcolor]", "progress bar showing pct percent (0-100)", (a, P) => {
  const c = a.color || C("#43a047"), pc = Math.max(0, Math.min(100, a.pct));
  P.rrect(a.x, a.y, a.w, a.h, a.h / 2, C("#e3e8ee"), C("#c3ccd6"), 2);
  if (pc > 0) P.rrect(a.x, a.y, Math.max(a.h, (a.w * pc) / 100), a.h, a.h / 2, c, shade(c, -0.3), 2);
  fitText(P, Math.round(pc) + "%", a.x + a.w / 2, a.y + a.h / 2, a.w, a.h, a.textcolor || C("#1d2733"), Math.min(26, a.h * 0.6));
});
def("Diagram", "gauge", "cx cy r pct [color]", "half-circle gauge / speedometer with needle showing pct (0-100). cx,cy = center of the flat edge", (a, P) => {
  const pc = Math.max(0, Math.min(100, a.pct)), c = a.color || (pc < 35 ? C("#e53935") : pc < 70 ? C("#fbc02d") : C("#43a047")), w = a.r * 0.22;
  P.arc(a.cx, a.cy, a.r, a.r, 180, 180, C("#e3e8ee"), w);
  if (pc > 0) P.arc(a.cx, a.cy, a.r, a.r, 180, 1.8 * pc, c, w);
  const t = ((180 + 1.8 * pc) * Math.PI) / 180;
  P.line(a.cx, a.cy, a.cx + a.r * 0.78 * Math.cos(t), a.cy + a.r * 0.78 * Math.sin(t), C("#2b2b2b"), Math.max(3, a.r * 0.05));
  P.circle(a.cx, a.cy, a.r * 0.08, C("#2b2b2b"));
  P.text(Math.round(pc) + "%", a.cx, a.cy + a.r * 0.14, a.r * 0.36, C("#222"), true, "center");
});
def("Diagram", "dasharrow", "x1 y1 x2 y2 [color] [lw]", "dashed line with an arrow head pointing at x2,y2", (a, P) => {
  const c = a.color || C("#333"), lw = a.lw ?? 3, ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(10, lw * 4.2) * 0.7;
  P.dashed(a.x1, a.y1, a.x2 - Math.cos(ang) * L, a.y2 - Math.sin(ang) * L, c, lw, 10);
  arrowHead(P, a.x1, a.y1, a.x2, a.y2, c, lw);
});
def("Diagram", "biarrow", "x1 y1 x2 y2 [color] [lw]", "line with arrow heads on BOTH ends", (a, P) => {
  const c = a.color || C("#333"), lw = a.lw ?? 3, ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(10, lw * 4.2) * 0.7, ca = Math.cos(ang), sa = Math.sin(ang);
  P.line(a.x1 + ca * L, a.y1 + sa * L, a.x2 - ca * L, a.y2 - sa * L, c, lw);
  arrowHead(P, a.x1, a.y1, a.x2, a.y2, c, lw); arrowHead(P, a.x2, a.y2, a.x1, a.y1, c, lw);
});
def("Diagram", "browser", "x y w h [str] [fill]", "web browser window mock-up. str = address text, fill = page color. x,y = top-left", (a, P) => {
  const f = a.fill || WHITE(), ln = C("#9aa5b1"), bar = C("#e9edf2");
  P.rrect(a.x + 4, a.y + 6, a.w, a.h, 10, BLACK(0.12));
  P.rrect(a.x, a.y, a.w, a.h, 10, f);
  P.rrect(a.x, a.y, a.w, 36, 10, bar); P.rect(a.x, a.y + 20, a.w, 16, bar);
  P.line(a.x, a.y + 36, a.x + a.w, a.y + 36, ln, 1.5);
  [C("#ff5f57"), C("#febc2e"), C("#28c840")].forEach((c, i) => P.circle(a.x + 18 + i * 20, a.y + 18, 6, c));
  P.rrect(a.x + 84, a.y + 8, Math.max(40, a.w - 100), 20, 10, WHITE(), C("#cfd6dd"), 1.5);
  P.text(a.str || "example.com", a.x + 98, a.y + 11, 14, C("#556270"), false, "left");
  P.rrect(a.x, a.y, a.w, a.h, 10, null, ln, 2.5);
});
def("Diagram", "button", "cx cy w h str [fill] [textcolor]", "glossy UI button with text. cx,cy = center", (a, P) => {
  const f = a.fill || C("#2e86de"), x = a.cx - a.w / 2, y = a.cy - a.h / 2, r = Math.min(16, a.h / 3);
  P.rrect(x + 2, y + 4, a.w, a.h, r, BLACK(0.2));
  P.rrect(x, y, a.w, a.h, r, P.linGrad(0, y, 0, y + a.h, [[0, shade(f, 0.18)], [1, shade(f, -0.12)]]), shade(f, -0.4), 2);
  P.rrect(x + 4, y + 3, a.w - 8, a.h * 0.4, r, WHITE(0.18));
  fitText(P, a.str, a.cx, a.cy, a.w, a.h, a.textcolor || autoText(f), 30);
});

// ---------------- CHARTS ----------------
def("Charts", "donutchart", "cx cy r items...", "donut chart with total in the middle and a legend. items = label value label value ...", (a, P) => {
  const data = labelValues(a.items, "donutchart"), total = data.reduce((s, d) => s + d[1], 0);
  if (!(total > 0)) throw new Error("donutchart values must add up to more than 0");
  let ang = -90;
  data.forEach(([lab, v], i) => {
    const sw = (v / total) * 360, c = PALETTE[i % PALETTE.length], n = Math.max(4, Math.ceil(sw / 4)), outer = [], inner = [];
    for (let k = 0; k <= n; k++) {
      const t = ((ang + (sw * k) / n) * Math.PI) / 180;
      outer.push([a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)]); inner.push([a.cx + a.r * 0.58 * Math.cos(t), a.cy + a.r * 0.58 * Math.sin(t)]);
    }
    P.poly([...outer, ...inner.reverse()], c, WHITE(), 2.5);
    if (sw > 20) { const m = ((ang + sw / 2) * Math.PI) / 180; P.text(Math.round((v / total) * 100) + "%", a.cx + a.r * 0.79 * Math.cos(m), a.cy + a.r * 0.79 * Math.sin(m) - 9, 16, WHITE(), true, "center"); }
    ang += sw;
  });
  P.text(String(Math.round(total * 100) / 100), a.cx, a.cy - a.r * 0.17, a.r * 0.34, C("#222"), true, "center");
  const lx = a.cx + a.r + 30, ly = a.cy - (data.length * 30) / 2;
  data.forEach(([lab, v], i) => {
    P.rect(lx, ly + i * 30, 18, 18, PALETTE[i % PALETTE.length], shade(PALETTE[i % PALETTE.length], -0.3), 1.5);
    P.text(`${lab} (${Math.round(v * 100) / 100})`, lx + 28, ly + i * 30 - 1, 17, C("#222"), false, "left");
  });
});
def("Charts", "hbarchart", "x y w h style items...", "horizontal bar chart. style = a color name or multi. items = label value label value ...", (a, P) => {
  const data = labelValues(a.items, "hbarchart"), top = niceTop(Math.max(...data.map((d) => d[1])));
  const labW = Math.min(a.w * 0.35, Math.max(...data.map((d) => P.measure(d[0], 16, false))) + 14), px = a.x + labW, pw = a.w - labW - 56, slot = a.h / data.length, bh = Math.min(slot * 0.62, 44);
  const one = a.style && a.style !== "multi" ? C(a.style) : null;
  for (let i = 0; i <= 4; i++) P.line(px + (pw * i) / 4, a.y, px + (pw * i) / 4, a.y + a.h, i === 0 ? C("#444") : C("#d5dbe1"), i === 0 ? 2.5 : 1.2);
  data.forEach(([lab, v], i) => {
    const c = one || PALETTE[i % PALETTE.length], y = a.y + slot * i + (slot - bh) / 2, bw = (pw * v) / top;
    P.rect(px, y, bw, bh, c, shade(c, -0.3), 1.5);
    P.text(lab, px - 8, y + bh / 2 - 8, 16, C("#333"), false, "right");
    P.text(String(Math.round(v * 100) / 100), px + bw + 8, y + bh / 2 - 9, 17, C("#222"), true, "left");
  });
});
def("Diagram", "timeline", "x y w items...", "horizontal timeline. items = one label per milestone (use | for 2 lines)", (a, P) => {
  const n = a.items.length;
  if (!n) throw new Error("timeline needs at least 1 label after w");
  P.line(a.x, a.y, a.x + a.w, a.y, C("#455a64"), 6);
  a.items.forEach((lab, i) => {
    const px = a.x + (a.w * (i + 0.5)) / n, up = i % 2 === 0, lines = String(lab).split(/\||\\n/).length, size = 18;
    P.line(px, a.y, px, a.y + (up ? -34 : 34), C("#90a4ae"), 2.5);
    P.text(lab, px, up ? a.y - 40 - lines * size * 1.2 : a.y + 40, size, C("#222"), true, "center");
    P.circle(px, a.y, 12, PALETTE[i % PALETTE.length], WHITE(), 3.5);
  });
});

// short names people use
Object.assign(ALIASES, {
  ape: "monkey", gorilla: "monkey", crocodile2: "crocodile", alligator: "crocodile", gecko: "snake", python: "snake", cobra: "snake",
  martian: "alien", chest: "treasure", magicwand: "wand", crystal: "crystalball", grape: "grapes", egg: "friedegg",
  bulb: "lightbulb", idea: "lightbulb", mail: "envelope", letter: "envelope", jewel: "gem", shirt: "tshirt", tee: "tshirt",
  lorry: "truck", police: "policecar", cop: "policecar", auto: "rickshaw", tuktuk: "rickshaw", cruise: "ship", ferry: "ship",
  tajmahal: "taj", clocktower: "bigben", kabah: "kaaba", kaba: "kaaba", leaning: "pisa", pisatower: "pisa", farmhouse: "barn",
  cherryblossom: "sakura", twister: "tornado", northernlights: "aurora", spiralgalaxy: "galaxy", boulder: "rock", stone: "rock",
  plus: "cross", cog: "gear", starburst: "burst", sunburst: "rays", polka: "dots", checkerboard: "checker", spotlight: "beam",
  database: "cylinder", db: "cylinder", dashedarrow: "dasharrow", doublearrow: "biarrow", stickynote: "note", gaugechart: "gauge",
  donut_chart: "donutchart", hbar: "hbarchart", user: "actor", bat_ball: "cricket", sticker: "badge", ribbon: "banner",
});
// =====================================================================
// PART 3d - PAINT_HELP : the full list the AI reads before it draws
// =====================================================================
const HELP_INTRO = `PAINT COMMAND LIST
You draw by writing a SCRIPT: one command per line, values separated by spaces. Then you call the draw tool ONCE with the whole script.

BASICS
- Optional first line: canvas 800 600   (width height, default 800 600, max 2000). x goes RIGHT, y goes DOWN, (0,0) = top-left corner.
  Variables you can use in math: W and H (canvas width and height), CX and CY (center). Keep every coordinate inside the canvas.
- Later lines are painted ON TOP of earlier lines. So draw: background first, then far things, ground, scenery, the main subject, small details, text last.
- Colors: any CSS name (red skyblue gold hotpink darkgreen orange brown gray white black navy teal coral crimson lime ...) plus these extra names:
  skin skin2 skin3 darkbrown wood brick grass leaf sand cream rose mint blonde ginger glass water night sunyellow steel peach.
  Or hex: #ff8800 . Add + to make lighter and - to make darker (red+  blue--). Add @ for see-through: black@0.3 . "none" = no color (no fill / no outline).
- Text that has spaces MUST be in "double quotes". Inside text, | means a new line. Example: textc "Hello world" 400 40 48 white
- A _ skips an optional value and keeps its default. Example: person 300 520 220 _ red   (default mood, red shirt)
- Math goes in {curly braces}: {W/2}  {x+10}  {sin(30)*50}  {rnd(0,W)}  {i*80+40}. Functions: sin cos tan (degrees) sqrt abs min max floor round rnd pow, and pi.
- Variables:  let size = 40   then use {size}  or just  size  inside math.
- Loops:      repeat 8 i      (i counts 0,1,2,...7. You can name it: repeat 8 k)
                 circle {60+i*90} 300 {20+i*3} gold
              end            (every repeat MUST have its own end line)
- Comment lines start with # or //. Put exactly one command on each line, no commas needed.

HOW TO MAKE A BEAUTIFUL PICTURE
1. Pick a canvas and a background: sky (day sunset night dawn cloudy), bggrad top bottom, or bg color.
2. Far things: stars, sun, moon, cloud, mountain, hill, rainbow.
3. Ground: grass, sea, ground, road.
4. Scenery: tree pine palm bush house building castle fence streetlight flag.
5. The MAIN subject: make it BIG and put it in the middle (use at least half of the picture height). Use the ready-made commands below.
6. Details: flower bird butterfly sparkle glow shadow (put a shadow under objects), fireworks confetti, and a title or text.
7. Use many different colors, lighter + and darker - versions for depth, and glow / gradients for atmosphere.

WHAT TO USE FOR WHAT PEOPLE ASK
- boy girl kid man woman person -> person (whole body) or face (big cartoon head, set mood). smiley / emoji -> face.
- cat dog -> cat dog (whole animal) or catface dogface (head only). fish bird butterfly -> fish bird butterfly.
- house home -> house.  city skyline -> repeat + building.  castle -> castle.  tent -> tent.  windmill lighthouse -> windmill lighthouse.
- car bus boat plane rocket ufo balloon -> the command with that name. planet earth moon sun stars -> space commands.
- flowchart / diagram -> pill box diamond node arrow elbow elbowv.   chart / graph -> barchart linechart piechart (+ grid).
- cake icecream apple pizza -> food commands.  snowman robot gift trophy clock crown laptop umbrella campfire -> objects.
- Anything NOT in the list: build it from shapes (circle ellipse rect rrect tri poly blob curve arc pie star heart line), big, colorful, drawn back to front.

COMMANDS  (name, then its values.  [value] = optional.  name... = a list of many values)`;

const HELP_EXAMPLES = `

EXAMPLE SCRIPTS (copy the style; make yours bigger and more detailed when the user asks for a complex picture)

--- Example 1: rocket in space ---
canvas 800 600
bggrad #050a2a #2a1a5e
stars 150
planet 660 120 75 orchid gold
moon 110 100 45
glow 400 470 190 orange@0.45
rocket 400 330 220
sparkle 230 210 14
sparkle 610 400 10
sparkle 160 440 9
title "Blast off!" white 54

--- Example 2: big laughing kid on a sunny day ---
canvas 800 600
sky day
sun 690 90 55
cloud 130 100 190
cloud 400 60 140
grass 470
flower 90 520 16 pink
flower 700 520 16 yellow
flower 170 560 14 white
flower 625 565 14 hotpink
shadow 400 575 150 20 0.3
line 300 520 215 420 dodgerblue 60
line 500 520 585 420 dodgerblue 60
circle 205 405 26 skin
circle 595 405 26 skin
ellipse 400 540 110 140 dodgerblue
ellipse 400 470 62 28 dodgerblue+
face 400 270 150 laugh skin darkbrown
text "HA HA!" 30 290 56 tomato
text "HEE HEE!" 560 280 48 deeppink

--- Example 3: house, trees and mountains ---
canvas 800 600
sky day
sun 110 90 50
cloud 420 90 200
cloud 650 150 150
mountain 190 400 380 220 slategray
mountain 520 400 440 250 steelblue
hill 650 430 500 90 forestgreen
grass 400
tree 90 500 190
pine 720 480 160
house 270 290 260 190
bush 240 480 70
bush 570 480 80
fence 30 560 190
flower 560 530 14 hotpink
flower 610 560 12 yellow
bird 480 130 18
bird 540 160 14
person 640 540 170 smile #8e44ad

--- Example 4: flowchart ---
canvas 800 600
bg #f7f9fc
title "Login Flow" #1d2733 40
pill 300 80 200 56 "Start" #a5d6a7
arrow 400 136 400 176
box 300 176 200 66 "Enter|password" skyblue
arrow 400 242 400 292
diamond 400 352 230 120 "Correct?"
arrow 400 412 400 462
pill 300 462 200 56 "Welcome!" #a5d6a7
text "Yes" 412 424 22 #2e7d32
line 515 352 650 352 #c62828 4
line 650 352 650 209 #c62828 4
arrow 650 209 500 209 #c62828 4
text "No" 560 322 22 #c62828

--- Example 5: bar chart ---
canvas 800 600
bg white
title "Sales per Month" #222 40
grid 60 90 700 440 40
barchart 60 100 700 430 multi Jan 12 Feb 19 Mar 8 Apr 25 May 17

--- Example 6: night city (loops and random) ---
canvas 800 600
sky night
moon 650 100 60
seed 7
repeat 8 i
  building {20+i*95} {rnd(250,420)} 85 400 #34495e
end
repeat 6 k
  sparkle {rnd(30,770)} {rnd(30,200)} {rnd(6,12)}
end
road 520 80
car 250 580 190 tomato
car 600 540 170 gold
streetlight 420 520 150`;

function buildHelp() {
  const L = [HELP_INTRO];
  for (const g of GROUPS) {
    L.push("", `== ${g} ==`);
    for (const c of CMDS.values()) if (c.group === g) L.push(`${c.name} ${c.sig}`.trim() + "   -- " + c.desc);
  }
  const by = {};
  for (const [k, v] of Object.entries(ALIASES)) if (CMDS.has(v)) (by[v] ||= []).push(k);
  L.push("", "Other names that also work: " + Object.entries(by).map(([v, ks]) => `${ks.join("/")} = ${v}`).join(", ") + ".");
  L.push("Special lines (not in the table above): canvas W H, let name = value, repeat N [var] ... end.");
  return L.join("\n") + HELP_EXAMPLES;
}
export const PAINT_HELP = buildHelp();