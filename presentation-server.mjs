// presentation-server.mjs
// MCP server that types a presentation into PowerPoint (Windows).
//
// Two tools:
//   1. create_presentation   -> you send the slides (and optionally a theme) yourself
//   2. generate_presentation -> you send only a TOPIC; the AI writes the slides.
//                               The look is the DEFAULT theme, unless you give a
//                               "style" wish. Then the AI also designs the theme
//                               (colors, fonts, shapes) from that wish.
//
// Setup:  npm install openai
// Env:    XKIRO_API_KEY must be set in the environment that launches this server
//         (Inspector "Environment Variables" box, or "env" in your MCP client config).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import OpenAI from "openai";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// ---- AI setup ----
const apiKey = process.env.XKIRO_API_KEY;

const client = apiKey
  ? new OpenAI({
      baseURL: "https://api.xkiro.com/v1",
      apiKey,
      maxRetries: 0, // we do our own retrying (it also fixes bad JSON)
    })
  : null;

const AI_MODEL = "qwen/qwen3.8-max:free";

// ======================================================================
//  THEME: the look of the whole deck
// ======================================================================

// Fonts that exist on every Windows + Office install (safe choices)
const FONTS = [
  "Segoe UI",
  "Calibri",
  "Arial",
  "Arial Black",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Georgia",
  "Cambria",
  "Palatino Linotype",
  "Century Gothic",
  "Impact",
  "Consolas",
  "Comic Sans MS",
];

const DECORATIONS = ["underline", "sidebar", "frame", "corner", "none"];
const CARD_STYLES = ["rounded", "square", "outline", "filled"];

// The default look. Used when no theme / no style wish is given.
const DEFAULT_THEME = {
  name: "Midnight Blue",
  background: "#0F172A",
  background2: "", // empty = plain color, no gradient
  card: "#1E293B",
  accent: "#38BDF8",
  title: "#38BDF8",
  text: "#F8FAFC",
  titleFont: "Segoe UI",
  bodyFont: "Segoe UI",
  decoration: "underline",
  cardStyle: "rounded",
  titleAlign: "left",
};

const hexColor = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #1E293B");

const themeFields = {
  name: z.string().optional().describe("Short name of the theme"),
  background: hexColor.describe("Slide background color"),
  background2: hexColor.optional().describe("Optional second color: the background becomes a gradient"),
  card: hexColor.describe("Fill color of the cards"),
  accent: hexColor.describe("Color of bars, borders and card headings"),
  title: hexColor.describe("Color of the slide titles"),
  text: hexColor.describe("Color of the normal text"),
  titleFont: z.enum(FONTS).optional().describe("Font for titles and card headings"),
  bodyFont: z.enum(FONTS).optional().describe("Font for bullets and card text"),
  decoration: z.enum(DECORATIONS).optional().describe("Extra shapes on every slide"),
  cardStyle: z.enum(CARD_STYLES).optional().describe("Look of the cards"),
  titleAlign: z.enum(["left", "center"]).optional().describe("Title alignment on bullet/card slides"),
};

// The AI must give a full set of colors. In create_presentation everything is optional.
const aiThemeSchema = z.object(themeFields);
const toolThemeSchema = z.object(themeFields).partial();

const normHex = (h) => "#" + String(h).replace("#", "").toUpperCase();

// WCAG contrast ratio (1 = identical, 21 = black on white)
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Makes sure the text is actually readable (the AI sometimes picks grey on grey)
function checkThemeContrast(t) {
  const problems = [];
  const check = (nameA, a, nameB, b, min) => {
    const ratio = contrastRatio(a, b);
    if (ratio < min) {
      problems.push(`"${nameA}" (${a}) is too close to "${nameB}" (${b}): contrast ${ratio.toFixed(1)}, needs at least ${min}`);
    }
  };

  const backgrounds = [["background", t.background]];
  if (t.background2) backgrounds.push(["background2", t.background2]);

  for (const [name, color] of backgrounds) {
    check("text", t.text, name, color, 4.5);
    check("title", t.title, name, color, 3);
    check("accent", t.accent, name, color, 3);
  }
  // "outline" cards have no fill, so the text sits on the background there
  if (t.cardStyle !== "outline") {
    check("text", t.text, "card", t.card, 4.5);
    check("accent", t.accent, "card", t.card, 3);
  }

  if (problems.length) {
    throw new Error("Theme colors are hard to read: " + problems.join("; ") + ". Pick colors with stronger contrast.");
  }
}

