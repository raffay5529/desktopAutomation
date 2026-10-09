import OpenAI from "openai";
import readline from "readline/promises";
import os from "os";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---- Settings ----
const AI_MODEL = "mistralai/mistral-large-2512";
const MAX_ROUNDS = 25;
const MAX_TOOL_OUTPUT = 20000;
const KEEP_FULL_TOOL_OUTPUTS = 2;
const TOOL_TIMEOUT_MS = 30_000; // a stuck tool now fails after 30 seconds

const START_PAGE = "https://www.google.com";

const DESKTOP = false;
const ASK_BEFORE_DESKTOP_ACTIONS = false;

// Files with these endings are binary. They must never be read as text.
const BINARY_EXTENSIONS = /\.(gif|png|jpe?g|webp|bmp|ico|pdf|zip|rar|7z|mp3|mp4|wav|docx?|xlsx?|pptx?)$/i;

// ---- Folders the AI may read and write with the file tools ----
const WORKSPACE = path.join(os.homedir(), "ai-workspace");
fs.mkdirSync(WORKSPACE, { recursive: true });

// The real Desktop. On many PCs it lives inside OneDrive, so check both.
const DESKTOP_CANDIDATES = [
  path.join(os.homedir(), "Desktop"),
  path.join(os.homedir(), "OneDrive", "Desktop"),
];
const DESKTOP_FOLDERS = DESKTOP_CANDIDATES.filter((p) => fs.existsSync(p));

// Want Documents or Downloads too? Add them here:
// path.join(os.homedir(), "Documents"), path.join(os.homedir(), "Downloads")
const FILE_FOLDERS = [WORKSPACE, ...DESKTOP_FOLDERS];

// ---- The MCP servers ----
// "only"  = the tools the AI gets (if fewer than half of them exist, it gets all tools instead)
// "never" = tools the AI never gets, no matter what
// "confirm" = tools that ask you y/n before they run
const SERVERS = {
  browser: {
    enabled: true,
    prefix: "",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    only: [
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
    ],
    confirm: [],
  },

  files: {
    enabled: true,
    prefix: "fs_",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", ...FILE_FOLDERS],
    only: [
      "read_text_file",
      "write_file",
      "edit_file",
      "list_directory",
      "get_file_info",
      "create_directory",
      "move_file",
    ],
    // search_files and directory_tree walk every subfolder with no limit and hang.
    // Use the local find_file tool below instead.
    never: ["search_files", "directory_tree"],
    confirm: ["write_file", "edit_file", "move_file"],
  },

  shell: {
    enabled: false,
    prefix: "dc_",
    command: "npx",
    args: ["-y", "@wonderwhy-er/desktop-commander@latest"],
    only: ["start_process", "read_process_output"],
    confirm: ["start_process"],
  },

  screen: {
    enabled: true,
    prefix: "win_",
    command: "uvx",
    args: ["windows-mcp", "serve"],
    only: ["App", "Snapshot", "Click", "Type", "Scroll", "Shortcut", "Wait", "Clipboard"],
    confirm: ["powershell", "registry"],
  },
};

const READ_TEXT_TOOL = SERVERS.files.prefix + "read_text_file";

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
  console.error("XKIRO_API_KEY is not set. Run with: node --env-file=.env chat-client-desktop.mjs");
  process.exit(1);
}
console.log("Key loaded | length:", apiKey.length);
const ai = new OpenAI({ apiKey, baseURL: "https://api.xkiro.com/v1" });

// ---- Connect to the MCP servers ----
const isWin = process.platform === "win32";

function launch(s) {
  if (isWin && s.command === "npx") return { command: "cmd", args: ["/c", "npx", ...s.args] };
  return { command: s.command, args: s.args };
}

const serverEnv = { ...process.env };
delete serverEnv.XKIRO_API_KEY;

const clients = {};
const toolMap = {};
const aiTools = [];

