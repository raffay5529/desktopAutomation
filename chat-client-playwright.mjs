import OpenAI from "openai";
import readline from "readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---- Settings ----
const AI_MODEL = "mistralai/mistral-large-2512";
const MAX_ROUNDS = 25;            // browsing needs many small steps
const MAX_TOOL_OUTPUT = 14000;    // max characters of ONE page snapshot sent to the AI (start + end are kept)
const KEEP_FULL_TOOL_OUTPUTS = 2; // older tool results are shrunk: smaller prompts = faster steps (try 1 for even faster)

// Opened right after start so you see Chrome straight away. null = Chrome opens on your first command.
const START_PAGE = "https://www.google.com";

// Extra options for the Playwright MCP server. [] = visible Chrome window (default).
// Examples: ["--headless"]  ["--browser=msedge"]
const SERVER_OPTIONS = [];

// The server has 20+ tools and free models can get confused by that many.
// Only these are given to the AI. Set to null to give it every tool.
// (If fewer than 3 of these names exist on your server version, all tools are used instead.)
const ONLY_TOOLS = [
  "browser_navigate",
  "browser_navigate_back",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_press_key",
  "browser_select_option",
  "browser_wait",
  "browser_wait_for",
  "browser_tab_new",
  "browser_tab_select",
  "browser_tab_close",
];

// A small cheat-sheet added to the AI's instructions. It saves slow steps like
// "search Google for WhatsApp first". Add your own sites and tips here.
const SITE_HINTS = [
  "WhatsApp Web: open https://web.whatsapp.com directly. If a loading screen or a QR code is shown, " +
    "call browser_wait_for for a few seconds and look again; if the QR code stays, tell the user to scan it.",
  "To message yourself on WhatsApp Web: find the chat with the user's own name (often marked '(You)') " +
    "or use the search box, open it, click the 'Type a message' box, then call browser_type with submit set to true. " +
    "If the text does not appear or is not sent, try again with slowly set to true, or press Enter with browser_press_key. " +
    "Afterwards check the next snapshot to confirm the message is in the chat.",
];

// ---- The AI ----
const apiKey = process.env.XKIRO_API_KEY;
if (!apiKey) {
  console.error("XKIRO_API_KEY is not set. Run with: node --env-file=.env chat-client-playwright.mjs");
  process.exit(1);
}
console.log("Key starts with:", apiKey.slice(0, 10), "| length:", apiKey.length);
const ai = new OpenAI({ apiKey, baseURL: "https://api.xkiro.com/v1" }); // xKiro is OpenAI-compatible

// ---- Connect to the Playwright MCP server (npx starts it) ----
const serverArgs = ["-y", "@playwright/mcp@latest", ...SERVER_OPTIONS];

// On Windows npx is a .cmd file, so start it through cmd
const isWin = process.platform === "win32";
const command = isWin ? "cmd" : "npx";
const args = isWin ? ["/c", "npx", ...serverArgs] : serverArgs;

const mcp = new Client({ name: "my-browser-client", version: "1.0.0" });
await mcp.connect(
  new StdioClientTransport({
    command,
    args,
    env: { ...process.env },
    stderr: "inherit", // show the server's logs in this terminal
  })
);

// ---- STEP 1: ask the server which tools it has ----
const listed = (await mcp.listTools()).tools;
const picked = ONLY_TOOLS ? listed.filter((t) => ONLY_TOOLS.includes(t.name)) : listed;
const tools = picked.length >= 3 ? picked : listed;
console.log(`Server has ${listed.length} tools. Giving the AI ${tools.length}:`, tools.map((t) => t.name).join(", "));

// ---- STEP 2: convert them to the format the AI API expects ----
const aiTools = tools.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.inputSchema },
}));

// Open Chrome right away
if (START_PAGE) {
  try {
    const r = await mcp.callTool({ name: "browser_navigate", arguments: { url: START_PAGE } });
    console.log(r.isError ? "(Could not open the start page; Chrome will open on your first command.)" : "Chrome is open.");
  } catch (err) {
    console.log("(Could not open the start page; Chrome will open on your first command.)", err.message);
  }
}

