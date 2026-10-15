// spreadsheet.js - builds a DESIGNED Excel (.xlsx) and/or .csv file from a short "sheet script".
// Used by agent-cmd.js (tool: create_spreadsheet).
// Needs: npm install exceljs            (for .xlsx; .csv needs nothing)
//        npm install @napi-rs/canvas    (ONLY if you use "chart:" lines; same package word.js uses)
//
// What it does for you:
//   * 8 colour themes, title + subtitle banner, KPI cards, styled header, zebra rows, borders, frozen header, filters
//   * real numbers: $1,200  Rs 5,000  15%  2025-03-01  =B2*C2  [link](https://...)
//   * formulas are written as if the header row is row 1 - the program moves them to the right rows by itself
//   * formulas are also CALCULATED here, so totals, KPI cards, charts and .csv files show real values
//   * total rows (sum / avg / min / max / count), conditional formatting (highlight, colour scales, data bars),
//     dropdown lists and number validation, column widths, hyperlinks, notes, print setup, right-to-left text
//   * charts (bar, stacked, line, pie) drawn as pictures next to the table
//   * several sheets, formulas between sheets (Sheet2!B5), .csv per sheet

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";

// ======================================================================
//  Look
// ======================================================================
const FONTS = ["Calibri", "Arial", "Cambria", "Georgia", "Segoe UI", "Consolas", "Times New Roman", "Verdana", "Tahoma"];

// head = header/title colour, acc = accent, acc2 = second accent, zebra = alternate row, light = KPI cards / total row
const THEMES = {
  blue: { head: "1F3864", acc: "2F5597", acc2: "ED7D31", zebra: "F2F5FA", light: "DCE6F5", mood: "business, finance, reports (default)" },
  green: { head: "1E5631", acc: "2E8B57", acc2: "F2A900", zebra: "F1F8F3", light: "D9EEDD", mood: "money, health, nature, growth" },
  teal: { head: "0E4A52", acc: "1C9C8C", acc2: "E9A23B", zebra: "F0F8F7", light: "D3EDEA", mood: "operations, sustainability, clinics" },
  purple: { head: "3B2667", acc: "6B46C1", acc2: "F59E0B", zebra: "F6F2FC", light: "E4DAF5", mood: "creative, marketing, education" },
  red: { head: "7A1620", acc: "C0392B", acc2: "2F5597", zebra: "FCF3F2", light: "F6D9D5", mood: "sales, alerts, expenses" },
  orange: { head: "9A3F0B", acc: "E8731A", acc2: "1F3864", zebra: "FEF6EE", light: "FBE3CC", mood: "events, food, energy" },
  slate: { head: "1F2937", acc: "4B5563", acc2: "F59E0B", zebra: "F3F4F6", light: "E0E3E8", mood: "engineering, logs, neutral data" },
  mono: { head: "111111", acc: "444444", acc2: "888888", zebra: "F5F5F5", light: "E5E5E5", mood: "black and white, print" },
};

const FORMATS = {
  currency: '"$"#,##0.00', usd: '"$"#,##0.00', eur: '"€"#,##0.00', gbp: '"£"#,##0.00', pkr: '"Rs "#,##0',
  percent: "0.0%", number: "#,##0.##", integer: "#,##0", decimal: "0.00", date: "yyyy-mm-dd", datetime: "yyyy-mm-dd hh:mm", text: "@",
};

const HL = {
  red: { bg: "FFC7CE", fg: "9C0006" }, green: { bg: "C6EFCE", fg: "006100" }, yellow: { bg: "FFEB9C", fg: "9C5700" },
  orange: { bg: "FFD8A8", fg: "7C3A00" }, blue: { bg: "BDD7EE", fg: "1F3864" }, grey: { bg: "D9D9D9", fg: "404040" },
};
const CHART_COLORS = ["#2F5597", "#ED7D31", "#548235", "#7F7F7F", "#BF9000", "#7030A0", "#2E9CCA", "#A52A2A"];
const MAX_ROWS = 3000;

// ======================================================================
//  Text the AI reads together with the create_spreadsheet tool description
// ======================================================================
export const SPREADSHEET_HELP =
  "\n\nWrite the spreadsheet as a SCRIPT (plain text, real new lines). The program does ALL the design " +
  "(colours, fonts, borders, header, zebra rows, widths, frozen header, filters), so NEVER write colours or fonts per cell.\n\n" +
  "GLOBAL LINES (optional, anywhere before the tables):\n" +
  "theme: " + Object.keys(THEMES).join(" | ") + "      pick one that fits the topic (default blue). " + Object.entries(THEMES).map(([k, v]) => `${k}=${v.mood}`).join("; ") + "\n" +
  "font: " + FONTS.join(" | ") + "      optional\n\n" +
  "PER SHEET (use one 'sheet:' line per sheet; a single sheet needs none):\n" +
  "sheet: Sales              sheet name (max 31 characters)\n" +
  "title: Q3 Sales Report    big banner at the top (optional)        subtitle: Prepared for the board   (optional)\n" +
  "kpi: Total Revenue | =SUM(C2:C20) | currency     KPI card above the table (max 6). Format is optional. Value can be a number or a formula.\n" +
  "| Product | Q1 | Q2 | Total |        THE TABLE. First row = header, then a |---|---| line, then the data rows.\n" +
  "| Apples | 10 | 20 | =B2+C2 |        numbers are real numbers. $1,200 or Rs 5,000 = currency, 15% = percent, 2025-03-01 = date.\n" +
  "                         [Docs](https://example.com) in a cell = a clickable link.   Use <br> for a line break inside a cell.\n" +
  "FORMULAS: start with = and use Excel functions. Write cell addresses AS IF THE HEADER ROW WERE ROW 1 (first data row = 2, column A = first column). " +
  "The program moves them to the real rows itself. Formulas between sheets: =Sales!B5 or ='Q3 Sales'!B5. " +
  "Fill formulas in EVERY row (=B2+C2, =B3+C3, ...). Do not use 'total:' AND a manual total row together.\n" +
  "format: B=currency, C=percent, D=date     force a column format. Allowed: " + Object.keys(FORMATS).join(", ") + "\n" +
  "total: yes                 adds a bottom Total row (SUM of every all-number column).  Or choose: total: B=sum, C=avg, D=max  (sum avg min max count)\n" +
  "highlight: C > 100 | red   colour cells by a rule. Operators: > < >= <= = !=   Colours: red green yellow orange blue grey. Text works too:  D = Late | red\n" +
  "scale: C                   colour scale (light to accent) on column C.   scale3: C = red-yellow-green.   databar: B = bars inside cells\n" +
  "validate: D=list(Yes,No,Maybe)     dropdown list.   validate: E=number(0,100)   only numbers between 0 and 100.   validate: F=date\n" +
  "chart: bar | A | B,C | Sales by quarter     a chart picture next to the table. Format: type | label column | value column(s) | title.\n" +
  "                         types: bar, stacked, line, pie. Pie uses ONE value column. Needs real numbers or formulas.\n" +
  "widths: A=30, C=14         optional column widths      freeze: yes | no | first-col      filter: yes | no      note: a small note under the table\n\n" +
  "FILES: file_name ending .xlsx = Excel, .csv = CSV. format 'both' saves both. A .csv has only the header and data rows (no title, no KPI cards, no chart).\n" +
  "RULES: ONE table per sheet. Never invent statistics: use data the user gave, or mark it clearly as sample data in the subtitle. " +
  "Prefer formulas over typed totals so the file stays live. Keep headers short. Max " + MAX_ROWS + " rows.\n" +
  "EXAMPLE:\n" +
  "theme: green\nsheet: Budget\ntitle: Monthly Budget\nsubtitle: Sample data\nkpi: Total spent | =SUM(C2:C5) | currency\n" +
  "| Item | Planned | Spent | Left |\n|---|---|---|---|\n| Rent | $900 | $900 | =B2-C2 |\n| Food | $400 | $455 | =B3-C3 |\n| Fuel | $120 | $98 | =B4-C4 |\n| Fun | $150 | $210 | =B5-C5 |\n" +
  "total: yes\nhighlight: D < 0 | red\ndatabar: C\nchart: bar | A | B,C | Planned vs spent";