// Fills in missing theme fields with the DEFAULT theme, cleans the colors, checks readability.
// Called with nothing (or {}) -> you get exactly the default theme.
function resolveTheme(input = {}) {
  const theme = { ...DEFAULT_THEME };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value !== undefined && value !== null && value !== "") theme[key] = value;
  }
  for (const key of ["background", "background2", "card", "accent", "title", "text"]) {
    if (theme[key]) theme[key] = normHex(theme[key]);
  }
  checkThemeContrast(theme);
  return theme;
}

// ======================================================================
//  The PowerShell part
// ======================================================================
function buildScript({ slides, theme, typeDelayMs, showSlideshow, secondsPerSlide }) {
  return `
$ErrorActionPreference = "Stop"
$delay = ${typeDelayMs}
$showSlideshow = ${showSlideshow ? "$true" : "$false"}
$showMs = ${secondsPerSlide * 1000}

$deck = @'
${JSON.stringify({ theme, slides }, null, 2)}
'@ | ConvertFrom-Json

$theme = $deck.theme
$slides = @($deck.slides)

# PowerPoint colors are numbers in Blue-Green-Red order
function RGB($r, $g, $b) { return $r + ($g * 256) + ($b * 65536) }

# Turns "#1E293B" into a PowerPoint color number
function Hex-Color($hx) {
  $hx = $hx.TrimStart('#')
  $r = [Convert]::ToInt32($hx.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($hx.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($hx.Substring(4, 2), 16)
  return (RGB $r $g $b)
}

# ---- Everything below comes from the theme ----
$bgColor     = (Hex-Color $theme.background)
$hasGradient = -not [string]::IsNullOrEmpty($theme.background2)
$bg2Color    = $bgColor
if ($hasGradient) { $bg2Color = (Hex-Color $theme.background2) }
$cardColor   = (Hex-Color $theme.card)
$accent      = (Hex-Color $theme.accent)
$titleColor  = (Hex-Color $theme.title)
$textColor   = (Hex-Color $theme.text)
$titleFont   = $theme.titleFont
$bodyFont    = $theme.bodyFont
$decoration  = $theme.decoration
$cardStyle   = $theme.cardStyle
$titleAlign  = 1                                  # 1 = left, 2 = center
if ($theme.titleAlign -eq "center") { $titleAlign = 2 }
$yes = -1
$no  = 0

Write-Host "Theme: $($theme.name) | $($theme.decoration) | cards: $($theme.cardStyle)"

# Type text into a shape one character at a time.
# Uses "text elements" so emojis (which are 2 characters) are never cut in half.
function Type-Text($shape, $text) {
  if ([string]::IsNullOrEmpty($text)) { return }
  $typed = ""
  $e = [System.Globalization.StringInfo]::GetTextElementEnumerator($text)
  while ($e.MoveNext()) {
    $typed += $e.GetTextElement()
    $shape.TextFrame.TextRange.Text = $typed
    Start-Sleep -Milliseconds $delay
  }
}

# Background (solid or gradient), title and body styling (applied after typing)
function Style-Slide($slide, $titleShape, $bodyShape, $isTitleSlide) {
  $slide.FollowMasterBackground = 0
  $fill = $slide.Background.Fill
  $fill.Solid()
  $fill.ForeColor.RGB = $bgColor

  if ($hasGradient) {
    try {
      $fill.TwoColorGradient(1, 1)      # 1 = horizontal bands = top to bottom
      $fill.ForeColor.RGB = $bgColor
      $fill.BackColor.RGB = $bg2Color
    } catch {
      Write-Host "(gradient not supported, using a plain color)"
    }
  }

  $titleRange = $titleShape.TextFrame.TextRange
  $titleRange.Font.Bold = -1
  $titleRange.Font.Name = $titleFont
  $titleRange.Font.Color.RGB = $titleColor
  if ($isTitleSlide) { $titleRange.ParagraphFormat.Alignment = 2 }
  else { $titleRange.ParagraphFormat.Alignment = $titleAlign }

  if ($bodyShape -ne $null) {
    $bodyRange = $bodyShape.TextFrame.TextRange
    $bodyRange.Font.Name = $bodyFont
    $bodyRange.Font.Color.RGB = $textColor
    if ($isTitleSlide) { $bodyRange.ParagraphFormat.Alignment = 2 }
  }
}

# Emojis already act as bullets, so hide the round bullet dots
function Tidy-Bullets($bodyShape) {
  try {
    $range = $bodyShape.TextFrame.TextRange
    $range.ParagraphFormat.Bullet.Visible = 0
    $range.ParagraphFormat.LineRuleAfter = 0
    $range.ParagraphFormat.SpaceAfter = 14
    $bodyShape.TextFrame.Ruler.Levels.Item(1).FirstMargin = 0
    $bodyShape.TextFrame.Ruler.Levels.Item(1).LeftMargin = 0
  } catch {
    Write-Host "(skipped bullet cleanup)"
  }
}

# Small colored bar under the slide title (follows the title alignment)
function Add-TitleBar($titleShape, $slide) {
  $barW = 90
  $x = $titleShape.Left + 8
  if ($titleAlign -eq 2) { $x = ($W - $barW) / 2 }
  $bar = $slide.Shapes.AddShape(1, $x, ($titleShape.Top + $titleShape.Height), $barW, 5)
  $bar.Fill.ForeColor.RGB = $accent
  $bar.Line.Visible = 0
}

# Short centered bar between title and subtitle on title slides
function Add-Divider($titleShape, $slide) {
  $bar = $slide.Shapes.AddShape(1, (($W - 120) / 2), ($titleShape.Top + $titleShape.Height + 4), 120, 5)
  $bar.Fill.ForeColor.RGB = $accent
  $bar.Line.Visible = 0
}

# Thin colored strip along the bottom edge
function Add-FooterBar($slide) {
  $bar = $slide.Shapes.AddShape(1, 0, ($H - 8), $W, 8)
  $bar.Fill.ForeColor.RGB = $accent
  $bar.Line.Visible = 0
}

# Colored strip down the left edge
function Add-Sidebar($slide) {
  $bar = $slide.Shapes.AddShape(1, 0, 0, 18, $H)
  $bar.Fill.ForeColor.RGB = $accent
  $bar.Line.Visible = 0
}

# Border around the whole slide
function Add-Frame($slide) {
  $f = $slide.Shapes.AddShape(1, 14, 14, ($W - 28), ($H - 28))
  $f.Fill.Visible = 0
  $f.Line.ForeColor.RGB = $accent
  $f.Line.Weight = 3
}

# Two soft circles in opposite corners, sent behind everything else
function Add-Corners($slide) {
  $c1 = $slide.Shapes.AddShape(9, ($W - 130), -130, 260, 260)
  $c2 = $slide.Shapes.AddShape(9, -130, ($H - 130), 260, 260)
  foreach ($c in @($c1, $c2)) {
    $c.Fill.ForeColor.RGB = $accent
    $c.Fill.Transparency = 0.85
    $c.Line.Visible = 0
    $c.ZOrder(1)                          # 1 = send to back
  }
}

# Picks the extra shapes for the theme's "decoration" setting
function Add-Decor($slide, $titleShape, $isTitleSlide) {
  switch ($decoration) {
    "underline" {
      if ($isTitleSlide) { Add-Divider $titleShape $slide } else { Add-TitleBar $titleShape $slide }
      Add-FooterBar $slide
    }
    "sidebar" {
      Add-Sidebar $slide
      if ($isTitleSlide) { Add-Divider $titleShape $slide }
    }
    "frame" {
      Add-Frame $slide
      if ($isTitleSlide) { Add-Divider $titleShape $slide } else { Add-TitleBar $titleShape $slide }
    }
    "corner" {
      if ($isTitleSlide) { Add-Divider $titleShape $slide } else { Add-TitleBar $titleShape $slide }
      Add-Corners $slide
    }
    default { }
  }
}

# Add a text box, format it, type into it, then format again to be safe
function Add-Text($slide, $left, $top, $width, $height, $text, $size, $bold, $color, $align, $font) {
  $tb = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
  $tb.TextFrame.WordWrap = -1
  $range = $tb.TextFrame.TextRange
  $range.ParagraphFormat.Alignment = $align
  $range.Font.Name = $font
  $range.Font.Size = $size
  $range.Font.Bold = $bold
  $range.Font.Color.RGB = $color

  Type-Text $tb $text

  $range = $tb.TextFrame.TextRange
  $range.ParagraphFormat.Alignment = $align
  $range.Font.Name = $font
  $range.Font.Size = $size
  $range.Font.Bold = $bold
  $range.Font.Color.RGB = $color
}

# A row of cards: big emoji, heading, then lines of text
function Add-Cards($slide, $cards) {
  $cards = @($cards)
  $count = $cards.Count
  $margin = 60
  $gap = 20
  $cardW = ($W - (2 * $margin) - ($gap * ($count - 1))) / $count
  $top = 175
  $cardH = 270

  for ($i = 0; $i -lt $count; $i++) {
    $c = $cards[$i]
    $x = $margin + ($i * ($cardW + $gap))

    $shapeType = 5                        # 5 = rounded rectangle
    if ($cardStyle -eq "square") { $shapeType = 1 }

    $card = $slide.Shapes.AddShape($shapeType, $x, $top, $cardW, $cardH)

    if ($cardStyle -eq "outline") { $card.Fill.Visible = 0 }
    else { $card.Fill.ForeColor.RGB = $cardColor }

    if ($cardStyle -eq "filled") { $card.Line.Visible = 0 }
    else {
      $card.Line.ForeColor.RGB = $accent
      $card.Line.Weight = 1.5
    }

    if ($shapeType -eq 5) { try { $card.Adjustments.Item(1) = 0.08 } catch { } }

    Add-Text $slide $x ($top + 20) $cardW 60 $c.emoji 44 $no $textColor 2 "Segoe UI Emoji"
    Add-Text $slide $x ($top + 100) $cardW 40 $c.heading 24 $yes $accent 2 $titleFont
    Add-Text $slide $x ($top + 150) $cardW 100 ($c.items -join [string][char]13) 18 $no $textColor 2 $bodyFont
  }
}

Write-Host "Opening PowerPoint..."
$app = New-Object -ComObject PowerPoint.Application
$app.Visible = -1

Write-Host "Creating a blank presentation..."
$pres = $app.Presentations.Add(-1)
$app.WindowState = 3          # maximized
Start-Sleep -Milliseconds 1500

$W = $pres.PageSetup.SlideWidth
$H = $pres.PageSetup.SlideHeight

$index = 0
foreach ($s in $slides) {
  $index++
  Write-Host "Typing slide $index ($($s.type))..."

  # Layout 1 = title slide, 2 = title + text, 11 = title only
  $layout = 2
  if ($s.type -eq "title") { $layout = 1 }
  if ($s.type -eq "cards") { $layout = 11 }

  $slide = $pres.Slides.Add($index, $layout)
  $app.ActiveWindow.View.GotoSlide($index)
  Start-Sleep -Milliseconds 600

  # Grab the placeholders once, because decorations can change the shape order
  $titleShape = $slide.Shapes.Item(1)
  Type-Text $titleShape $s.title

  if ($s.type -eq "title") {
    $bodyShape = $slide.Shapes.Item(2)
    Type-Text $bodyShape $s.subtitle
    Style-Slide $slide $titleShape $bodyShape $true
    Add-Decor $slide $titleShape $true
  }
  elseif ($s.type -eq "bullets") {
    $bodyShape = $slide.Shapes.Item(2)
    Type-Text $bodyShape ($s.points -join [string][char]13)
    Style-Slide $slide $titleShape $bodyShape $false
    Tidy-Bullets $bodyShape
    Add-Decor $slide $titleShape $false
  }
  else {
    Style-Slide $slide $titleShape $null $false
    Add-Decor $slide $titleShape $false
    Add-Cards $slide $s.cards
  }

  Start-Sleep -Milliseconds 500
}

if ($showSlideshow) {
  Write-Host "Starting slideshow..."
  Start-Sleep -Milliseconds 1500
  $pres.SlideShowSettings.Run() | Out-Null
  for ($n = 1; $n -lt $pres.Slides.Count; $n++) {
    Start-Sleep -Milliseconds $showMs
    $pres.SlideShowWindow.View.Next()
  }
  Start-Sleep -Milliseconds $showMs
  $pres.SlideShowWindow.View.Exit()
}

Write-Host "Done! Press Ctrl+S in PowerPoint if you want to save it."
`;
}

