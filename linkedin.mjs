// linkedin.mjs - standalone LinkedIn test. Browser only (Playwright MCP).
// Run:   node --env-file=.env linkedin.mjs
// Needs: Node 20.6+, npm install openai @modelcontextprotocol/sdk, XKIRO_API_KEY in .env

import OpenAI from "openai";
import readline from "readline/promises";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---- Settings ----
const AI_MODEL = "mistralai/mistral-large-2512";
const MAX_ROUNDS = 12;               // lower = less token burn when it loops
const MAX_TOOL_OUTPUT = 12000;
const MAX_SNAPSHOT_LINES = 120;      // actionable elements sent to the AI
const KEEP_FULL_TOOL_OUTPUTS = 2;
const TOOL_TIMEOUT_MS = 30_000;
const MAX_ARGUMENT_CHARS = 2000;
const TEMPERATURE = 0.2;
const AFTER_ACTION_WAIT_MS = 1500;   // LinkedIn dialogs render slowly
const MAX_SAME_ATTEMPT = 2;          // same description/text more than this = stop
const START_PAGE = null;             // e.g. "https://www.linkedin.com/feed/"
const CONFIRM_BEFORE_POSTING = true; // asks y/n before clicking a Post/Publish button

const isWin = process.platform === "win32";
const here = path.dirname(fileURLToPath(import.meta.url));

// ---- Browser server (Playwright MCP) ----
const configFile = path.join(here, "playwright-config.json");
const serverArgs = ["-y", "@playwright/mcp@latest"];
if (fs.existsSync(configFile)) serverArgs.push(`--config=${configFile}`);

const ONLY = [
  "browser_navigate", "browser_navigate_back", "browser_snapshot", "browser_click",
  "browser_hover", "browser_type", "browser_press_key", "browser_select_option",
  "browser_wait_for", "browser_wait", "browser_tabs", "browser_tab_new",
  "browser_tab_select", "browser_tab_close", "browser_close",
];
// Actions that change the page: the client attaches a fresh snapshot after each one
const BROWSER_ACTIONS = new Set(["browser_click", "browser_type", "browser_press_key", "browser_select_option", "browser_hover"]);
// Tools that need a real ref (like "e45") as target
const NEEDS_REF = new Set(["browser_click", "browser_hover", "browser_type", "browser_select_option"]);

const LINKEDIN_HINTS = [
  "Open LinkedIn with browser_navigate to https://www.linkedin.com/feed/ if you are not on it already.",
  "'Start a post' is a button near the top of the feed. Clicking it opens a dialog ('Create a post') with a text box. " +
    "The click worked ONLY if the next snapshot shows that dialog. If it does not, take ONE fresh snapshot and click once more. " +
    "If the dialog is still not there, stop and tell the user. Never say it opened without seeing the dialog.",
  "To write a post: after the dialog is open, click its text box, then call browser_type with the text. " +
    "Do NOT click the Post button unless the user explicitly asked to publish.",
  "If you see a login page, a CAPTCHA or a 'verify you are human' page: stop, tell the user to handle it in the browser window. " +
    "Never type passwords.",
];

// ---- The AI ----
const apiKey = process.env.XKIRO_API_KEY;
if (!apiKey) {
  console.error("XKIRO_API_KEY is not set. Run with: node --env-file=.env linkedin.mjs");
  process.exit(1);
}
const ai = new OpenAI({ apiKey, baseURL: "https://api.xkiro.com/v1" });

// ---- Connect ----
const serverEnv = { ...process.env };
delete serverEnv.XKIRO_API_KEY;

const client = new Client({ name: "linkedin-test", version: "1.0.0" });
const toolMap = {};
const aiTools = [];