for (const [serverName, s] of Object.entries(SERVERS)) {
  if (!s.enabled) continue;
  try {
    const { command, args } = launch(s);
    const client = new Client({ name: "my-desktop-client", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command,
        args,
        env: serverEnv,
        stderr: "inherit",
      })
    );

    const listed = (await client.listTools()).tools;
    const picked = s.only ? listed.filter((t) => s.only.includes(t.name)) : listed;
    const base = !s.only || picked.length >= s.only.length / 2 ? picked : listed;
    // The "never" list is applied last, so a blocked tool can never slip through
    const tools = base.filter((t) => !(s.never ?? []).includes(t.name));

    for (const t of tools) {
      const aiName = s.prefix + t.name;
      const confirm = (s.confirm ?? []).some((w) => t.name.toLowerCase().includes(w.toLowerCase()));
      toolMap[aiName] = { client, realName: t.name, confirm };
      aiTools.push({
        type: "function",
        function: { name: aiName, description: t.description, parameters: t.inputSchema },
      });
    }

    clients[serverName] = client;
    console.log(
      `[${serverName}] has ${listed.length} tools. Giving the AI ${tools.length}:`,
      tools.map((t) => s.prefix + t.name).join(", ")
    );
  } catch (err) {
    console.log(`[${serverName}] could not start, skipping it: ${err.message}`);
  }
}

// ---- The desktop tools (nut.js) ----
let desktopOn = false;
if (DESKTOP) {
  try {
    const { loadDesktopTools } = await import("./desktop-tools.mjs");
    const desktopTools = await loadDesktopTools();
    for (const t of desktopTools) {
      toolMap[t.name] = { run: t.run, confirm: ASK_BEFORE_DESKTOP_ACTIONS && t.changes };
      aiTools.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
    desktopOn = true;
    console.log(`[desktop] ${desktopTools.length} tools (nut.js):`, desktopTools.map((t) => t.name).join(", "));
  } catch (err) {
    console.log(`[desktop] could not start, skipping it: ${err.message}`);
  }
}

// ---- Local tool: open a folder or file ----
// win_App can only launch an app by name, so it cannot open a specific folder.
// This tool opens an existing folder in File Explorer, or a file in its default app.
const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|js|jse|wsf|lnk|reg|dll)$/i;

toolMap["open_path"] = {
  confirm: false,
  run: async ({ path: target }) => {
    const p = String(target ?? "").trim();
    if (!p) return "ERROR: path is empty";
    if (!fs.existsSync(p)) return `ERROR: this path does not exist: ${p}`;
    // Never launch programs or scripts, only folders and normal documents
    if (BLOCKED_EXTENSIONS.test(p)) return "ERROR: opening programs or scripts is not allowed.";

    if (isWin) {
      // explorer.exe returns exit code 1 even on success, so the exit code is ignored
      execFile("explorer.exe", [p], () => {});
    } else if (process.platform === "darwin") {
      execFile("open", [p], () => {});
    } else {
      execFile("xdg-open", [p], () => {});
    }
    await new Promise((r) => setTimeout(r, 800));
    return `Opened ${p}`;
  },
};
aiTools.push({
  type: "function",
  function: {
    name: "open_path",
    description:
      "Open an existing folder or file on the user's computer. A folder opens in File Explorer, " +
      "a document opens in its default app. Use this instead of win_App whenever you know the path.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Full absolute path" } },
      required: ["path"],
    },
  },
});

// ---- Local tool: find a file by name (limited in depth, time and result count) ----
const SKIP_DIRS = new Set(["node_modules", ".git", "AppData", "$Recycle.Bin"]);

function findFiles(needle, { maxDepth = 4, maxResults = 20, maxMs = 5000 } = {}) {
  const results = [];
  const deadline = Date.now() + maxMs;
  const lower = needle.toLowerCase();

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= maxResults || Date.now() > deadline) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // no permission or folder vanished, skip it
    }
    for (const e of entries) {
      if (results.length >= maxResults || Date.now() > deadline) return;
      const full = path.join(dir, e.name);
      if (e.name.toLowerCase().includes(lower)) results.push(full);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full, depth + 1);
    }
  }

  for (const root of FILE_FOLDERS) walk(root, 0);
  return results;
}

