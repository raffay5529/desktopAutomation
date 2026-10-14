// word.js - builds a good-looking Word (.docx) file from Markdown text. Used by agent-cmd.js (tool: create_word).
// Needs: npm install docx

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
  PageBreak,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
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
const FONT = "Calibri";
const CODE_FONT = "Consolas";
const BLUE_DARK = "1F3864"; // title, main headings, table header
const BLUE = "2E74B5"; // sub-headings, accent lines
const GREY_LINE = "BFBFBF";
const ZEBRA = "F2F6FC"; // every second table row
const PAGE_W = 11906; // A4 in DXA (1440 = 1 inch). For US Letter use 12240 x 15840.
const PAGE_H = 16838;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// The AI reads this together with the create_word tool description.
export const WORD_HELP =
  "\n\nWrite the document in Markdown, one element per line (use real new lines):\n" +
  "# Title            the document title. Use it ONCE, as the FIRST line.\n" +
  "> subtitle         a line right after the title becomes the subtitle.\n" +
  "## Heading         main section heading.\n" +
  "### Sub-heading    sub-section heading.\n" +
  "Plain line         a paragraph (every line is its own paragraph, write full sentences).\n" +
  "- item             bullet point (indent 2 spaces for a sub-bullet).\n" +
  "1. item            numbered list.\n" +
  "| A | B |          table. First row = header, then a |---|---| line, then the rows.\n" +
  "> note             (not right after the title) a highlighted note box.\n" +
  "```ts ... ```      code block.\n" +
  "---                horizontal line.   [pagebreak]   starts a new page.\n" +
  "Inside a line: **bold**, *italic*, `code`, [link text](https://example.com)";

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
          size: (base.size ?? 22) - 2,
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

function titlePara(text, withLine) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: withLine ? 360 : 160 },
    border: withLine ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 10 } } : undefined,
    children: inline(text),
  });
}

function subtitlePara(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 10 } },
    children: inline(text, { italics: true, color: "595959", size: 26 }),
  });
}

function calloutPara(text) {
  return new Paragraph({
    spacing: { before: 120, after: 160 },
    indent: { left: 240, right: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: BLUE, space: 8 } },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "EAF1FB" },
    children: inline(text),
  });
}

function codeBlock(codeLines) {
  const lines = codeLines.length ? codeLines : [""];
  return lines.map(
    (l, i) =>
      new Paragraph({
        spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 200 : 0, line: 240 },
        indent: { left: 120, right: 120 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 6 } },
        run: { font: CODE_FONT, size: 19 },
        children: [new TextRun({ text: l.replace(/\t/g, "    "), font: CODE_FONT, size: 19 })],
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

  const line = { style: BorderStyle.SINGLE, size: 4, color: GREY_LINE };
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
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          shading: {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: header ? BLUE_DARK : ri % 2 === 0 ? ZEBRA : "FFFFFF",
          },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: inline(r[ci] ?? "", header ? { bold: true, color: "FFFFFF" } : {}),
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

// ---------- Markdown -> docx elements ----------

function buildBody(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const body = [];
  const stats = { headings: 0, paragraphs: 0, bullets: 0, numbered: 0, tables: 0, code: 0 };
  const problems = [];
  const H = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
  let title = "";
  let titleFirst = false;
  let last = ""; // kind of the previous block (title, subtitle, bullet, number, table ...)
  let listNo = 0; // each new numbered list restarts at 1
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");
    const t = line.trim();
    let m;

    if (!t) {
      i++;
      continue;
    }

    // code block
    if (t.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++; // closing fence
      body.push(...codeBlock(code));
      stats.code++;
      last = "code";
      continue;
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

    // headings
    if ((m = t.match(/^(#{1,6})\s+(.+)$/))) {
      const level = m[1].length;
      const text = m[2].trim();
      if (level === 1 && !title) {
        title = plain(text);
        titleFirst = body.length === 0;
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        const hasSubtitle = j < lines.length && /^>/.test(lines[j].trim());
        body.push(titlePara(text, !hasSubtitle));
        last = "title";
      } else {
        const idx = level <= 2 ? 0 : level === 3 ? 1 : 2; // ## -> Heading 1, ### -> Heading 2, #### -> Heading 3
        body.push(new Paragraph({ heading: H[idx], children: inline(text) }));
        stats.headings++;
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

    // normal paragraph
    body.push(new Paragraph({ children: inline(t) }));
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

    const lvl = (n, format, text, left) => ({
      level: n,
      format,
      text,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left, hanging: 360 } } },
    });

    const doc = new Document({
      creator: "agent-cmd",
      title: title || "Document",
      styles: {
        default: {
          document: {
            run: { font: FONT, size: 22 },
            paragraph: { spacing: { after: 140, line: 276, lineRule: LineRuleType.AUTO } },
          },
          title: {
            run: { font: FONT, size: 56, bold: true, color: BLUE_DARK },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160, line: 276, lineRule: LineRuleType.AUTO } },
          },
          heading1: {
            run: { font: FONT, size: 32, bold: true, color: BLUE_DARK },
            paragraph: {
              spacing: { before: 360, after: 140, line: 276, lineRule: LineRuleType.AUTO },
              keepNext: true,
              outlineLevel: 0,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREY_LINE, space: 2 } },
            },
          },
          heading2: {
            run: { font: FONT, size: 26, bold: true, color: BLUE },
            paragraph: { spacing: { before: 240, after: 100, line: 276, lineRule: LineRuleType.AUTO }, keepNext: true, outlineLevel: 1 },
          },
          heading3: {
            run: { font: FONT, size: 24, bold: true, color: "404040" },
            paragraph: { spacing: { before: 200, after: 80, line: 276, lineRule: LineRuleType.AUTO }, keepNext: true, outlineLevel: 2 },
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
                  children: [
                    new TextRun({ text: "Page ", size: 18, color: "7F7F7F" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "7F7F7F" }),
                    new TextRun({ text: " of ", size: 18, color: "7F7F7F" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "7F7F7F" }),
                  ],
                }),
              ],
            }),
          },
          children: body,
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
    if (stats.code) parts.push(`${stats.code} code blocks`);
    let message = `OK: saved ${file}${title ? ` (title: "${title}")` : ""} with ${parts.join(", ") || "no content"}.`;
    if (path.basename(file) !== wanted) message += ` The name ${wanted} was locked (open in Word), so it was saved under a new name.`;
    message += open ? " It was opened in Word." : "";
    return { ok: true, path: file, message };
  } catch (err) {
    return { ok: false, message: "NOT CREATED: " + err.message };
  }
}