try {
  const command = isWin ? "cmd" : "npx";
  const args = isWin ? ["/c", "npx", ...serverArgs] : serverArgs;
  await client.connect(new StdioClientTransport({ command, args, env: serverEnv, stderr: "inherit" }));

  const listed = (await client.listTools()).tools;
  const picked = listed.filter((t) => ONLY.includes(t.name));
  const tools = picked.length >= ONLY.length / 2 ? picked : listed;
  for (const t of tools) {
    toolMap[t.name] = t.name;
    aiTools.push({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } });
  }
  console.log(`Browser server ready. Giving the AI ${tools.length} tools:`, tools.map((t) => t.name).join(", "));
} catch (err) {
  console.error("Could not start the Playwright MCP server:", err.message);
  process.exit(1);
}

// Local tool: search the live page by visible text and return the ref
toolMap["find_on_page"] = "local";
aiTools.push({
  type: "function",
  function: {
    name: "find_on_page",
    description:
      "Search the current page for an element by its visible text and return matching lines with their refs. " +
      "Use this FIRST to get the ref, then pass that ref as target to browser_click or browser_type.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Visible text or name, e.g. 'Start a post'" } },
      required: ["text"],
    },
  },
});

// <compact>
// Keep only what the AI can act on. If a dialog is open, its elements come first.
const ACTIONABLE = /^\s*- (button|link|textbox|combobox|searchbox|checkbox|radio|switch|menuitem|tab|option|dialog)\b/;

function compactSnapshot(text, maxLines = 120) {
  const start = text.indexOf("```yaml");
  if (start < 0) return text;
  const end = text.indexOf("```", start + 7);
  let lines = text.slice(start + 7, end < 0 ? undefined : end).split("\n");
  let first = [];
  const d = lines.findIndex((l) => /^\s*- dialog\b/.test(l));
  if (d >= 0) {
    const indent = lines[d].search(/\S/);
    let e = d + 1;
    while (e < lines.length && lines[e].search(/\S/) > indent) e++;
    first = lines.slice(d, e);
    lines = [...lines.slice(0, d), ...lines.slice(e)];
  }
  const kept = [...first, ...lines].filter((l) => ACTIONABLE.test(l)).slice(0, maxLines);
  return text.slice(0, start) + "(actionable elements only)\n" + kept.join("\n");
}
// </compact>

// The latest FULL snapshot (before compacting). find_on_page searches this.
let lastFullSnapshot = "";

function findOnPage(text) {
  const needle = String(text ?? "").toLowerCase().trim();
  if (!needle) return "ERROR: text is empty";
  const lines = lastFullSnapshot.split("\n");
  const out = [];
  for (let i = 0; i < lines.length && out.length < 8; i++) {
    if (!lines[i].toLowerCase().includes(needle)) continue;
    let j = i;
    if (!lines[j].includes("[ref=")) {
      // text without its own ref: use the closest parent that has one
      const indent = lines[i].search(/\S/);
      while (j > 0 && !(lines[j].includes("[ref=") && lines[j].search(/\S/) < indent)) j--;
    }
    const hit = lines[j].trim();
    if (hit.includes("[ref=") && !out.includes(hit)) out.push(hit);
  }
  return out.length
    ? "Matches (use the ref as target in browser_click):\n" + out.join("\n")
    : `Nothing on the page matches "${text}".`;
}

function shorten(text, max) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  return text.slice(0, head) + "\n...[middle cut out]...\n" + text.slice(-(max - head));
}