toolMap["find_file"] = {
  confirm: false,
  run: async ({ name }) => {
    const n = String(name ?? "").trim();
    if (!n) return "ERROR: name is empty";
    const found = findFiles(n);
    return found.length
      ? "Found:\n" + found.join("\n")
      : `No file or folder with "${n}" in its name was found in: ${FILE_FOLDERS.join(", ")}`;
  },
};
aiTools.push({
  type: "function",
  function: {
    name: "find_file",
    description:
      "Find a file or folder by (part of) its name on the Desktop and in the workspace. " +
      "Fast. Returns full paths. Use this instead of searching folder by folder.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Part of the file name, e.g. 'loader.gif'" } },
      required: ["name"],
    },
  },
});

// ---- Local tool: delete a file or folder (goes to the Recycle Bin) ----
// The fs_ tools cannot delete anything. Without this tool the AI renames files instead.
function isInsideAllowedFolder(p) {
  const norm = (x) => {
    const r = fs.realpathSync(x);
    return isWin ? r.toLowerCase() : r;
  };
  const target = norm(p);
  // Inside an allowed folder, but never the allowed folder itself
  return FILE_FOLDERS.some((root) => {
    const r = norm(root);
    return target !== r && target.startsWith(r + path.sep);
  });
}

toolMap["delete_path"] = {
  confirm: true, // always asks you y/n first, and shows the full path
  run: async ({ path: target }) => {
    const p = String(target ?? "").trim();
    if (!p) return "ERROR: path is empty";
    if (!fs.existsSync(p)) return `ERROR: this path does not exist: ${p}`;
    if (!isWin) return "ERROR: delete_path is only implemented for Windows.";
    if (!isInsideAllowedFolder(p)) {
      return `ERROR: deleting is only allowed inside these folders (not the folders themselves): ${FILE_FOLDERS.join(", ")}`;
    }

    const full = path.resolve(p);
    const method = fs.statSync(full).isDirectory() ? "DeleteDirectory" : "DeleteFile";
    // The path goes in through an environment variable, so it can never be read as part of the command
    const script =
      "Add-Type -AssemblyName Microsoft.VisualBasic; " +
      `[Microsoft.VisualBasic.FileIO.FileSystem]::${method}($env:DEL_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')`;

    const r = await new Promise((resolve) =>
      execFile(
        "powershell",
        ["-NoProfile", "-Command", script],
        { windowsHide: true, env: { ...process.env, DEL_PATH: full } },
        (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() || err?.message || "" })
      )
    );

    if (!r.ok) return `ERROR: could not delete: ${r.out}`;
    // Check it is really gone, so the AI cannot claim a delete that did not happen
    if (fs.existsSync(full)) return `ERROR: the path still exists after the delete: ${full}`;
    return `Deleted ${full} (moved to the Recycle Bin, so it can be restored from there).`;
  },
};
aiTools.push({
  type: "function",
  function: {
    name: "delete_path",
    description:
      "Delete a file or folder on the user's computer (it goes to the Recycle Bin). " +
      "This is the ONLY way to delete. Never rename or move a file as a substitute for deleting. " +
      "Use the full absolute path, for example one returned by find_file.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Full absolute path of the file or folder" } },
      required: ["path"],
    },
  },
});

if (aiTools.length === 0) {
  console.error("No tools available: none of the servers started.");
  process.exit(1);
}
console.log(`The AI has ${aiTools.length} tools in total.`);

if (START_PAGE && clients.browser) {
  try {
    const r = await clients.browser.callTool({ name: "browser_navigate", arguments: { url: START_PAGE } });
    console.log(r.isError ? "(Could not open the start page; Chrome will open on your first command.)" : "Chrome is open.");
  } catch (err) {
    console.log("(Could not open the start page; Chrome will open on your first command.)", err.message);
  }
}

