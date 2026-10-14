// word.js - builds an ACADEMIC-style Word (.docx) file from Markdown text (thesis, assignment, report).
// Used by agent-cmd.js (tool: create_word).
// Needs: npm install docx @napi-rs/canvas      (@napi-rs/canvas is only used for charts/graphs)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  ImageRun,
  PageBreak,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  TableOfContents,
  WidthType,
  ShadingType,
  BorderStyle,
  TableLayoutType,
  VerticalAlign,
  UnderlineType,
  LineRuleType,
  LevelFormat,
  Footer,
  PageNumber,
} from "docx";

// ---- Look of the document (change these to restyle everything) ----
const FONT = "Times New Roman";
const CODE_FONT = "Courier New";
// Font sizes are in POINTS (pt) - this is what Word uses. (Word has no "px".)
const TITLE_PT = 16; // document title
const HEADING_PT = 14; // all headings
const BODY_PT = 12; // normal text, lists
const CAPTION_PT = 11; // "Figure 1: ..." and "Table 1: ..."
const TABLE_PT = 11; // text inside tables
const CODE_PT = 10; // code blocks
const hp = (pt) => pt * 2; // docx wants half-points
const LINE_SPACING = 360; // 240 = single, 360 = 1.5 lines, 480 = double
const TEXT = "000000"; // academic = black text
const GREY_LINE = "7F7F7F";
const HEADER_FILL = "E7E6E6"; // table header background
const PAGE_W = 11906; // A4 in DXA (1440 = 1 inch). For US Letter use 12240 x 15840.
const PAGE_H = 16838;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Chart look
const CHART_DISPLAY_W = 560; // width of the chart in the document (pixels at 96 dpi, ~5.8 inch)
const CH_W = 600; // chart drawing area (logical units)
const CH_H = 350;
const CH_SCALE = 3; // draw 3x bigger so the picture is sharp when printed
const CHART_COLORS = ["#1F4E79", "#C55A11", "#548235", "#7F7F7F", "#BF9000", "#7030A0", "#2E9CCA", "#A52A2A"];
const CHART_GRID = "#D9D9D9";

// The AI reads this together with the create_word tool description.
export const WORD_HELP =
  "\n\nWrite the document in Markdown, one element per line (use real new lines). " +
  "The program formats it in ACADEMIC style by itself (Times New Roman, 14 pt headings, 12 pt text, 1.5 line spacing, justified), " +
  "so NEVER write fonts, sizes or colours yourself.\n" +
  "# Title            the document title. Use it ONCE, as the FIRST line.\n" +
  "> subtitle         a line right after the title becomes the subtitle.\n" +
  "## Heading         main section heading (number it yourself, e.g. ## 1. Introduction).\n" +
  "### Sub-heading    sub-section heading (e.g. ### 1.1 Background).\n" +
  "Plain line         a paragraph (every line is its own paragraph, write full academic sentences).\n" +
  "- item             bullet point (indent 2 spaces for a sub-bullet).\n" +
  "1. item            numbered list.\n" +
  "Table: caption     (optional) put this line right BEFORE a table. It becomes 'Table 1: caption' above the table, numbered automatically.\n" +
  "| A | B |          table. First row = header, then a |---|---| line, then the rows.\n" +
  "> note             (not right after the title) an indented quotation / note block.\n" +
  "```ts ... ```      code block.\n" +
  "---                horizontal line.   [pagebreak]   starts a new page.\n" +
  "[center] text      a centred line (use it for the cover page: author, university, supervisor, date).\n" +
  "[space 3]          3 empty lines (to move cover page text down).\n" +
  "[toc]              table of contents (put it after the cover page, then [pagebreak]).\n" +
  "## References      after a heading named References / Bibliography every line becomes a hanging-indent reference. " +
  "Write ONE reference per line, in alphabetical order (APA or Harvard style).\n" +
  "Inside a line: **bold**, *italic*, `code`, [link text](https://example.com)\n" +
  "\nCHARTS / GRAPHS: write a chart block, the program draws the picture and puts it in the document as 'Figure 1: caption' (numbered automatically):\n" +
  "```chart\n" +
  "type: bar\n" +
  "caption: Sales by year\n" +
  "xlabel: Year\n" +
  "ylabel: Sales (million USD)\n" +
  "labels: 2021, 2022, 2023\n" +
  "Product A: 10, 20, 30\n" +
  "Product B: 5, 15, 25\n" +
  "```\n" +
  "  type: bar (grouped columns) | stacked (stacked columns) | line | pie | scatter.\n" +
  "  labels = the x-axis names. Every other 'Name: v1, v2, v3' line is one data series and MUST have exactly as many numbers as labels (plain numbers only, no units).\n" +
  "  caption, xlabel, ylabel, title are optional (use caption; skip title). Use '|' instead of ',' between labels if a label contains a comma.\n" +
  "  pie: write 'labels: A, B, C' and ONE series line 'Share: 50, 30, 20', or simply one line per slice: 'Apples: 50'.\n" +
  "  scatter: no labels, each series line holds points: 'Group A: (1,2), (2,4), (3,5)'.\n" +
  "  Chart numbers must be real data (with source) or clearly marked as illustrative in the caption. Never invent facts.";