// ---- Start PowerShell in the background ----
// Important: we do NOT use stdio "inherit" like in index.js.
// An MCP server's stdout belongs to the MCP protocol, so PowerShell's
// messages are sent to stderr (the log area) instead.
function startPresentation(options) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(os.tmpdir(), `make-presentation-${Date.now()}.ps1`);
    fs.writeFileSync(scriptPath, "\uFEFF" + buildScript(options), "utf8");

    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    ps.stdout.on("data", (d) => console.error("[powershell]", d.toString().trim()));
    ps.stderr.on("data", (d) => console.error("[powershell error]", d.toString().trim()));
    ps.on("spawn", () => resolve());   // started OK, don't wait for it to finish
    ps.on("error", reject);            // could not start at all
    ps.on("close", (code) => {
      if (code !== 0) console.error("PowerShell exited with code", code);
      fs.rmSync(scriptPath, { force: true });
    });
  });
}

// ---- Slide shape (shared by both tools) ----
const slideSchema = z.object({
  type: z.enum(["title", "bullets", "cards"]).describe("Slide layout"),
  title: z.string(),
  subtitle: z.string().optional().describe("Only for type 'title'"),
  points: z.array(z.string()).optional().describe("Only for type 'bullets'"),
  cards: z
    .array(
      z.object({
        emoji: z.string(),
        heading: z.string(),
        items: z.array(z.string()),
      })
    )
    .optional()
    .describe("Only for type 'cards'"),
});