// ======================================================================
//  Small helpers
// ======================================================================
const colLetter = (n) => {
  let s = "";
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const colIndex = (L) => L.toUpperCase().split("").reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const stripMd = (s) => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/<br\s*\/?>/gi, "\n").trim();
const FN_FMT = { sum: "SUM", avg: "AVERAGE", average: "AVERAGE", min: "MIN", max: "MAX", count: "COUNT" };

function parseCell(raw) {
  const s = stripMd(raw);
  if (!s) return { v: null, kind: "blank" };
  if (s.startsWith("=") && s.length > 1) return { f: s.slice(1), kind: "formula" };
  let m;
  if ((m = s.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/))) return { v: m[1], link: m[2], kind: "text" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    if (!Number.isNaN(d.getTime())) return { v: d, fmt: FORMATS.date, kind: "date" };
  }
  if ((m = s.match(/^(Rs\.?|PKR)\s*(-?[\d,]*\.?\d+)$/i))) return { v: Number(m[2].replace(/,/g, "")), fmt: FORMATS.pkr, kind: "num" };
  if ((m = s.match(/^(-?)([$€£])\s*([\d,]*\.?\d+)$/))) return { v: Number(m[1] + m[3].replace(/,/g, "")), fmt: `"${m[2]}"#,##0.00`, kind: "num" };
  if ((m = s.match(/^(-?\d*\.?\d+)\s*%$/))) return { v: Number(m[1]) / 100, fmt: FORMATS.percent, kind: "num", pct: true };
  if (/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s) && !/^-?0\d/.test(s)) {
    return { v: Number(s.replace(/,/g, "")), fmt: s.includes(".") ? "#,##0.00" : "#,##0", kind: "num" };
  }
  return { v: s, kind: "text" };
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "|").trim());
}

