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