// ---------- small helpers ----------

// Remove the Markdown marks from a text (used for table column widths and the document title).
function plain(s) {
  return String(s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();
}

// Inline formatting: **bold**, *italic*, `code`, [text](url)
const INLINE_SRC = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*(?=\S)(.+?)(?<=\S)\*\*|`([^`]+)`|\*(?=\S)(.+?)(?<=\S)\*/.source;

function inline(text, base = {}) {
  const re = new RegExp(INLINE_SRC, "g");
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    if (m[1] !== undefined) {
      parts.push(
        new ExternalHyperlink({
          link: m[2],
          children: [new TextRun({ ...base, text: m[1], color: "0563C1", underline: { type: UnderlineType.SINGLE } })],
        })
      );
    } else if (m[3] !== undefined) {
      parts.push(new TextRun({ ...base, text: m[3], bold: true }));
    } else if (m[4] !== undefined) {
      parts.push(
        new TextRun({
          ...base,
          text: m[4],
          font: CODE_FONT,
          size: (base.size ?? hp(BODY_PT)) - 2,
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEEEEE" },
        })
      );
    } else {
      parts.push(new TextRun({ ...base, text: m[5], italics: true }));
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(new TextRun({ ...base, text: text.slice(last) }));
  return parts.length ? parts : [new TextRun({ ...base, text: "" })];
}

function splitRow(line) {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return s
    .replace(/\\\|/g, "\u0000")
    .split("|")
    .map((c) => c.replace(/\u0000/g, "|").trim());
}

const spacer = () =>
  new Paragraph({ spacing: { before: 0, after: 0 }, run: { size: 8 }, children: [new TextRun({ text: "", size: 8 })] });

// ---------- building blocks ----------

function titlePara(text) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    children: inline(text),
  });
}

function subtitlePara(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    children: inline(text, { italics: true, size: hp(HEADING_PT) }),
  });
}

// "[center] text" - centred line (cover page)
function centerPara(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: inline(text),
  });
}

// "> note" - indented quotation block
function calloutPara(text) {
  return new Paragraph({
    spacing: { before: 120, after: 200, line: 276, lineRule: LineRuleType.AUTO },
    indent: { left: 720, right: 720 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: GREY_LINE, space: 8 } },
    children: inline(text, { size: hp(BODY_PT - 1) }),
  });
}

// "Figure 1: text" (below the picture) or "Table 1: text" (above the table)
function captionPara(label, number, text, above) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: above,
    spacing: { before: above ? 200 : 60, after: above ? 80 : 240, line: 240, lineRule: LineRuleType.AUTO },
    children: [
      new TextRun({ text: `${label} ${number}: `, bold: true, size: hp(CAPTION_PT) }),
      ...inline(text, { size: hp(CAPTION_PT) }),
    ],
  });
}

function codeBlock(codeLines) {
  const lines = codeLines.length ? codeLines : [""];
  return lines.map(
    (l, i) =>
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 200 : 0, line: 240, lineRule: LineRuleType.AUTO },
        indent: { left: 120, right: 120 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: GREY_LINE, space: 6 } },
        run: { font: CODE_FONT, size: hp(CODE_PT) },
        children: [new TextRun({ text: l.replace(/\t/g, "    "), font: CODE_FONT, size: hp(CODE_PT) })],
      })
  );
}

function buildTable(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  // Column width follows how much text the column holds (limited, so no column gets tiny or huge).
  const weights = Array(cols).fill(8);
  for (const r of rows) r.forEach((c, i) => (weights[i] = Math.max(weights[i], Math.min(40, plain(c).length))));
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((CONTENT_W * w) / total));
  widths[cols - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0); // fix rounding so the sum is exact

  // A column that holds only numbers is centred (looks neater in academic tables).
  const numeric = Array(cols).fill(rows.length > 1);
  rows.slice(1).forEach((r) => {
    for (let ci = 0; ci < cols; ci++) {
      if (!/^[$€£]?\s*[-+]?[\d.,]+\s*%?$/.test(plain(r[ci] ?? ""))) numeric[ci] = false;
    }
  });

  const line = { style: BorderStyle.SINGLE, size: 4, color: TEXT };
  const borders = { top: line, bottom: line, left: line, right: line };

  const trs = rows.map((r, ri) => {
    const header = ri === 0;
    const cells = [];
    for (let ci = 0; ci < cols; ci++) {
      cells.push(
        new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          borders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: header ? HEADER_FILL : "FFFFFF",
          },
          children: [
            new Paragraph({
              alignment: numeric[ci] ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
              children: inline(r[ci] ?? "", { size: hp(TABLE_PT), ...(header ? { bold: true } : {}) }),
            }),
          ],
        })
      );
    }
    return new TableRow({ tableHeader: header, cantSplit: true, children: cells });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: trs,
  });
}

// ---------- charts / graphs ----------

// ```chart block -> { spec, errors }. Format: "key: value" lines (see WORD_HELP).
function splitList(val) {
  const parts = val.includes("|") ? val.split("|") : val.split(/[;,]/);
  return parts.map((s) => s.trim()).filter((s) => s !== "");
}