function safeSheetName(name, used) {
  let n = String(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
  let k = 2;
  const base = n;
  while (used.has(n.toLowerCase())) n = base.slice(0, 28) + " " + k++;
  used.add(n.toLowerCase());
  return n;
}

// ======================================================================
//  Reading the script
// ======================================================================
const SHEET_KEYS = ["title", "subtitle", "kpi", "format", "total", "highlight", "scale", "scale3", "databar", "validate", "chart", "widths", "freeze", "filter", "note"];
const GLOBAL_KEYS = ["theme", "font"];

function parseScript(raw) {
  let text = String(raw ?? "").replace(/\r\n?/g, "\n");
  if (!text.includes("\n") && text.includes("\\n")) text = text.replace(/\\n/g, "\n");
  text = text.replace(/^\s*```[a-z]*\s*\n/i, "").replace(/\n\s*```\s*$/, "");

  const problems = [];
  const sheets = [];
  const used = new Set();
  const globals = {};
  let cur = null;

  const open = (name) => {
    cur = {
      name: safeSheetName(name, used), title: "", subtitle: "", kpis: [], rows: [], formats: {}, total: null, highlights: [], scales: [],
      databars: [], validations: [], charts: [], widths: {}, freeze: "yes", filter: true, notes: [], tableClosed: false,
    };
    sheets.push(cur);
  };
  const bad = (msg) => problems.push(cur ? `Sheet "${cur.name}": ${msg}` : msg);

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let m;

    if ((m = line.match(/^sheet\s*:\s*(.*)$/i))) {
      open(m[1]);
      continue;
    }
    if (line.startsWith("|")) {
      if (!cur) open("Sheet1");
      if (cur.tableClosed) {
        bad("only ONE table per sheet. Put the second table on its own sheet with another 'sheet:' line.");
        continue;
      }
      const cells = splitRow(line);
      if (!cells.every((c) => /^:?-+:?$/.test(c))) cur.rows.push(cells);
      continue;
    }
    if (cur && cur.rows.length) cur.tableClosed = true;

    if (!(m = line.match(/^([A-Za-z0-9]+)\s*:\s*(.*)$/))) {
      bad(`the line "${line.slice(0, 40)}" is not understood. Use 'key: value' lines or table rows starting with |.`);
      continue;
    }
    const key = m[1].toLowerCase();
    const val = m[2].trim();

    if (GLOBAL_KEYS.includes(key)) {
      globals[key] = val;
      continue;
    }
    if (!SHEET_KEYS.includes(key)) {
      bad(`unknown line "${m[1]}:". Allowed: ${[...GLOBAL_KEYS, ...SHEET_KEYS].join(", ")}.`);
      continue;
    }
    if (!cur) open("Sheet1");

    switch (key) {
      case "title": cur.title = stripMd(val); break;
      case "subtitle": cur.subtitle = stripMd(val); break;
      case "kpi": {
        const p = val.split("|").map((x) => x.trim());
        if (p.length < 2 || !p[0]) bad('kpi must look like "kpi: Label | value" or "kpi: Label | =SUM(B2:B9) | currency".');
        else if (p[2] && !FORMATS[p[2].toLowerCase()]) bad(`kpi format "${p[2]}" is unknown. Allowed: ${Object.keys(FORMATS).join(", ")}.`);
        else if (cur.kpis.length >= 6) bad("at most 6 kpi cards.");
        else cur.kpis.push({ label: stripMd(p[0]), cell: parseCell(p[1]), fmt: p[2] ? FORMATS[p[2].toLowerCase()] : null });
        break;
      }
      case "format":
        for (const part of val.split(/[,;]/)) {
          const p = part.split("=").map((x) => x.trim());
          if (p.length !== 2 || !/^[A-Za-z]{1,2}$/.test(p[0]) || !FORMATS[p[1].toLowerCase()]) bad(`format part "${part.trim()}" must look like B=currency (allowed: ${Object.keys(FORMATS).join(", ")}).`);
          else cur.formats[colIndex(p[0])] = FORMATS[p[1].toLowerCase()];
        }
        break;
      case "total":
        if (/^(yes|true|on|1|sum)$/i.test(val)) cur.total = { all: true };
        else if (/^(no|false|off|0|)$/i.test(val)) cur.total = null;
        else {
          const spec = { all: false, cols: {} };
          for (const part of val.split(/[,;]/)) {
            const p = part.split("=").map((x) => x.trim());
            if (p.length !== 2 || !/^[A-Za-z]{1,2}$/.test(p[0]) || !FN_FMT[p[1].toLowerCase()]) bad(`total part "${part.trim()}" must look like B=sum (sum avg min max count).`);
            else spec.cols[colIndex(p[0])] = FN_FMT[p[1].toLowerCase()];
          }
          cur.total = spec;
        }
        break;
      case "highlight": {
        const [rule, color = "red"] = val.split("|").map((x) => x.trim());
        const mm = rule.match(/^([A-Za-z]{1,2})\s*(>=|<=|!=|<>|>|<|=)\s*(.+)$/);
        if (!mm || !HL[color.toLowerCase()]) bad(`highlight must look like "C > 100 | red" (colours: ${Object.keys(HL).join(", ")}).`);
        else cur.highlights.push({ col: colIndex(mm[1]), op: mm[2] === "<>" ? "!=" : mm[2], value: mm[3].trim().replace(/^"|"$/g, ""), color: color.toLowerCase() });
        break;
      }
      case "scale":
      case "scale3":
      case "databar":
        for (const L of val.split(/[,\s]+/).filter(Boolean)) {
          if (!/^[A-Za-z]{1,2}$/.test(L)) bad(`${key}: "${L}" is not a column letter.`);
          else (key === "databar" ? cur.databars : cur.scales).push({ col: colIndex(L), three: key === "scale3" });
        }
        break;
      case "validate":
        for (const part of val.split(/;|,(?![^()]*\))/)) {
          const mm = part.trim().match(/^([A-Za-z]{1,2})\s*=\s*(list|number|date)(?:\((.*)\))?$/i);
          if (!mm) bad(`validate part "${part.trim()}" must look like D=list(Yes,No) or E=number(0,100) or F=date.`);
          else cur.validations.push({ col: colIndex(mm[1]), kind: mm[2].toLowerCase(), arg: mm[3] ?? "" });
        }
        break;
      case "chart": {
        const p = val.split("|").map((x) => x.trim());
        let type = (p[0] ?? "").toLowerCase().replace(/chart$/, "").trim();
        type = { column: "bar", columns: "bar", bars: "bar", stackedbar: "stacked", lines: "line", donut: "pie", doughnut: "pie" }[type] ?? type;
        if (!["bar", "stacked", "line", "pie"].includes(type) || p.length < 3) bad('chart must look like "chart: bar | A | B,C | Title" (types: bar, stacked, line, pie).');
        else cur.charts.push({ type, label: p[1], series: p[2].split(/[,\s]+/).filter(Boolean), title: p[3] ?? "" });
        break;
      }
      case "widths":
        for (const part of val.split(/[,;]/)) {
          const p = part.split("=").map((x) => x.trim());
          if (p.length !== 2 || !/^[A-Za-z]{1,2}$/.test(p[0]) || !(Number(p[1]) > 0)) bad(`widths part "${part.trim()}" must look like A=30.`);
          else cur.widths[colIndex(p[0])] = Math.min(80, Number(p[1]));
        }
        break;
      case "freeze": cur.freeze = val.toLowerCase().replace(/[\s_]/g, "-"); break;
      case "filter": cur.filter = !/^(no|false|off|0)$/i.test(val); break;
      case "note": cur.notes.push(stripMd(val)); break;
    }
  }

  if (!sheets.length) problems.push("No table found. Write rows like | Name | Value | (first row = header).");
  if (sheets.length > 20) problems.push("At most 20 sheets.");
  for (const sh of sheets) {
    if (sh.rows.length < 2) problems.push(`Sheet "${sh.name}": needs a header row and at least one data row.`);
    if (sh.rows.length > MAX_ROWS + 1) problems.push(`Sheet "${sh.name}": too many rows (max ${MAX_ROWS}).`);
    sh.cols = Math.max(0, ...sh.rows.map((r) => r.length));
    sh.cells = sh.rows.map((r) => Array.from({ length: sh.cols }, (_, i) => parseCell(r[i])));
    sh.nData = Math.max(0, sh.cells.length - 1);
  }
  return { sheets, globals, problems };
}

