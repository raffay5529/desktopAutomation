// linkedin.mjs - standalone LinkedIn client. Browser only (Playwright MCP).
// Say:   post on linkedin: Hello everyone      -> it does the whole flow by itself
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
const MAX_ARGUMENT_CHARS = 5000;     // a post can be long, so this is bigger than before
const TEMPERATURE = 0.2;
const AFTER_ACTION_WAIT_MS = 1500;   // LinkedIn pages render slowly
const MAX_SAME_ATTEMPT = 2;          // same description/text more than this = stop
const START_PAGE = null;             // e.g. "https://www.linkedin.com/feed/"
const LINKEDIN_URL = "https://www.linkedin.com/feed/";
const CONFIRM_BEFORE_POSTING = true; // linkedin_post and manual Post clicks ask you first

const isWin = process.platform === "win32";
const here = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secondsSince = (t) => ((Date.now() - t) / 1000).toFixed(1);

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
  "TO POST ON LINKEDIN: call linkedin_post ONCE with the exact text. It does everything by itself " +
    "(opens the feed, finds 'Start a post', types the text, clicks Post) and asks the user to confirm in the terminal. " +
    "Do NOT do those steps by hand with browser_ tools. " +
    "If the user gives a topic but no exact text, write a short, genuine post yourself and use that as the text. " +
    "If they give neither, ask one short question. " +
    "Tell the user the tool's result truthfully: if it says NOT CONFIRMED, likely, or ERROR, say exactly that.",
  "For any other LinkedIn task (comment, like, open a profile...): call find_on_page with the visible text to get a ref, " +
    "then browser_click with that ref. Judge success only from the page that comes back after the action.",
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
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ---- Connect ----
const serverEnv = { ...process.env };
delete serverEnv.XKIRO_API_KEY;

const client = new Client({ name: "linkedin-test", version: "1.0.0" });
const toolMap = {};
const aiTools = [];
const schemas = {}; // tool name -> input schema (used to pick "target" or "ref")

try {
  const command = isWin ? "cmd" : "npx";
  const args = isWin ? ["/c", "npx", ...serverArgs] : serverArgs;
  await client.connect(new StdioClientTransport({ command, args, env: serverEnv, stderr: "inherit" }));

  const listed = (await client.listTools()).tools;
  for (const t of listed) schemas[t.name] = t.inputSchema;
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

// ---- Local tools (run inside this script, not in Playwright) ----
toolMap["find_on_page"] = "local";
aiTools.push({
  type: "function",
  function: {
    name: "find_on_page",
    description:
      "Search the current page for an element by its visible text and return matching lines with their refs. " +
      "Use this to get the ref, then pass that ref as target to browser_click or browser_type.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Visible text or name, e.g. 'Start a post'" } },
      required: ["text"],
    },
  },
});

toolMap["linkedin_post"] = "local";
aiTools.push({
  type: "function",
  function: {
    name: "linkedin_post",
    description:
      "Publish a text post on the user's LinkedIn feed from start to finish: opens LinkedIn, finds 'Start a post', " +
      "types the text and clicks Post. It asks the user to confirm in the terminal first. " +
      "Use this for ANY request to post, write or publish something on LinkedIn. Call it once.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "The exact text of the post" } },
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

function shorten(text, max) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  return text.slice(0, head) + "\n...[middle cut out]...\n" + text.slice(-(max - head));
}

// ---- Helpers for talking to the browser ----
// The latest FULL snapshot (before compacting). find_on_page searches this.
let lastFullSnapshot = "";

function saveDebug() {
  try {
    fs.writeFileSync(path.join(here, "last-snapshot.txt"), lastFullSnapshot);
  } catch {}
}

// Plain call to a Playwright tool. Returns { ok, text }.
async function mcp(name, args = {}) {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: TOOL_TIMEOUT_MS });
  const text = (r.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { ok: !r.isError, text };
}

async function snapshotNow() {
  const r = await mcp("browser_snapshot", {});
  return r.ok ? r.text : null;
}

// Newer Playwright MCP wants "target", older wants "ref". Pick whichever this server has.
function refArgs(tool, ref, element) {
  const props = schemas[tool]?.properties ?? {};
  const a = {};
  if ("target" in props) a.target = ref;
  else a.ref = ref;
  if ("element" in props) a.element = element;
  return a;
}

const pageUrl = (t) => (String(t).match(/Page URL:\s*(\S+)/) || [])[1] ?? "";
const LOGIN_RE = /linkedin\.com\/(login|checkpoint|authwall|uas\/)/i;

// First snapshot line that matches and has a ref
function refLine(snap, re) {
  for (const l of String(snap).split("\n")) {
    if (re.test(l)) {
      const m = l.match(/\[ref=([^\]]+)\]/);
      if (m) return { line: l.trim(), ref: m[1] };
    }
  }
  return null;
}