const messages = [
  {
    role: "system",
    content:
      "You control a real Chrome browser through tools. When the user wants something done on a website, " +
      "call the tools instead of describing what you would do. " +
      "Finish the WHOLE request before you reply: do not stop to report progress and do not ask the user to confirm. " +
      "Only write a final text answer after the last action (for example, sending the message) is done. " +
      "Open a site directly with browser_navigate when you know its URL (see the site notes below). " +
      "The page comes back as a snapshot where every element has a ref. " +
      "Most action tools already return a fresh snapshot; call browser_snapshot only if the last result has none. " +
      "To click or type, call browser_click or browser_type with the element description AND its exact ref " +
      "from the latest snapshot. " +
      "Very long snapshots are shortened: the start and the end are kept and the middle is cut out. " +
      "If the element you need is not visible, use the site's own search box or navigate to it. " +
      "If a ref is not found, take a new snapshot and try again. " +
      "To search a site it is often easiest to open its search URL directly, for example " +
      "https://www.youtube.com/results?search_query=lofi+music. " +
      "After you send or submit something, check the next snapshot to confirm it worked. " +
      "When finished, reply with one or two short sentences.\n\n" +
      "Site notes:\n- " +
      SITE_HINTS.join("\n- "),
  },
];

// Old page snapshots are huge and useless later: shrink all but the newest few
function shrinkOldToolOutputs() {
  const toolIdx = [];
  messages.forEach((m, i) => m.role === "tool" && toolIdx.push(i));
  for (const i of toolIdx.slice(0, -KEEP_FULL_TOOL_OUTPUTS)) {
    if (messages[i].content.length > 200) messages[i].content = "[older tool output removed]";
  }
}

// Shorten a long page snapshot but keep BOTH its start and its end.
// Chat boxes, footers and dialog buttons are usually at the END of the page
// (WhatsApp's "Type a message" box is), so cutting only the end hid them from the AI.
function shorten(text, max) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.35);
  const tail = max - head;
  return text.slice(0, head) + "\n...[middle of the page cut out]...\n" + text.slice(-tail);
}

const secondsSince = (t) => ((Date.now() - t) / 1000).toFixed(1);

// ---- The chat loop ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('Type what you want, e.g. "find youtube and search lofi music". Type "exit" to quit.');

while (true) {
  const text = (await rl.question("\nYou: ")).trim();
  if (!text) continue;
  if (text.toLowerCase() === "exit") break;

  // Remember where this turn started, so a failed request can be rolled back cleanly
  const turnStart = messages.length;
  messages.push({ role: "user", content: text });

  try {
    let finished = false;

    // Keep asking the AI until it stops requesting tools
    for (let round = 0; round < MAX_ROUNDS; round++) {
      shrinkOldToolOutputs();

      const aiStart = Date.now();
      const res = await ai.chat.completions.create({
        model: AI_MODEL,
        messages,
        tools: aiTools, // <-- the AI now sees the browser tools and can choose
        stream: false,
      });
      console.log(`\n[AI answered in ${secondsSince(aiStart)}s]`);

      const msg = res.choices[0].message;
      const assistantMsg = { role: "assistant", content: msg.content ?? "" };
      if (msg.tool_calls?.length) assistantMsg.tool_calls = msg.tool_calls;
      messages.push(assistantMsg);

      // No tool requested -> it is a normal text answer
      if (!msg.tool_calls?.length) {
        console.log("\nAI:", msg.content);
        finished = true;
        break;
      }

      // ---- STEP 3: the AI chose tool(s) -> run them in the browser ----
      for (const call of msg.tool_calls) {
        console.log(`\n[AI chose tool] ${call.function.name}`);
        console.log(`[arguments]     ${call.function.arguments}`);

        const toolStart = Date.now();
        let output;
        try {
          const result = await mcp.callTool(
            { name: call.function.name, arguments: JSON.parse(call.function.arguments || "{}") },
            undefined,
            { timeout: 120_000 }
          );
          // Only text goes back to the AI; images (screenshots) are skipped
          output = (result.content ?? [])
            .map((c) => (c.type === "text" ? c.text : `[${c.type} omitted]`))
            .join("\n");
          if (result.isError) output = "ERROR: " + output;
        } catch (err) {
          output = "ERROR: " + err.message;
        }

        // Keep the start and the end of long results (see shorten above)
        const fullLength = output.length;
        output = shorten(output, MAX_TOOL_OUTPUT);
        console.log(
          `[tool took ${secondsSince(toolStart)}s, ${fullLength} chars` +
            `${fullLength > MAX_TOOL_OUTPUT ? ", shortened for the AI" : ""}]`
        );

        // Show only the start of long results in the terminal
        console.log(`[tool result]   ${output.slice(0, 500)}${output.length > 500 ? " ..." : ""}`);

        // Give the result back to the AI so it can continue
        messages.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }

    if (!finished) {
      console.log(`\n(Stopped after ${MAX_ROUNDS} rounds. Say "continue" to keep going.)`);
    }
  } catch (err) {
    console.error("\nAI request failed:", err.message);
    messages.length = turnStart; // drop the half-finished turn so the next message works
  }
}

rl.close();
await mcp.close(); // also closes the server and the browser
process.exit(0);
