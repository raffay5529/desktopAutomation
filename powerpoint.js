// powerpoint.js - builds a DESIGNED PowerPoint (.pptx) file from a short "slide script".
// Used by agent-cmd.js (tool: create_powerpoint).
// Needs: npm install pptxgenjs        (nothing else: the gradient backgrounds are drawn by this file itself)
//
// Like word.js it makes a real file, saves it on the Desktop and opens it. It does NOT type into PowerPoint,
// does not move the mouse and does not take over the keyboard, so the PC never feels stuck.
//
// DESIGN STYLES (v2): every theme is now a complete design language, not only a colour set.
//   executive  sharp boxes, thin rules, dark cover + light content slides      (board, strategy, finance)
//   luxury     black/dark, gold hairlines, double frame, spaced capitals       (premium brands, galas)
//   elegant    ivory, serif type, soft line-art arcs, italic subtitles         (weddings, art, culture)
//   academic   white, serif type, double rules, roman/plain numbers            (thesis, research, lectures)
//   minimal    white, one accent colour, huge type, no boxes                   (startups, studios)
//   modern     the original gradient + glow + rounded-card look                (tech, kids, marketing)
// A theme = a style + a colour palette. "style:" in the header can switch the style of any theme.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { exec } from "node:child_process";

// ======================================================================
//  Sizes (LAYOUT_WIDE = 13.333 x 7.5 inch, the normal PowerPoint 16:9 size)
// ======================================================================
const W = 13.333;
const H = 7.5;
const MX = 0.8; // left/right margin
const CW = W - 2 * MX; // content width
const TOP = 1.95; // content starts here (below the title)
const BOTTOM = 6.65; // content ends here

// Fonts that exist on every Windows + Office install
const FONTS = [
  "Calibri", "Arial", "Cambria", "Georgia", "Trebuchet MS", "Segoe UI", "Century Schoolbook", "Bookman Old Style",
  "Times New Roman", "Verdana", "Tahoma", "Palatino Linotype", "Century Gothic", "Impact", "Arial Black", "Consolas",
];

// Average character width as a part of the font size (used to guess how much text fits in a box)
const FONT_W = {
  Calibri: 0.49, Arial: 0.55, Cambria: 0.53, Georgia: 0.56, "Trebuchet MS": 0.54, "Segoe UI": 0.53,
  "Century Schoolbook": 0.58, "Bookman Old Style": 0.6, "Times New Roman": 0.5, Verdana: 0.62, Tahoma: 0.52,
  "Palatino Linotype": 0.54, "Century Gothic": 0.6, Impact: 0.46, "Arial Black": 0.68, Consolas: 0.55,
};

// ======================================================================
//  STYLES - the design language (how titles, cards, numbers, tables, covers and footers look)
// ======================================================================
const STYLES = {
  executive: {
    mood: "formal business: sharp boxes, thin rules, dark cover with light content slides",
    fonts: ["Calibri", "Calibri"],
    deco: "bar", card: "sharp", edge: "top", r: 0, marker: "square", numFmt: "01", numBold: true, flush: true,
    head: "fill", table: "fill", bullets: "cards", flatBg: true, frame: false, arcs: false,
    caps: false, cs: 0, align: "left", titleMax: 34, titleBold: true, footRule: true, footCaps: true,
    cover: "split", palette: "tone", statRule: false, quoteCenter: false, statBar: true, dot: "square", numAccent: true,
  },
  luxury: {
    mood: "dark and rich: gold hairlines, double frame, spaced capitals, roman numerals",
    fonts: ["Palatino Linotype", "Calibri"],
    deco: "gold", card: "outline", edge: "none", r: 0, marker: "text", numFmt: "I", numBold: false, flush: false,
    head: "line", table: "rules", bullets: "list", flatBg: false, frame: true, arcs: false,
    caps: true, cs: 3, align: "center", titleMax: 30, titleBold: false, footRule: false, footCaps: true,
    cover: "frame", palette: "tone", statRule: true, quoteCenter: true, statBar: false, dot: "diamond", numAccent: false,
  },
  elegant: {
    mood: "soft and refined: ivory paper, serif type, thin line-art circles, italic subtitles",
    fonts: ["Georgia", "Calibri"],
    deco: "short", card: "round", edge: "none", r: 0.1, marker: "ring", numFmt: "01", numBold: false, flush: false,
    head: "line", table: "rules", bullets: "list", flatBg: true, frame: false, arcs: true,
    caps: false, cs: 0, align: "left", titleMax: 36, titleBold: false, footRule: false, footCaps: false,
    cover: "arcs", palette: "tone", statRule: true, quoteCenter: true, statBar: false, dot: "circle", numAccent: false, hlItalic: true,
  },
  academic: {
    mood: "scholarly: white page, serif type, double rules, plain numbers, source lines",
    fonts: ["Cambria", "Cambria"],
    deco: "dbl", card: "outline", edge: "left", r: 0, marker: "text", numFmt: "1", numBold: false, flush: false,
    head: "line", table: "rules", bullets: "list", flatBg: true, frame: false, arcs: false,
    caps: false, cs: 0, align: "left", titleMax: 34, titleBold: true, footRule: true, footCaps: false,
    cover: "rules", palette: "tone", statRule: true, quoteCenter: false, statBar: true, dot: "square", numAccent: false,
  },
  minimal: {
    mood: "clean and airy: white space, one accent colour, big type, no boxes",
    fonts: ["Calibri", "Calibri"],
    deco: "mark", card: "ruled", edge: "none", r: 0, marker: "text", numFmt: "01", numBold: true, flush: false,
    head: "line", table: "rules", bullets: "list", flatBg: true, frame: false, arcs: false,
    caps: false, cs: 0, align: "left", titleMax: 38, titleBold: true, footRule: false, footCaps: false,
    cover: "minimal", palette: "tone", statRule: false, quoteCenter: false, statBar: true, dot: "circle", numAccent: true,
  },
  modern: {
    mood: "colourful: gradient backgrounds, soft glow, rounded cards, numbered circles",
    fonts: ["Calibri", "Calibri"],
    deco: "short", card: "round", edge: "none", r: 0.2, marker: "circle", numFmt: "1", numBold: true, flush: false,
    head: "fill", table: "fill", bullets: "cards", flatBg: false, frame: false, arcs: false,
    caps: false, cs: 0, align: "left", titleMax: 36, titleBold: true, footRule: false, footCaps: false,
    cover: "orb", palette: "hues", statRule: false, quoteCenter: false, statBar: false, dot: "circle", numAccent: false,
  },
};
const STYLE_ORDER = ["executive", "luxury", "elegant", "academic", "minimal", "modern"];

// ======================================================================
//  THEMES - a style + a colour palette (+ optional fonts). Only bg, bg2 (gradient end), accent, accent2
//  are given. All other colours are worked out from them so the text is always readable.
//  "paper" / "paper2" = a light background for the content slides while cover, section, quote and
//  closing slides stay dark (bg / bg2). Without paper the whole deck uses bg / bg2.
// ======================================================================
const THEMES = {
  // ---- executive ----
  executive: { style: "executive", bg: "0B2545", bg2: "13315C", paper: "F4F6FA", paper2: "E7ECF4", accent: "2F7DD1", accent2: "C8A24A", art: "none", mood: "board, strategy, finance, consulting (navy + blue)" },
  corporate: { style: "executive", bg: "0E3B43", bg2: "16545E", paper: "F2F8F7", paper2: "E0EEEC", accent: "1C9C8C", accent2: "E9A23B", art: "none", mood: "business, operations, health, sustainability (deep teal)" },
  charcoal: { style: "executive", bg: "18181B", bg2: "27272A", paper: "F5F5F6", paper2: "E6E6E8", accent: "DC2626", accent2: "71717A", art: "none", mood: "bold sales, tech, sports, engineering (black + red)" },
  slate: { style: "executive", bg: "111827", bg2: "273244", paper: "F3F4F6", paper2: "E5E7EB", accent: "F59E0B", accent2: "34D399", art: "none", mood: "engineering, reports, planning (slate + amber)" },
  paper: { style: "executive", bg: "F8FAFC", bg2: "E5ECF6", accent: "2563EB", accent2: "0EA5E9", art: "none", mood: "clean school or office project, all light (white + blue)" },
  // ---- luxury ----
  luxury: { style: "luxury", bg: "0A0A0A", bg2: "1C1710", accent: "C9A24D", accent2: "E8D5A3", art: "vignette", mood: "premium brands, jewelry, fashion, real estate, awards (black + gold)" },
  emerald: { style: "luxury", bg: "06201A", bg2: "0E3A2E", accent: "D4AF37", accent2: "F1E3B0", art: "vignette", mood: "hospitality, wealth, premium nature (dark green + gold)" },
  bordeaux: { style: "luxury", bg: "1E0710", bg2: "3B0F1E", accent: "D9A38F", accent2: "F2D4C2", art: "vignette", mood: "wine, beauty, fashion, events (wine red + rose gold)" },
  royal: { style: "luxury", bg: "170D2E", bg2: "2D1A5E", accent: "FBBF24", accent2: "C084FC", art: "vignette", mood: "finance, history, ceremony, awards (purple + gold)" },
  crimson: { style: "luxury", bg: "1A0910", bg2: "3D0F1C", accent: "F5B942", accent2: "FB7185", art: "vignette", mood: "bold and elegant: gala, politics, sports (dark red + gold)" },
  // ---- elegant ----
  elegant: { style: "elegant", bg: "F8F4EC", bg2: "EDE4D3", accent: "8C6A43", accent2: "5E6B52", art: "none", mood: "weddings, art, culture, editorial, hospitality (ivory + bronze)" },
  blush: { style: "elegant", bg: "FCF3F1", bg2: "F4DEDB", accent: "A14D5E", accent2: "C98B8B", art: "none", mood: "beauty, wellness, fashion, weddings (soft rose + wine)" },
  sage: { style: "elegant", bg: "F3F6F0", bg2: "DFE8D6", accent: "4F6F52", accent2: "A98467", art: "none", mood: "wellness, nature, education, organic (soft green + clay)" },
  sand: { style: "elegant", bg: "F6EEE2", bg2: "E9D9BF", accent: "B4501E", accent2: "7C6A3C", art: "none", mood: "culture, history, travel, design (warm sand + terracotta)" },
  mint: { style: "elegant", bg: "EFFCF6", bg2: "CDF3E3", accent: "0F9F8A", accent2: "2E9E5B", art: "none", mood: "food, health, kids, wellness (light mint)" },
  // ---- academic ----
  academic: { style: "academic", bg: "FBFAF7", bg2: "F0ECE2", accent: "7B1E2B", accent2: "1F3A5F", art: "none", mood: "thesis, research, lectures, university (white + burgundy)" },
  scholar: { style: "academic", bg: "FFFFFF", bg2: "F1F4F9", accent: "1F3A5F", accent2: "9A6B1F", art: "none", mood: "science, law, medicine, conferences (white + navy)" },
  // ---- minimal ----
  minimal: { style: "minimal", bg: "FFFFFF", bg2: "F4F4F5", accent: "E4572E", accent2: "111827", art: "none", mood: "startups, product, design, clean pitches (white + orange)" },
  mono: { style: "minimal", bg: "FAFAFA", bg2: "EEEEEE", accent: "111111", accent2: "6B7280", art: "none", mood: "photography, architecture, studio, portfolio (black and white)" },
  // ---- modern (the original look) ----
  midnight: { style: "modern", bg: "0B1220", bg2: "1B2A4E", accent: "38BDF8", accent2: "818CF8", titleFont: "Calibri", bodyFont: "Calibri", art: "glow", cover: "orb", mood: "tech, AI, software (dark blue glow)" },
  ocean: { style: "modern", bg: "06283D", bg2: "0B5D75", accent: "2DD4BF", accent2: "38BDF8", titleFont: "Trebuchet MS", bodyFont: "Calibri", art: "rings", cover: "center", mood: "water, travel, environment (deep teal)" },
  forest: { style: "modern", bg: "0A2118", bg2: "15432F", accent: "A3E635", accent2: "34D399", titleFont: "Cambria", bodyFont: "Calibri", art: "dots", cover: "center", mood: "nature, science, farming (dark green)" },
  neon: { style: "modern", bg: "07060F", bg2: "1A0B3B", accent: "22D3EE", accent2: "F472B6", titleFont: "Arial", bodyFont: "Arial", art: "grid", cover: "orb", mood: "gaming, cyber, music, future tech (cyan + pink)" },
  sunset: { style: "modern", bg: "FFF3EA", bg2: "FFD8C2", accent: "E8501F", accent2: "F59E0B", titleFont: "Georgia", bodyFont: "Calibri", art: "rings", cover: "orb", mood: "marketing, events, creative (light orange)" },
  candy: { style: "modern", bg: "FFF1F7", bg2: "EBDDFF", accent: "DB2777", accent2: "7C3AED", titleFont: "Trebuchet MS", bodyFont: "Calibri", art: "dots", cover: "orb", mood: "kids, fun, parties, social media (pink + violet)" },
};
// used when the AI gives no theme at all
const AUTO_THEMES = ["executive", "elegant", "academic", "minimal", "midnight", "ocean", "slate", "paper", "scholar", "corporate"];

const THEME_HELP = STYLE_ORDER.map((sn) => {
  const list = Object.entries(THEMES).filter(([, v]) => v.style === sn).map(([k, v]) => `    ${k} = ${v.mood}`);
  return `  ${sn.toUpperCase()} design (${STYLES[sn].mood}):\n${list.join("\n")}`;
}).join("\n");