// ---- Hints for the AI ----
const COMPUTER_HINTS = [];
if (clients.files) {
  COMPUTER_HINTS.push(
    `Files: the ${SERVERS.files.prefix} tools only work inside these folders: ${FILE_FOLDERS.join(", ")}. ` +
      "Always use full absolute paths. To edit a file, read it first, then call the edit tool with the exact old text, " +
      "or rewrite the whole file with the write tool."
  );
  COMPUTER_HINTS.push(
    "To locate a file by name, call find_file first. Do not search folder by folder. " +
      `Never read images, PDFs or Office files with ${READ_TEXT_TOOL}. ` +
      "If a tool already showed that a file exists, it is found: do not search for it again."
  );
  COMPUTER_HINTS.push(
    "To DELETE a file or folder, call delete_path with its full path (call find_file first if you only know the name). " +
      `The ${SERVERS.files.prefix} tools cannot delete. NEVER rename or move a file as a substitute for deleting it. ` +
      "Only tell the user something is deleted if delete_path returned 'Deleted'."
  );
  if (DESKTOP_FOLDERS.length) {
    COMPUTER_HINTS.push(
      `The user's Desktop folder is: ${DESKTOP_FOLDERS[0]}. When the user says "desktop", use exactly that path. ` +
        "If the user does not give a name for a new folder or file, choose a sensible name yourself " +
        "(for example 'New Folder') instead of asking."
    );
  }
}
COMPUTER_HINTS.push(
  "To open a folder or file, call open_path with its full absolute path. " +
    "Do NOT use win_App for that: it cannot open a folder. " +
    "If the user says 'open that' or 'open it', use the path of the folder or file you just created or mentioned."
);
if (clients.shell) {
  const run = `${SERVERS.shell.prefix}start_process`;
  COMPUTER_HINTS.push(
    `Shell: ${run} runs a command on the user's computer and can reach ANY folder. ` +
      (isWin
        ? "To copy a file run: powershell -NoProfile -Command \"Copy-Item -LiteralPath 'SOURCE' -Destination 'TARGET'\". " +
          "Clipboard: Set-Clipboard -Value 'text' copies text, Get-Clipboard reads it."
        : "To copy a file run: cp SOURCE TARGET. Clipboard: pbcopy / pbpaste on Mac, xclip on Linux.")
  );
}

if (desktopOn) {
  COMPUTER_HINTS.push(
    "Desktop: desktop_open opens an app, folder, file or website (for example 'File Explorer'). " +
      "desktop_press_keys sends shortcuts such as 'ctrl+c' or 'win+e', or several steps like 'tab tab enter'. " +
      "desktop_type types into whichever window has focus, so open or focus the right window first and check " +
      "it with desktop_status. You cannot see the screen: do not guess click coordinates, prefer keyboard shortcuts."
  );
}

if (clients.screen) {
  COMPUTER_HINTS.push(
    "Screen: the win_ tools control the Windows desktop (apps like File Explorer, Notepad, Word, Settings). " +
      "Call win_Snapshot first to see the open windows and their elements, then use the exact positions or labels " +
      "from the LATEST snapshot to click or type. Never guess coordinates. " +
      "After every click, type or shortcut, call win_Snapshot again to check what changed. " +
      "win_App opens or switches to an app by name only. If an app is still loading, call win_Wait and snapshot again. " +
      "Use win_Shortcut for keyboard shortcuts such as ctrl+s. " +
      "For websites use the browser tools, not the win_ tools. " +
      "For creating, reading or editing files and folders, prefer the fs_ tools: they are faster and more reliable."
  );
}

const messages = [
  {
    role: "system",
    content:
      "You control a real Chrome browser through tools, and you may also have tools for the user's files and computer. " +
      "When the user wants something done on a website or on their computer, " +
      "call the tools instead of describing what you would do. " +
      "Finish the WHOLE request before you reply: do not stop to report progress and do not ask the user to confirm. " +
      "Do not ask the user for details you can decide yourself (like a folder name): pick a sensible default. " +
      "Only write a final text answer after the last action (for example, sending the message) is done. " +
      "If none of your tools can do what the user asks, say so plainly. " +
      "Never do something different and then report the request as done. " +
      "Only report success if a tool result confirms it. " +
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
      "If the user denies an action, do not try it again: just say what you wanted to do. " +
      "When finished, reply with one or two short sentences.\n\n" +
      "Site notes:\n- " +
      SITE_HINTS.join("\n- ") +
      (COMPUTER_HINTS.length ? "\n\nComputer notes:\n- " + COMPUTER_HINTS.join("\n- ") : ""),
  },
];

function shrinkOldToolOutputs() {
  const toolIdx = [];
  messages.forEach((m, i) => m.role === "tool" && toolIdx.push(i));
  for (const i of toolIdx.slice(0, -KEEP_FULL_TOOL_OUTPUTS)) {
    if (messages[i].content.length > 200) messages[i].content = "[older tool output removed]";
  }
}

