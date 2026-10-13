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