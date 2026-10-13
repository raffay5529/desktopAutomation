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