function shorten(text, max) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.35);
  const tail = max - head;
  return text.slice(0, head) + "\n...[middle of the page cut out]...\n" + text.slice(-tail);
}

// ---- Binary file protection ----
const BINARY_MESSAGE =
  "This is a binary file (image, document or archive), so it cannot be read as text. " +
  "It was found, so it exists. To open it, call open_path. To check its size, call fs_get_file_info.";

// Safety net for binary files that do not have one of the known endings
function looksBinary(text) {
  const sample = text.slice(0, 2000);
  if (!sample) return false;
  if (sample.includes("\u0000")) return true;
  const bad = (sample.match(/\uFFFD/g) || []).length;
  return bad / sample.length > 0.05;
}

const secondsSince = (t) => ((Date.now() - t) / 1000).toFixed(1);

// ---- The chat loop ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Shows exactly what the AI wants to do before you answer
async function approve(call) {
  console.log(`\n  The AI wants to run: ${call.function.name}`);
  console.log(`  Arguments: ${call.function.arguments}`);
  const answer = await rl.question("  Allow it? (y/n) ");
  return answer.trim().toLowerCase().startsWith("y");
}

console.log('Type what you want, e.g. "find youtube and search lofi music". Type "exit" to quit.');

while (true) {
  const text = (await rl.question("\nYou: ")).trim();
  if (!text) continue;
  if (text.toLowerCase() === "exit") break;

  const turnStart = messages.length;
  messages.push({ role: "user", content: text });

  try {
    let finished = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      shrinkOldToolOutputs();

      const aiStart = Date.now();
      const res = await ai.chat.completions.create({
        model: AI_MODEL,
        messages,
        tools: aiTools,
        stream: false,
      });
      console.log(`\n[AI answered in ${secondsSince(aiStart)}s]`);

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
        console.log(`\n[AI chose tool] ${call.function.name}`);
        console.log(`[arguments]     ${call.function.arguments}`);

        const entry = toolMap[call.function.name];
        const allowed = !entry?.confirm || (await approve(call));

        const toolStart = Date.now();
        let output;
        if (!entry) {
          output = "ERROR: there is no tool called " + call.function.name;
        } else if (!allowed) {
          output = "The user did NOT allow this action. Do not try it again. Tell the user what you wanted to do.";
        } else {
          try {
            const args = JSON.parse(call.function.arguments || "{}");

            if (call.function.name === READ_TEXT_TOOL && BINARY_EXTENSIONS.test(String(args.path ?? ""))) {
              // Do not even send the request: reading a binary file as text only produces garbage
              output = BINARY_MESSAGE;
            } else if (entry.run) {
              output = String(await entry.run(args));
            } else {
              const result = await entry.client.callTool(
                { name: entry.realName, arguments: args },
                undefined,
                { timeout: TOOL_TIMEOUT_MS }
              );
              output = (result.content ?? [])
                .map((c) => (c.type === "text" ? c.text : `[${c.type} omitted]`))
                .join("\n");

              if (call.function.name === READ_TEXT_TOOL && looksBinary(output)) {
                output = BINARY_MESSAGE;
              } else if (result.isError) {
                output = "ERROR: " + output;
              }
            }
          } catch (err) {
            output = "ERROR: " + err.message;
          }
        }

        const fullLength = output.length;
        output = shorten(output, MAX_TOOL_OUTPUT);
        console.log(
          `[tool took ${secondsSince(toolStart)}s, ${fullLength} chars` +
            `${fullLength > MAX_TOOL_OUTPUT ? ", shortened for the AI" : ""}]`
        );

        console.log(`[tool result]   ${output.slice(0, 500)}${output.length > 500 ? " ..." : ""}`);

        messages.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }

    if (!finished) {
      console.log(`\n(Stopped after ${MAX_ROUNDS} rounds. Say "continue" to keep going.)`);
    }
  } catch (err) {
    console.error("\nAI request failed:", err.message);
    messages.length = turnStart;
  }
}

rl.close();
for (const c of Object.values(clients)) await c.close();
process.exit(0);