function parseNumber(s) {
  const n = Number(String(s).replace(/[%$€£\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function parseChart(codeLines) {
  const spec = { type: "bar", title: "", caption: "", xlabel: "", ylabel: "", labels: [], series: [], number: 0 };
  const errors = [];
  const raw = []; // series lines: { name, text }

  for (const l of codeLines) {
    const line = l.trim();
    if (!line) continue;
    const m = line.match(/^([^:]+?)\s*:\s*(.*)$/);
    if (!m) {
      errors.push(`the line "${line}" must look like "name: value".`);
      continue;
    }
    const key = m[1].trim();
    const val = m[2].trim();
    switch (key.toLowerCase()) {
      case "type":
        spec.type = val.toLowerCase().replace(/[\s_-]/g, "").replace(/(chart|graph|plot)$/, "");
        break;
      case "title":
        spec.title = val;
        break;
      case "caption":
        spec.caption = val;
        break;
      case "xlabel":
        spec.xlabel = val;
        break;
      case "ylabel":
        spec.ylabel = val;
        break;
      case "labels":
        spec.labels = splitList(val);
        break;
      default:
        raw.push({ name: key, text: val });
    }
  }

  const aliases = { column: "bar", columns: "bar", bars: "bar", stackedbar: "stacked", stackedcolumn: "stacked", lines: "line", doughnut: "pie", donut: "pie" };
  spec.type = aliases[spec.type] ?? spec.type;
  if (!["bar", "stacked", "line", "pie", "scatter"].includes(spec.type)) {
    errors.push(`unknown chart type "${spec.type}". Use: bar, stacked, line, pie or scatter.`);
    return { spec, errors };
  }
  if (!raw.length) {
    errors.push("the chart has no data. Add lines like 'Series name: 10, 20, 30'.");
    return { spec, errors };
  }

  if (spec.type === "scatter") {
    for (const r of raw) {
      const pts = [];
      const re = /\(?\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*,\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)?/gi;
      let m;
      while ((m = re.exec(r.text))) pts.push({ x: Number(m[1]), y: Number(m[2]) });
      if (!pts.length) errors.push(`series "${r.name}": write points like (1,2), (2,4), (3,5).`);
      else spec.series.push({ name: r.name, points: pts });
    }
    return { spec, errors };
  }

  // numbers
  const series = [];
  for (const r of raw) {
    const vals = splitList(r.text).map(parseNumber);
    if (!vals.length || vals.some((v) => Number.isNaN(v))) {
      errors.push(`series "${r.name}" must contain only numbers, e.g. "${r.name}: 10, 20, 30".`);
      continue;
    }
    series.push({ name: r.name, values: vals });
  }
  if (errors.length) return { spec, errors };

  if (spec.type === "pie") {
    if (spec.labels.length) {
      const s = series[0];
      if (s.values.length !== spec.labels.length)
        errors.push(`pie: ${spec.labels.length} labels but ${s.values.length} numbers in "${s.name}".`);
      else spec.slices = spec.labels.map((label, i) => ({ label, value: s.values[i] }));
    } else {
      if (series.some((s) => s.values.length !== 1))
        errors.push("pie: write 'labels: A, B, C' and one series 'Share: 50, 30, 20' - or one line per slice like 'Apples: 50'.");
      else spec.slices = series.map((s) => ({ label: s.name, value: s.values[0] }));
    }
    if (!errors.length) {
      if (spec.slices.some((s) => s.value < 0)) errors.push("pie: values cannot be negative.");
      else if (!(spec.slices.reduce((a, s) => a + s.value, 0) > 0)) errors.push("pie: the values add up to zero.");
    }
    return { spec, errors };
  }

  // bar / stacked / line
  if (!spec.labels.length) {
    errors.push("add a line 'labels: A, B, C' with the x-axis names.");
    return { spec, errors };
  }
  for (const s of series) {
    if (s.values.length !== spec.labels.length)
      errors.push(`series "${s.name}" has ${s.values.length} numbers but there are ${spec.labels.length} labels. They must match.`);
  }
  if (spec.type === "stacked" && series.some((s) => s.values.some((v) => v < 0)))
    errors.push("stacked: values cannot be negative. Use type bar instead.");
  spec.series = series;
  return { spec, errors };
}

// "Nice" axis numbers (0, 20, 40 ... instead of 0, 17.3, 34.6)
function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range));
  const f = range / Math.pow(10, exp);
  let nf;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

function niceScale(min, max, maxTicks = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    if (min === 0) max = 1;
    else if (min > 0) min = 0;
    else max = 0;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (maxTicks - 1), true);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

function fmtNum(n) {
  const v = Number(Number(n).toPrecision(10));
  return v.toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) < 1 ? 4 : 2 });
}