async function snapshotNow() {
  const snap = await client.callTool({ name: "browser_snapshot", arguments: {} }, undefined, { timeout: TOOL_TIMEOUT_MS });
  if (snap.isError) return null;
  return (snap.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
}

if (START_PAGE) {
  try {
    await client.callTool({ name: "browser_navigate", arguments: { url: START_PAGE } });
  } catch (err) {
    console.log("(Could not open the start page:", err.message + ")");
  }
}

// ---- Prompt ----
const messages = [
  {
    role: "system",
    content:
      "You control a real Chrome browser with the browser_ tools and help the user on LinkedIn. " +
      "Call tools instead of describing what you would do. " +
      "Pages come back as a list of actionable elements, each with a ref. " +
      "To click or type on something, FIRST call find_on_page with its visible text, then use the returned ref as target. " +
      "Never invent CSS selectors: target must be a ref like e45. " +
      "After every click, type or key press, the result ends with the page as it is RIGHT NOW. Judge success ONLY from it. " +
      "A click that returned no error is NOT proof it worked. If a dialog is open, only its elements can be clicked. " +
      "Never repeat the same click more than twice: tell the user what you see instead. " +
      "Only report success if the page confirms it. When finished, reply with one or two short sentences.\n\n" +
      "LinkedIn notes:\n- " + LINKEDIN_HINTS.join("\n- "),
  },
];

function shrinkOldToolOutputs() {
  const idx = [];
  messages.forEach((m, i) => m.role === "tool" && idx.push(i));
  for (const i of idx.slice(0, -KEEP_FULL_TOOL_OUTPUTS)) {
    if (messages[i].content.length > 200) messages[i].content = "[older tool output removed]";
  }
}

const secondsSince = (t) => ((Date.now() - t) / 1000).toFixed(1);

// ---- Chat loop ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function shutdown() {
  try { rl.close(); } catch {}
  try { await client.close(); } catch {}
  process.exit(0);
}
rl.on("SIGINT", shutdown);
process.on("SIGINT", shutdown);

const looksLikePosting = (el) =>
  /\b(post|publish)\b/i.test(el) && !/start a post|post settings|add .* post/i.test(el);

console.log('Type what you want, e.g. "open linkedin and click start a post". Type "exit" to quit.');