// Take snapshots until check(snapshot) returns something, or give up
async function pollSnapshot(check, tries = 6, delayMs = 1500) {
  let snap = "";
  for (let i = 0; i < tries; i++) {
    await sleep(delayMs);
    const s = await snapshotNow();
    if (!s) continue;
    snap = s;
    lastFullSnapshot = s;
    const hit = check(s);
    if (hit) return { snap, hit };
  }
  return { snap, hit: null };
}

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

// ---- linkedin_post: the whole flow in code, no AI guessing ----
async function linkedinPost(rawText) {
  const body = String(rawText ?? "").trim();
  if (!body) return "ERROR: text is empty. Ask the user what to post.";
  if (body.length > 3000) return "ERROR: LinkedIn posts can be at most 3000 characters.";

  let publish = true;
  if (CONFIRM_BEFORE_POSTING) {
    console.log("\n  About to post on LinkedIn:\n  ------------------------------\n" + body + "\n  ------------------------------");
    const a = (await rl.question("  p = publish, d = type it but do NOT publish, n = cancel: ")).trim().toLowerCase();
    if (a.startsWith("p")) publish = true;
    else if (a.startsWith("d")) publish = false;
    else return "The user cancelled. Nothing was typed or posted. Tell the user.";
  }

  try {
    // 1. Are we already inside the post window (for example an earlier draft)?
    let inComposer = false;
    try {
      const first = await snapshotNow();
      if (first) {
        lastFullSnapshot = first;
        inComposer = /sharing\/compose/.test(pageUrl(first));
      }
    } catch {}

    if (!inComposer) {
      console.log("[linkedin_post] opening the feed");
      const nav = await mcp("browser_navigate", { url: LINKEDIN_URL });
      if (!nav.ok) return "ERROR: could not open LinkedIn: " + nav.text.slice(0, 200);

      console.log('[linkedin_post] looking for "Start a post"');
      const start = await pollSnapshot((s) => refLine(s, /start a post/i), 8, 1500);
      if (!start.hit) {
        const u = pageUrl(start.snap);
        saveDebug();
        if (LOGIN_RE.test(u)) {
          return `ERROR: LinkedIn is asking for a login or a security check (${u}). Tell the user to handle it in the browser window, then ask again.`;
        }
        return `ERROR: could not find "Start a post" on the page (URL: ${u || "unknown"}). The page was saved to last-snapshot.txt. Tell the user.`;
      }

      console.log(`[linkedin_post] clicking "Start a post" (${start.hit.ref})`);
      const click = await mcp("browser_click", refArgs("browser_click", start.hit.ref, "Start a post"));
      if (!click.ok) return "ERROR: clicking Start a post failed: " + click.text.slice(0, 200);
    }

    // 2. Find the text box
    console.log("[linkedin_post] waiting for the post box");
    const box = await pollSnapshot(
      (s) => refLine(s, /^\s*- textbox\b.*(text editor|talk about|post)/i) || refLine(s, /^\s*- textbox\b/),
      8,
      1500
    );
    if (!box.hit) {
      saveDebug();
      return "ERROR: the post box did not appear after clicking Start a post. Nothing was posted. The page was saved to last-snapshot.txt. Tell the user.";
    }

    // 3. Type the text
    console.log(`[linkedin_post] typing the text (${box.hit.ref})`);
    const typed = await mcp("browser_type", { ...refArgs("browser_type", box.hit.ref, "Post text box"), text: body });
    if (!typed.ok) return "ERROR: typing into the post box failed: " + typed.text.slice(0, 200);

    if (!publish) {
      return "Typed the text into LinkedIn's post box but did NOT publish (the user chose draft). The post window is still open in the browser. Tell the user.";
    }

    // 4. Wait until the Post button is enabled, then click it
    console.log("[linkedin_post] waiting for the Post button");
    const btn = await pollSnapshot((s) => {
      const h = refLine(s, /^\s*- button "Post"/);
      return h && !h.line.includes("[disabled]") ? h : null;
    }, 6, 1000);
    if (!btn.hit) {
      saveDebug();
      return "ERROR: the Post button is missing or still disabled, so nothing was published. The page was saved to last-snapshot.txt. Tell the user.";
    }

    console.log(`[linkedin_post] clicking Post (${btn.hit.ref})`);
    const post = await mcp("browser_click", refArgs("browser_click", btn.hit.ref, "Post button"));
    if (!post.ok) return "ERROR: clicking Post failed: " + post.text.slice(0, 200);

    // 5. Check what happened
    const probe = body.split("\n")[0].slice(0, 25).toLowerCase();
    for (let i = 0; i < 6; i++) {
      await sleep(1500);
      const s = await snapshotNow();
      if (!s) continue;
      lastFullSnapshot = s;
      if (!/sharing\/compose/.test(pageUrl(s))) {
        return s.toLowerCase().includes(probe)
          ? "Published. LinkedIn went back to the feed and the post text is visible on the page."
          : "Clicked Post and LinkedIn went back to the feed, but the post text was not visible on the page yet, so it is likely posted but NOT fully confirmed. Tell the user to check their profile.";
      }
    }
    saveDebug();
    return "NOT CONFIRMED: clicked Post but the post window is still open. Tell the user to check the browser.";
  } catch (err) {
    return "ERROR: " + err.message;
  }
}