// ======================================================================
//  Layout, formula moving, formula calculating
// ======================================================================
// a cell address, with an optional sheet name in front. Text inside "quotes" is skipped by the callers.
const REF_RE = /(?<![\w.$'!])(?:(?:'([^']+)'|([A-Za-z_][\w.]*))!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g;
const RANGE_RE = /^(?:(?:'([^']+)'|([A-Za-z_][\w.]*))!)?\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/;
const FN_RE = /\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT|ROUND|ABS)\(([^()]*)\)/i;

function layout(sheets) {
  for (const sh of sheets) {
    let r = 1;
    if (sh.title) {
      sh.titleRow = 1;
      r = 4; // title, subtitle, one empty row
    }
    if (sh.kpis.length) {
      sh.kpiRow = r;
      r += 3; // label, value, one empty row
    }
    sh.r0 = r; // the header row of the table
  }
}

// Moves addresses written for "header = row 1" to the real rows
function shiftFormula(f, sh, byName, unknown) {
  return f
    .split(/("[^"]*")/)
    .map((seg, i) => {
      if (i % 2) return seg;
      return seg.replace(REF_RE, (m, q1, q2, d1, col, d2, row) => {
        const name = q1 || q2;
        const target = name ? byName.get(name.toLowerCase()) : sh;
        if (!target) {
          unknown.add(name);
          return m;
        }
        const prefix = name ? m.slice(0, m.length - (d1 + col + d2 + row).length) : "";
        return prefix + d1 + col + d2 + (Number(row) + target.r0 - 1);
      });
    })
    .join("");
}

function makeCalc(byName) {
  const cellAt = (sh, col, row) => (row < sh.r0 ? undefined : sh.cells[row - sh.r0]?.[col]);

  function resolve(c, sh, depth) {
    if (c.result !== undefined) return c.result;
    if (depth > 30 || c._busy) return null;
    c._busy = true;
    try {
      c.result = evalFormula(c.f, sh, depth + 1);
    } catch {
      c.result = null;
    } finally {
      c._busy = false;
    }
    return c.result;
  }

  function numAt(sh, col, row, depth) {
    const c = cellAt(sh, col, row);
    if (!c || c.kind === "blank") return 0;
    if (row < sh.r0) throw new Error("header");
    if (c.f) {
      const v = resolve(c, sh, depth);
      if (!Number.isFinite(v)) throw new Error("no value");
      return v;
    }
    if (c.kind === "num") return c.v;
    throw new Error("not a number");
  }

  function evalExpr(expr, sh, depth) {
    const ev = expr.replace(REF_RE, (m, q1, q2, d1, col, d2, row) => {
      const target = q1 || q2 ? byName.get((q1 || q2).toLowerCase()) : sh;
      if (!target) throw new Error("sheet");
      return `(${numAt(target, colIndex(col), Number(row), depth)})`;
    });
    const js = ev.replace(/\^/g, "**").replace(/(\d)\s*%/g, "($1/100)");
    if (!/^[\d+\-*/().\s eE]*$/.test(js)) throw new Error("unsupported");
    const out = Function('"use strict";return (' + js + ")")();
    if (!Number.isFinite(out)) throw new Error("bad");
    return out;
  }

  function rangeVals(sh, m, depth) {
    const target = m[1] || m[2] ? byName.get((m[1] || m[2]).toLowerCase()) : sh;
    if (!target) throw new Error("sheet");
    const [c1, c2] = [colIndex(m[3]), colIndex(m[5])].sort((a, b) => a - b);
    const [r1, r2] = [Number(m[4]), Number(m[6])].sort((a, b) => a - b);
    const out = [];
    for (let r = Math.max(r1, target.r0 + 1); r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = cellAt(target, c, r);
        if (!cell || cell.kind === "blank") continue;
        if (cell.f) {
          const v = resolve(cell, target, depth);
          if (Number.isFinite(v)) out.push(v);
        } else if (cell.kind === "num") out.push(cell.v);
      }
    }
    return out;
  }

  function evalFormula(f, sh, depth) {
    let expr = f;
    for (let guard = 0; guard < 60; guard++) {
      const m = expr.match(FN_RE);
      if (!m) break;
      const fn = m[1].toUpperCase();
      const args = m[2].split(",").map((a) => a.trim()).filter((a) => a !== "");
      const nums = [];
      const singles = [];
      for (const a of args) {
        const rm = a.match(RANGE_RE);
        if (rm) nums.push(...rangeVals(sh, rm, depth));
        else {
          const v = evalExpr(a, sh, depth);
          nums.push(v);
          singles.push(v);
        }
      }
      let r;
      if (fn === "SUM") r = nums.reduce((a, b) => a + b, 0);
      else if (fn === "AVERAGE" || fn === "AVG") r = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
      else if (fn === "MIN") r = nums.length ? Math.min(...nums) : NaN;
      else if (fn === "MAX") r = nums.length ? Math.max(...nums) : NaN;
      else if (fn === "COUNT") r = nums.length;
      else if (fn === "ABS") r = Math.abs(singles[0]);
      else {
        const k = 10 ** (singles[1] ?? 0);
        r = Math.round(singles[0] * k) / k;
      }
      if (!Number.isFinite(r)) throw new Error("bad");
      expr = expr.slice(0, m.index) + `(${r})` + expr.slice(m.index + m[0].length);
    }
    return evalExpr(expr, sh, depth);
  }

  return { resolve, numAt, cellAt };
}

// Everything that needs all sheets: moves formulas, adds total rows, works out results, checks charts
function prepare(sheets, problems) {
  layout(sheets);
  const byName = new Map(sheets.map((s) => [s.name.toLowerCase(), s]));
  const unknown = new Set();

  // 1) move formulas to their real rows, check brackets
  const fix = (c, sh, where) => {
    if (!c.f) return;
    let depth = 0;
    for (const ch of c.f.replace(/"[^"]*"/g, "")) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth < 0) break;
    }
    if (depth !== 0) problems.push(`Sheet "${sh.name}": the formula =${c.f} (${where}) has unbalanced brackets.`);
    c.f = shiftFormula(c.f, sh, byName, unknown);
  };
  for (const sh of sheets) {
    sh.cells.forEach((row, ri) => row.forEach((c, ci) => fix(c, sh, `${colLetter(ci)}${ri + 1}`)));
    sh.kpis.forEach((k, i) => fix(k.cell, sh, `kpi ${i + 1}`));
  }
  for (const name of unknown) problems.push(`A formula uses the sheet "${name}" but there is no sheet with that name.`);

  // 2) which columns hold numbers, and their number format
  for (const sh of sheets) {
    sh.numCol = [];
    sh.colFmt = [];
    for (let ci = 0; ci < sh.cols; ci++) {
      const data = sh.cells.slice(1).map((r) => r[ci]).filter((c) => c.kind !== "blank");
      sh.numCol[ci] = data.length > 0 && data.every((c) => c.kind === "num" || c.kind === "formula");
      sh.colFmt[ci] = sh.formats[ci] ?? data.find((c) => c.kind === "num")?.fmt;
    }
  }

  // 3) total row (real row numbers, so it is NOT moved)
  for (const sh of sheets) {
    if (!sh.total || sh.nData < 1) continue;
    const first = sh.r0 + 1;
    const last = sh.r0 + sh.nData;
    const row = Array.from({ length: sh.cols }, () => ({ v: null, kind: "blank" }));
    for (let ci = 0; ci < sh.cols; ci++) {
      const fn = sh.total.all ? (sh.numCol[ci] ? "SUM" : null) : sh.total.cols[ci];
      if (!fn) continue;
      const L = colLetter(ci);
      row[ci] = { f: `${fn}(${L}${first}:${L}${last})`, kind: "formula", bold: true, fmt: fn === "COUNT" ? FORMATS.integer : sh.colFmt[ci] };
    }
    const labelAt = row.findIndex((c) => c.kind === "blank");
    if (labelAt >= 0) row[labelAt] = { v: "Total", kind: "text", bold: true };
    row.isTotal = true;
    sh.cells.push(row);
    sh.totalRowNo = sh.r0 + sh.cells.length - 1;
  }
  for (const sh of sheets) sh.lastRow = sh.r0 + sh.cells.length - 1;

  // 4) calculate every formula (so charts, KPI cards and .csv files show real values)
  const calc = makeCalc(byName);
  for (const sh of sheets) {
    sh.cells.forEach((row) => row.forEach((c) => c.f && calc.resolve(c, sh, 0)));
    sh.kpis.forEach((k) => k.cell.f && calc.resolve(k.cell, sh, 0));
    sh.unresolved = sh.cells.flat().filter((c) => c.f && !Number.isFinite(c.result)).length;
  }

  // 5) check the other lines against the table and build the chart data
  for (const sh of sheets) {
    const bad = (m) => problems.push(`Sheet "${sh.name}": ${m}`);
    const inRange = (ci, what) => {
      if (ci >= sh.cols) bad(`${what} uses column ${colLetter(ci)} but the table has only ${sh.cols} columns.`);
    };
    Object.keys(sh.formats).forEach((ci) => inRange(Number(ci), "format"));
    sh.highlights.forEach((h) => inRange(h.col, "highlight"));
    [...sh.scales, ...sh.databars].forEach((h) => inRange(h.col, "scale/databar"));
    sh.validations.forEach((v) => inRange(v.col, "validate"));
    Object.keys(sh.widths).forEach((ci) => inRange(Number(ci), "widths"));
    if (sh.total && !sh.total.all) Object.keys(sh.total.cols).forEach((ci) => inRange(Number(ci), "total"));
    if (sh.total && sh.total.all && !sh.numCol.some(Boolean)) bad("'total: yes' needs at least one column that holds only numbers.");
    if (sh.freeze !== "yes" && sh.freeze !== "no" && sh.freeze !== "first-col") bad("freeze must be yes, no or first-col.");

    sh.chartData = [];
    for (const ch of sh.charts) {
      const lc = colIndex(ch.label);
      const sc = ch.series.map(colIndex);
      if (![lc, ...sc].every((c) => c >= 0 && c < sh.cols)) {
        bad(`chart "${ch.title || ch.type}" uses a column that is not in the table (it has ${sh.cols} columns).`);
        continue;
      }
      if (ch.type === "pie" && sc.length !== 1) {
        bad("a pie chart needs exactly ONE value column.");
        continue;
      }
      const dataRows = sh.cells.slice(1, 1 + sh.nData);
      const labels = dataRows.map((r) => {
        const c = r[lc];
        return c.v instanceof Date ? c.v.toISOString().slice(0, 10) : c.f ? String(c.result ?? "") : String(c.v ?? "");
      });
      const series = [];
      let ok = true;
      for (const ci of sc) {
        const values = dataRows.map((r) => (r[ci].f ? r[ci].result : r[ci].kind === "num" ? r[ci].v : r[ci].kind === "blank" ? 0 : NaN));
        if (values.some((v) => !Number.isFinite(v))) {
          bad(`chart "${ch.title || ch.type}": column ${colLetter(ci)} must hold only numbers (or formulas the program can calculate).`);
          ok = false;
          break;
        }
        series.push({ name: stripMd(sh.cells[0][ci].v ?? colLetter(ci)), values });
      }
      if (!ok) continue;
      if ((ch.type === "pie" || ch.type === "stacked") && series.some((s) => s.values.some((v) => v < 0))) {
        bad(`chart "${ch.title || ch.type}": ${ch.type} charts cannot have negative values. Use bar instead.`);
        continue;
      }
      if (ch.type === "pie" && !(series[0].values.reduce((a, b) => a + b, 0) > 0)) {
        bad("the pie chart values add up to zero.");
        continue;
      }
      sh.chartData.push({ type: ch.type, title: ch.title, labels, series });
    }
  }
  return { byName };
}

// ======================================================================
//  CSV
// ======================================================================
function csvValue(c) {
  if (c.f) return Number.isFinite(c.result) ? c.result : "=" + c.f;
  if (c.v instanceof Date) return c.v.toISOString().slice(0, 10);
  if (c.pct) return Math.round(c.v * 1e10) / 1e8 + "%";
  return c.v ?? "";
}

function csvText(sh, delim = ",") {
  const esc = (v) => {
    const s = String(v);
    return s.includes(delim) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + sh.cells.map((row) => row.map((c) => esc(csvValue(c))).join(delim)).join("\r\n") + "\r\n";
}

// ======================================================================
//  Charts (pictures, drawn with @napi-rs/canvas - loaded only when a chart is used)
// ======================================================================
let createCanvasFn = null;
async function loadCanvas() {
  if (createCanvasFn) return createCanvasFn;
  try {
    const mod = await import("@napi-rs/canvas");
    createCanvasFn = mod.createCanvas ?? mod.default?.createCanvas ?? null;
  } catch {}
  if (!createCanvasFn) throw new Error("charts need the package @napi-rs/canvas. Tell the user to run this in the project folder: npm install @napi-rs/canvas  (do not try again before that)");
  return createCanvasFn;
}

function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range));
  const f = range / 10 ** exp;
  const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}