// What the AI must return:
//  - with a style wish:    a theme AND the slides
//  - without a style wish: only the slides (the default theme is used)
const deckSchema = z.object({ theme: aiThemeSchema, slides: z.array(slideSchema).min(1) });
const slidesOnlySchema = z.object({ slides: z.array(slideSchema).min(1) });

// Returns the number of the first slide with missing content (or -1 if all fine).
// Used by create_presentation.
function findBadSlide(slides) {
  return slides.findIndex(
    (s) => (s.type === "bullets" && !s.points?.length) || (s.type === "cards" && !s.cards?.length)
  );
}

// ======================================================================
//  AI PART: topic in -> slides out (+ theme only if a style wish is given)
// ======================================================================

// Only used when the user gave a style wish.
const THEME_RULES = `THEME: you design the look of the whole deck from the "Style wish" in the user message.
This is only a FORMAT example. Do not copy its colors or fonts unless the style wish asks for them:
{
  "name": "Sunset Warm",
  "background": "#FFF7ED",
  "background2": "#FED7AA",
  "card": "#FFFFFF",
  "accent": "#EA580C",
  "title": "#9A3412",
  "text": "#431407",
  "titleFont": "Georgia",
  "bodyFont": "Calibri",
  "decoration": "corner",
  "cardStyle": "rounded",
  "titleAlign": "left"
}

Theme rules:
- Follow the Style wish exactly. If it names colors, a mood, or fonts, use them. Base the design on the Style wish, not on the topic.
- All colors are 6-digit hex like "#1E293B".
- "background2" is optional. If you give it, the background becomes a gradient from "background" to "background2". Keep both colors close enough that the same text color is readable on both.
- "text" must contrast STRONGLY with "background" and with "card". Dark background -> light text. Light background -> dark text. Never grey on grey.
- "title" (slide titles) and "accent" (bars, borders, card headings) must also stand out clearly from "background" and "card".
- "card" is the card fill: a little lighter or darker than the background.
- "titleFont" and "bodyFont" must be one of: ${FONTS.join(", ")}.
- "decoration" is one of: "underline" (bar under titles + strip at the bottom), "sidebar" (colored strip on the left edge), "frame" (border around the slide), "corner" (soft circles in the corners), "none".
- "cardStyle" is one of: "rounded", "square", "outline" (no fill, border only), "filled" (fill, no border).
- "titleAlign" is "left" or "center".
- Light themes and dark themes are both fine.`;