while (true) {
  let text;
  try {
    text = (await rl.question("\nYou: ")).trim();
  } catch {
    break;
  }
  if (!text) continue;
  if (text.toLowerCase() === "exit") break;

  const turnStart = messages.length;
  messages.push({ role: "user", content: text });

  try {
    let finished = false;
    const callCounts = new Map(); // per command: how often the AI tried the same thing
    let snapStreak = 0;           // snapshots in a row without any action

    for (let round = 0; round < MAX_ROUNDS; round++) {
      shrinkOldToolOutputs();

      const aiStart = Date.now();
      const res = await ai.chat.completions.create({
        model: AI_MODEL,
        messages,
        tools: aiTools,
        stream: false,
        temperature: TEMPERATURE,
      });
      const u = res.usage;
      console.log(
        `\n[AI answered in ${secondsSince(aiStart)}s` +
          (u ? ` | tokens in/out: ${u.prompt_tokens}/${u.completion_tokens}` : "") + "]"
      );

      const msg = res.choices[0].message;
      const assistantMsg = { role: "assistant", content: msg.content ?? "" };
      if (msg.tool_calls?.length) assistantMsg.tool_calls = msg.tool_calls;
      messages.push(assistantMsg);

      if (!msg.tool_calls?.length) {
        console.log("\nAI:", msg.content);
        finished = true;
        break;
      }

      for (const call of msg.tool_calls) {
        const name = call.function.name;
        const rawArgs = call.function.arguments || "{}";
        const garbled = rawArgs.length > MAX_ARGUMENT_CHARS;

        console.log(`\n[AI chose tool] ${name}`);
        console.log(`[arguments]     ${garbled ? `(garbled, ${rawArgs.length} chars)` : rawArgs}`);
        if (garbled) call.function.arguments = "{}";

        const toolStart = Date.now();
        let output;
        let args = {};

        if (garbled) {
          output = "ERROR: your tool arguments were garbled (far too long). Call the tool again with short, clean arguments.";
        } else if (!toolMap[name]) {
          output = "ERROR: there is no tool called " + name;
        } else {
          try {
            args = JSON.parse(rawArgs);
          } catch (err) {
            output = "ERROR: could not read the tool arguments: " + err.message;
          }
        }

        // ---- Guards (checked before anything runs) ----
        if (output === undefined) {
          snapStreak = name === "browser_snapshot" ? snapStreak + 1 : 0;
          if (snapStreak > 2) {
            output = "ERROR: you already have a fresh snapshot. Act on it, or tell the user what you see and that you cannot find the element.";
          }
        }
        if (output === undefined && NEEDS_REF.has(name)) {
          const ref = String(args.target ?? args.ref ?? "");
          if (!/^(f\d+)?e\d+$/.test(ref)) {
            output =
              'ERROR: target must be a ref like "e45" copied from find_on_page or a snapshot. CSS selectors do not work. ' +
              "Call find_on_page with the element's visible text first.";
          }
        }
        if (output === undefined && name !== "browser_snapshot") {
          const what = args.element ?? args.text;
          if (typeof what === "string") {
            // Same description = same attempt, even if the ref changed (LinkedIn re-renders a lot)
            const key = name + "|" + what.toLowerCase();
            const n = (callCounts.get(key) ?? 0) + 1;
            callCounts.set(key, n);
            if (n > MAX_SAME_ATTEMPT) {
              output = `ERROR: you already tried "${what}" ${MAX_SAME_ATTEMPT} times and it did not work. STOP. Tell the user what you tried and what the page shows.`;
            }
          }
        }
        if (output === undefined && CONFIRM_BEFORE_POSTING && name === "browser_click" && looksLikePosting(String(args.element ?? ""))) {
          const a = (await rl.question(`\n  The AI wants to click "${args.element}". This may PUBLISH something. Allow it? (y/n) `)).trim().toLowerCase();
          if (!a.startsWith("y")) output = "The user did NOT allow this click. Do not try it again. Tell the user what you wanted to do.";
        }

        // ---- Run the tool ----
        if (output === undefined && name === "find_on_page") {
          try {
            const fresh = await snapshotNow(); // always searches the live page
            if (fresh) lastFullSnapshot = fresh;
            output = findOnPage(args.text);
            if (output.startsWith("Nothing")) {
              fs.writeFileSync(path.join(here, "last-snapshot.txt"), lastFullSnapshot);
              output += " (the full page was saved to last-snapshot.txt)";
            }
          } catch (err) {
            output = "ERROR: " + err.message;
          }
        }
        if (output === undefined) {
          try {
            const result = await client.callTool({ name, arguments: args }, undefined, { timeout: TOOL_TIMEOUT_MS });
            output = (result.content ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type} omitted]`)).join("\n");
            if (result.isError) output = "ERROR: " + output;
          } catch (err) {
            output = "ERROR: " + err.message;
          }
        }

        // After an action: wait, then attach the page as it is NOW (drops Playwright's own earlier snapshot, if any)
        if (BROWSER_ACTIONS.has(name) && !output.startsWith("ERROR")) {
          try {
            const y = output.indexOf("```yaml");
            if (y >= 0) output = output.slice(0, y);
            await new Promise((r) => setTimeout(r, AFTER_ACTION_WAIT_MS));
            const snapText = await snapshotNow();
            if (snapText) output += "\n\n[PAGE RIGHT AFTER THIS ACTION. Judge success ONLY from this:]\n" + snapText;
          } catch {}
        }

        if (output.startsWith("ERROR")) {
          output += "\n(Do NOT repeat this same call. If you need a ref, call find_on_page. If a dialog is open, only elements inside it can be clicked.)";
        }

        // Remember the full snapshot before it is compacted (find_on_page searches it)
        if (output.includes("```yaml")) lastFullSnapshot = output;

        const fullLength = output.length;
        output = shorten(compactSnapshot(output, MAX_SNAPSHOT_LINES), MAX_TOOL_OUTPUT);
        console.log(`[tool took ${secondsSince(toolStart)}s, ${fullLength} chars -> ${output.length} chars for the AI]`);
        console.log(`[tool result]   ${output.slice(0, 500)}${output.length > 500 ? " ..." : ""}`);

        messages.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }

    if (!finished) console.log(`\n(Stopped after ${MAX_ROUNDS} rounds. Say "continue" to keep going.)`);
  } catch (err) {
    console.error("\nAI request failed:", err.message);
    messages.length = turnStart;
  }
}

rl.close();
await client.close();
process.exit(0);