const localTools = {
  find_on_page: async ({ text }) => {
    const fresh = await snapshotNow(); // always searches the live page
    if (fresh) lastFullSnapshot = fresh;
    const out = findOnPage(text);
    if (out.startsWith("Nothing")) {
      saveDebug();
      return out + " (the full page was saved to last-snapshot.txt)";
    }
    return out;
  },
  linkedin_post: async ({ text }) => linkedinPost(text),
};

if (START_PAGE) {
  try {
    await mcp("browser_navigate", { url: START_PAGE });
  } catch (err) {
    console.log("(Could not open the start page:", err.message + ")");
  }
}

// ---- Prompt ----
const messages = [
  {
    role: "system",
    content:
      "You control a real Chrome browser and help the user on LinkedIn. " +
      "Call tools instead of describing what you would do. " +
      "For other browser work: pages come back as a list of actionable elements, each with a ref. " +
      "To click or type on something, FIRST call find_on_page with its visible text, then use the returned ref as target. " +
      "Never invent CSS selectors: target must be a ref like e45. " +
      "After every click, type or key press, the result ends with the page as it is RIGHT NOW. Judge success ONLY from it. " +
      "A click that returned no error is NOT proof it worked. " +
      "Never repeat the same click more than twice: tell the user what you see instead. " +
      "Only report success if a tool result confirms it. When finished, reply with one or two short sentences.\n\n" +
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

// ---- Chat loop ----
async function shutdown() {
  try { rl.close(); } catch {}
  try { await client.close(); } catch {}
  process.exit(0);
}
rl.on("SIGINT", shutdown);
process.on("SIGINT", shutdown);

const looksLikePosting = (el) =>
  /\b(post|publish)\b/i.test(el) && !/start a post|post settings|add .* post/i.test(el);

console.log('Type what you want, e.g. "post on linkedin: Hello everyone". Type "exit" to quit.');

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
              output = `ERROR: you already tried "${String(what).slice(0, 60)}" ${MAX_SAME_ATTEMPT} times and it did not work. STOP. Tell the user what you tried and what the page shows.`;
            }
          }
        }
        if (output === undefined && CONFIRM_BEFORE_POSTING && name === "browser_click" && looksLikePosting(String(args.element ?? ""))) {
          const a = (await rl.question(`\n  The AI wants to click "${args.element}". This may PUBLISH something. Allow it? (y/n) `)).trim().toLowerCase();
          if (!a.startsWith("y")) output = "The user did NOT allow this click. Do not try it again. Tell the user what you wanted to do.";
        }

        // ---- Run the tool ----
        if (output === undefined) {
          try {
            if (localTools[name]) {
              output = String(await localTools[name](args));
            } else {
              const r = await client.callTool({ name, arguments: args }, undefined, { timeout: TOOL_TIMEOUT_MS });
              output = (r.content ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type} omitted]`)).join("\n");
              if (r.isError) output = "ERROR: " + output;
            }
          } catch (err) {
            output = "ERROR: " + err.message;
          }
        }

        // After a manual action: wait, then attach the page as it is NOW (drops Playwright's own earlier snapshot, if any)
        if (BROWSER_ACTIONS.has(name) && !output.startsWith("ERROR")) {
          try {
            const y = output.indexOf("```yaml");
            if (y >= 0) output = output.slice(0, y);
            await sleep(AFTER_ACTION_WAIT_MS);
            const snapText = await snapshotNow();
            if (snapText) output += "\n\n[PAGE RIGHT AFTER THIS ACTION. Judge success ONLY from this:]\n" + snapText;
          } catch {}
        }

        if (output.startsWith("ERROR") && !localTools[name]) {
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