// ======================================================================
//  The text the AI reads together with the create_powerpoint tool description
// ======================================================================
export const POWERPOINT_HELP =
  "\n\nWrite the deck as a SLIDE SCRIPT (plain text, use real new lines). The program does all the design " +
  "(colours, fonts, shapes, backgrounds, numbered markers, layout), so NEVER write colours, fonts or sizes per slide.\n\n" +
  "HEADER (first lines, before the first slide):\n" +
  "theme: executive   CHOOSE the theme that fits the topic AND the audience. Every theme is a complete DESIGN (style + colours + fonts), " +
  "so a different topic must get a different theme. For business, formal, academic, premium or wedding topics use executive, luxury, elegant, academic or minimal themes. " +
  "Themes:\n" + THEME_HELP + "\n" +
  "style: luxury      optional. Keeps the colours of the theme but switches the design style (" + STYLE_ORDER.join(" | ") + "). Use it only if the user asks for a design style.\n" +
  "accent: F59E0B     optional 6-digit hex colour, ONLY if the user asked for specific colours (also: accent2, bg, bg2). The text colours adapt by themselves.\n" +
  "fonts: Cambria / Calibri   optional (title font / body font). Allowed: " + FONTS.join(", ") + "\n" +
  "cover: split | frame | arcs | rules | minimal | orb | center     art: glow | vignette | dots | grid | rings | diagonal | none     (optional, the theme already has good defaults)\n" +
  "footer: text | none   optional small line at the bottom of every slide (default: the deck title)\n\n" +
  "SLIDES: every slide starts with a line  === type  followed by 'key: value' lines.\n" +
  "=== title        the FIRST slide.  title: ...  subtitle: ...  author: ...  date: ...  org: company or university (optional)\n" +
  "=== section      divider between parts.  title: ...  subtitle: ...\n" +
  "=== agenda       title: ...  then 3 to 6 lines:  item: Heading | one-line detail     (agenda, contents, outline)\n" +
  "=== bullets      title: ...  then 2 to 6 lines:  - Short point   or   - Heading | one-line detail\n" +
  "=== cards        title: ...  then 2 to 4 lines:  card: Heading | short item | short item | short item\n" +
  "=== stats        title: ...  then 2 to 4 lines:  stat: 85% | what it means | source and year (optional)\n" +
  "=== steps        title: ...  then 3 to 5 lines:  step: Heading | one-line detail   (numbered cards)\n" +
  "=== process      title: ...  then 3 to 5 lines:  step: Heading | one-line detail   (arrow chevrons: a flow, pipeline or method)\n" +
  "=== timeline     title: ...  then 3 to 6 lines:  event: 2021 | Heading | one-line detail   (dates, milestones, history, roadmap)\n" +
  "=== two          title: ...  left: Heading  (then '- ' lines)  right: Heading  (then '- ' lines). For pros/cons, before/after, A vs B.\n" +
  "=== table        title: ...  then a Markdown table (| A | B |, a |---|---| line, rows). Max 7 rows, 5 columns.  source: ... (optional)\n" +
  "=== chart        title: ...  type: bar | hbar | stacked | line | area | pie | doughnut   labels: 2021, 2022, 2023   Series name: 10, 20, 30\n" +
  "                 optional: note: one key insight shown next to the chart   xlabel: ...   ylabel: ...   source: ...\n" +
  "                 every series line must have exactly as many plain numbers as labels. pie: 'labels: A, B, C' and ONE line 'Share: 50, 30, 20'.\n" +
  "=== quote        quote: the sentence   by: Name   role: who they are (optional)\n" +
  "=== statement    text: ONE big sentence (put **two words** in stars to highlight them)   sub: small line under it (optional)\n" +
  "=== closing      the LAST slide.  title: Thank you   subtitle: ...   contact: email | website (optional)\n" +
  "Any slide can also have:  notes: one or two sentences the speaker can say.\n" +
  "In any slide TITLE you may put one or two words in stars to colour them with the accent colour, like  title: Our **Core** Values  (use it on some slides, not all).\n\n" +
  "RULES:\n" +
  "- Typical deck: 8 to 12 slides (use the number the user asks for). Order: title, agenda or short overview, content slides, closing.\n" +
  "- VARY the slide types: use agenda, bullets, cards, stats, steps, process, timeline, two, chart, table, quote or statement. Never more than 2 slides of the same type in a row. " +
  "Use a section slide only in long decks (10+ slides).\n" +
  "- One message per slide. Short phrases, not sentences: titles max 50 characters, bullet heading max 40, bullet detail max 80, " +
  "card heading max 16, card item max 30, stat number max 8 characters (like 85%, 4x, $2.5B), step heading max 20, " +
  "agenda heading max 40, timeline date max 8 characters, timeline heading max 24, timeline detail max 70.\n" +
  "- NEVER use emojis, emoticons or decorative symbols anywhere. This is a professional deck: plain text only. " +
  "The program adds numbered markers and shapes by itself.\n" +
  "- Never invent statistics. Use only figures you are sure about and name the source and year, or leave stats out.\n" +
  "- Write all text in the language the user asks for.\n" +
  "EXAMPLE:\n" +
  "theme: executive\n=== title\ntitle: Growth **Strategy** 2027\nsubtitle: Where we invest next year\nauthor: Ali Khan\norg: Northwind Group\n" +
  "=== agenda\ntitle: Agenda\nitem: Market position | Where we stand today\nitem: Priorities | Three bets for 2027\nitem: Roadmap | Milestones and owners\n" +
  "=== process\ntitle: How we will deliver\nstep: Assess | Review markets\nstep: Build | Launch pilots\nstep: Scale | Roll out widely\n" +
  "=== chart\ntitle: Revenue keeps growing\ntype: line\nlabels: 2024, 2025, 2026\nRevenue: 50, 90, 150\nnote: Output tripled in 3 years\n" +
  "=== closing\ntitle: Thank you\nsubtitle: Questions?";