function chartFont(ctx, px, style = "") {
  ctx.font = `${style ? style + " " : ""}${px}px "Times New Roman", Times, serif`;
}

function ellipsize(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + "\u2026").width > maxW) s = s.slice(0, -1);
  return s + "\u2026";
}

// Split a label into up to maxLines lines that fit maxW (current ctx font).
function wrapText(ctx, text, maxW, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, maxLines);
  if (lines.length > maxLines) out[maxLines - 1] += " \u2026";
  return out.map((l) => ellipsize(ctx, l, maxW));
}

function drawMarker(ctx, kind, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (kind % 4) {
    case 0:
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 1:
      ctx.rect(x - r, y - r, 2 * r, 2 * r);
      break;
    case 2:
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r * 0.9);
      ctx.lineTo(x - r * 1.1, y + r * 0.9);
      ctx.closePath();
      break;
    default:
      ctx.moveTo(x, y - r * 1.3);
      ctx.lineTo(x + r * 1.3, y);
      ctx.lineTo(x, y + r * 1.3);
      ctx.lineTo(x - r * 1.3, y);
      ctx.closePath();
  }
  ctx.fill();
}

// Legend rows that fit into maxW.
function layoutLegend(ctx, names, maxW) {
  chartFont(ctx, 12);
  const rows = [];
  let row = [];
  let rw = 0;
  names.forEach((name, i) => {
    const w = 26 + ctx.measureText(name).width + 16;
    if (row.length && rw + w > maxW) {
      rows.push({ items: row, w: rw });
      row = [];
      rw = 0;
    }
    row.push({ name, i, w });
    rw += w;
  });
  if (row.length) rows.push({ items: row, w: rw });
  return rows;
}

function drawLegend(ctx, rows, yTop, withLine, kind) {
  chartFont(ctx, 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  rows.forEach((row, ri) => {
    let x = (CH_W - row.w) / 2;
    const y = yTop + ri * 18 + 9;
    for (const it of row.items) {
      const color = CHART_COLORS[it.i % CHART_COLORS.length];
      if (withLine) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 20, y);
        ctx.stroke();
        drawMarker(ctx, kind === "scatter" ? it.i : it.i, x + 10, y, 3.5, color);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x + 3, y - 6, 12, 12);
      }
      ctx.fillStyle = TEXT_HEX;
      ctx.fillText(it.name, x + 24, y);
      x += it.w;
    }
  });
}

const TEXT_HEX = "#000000";

function drawTitle(ctx, spec) {
  if (!spec.title) return;
  chartFont(ctx, 15, "bold");
  ctx.fillStyle = TEXT_HEX;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(ellipsize(ctx, spec.title, CH_W - 20), CH_W / 2, 24);
}