function niceScale(min, max) {
  if (min === max) max = min === 0 ? 1 : min > 0 ? min * 1.2 : 0;
  const step = niceNum(niceNum(max - min, false) / 5, true);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}
const fmtN = (n) => Number(Number(n).toPrecision(8)).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 1 ? 3 : 2 });

async function drawChart(spec, font) {
  const createCanvas = await loadCanvas();
  const W = 760;
  const H = 420;
  const S = 2;
  const cv = createCanvas(W * S, H * S);
  const g = cv.getContext("2d");
  g.scale(S, S);
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, W, H);
  const setFont = (px, st = "") => (g.font = `${st} ${px}px "${font}", Calibri, Arial, sans-serif`.trim());
  const col = (i) => CHART_COLORS[i % CHART_COLORS.length];
  const ell = (s, maxW) => {
    s = String(s);
    if (g.measureText(s).width <= maxW) return s;
    while (s.length > 1 && g.measureText(s + "\u2026").width > maxW) s = s.slice(0, -1);
    return s + "\u2026";
  };

  const top = spec.title ? 52 : 20;
  if (spec.title) {
    setFont(19, "bold");
    g.fillStyle = "#111111";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(ell(spec.title, W - 40), W / 2, 32);
  }

  // legend
  const names = spec.type === "pie" ? spec.labels : spec.series.map((s) => s.name);
  const showLegend = spec.type === "pie" || spec.series.length > 1;
  const legend = (x0, y0, maxW, vertical) => {
    setFont(13);
    g.textAlign = "left";
    g.textBaseline = "middle";
    let x = x0;
    let y = y0;
    names.forEach((n, i) => {
      const label = ell(n + (spec.type === "pie" ? ` (${((spec.series[0].values[i] / spec.series[0].values.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` : ""), vertical ? maxW - 22 : 160);
      const w = 22 + g.measureText(label).width + 18;
      if (!vertical && x + w > x0 + maxW) {
        x = x0;
        y += 20;
      }
      g.fillStyle = col(i);
      g.fillRect(x, y - 6, 12, 12);
      g.fillStyle = "#222222";
      g.fillText(label, x + 18, y);
      if (vertical) y += 22;
      else x += w;
    });
  };

  if (spec.type === "pie") {
    const vals = spec.series[0].values;
    const total = vals.reduce((a, b) => a + b, 0);
    const r = Math.min((H - top - 20) / 2, 150);
    const cx = 40 + r + 10;
    const cy = top + (H - top) / 2;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      g.fillStyle = col(i);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, r, a0, a1);
      g.closePath();
      g.fill();
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 2;
      g.stroke();
      if (v / total >= 0.05) {
        const am = (a0 + a1) / 2;
        setFont(14, "bold");
        g.fillStyle = "#FFFFFF";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`${Math.round((v / total) * 100)}%`, cx + Math.cos(am) * r * 0.64, cy + Math.sin(am) * r * 0.64);
      }
      a0 = a1;
    });
    legend(cx + r + 40, cy - (Math.min(vals.length, 12) * 22) / 2 + 11, W - (cx + r + 40) - 20, true);
    return cv.toBuffer("image/png");
  }

  const S0 = spec.series;
  const n = spec.labels.length;
  const stacked = spec.type === "stacked";
  let dmin = 0;
  let dmax = -Infinity;
  if (stacked) for (let j = 0; j < n; j++) dmax = Math.max(dmax, S0.reduce((a, s) => a + s.values[j], 0));
  else S0.forEach((s) => s.values.forEach((v) => ((dmin = Math.min(dmin, v)), (dmax = Math.max(dmax, v)))));
  const sc = niceScale(dmin, Math.max(dmax, 0));
  setFont(12);
  const yW = Math.max(...sc.ticks.map((t) => g.measureText(fmtN(t)).width));
  const left = 18 + yW + 8;
  const right = 24;
  const bottom = 54 + (showLegend ? 26 : 0);
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const slot = plotW / n;
  const yOf = (v) => top + plotH * (1 - (v - sc.min) / (sc.max - sc.min));

  g.lineWidth = 1;
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (const t of sc.ticks) {
    g.strokeStyle = "#E3E3E3";
    g.beginPath();
    g.moveTo(left, yOf(t));
    g.lineTo(left + plotW, yOf(t));
    g.stroke();
    g.fillStyle = "#444444";
    setFont(12);
    g.fillText(fmtN(t), left - 6, yOf(t));
  }
  const y0 = yOf(0);
  if (spec.type === "line") {
    S0.forEach((s, si) => {
      g.strokeStyle = col(si);
      g.lineWidth = 2.5;
      g.beginPath();
      s.values.forEach((v, j) => (j ? g.lineTo(left + slot * (j + 0.5), yOf(v)) : g.moveTo(left + slot * 0.5, yOf(v))));
      g.stroke();
      g.fillStyle = col(si);
      s.values.forEach((v, j) => {
        g.beginPath();
        g.arc(left + slot * (j + 0.5), yOf(v), 4, 0, Math.PI * 2);
        g.fill();
      });
    });
  } else if (stacked) {
    const bw = Math.min(slot * 0.62, 80);
    for (let j = 0; j < n; j++) {
      let acc = 0;
      S0.forEach((s, si) => {
        const v = s.values[j];
        g.fillStyle = col(si);
        g.fillRect(left + slot * (j + 0.5) - bw / 2, yOf(acc + v), bw, yOf(acc) - yOf(acc + v));
        acc += v;
      });
    }
  } else {
    const gw = Math.min(slot * 0.78, 34 * S0.length + 16);
    const bw = gw / S0.length;
    const showVals = n * S0.length <= 18;
    for (let j = 0; j < n; j++) {
      S0.forEach((s, si) => {
        const v = s.values[j];
        const x = left + slot * (j + 0.5) - gw / 2 + si * bw;
        g.fillStyle = col(si);
        g.fillRect(x + 1, Math.min(yOf(v), y0), bw - 2, Math.abs(y0 - yOf(v)));
        if (showVals) {
          setFont(11);
          g.fillStyle = "#222222";
          g.textAlign = "center";
          g.textBaseline = v >= 0 ? "bottom" : "top";
          g.fillText(fmtN(v), x + bw / 2, v >= 0 ? yOf(v) - 3 : yOf(v) + 3);
        }
      });
    }
  }
  g.strokeStyle = "#222222";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(left, top);
  g.lineTo(left, top + plotH);
  g.moveTo(left, y0);
  g.lineTo(left + plotW, y0);
  g.stroke();
  setFont(12);
  g.fillStyle = "#222222";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  spec.labels.forEach((l, j) => g.fillText(ell(l, slot - 4), left + slot * (j + 0.5), top + plotH + 18));
  if (showLegend) legend(left, H - 18, plotW, false);
  return cv.toBuffer("image/png");
}