// The layout in the PowerShell script is fixed, so we tell the AI the size limits.
const SLIDE_RULES = `Each slide has one of three types:
1) {"type":"title","title":"...","subtitle":"..."}
2) {"type":"bullets","title":"...","points":["...","..."]}
3) {"type":"cards","title":"...","cards":[{"emoji":"🚀","heading":"...","items":["...","..."]}]}

Slide rules:
- The FIRST slide is always type "title". The LAST slide should be a short wrap-up or takeaway.
- Use a mix of "bullets" and "cards" for the slides in between.
- Titles: max 40 characters.
- Bullets: 3 to 5 points, max 60 characters each. Start EVERY point with one fitting emoji
  followed by a space (the emoji replaces the bullet dot).
- Cards: 2 to 4 cards per slide (3 is best). "emoji" holds exactly one emoji.
  "heading": max 12 characters. "items": 2 to 3 short phrases, max 20 characters each.
- Use short phrases, not full sentences. Be accurate and concrete.
- Write all text in the language the user asks for.`;

function buildSystemPrompt(withTheme) {
  if (withTheme) {
    return `You design and write slide content for a PowerPoint generator.
Reply with ONE JSON object and nothing else: no markdown, no code fences, no explanation.

Format:
{ "theme": { ...theme... }, "slides": [ ...slides... ] }

${THEME_RULES}

${SLIDE_RULES}`;
  }

  return `You write slide content for a PowerPoint generator.
Reply with ONE JSON object and nothing else: no markdown, no code fences, no explanation.

Format:
{ "slides": [ ...slides... ] }

Do NOT include a theme. The design is handled somewhere else.

${SLIDE_RULES}`;
}