// bar / stacked / line charts (labels on the x-axis)
function drawCategorical(ctx, spec) {
  const n = spec.labels.length;
  const S = spec.series;
  const stacked = spec.type === "stacked";
  const isLine = spec.type === "line";

  let dmin = Infinity;
  let dmax = -Infinity;
  if (stacked) {
    dmin = 0;
    for (let j = 0; j < n; j++) dmax = Math.max(dmax, S.reduce((a, s) => a + s.values[j], 0));
  } else {
    for (const s of S) for (const v of s.values) {
      dmin = Math.min(dmin, v);
      dmax = Math.max(dmax, v);
    }
  }
  let lo = Math.min(0, dmin);
  const hi = Math.max(0, dmax);
  if (isLine && dmin > 0 && dmin / dmax > 0.6) lo = dmin; // line chart of big numbers: do not start at 0
  const scale = niceScale(lo, hi);

  // layout
  chartFont(ctx, 11);
  const yLabelsW = Math.max(...scale.ticks.map((t) => ctx.measureText(fmtNum(t)).width));
  const left = 12 + (spec.ylabel ? 16 : 0) + yLabelsW + 8;
  const right = 18;
  const top = spec.title ? 40 : 18;
  const plotW = CH_W - left - right;
  const slot = plotW / n;

  const wrapped = spec.labels.map((l) => wrapText(ctx, l, slot - 4, 3));
  const labelLines = Math.max(...wrapped.map((w) => w.length));
  const xLabelsH = labelLines * 13 + 8;
  const xTitleH = spec.xlabel ? 18 : 0;
  const legendRows = S.length > 1 ? layoutLegend(ctx, S.map((s) => s.name), CH_W - 30) : [];
  const legendH = legendRows.length ? legendRows.length * 18 + 8 : 0;
  const bottom = xLabelsH + xTitleH + legendH + 8;
  const plotH = CH_H - top - bottom;
  const yOf = (v) => top + plotH * (1 - (v - scale.min) / (scale.max - scale.min));

  drawTitle(ctx, spec);

  // grid + y labels
  chartFont(ctx, 11);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 0.75;
  for (const t of scale.ticks) {
    const y = yOf(t);
    ctx.strokeStyle = CHART_GRID;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = TEXT_HEX;
    ctx.fillText(fmtNum(t), left - 6, y);
  }

  // axes
  const yZero = yOf(Math.max(scale.min, Math.min(0, scale.max)));
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotH);
  ctx.moveTo(left, yZero);
  ctx.lineTo(left + plotW, yZero);
  ctx.stroke();

  // data
  if (isLine) {
    S.forEach((s, si) => {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.values.forEach((v, j) => {
        const x = left + slot * (j + 0.5);
        if (j === 0) ctx.moveTo(x, yOf(v));
        else ctx.lineTo(x, yOf(v));
      });
      ctx.stroke();
      s.values.forEach((v, j) => drawMarker(ctx, si, left + slot * (j + 0.5), yOf(v), 3.5, color));
    });
  } else if (stacked) {
    const bw = Math.min(slot * 0.6, 70);
    for (let j = 0; j < n; j++) {
      const x = left + slot * (j + 0.5) - bw / 2;
      let acc = 0;
      S.forEach((s, si) => {
        const v = s.values[j];
        ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
        ctx.fillRect(x, yOf(acc + v), bw, yOf(acc) - yOf(acc + v));
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, yOf(acc + v), bw, yOf(acc) - yOf(acc + v));
        acc += v;
      });
    }
  } else {
    const groupW = Math.min(slot * 0.74, 28 * S.length + 20);
    const bw = groupW / S.length;
    const showValues = n * S.length <= 16;
    for (let j = 0; j < n; j++) {
      const gx = left + slot * (j + 0.5) - groupW / 2;
      S.forEach((s, si) => {
        const v = s.values[j];
        const x = gx + si * bw;
        const y1 = yOf(v);
        ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
        ctx.fillRect(x + 1, Math.min(y1, yZero), bw - 2, Math.abs(yZero - y1));
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, Math.min(y1, yZero), bw - 2, Math.abs(yZero - y1));
        if (showValues) {
          chartFont(ctx, 10);
          ctx.fillStyle = TEXT_HEX;
          ctx.textAlign = "center";
          ctx.textBaseline = v >= 0 ? "bottom" : "top";
          ctx.fillText(fmtNum(v), x + bw / 2, v >= 0 ? y1 - 2 : y1 + 2);
        }
      });
    }
  }

  // x labels
  chartFont(ctx, 11);
  ctx.fillStyle = TEXT_HEX;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wrapped.forEach((lines, j) => {
    lines.forEach((ln, k) => ctx.fillText(ln, left + slot * (j + 0.5), top + plotH + 14 + k * 13));
  });

  // axis titles
  chartFont(ctx, 12, "italic");
  ctx.fillStyle = TEXT_HEX;
  if (spec.xlabel) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(ellipsize(ctx, spec.xlabel, plotW), left + plotW / 2, top + plotH + xLabelsH + 13);
  }
  if (spec.ylabel) {
    ctx.save();
    ctx.translate(14, top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ellipsize(ctx, spec.ylabel, plotH), 0, 0);
    ctx.restore();
  }

  if (legendRows.length) drawLegend(ctx, legendRows, CH_H - legendH, isLine, "line");
}

// scatter plot (numbers on both axes)
function drawScatter(ctx, spec) {
  const S = spec.series;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const s of S) for (const p of s.points) {
    xmin = Math.min(xmin, p.x);
    xmax = Math.max(xmax, p.x);
    ymin = Math.min(ymin, p.y);
    ymax = Math.max(ymax, p.y);
  }
  const xs = niceScale(xmin, xmax);
  const ys = niceScale(ymin, ymax);

  chartFont(ctx, 11);
  const yLabelsW = Math.max(...ys.ticks.map((t) => ctx.measureText(fmtNum(t)).width));
  const left = 12 + (spec.ylabel ? 16 : 0) + yLabelsW + 8;
  const right = 22;
  const top = spec.title ? 40 : 18;
  const plotW = CH_W - left - right;
  const legendRows = S.length > 1 ? layoutLegend(ctx, S.map((s) => s.name), CH_W - 30) : [];
  const legendH = legendRows.length ? legendRows.length * 18 + 8 : 0;
  const bottom = 22 + (spec.xlabel ? 18 : 0) + legendH + 8;
  const plotH = CH_H - top - bottom;
  const xOf = (v) => left + plotW * ((v - xs.min) / (xs.max - xs.min));
  const yOf = (v) => top + plotH * (1 - (v - ys.min) / (ys.max - ys.min));

  drawTitle(ctx, spec);

  ctx.lineWidth = 0.75;
  ctx.strokeStyle = CHART_GRID;
  chartFont(ctx, 11);
  ctx.fillStyle = TEXT_HEX;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of ys.ticks) {
    ctx.strokeStyle = CHART_GRID;
    ctx.beginPath();
    ctx.moveTo(left, yOf(t));
    ctx.lineTo(left + plotW, yOf(t));
    ctx.stroke();
    ctx.fillStyle = TEXT_HEX;
    ctx.fillText(fmtNum(t), left - 6, yOf(t));
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const t of xs.ticks) {
    ctx.strokeStyle = CHART_GRID;
    ctx.beginPath();
    ctx.moveTo(xOf(t), top);
    ctx.lineTo(xOf(t), top + plotH);
    ctx.stroke();
    ctx.fillStyle = TEXT_HEX;
    ctx.fillText(fmtNum(t), xOf(t), top + plotH + 14);
  }

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, plotW, plotH);

  S.forEach((s, si) => {
    const color = CHART_COLORS[si % CHART_COLORS.length];
    for (const p of s.points) drawMarker(ctx, si, xOf(p.x), yOf(p.y), 4, color);
  });

  chartFont(ctx, 12, "italic");
  ctx.fillStyle = TEXT_HEX;
  if (spec.xlabel) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(ellipsize(ctx, spec.xlabel, plotW), left + plotW / 2, top + plotH + 32);
  }
  if (spec.ylabel) {
    ctx.save();
    ctx.translate(14, top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ellipsize(ctx, spec.ylabel, plotH), 0, 0);
    ctx.restore();
  }
  if (legendRows.length) drawLegend(ctx, legendRows, CH_H - legendH, true, "scatter");
}

