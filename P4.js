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