function describeError(err) {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  return err?.message ?? String(err);
}

// Models often wrap JSON in ```json fences or add <think> blocks. Dig the JSON out.
function extractJson(raw) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in the reply.");

  // null -> removed, so optional fields like "subtitle": null still validate
  return JSON.parse(text.slice(start, end + 1), (_key, value) => (value === null ? undefined : value));
}

// Checks things zod can't express (a "bullets" slide needs points, etc.)
function checkSlides(slides) {
  const bad = findBadSlide(slides);
  if (bad !== -1) throw new Error(`Slide ${bad + 1} (${slides[bad].type}) is missing its content.`);

  slides.forEach((s, i) => {
    if (s.type === "cards" && s.cards.length > 4) {
      throw new Error(`Slide ${i + 1} has ${s.cards.length} cards; the maximum is 4.`);
    }
  });
}

// "" / "none" / "default" mean: the user did not ask for a special look
function cleanStyleWish(style) {
  const wish = String(style ?? "").trim();
  if (!wish || /^(none|default|n\/a|no|-)$/i.test(wish)) return "";
  return wish;
}

async function generateDeck({ topic, slideCount, audience, language, style }) {
  if (!client) {
    throw new Error("XKIRO_API_KEY is not set, so the AI cannot be used.");
  }

  // Style wish given -> the AI designs a theme. Otherwise -> default theme.
  const wish = cleanStyleWish(style);
  const wantsTheme = wish !== "";

  const userLines = [
    `Topic: ${topic}`,
    `Number of slides: exactly ${slideCount}`,
    `Audience: ${audience || "general audience"}`,
    `Language: ${language || "English"}`,
  ];
  if (wantsTheme) userLines.push(`Style wish: ${wish}`);

  const messages = [
    { role: "system", content: buildSystemPrompt(wantsTheme) },
    { role: "user", content: userLines.join("\n") },
  ];

  const schema = wantsTheme ? deckSchema : slidesOnlySchema;
  const retryHint = wantsTheme ? "(theme and slides)" : "(slides only, no theme)";

  const MAX_TRIES = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    console.error(`[ai] asking ${AI_MODEL} (attempt ${attempt}/${MAX_TRIES}, ${wantsTheme ? "custom theme" : "default theme"})...`);

    const response = await client.chat.completions.create(
      { model: AI_MODEL, messages, temperature: 0.8 },
      { timeout: 60_000 }
    );
    const raw = response.choices?.[0]?.message?.content ?? "";

    try {
      const deck = schema.parse(extractJson(raw));
      checkSlides(deck.slides);

      // No style wish -> exactly the default theme. Style wish -> the AI's theme (contrast is checked).
      const theme = wantsTheme ? resolveTheme(deck.theme) : resolveTheme();
      return { theme, slides: deck.slides.slice(0, slideCount) };
    } catch (err) {
      lastError = err;
      console.error(`[ai] attempt ${attempt} was unusable:`, describeError(err));

      // Show the model its own mistake and ask again
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `That reply could not be used: ${describeError(err)}\nReply again with ONLY the corrected JSON object ${retryHint}.`,
      });
    }
  }

  throw new Error(`The AI did not return a valid deck after ${MAX_TRIES} tries. Last problem: ${describeError(lastError)}`);
}

// ======================================================================
//  The MCP part
// ======================================================================
const server = new McpServer({
  name: "powerpoint-automation",
  version: "1.3.0",
});

