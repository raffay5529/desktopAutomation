// join.js - builds paint.js from your parts.
// Put your parts next to this file, named like:
//   p1.js  p2.js  p3.js  p4.js  p5.js  p6.js
// (paint_p4.js, paint_p5.js, paint_p6.js, P4.js, P5.js, P6.js etc. also work; upper/lower case doesn't matter)
// Run:  node join.js     -> writes paint.js
import fs from "node:fs";

const files = fs.readdirSync(".");

// find a file by any of the candidate names (case-insensitive)
const find = (...names) => {
  for (const n of names) {
    const hit = files.find((f) => f.toLowerCase() === n.toLowerCase());
    if (hit) return hit;
  }
  return null;
};

const rd = (label, required, ...names) => {
  const f = find(...names);
  if (!f) {
    if (required) {
      throw new Error(`Missing ${label}. Looked for: ${names.join(", ")}\nFiles here: ${files.join(", ")}`);
    }
    console.warn(`WARNING: ${label} not found (looked for ${names.join(", ")}) - skipping it.`);
    return "";
  }
  console.log(`using ${f} for ${label}`);
  return fs.readFileSync(f, "utf8");
};

const p1 = rd("part 1", true, "p1.js", "paint_p1.js");
const p2 = rd("part 2", true, "p2.js", "paint_p2.js");
const p3 = rd("part 3", true, "p3.js", "paint_p3.js");
const p4 = rd("part 4", false, "p4.js", "paint_p4.js");
const p5 = rd("part 5", false, "p5.js", "paint_p5.js");
const p6 = rd("part 6", false, "p6.js", "paint_p6.js");

const at = p3.indexOf("// PART 3d");
if (at < 0) throw new Error('p3.js has no "// PART 3d" line - is p3.js the third part?');
const cut = p3.lastIndexOf("// ====", at); // the ===== line just above "PART 3d"

// Parts 4, 5 and 6 only add commands, so they go before "PART 3d"
// (which has to come last, after every command is defined).
const out = [p1, p2, p3.slice(0, cut), p4, p5, p6, p3.slice(cut)].join("\n");

fs.writeFileSync("paint.js", out);
console.log("paint.js written,", out.length, "characters");