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