// ======================================================================
//  Small helpers: colours
// ======================================================================
const hex = (h) => String(h ?? "").replace(/^#/, "").trim().toUpperCase();
const isHex = (h) => /^[0-9A-F]{6}$/.test(hex(h));
const rgbOf = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (r, g, b) =>
  [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

function mix(a, b, k) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return toHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}

function lum(h) {
  const [r, g, b] = rgbOf(h).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  const d = mx - mn;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

// Same colour family, hue turned by "deg" degrees (used for the 2nd accent and the chart colours)
function rotateHue(h, deg) {
  const [hh, s, l] = rgb2hsl(...rgbOf(h));
  return toHex(...hsl2rgb(hh + deg, Math.max(s, 0.55), Math.min(0.62, Math.max(0.42, l))));
}

// Moves a colour towards "toward" until it has enough contrast on all the backgrounds
function readable(color, bgs, min, toward) {
  for (let k = 0; k <= 10; k++) {
    const c = mix(color, toward, k / 10);
    if (bgs.every((b) => contrast(c, b) >= min)) return c;
  }
  return toward;
}

const INK = "0F172A";
const inkOn = (fill) => (contrast("FFFFFF", fill) >= contrast(INK, fill) ? "FFFFFF" : INK);

// Turns a short theme definition into the full set of colours
function buildTheme(def) {
  const t = { ...def };
  t.bg = hex(def.bg);
  t.accent = hex(def.accent);
  t.bg2 = def.bg2 ? hex(def.bg2) : null;
  t.dark = contrast("FFFFFF", t.bg) >= contrast(INK, t.bg);
  if (!t.bg2) t.bg2 = mix(t.bg, t.accent, t.dark ? 0.2 : 0.12);
  t.accent2 = def.accent2 ? hex(def.accent2) : rotateHue(t.accent, -30);
  t.mid = mix(t.bg, t.bg2, 0.5);
  t.text = t.dark ? "F8FAFC" : INK;
  t.card = t.dark ? mix(t.mid, "FFFFFF", 0.08) : mix(t.mid, "FFFFFF", 0.78);
  t.cardLine = t.dark ? mix(t.card, "FFFFFF", 0.16) : mix(t.card, "000000", 0.12);
  t.title = t.text;
  t.muted = readable(mix(t.text, t.mid, 0.38), [t.mid, t.card], 4.6, t.text);
  t.accentInk = readable(t.accent, [t.mid, t.card], 3.5, t.dark ? "FFFFFF" : "000000");
  t.accent2Ink = readable(t.accent2, [t.mid, t.card], 3.5, t.dark ? "FFFFFF" : "000000");
  t.grid = t.dark ? mix(t.mid, "FFFFFF", 0.18) : mix(t.mid, "000000", 0.14);
  t.hair = t.dark ? mix(t.mid, "FFFFFF", 0.22) : mix(t.mid, "000000", 0.16); // thin lines between rows
  t.frameLine = mix(t.mid, t.accent, t.dark ? 0.5 : 0.42); // frames and outline boxes
  return t;
}

// Colours of the chart series
function makePalette(t, st) {
  if (st.palette === "tone") {
    // refined: the two accents, their tints and one neutral (no rainbow)
    const tint = (c, k) => mix(c, "FFFFFF", k);
    return [
      t.accent, t.accent2, tint(t.accent, 0.4), tint(t.accent2, 0.4), mix(t.accent, t.accent2, 0.5),
      tint(t.accent, 0.65), tint(t.accent2, 0.65), mix(t.text, t.mid, 0.5),
    ];
  }
  const p = [t.accent, t.accent2];
  for (const deg of [150, 210, 270, 330, 90, 30]) p.push(rotateHue(t.accent, deg));
  return p;
}

// ======================================================================
//  Background pictures (gradient + soft glows + a faint pattern), drawn here as a PNG file.
//  pptxgenjs cannot do gradients, so these slides get a picture as their background.
//  (Flat-colour backgrounds of the clean styles do not need a picture.)
// ======================================================================
const BG_W = 1280;
const BG_H = 720;

// where the glows sit and which corner holds the pattern, per kind of slide
const VARIANTS = {
  cover: { angle: 135, corner: [1, 0], glows: [[0.88, 0.1, 0.62, 0.38, "a"], [0.05, 1.0, 0.5, 0.24, "b"]] },
  content: { angle: 90, corner: [1, 0], glows: [[1.0, 0.0, 0.5, 0.2, "a"], [0.0, 1.0, 0.35, 0.1, "b"]] },
  section: { angle: 120, corner: [0, 1], glows: [[0.12, 0.45, 0.7, 0.4, "a"], [0.98, 0.95, 0.45, 0.22, "b"]] },
  statement: { angle: 100, corner: [1, 1], glows: [[0.5, 0.5, 0.75, 0.26, "a"], [0.0, 0.0, 0.4, 0.16, "b"]] },
  quote: { angle: 60, corner: [0, 0], glows: [[0.2, 0.3, 0.65, 0.3, "a"], [1.0, 1.0, 0.45, 0.18, "b"]] },
  closing: { angle: 45, corner: [0, 1], glows: [[0.5, 0.35, 0.7, 0.36, "a"], [1.0, 1.0, 0.5, 0.2, "b"]] },
};

const CRC_TABLE = (() => {
  const tab = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tab[n] = c >>> 0;
  }
  return tab;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// RGB bytes -> PNG file (Paeth filter + zlib keeps smooth gradients small)
function encodePng(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const ro = y * (stride + 1);
    raw[ro] = 4;
    for (let x = 0; x < stride; x++) {
      const cur = rgb[y * stride + x];
      const a = x >= 3 ? rgb[y * stride + x - 3] : 0;
      const b = y > 0 ? rgb[(y - 1) * stride + x] : 0;
      const c = x >= 3 && y > 0 ? rgb[(y - 1) * stride + x - 3] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[ro + 1 + x] = (cur - pred) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const bgCache = new Map();

function backgroundData(t, variant) {
  const key = [t.name, variant, t.bg, t.bg2, t.accent, t.accent2, t.art].join("|");
  if (bgCache.has(key)) return bgCache.get(key);

  const w = BG_W;
  const h = BG_H;
  const spec = VARIANTS[variant] ?? VARIANTS.content;
  const rgb = new Uint8Array(w * h * 3);
  const c1 = rgbOf(t.bg);
  const c2 = rgbOf(t.bg2);
  const cA = rgbOf(t.accent);
  const cB = rgbOf(t.accent2);
  const plain = t.art === "none";
  const strength = t.dark ? 1 : 0.7;

  // gradient direction
  const ang = (spec.angle * Math.PI) / 180;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const proj = [0, w * dx, h * dy, w * dx + h * dy];
  const pMin = Math.min(...proj);
  const pMax = Math.max(...proj);

  // "vignette" = one soft glow in the middle (used by the luxury style), "none" = a plain gradient
  const glowList = t.art === "vignette" ? [[0.5, 0.42, 0.8, 0.14, "a"]] : spec.glows;
  const glows = plain ? [] : glowList.map(([gx, gy, gr, ga, gc]) => ({ x: gx * w, y: gy * h, r: gr * w, a: ga * strength, c: gc === "a" ? cA : cB }));

  const art = t.art;
  const patOn = ["dots", "grid", "diagonal", "rings"].includes(art);
  const px = spec.corner[0] * w;
  const py = spec.corner[1] * h;
  const patR = 0.62 * w;
  const patA = t.dark ? 0.3 : 0.22;

  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = clamp01(((x * dx + y * dy) - pMin) / (pMax - pMin));
      let r = c1[0] + (c2[0] - c1[0]) * k;
      let g = c1[1] + (c2[1] - c1[1]) * k;
      let b = c1[2] + (c2[2] - c1[2]) * k;

      for (const gl of glows) {
        const ddx = x - gl.x;
        const ddy = y - gl.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) / gl.r;
        if (d < 1) {
          const a = gl.a * (1 - d) * (1 - d);
          r += (gl.c[0] - r) * a;
          g += (gl.c[1] - g) * a;
          b += (gl.c[2] - b) * a;
        }
      }

      if (patOn) {
        const ex = x - px;
        const ey = y - py;
        const dist = Math.sqrt(ex * ex + ey * ey);
        let m = 1 - dist / patR;
        if (m > 0) {
          m *= m;
          let cov = 0; // how much of this pixel the pattern covers (0..1)
          if (art === "dots") {
            const gx = (x % 34) - 17;
            const gy = (y % 34) - 17;
            cov = clamp01(2.4 - Math.sqrt(gx * gx + gy * gy));
          } else if (art === "grid") {
            const gx = x % 64;
            const gy = y % 64;
            cov = gx < 1.5 || gy < 1.5 ? 0.55 : 0;
          } else if (art === "diagonal") {
            cov = (x + y) % 30 < 2 ? 0.6 : 0;
          } else {
            const rr = dist % 90;
            cov = clamp01(2.2 - Math.min(rr, 90 - rr));
          }
          if (cov > 0) {
            const a = cov * m * patA;
            r += (cA[0] - r) * a;
            g += (cA[1] - g) * a;
            b += (cA[2] - b) * a;
          }
        }
      }

      rgb[i++] = r;
      rgb[i++] = g;
      rgb[i++] = b;
    }
  }

  const out = "image/png;base64," + encodePng(w, h, rgb).toString("base64");
  bgCache.set(key, out);
  return out;
}

// ======================================================================
//  Text helpers: emoji, fitting text into a box, right-to-left languages
// ======================================================================
// Emojis look unprofessional in a business deck, so every emoji and pictogram is removed from the text.
// (Normal symbols like (c), TM, arrows and check marks are kept.)
const EMOJI_ANY = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[\u{1F000}-\u{1FAFF}]|[\u2600-\u2712\u2719-\u27BF\u2B50\u2B55]|[\uFE0E\uFE0F\u200D\u20E3]/gu;
const stripEmoji = (s) => String(s ?? "").replace(EMOJI_ANY, "").replace(/[ \t]{2,}/g, " ");

const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const isRtl = (s) => RTL_RE.test(String(s ?? ""));

const plain = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/`/g, "").trim();

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
// The label of item number i (0-based) in a number format: "1", "01" or "I"
function numLabel(fmt, i) {
  if (fmt === "I") return ROMAN[i] ?? String(i + 1);
  if (fmt === "01") return String(i + 1).padStart(2, "0");
  return String(i + 1);
}

// How many lines will this text take in a box that is wIn inches wide?
// ex.up = the text is in capitals (wider), ex.cs = letter spacing in points
function lineCount(text, wIn, pt, font, bold, ex = {}) {
  const cw = (pt * (FONT_W[font] ?? 0.55) * (bold ? 1.07 : 1) * (ex.up ? 1.2 : 1) * 1.04 + (ex.cs ?? 0)) / 72; // inches per character
  const maxCh = Math.max(1, Math.floor((wIn * 0.96) / cw));
  let lines = 0;
  for (const para of String(text).split("\n")) {
    let cur = 0;
    lines++;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const len = [...word].length;
      if (cur === 0) cur = len;
      else if (cur + 1 + len <= maxCh) cur += 1 + len;
      else {
        lines++;
        cur = len;
      }
      while (cur > maxCh) {
        lines++;
        cur -= maxCh;
      }
    }
  }
  return lines;
}

// Biggest size (max..min) at which all paragraphs fit in w x h inches.
// paras: [{ text, bold, ratio (size relative to the base), floor (smallest allowed size), font }]
function fitParas(paras, o) {
  const lh = 1.22;
  const heightAt = (sizes) => {
    let hh = 0;
    paras.forEach((p, i) => {
      hh += (lineCount(plain(p.text), o.w, sizes[i], p.font ?? o.font, p.bold, { up: p.up ?? o.up, cs: p.cs ?? o.cs }) * sizes[i] * lh) / 72;
    });
    return hh + (((o.gap ?? 0) * (paras.length - 1)) / 72);
  };
  for (let base = o.max; base >= o.min; base--) {
    const sizes = paras.map((p) => Math.max(p.floor ?? o.min, Math.round(base * (p.ratio ?? 1))));
    const height = heightAt(sizes);
    if (height <= o.h) return { ok: true, base, sizes, height };
  }
  const sizes = paras.map((p) => Math.max(p.floor ?? o.min, Math.round(o.min * (p.ratio ?? 1))));
  return { ok: false, base: o.min, sizes, height: heightAt(sizes) };
}

function fit(text, o) {
  const r = fitParas([{ text, bold: o.bold }], o);
  return { ok: r.ok, pt: r.sizes[0], height: r.height, lines: lineCount(plain(text), o.w, r.sizes[0], o.font, o.bold, { up: o.up, cs: o.cs }) };
}

// **bold** parts become bold runs (or the highlight colour if hl is given; italic instead of bold if hlItalic)
function toRuns(text, base, hl, hlItalic) {
  const out = [];
  String(text ?? "")
    .split(/\*\*(.+?)\*\*/g)
    .forEach((part, i) => {
      if (!part) return;
      out.push({ text: part, options: { ...base, ...(i % 2 ? { ...(hlItalic ? { italic: true } : { bold: true }), ...(hl ? { color: hl } : {}) } : {}) } });
    });
  if (!out.length) out.push({ text: "", options: { ...base } });
  return out;
}

// ======================================================================
//  Drawing helpers
// ======================================================================
const SHAPES = { circle: "ellipse", round: "roundRect", rect: "rect", diamond: "diamond", chevron: "chevron", plate: "homePlate" };

function box(sl, S, kind, x, y, w, h, o = {}) {
  const type = S.pptx.ShapeType[SHAPES[kind] ?? "rect"] ?? S.pptx.ShapeType.rect;
  const opt = { x, y, w, h };
  opt.fill = o.fill ? (o.transparency ? { color: o.fill, transparency: o.transparency } : { color: o.fill }) : { type: "none" };
  opt.line = o.line ? { color: o.line, width: o.lw ?? 1 } : { type: "none" };
  if (kind === "round") opt.rectRadius = o.r ?? 0.18;
  if (o.shadow) opt.shadow = { type: "outer", color: "000000", blur: 12, offset: 3, angle: 90, opacity: 0.16 };
  sl.addShape(type, opt);
}

// A straight line (h = 0 is a horizontal line)
function hline(sl, S, x, y, w, color, pt = 1) {
  sl.addShape(S.pptx.ShapeType.line, { x, y, w, h: 0, line: { color, width: pt } });
}

// The colour behind the slide (used to "cut out" shapes that sit on lines)
const surf = (S) => (S.st.flatBg && !S.feature ? S.t.bg : S.t.mid);

// A card. The look depends on the style:
//  round   = soft rounded box (modern, elegant)        sharp = square box with an accent edge (executive)
//  outline = thin line box, no fill (luxury, academic) ruled = only an accent line on top (minimal)
function card(sl, S, x, y, w, h, o = {}) {
  const t = S.t;
  const st = S.st;
  const kind = o.kind ?? st.card;
  const edge = o.edge ?? st.edge;
  const col = o.col ?? t.accent;
  if (kind === "round") box(sl, S, "round", x, y, w, h, { fill: o.fill ?? t.card, line: t.cardLine, lw: 1, r: o.r ?? st.r ?? 0.2, shadow: !t.dark });
  else if (kind === "sharp") box(sl, S, "rect", x, y, w, h, { fill: o.fill ?? t.card, line: t.cardLine, lw: 0.75, shadow: !t.dark });
  else if (kind === "outline") box(sl, S, "rect", x, y, w, h, { line: t.frameLine, lw: 0.75 });
  else if (kind === "ruled") hline(sl, S, x, y, w, col, 2);
  if (edge === "top") box(sl, S, "rect", x, y, w, 0.07, { fill: col });
  else if (edge === "left") box(sl, S, "rect", x, y, 0.07, h, { fill: col });
}

// Text box. content = string or a list of paragraphs [{ text, pt, bold, color, font, italic, gap, bullet, cs }]
function put(sl, S, content, o) {
  const paras = Array.isArray(content) ? content : [{ text: content }];
  const rtl = paras.some((p) => isRtl(p.text));
  const runs = [];
  paras.forEach((p, pi) => {
    const base = {
      fontFace: p.font ?? o.font ?? S.t.bodyFont,
      fontSize: p.pt ?? o.pt,
      color: p.color ?? o.color ?? S.t.text,
      bold: p.bold ?? o.bold ?? false,
      italic: p.italic ?? o.italic ?? false,
    };
    const cs = p.cs ?? o.cs;
    if (cs) base.charSpacing = cs;
    const extra = {};
    const gap = p.gap ?? o.gap;
    if (gap) extra.paraSpaceAfter = gap;
    if (p.bullet) extra.bullet = { indent: 20 };
    const rr = toRuns(p.text, base, p.hl ?? o.hl, p.hlItalic ?? o.hlItalic);
    rr.forEach((r, ri) => {
      Object.assign(r.options, extra);
      if (ri === rr.length - 1 && pi < paras.length - 1) r.options.breakLine = true;
      runs.push(r);
    });
  });
  const opt = {
    x: o.x, y: o.y, w: o.w, h: o.h,
    margin: 0,
    valign: o.valign ?? "top",
    align: rtl && !o.keepAlign && (o.align ?? "left") === "left" ? "right" : o.align ?? "left",
    fontFace: o.font ?? S.t.bodyFont,
    fontSize: o.pt,
    color: o.color ?? S.t.text,
    isTextBox: true,
  };
  if (rtl) opt.rtlMode = true;
  sl.addText(runs, opt);
}

// The marker with the number of an item. Its shape comes from the style:
// circle / square (filled), ring (outline circle) or text (only the number, big)
function badge(sl, S, x, y, d, label, fill, o = {}) {
  const t = S.t;
  const kind = o.kind ?? S.st.marker;
  const ink = fill === t.accent2 ? t.accent2Ink : t.accentInk;
  if (kind === "text") {
    put(sl, S, label, {
      x: x - d / 2, y, w: d * 2, h: d, align: "center", valign: "middle", keepAlign: true,
      pt: o.pt ?? Math.round(d * 72 * 0.5), font: t.titleFont, bold: S.st.numBold, color: ink,
    });
    return;
  }
  if (kind === "ring") {
    box(sl, S, "circle", x, y, d, d, { fill: surf(S), line: fill, lw: 1.5 });
    put(sl, S, label, {
      x, y, w: d, h: d, align: "center", valign: "middle", keepAlign: true,
      pt: o.pt ?? Math.round(d * 72 * 0.36), font: t.titleFont, bold: false, color: ink,
    });
    return;
  }
  box(sl, S, kind === "square" ? "rect" : "circle", x, y, d, d, { fill });
  put(sl, S, label, {
    x, y, w: d, h: d, align: "center", valign: "middle", keepAlign: true,
    pt: o.pt ?? Math.round(d * 72 * 0.42), font: t.titleFont, bold: true, color: inkOn(fill),
  });
}

// Abstract round shape for the modern cover, section and closing slides (soft rings, a solid core, a ring and a small dot)
function orb(sl, S, cx, cy, d) {
  const t = S.t;
  box(sl, S, "circle", cx - d * 0.9, cy - d * 0.9, d * 1.8, d * 1.8, { fill: t.accent, transparency: 92 });
  box(sl, S, "circle", cx - d * 0.7, cy - d * 0.7, d * 1.4, d * 1.4, { fill: t.accent, transparency: 84 });
  box(sl, S, "circle", cx - d / 2, cy - d / 2, d, d, { fill: t.accent });
  box(sl, S, "circle", cx - d * 0.3, cy - d * 0.3, d * 0.6, d * 0.6, { line: mix(t.accent, inkOn(t.accent), 0.45), lw: 2 });
  const a = (-38 * Math.PI) / 180;
  const r = d * 0.62;
  const dd = d * 0.3;
  box(sl, S, "circle", cx + Math.cos(a) * r - dd / 2, cy + Math.sin(a) * r - dd / 2, dd, dd, { fill: t.accent2, line: t.mid, lw: 3 });
}

// Soft line-art circles (elegant style): one faint disc and several thin rings around the same centre
function arcsArt(sl, S, cx, cy, radii) {
  const t = S.t;
  radii.forEach((r, i) => {
    if (i === 0) box(sl, S, "circle", cx - r, cy - r, 2 * r, 2 * r, { fill: t.accent, transparency: 84 });
    else box(sl, S, "circle", cx - r, cy - r, 2 * r, 2 * r, { line: mix(t.mid, t.accent, Math.max(0.2, 0.52 - i * 0.08)), lw: 1 });
  });
  const r = radii[Math.min(2, radii.length - 1)];
  const a = (-38 * Math.PI) / 180;
  const dd = 0.3;
  box(sl, S, "circle", cx + Math.cos(a) * r - dd / 2, cy + Math.sin(a) * r - dd / 2, dd, dd, { fill: t.accent2, line: t.mid, lw: 3 });
}

// Grid of squares that slowly gets brighter towards one corner (executive covers and section slides)
function mosaic(sl, S, x, y, w, h, cols, rows, seed) {
  const t = S.t;
  const gap = 0.1;
  const tw = (w - gap * (cols - 1)) / cols;
  const th = (h - gap * (rows - 1)) / rows;
  const pick = (seed >>> 0) % (cols * rows); // the one tile in the second accent colour
  let r = seed >>> 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      const idx = j * cols + i;
      if (idx !== pick && (r >>> 24) % 5 === 0) continue; // a few holes
      const k = (i + (rows - 1 - j)) / Math.max(1, cols + rows - 2);
      const fill = idx === pick ? t.accent2 : mix(t.bg2, t.accent, 0.22 + 0.78 * k);
      box(sl, S, "rect", x + i * (tw + gap), y + j * (th + gap), tw, th, { fill });
    }
  }
}

// Gold line - diamond - line (luxury style)
function ornament(sl, S, cx, y, span) {
  const t = S.t;
  const d = 0.13;
  hline(sl, S, cx - span / 2, y, span / 2 - d, t.accent, 1);
  hline(sl, S, cx + d, y, span / 2 - d, t.accent, 1);
  box(sl, S, "diamond", cx - d / 2, y - d / 2, d, d, { fill: t.accent });
}

// Thin frame around the slide (luxury style); dbl = a second, thinner frame inside
function drawFrame(sl, S, dbl) {
  const t = S.t;
  box(sl, S, "rect", 0.32, 0.32, W - 0.64, H - 0.64, { line: t.frameLine, lw: 1.25 });
  if (dbl) box(sl, S, "rect", 0.44, 0.44, W - 0.88, H - 0.88, { line: t.frameLine, lw: 0.5 });
}

// Faint rings in the top right corner of content slides (elegant style)
function cornerArcs(sl, S) {
  const t = S.t;
  [0.9, 1.4, 1.9].forEach((r, i) => {
    box(sl, S, "circle", W + 0.15 - r, -0.15 - r, 2 * r, 2 * r, { line: mix(t.bg, t.accent, 0.3 - i * 0.07), lw: 1 });
  });
}

function setBg(sl, S, variant) {
  const t = S.t;
  if (S.st.flatBg && !S.feature) {
    sl.background = { color: t.bg };
    return;
  }
  try {
    sl.background = { data: backgroundData(t, variant) };
  } catch {
    sl.background = { color: t.bg };
  }
}

// Reports text that does not fit even at the smallest allowed size
function chk(S, s, what, res, advice = "") {
  if (!res.ok) S.problems.push(`Slide ${s.n} (${s.type}): ${what} is too long for its box. Shorten it${advice}.`);
}

// Footer line, deck title and slide number
function footer(sl, S) {
  const t = S.t;
  const st = S.st;
  const fy = st.frame ? 6.78 : 6.98;
  if (st.footRule) hline(sl, S, MX, fy - 0.06, CW, t.hair, 0.75);
  if (S.footer) {
    put(sl, S, st.footCaps ? S.footer.toUpperCase() : S.footer, {
      x: MX, y: fy, w: 9, h: 0.3, pt: st.footCaps ? 10 : 11, color: t.muted, valign: "middle", keepAlign: true, cs: st.footCaps ? 1.5 : 0,
    });
  }
  sl.slideNumber = {
    x: W - MX - 1, y: fy, w: 1, h: 0.3, fontFace: t.bodyFont, fontSize: 11,
    color: st.numAccent ? t.accentInk : t.muted, bold: !!st.numAccent, align: "right",
  };
}

// Title (same place and size on every content slide) + decoration + footer
function frame(sl, S, s) {
  const t = S.t;
  const st = S.st;
  setBg(sl, S, "content");
  if (st.frame) drawFrame(sl, S, false);
  if (st.arcs) cornerArcs(sl, S);

  const off = st.deco === "bar" ? 0.35 : 0;
  const tx = MX + off;
  const tw = CW - off;
  const center = st.align === "center";
  const text = st.caps ? String(s.title).toUpperCase() : s.title;
  const f = fit(plain(text), { w: tw, h: 1.0, max: st.titleMax, min: 24, font: t.titleFont, bold: st.titleBold, up: st.caps, cs: st.cs });
  chk(S, s, "the title", f, " to about 50 characters");
  put(sl, S, text, {
    x: tx, y: 0.5, w: tw, h: 1.0, pt: f.pt, font: t.titleFont, bold: st.titleBold, color: t.title, hl: t.accentInk, hlItalic: st.hlItalic,
    valign: "middle", align: center ? "center" : "left", keepAlign: center, cs: st.cs,
  });

  const dy = 1.62;
  if (st.deco === "bar") {
    box(sl, S, "rect", MX, 0.62, 0.11, 0.76, { fill: t.accent });
    hline(sl, S, MX, dy, CW, t.hair, 0.75);
  } else if (st.deco === "gold") ornament(sl, S, W / 2, dy, 1.8);
  else if (st.deco === "short") hline(sl, S, MX, dy, 1.1, t.accent, 2.5);
  else if (st.deco === "dbl") {
    hline(sl, S, MX, dy - 0.02, CW, t.accent, 2);
    hline(sl, S, MX, dy + 0.05, CW, t.text, 0.5);
  } else if (st.deco === "mark") box(sl, S, "rect", MX, 0.4, 0.7, 0.07, { fill: t.accent });
  footer(sl, S);
}

// small line under charts and tables
function sourceLine(sl, S, s) {
  if (s.source) put(sl, S, s.source, { x: MX, y: 6.52, w: CW, h: 0.32, pt: 11, color: S.t.muted, italic: true, valign: "middle" });
}

// ======================================================================
//  Cover / closing slides (one design per cover kind)
// ======================================================================
const metaOf = (s, closing, withOrg = false) =>
  closing ? (s.contact ?? []).join("      •      ") : [s.author, s.date, withOrg ? s.org : ""].filter(Boolean).join("   ·   ");

// executive: dark gradient, title on the left, a mosaic of squares on the right
function coverSplit(sl, S, s, closing) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  const px = 8.85;
  mosaic(sl, S, px, 0, W - px, H, 4, 6, S.seed + (closing ? 7 : 0));
  const x0 = 0.95;
  const tw = 7.1;
  if (S.org) put(sl, S, S.org.toUpperCase(), { x: x0, y: 0.75, w: tw, h: 0.4, pt: 13, bold: true, color: t.accentInk, cs: 3, valign: "middle" });
  const f = fit(plain(s.title), { w: tw, h: 2.8, max: 56, min: 30, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: x0, y: 1.4, w: tw, h: 2.8, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "bottom" });
  box(sl, S, "rect", x0, 4.45, 1.0, 0.08, { fill: t.accent });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.15, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 4.8, w: tw, h: 1.15, pt: sf.pt, color: t.muted, valign: "top" });
  }
  const meta = metaOf(s, closing);
  if (meta) put(sl, S, meta, { x: x0, y: 6.25, w: tw, h: 0.4, pt: 16, color: closing ? t.accentInk : t.muted, valign: "middle", bold: closing });
}

// luxury: double gold frame, everything centred, spaced capitals
function coverFrame(sl, S, s, closing) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  drawFrame(sl, S, true);
  const x0 = 1.6;
  const tw = W - 3.2;
  if (S.org) put(sl, S, S.org.toUpperCase(), { x: x0, y: 1.05, w: tw, h: 0.4, pt: 13, color: t.accentInk, align: "center", keepAlign: true, cs: 4, valign: "middle" });
  ornament(sl, S, W / 2, 1.72, 2.4);
  const title = String(s.title).toUpperCase();
  const f = fit(plain(title), { w: tw, h: 2.3, max: 50, min: 26, font: t.titleFont, bold: false, up: true, cs: 5 });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, title, { x: x0, y: 1.95, w: tw, h: 2.3, pt: f.pt, font: t.titleFont, color: t.title, hl: t.accentInk, align: "center", keepAlign: true, valign: "middle", cs: 5 });
  ornament(sl, S, W / 2, 4.5, 2.4);
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 24, min: 16, font: t.titleFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 4.78, w: tw, h: 1.0, pt: sf.pt, font: t.titleFont, italic: true, color: t.muted, align: "center", keepAlign: true, valign: "top" });
  }
  const meta = metaOf(s, closing);
  if (meta) {
    put(sl, S, closing ? meta : meta.toUpperCase(), {
      x: x0, y: 6.0, w: tw, h: 0.4, pt: 14, color: closing ? t.accentInk : t.muted, align: "center", keepAlign: true, valign: "middle", cs: closing ? 1 : 3, bold: closing,
    });
  }
}

// elegant: soft line-art circles on the right, serif title and italic subtitle on the left
function coverArcs(sl, S, s, closing) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  arcsArt(sl, S, 11.55, 3.75, [0.9, 1.6, 2.3, 3.0, 3.6]);
  const x0 = 0.95;
  const tw = 6.8;
  if (S.org) put(sl, S, S.org.toUpperCase(), { x: x0, y: 0.9, w: tw, h: 0.4, pt: 13, color: t.accentInk, cs: 4, valign: "middle" });
  const f = fit(plain(s.title), { w: tw, h: 2.6, max: 54, min: 30, font: t.titleFont, bold: false });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: x0, y: 1.5, w: tw, h: 2.6, pt: f.pt, font: t.titleFont, color: t.title, hl: t.accentInk, hlItalic: true, valign: "bottom" });
  hline(sl, S, x0, 4.4, 1.2, t.accent, 2.5);
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.1, max: 24, min: 16, font: t.titleFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 4.7, w: tw, h: 1.1, pt: sf.pt, font: t.titleFont, italic: true, color: t.muted, valign: "top" });
  }
  const meta = metaOf(s, closing);
  if (meta) put(sl, S, meta, { x: x0, y: 6.2, w: tw, h: 0.4, pt: 15, color: closing ? t.accentInk : t.muted, valign: "middle", bold: closing });
}

// academic: thick and thin rules above and below, centred serif title, author and date
function coverRules(sl, S, s, closing) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  hline(sl, S, MX, 0.9, CW, t.accent, 3);
  hline(sl, S, MX, 0.99, CW, t.text, 0.75);
  const x0 = 1.3;
  const tw = W - 2.6;
  if (S.org) put(sl, S, S.org.toUpperCase(), { x: x0, y: 1.2, w: tw, h: 0.4, pt: 14, color: t.accentInk, align: "center", keepAlign: true, cs: 2, valign: "middle" });
  const f = fit(plain(s.title), { w: tw, h: 2.4, max: 50, min: 28, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 50 characters");
  put(sl, S, s.title, { x: x0, y: 1.75, w: tw, h: 2.4, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, align: "center", keepAlign: true, valign: "middle" });
  hline(sl, S, W / 2 - 0.8, 4.35, 1.6, t.accent, 1.5);
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 4.55, w: tw, h: 1.0, pt: sf.pt, italic: true, color: t.muted, align: "center", keepAlign: true, valign: "top" });
  }
  const meta = metaOf(s, closing);
  if (meta) put(sl, S, meta, { x: x0, y: 5.8, w: tw, h: 0.45, pt: 18, bold: true, color: closing ? t.accentInk : t.text, align: "center", keepAlign: true, valign: "middle" });
  hline(sl, S, MX, 6.7, CW, t.text, 0.75);
  hline(sl, S, MX, 6.79, CW, t.accent, 3);
}

// minimal: a bar on the right edge, a huge title, one short accent line
function coverMinimal(sl, S, s, closing) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  box(sl, S, "rect", W - 0.45, 0, 0.45, H, { fill: t.accent });
  const x0 = 0.95;
  const tw = 9.6;
  if (S.org) put(sl, S, S.org.toUpperCase(), { x: x0, y: 0.8, w: tw, h: 0.4, pt: 13, bold: true, color: t.accentInk, cs: 3, valign: "middle" });
  const f = fit(plain(s.title), { w: tw, h: 3.1, max: 66, min: 34, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: x0, y: 1.3, w: tw, h: 3.1, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "bottom" });
  box(sl, S, "rect", x0, 4.7, 1.2, 0.08, { fill: t.accent });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.1, max: 26, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 5.0, w: tw, h: 1.1, pt: sf.pt, color: t.muted, valign: "top" });
  }
  const meta = metaOf(s, closing);
  if (meta) put(sl, S, meta, { x: x0, y: 6.35, w: tw, h: 0.4, pt: 16, color: closing ? t.accentInk : t.muted, valign: "middle", bold: closing });
}

// modern: the original look (an orb, centred or on the right)
function coverOrb(sl, S, s, closing, centered) {
  const t = S.t;
  setBg(sl, S, closing ? "closing" : "cover");
  const meta = metaOf(s, closing, true);
  const metaColor = closing ? t.accentInk : t.muted;

  if (centered) {
    orb(sl, S, W / 2, 1.9, 1.5);
    const tw = W - 2.4;
    const f = fit(plain(s.title), { w: tw, h: 1.6, max: 60, min: 34, font: t.titleFont, bold: true });
    chk(S, s, "the title", f, " to about 40 characters");
    put(sl, S, s.title, { x: 1.2, y: 3.25, w: tw, h: 1.6, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, align: "center", valign: "middle" });
    if (s.subtitle) {
      const sf = fit(s.subtitle, { w: tw, h: 0.95, max: 26, min: 16, font: t.bodyFont });
      chk(S, s, "the subtitle", sf, " to about 90 characters");
      put(sl, S, s.subtitle, { x: 1.2, y: 4.95, w: tw, h: 0.95, pt: sf.pt, color: t.muted, align: "center", valign: "top" });
    }
    if (meta) put(sl, S, meta, { x: 1.2, y: 6.3, w: tw, h: 0.4, pt: 16, color: metaColor, align: "center", valign: "middle", bold: closing });
  } else {
    const tw = 7.3;
    const f = fit(plain(s.title), { w: tw, h: 2.6, max: 56, min: 32, font: t.titleFont, bold: true });
    chk(S, s, "the title", f, " to about 40 characters");
    put(sl, S, s.title, { x: 0.95, y: 1.6, w: tw, h: 2.6, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "bottom" });
    if (s.subtitle) {
      const sf = fit(s.subtitle, { w: tw, h: 1.2, max: 24, min: 16, font: t.bodyFont });
      chk(S, s, "the subtitle", sf, " to about 90 characters");
      put(sl, S, s.subtitle, { x: 0.95, y: 4.45, w: tw, h: 1.2, pt: sf.pt, color: t.muted, valign: "top" });
    }
    if (meta) put(sl, S, meta, { x: 0.95, y: 6.25, w: tw, h: 0.4, pt: 16, color: metaColor, valign: "middle", bold: closing });
    orb(sl, S, 10.35, 3.75, 3.0);
  }
}

const COVERS = {
  split: coverSplit, frame: coverFrame, arcs: coverArcs, rules: coverRules, minimal: coverMinimal,
  orb: (sl, S, s, c) => coverOrb(sl, S, s, c, false),
  center: (sl, S, s, c) => coverOrb(sl, S, s, c, true),
};

function slideTitle(sl, S, s, closing = false) {
  (COVERS[S.cover] ?? COVERS.orb)(sl, S, s, closing);
}

// ======================================================================
//  Section divider slides
// ======================================================================
const bigNumColor = (t, k) => mix(t.mid, t.accent, k);

function sectionSplit(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  S.secNo++;
  box(sl, S, "rect", 0, 0, 0.3, H, { fill: t.accent });
  mosaic(sl, S, 10.35, 0, W - 10.35, H, 3, 6, S.seed + S.secNo * 13);
  put(sl, S, String(S.secNo).padStart(2, "0"), { x: 0.95, y: 0.7, w: 7, h: 2.7, pt: 150, font: t.titleFont, bold: true, color: bigNumColor(t, 0.42), valign: "top" });
  const tw = 8.4;
  const f = fit(plain(s.title), { w: tw, h: 1.5, max: 54, min: 30, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: 0.95, y: 3.55, w: tw, h: 1.5, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "top" });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: 0.95, y: 5.2, w: tw, h: 1.0, pt: sf.pt, color: t.muted, valign: "top" });
  }
}

function sectionFrame(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  drawFrame(sl, S, true);
  S.secNo++;
  const x0 = 1.6;
  const tw = W - 3.2;
  put(sl, S, numLabel("I", S.secNo - 1), { x: x0, y: 1.1, w: tw, h: 1.8, pt: 90, font: t.titleFont, color: bigNumColor(t, 0.7), align: "center", keepAlign: true, valign: "middle" });
  ornament(sl, S, W / 2, 3.15, 2.4);
  const title = String(s.title).toUpperCase();
  const f = fit(plain(title), { w: tw, h: 1.4, max: 44, min: 26, font: t.titleFont, up: true, cs: 4 });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, title, { x: x0, y: 3.45, w: tw, h: 1.4, pt: f.pt, font: t.titleFont, color: t.title, hl: t.accentInk, align: "center", keepAlign: true, valign: "middle", cs: 4 });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 0.9, max: 22, min: 16, font: t.titleFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: x0, y: 5.0, w: tw, h: 0.9, pt: sf.pt, font: t.titleFont, italic: true, color: t.muted, align: "center", keepAlign: true, valign: "top" });
  }
}

function sectionArcs(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  S.secNo++;
  arcsArt(sl, S, 11.55, 3.75, [0.7, 1.3, 1.9, 2.5, 3.1]);
  put(sl, S, String(S.secNo).padStart(2, "0"), { x: MX, y: 0.7, w: 7, h: 2.7, pt: 150, font: t.titleFont, color: bigNumColor(t, 0.38), valign: "top" });
  const tw = 6.8;
  const f = fit(plain(s.title), { w: tw, h: 1.5, max: 50, min: 28, font: t.titleFont });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: MX, y: 3.55, w: tw, h: 1.5, pt: f.pt, font: t.titleFont, color: t.title, hl: t.accentInk, hlItalic: true, valign: "top" });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 22, min: 16, font: t.titleFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: MX, y: 5.2, w: tw, h: 1.0, pt: sf.pt, font: t.titleFont, italic: true, color: t.muted, valign: "top" });
  }
}

function sectionRules(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  S.secNo++;
  put(sl, S, "SECTION " + S.secNo, { x: MX, y: 2.15, w: CW, h: 0.4, pt: 15, bold: true, color: t.accentInk, cs: 3, valign: "middle" });
  const f = fit(plain(s.title), { w: CW, h: 1.5, max: 50, min: 28, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 50 characters");
  put(sl, S, s.title, { x: MX, y: 2.65, w: CW, h: 1.5, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "middle" });
  hline(sl, S, MX, 4.35, CW, t.accent, 3);
  hline(sl, S, MX, 4.44, CW, t.text, 0.5);
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: CW, h: 1.1, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: MX, y: 4.7, w: CW, h: 1.1, pt: sf.pt, italic: true, color: t.muted, valign: "top" });
  }
}

function sectionMinimal(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  S.secNo++;
  box(sl, S, "rect", W - 0.45, 0, 0.45, H, { fill: t.accent });
  put(sl, S, String(S.secNo).padStart(2, "0"), { x: 0.95, y: 0.9, w: 6, h: 2.3, pt: 120, font: t.titleFont, bold: true, color: t.accentInk, valign: "top" });
  const tw = 9.6;
  const f = fit(plain(s.title), { w: tw, h: 1.5, max: 54, min: 30, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: 0.95, y: 3.5, w: tw, h: 1.5, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "top" });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: 0.95, y: 5.15, w: tw, h: 1.0, pt: sf.pt, color: t.muted, valign: "top" });
  }
}

function sectionOrb(sl, S, s) {
  const t = S.t;
  setBg(sl, S, "section");
  S.secNo++;
  put(sl, S, String(S.secNo).padStart(2, "0"), {
    x: MX, y: 0.7, w: 7, h: 2.7, pt: 150, font: t.titleFont, bold: true, color: bigNumColor(t, 0.42), valign: "top",
  });
  const tw = 7.6;
  const f = fit(plain(s.title), { w: tw, h: 1.5, max: 54, min: 30, font: t.titleFont, bold: true });
  chk(S, s, "the title", f, " to about 40 characters");
  put(sl, S, s.title, { x: MX, y: 3.55, w: tw, h: 1.5, pt: f.pt, font: t.titleFont, bold: true, color: t.title, hl: t.accentInk, valign: "top" });
  if (s.subtitle) {
    const sf = fit(s.subtitle, { w: tw, h: 1.0, max: 24, min: 16, font: t.bodyFont });
    chk(S, s, "the subtitle", sf, " to about 90 characters");
    put(sl, S, s.subtitle, { x: MX, y: 5.2, w: tw, h: 1.0, pt: sf.pt, color: t.muted, valign: "top" });
  }
  orb(sl, S, 10.6, 3.75, 2.6);
}

const SECTIONS = {
  split: sectionSplit, frame: sectionFrame, arcs: sectionArcs, rules: sectionRules, minimal: sectionMinimal, orb: sectionOrb, center: sectionOrb,
};

function slideSection(sl, S, s) {
  (SECTIONS[S.cover] ?? sectionOrb)(sl, S, s);
}

// ======================================================================
//  Content slide types
// ======================================================================

// Rows separated by thin lines with a big number on the left (bullets in the clean styles, and the agenda slide).
// items: [{ head, detail }]    o.big = bigger numbers (agenda)
function renderList(sl, S, s, items, o = {}) {
  const t = S.t;
  const n = items.length;
  const cols = n >= 6 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gapX = 0.5;
  const colW = cols === 2 ? (CW - gapX) / 2 : CW;
  const avail = BOTTOM - TOP;
  const rowH = Math.min(o.big ? 1.15 : 1.1, avail / rows);
  const y0 = TOP + (avail - rowH * rows) / 2;
  const d = o.big ? 0.9 : Math.min(0.7, rowH - 0.24);
  for (let c = 0; c < cols; c++) hline(sl, S, MX + c * (colW + gapX), y0, colW, t.accent, 1.5);

  items.forEach((it, i) => {
    const c = Math.floor(i / rows);
    const r = i % rows;
    const x = MX + c * (colW + gapX);
    const y = y0 + r * rowH;
    hline(sl, S, x, y + rowH, colW, t.hair, 0.75);
    badge(sl, S, x + 0.05, y + (rowH - d) / 2, d, o.big ? numLabel("01", i) : S.num(i), t.accent, o.big ? { kind: "text", pt: 36 } : {});
    const tx = x + (o.big ? 1.35 : d + 0.4);
    const tw = x + colW - tx - 0.1;
    const th = rowH - 0.14;
    if (it.detail) {
      const paras = [{ text: it.head, bold: true, ratio: 1, floor: 14 }, { text: it.detail, ratio: 0.74, floor: 14 }];
      const f = fitParas(paras, { w: tw, h: th, max: o.big ? 26 : 24, min: 14, font: t.bodyFont, gap: 2 });
      chk(S, s, `point ${i + 1}`, f, " (heading max 40, detail max 80 characters)");
      put(sl, S, [
        { text: it.head, pt: f.sizes[0], bold: true, gap: 2 },
        { text: it.detail, pt: f.sizes[1], color: t.muted },
      ], { x: tx, y: y + 0.07, w: tw, h: th, valign: "middle" });
    } else {
      const f = fit(it.head, { w: tw, h: th, max: o.big ? 26 : 24, min: 14, font: t.bodyFont });
      chk(S, s, `point ${i + 1}`, f, " (max about 90 characters)");
      put(sl, S, it.head, { x: tx, y: y + 0.07, w: tw, h: th, pt: f.pt, valign: "middle" });
    }
  });
}

function slideBullets(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const items = s.points.map((p) => {
    const [head, ...more] = p.trim().split(/\s+\|\s+/);
    return { head, detail: more.join(" - ") };
  });
  if (st.bullets === "list") return renderList(sl, S, s, items);

  const n = items.length;
  const cols = n >= 6 ? 2 : 1; // six points are laid out as a 2 x 3 grid so the text can stay big
  const rows = Math.ceil(n / cols);
  const gapY = 0.16;
  const gapX = 0.3;
  const avail = BOTTOM - TOP;
  const cardW = cols === 2 ? (CW - gapX) / 2 : CW;
  const rowH = Math.min(cols === 2 ? 1.35 : 1.12, (avail - gapY * (rows - 1)) / rows);
  const d = Math.min(0.78, rowH - 0.26);
  const total = rowH * rows + gapY * (rows - 1);
  const y0 = TOP + (avail - total) / 2;

  items.forEach((it, i) => {
    const x = MX + (i % cols) * (cardW + gapX);
    const y = y0 + Math.floor(i / cols) * (rowH + gapY);
    card(sl, S, x, y, cardW, rowH, { r: 0.16, edge: st.flush ? "none" : undefined });
    // executive: the number block touches the left edge of the row
    const bd = st.flush ? rowH : d;
    const bx = st.flush ? x : x + 0.3;
    badge(sl, S, bx, st.flush ? y : y + (rowH - d) / 2, bd, S.num(i), t.accent);
    const tx = bx + bd + 0.3;
    const tw = x + cardW - 0.3 - tx;
    const th = rowH - 0.14;
    if (it.detail) {
      const paras = [{ text: it.head, bold: true, ratio: 1, floor: 14 }, { text: it.detail, ratio: 0.74, floor: 14 }];
      const r = fitParas(paras, { w: tw, h: th, max: 24, min: 14, font: t.bodyFont, gap: 2 });
      chk(S, s, `point ${i + 1}`, r, " (heading max 40, detail max 80 characters)");
      put(sl, S, [
        { text: it.head, pt: r.sizes[0], bold: true, gap: 2 },
        { text: it.detail, pt: r.sizes[1], color: t.muted },
      ], { x: tx, y: y + 0.07, w: tw, h: th, valign: "middle" });
    } else {
      const r = fit(it.head, { w: tw, h: th, max: 24, min: 14, font: t.bodyFont });
      chk(S, s, `point ${i + 1}`, r, " (max about 90 characters)");
      put(sl, S, it.head, { x: tx, y: y + 0.07, w: tw, h: th, pt: r.pt, valign: "middle" });
    }
  });
}

function slideAgenda(sl, S, s) {
  frame(sl, S, s);
  renderList(sl, S, s, s.items.map((x) => ({ head: x.heading, detail: x.detail })), { big: true });
}

function slideCards(sl, S, s) {
  const t = S.t;
  frame(sl, S, s);
  const n = s.cards.length;
  const gap = 0.3;
  const cw = (CW - gap * (n - 1)) / n;
  const iw = cw - 0.8;
  const avail = BOTTOM - TOP;

  // same text size on every card, then the cards are only as tall as their text needs
  const hFits = s.cards.map((c) => fit(c.heading, { w: iw, h: 0.9, max: 28, min: 18, font: t.titleFont, bold: true }));
  s.cards.forEach((c, i) => chk(S, s, `the heading of card ${i + 1}`, hFits[i], " to about 16 characters"));
  const hPt = Math.min(...hFits.map((f) => f.pt));
  const headLines = Math.max(...s.cards.map((c) => lineCount(plain(c.heading), iw, hPt, t.titleFont, true)));
  const headH = (headLines * hPt * 1.22) / 72;

  const iFits = s.cards.map((c) => (c.items.length ? fitParas(c.items.map((it) => ({ text: it, floor: 14 })), { w: iw, h: 2.7, max: 22, min: 14, font: t.bodyFont, gap: 8 }) : null));
  s.cards.forEach((c, i) => iFits[i] && chk(S, s, `the items of card ${i + 1}`, iFits[i], " (max 30 characters each, 3 items)"));
  const iPt = Math.min(...iFits.filter(Boolean).map((f) => f.base), 22);
  const itemsH = Math.max(0, ...s.cards.map((c) => (c.items.length ? fitParas(c.items.map((it) => ({ text: it, floor: iPt })), { w: iw, h: 99, max: iPt, min: iPt, font: t.bodyFont, gap: 8 }).height : 0)));

  const ch = Math.min(avail, Math.max(3.7, 0.4 + 0.95 + 0.25 + headH + 0.2 + itemsH + 0.45));
  const y = TOP + (avail - ch) / 2;

  s.cards.forEach((c, i) => {
    const x = MX + i * (cw + gap);
    const col = i % 2 ? t.accent2 : t.accent;
    card(sl, S, x, y, cw, ch, { col });
    badge(sl, S, x + 0.4, y + 0.4, 0.95, S.num(i), col);
    put(sl, S, c.heading, { x: x + 0.4, y: y + 1.6, w: iw, h: headH, pt: hPt, font: t.titleFont, bold: true, color: i % 2 ? t.accent2Ink : t.accentInk, valign: "top" });
    if (c.items.length) {
      put(sl, S, c.items.map((it) => ({ text: it, pt: iPt, gap: 8 })), { x: x + 0.4, y: y + 1.6 + headH + 0.2, w: iw, h: itemsH + 0.1, valign: "top" });
    }
  });
}

function slideStats(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const n = s.stats.length;
  const gap = 0.3;
  const cw = (CW - gap * (n - 1)) / n;
  const avail = BOTTOM - TOP;
  const ch = 3.9;
  const y = TOP + (avail - ch) / 2;
  const iw = cw - 0.7;
  s.stats.forEach((it, i) => {
    const x = MX + i * (cw + gap);
    const col = i % 2 ? t.accent2 : t.accent;
    card(sl, S, x, y, cw, ch, { col });
    const nf = fit(it.value, { w: iw, h: 1.5, max: 72, min: 36, font: t.titleFont, bold: st.numBold || st.titleBold });
    chk(S, s, `the number of stat ${i + 1}`, nf, " (max 8 characters, like 85% or $2.5B)");
    put(sl, S, it.value, { x: x + 0.35, y: y + 0.4, w: iw, h: 1.5, pt: nf.pt, font: t.titleFont, bold: st.numBold || st.titleBold, color: i % 2 ? t.accent2Ink : t.accentInk, valign: "middle" });
    if (st.statRule) hline(sl, S, x + 0.35, y + 1.98, 0.7, col, 2);
    const lf = fit(it.label, { w: iw, h: 1.0, max: 22, min: 14, font: t.bodyFont });
    chk(S, s, `the label of stat ${i + 1}`, lf, " to about 50 characters");
    put(sl, S, it.label, { x: x + 0.35, y: y + 2.15, w: iw, h: 1.0, pt: lf.pt, valign: "top" });
    if (it.caption) put(sl, S, it.caption, { x: x + 0.35, y: y + ch - 0.7, w: iw, h: 0.45, pt: 12, color: t.muted, italic: true, valign: "bottom" });
  });
}

function slideSteps(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const n = s.steps.length;
  const colW = CW / n;
  const d = 0.95;
  const avail = BOTTOM - TOP;
  const iw = colW - 0.24 - 0.5;

  // same text size in every step; the cards are only as tall as the text needs
  const fits = s.steps.map((it) => {
    const paras = [{ text: it.heading, bold: true, ratio: 1, floor: 16, font: t.titleFont }];
    if (it.detail) paras.push({ text: it.detail, ratio: 0.72, floor: 14 });
    return { paras, r: fitParas(paras, { w: iw, h: 2.6, max: 24, min: 16, font: t.bodyFont, gap: 8 }) };
  });
  fits.forEach((f, i) => chk(S, s, `step ${i + 1}`, f.r, " (heading max 20, detail max 80 characters)"));
  const base = Math.min(...fits.map((f) => f.r.base));
  const sized = fits.map((f) => fitParas(f.paras, { w: iw, h: 99, max: base, min: base, font: t.bodyFont, gap: 8 }));
  const textH = Math.max(...sized.map((r) => r.height));
  const ch = Math.min(3.0, Math.max(1.9, textH + 0.65));
  const group = d + 0.4 + ch;
  const y0 = TOP + Math.max(0, (avail - group) / 2);
  const cy = y0 + d / 2;
  const cardY = y0 + d + 0.4;

  // connecting line first, so the markers sit on top of it
  if (st.marker !== "text") hline(sl, S, MX + colW / 2, cy, colW * (n - 1), mix(t.text, t.mid, 0.62), 2.5);
  s.steps.forEach((it, i) => {
    const cx = MX + colW * i + colW / 2;
    const col = i % 2 ? t.accent2 : t.accent;
    badge(sl, S, cx - d / 2, y0, d, S.num(i), col);
    const x = MX + colW * i + 0.12;
    const w = colW - 0.24;
    card(sl, S, x, cardY, w, ch, { col });
    const r = sized[i];
    const out = [{ text: it.heading, pt: r.sizes[0], bold: true, font: t.titleFont, color: i % 2 ? t.accent2Ink : t.accentInk, gap: 8 }];
    if (it.detail) out.push({ text: it.detail, pt: r.sizes[1], color: t.text });
    put(sl, S, out, { x: x + 0.25, y: cardY + 0.3, w: iw, h: ch - 0.5, valign: "top" });
  });
}

// Arrow chevrons in a row with a short text under each one
function slideProcess(sl, S, s) {
  const t = S.t;
  frame(sl, S, s);
  const n = s.steps.length;
  const shH = 1.05;
  const depth = shH / 2; // how deep the arrow point is
  const ov = depth - 0.08; // neighbours overlap so the points fit into each other
  const w = (CW + (n - 1) * ov) / n;
  const pitch = w - ov;
  const avail = BOTTOM - TOP;
  const detailH = 2.1;
  const group = shH + 0.3 + 0.45 + detailH;
  const y0 = TOP + Math.max(0, (avail - group) / 2);
  const zone = (i) => {
    const l = i === 0 ? 0.28 : depth + 0.06;
    return { x: l, w: w - l - depth * 0.7 };
  };

  const hf = s.steps.map((it, i) => fit(it.heading, { w: zone(i).w, h: shH - 0.2, max: 22, min: 14, font: t.titleFont, bold: true }));
  hf.forEach((f, i) => chk(S, s, `step ${i + 1}`, f, " (heading max 20 characters)"));
  const hPt = Math.min(...hf.map((f) => f.pt));
  const dw = pitch - 0.25;
  const df = s.steps.filter((it) => it.detail).map((it) => fit(it.detail, { w: dw, h: detailH, max: 20, min: 13, font: t.bodyFont }));
  df.forEach((f, i) => chk(S, s, `step ${i + 1} detail`, f, " (max 80 characters)"));
  const dPt = df.length ? Math.min(...df.map((f) => f.pt)) : 16;

  s.steps.forEach((it, i) => {
    const x = MX + i * pitch;
    const fill = i % 2 ? t.accent2 : t.accent;
    box(sl, S, i === 0 ? "plate" : "chevron", x, y0, w, shH, { fill });
    const z = zone(i);
    put(sl, S, it.heading, { x: x + z.x, y: y0, w: z.w, h: shH, pt: hPt, font: t.titleFont, bold: true, color: inkOn(fill), valign: "middle" });
    const dx = x + (i === 0 ? 0.05 : depth * 0.5);
    put(sl, S, S.num(i), { x: dx, y: y0 + shH + 0.3, w: 1, h: 0.4, pt: 16, font: t.titleFont, bold: true, color: i % 2 ? t.accent2Ink : t.accentInk, valign: "middle" });
    if (it.detail) put(sl, S, it.detail, { x: dx, y: y0 + shH + 0.78, w: dw, h: detailH, pt: dPt, valign: "top" });
  });
}

// A horizontal line with dated milestones: date above the line, heading and detail below it
function slideTimeline(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const ev = s.events;
  const n = ev.length;
  const colW = CW / n;
  const iw = colW - 0.3;
  const lineY = TOP + 1.75;
  const whens = ev.map((e, i) => e.when || S.num(i));

  const wf = whens.map((x, i) => fit(x, { w: iw, h: 0.85, max: 34, min: 16, font: t.titleFont, bold: true }));
  wf.forEach((f, i) => chk(S, s, `the date of event ${i + 1}`, f, " (max 8 characters)"));
  const hf = ev.map((e, i) => fit(e.heading, { w: iw, h: 0.8, max: 22, min: 14, font: t.titleFont, bold: true }));
  hf.forEach((f, i) => chk(S, s, `the heading of event ${i + 1}`, f, " (max 24 characters)"));
  const df = ev.filter((e) => e.detail).map((e) => fit(e.detail, { w: iw, h: 1.5, max: 18, min: 13, font: t.bodyFont }));
  df.forEach((f, i) => chk(S, s, `a detail text`, f, " (max 70 characters)"));
  const wPt = Math.min(...wf.map((f) => f.pt));
  const hPt = Math.min(...hf.map((f) => f.pt));
  const dPt = df.length ? Math.min(...df.map((f) => f.pt)) : 16;

  hline(sl, S, MX, lineY, CW, mix(t.text, t.mid, 0.6), 2);
  const md = 0.3;
  const shape = st.dot === "square" ? "rect" : st.dot === "diamond" ? "diamond" : "circle";
  ev.forEach((e, i) => {
    const cx = MX + colW * i + colW / 2;
    const col = i % 2 ? t.accent2 : t.accent;
    put(sl, S, whens[i], { x: cx - iw / 2, y: lineY - 1.15, w: iw, h: 0.85, pt: wPt, font: t.titleFont, bold: true, color: i % 2 ? t.accent2Ink : t.accentInk, align: "center", keepAlign: true, valign: "bottom" });
    box(sl, S, shape, cx - md / 2, lineY - md / 2, md, md, { fill: col, line: surf(S), lw: 3 });
    put(sl, S, e.heading, { x: cx - iw / 2, y: lineY + 0.5, w: iw, h: 0.8, pt: hPt, font: t.titleFont, bold: true, align: "center", keepAlign: true, valign: "top" });
    if (e.detail) put(sl, S, e.detail, { x: cx - iw / 2, y: lineY + 1.4, w: iw, h: 1.5, pt: dPt, color: t.muted, align: "center", keepAlign: true, valign: "top" });
  });
}

function slideTwo(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const gap = 0.35;
  const pw = (CW - gap) / 2;
  const avail = BOTTOM - TOP;
  const iw = pw - 0.9;
  const sides = [s.left, s.right];

  const fits = sides.map((side) => fitParas(side.items.map((it) => ({ text: it, floor: 14 })), { w: iw - 0.3, h: 3.0, max: 22, min: 14, font: t.bodyFont, gap: 12 }));
  fits.forEach((f, i) => chk(S, s, `the ${i ? "right" : "left"} list`, f, " (max about 60 characters per point)"));
  const base = Math.min(...fits.map((f) => f.base));
  const itemsH = Math.max(...sides.map((side) => fitParas(side.items.map((it) => ({ text: it, floor: base })), { w: iw - 0.3, h: 99, max: base, min: base, font: t.bodyFont, gap: 12 }).height));
  const ph = Math.min(avail, Math.max(3.5, 1.3 + itemsH + 0.5));
  const y = TOP + (avail - ph) / 2;

  sides.forEach((side, i) => {
    const x = MX + i * (pw + gap);
    const col = i ? t.accent2 : t.accent;
    card(sl, S, x, y, pw, ph, { col });
    const hf = fit(side.head, { w: iw, h: 0.6, max: 26, min: 16, font: t.titleFont, bold: true });
    chk(S, s, `the ${i ? "right" : "left"} heading`, hf, " to about 25 characters");
    if (st.head === "fill") {
      box(sl, S, st.card === "round" ? "round" : "rect", x + 0.25, y + 0.25, pw - 0.5, 0.75, { fill: col, r: 0.14 });
      put(sl, S, side.head, { x: x + 0.45, y: y + 0.25, w: iw, h: 0.75, pt: hf.pt, font: t.titleFont, bold: true, color: inkOn(col), valign: "middle" });
    } else {
      put(sl, S, side.head, { x: x + 0.45, y: y + 0.25, w: iw, h: 0.75, pt: hf.pt, font: t.titleFont, bold: st.titleBold, color: i ? t.accent2Ink : t.accentInk, valign: "middle", cs: st.caps ? 2 : 0 });
      hline(sl, S, x + 0.45, y + 1.05, pw - 0.9, col, 1.5);
    }
    put(sl, S, side.items.map((it) => ({ text: it, pt: base, gap: 12, bullet: true })), { x: x + 0.45, y: y + 1.3, w: iw, h: ph - 1.6, valign: "top" });
  });
}

function slideTable(sl, S, s) {
  const t = S.t;
  const st = S.st;
  frame(sl, S, s);
  const rows = s.rows;
  const nc = Math.max(...rows.map((r) => r.length));
  const nr = rows.length;
  const pt = nr <= 4 ? 20 : nr <= 6 ? 18 : 16;
  const wts = Array(nc).fill(8);
  rows.forEach((r) => r.forEach((c, i) => (wts[i] = Math.max(wts[i], Math.min(34, plain(c).length)))));
  const wsum = wts.reduce((a, b) => a + b, 0);
  const colW = wts.map((v) => (CW * v) / wsum);

  const avail = BOTTOM - TOP - (s.source ? 0.25 : 0);
  const want = Math.min(0.85, avail / nr); // rows grow to fill the slide, but not too tall
  const rowHs = rows.map((r, ri) => {
    let lines = 1;
    for (let ci = 0; ci < nc; ci++) lines = Math.max(lines, lineCount(plain(r[ci] ?? ""), colW[ci] - 0.3, pt, t.bodyFont, ri === 0 || ci === 0));
    return Math.max(want, (lines * pt * 1.22) / 72 + 0.26);
  });
  const total = rowHs.reduce((a, b) => a + b, 0);
  if (total > avail + 0.05) S.problems.push(`Slide ${s.n} (table): the table is too big for the slide. Use fewer rows or shorter cell text.`);

  const line = { type: "solid", pt: 0.75, color: t.cardLine };
  const none = { type: "none" };
  const numeric = Array(nc).fill(nr > 1);
  rows.slice(1).forEach((r) => {
    for (let ci = 0; ci < nc; ci++) if (!/^[$€£]?\s*[-+]?[\d.,]+\s*[%kKmMbB]?$/.test(plain(r[ci] ?? ""))) numeric[ci] = false;
  });
  const zebra = t.dark ? mix(t.card, "FFFFFF", 0.05) : mix(t.card, t.accent, 0.06);
  const rules = st.table === "rules"; // booktabs look: lines only, no fills
  const thick = { type: "solid", pt: 1.75, color: t.accent };
  const thin = { type: "solid", pt: 0.75, color: t.hair };
  const headLine = { type: "solid", pt: 1, color: t.text };

  const data = rows.map((r, ri) =>
    Array.from({ length: nc }, (_, ci) => {
      const head = ri === 0;
      const txt = plain(r[ci] ?? "");
      const o = {
        fontFace: head ? t.titleFont : t.bodyFont,
        fontSize: pt,
        bold: head || ci === 0,
        align: numeric[ci] ? "center" : "left",
        valign: "middle",
        margin: [0.06, 0.15, 0.06, 0.15],
      };
      if (rules) {
        o.color = head ? t.accentInk : t.text;
        o.border = [head ? thick : none, none, head ? headLine : ri === nr - 1 ? thick : thin, none];
        if (head && st.caps) o.charSpacing = 2;
      } else {
        o.color = head ? inkOn(t.accent) : t.text;
        o.fill = { color: head ? t.accent : ri % 2 ? t.card : zebra };
        o.border = [none, none, line, none];
      }
      return { text: head && rules && st.caps ? txt.toUpperCase() : txt, options: o };
    })
  );
  const y = TOP + Math.max(0, (avail - total) / 2);
  sl.addTable(data, { x: MX, y, w: CW, colW, rowH: rowHs });
  sourceLine(sl, S, s);
}

function slideChart(sl, S, s) {
  const t = S.t;
  frame(sl, S, s);
  const c = s.chart;
  const CT = S.pptx.charts;
  const bottom = s.source ? 6.4 : BOTTOM;
  const y = TOP + 0.05;
  const ch = bottom - y;
  const hasNote = !!s.note;
  const cardW = hasNote ? 8.1 : CW;
  card(sl, S, MX, y, cardW, ch);

  const multi = c.type === "pie" || c.type === "doughnut" ? false : c.series.length > 1;
  const common = {
    x: MX + 0.25, y: y + 0.2, w: cardW - 0.5, h: ch - 0.4,
    showTitle: false,
    catAxisLabelColor: t.text, catAxisLabelFontFace: t.bodyFont, catAxisLabelFontSize: 14,
    valAxisLabelColor: t.muted, valAxisLabelFontFace: t.bodyFont, valAxisLabelFontSize: 12,
    valGridLine: { color: t.grid, size: 0.75 },
    catGridLine: { style: "none" },
    showLegend: multi,
    legendPos: "b", legendFontFace: t.bodyFont, legendFontSize: 14, legendColor: t.text,
    dataLabelColor: t.text, dataLabelFontFace: t.bodyFont, dataLabelFontSize: 13,
  };
  if (c.xlabel) Object.assign(common, { showCatAxisTitle: true, catAxisTitle: c.xlabel, catAxisTitleColor: t.muted, catAxisTitleFontFace: t.bodyFont, catAxisTitleFontSize: 13 });
  if (c.ylabel) Object.assign(common, { showValAxisTitle: true, valAxisTitle: c.ylabel, valAxisTitleColor: t.muted, valAxisTitleFontFace: t.bodyFont, valAxisTitleFontSize: 13 });

  const cols = S.palette;
  const points = c.labels.length * c.series.length;
  if (c.type === "pie" || c.type === "doughnut") {
    const data = [{ name: c.series[0].name, labels: c.labels, values: c.series[0].values }];
    sl.addChart(c.type === "pie" ? CT.PIE : CT.DOUGHNUT, data, {
      ...common, chartColors: cols.slice(0, c.labels.length),
      showLegend: true, legendPos: "r", legendFontSize: 16, showPercent: true, showValue: false, showLabel: false,
      dataLabelColor: inkOn(t.accent), dataLabelFontBold: true, dataBorder: { pt: 2, color: t.card },
      ...(c.type === "doughnut" ? { holeSize: 55 } : {}),
    });
  } else {
    const flip = c.type === "hbar"; // PowerPoint draws the first bar at the bottom, so turn the order around
    const labels = flip ? [...c.labels].reverse() : c.labels;
    const data = c.series.map((se) => ({ name: se.name, labels, values: flip ? [...se.values].reverse() : se.values }));
    const colors = cols.slice(0, c.series.length);
    if (c.type === "line") {
      sl.addChart(CT.LINE, data, {
        ...common, chartColors: colors, lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9,
        showValue: c.series.length === 1 && points <= 14, dataLabelPosition: "t", valAxisLabelFormatCode: "General",
      });
    } else if (c.type === "area") {
      sl.addChart(CT.AREA, data, { ...common, chartColors: colors, showValue: false });
    } else {
      sl.addChart(CT.BAR, data, {
        ...common, chartColors: colors,
        barDir: c.type === "hbar" ? "bar" : "col",
        barGrouping: c.type === "stacked" ? "stacked" : "clustered",
        barGapWidthPct: 55,
        showValue: points <= 16,
        dataLabelPosition: c.type === "stacked" ? "ctr" : "outEnd",
        ...(c.type === "stacked" ? { dataLabelColor: inkOn(colors[0]) } : {}),
      });
    }
  }

  if (hasNote) {
    const nx = MX + cardW + 0.3;
    const nw = CW - cardW - 0.3;
    card(sl, S, nx, y, nw, ch, { col: t.accent2 });
    badge(sl, S, nx + 0.35, y + 0.35, 0.8, "i", t.accent2, { kind: S.st.marker === "square" ? "square" : "circle", pt: 24 });
    const f = fit(s.note, { w: nw - 0.7, h: ch - 2.0, max: 26, min: 14, font: t.bodyFont, bold: true });
    chk(S, s, "the note", f, " to about 80 characters");
    put(sl, S, s.note, { x: nx + 0.35, y: y + 1.45, w: nw - 0.7, h: ch - 1.8, pt: f.pt, bold: true, valign: "top" });
  }
  sourceLine(sl, S, s);
}

function slideQuote(sl, S, s) {
  const t = S.t;
  const st = S.st;
  setBg(sl, S, "quote");
  if (st.frame) drawFrame(sl, S, false);

  if (st.quoteCenter) {
    put(sl, S, "\u201C", { x: W / 2 - 1.5, y: 0.6, w: 3, h: 1.9, pt: 140, font: "Georgia", bold: true, color: bigNumColor(t, 0.6), align: "center", keepAlign: true, valign: "top" });
    const f = fit(s.quote, { w: CW - 1.6, h: 2.7, max: 36, min: 20, font: t.titleFont });
    chk(S, s, "the quote", f, " to about 150 characters");
    put(sl, S, s.quote, { x: MX + 0.8, y: 2.4, w: CW - 1.6, h: 2.7, pt: f.pt, font: t.titleFont, italic: true, color: t.title, align: "center", keepAlign: true, valign: "middle" });
    if (st.deco === "gold") ornament(sl, S, W / 2, 5.3, 1.8);
    else hline(sl, S, W / 2 - 0.55, 5.3, 1.1, t.accent, 2.5);
    if (s.by) {
      put(sl, S, [
        { text: s.by, pt: 20, bold: true, color: t.accentInk, gap: 4, cs: st.caps ? 2 : 0 },
        ...(s.role ? [{ text: s.role, pt: 15, color: t.muted }] : []),
      ], { x: MX + 0.8, y: 5.5, w: CW - 1.6, h: 1.1, align: "center", keepAlign: true, valign: "top" });
    }
  } else {
    const bar = st.statBar; // clean styles: an accent bar instead of the big quote mark
    if (bar) box(sl, S, "rect", MX, 2.3, 0.1, 2.9, { fill: t.accent });
    else put(sl, S, "\u201C", { x: MX, y: 0.55, w: 3, h: 2.4, pt: 200, font: "Georgia", bold: true, color: bigNumColor(t, 0.5), valign: "top" });
    const qx = MX + (bar ? 0.5 : 0.5);
    const f = fit(s.quote, { w: CW - 1.0, h: 3.0, max: 40, min: 22, font: t.titleFont });
    chk(S, s, "the quote", f, " to about 150 characters");
    put(sl, S, s.quote, { x: qx, y: 2.2, w: CW - 1.0, h: 3.0, pt: f.pt, font: t.titleFont, italic: true, color: t.title, valign: "middle" });
    if (s.by) {
      put(sl, S, [
        { text: "\u2014 " + s.by, pt: 22, bold: true, color: t.accentInk, gap: 4 },
        ...(s.role ? [{ text: s.role, pt: 16, color: t.muted }] : []),
      ], { x: qx, y: 5.4, w: CW - 1.0, h: 1.2, valign: "top" });
    }
  }
  footer(sl, S);
}

function slideStatement(sl, S, s) {
  const t = S.t;
  const st = S.st;
  setBg(sl, S, "statement");
  if (st.frame) drawFrame(sl, S, false);
  const center = st.quoteCenter;
  const ox = !center && st.statBar ? 0.35 : 0;
  const tx = MX + 0.3 + ox;
  const tw = CW - 0.6 - ox;
  const f = fit(s.text, { w: tw, h: 3.6, max: 52, min: 28, font: t.titleFont, bold: st.titleBold });
  chk(S, s, "the text", f, " to about 110 characters");
  if (ox) {
    const bh = Math.min(3.6, f.height + 0.3);
    box(sl, S, "rect", MX + 0.3, 3.1 - bh / 2, 0.1, bh, { fill: t.accent });
  }
  put(sl, S, s.text, {
    x: tx, y: 1.3, w: tw, h: 3.6, pt: f.pt, font: t.titleFont, bold: st.titleBold, color: t.title, hl: t.accentInk, hlItalic: st.hlItalic,
    valign: "middle", align: center ? "center" : "left", keepAlign: center,
  });
  if (center) {
    if (st.deco === "gold") ornament(sl, S, W / 2, 5.05, 1.8);
    else hline(sl, S, W / 2 - 0.55, 5.05, 1.1, t.accent, 2.5);
  }
  if (s.sub) {
    const sf = fit(s.sub, { w: tw, h: 1.0, max: 22, min: 14, font: t.bodyFont });
    chk(S, s, "the sub line", sf, " to about 100 characters");
    put(sl, S, s.sub, { x: tx, y: 5.3, w: tw, h: 1.0, pt: sf.pt, color: t.muted, valign: "top", align: center ? "center" : "left", keepAlign: center });
  }
  footer(sl, S);
}

const BUILDERS = {
  title: (sl, S, s) => slideTitle(sl, S, s, false),
  closing: (sl, S, s) => slideTitle(sl, S, s, true),
  section: slideSection,
  agenda: slideAgenda,
  bullets: slideBullets,
  cards: slideCards,
  stats: slideStats,
  steps: slideSteps,
  process: slideProcess,
  timeline: slideTimeline,
  two: slideTwo,
  table: slideTable,
  chart: slideChart,
  quote: slideQuote,
  statement: slideStatement,
};
// slides that use the dark "feature" colours when the theme has a light content background
const FEATURE = new Set(["title", "section", "closing", "quote", "statement"]);

// ======================================================================
//  Reading the slide script
// ======================================================================
const TYPE_ALIASES = {
  cover: "title", intro: "title", titleslide: "title",
  divider: "section", chapter: "section", part: "section",
  contents: "agenda", toc: "agenda", outline: "agenda", agendaslide: "agenda",
  bullet: "bullets", list: "bullets", points: "bullets", content: "bullets", text: "bullets",
  card: "cards", cardgrid: "cards", features: "cards",
  stat: "stats", numbers: "stats", kpi: "stats", metrics: "stats",
  step: "steps", flow: "process", chevrons: "process", pipeline: "process", method: "process",
  roadmap: "timeline", milestones: "timeline", history: "timeline",
  twocolumn: "two", twocolumns: "two", compare: "two", comparison: "two", versus: "two", vs: "two", columns: "two", proscons: "two",
  data: "table", grid: "table",
  graph: "chart", plot: "chart",
  big: "statement", callout: "statement", bigtext: "statement",
  end: "closing", thanks: "closing", thankyou: "closing", outro: "closing",
};

const SLIDE_TYPES = Object.keys(BUILDERS);
const normType = (s) => {
  const k = String(s).toLowerCase().replace(/[\s_-]+/g, "");
  return TYPE_ALIASES[k] ?? k;
};

// which "key:" lines each slide type understands
const KEYS = {
  title: ["title", "subtitle", "emoji", "author", "date", "org", "notes"],
  section: ["title", "subtitle", "emoji", "notes"],
  agenda: ["title", "item", "notes"],
  bullets: ["title", "notes"],
  cards: ["title", "card", "notes"],
  stats: ["title", "stat", "notes"],
  steps: ["title", "step", "notes"],
  process: ["title", "step", "notes"],
  timeline: ["title", "event", "step", "notes"],
  two: ["title", "left", "right", "notes"],
  table: ["title", "source", "notes"],
  chart: ["title", "type", "labels", "xlabel", "ylabel", "note", "source", "notes"],
  quote: ["quote", "by", "role", "notes"],
  statement: ["text", "sub", "notes"],
  closing: ["title", "subtitle", "contact", "emoji", "notes"],
};
const KEY_ALIAS = { institution: "org", organization: "org", organisation: "org", company: "org", university: "org" };
const HEADER_KEYS = ["theme", "style", "accent", "accent2", "bg", "bg2", "fonts", "font", "cover", "art", "footer"];

const splitBar = (v) => v.split("|").map((x) => x.trim());
const splitList = (val) => (val.includes("|") ? val.split("|") : val.split(/[;,]/)).map((x) => x.trim()).filter((x) => x !== "");
const parseNumber = (s) => {
  const n = Number(String(s).replace(/[%$€£\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// If the AI wrote plain Markdown instead of a slide script, turn it into one
function markdownToScript(lines) {
  const out = [];
  let first = true;
  let lastType = "";
  for (const l of lines) {
    const t = l.trim();
    let m;
    if ((m = t.match(/^#\s+(.+)$/)) && first) {
      out.push("=== title", "title: " + m[1]);
      first = false;
      lastType = "title";
    } else if ((m = t.match(/^#{1,3}\s+(.+)$/))) {
      out.push("=== bullets", "title: " + m[1]);
      lastType = "bullets";
    } else if ((m = t.match(/^>\s*(.+)$/)) && lastType === "title") {
      out.push("subtitle: " + m[1]);
    } else out.push(l);
  }
  return out;
}

function parseScript(raw) {
  let text = stripEmoji(raw).replace(/\r\n?/g, "\n");
  if (!text.includes("\n") && text.includes("\\n")) text = text.replace(/\\n/g, "\n"); // some models send a literal \n
  text = text.replace(/^\s*```[a-z]*\s*\n/i, "").replace(/\n\s*```\s*$/, "");
  let lines = text.split("\n");
  if (!lines.some((l) => /^\s*={3,}/.test(l))) lines = markdownToScript(lines);

  const problems = [];
  const header = {};
  const slides = [];
  let cur = null;
  let side = null; // for "two": the list that "- " lines are added to

  const bad = (msg) => problems.push(cur ? `Slide ${slides.length} (${cur.type}): ${msg}` : `Header: ${msg}`);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    let m;

    // new slide
    if ((m = line.match(/^={3,}\s*([A-Za-z][A-Za-z _-]*?)\s*=*\s*$/))) {
      const type = normType(m[1]);
      if (!SLIDE_TYPES.includes(type)) {
        problems.push(`Slide ${slides.length + 1}: unknown slide type "${m[1].trim()}". Use one of: ${SLIDE_TYPES.join(", ")}.`);
        cur = { type: "bullets", points: [], bogus: true };
      } else {
        cur = { type, points: [], cards: [], stats: [], steps: [], items: [], events: [], rows: [], left: { head: "", items: [] }, right: { head: "", items: [] }, contact: [], chart: { type: "bar", labels: [], raw: [] } };
      }
      slides.push(cur);
      side = null;
      continue;
    }

    // header (before the first slide)
    if (!cur) {
      if ((m = line.match(/^([A-Za-z0-9]+)\s*:\s*(.*)$/))) {
        const k = m[1].toLowerCase();
        if (HEADER_KEYS.includes(k)) header[k] = m[2].trim();
        else problems.push(`Header: unknown line "${m[1]}:". Allowed: ${HEADER_KEYS.join(", ")}. Start the first slide with "=== title".`);
      } else problems.push(`Header: the line "${line.slice(0, 40)}" is before the first slide. Start the first slide with "=== title".`);
      continue;
    }
    if (cur.bogus) continue;

    // bullet line
    if ((m = line.match(/^[-*\u2022]\s+(.+)$/))) {
      if (cur.type === "bullets") cur.points.push(m[1].trim());
      else if (cur.type === "agenda") {
        const p = splitBar(m[1]);
        cur.items.push({ heading: p[0] ?? "", detail: p.slice(1).join(" - ") });
      } else if (cur.type === "process") {
        const p = splitBar(m[1]);
        cur.steps.push({ heading: p[0] ?? "", detail: p.slice(1).join(" - ") });
      } else if (cur.type === "two") {
        if (!side) bad('a "- " line must come after "left: ..." or "right: ...".');
        else side.items.push(m[1].trim());
      } else {
        const hint = { cards: "card:", stats: "stat:", steps: "step:", timeline: "event:" }[cur.type] ?? "the key: value lines";
        bad(`"- " lines are only for bullets and two. Use ${hint} here.`);
      }
      continue;
    }

    // table row
    if (line.startsWith("|")) {
      if (cur.type !== "table") {
        bad("table rows (| ... |) are only for the table slide.");
        continue;
      }
      const cells = line.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      if (!cells.every((c) => /^:?-+:?$/.test(c))) cur.rows.push(cells);
      continue;
    }

    // key: value
    if ((m = line.match(/^([^:|]{1,50}?)\s*:\s*(.*)$/))) {
      const key0 = m[1].trim().toLowerCase();
      const key = KEY_ALIAS[key0] ?? key0;
      const val = m[2].trim();
      const allowed = KEYS[cur.type];

      if (cur.type === "chart" && !allowed.includes(key)) {
        cur.chart.raw.push({ name: m[1].trim(), text: val });
        continue;
      }
      if (!allowed.includes(key)) {
        if (cur.type === "bullets") cur.points.push(line); // a plain line with a colon is just a point
        else bad(`the line "${key0}:" is not allowed here. This slide understands: ${allowed.join(", ")}.`);
        continue;
      }
      switch (key) {
        case "card": {
          const p = splitBar(val);
          if (p.length > 1 && p[0] === "") p.shift(); // an emoji that was removed leaves an empty first part
          cur.cards.push({ heading: p[0] ?? "", items: p.slice(1).filter(Boolean) });
          break;
        }
        case "stat": {
          const p = splitBar(val);
          cur.stats.push({ value: p[0] ?? "", label: p[1] ?? "", caption: p[2] ?? "" });
          break;
        }
        case "step": {
          const p = splitBar(val);
          cur.steps.push({ heading: p[0] ?? "", detail: p.slice(1).join(" - ") });
          break;
        }
        case "item": {
          const p = splitBar(val);
          cur.items.push({ heading: p[0] ?? "", detail: p.slice(1).join(" - ") });
          break;
        }
        case "event": {
          const p = splitBar(val);
          if (p.length >= 3) cur.events.push({ when: p[0], heading: p[1], detail: p.slice(2).join(" - ") });
          else if (p.length === 2) cur.events.push({ when: p[0], heading: p[1], detail: "" });
          else cur.events.push({ when: "", heading: p[0] ?? "", detail: "" });
          break;
        }
        case "left":
        case "right":
          cur[key].head = val;
          side = cur[key];
          break;
        case "contact":
          cur.contact = splitBar(val).filter(Boolean);
          break;
        case "type":
          cur.chart.type = val.toLowerCase();
          break;
        case "labels":
          cur.chart.labels = splitList(val);
          break;
        case "xlabel":
        case "ylabel":
          cur.chart[key] = val;
          break;
        default:
          cur[key] = val;
      }
      continue;
    }

    // plain line
    if (cur.type === "bullets") cur.points.push(line);
    else bad(`the line "${line.slice(0, 40)}" is not understood. Use "key: value" lines.`);
  }

  slides.forEach((s, i) => {
    s.n = i + 1;
  });
  return { header, slides, problems };
}

// ---------- checks of the content of every slide ----------
function finishChart(s, bad) {
  const c = s.chart;
  const aliases = { column: "bar", columns: "bar", bars: "bar", barh: "hbar", horizontal: "hbar", stackedbar: "stacked", stackedcolumn: "stacked", lines: "line", donut: "doughnut" };
  c.type = String(c.type).toLowerCase().replace(/[\s_-]/g, "").replace(/(chart|graph)$/, "");
  c.type = aliases[c.type] ?? c.type;
  if (!["bar", "hbar", "stacked", "line", "area", "pie", "doughnut"].includes(c.type)) return bad(`unknown chart type "${c.type}". Use: bar, hbar, stacked, line, area, pie, doughnut.`);
  if (!c.raw.length) return bad("the chart has no data. Add lines like 'Series name: 10, 20, 30'.");

  const series = [];
  for (const r of c.raw) {
    const vals = splitList(r.text).map(parseNumber);
    if (!vals.length || vals.some((v) => Number.isNaN(v))) return bad(`series "${r.name}" must contain only plain numbers, e.g. "${r.name}: 10, 20, 30".`);
    series.push({ name: r.name, values: vals });
  }

  if (c.type === "pie" || c.type === "doughnut") {
    if (c.labels.length) {
      if (series[0].values.length !== c.labels.length) return bad(`${c.labels.length} labels but ${series[0].values.length} numbers in "${series[0].name}".`);
      c.series = [series[0]];
    } else {
      if (series.some((x) => x.values.length !== 1)) return bad("pie: write 'labels: A, B, C' and one line 'Share: 50, 30, 20' - or one line per slice like 'Apples: 50'.");
      c.labels = series.map((x) => x.name);
      c.series = [{ name: "Share", values: series.map((x) => x.values[0]) }];
    }
    if (c.series[0].values.some((v) => v < 0) || !(c.series[0].values.reduce((a, b) => a + b, 0) > 0)) return bad("pie: values must be positive.");
    if (c.labels.length > 8) return bad("pie: at most 8 slices.");
    return;
  }
  if (!c.labels.length) return bad("add a line 'labels: A, B, C' with the names on the x-axis.");
  for (const x of series) if (x.values.length !== c.labels.length) return bad(`series "${x.name}" has ${x.values.length} numbers but there are ${c.labels.length} labels. They must match.`);
  if (series.length > 6) return bad("at most 6 series.");
  if (c.type === "stacked" && series.some((x) => x.values.some((v) => v < 0))) return bad("stacked: values cannot be negative. Use type bar instead.");
  if (c.labels.length > 14) return bad("at most 14 labels.");
  c.series = series;
}

function checkSlides(slides, problems) {
  if (slides.length < 3) problems.push("The deck needs at least 3 slides.");
  if (slides.length > 25) problems.push("The deck has more than 25 slides. Use at most 25.");
  if (slides.length && slides[0].type !== "title") problems.push('The FIRST slide must be "=== title".');

  for (const s of slides) {
    if (s.bogus) continue;
    const bad = (msg) => problems.push(`Slide ${s.n} (${s.type}): ${msg}`);
    const need = (field, label = field) => {
      if (!String(s[field] ?? "").trim()) bad(`missing "${label}:".`);
    };
    switch (s.type) {
      case "title":
      case "section":
      case "closing":
      case "agenda":
      case "bullets":
      case "cards":
      case "stats":
      case "steps":
      case "process":
      case "timeline":
      case "two":
      case "table":
      case "chart":
        need("title");
        break;
      case "quote":
        need("quote");
        break;
      case "statement":
        need("text");
        break;
    }
    if (s.type === "agenda") {
      if (s.items.length < 3 || s.items.length > 6) bad(`needs 3 to 6 "item:" lines, it has ${s.items.length}.`);
      if (s.items.some((x) => !x.heading)) bad('every item needs a heading: "item: Heading | detail".');
    }
    if (s.type === "bullets" && (s.points.length < 2 || s.points.length > 6)) bad(`needs 2 to 6 "- " points, it has ${s.points.length}.`);
    if (s.type === "cards") {
      if (s.cards.length < 2 || s.cards.length > 4) bad(`needs 2 to 4 "card:" lines, it has ${s.cards.length}.`);
      if (s.cards.some((c) => !c.heading)) bad('every card needs a heading: "card: Heading | item | item".');
    }
    if (s.type === "stats") {
      if (s.stats.length < 2 || s.stats.length > 4) bad(`needs 2 to 4 "stat:" lines, it has ${s.stats.length}.`);
      if (s.stats.some((x) => !x.value || !x.label)) bad('every stat needs a number and a label: "stat: 85% | what it means".');
    }
    if (s.type === "steps") {
      if (s.steps.length < 3 || s.steps.length > 5) bad(`needs 3 to 5 "step:" lines, it has ${s.steps.length}.`);
      if (s.steps.some((x) => !x.heading)) bad('every step needs a heading: "step: Heading | detail".');
    }
    if (s.type === "process") {
      if (s.steps.length < 3 || s.steps.length > 5) bad(`needs 3 to 5 "step:" lines, it has ${s.steps.length}.`);
      if (s.steps.some((x) => !x.heading)) bad('every step needs a heading: "step: Heading | detail".');
    }
    if (s.type === "timeline") {
      // "step:" lines are accepted too (they get the numbers 01, 02 ... instead of dates)
      if (!s.events.length && s.steps.length) s.events = s.steps.map((x) => ({ when: "", heading: x.heading, detail: x.detail }));
      if (s.events.length < 3 || s.events.length > 6) bad(`needs 3 to 6 "event:" lines, it has ${s.events.length}.`);
      if (s.events.some((x) => !x.heading)) bad('every event needs a heading: "event: 2021 | Heading | detail".');
    }
    if (s.type === "two") {
      for (const k of ["left", "right"]) {
        if (!s[k].head) bad(`missing "${k}: Heading".`);
        if (s[k].items.length < 1 || s[k].items.length > 6) bad(`the ${k} side needs 1 to 6 "- " points, it has ${s[k].items.length}.`);
      }
    }
    if (s.type === "table") {
      if (s.rows.length < 2) bad("needs a header row and at least one data row.");
      else if (s.rows.length > 8) bad("at most 8 rows (header included).");
      else if (Math.max(...s.rows.map((r) => r.length)) > 5) bad("at most 5 columns.");
    }
    if (s.type === "chart") finishChart(s, bad);
  }
}

// ======================================================================
//  Building the deck
// ======================================================================
function hashStr(str) {
  let h = 7;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

// Header -> { name, styleName, st (the style), tc (colours of the content slides), tf (colours of the feature slides), cover }
function resolveTheme(header, deckTitle, problems) {
  const names = Object.keys(THEMES);
  let name = String(header.theme ?? "").toLowerCase().trim();
  if (!name || name === "auto" || name === "random") name = AUTO_THEMES[hashStr(deckTitle) % AUTO_THEMES.length];
  if (!THEMES[name] && name !== "custom") {
    problems.push(`Header: unknown theme "${name}". Use one of: ${names.join(", ")}.`);
    return null;
  }
  const base = THEMES[name] ?? THEMES.midnight;

  let styleName = base.style;
  if (header.style) {
    const sn = header.style.toLowerCase().trim();
    if (!STYLES[sn]) problems.push(`Header: unknown style "${header.style}". Use one of: ${STYLE_ORDER.join(", ")}.`);
    else styleName = sn;
  }
  const restyled = styleName !== base.style; // another style: the fonts and cover of the theme no longer fit
  const st = STYLES[styleName];
  const def = { ...base, name, style: styleName };
  if (restyled) {
    def.titleFont = st.fonts[0];
    def.bodyFont = st.fonts[1];
    def.cover = undefined;
  }
  def.titleFont = def.titleFont ?? st.fonts[0];
  def.bodyFont = def.bodyFont ?? st.fonts[1];

  for (const k of ["bg", "bg2", "accent", "accent2"]) {
    if (header[k] === undefined) continue;
    if (!isHex(header[k])) problems.push(`Header: "${k}" must be a 6-digit hex colour like 1E293B.`);
    else def[k] = hex(header[k]);
  }
  // a new background colour needs its own gradient end and 2nd accent, and the whole deck then uses it
  if (header.bg !== undefined) {
    if (header.bg2 === undefined) def.bg2 = undefined;
    def.paper = undefined;
    def.paper2 = undefined;
  }
  if (header.accent !== undefined && header.accent2 === undefined) def.accent2 = undefined;

  const fontsRaw = header.fonts ?? header.font;
  if (fontsRaw) {
    const want = fontsRaw.split(/[\/|,]/).map((f) => f.trim()).filter(Boolean);
    const found = want.map((w) => FONTS.find((f) => f.toLowerCase() === w.toLowerCase()));
    if (found.some((f) => !f)) problems.push(`Header: unknown font in "${fontsRaw}". Allowed: ${FONTS.join(", ")}.`);
    else {
      def.titleFont = found[0];
      def.bodyFont = found[1] ?? found[0];
    }
  }

  let cover = def.cover ?? st.cover;
  if (header.cover) {
    const c = header.cover.toLowerCase().trim();
    const ok = ["split", "frame", "arcs", "rules", "minimal", "orb", "center", "centre", "left"];
    if (!ok.includes(c)) problems.push(`Header: cover must be one of: split, frame, arcs, rules, minimal, orb, center.`);
    else cover = c === "centre" ? "center" : c === "left" ? "orb" : c;
  }
  if (header.art) {
    const a = header.art.toLowerCase().trim();
    if (!["glow", "vignette", "dots", "grid", "rings", "diagonal", "none"].includes(a)) problems.push("Header: art must be glow, vignette, dots, grid, rings, diagonal or none.");
    else def.art = a;
  }
  if (problems.length) return null;

  const tf = buildTheme(def);
  const tc = def.paper ? buildTheme({ ...def, bg: def.paper, bg2: def.paper2 ?? def.paper }) : tf;
  return { name, styleName, st, tc, tf, cover };
}

function buildDeck(PptxGenJS, parsed) {
  const { header, slides } = parsed;
  const problems = [];
  const deckTitle = plain(slides[0]?.title ?? "Presentation");
  const look = resolveTheme(header, deckTitle, problems);
  if (!look) return { problems };

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deckTitle;
  pptx.author = "agent-cmd";
  pptx.theme = { headFontFace: look.tc.titleFont, bodyFontFace: look.tc.bodyFont };

  const footerText = header.footer === undefined ? deckTitle : /^(none|off|no|-)$/i.test(header.footer) ? "" : header.footer;
  const S = {
    pptx, tc: look.tc, tf: look.tf, t: look.tc, st: look.st, cover: look.cover, problems,
    palette: makePalette(look.tc, look.st), secNo: 0, feature: false,
    footer: footerText.length > 70 ? footerText.slice(0, 67) + "..." : footerText,
    org: plain(slides[0]?.org ?? ""), seed: hashStr(deckTitle),
  };
  S.num = (i) => numLabel(S.st.numFmt, i);

  for (const s of slides) {
    const sl = pptx.addSlide();
    S.feature = FEATURE.has(s.type);
    S.t = S.feature ? S.tf : S.tc;
    BUILDERS[s.type](sl, S, s);
    if (s.notes) sl.addNotes(s.notes);
  }
  return { pptx, problems, theme: { name: look.name, style: look.styleName } };
}

// ======================================================================
//  Saving
// ======================================================================
function safeName(name) {
  const n = path
    .basename(String(name || "presentation"))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\.pptx$/i, "")
    .replace(/\.+$/, "")
    .trim();
  return (n || "presentation") + ".pptx";
}

// If a file with that name is open in PowerPoint it is locked: save as "name (2).pptx" instead.
function saveUnique(dir, name, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const base = name.slice(0, -".pptx".length);
  for (let n = 1; n <= 20; n++) {
    const file = path.join(dir, n === 1 ? name : `${base} (${n}).pptx`);
    try {
      fs.writeFileSync(file, buffer);
      return file;
    } catch (err) {
      if (!["EBUSY", "EPERM", "EACCES"].includes(err.code)) throw err;
    }
  }
  throw new Error("the file is locked (is it open in PowerPoint?) and no other name was free");
}

// ======================================================================
//  Main function
// ======================================================================
// createPowerPoint(slideScript, "name.pptx") -> { ok, path, message }
// opts.dir  = folder to save in (default: Desktop)
// opts.open = open in PowerPoint when done (default: true on Windows)
// opts.play = start the slideshow right away (default: false)
export async function createPowerPoint(script, fileName, opts = {}) {
  try {
    const dir = opts.dir ?? path.join(os.homedir(), "Desktop");
    const open = opts.open ?? process.platform === "win32";
    const play = !!opts.play;

    let PptxGenJS;
    try {
      const mod = await import("pptxgenjs");
      PptxGenJS = mod.default?.default ?? mod.default ?? mod;
    } catch {
      return {
        ok: false,
        message: "NOT CREATED: the package pptxgenjs is not installed. Tell the user to run this in the project folder: npm install pptxgenjs  (do not try again before that)",
      };
    }

    if (typeof script !== "string" || !script.trim()) {
      return { ok: false, message: "NOT CREATED: the script is empty. Call create_powerpoint again with the WHOLE slide script in 'script'." };
    }

    const parsed = parseScript(script);
    checkSlides(parsed.slides, parsed.problems);
    if (!parsed.slides.length && !parsed.problems.length) parsed.problems.push('No slides found. Start every slide with a line like "=== bullets".');
    if (parsed.problems.length) {
      // also report header/theme mistakes now, so the AI can fix everything in one go
      const themeProblems = [];
      resolveTheme(parsed.header, plain(parsed.slides[0]?.title ?? ""), themeProblems);
      for (const p of themeProblems) if (!parsed.problems.includes(p)) parsed.problems.unshift(p);
      return { ok: false, message: "NOT CREATED. Fix these problems and call create_powerpoint again with the FULL script:\n- " + parsed.problems.join("\n- ") };
    }

    const deck = buildDeck(PptxGenJS, parsed);
    if (deck.problems.length) {
      return { ok: false, message: "NOT CREATED. Fix these problems and call create_powerpoint again with the FULL script:\n- " + deck.problems.join("\n- ") };
    }

    const buffer = await deck.pptx.write({ outputType: "nodebuffer" });
    const wanted = safeName(fileName);
    const file = saveUnique(dir, wanted, Buffer.from(buffer));
    if (open) {
      const cmd = play ? `start "" powerpnt.exe /S "${file}"` : `start "" "${file}"`;
      exec(cmd, { shell: "cmd.exe", windowsHide: true }, () => {});
    }

    const kinds = {};
    for (const s of parsed.slides) kinds[s.type] = (kinds[s.type] ?? 0) + 1;
    const list = Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ");
    let message = `OK: saved ${file} with ${parsed.slides.length} slides (${list}), theme "${deck.theme.name}" (${deck.theme.style} design).`;
    if (path.basename(file) !== wanted) message += ` The name ${wanted} was locked (open in PowerPoint), so it was saved under a new name.`;
    if (open) message += play ? " The slideshow was started." : " It was opened in PowerPoint.";
    return { ok: true, path: file, message };
  } catch (err) {
    return { ok: false, message: "NOT CREATED: " + err.message };
  }
}

// for tests / other programs
export const _internal = { parseScript, checkSlides, buildTheme, THEMES, STYLES, backgroundData, fit, lineCount };