// ---- Tool 1: you provide the slides (and optionally the theme) ----
server.registerTool(
  "create_presentation",
  {
    description:
      "Open PowerPoint on Windows and type out a new presentation slide by slide, then optionally play it as a slideshow. " +
      "You can pass a theme to control colors, fonts and shapes; without one the default dark-blue look is used.",
    inputSchema: {
      slides: z.array(slideSchema).min(1).describe("The slides to create, in order"),
      theme: toolThemeSchema.optional().describe("Visual design of the deck. Colors are hex like #1E293B. Leave out for the default theme."),
      typeDelayMs: z.number().optional().describe("Delay between typed letters in ms (default 30)"),
      showSlideshow: z.boolean().optional().describe("Play the slideshow at the end (default true)"),
      secondsPerSlide: z.number().optional().describe("Seconds per slide in the slideshow (default 2)"),
    },
  },
  async ({ slides, theme: themeInput, typeDelayMs = 30, showSlideshow = true, secondsPerSlide = 2 }) => {
    if (process.platform !== "win32") {
      return { isError: true, content: [{ type: "text", text: "This tool only works on Windows with PowerPoint installed." }] };
    }

    const bad = findBadSlide(slides);
    if (bad !== -1) {
      return { isError: true, content: [{ type: "text", text: `Slide ${bad + 1} is missing its points or cards.` }] };
    }

    let theme;
    try {
      theme = resolveTheme(themeInput);
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }

    try {
      await startPresentation({ slides, theme, typeDelayMs, showSlideshow, secondsPerSlide });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Could not start PowerShell: ${err.message}` }] };
    }

    return {
      content: [{ type: "text", text: `Started. PowerPoint is now typing ${slides.length} slide(s) with the "${theme.name}" theme. Watch your screen.` }],
    };
  }
);

// ---- Tool 2: you give a topic; the AI writes the slides ----
//      Default theme, unless a style wish is given. Then the AI designs the look from it.
server.registerTool(
  "generate_presentation",
  {
    description:
      "Give a topic. An AI writes the slides, then PowerPoint (Windows) opens and types them out, optionally playing a slideshow. " +
      "The default dark-blue theme is used unless a 'style' is given. If the user mentions any look, colors, mood or fonts, " +
      "pass it in 'style' and the AI designs the theme from it.",
    inputSchema: {
      topic: z.string().min(3).describe("What the presentation is about"),
      slideCount: z.number().int().min(2).max(12).optional().describe("Number of slides (default 5)"),
      audience: z.string().optional().describe("Who it is for, e.g. 'high-school students' (default: general audience)"),
      language: z.string().optional().describe("Language of the slides (default English)"),
      style: z
        .string()
        .optional()
        .describe("Only if the user asked for a look: colors, mood or fonts, in their own words, e.g. 'dark red and gold, luxury'. If left out, the default theme is used."),
      typeDelayMs: z.number().optional().describe("Delay between typed letters in ms (default 30)"),
      showSlideshow: z.boolean().optional().describe("Play the slideshow at the end (default true)"),
      secondsPerSlide: z.number().optional().describe("Seconds per slide in the slideshow (default 2)"),
    },
  },
  async ({
    topic,
    slideCount = 5,
    audience,
    language,
    style,
    typeDelayMs = 30,
    showSlideshow = true,
    secondsPerSlide = 2,
  }) => {
    // Check the cheap things first, before spending an AI request
    if (process.platform !== "win32") {
      return { isError: true, content: [{ type: "text", text: "This tool only works on Windows with PowerPoint installed." }] };
    }
    if (!client) {
      return { isError: true, content: [{ type: "text", text: "XKIRO_API_KEY is not set. Add it to the server's environment variables and restart." }] };
    }

    let deck;
    try {
      deck = await generateDeck({ topic, slideCount, audience, language, style });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `AI step failed: ${err.message}` }] };
    }

    const { theme, slides } = deck;

    try {
      await startPresentation({ slides, theme, typeDelayMs, showSlideshow, secondsPerSlide });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Could not start PowerShell: ${err.message}` }] };
    }

    const outline = slides.map((s, i) => `${i + 1}. [${s.type}] ${s.title}`).join("\n");
    const look = `Theme "${theme.name}": background ${theme.background}${theme.background2 ? " -> " + theme.background2 : ""}, accent ${theme.accent}, fonts ${theme.titleFont}/${theme.bodyFont}, ${theme.decoration} decoration, ${theme.cardStyle} cards`;
    return {
      content: [
        {
          type: "text",
          text: `The AI wrote ${slides.length} slide(s) and PowerPoint is now typing them. Watch your screen.\n\n${look}\n\n${outline}`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("powerpoint-automation MCP server is running");