// ======================================================================
//  Excel
// ======================================================================
const argb = (h) => "FF" + h;
const solid = (h) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(h) } });

function setValue(cell, c) {
  if (c.f) cell.value = { formula: c.f, ...(Number.isFinite(c.result) ? { result: c.result } : {}) };
  else if (c.link) cell.value = { text: c.v, hyperlink: c.link };
  else if (c.kind !== "blank") cell.value = c.v;
}

function displayLen(c) {
  if (c.f) return Number.isFinite(c.result) ? String(Math.round(c.result * 100) / 100).length + 4 : 12;
  if (c.v instanceof Date) return 12;
  if (typeof c.v === "number") return String(c.v).length + 4;
  return Math.max(...String(c.v ?? "").split("\n").map((x) => x.length), 0) + 2;
}

async function buildXlsx(sheets, globals, themeName, fontName) {
  let ExcelJS;
  try {
    const mod = await import("exceljs");
    ExcelJS = mod.default ?? mod;
  } catch {
    throw new Error("the package exceljs is not installed. Tell the user to run this in the project folder: npm install exceljs  (do not try again before that)");
  }
  const T = THEMES[themeName];
  const wb = new ExcelJS.Workbook();
  wb.creator = "agent-cmd";
  wb.calcProperties = { fullCalcOnLoad: true };
  const edge = { style: "thin", color: { argb: "FFBFBFBF" } };
  const borders = { top: edge, bottom: edge, left: edge, right: edge };
  const rtl = sheets.some((sh) => sh.cells.some((r) => r.some((c) => typeof c.v === "string" && RTL_RE.test(c.v))));

  for (const sh of sheets) {
    const hr = sh.r0;
    const ws = wb.addWorksheet(sh.name, {
      properties: { tabColor: { argb: argb(T.acc) } },
      views: [{
        showGridLines: false, rightToLeft: rtl,
        ...(sh.freeze !== "no" ? { state: "frozen", ySplit: hr, xSplit: sh.freeze === "first-col" ? 1 : 0 } : {}),
      }],
    });
    const widths = Array(Math.max(sh.cols, 1)).fill(10);
    const span = Math.max(sh.cols, 4);

    // title banner
    if (sh.title) {
      ws.mergeCells(1, 1, 1, span);
      const t = ws.getCell(1, 1);
      t.value = sh.title;
      t.font = { name: fontName, size: 22, bold: true, color: { argb: argb(T.head) } };
      t.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };
      ws.getRow(1).height = 36;
      ws.mergeCells(2, 1, 2, span);
      const s = ws.getCell(2, 1);
      s.value = sh.subtitle || "";
      s.font = { name: fontName, size: 12, italic: true, color: { argb: "FF666666" } };
      s.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };
      for (let c = 1; c <= span; c++) ws.getCell(3, c).border = { top: { style: "medium", color: { argb: argb(T.acc) } } };
      ws.getRow(3).height = 8;
    }

    // KPI cards
    if (sh.kpis.length) {
      const nK = sh.kpis.length;
      const w = Math.max(1, Math.floor(Math.max(sh.cols, nK) / nK));
      sh.kpis.forEach((k, i) => {
        const c1 = 1 + i * w;
        const c2 = c1 + w - 1;
        const lr = sh.kpiRow;
        if (c2 > c1) {
          ws.mergeCells(lr, c1, lr, c2);
          ws.mergeCells(lr + 1, c1, lr + 1, c2);
        }
        for (let c = c1; c <= c2; c++) {
          ws.getCell(lr, c).fill = solid(T.light);
          ws.getCell(lr + 1, c).fill = solid(T.light);
          ws.getCell(lr, c).border = { top: { style: "medium", color: { argb: argb(T.acc) } }, left: c === c1 ? edge : undefined, right: c === c2 ? edge : undefined };
          ws.getCell(lr + 1, c).border = { bottom: edge, left: c === c1 ? edge : undefined, right: c === c2 ? edge : undefined };
        }
        const lab = ws.getCell(lr, c1);
        lab.value = k.label.toUpperCase();
        lab.font = { name: fontName, size: 10, bold: true, color: { argb: "FF555555" } };
        lab.alignment = { horizontal: "center", vertical: "middle" };
        const val = ws.getCell(lr + 1, c1);
        setValue(val, k.cell);
        const fmt = k.fmt ?? k.cell.fmt;
        if (fmt) val.numFmt = fmt;
        val.font = { name: fontName, size: 22, bold: true, color: { argb: argb(T.acc) } };
        val.alignment = { horizontal: "center", vertical: "middle" };
      });
      ws.getRow(sh.kpiRow).height = 20;
      ws.getRow(sh.kpiRow + 1).height = 38;
    }

    // table
    sh.cells.forEach((row, ri) => {
      const wr = ws.getRow(hr + ri);
      const header = ri === 0;
      const total = row.isTotal;
      row.forEach((c, ci) => {
        const cell = wr.getCell(ci + 1);
        setValue(cell, c);
        const fmt = !header ? sh.formats[ci] ?? c.fmt ?? (c.f ? sh.colFmt[ci] : undefined) : undefined;
        if (fmt) cell.numFmt = fmt;
        cell.border = total ? { ...borders, top: { style: "medium", color: { argb: argb(T.head) } } } : borders;
        const isNum = c.kind === "num" || c.kind === "date" || c.f;
        cell.alignment = {
          vertical: "middle",
          horizontal: header ? "center" : isNum ? "right" : rtl ? "right" : "left",
          wrapText: header || (typeof c.v === "string" && (c.v.length > 45 || c.v.includes("\n"))),
        };
        if (header) {
          cell.font = { name: fontName, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
          cell.fill = solid(T.head);
        } else {
          cell.font = {
            name: fontName, size: 11, bold: !!(total || c.bold),
            ...(c.link ? { color: { argb: "FF0563C1" }, underline: true } : {}),
          };
          if (total) cell.fill = solid(T.light);
          else if (ri % 2 === 0) cell.fill = solid(T.zebra);
        }
        if (!header || c.kind !== "blank") widths[ci] = Math.max(widths[ci], Math.min(header ? 36 : 50, displayLen(c) + (header ? 4 : 0)));
      });
      if (header) wr.height = 28;
    });
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = sh.widths[i] ?? Math.max(9, w)));
    if (sh.filter && sh.cols > 0 && sh.nData > 0) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: hr, column: sh.cols } };

    const first = hr + 1;
    const lastData = hr + sh.nData;
    const rng = (ci) => `${colLetter(ci)}${first}:${colLetter(ci)}${lastData}`;

    // conditional formatting
    const OPS = { ">": "greaterThan", "<": "lessThan", ">=": "greaterThanOrEqual", "<=": "lessThanOrEqual", "=": "equal", "!=": "notEqual" };
    for (const h of sh.highlights) {
      const col = HL[h.color];
      const v = Number.isFinite(Number(h.value)) && h.value !== "" ? Number(h.value) : `"${h.value}"`;
      try {
        ws.addConditionalFormatting({
          ref: rng(h.col),
          rules: [{
            type: "cellIs", operator: OPS[h.op], formulae: [v], priority: 1,
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: argb(col.bg) } }, font: { color: { argb: argb(col.fg) }, bold: true } },
          }],
        });
      } catch {}
    }
    for (const s of sh.scales) {
      try {
        ws.addConditionalFormatting({
          ref: rng(s.col),
          rules: [s.three
            ? { type: "colorScale", cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }], color: [{ argb: "FFF8696B" }, { argb: "FFFFEB84" }, { argb: "FF63BE7B" }] }
            : { type: "colorScale", cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: "FFFFFFFF" }, { argb: argb(T.acc) }] }],
        });
      } catch {}
    }
    for (const d of sh.databars) {
      try {
        ws.addConditionalFormatting({
          ref: rng(d.col),
          rules: [{ type: "dataBar", gradient: false, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: argb(T.acc2) } }],
        });
      } catch {}
    }

    // data validation (also for 100 empty rows below, so new rows are protected too)
    for (const v of sh.validations) {
      let dv = null;
      if (v.kind === "list") {
        const items = v.arg.split(",").map((x) => x.trim()).filter(Boolean);
        if (items.length) dv = { type: "list", allowBlank: true, formulae: [`"${items.join(",").replace(/"/g, "")}"`], showErrorMessage: true, errorTitle: "Not allowed", error: "Choose a value from the list." };
      } else if (v.kind === "number") {
        const p = v.arg.split(",").map((x) => Number(x.trim()));
        dv = p.length === 2 && p.every(Number.isFinite)
          ? { type: "decimal", operator: "between", allowBlank: true, formulae: p, showErrorMessage: true, errorTitle: "Not allowed", error: `Enter a number between ${p[0]} and ${p[1]}.` }
          : { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [-1e15], showErrorMessage: true, errorTitle: "Not allowed", error: "Enter a number." };
      } else {
        dv = { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(Date.UTC(1900, 0, 2))], showErrorMessage: true, errorTitle: "Not allowed", error: "Enter a date." };
      }
      if (!dv) continue;
      for (let r = first; r <= lastData + 100; r++) ws.getCell(r, v.col + 1).dataValidation = dv;
    }

    // notes under the table
    let nr = sh.lastRow + 2;
    for (const n of sh.notes) {
      const c = ws.getCell(nr++, 1);
      c.value = n;
      c.font = { name: fontName, size: 10, italic: true, color: { argb: "FF666666" } };
    }

    // charts
    let k = 0;
    for (const spec of sh.chartData) {
      const png = await drawChart(spec, fontName);
      const id = wb.addImage({ buffer: png, extension: "png" });
      const side = sh.cols <= 9;
      ws.addImage(id, {
        tl: side ? { col: sh.cols + 1, row: hr - 1 + k * 22 } : { col: 0, row: nr + 1 + k * 22 },
        ext: { width: 600, height: 332 },
      });
      k++;
    }

    // printing
    ws.pageSetup = {
      orientation: sh.cols > 6 ? "landscape" : "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printTitlesRow: `${hr}:${hr}`, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    ws.headerFooter = { oddFooter: "&C&P / &N" };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ======================================================================
//  Saving
// ======================================================================
function safeName(name, ext) {
  const n = path
    .basename(String(name || "spreadsheet"))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\.(xlsx|csv)$/i, "")
    .replace(/\.+$/, "")
    .trim();
  return (n || "spreadsheet") + ext;
}