// pie chart with the legend on the right
function drawPie(ctx, spec) {
  const slices = spec.slices;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const names = slices.map((s) => `${s.label} (${((s.value / total) * 100).toFixed(1)}%)`);

  chartFont(ctx, 12);
  const legendW = Math.min(250, Math.max(...names.map((n) => ctx.measureText(n).width)) + 26);
  const top = spec.title ? 40 : 14;
  const areaH = CH_H - top - 12;
  const areaW = CH_W - legendW - 30;
  const r = Math.max(40, Math.min(areaH / 2, areaW / 2, 140));
  const cx = 10 + areaW / 2;
  const cy = top + areaH / 2;

  drawTitle(ctx, spec);

  let a0 = -Math.PI / 2;
  slices.forEach((s, i) => {
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (s.value / total >= 0.05) {
      const am = (a0 + a1) / 2;
      chartFont(ctx, 12, "bold");
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round((s.value / total) * 100)}%`, cx + Math.cos(am) * r * 0.65, cy + Math.sin(am) * r * 0.65);
    }
    a0 = a1;
  });

  // legend (column on the right)
  const rowH = Math.min(22, (areaH - 4) / slices.length);
  const lx = CH_W - legendW - 12;
  const ly = top + (areaH - rowH * slices.length) / 2;
  chartFont(ctx, 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  names.forEach((nm, i) => {
    const y = ly + i * rowH + rowH / 2;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(lx, y - 6, 12, 12);
    ctx.fillStyle = TEXT_HEX;
    ctx.fillText(ellipsize(ctx, nm, legendW - 20), lx + 18, y);
  });
}

// The drawing library is loaded only when a chart is really needed (documents without charts work without it).
let createCanvasFn = null;
async function loadCanvas() {
  if (createCanvasFn) return createCanvasFn;
  try {
    const mod = await import("@napi-rs/canvas");
    createCanvasFn = mod.createCanvas ?? mod.default?.createCanvas ?? null;
  } catch {}
  if (!createCanvasFn)
    throw new Error(
      "charts need the package @napi-rs/canvas. Tell the user to run this in the project folder: npm install @napi-rs/canvas  (do not try again before that)"
    );
  return createCanvasFn;
}

async function renderChart(spec) {
  const createCanvas = await loadCanvas();
  const canvas = createCanvas(CH_W * CH_SCALE, CH_H * CH_SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(CH_SCALE, CH_SCALE);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CH_W, CH_H);
  if (spec.type === "pie") drawPie(ctx, spec);
  else if (spec.type === "scatter") drawScatter(ctx, spec);
  else drawCategorical(ctx, spec);
  return canvas.toBuffer("image/png");
}

// chart placeholder -> picture paragraph (+ caption)
async function chartBlock(spec) {
  const png = await renderChart(spec);
  const w = CHART_DISPLAY_W;
  const h = Math.round((w * CH_H) / CH_W);
  const desc = spec.caption || spec.title || `${spec.type} chart`;
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: !!spec.caption,
      spacing: { before: 200, after: 60, line: 240, lineRule: LineRuleType.AUTO },
      children: [
        new ImageRun({
          type: "png",
          data: png,
          transformation: { width: w, height: h },
          altText: { title: desc, description: desc, name: "chart" },
        }),
      ],
    }),
  ];
  out.push(spec.caption ? captionPara("Figure", spec.number, spec.caption, false) : spacer());
  return out;
}

// ---------- Markdown -> docx elements ----------

function buildBody(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const body = [];
  const stats = { headings: 0, paragraphs: 0, bullets: 0, numbered: 0, tables: 0, code: 0, charts: 0, toc: false };
  const problems = [];
  const H = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
  let title = "";
  let titleFirst = false;
  let last = ""; // kind of the previous block (title, subtitle, bullet, number, table ...)
  let listNo = 0; // each new numbered list restarts at 1
  let tableNo = 0;
  let figureNo = 0;
  let inRefs = false; // true after a "References" heading
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");
    const t = line.trim();
    let m;

    if (!t) {
      i++;
      continue;
    }

    // code block (or chart block)
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim().toLowerCase();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++; // closing fence
      if (lang === "chart") {
        const { spec, errors } = parseChart(code);
        if (errors.length) {
          problems.push(`Chart ${stats.charts + 1}: ` + errors.join(" "));
        } else {
          if (spec.caption) spec.number = ++figureNo;
          body.push({ __chart: spec });
        }
        stats.charts++;
        last = "chart";
      } else {
        body.push(...codeBlock(code));
        stats.code++;
        last = "code";
      }
      continue;
    }

    // table caption: "Table: text" right before a table
    if ((m = t.match(/^table\s*:\s*(.+)$/i))) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && lines[j].trim().startsWith("|")) {
        body.push(captionPara("Table", ++tableNo, m[1].trim(), true));
        i = j; // continue with the table itself
        continue;
      }
    }

    // table
    if (t.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i]);
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells); // skip the |---|---| line
        i++;
      }
      if (rows.length) {
        body.push(buildTable(rows), spacer());
        stats.tables++;
      }
      last = "table";
      continue;
    }

    // page break / horizontal line
    if (/^\[pagebreak\]$/i.test(t) || /^-{2,}\s*page\s*-{2,}$/i.test(t)) {
      body.push(new Paragraph({ children: [new PageBreak()] }));
      last = "break";
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      body.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREY_LINE, space: 1 } },
          children: [],
        })
      );
      last = "rule";
      i++;
      continue;
    }

    // [toc] table of contents
    if (/^\[toc\]$/i.test(t)) {
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          spacing: { before: 0, after: 240 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: hp(HEADING_PT) })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" })
      );
      stats.toc = true;
      last = "toc";
      i++;
      continue;
    }

    // [space] / [space 3] empty lines
    if ((m = t.match(/^\[space(?:\s+(\d+))?\]$/i))) {
      const n = Math.min(15, Math.max(1, Number(m[1] || 1)));
      for (let k = 0; k < n; k++) body.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "" })] }));
      last = "space";
      i++;
      continue;
    }

    // [center] centred line
    if ((m = t.match(/^\[cent(?:er|re)\]\s*(.*)$/i))) {
      body.push(centerPara(m[1]));
      stats.paragraphs++;
      last = "center";
      i++;
      continue;
    }

    // headings
    if ((m = t.match(/^(#{1,6})\s+(.+)$/))) {
      const level = m[1].length;
      const text = m[2].trim();
      if (level === 1 && !title) {
        title = plain(text);
        titleFirst = body.length === 0;
        body.push(titlePara(text));
        last = "title";
      } else {
        const idx = level <= 2 ? 0 : level === 3 ? 1 : 2; // ## -> Heading 1, ### -> Heading 2, #### -> Heading 3
        body.push(new Paragraph({ heading: H[idx], children: inline(text) }));
        stats.headings++;
        inRefs = /^(\d+(\.\d+)*[.)]?\s*)?(references?|reference list|bibliography|works cited|sources)\b/i.test(plain(text));
        last = "heading";
      }
      i++;
      continue;
    }

    // subtitle (right after the title) or note box
    if ((m = t.match(/^>\s?(.*)$/))) {
      if (last === "title") {
        body.push(subtitlePara(m[1]));
        last = "subtitle";
      } else {
        body.push(calloutPara(m[1]));
        stats.paragraphs++;
        last = "callout";
      }
      i++;
      continue;
    }

    // bullets
    if ((m = line.match(/^(\s*)[-*•]\s+(.+)$/))) {
      const level = m[1].replace(/\t/g, "  ").length >= 2 ? 1 : 0;
      body.push(
        new Paragraph({
          numbering: { reference: "bullets", level },
          spacing: { after: 60 },
          children: inline(m[2].trim()),
        })
      );
      stats.bullets++;
      last = "bullet";
      i++;
      continue;
    }

    // numbered list
    if ((m = line.match(/^(\s*)\d+[.)]\s+(.+)$/))) {
      const level = m[1].replace(/\t/g, "  ").length >= 2 ? 1 : 0;
      if (last !== "number") listNo++;
      body.push(
        new Paragraph({
          numbering: { reference: "numbers", level, instance: listNo },
          spacing: { after: 60 },
          children: inline(m[2].trim()),
        })
      );
      stats.numbered++;
      last = "number";
      i++;
      continue;
    }

    // normal paragraph (inside References: hanging indent)
    if (inRefs) {
      body.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 720, hanging: 720 },
          spacing: { after: 120 },
          children: inline(t),
        })
      );
    } else {
      body.push(new Paragraph({ children: inline(t) }));
    }
    stats.paragraphs++;
    last = "paragraph";
    i++;
  }

  if (stats.headings > 0 && !title) problems.push("The document has no title. The FIRST line must be '# Your Title'.");
  else if (title && !titleFirst) problems.push("The title must be the very first line of the content.");

  return { body, title, stats, problems };
}

// ---------- saving ----------

function safeName(name) {
  const n = path
    .basename(String(name || "document"))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\.docx$/i, "")
    .replace(/\.+$/, "")
    .trim();
  return (n || "document") + ".docx";
}

// If a file with that name is open in Word it is locked: save as "name (2).docx" instead.
function saveUnique(dir, name, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const base = name.slice(0, -".docx".length);
  for (let n = 1; n <= 20; n++) {
    const file = path.join(dir, n === 1 ? name : `${base} (${n}).docx`);
    try {
      fs.writeFileSync(file, buffer);
      return file;
    } catch (err) {
      if (!["EBUSY", "EPERM", "EACCES"].includes(err.code)) throw err;
    }
  }
  throw new Error("the file is locked (is it open in Word?) and no other name was free");
}

// ---------- main function ----------

// createWord(markdownText, "name.docx") -> { ok, path, message }
// opts.dir  = folder to save in (default: Desktop)      opts.open = open in Word when done (default: true on Windows)
export async function createWord(markdown, fileName, opts = {}) {
  try {
    const dir = opts.dir ?? path.join(os.homedir(), "Desktop");
    const open = opts.open ?? process.platform === "win32";

    let md = typeof markdown === "string" ? markdown : "";
    // some models send a literal backslash-n instead of a real new line
    if (!md.includes("\n") && md.includes("\\n")) md = md.replace(/\\n/g, "\n");

    const { body, title, stats, problems } = buildBody(md);
    if (!body.length) {
      return {
        ok: false,
        message:
          "NOT CREATED: the content is empty. Call create_word again with the WHOLE document written in 'content'.",
      };
    }
    if (problems.length) {
      return { ok: false, message: "NOT CREATED. Fix these problems and call create_word again with the FULL content:\n- " + problems.join("\n- ") };
    }

    // draw the charts (placeholders -> pictures)
    const children = [];
    for (const item of body) {
      if (item && item.__chart) children.push(...(await chartBlock(item.__chart)));
      else children.push(item);
    }

    const lvl = (n, format, text, left) => ({
      level: n,
      format,
      text,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left, hanging: 360 } } },
    });

    const headingBase = (before, after) => ({
      spacing: { before, after, line: LINE_SPACING, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.LEFT,
      keepNext: true,
    });

    const doc = new Document({
      creator: "agent-cmd",
      title: title || "Document",
      ...(stats.toc ? { features: { updateFields: true } } : {}),
      styles: {
        default: {
          document: {
            run: { font: FONT, size: hp(BODY_PT), color: TEXT },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 160, line: LINE_SPACING, lineRule: LineRuleType.AUTO },
            },
          },
          title: {
            run: { font: FONT, size: hp(TITLE_PT), bold: true, color: TEXT },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200, line: 240, lineRule: LineRuleType.AUTO } },
          },
          heading1: {
            run: { font: FONT, size: hp(HEADING_PT), bold: true, italics: false, color: TEXT },
            paragraph: { ...headingBase(360, 120), outlineLevel: 0 },
          },
          heading2: {
            run: { font: FONT, size: hp(HEADING_PT), bold: true, italics: true, color: TEXT },
            paragraph: { ...headingBase(280, 100), outlineLevel: 1 },
          },
          heading3: {
            run: { font: FONT, size: hp(HEADING_PT), bold: false, italics: true, color: TEXT },
            paragraph: { ...headingBase(240, 80), outlineLevel: 2 },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [lvl(0, LevelFormat.BULLET, "\u2022", 720), lvl(1, LevelFormat.BULLET, "\u2013", 1440)],
          },
          {
            reference: "numbers",
            levels: [lvl(0, LevelFormat.DECIMAL, "%1.", 720), lvl(1, LevelFormat.LOWER_LETTER, "%2.", 1440)],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: PAGE_W, height: PAGE_H },
              margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ children: [PageNumber.CURRENT], size: hp(10) })],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const wanted = safeName(fileName);
    const file = saveUnique(dir, wanted, buffer);
    if (open) exec(`start "" "${file}"`, { shell: "cmd.exe", windowsHide: true }, () => {});

    const parts = [];
    if (stats.headings) parts.push(`${stats.headings} headings`);
    if (stats.paragraphs) parts.push(`${stats.paragraphs} paragraphs`);
    if (stats.bullets + stats.numbered) parts.push(`${stats.bullets + stats.numbered} list items`);
    if (stats.tables) parts.push(`${stats.tables} tables`);
    if (stats.charts) parts.push(`${stats.charts} charts`);
    if (stats.code) parts.push(`${stats.code} code blocks`);
    let message = `OK: saved ${file}${title ? ` (title: "${title}")` : ""} with ${parts.join(", ") || "no content"}.`;
    if (path.basename(file) !== wanted) message += ` The name ${wanted} was locked (open in Word), so it was saved under a new name.`;
    if (stats.toc) message += " The table of contents fills in when Word asks to update fields (the user clicks Yes).";
    message += open ? " It was opened in Word." : "";
    return { ok: true, path: file, message };
  } catch (err) {
    return { ok: false, message: "NOT CREATED: " + err.message };
  }
}