// If a file with that name is open in Excel it is locked: save as "name (2).ext" instead.
function saveUnique(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(name);
  const base = name.slice(0, -ext.length);
  for (let n = 1; n <= 20; n++) {
    const file = path.join(dir, n === 1 ? name : `${base} (${n})${ext}`);
    try {
      fs.writeFileSync(file, data);
      return file;
    } catch (err) {
      if (!["EBUSY", "EPERM", "EACCES"].includes(err.code)) throw err;
    }
  }
  throw new Error("the file is locked (is it open in Excel?) and no other name was free");
}

// ======================================================================
//  Main function
// ======================================================================
// createSpreadsheet(script, "name.xlsx" | "name.csv", { format: "xlsx" | "csv" | "both" }) -> { ok, path, message }
// opts.dir = folder to save in (default: Desktop)   opts.open = open when done (default: true on Windows)
// opts.delimiter = csv separator (default ",")
export async function createSpreadsheet(script, fileName, opts = {}) {
  try {
    const dir = opts.dir ?? path.join(os.homedir(), "Desktop");
    const open = opts.open ?? process.platform === "win32";

    if (typeof script !== "string" || !script.trim()) {
      return { ok: false, message: "NOT CREATED: the content is empty. Call create_spreadsheet again with the WHOLE script in 'content'." };
    }
    const { sheets, globals, problems } = parseScript(script);

    let themeName = String(globals.theme ?? "blue").toLowerCase().trim();
    if (!THEMES[themeName]) {
      problems.push(`Unknown theme "${themeName}". Use one of: ${Object.keys(THEMES).join(", ")}.`);
      themeName = "blue";
    }
    let fontName = FONTS[0];
    if (globals.font) {
      const f = FONTS.find((x) => x.toLowerCase() === globals.font.toLowerCase().trim());
      if (!f) problems.push(`Unknown font "${globals.font}". Allowed: ${FONTS.join(", ")}.`);
      else fontName = f;
    }
    if (sheets.length) prepare(sheets, problems);
    if (problems.length) {
      return { ok: false, message: "NOT CREATED. Fix these problems and call create_spreadsheet again with the FULL content:\n- " + problems.join("\n- ") };
    }

    let fmt = String(opts.format ?? "").toLowerCase();
    if (!["xlsx", "csv", "both"].includes(fmt)) fmt = /\.csv$/i.test(String(fileName)) ? "csv" : "xlsx";

    const saved = [];
    if (fmt === "xlsx" || fmt === "both") {
      saved.push(saveUnique(dir, safeName(fileName, ".xlsx"), await buildXlsx(sheets, globals, themeName, fontName)));
    }
    if (fmt === "csv" || fmt === "both") {
      for (const sh of sheets) {
        const suffix = sheets.length > 1 ? "-" + sh.name.replace(/\s+/g, "_") : "";
        const name = safeName(fileName, ".csv").replace(/\.csv$/, suffix + ".csv");
        saved.push(saveUnique(dir, name, csvText(sh, opts.delimiter ?? ",")));
      }
    }
    if (open) exec(`start "" "${saved[0]}"`, { shell: "cmd.exe", windowsHide: true }, () => {});

    const rows = sheets.reduce((a, s) => a + s.nData, 0);
    const formulas = sheets.reduce((a, s) => a + s.cells.flat().filter((c) => c.f).length, 0);
    const charts = sheets.reduce((a, s) => a + s.chartData.length, 0);
    const parts = [`${sheets.length} sheet(s)`, `${rows} data rows`];
    if (formulas) parts.push(`${formulas} formulas`);
    if (charts && fmt !== "csv") parts.push(`${charts} charts`);
    let message = `OK: saved ${saved.join(" and ")} with ${parts.join(", ")}${fmt !== "csv" ? `, theme "${themeName}"` : ""}.`;
    const unresolved = sheets.reduce((a, s) => a + s.unresolved, 0);
    if (unresolved && fmt !== "xlsx") message += ` ${unresolved} formula(s) are too complex to calculate here, so the .csv holds them as text starting with = (Excel calculates them).`;
    if (open) message += " The first file was opened.";
    return { ok: true, path: saved[0], message };
  } catch (err) {
    return { ok: false, message: "NOT CREATED: " + err.message };
  }
}

// for tests / other programs
export const _internal = { parseScript, prepare, csvText, THEMES, FORMATS };