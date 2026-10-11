// chat-client-desktop.mjs
// Desktop-first AI chat client. ONE file, no other files needed.
//
// Run:  node --env-file=.env chat-client-desktop.mjs
// Needs: Node 20.6+, `npm install openai @modelcontextprotocol/sdk`, XKIRO_API_KEY in .env,
//        and `uv` installed (for the windows-mcp screen tools).

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
// FIX: win_Snapshot gets a bigger limit, because its element list is the useful part (it was being cut at 20000)
const MAX_SNAPSHOT_OUTPUT = 40000;
const KEEP_FULL_TOOL_OUTPUTS = 2;
const TOOL_TIMEOUT_MS = 30_000; // a stuck tool fails after 30 seconds
const MAX_ARGUMENT_CHARS = 2000; // longer tool arguments are garbled: refused without asking you
const TEMPERATURE = 0.2; // lower = steadier tool calls
const CONFIRM_DELETE = true; // delete_path asks y/n. It uses the Recycle Bin, so false is fairly safe

// CHANGED: nothing is opened when the script starts. The browser (the Playwright Chrome)
// opens the first time you ask for it, for example "open chrome" or "open whatsapp on web".
const START_PAGE = null;

const isWin = process.platform === "win32";

// Files with these endings are binary. They must never be read as text.
const BINARY_EXTENSIONS = /\.(gif|png|jpe?g|webp|bmp|ico|pdf|zip|rar|7z|mp3|mp4|wav|docx?|xlsx?|pptx?)$/i;
// open_path never launches programs or scripts, only folders and normal documents
const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|js|jse|wsf|lnk|reg|dll)$/i;

// ---- Folders the AI may touch with the file tools ----
const WORKSPACE = path.join(os.homedir(), "ai-workspace");
fs.mkdirSync(WORKSPACE, { recursive: true });

// The real Desktop. On many PCs it lives inside OneDrive, so check both.
const DESKTOP_CANDIDATES = [
  path.join(os.homedir(), "Desktop"),
  path.join(os.homedir(), "OneDrive", "Desktop"),
];
const DESKTOP_FOLDERS = DESKTOP_CANDIDATES.filter((p) => fs.existsSync(p));

// Every drive that exists (C:\, D:\, ...). Your user folder goes first.
const DRIVES = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => l + ":\\").filter((d) => fs.existsSync(d));
const FILE_FOLDERS = [os.homedir(), ...DRIVES];

// ---- The MCP servers ----
// "only"    = the tools the AI gets (if fewer than half of them exist, it gets all tools instead)
// "never"   = tools the AI never gets, no matter what
// "confirm" = tools that ask you y/n before they run
const SERVERS = {
  // Browser = Playwright MCP. It has its own close and tab tools, so the desktop tools are not used for the browser.
  // Needs playwright-config.json next to this file (it hides the yellow "unsupported command-line flag" bar).
  // --allow-unrestricted-file-access lets browser_file_upload use files outside Playwright's own folder (your Desktop).
  // Uploads do NOT ask you first (confirm is empty), the AI just sends the file.
  browser: {
    enabled: true,
    prefix: "",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest", "--config=playwright-config.json", "--allow-unrestricted-file-access"],
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
      "browser_close",
      "browser_file_upload",
      // FIX (link click): hover shows a message's down-arrow WITHOUT clicking the message (a click on a link message opens a new tab)
      "browser_hover",
      // FIX (link click): one tool to list / open / close / select tabs (replaces browser_tab_* in newer Playwright MCP)
      "browser_tabs",
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
    confirm: ["write_file", "edit_file"], // move_file never overwrites, so it does not ask
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
  // FIX (link click): tabs are handled with browser_tabs, and stray tabs must be closed
  "To close the whole browser, call browser_close. To close or switch tabs, call browser_tabs " +
    "(action close / select / list). If a click opened an extra tab, close it and select the WhatsApp tab again. " +
    "Never navigate to about:blank to 'close' something.",
  // FIX: much more direct wording about uploads
  "To send a file on WhatsApp Web: FIRST get the file's full path with find_file or selected_files, before clicking anything. " +
    "Open the chat, click Attach (+), then 'Document' (or 'Photos & videos' for images and videos). " +
    "This opens a file chooser that only browser_file_upload can answer. You CAN read the user's local files: " +
    "call browser_file_upload with paths set to the full path. NEVER ask the user to pick or upload the file themselves. " +
    "Then take a snapshot, click Send, and check the next snapshot to confirm the file is in the chat.",
  // FIX (WhatsApp delete): the delete needs a confirmation dialog, the click on "Delete" alone does not delete
  // FIX (link click): never click the message itself (a link message opens a new tab). Hover it, then click the down-arrow.
  "To delete a message on WhatsApp Web: NEVER click a message, its text, a link, a link preview or a video: " +
    "that opens a new browser tab. The most recent message is the LAST 'row' in the chat. " +
    "Call browser_hover on that row. The small down-arrow (message options) then appears in the next snapshot: " +
    "click it with its exact ref. In the menu, click the item named exactly 'Delete' (not the menu itself, not 'Message info'). " +
    "Then a dialog 'Delete message?' appears: click 'Delete for me' unless the user says 'for everyone'. " +
    "The message is deleted ONLY when you clicked a button inside that dialog AND the next snapshot has no 'Delete message?' dialog. " +
    "If the dialog is still on screen, the message is NOT deleted: never say it is.",
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
        // FIX: the windows-mcp server prints a long traceback for every failed call. The AI still gets
        // the error through the tool result, so the terminal copy is hidden. (Set back to "inherit" to debug.)
        stderr: serverName === "screen" ? "ignore" : "inherit",
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
      // FIX: the AI kept using window handles (1443980) or made-up numbers (982) as "label" and every call failed.
      // The win_ tools only get "loc" (x, y), so the label option is removed.
      if (s.prefix === "win_" && t.inputSchema?.properties?.label) {
        delete t.inputSchema.properties.label;
        if (Array.isArray(t.inputSchema.required)) {
          t.inputSchema.required = t.inputSchema.required.filter((r) => r !== "label");
        }
      }
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

// =====================================================================
// Local tools: plain Node + PowerShell. No MCP, no packages, instant.
// They keep working even if the filesystem MCP server fails to start.
// =====================================================================
function addLocalTool({ name, description, parameters, confirm = false, check = null, run }) {
  // check(args) returns an error text (the call is refused and you are NOT asked) or null (ok)
  toolMap[name] = { confirm, check, run };
  aiTools.push({ type: "function", function: { name, description, parameters } });
}

const pathParam = (desc) => ({ type: "string", description: desc });

// ---- Path cleaning ----
// The AI sometimes doubles backslashes (C:\\\\\\Users) or adds junk text after a path.
// Every path argument is cleaned here before any tool sees it.
const PATH_HINT = " Write Windows paths with forward slashes, e.g. C:/Users/Name/Desktop/file.gif.";
const toSlash = (p) => String(p).replace(/\\/g, "/");

function cleanPath(input) {
  let p = String(input ?? "").trim();
  p = p.replace(/^["']+/, ""); // opening quote
  p = p.split(/["\r\n]/)[0].trim(); // drop anything after a closing quote or a line break
  p = p.replace(/['"]+$/, "");
  if (isWin) {
    p = p.replace(/\//g, "\\"); // C:/Users/x -> C:\Users\x
    p = p.replace(/\\{2,}/g, "\\"); // C:\\\\Users -> C:\Users
  }
  return p;
}

const PATH_KEYS = new Set(["path", "source", "destination", "folder"]);

function normalizeArgs(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const out = { ...args };
  for (const k of Object.keys(out)) {
    if (PATH_KEYS.has(k) && typeof out[k] === "string") out[k] = cleanPath(out[k]);
    if (k === "paths" && Array.isArray(out[k])) out[k] = out[k].map((x) => (typeof x === "string" ? cleanPath(x) : x));
  }
  return out;
}

// ---- Path safety ----
const norm = (x) => (isWin ? x.toLowerCase() : x);

// Real path of something that exists, or (if it does not exist yet) real path of its parent + its name
function realOrParent(p) {
  const full = path.resolve(p);
  if (fs.existsSync(full)) return fs.realpathSync(full);
  const parent = path.dirname(full);
  if (!fs.existsSync(parent)) return null;
  return path.join(fs.realpathSync(parent), path.basename(full));
}

// Inside an allowed folder, but (by default) never the allowed folder itself
function insideAllowed(p, { allowRoot = false } = {}) {
  const real = realOrParent(p);
  if (!real) return false;
  const target = norm(real);
  return FILE_FOLDERS.some((root) => {
    const r = norm(fs.realpathSync(root));
    const prefix = r.endsWith(path.sep) ? r : r + path.sep;
    return (allowRoot && target === r) || target.startsWith(prefix);
  });
}

const notAllowed = (what) =>
  `ERROR: ${what} must be inside one of these folders (not the folder itself): ${FILE_FOLDERS.join(", ")}`;

// ---- PowerShell helper (script is sent encoded, so quotes and newlines are safe) ----
function runPowerShell(script, env = {}, timeout = 15000) {
  const encoded = Buffer.from("$ProgressPreference='SilentlyContinue'\n" + script, "utf16le").toString("base64");
  return new Promise((resolve) =>
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { windowsHide: true, timeout, env: { ...process.env, ...env } },
      (err, stdout, stderr) =>
        resolve({ ok: !err, out: String(stdout).trim(), err: String(stderr).trim() || err?.message || "" })
    )
  );
}

// FIX: a file opened by explorer.exe often starts minimized or behind the terminal, because Windows does not
// let a background program take the focus. This finds the new window by the file name (without the extension,
// because some apps hide it) and brings it to the front with the same focus helper the win_ tools use.
// It restores the window if it is minimized. It retries, because the app needs a moment to create its window.
// Returns "OK", "FAILED" (window found but Windows refused) or "NONE" (no window with that name found).
async function bringOpenedToFront(p) {
  const query = path.basename(p, path.extname(p));
  if (query.length < 2) return "NONE";
  let last = "NONE";
  for (let i = 0; i < 4; i++) {
    last = await focusWindow({ query });
    if (last === "OK") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (last === "OK") console.log(`[focus] "${query}" brought to the front`);
  return last;
}

// ---- open_path: open a folder or file ----
addLocalTool({
  name: "open_path",
  description:
    "Open an existing folder or file on the user's computer. A folder opens in File Explorer, " +
    "a document opens in its default app. Use this instead of win_App whenever you know the path.",
  parameters: { type: "object", properties: { path: pathParam("Full absolute path") }, required: ["path"] },
  run: async ({ path: target }) => {
    const p = String(target ?? "").trim();
    if (!p) return "ERROR: path is empty";
    if (!fs.existsSync(p)) return `ERROR: this path does not exist: ${p}`;
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

    // FIX: for a file, bring its window to the front (and out of the minimized state). Folders are left as they were.
    if (isWin && fs.statSync(p).isFile()) {
      const f = await bringOpenedToFront(p);
      if (f === "OK") return `Opened ${p} and brought its window to the front.`;
      return (
        `Opened ${p}, but its window could not be brought to the front ` +
        `(${f === "NONE" ? "no window with this file name was found" : "Windows refused"}). ` +
        "It may be minimized or behind another window. Tell the user this."
      );
    }
    return `Opened ${p}`;
  },
});

// ---- find_file: find by name (limited in depth, time and result count) ----
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

  // FIX: search the Desktop and the workspace FIRST, so the 5 second limit is not used up elsewhere
  const roots = [...DESKTOP_FOLDERS, WORKSPACE, ...FILE_FOLDERS];
  for (const root of roots) walk(root, 0);
  return [...new Set(results)];
}

addLocalTool({
  name: "find_file",
  description:
    "Find a file or folder by (part of) its name on the Desktop and in the workspace. " +
    "Fast. Returns full paths. Use this instead of searching folder by folder.",
  parameters: {
    type: "object",
    properties: { name: pathParam("Part of the file name, e.g. 'loader.gif'") },
    required: ["name"],
  },
  run: async ({ name }) => {
    const n = String(name ?? "").trim();
    if (!n) return "ERROR: name is empty";
    const found = findFiles(n);
    return found.length
      ? "Found:\n" + found.map(toSlash).join("\n")
      : `No file or folder with "${n}" in its name was found in: ${FILE_FOLDERS.join(", ")}`;
  },
});

// ---- selected_files: what the user has selected right now ("delete THIS", "copy THAT") ----
const SELECTED_SCRIPT = `
$sh = New-Object -ComObject Shell.Application
foreach ($w in $sh.Windows()) {
  try { foreach ($i in $w.Document.SelectedItems()) { $i.Path } } catch {}
}
try {
  $a = 0; $b = 0; $hwnd = 0
  $desk = $sh.Windows().FindWindowSW([ref]$a, [ref]$b, 8, [ref]$hwnd, 1)
  foreach ($i in $desk.Document.SelectedItems()) { $i.Path }
} catch {}
`;

addLocalTool({
  name: "selected_files",
  description:
    "Return the full paths of the files or folders the user has SELECTED right now in File Explorer " +
    "or on the Desktop. Call this FIRST whenever the user says 'this', 'that', 'these' or 'the selected file'.",
  parameters: { type: "object", properties: {} },
  run: async () => {
    if (!isWin) return "ERROR: selected_files is only implemented for Windows.";
    const r = await runPowerShell(SELECTED_SCRIPT);
    const paths = [...new Set(r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].filter((p) =>
      fs.existsSync(p)
    );
    return paths.length
      ? "Selected:\n" + paths.map(toSlash).join("\n")
      : "Nothing is selected in File Explorer or on the Desktop. Ask the user for the file name, or use find_file.";
  },
});

// ---- copy_path: copy a file or folder (never overwrites) ----
addLocalTool({
  name: "copy_path",
  description:
    "Copy a file or folder. If destination is an existing folder, the copy goes inside it with the same name. " +
    "Otherwise destination is the full path of the new copy (use this to duplicate in the same folder with a new name). " +
    "Never overwrites an existing file.",
  parameters: {
    type: "object",
    properties: {
      source: pathParam("Full absolute path of the file or folder to copy"),
      destination: pathParam("Full absolute path of the destination folder, or of the new copy"),
    },
    required: ["source", "destination"],
  },
  run: async ({ source, destination }) => {
    const s = String(source ?? "").trim();
    const d = String(destination ?? "").trim();
    if (!s || !d) return "ERROR: source and destination are required";
    const src = path.resolve(s);
    const dst = path.resolve(d);
    if (!fs.existsSync(src)) return `ERROR: this path does not exist: ${src}`;
    if (!insideAllowed(src)) return notAllowed("the source");

    const intoFolder = fs.existsSync(dst) && fs.statSync(dst).isDirectory();
    const target = intoFolder ? path.join(dst, path.basename(src)) : dst;
    if (!insideAllowed(target)) return notAllowed("the destination");
    if (fs.existsSync(target)) {
      return `ERROR: ${target} already exists. Give the copy a different name (for example "name - Copy").`;
    }

    try {
      fs.cpSync(src, target, { recursive: true, errorOnExist: true, force: false });
    } catch (err) {
      return `ERROR: could not copy: ${err.message}`;
    }
    return fs.existsSync(target) ? `Copied ${src} to ${target}` : `ERROR: the copy is missing after copying: ${target}`;
  },
});

// ---- rename_path: rename in place ----
const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;

addLocalTool({
  name: "rename_path",
  confirm: false, // never overwrites, so it does not ask
  description:
    "Rename a file or folder in the SAME folder. Only the new name is given, not a path. " +
    `To move it to another folder use ${SERVERS.files.prefix}move_file instead. Never overwrites.`,
  parameters: {
    type: "object",
    properties: {
      path: pathParam("Full absolute path of the file or folder to rename"),
      new_name: pathParam("New name only, including the extension, e.g. 'report-final.docx'"),
    },
    required: ["path", "new_name"],
  },
  run: async ({ path: target, new_name }) => {
    const p = String(target ?? "").trim();
    const n = String(new_name ?? "").trim();
    if (!p || !n) return "ERROR: path and new_name are required";
    if (INVALID_NAME.test(n) || n === "." || n === "..") {
      return "ERROR: new_name must be a plain name without slashes or special characters.";
    }
    const src = path.resolve(p);
    if (!fs.existsSync(src)) return `ERROR: this path does not exist: ${src}`;
    if (!insideAllowed(src)) return notAllowed("the file");

    const dst = path.join(path.dirname(src), n);
    const onlyCaseChange = norm(dst) === norm(src); // Windows: "a.txt" -> "A.txt" is allowed
    if (!onlyCaseChange && fs.existsSync(dst)) return `ERROR: ${dst} already exists. Choose another name.`;

    try {
      fs.renameSync(src, dst);
    } catch (err) {
      return `ERROR: could not rename: ${err.message}`;
    }
    return fs.existsSync(dst) ? `Renamed ${src} to ${dst}` : `ERROR: the new name is missing after renaming: ${dst}`;
  },
});

// ---- delete_path: delete to the Recycle Bin ----
// Checked BEFORE you are asked, so you are never asked about a call that is going to fail.
function checkDelete({ path: target }) {
  const p = String(target ?? "").trim();
  if (!p) return "ERROR: path is empty";
  if (!fs.existsSync(p)) return `ERROR: this path does not exist: ${p}.${PATH_HINT}`;
  if (!isWin) return "ERROR: delete_path is only implemented for Windows.";
  if (!insideAllowed(p)) return notAllowed("a deleted path");
  return null;
}

// The fs_ tools cannot delete anything. Without this tool the AI renames files instead.
addLocalTool({
  name: "delete_path",
  confirm: CONFIRM_DELETE, // asks y/n first (type "a" to stop asking for the rest of the session)
  check: checkDelete,
  description:
    "Delete a file or folder on the user's computer (it goes to the Recycle Bin). " +
    "This is the ONLY way to delete. Never rename or move a file as a substitute for deleting. " +
    "Use the full absolute path, for example one returned by find_file or selected_files.",
  parameters: {
    type: "object",
    properties: { path: pathParam("Full absolute path of the file or folder") },
    required: ["path"],
  },
  run: async ({ path: target }) => {
    const bad = checkDelete({ path: target });
    if (bad) return bad;
    const p = String(target ?? "").trim();
    const full = path.resolve(p);
    const method = fs.statSync(full).isDirectory() ? "DeleteDirectory" : "DeleteFile";
    // The path goes in through an environment variable, so it can never be read as part of the command
    const script =
      "Add-Type -AssemblyName Microsoft.VisualBasic; " +
      `[Microsoft.VisualBasic.FileIO.FileSystem]::${method}($env:DEL_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')`;

    const r = await runPowerShell(script, { DEL_PATH: full });
    if (!r.ok) return `ERROR: could not delete: ${r.err || r.out}`;
    // Check it is really gone, so the AI cannot claim a delete that did not happen
    if (fs.existsSync(full)) return `ERROR: the path still exists after the delete: ${full}`;
    return `Deleted ${full} (moved to the Recycle Bin, so it can be restored from there).`;
  },
});

// ADDED: ---- take_screenshot: capture the screen and save it as PNG/JPG ----
// DPI awareness is set first, otherwise on 125%/150% display scaling only the top-left part is captured.
const SCREENSHOT_SCRIPT = `
Add-Type @"
using System.Runtime.InteropServices;
public class Dpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[void][Dpi]::SetProcessDPIAware()
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
if ($env:SHOT_FORMAT -eq 'jpg') { $fmt = [System.Drawing.Imaging.ImageFormat]::Jpeg } else { $fmt = [System.Drawing.Imaging.ImageFormat]::Png }
$bmp.Save($env:SHOT_PATH, $fmt)
$g.Dispose(); $bmp.Dispose()
`;

function screenshotName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `screenshot-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
  for (let i = 2; i < 1000; i++) {
    const c = path.join(dir, `${name} (${i})${ext}`);
    if (!fs.existsSync(c)) return c;
  }
  return p;
}

addLocalTool({
  name: "take_screenshot",
  description:
    "Take a screenshot of the whole screen and save it as an image file. This is the ONLY way to take a screenshot " +
    "(win_Snapshot does not save an image). Give path when the user names a location or file name. " +
    "path can be a full file path (.png or .jpg) or an existing folder (the file name is then made automatically). " +
    "Without path it is saved on the Desktop.",
  parameters: {
    type: "object",
    properties: {
      path: pathParam("Optional. Full path of the image file to create, or an existing folder to save into."),
      app: pathParam("Optional. Part of an app name or window title to bring to the front before capturing, e.g. 'notepad'."),
      delay_seconds: { type: "number", description: "Optional. Seconds to wait before capturing (0 to 30). Default 1." },
    },
  },
  run: async ({ path: target, app, delay_seconds }) => {
    if (!isWin) return "ERROR: take_screenshot is only implemented for Windows.";

    let out = String(target ?? "").trim() || DESKTOP_FOLDERS[0] || WORKSPACE;
    out = path.resolve(out);
    if (fs.existsSync(out) && fs.statSync(out).isDirectory()) out = path.join(out, screenshotName());
    else if (!/\.(png|jpe?g)$/i.test(out)) out += ".png";

    const folder = path.dirname(out);
    if (!fs.existsSync(folder)) return `ERROR: the folder ${toSlash(folder)} does not exist. Create it first with ${fsp}create_directory.`;
    if (!insideAllowed(out)) return notAllowed("the screenshot file");
    out = uniquePath(out); // never overwrites

    const a = String(app ?? "").trim();
    if (a) {
      const f = await focusWindow({ query: a });
      if (f === "NONE") return `ERROR: no open window matching "${a}" was found. Nothing was captured.`;
    }
    const wait = Math.min(Math.max(Number(delay_seconds ?? 1) || 0, 0), 30);
    await new Promise((r) => setTimeout(r, wait * 1000));

    const format = /\.jpe?g$/i.test(out) ? "jpg" : "png";
    const r = await runPowerShell(SCREENSHOT_SCRIPT, { SHOT_PATH: out, SHOT_FORMAT: format }, 20000);
    if (!r.ok) return `ERROR: could not take the screenshot: ${r.err || r.out}`;
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) return `ERROR: the screenshot file is missing after capturing: ${toSlash(out)}`;
    return `Saved screenshot to ${toSlash(out)}`;
  },
});

// ---- close_explorer / close_app: close windows properly ----
// Without these the AI has no way to close a window, so it guesses the X button in a screen corner
// with the mouse and closes whatever happens to be there.
const CLOSE_EXPLORER_SCRIPT = `
$want = $env:CLOSE_FOLDER
$sh = New-Object -ComObject Shell.Application
$n = 0
foreach ($w in @($sh.Windows())) {
  try {
    if ($w.FullName -notlike '*explorer.exe') { continue }
    if ($want) {
      $p = $w.Document.Folder.Self.Path
      if (-not $p) { continue }
      if ($p.TrimEnd([char]92).ToLower() -ne $want.TrimEnd([char]92).ToLower()) { continue }
    }
    $w.Quit()
    $n++
  } catch {}
}
"CLOSED=$n"
`;

addLocalTool({
  name: "close_explorer",
  description:
    "Close File Explorer windows. Without a folder it closes ALL open File Explorer windows. " +
    "With a folder it closes only the window showing that folder. It never closes anything else. " +
    "Use this whenever the user says to close File Explorer or a folder window. " +
    "NEVER close a window by clicking its X or moving the mouse.",
  parameters: {
    type: "object",
    properties: { folder: pathParam("Optional: full path of the folder whose window should be closed") },
  },
  run: async ({ folder }) => {
    if (!isWin) return "ERROR: close_explorer is only implemented for Windows.";
    const f = String(folder ?? "").trim();
    const r = await runPowerShell(CLOSE_EXPLORER_SCRIPT, { CLOSE_FOLDER: f });
    if (!r.ok) return `ERROR: could not close: ${r.err || r.out}`;
    const n = Number((r.out.match(/CLOSED=(\d+)/) || [])[1] ?? 0);
    return n
      ? `Closed ${n} File Explorer window(s).`
      : "No matching File Explorer window was open. Nothing was closed.";
  },
});

// Sends the close request, then waits up to 3 seconds and checks if the window is REALLY gone.
// CLOSED=name | title          the window is gone
// OPEN=id|handle|name|title    the window is still there (a save question, or an administrator window)
const CLOSE_APP_SCRIPT = `
$q = [WildcardPattern]::Escape($env:CLOSE_QUERY)
$protected = @('explorer','WindowsTerminal','cmd','powershell','pwsh','conhost','OpenConsole','node','dwm','winlogon','csrss','svchost')
$found = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($protected -notcontains $_.ProcessName) -and ($_.ProcessName -like "*$q*" -or $_.MainWindowTitle -like "*$q*") })
if ($found.Count -eq 0) {
  "NONE"
} else {
  $info = @()
  foreach ($p in $found) {
    $info += [pscustomobject]@{ Id = $p.Id; Name = $p.ProcessName; Title = $p.MainWindowTitle; Handle = $p.MainWindowHandle.ToInt64() }
    try { [void]$p.CloseMainWindow() } catch {}
  }
  for ($t = 0; $t -lt 6; $t++) {
    Start-Sleep -Milliseconds 500
    $left = @($info | Where-Object { $n = Get-Process -Id $_.Id -ErrorAction SilentlyContinue; $n -and ($n.MainWindowHandle.ToInt64() -eq $_.Handle) })
    if ($left.Count -eq 0) { break }
  }
  foreach ($i in $info) {
    $n = Get-Process -Id $i.Id -ErrorAction SilentlyContinue
    if (-not $n -or ($n.MainWindowHandle.ToInt64() -ne $i.Handle)) { "CLOSED=" + $i.Name + " | " + $i.Title }
    else { "OPEN=" + $i.Id + "|" + $i.Handle + "|" + $i.Name + "|" + $i.Title }
  }
}
`;

// Looks inside a window that did not close for a question with buttons (Save / Don't save / Cancel,
// or Yes / No / Cancel), using Windows UI Automation. With DIALOG_CLICK = a button number (0 = first),
// it clicks that button. Buttons are clicked by number, so odd characters in their names do not matter.
const CLOSE_DIALOG_SCRIPT = `
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Inspect-Dialog {
  $AE = [System.Windows.Automation.AutomationElement]
  $TS = [System.Windows.Automation.TreeScope]
  $CT = [System.Windows.Automation.ControlType]
  $proc = Get-Process -Id ([int]$env:DIALOG_PID) -ErrorAction SilentlyContinue
  if (-not $proc -or $proc.MainWindowHandle.ToInt64() -eq 0) { "STATE=GONE"; return }
  $win = $AE::FromHandle($proc.MainWindowHandle)
  $btnCond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::Button)
  $noRegex = '^(don.?t save|do not save|discard( changes)?|no|close without saving)$'
  $anchor = $null
  foreach ($b in $win.FindAll($TS::Descendants, $btnCond)) {
    $nm = ([string]$b.Current.Name).Trim()
    if ($nm -match $noRegex) { $anchor = $b; break }
  }
  if (-not $anchor) { "STATE=OPEN"; return }
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $parent = $walker.GetParent($anchor)
  if (-not $parent) { "STATE=OPEN"; return }
  $row = @()
  $c = $walker.GetFirstChild($parent)
  while ($c -ne $null) {
    if ($c.Current.ControlType.Id -eq $CT::Button.Id) { $row += $c }
    $c = $walker.GetNextSibling($c)
  }
  if ($row.Count -lt 2) { "STATE=OPEN"; return }
  $btnNames = @($row | ForEach-Object { ([string]$_.Current.Name).Trim() })
  $textCond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::Text)
  $texts = @()
  $scope = $parent
  for ($i = 0; $i -lt 4 -and $scope -ne $null; $i++) {
    foreach ($t in $scope.FindAll($TS::Descendants, $textCond)) {
      $tx = ([string]$t.Current.Name).Trim()
      if ($tx -and ($texts -notcontains $tx) -and ($btnNames -notcontains $tx)) { $texts += $tx }
    }
    if ($texts.Count -gt 0) { break }
    $scope = $walker.GetParent($scope)
  }
  "STATE=DIALOG"
  "TEXT=" + (($texts | Select-Object -First 4) -join " | ")
  foreach ($n in $btnNames) { "BUTTON=" + $n }
  if ($env:DIALOG_CLICK) {
    $idx = [int]$env:DIALOG_CLICK
    if ($idx -lt 0 -or $idx -ge $row.Count) { "CLICK=BADINDEX"; return }
    try {
      $row[$idx].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      "CLICK=OK"
    } catch { "CLICK=FAILED " + $_.Exception.Message }
  }
}
Inspect-Dialog
`;

// Waits up to 3 seconds for the window to disappear. Prints GONE if it did.
const CHECK_GONE_SCRIPT = `
$id = [int]$env:CHK_PID
$h0 = [int64]$env:CHK_HANDLE
for ($i = 0; $i -lt 6; $i++) {
  Start-Sleep -Milliseconds 500
  $n = Get-Process -Id $id -ErrorAction SilentlyContinue
  if (-not $n -or ($n.MainWindowHandle.ToInt64() -ne $h0)) { "GONE"; break }
}
`;

// ---- Window focus ----
// Brings an app window to the front, like clicking it once to give it focus, but WITHOUT clicking anything
// (a real click could land on a button). Find the window by FOCUS_PID (exact) or FOCUS_QUERY (part of the
// app name or window title). It first tries the normal way; if Windows refuses, it taps the Alt key once,
// which makes Windows allow the switch. Prints FOCUS=OK, FOCUS=FAILED or FOCUS=NONE (no such window).
const FOCUS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
$p = $null
if ($env:FOCUS_PID) {
  $p = Get-Process -Id ([int]$env:FOCUS_PID) -ErrorAction SilentlyContinue
} elseif ($env:FOCUS_QUERY) {
  $q = [WildcardPattern]::Escape($env:FOCUS_QUERY)
  $p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$q*" -or $_.MainWindowTitle -like "*$q*") } | Select-Object -First 1
}
function Is-Front { [WinFocus]::GetForegroundWindow().ToInt64() -eq $h.ToInt64() }
if (-not $p -or $p.MainWindowHandle.ToInt64() -eq 0) {
  "FOCUS=NONE"
} else {
  $h = $p.MainWindowHandle
  $root = [WinFocus]::GetAncestor($h, 2)
  if ($root.ToInt64() -ne 0) { $h = $root }
  if ([WinFocus]::IsIconic($h)) { [void][WinFocus]::ShowWindow($h, 9) }
  [void][WinFocus]::SetForegroundWindow($h)
  Start-Sleep -Milliseconds 150
  if (-not (Is-Front)) {
    [WinFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [WinFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    [void][WinFocus]::SetForegroundWindow($h)
    [void][WinFocus]::BringWindowToTop($h)
    Start-Sleep -Milliseconds 200
  }
  if (Is-Front) { "FOCUS=OK" } else { "FOCUS=FAILED" }
}
`;

// The app the AI is working on right now. It is set when the AI calls win_App (or when close_app finds
// an app that will not close), and it is KEPT between your commands, so "click no" right after a failed
// close still focuses the same window first. It only changes when another app is chosen, or when
// close_app confirms the app is really closed.
// Before each win_Click / win_Type / win_Scroll / win_Shortcut its window is brought to the front.
let focusTarget = null;
const FOCUS_BEFORE = new Set(["win_Click", "win_Type", "win_Scroll", "win_Shortcut"]);

// FIX: these tools only report that the input was SENT, not that it worked
const INPUT_TOOLS = new Set(["win_Click", "win_Type", "win_Shortcut"]);

// Returns "OK", "FAILED" or "NONE"
async function focusWindow({ pid, query }) {
  if (!isWin) return "NONE";
  const env = pid ? { FOCUS_PID: String(pid) } : { FOCUS_QUERY: String(query ?? "") };
  const r = await runPowerShell(FOCUS_SCRIPT, env, 15000);
  const m = r.out.match(/FOCUS=(\w+)/);
  return m ? m[1] : "FAILED";
}

function parseDialog(out) {
  const info = { state: "", text: "", buttons: [], click: "" };
  for (const raw of String(out).split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "").trim();
    if (line.startsWith("STATE=")) info.state = line.slice(6);
    else if (line.startsWith("TEXT=")) info.text = line.slice(5);
    else if (line.startsWith("BUTTON=")) info.buttons.push(line.slice(7));
    else if (line.startsWith("CLICK=")) info.click = line.slice(6);
  }
  return info;
}

// Shows the question in the terminal and lets YOU choose. Returns the button index, or -1 for "do nothing".
async function askWhichButton(label, info) {
  console.log(`\n  !! ${label} did NOT close. It is asking you a question:`);
  if (info.text) console.log(`     ${info.text}`);
  info.buttons.forEach((b, i) => console.log(`     ${i + 1} = click "${b}"`));
  console.log("     0 = do nothing, leave it open");
  for (let tries = 0; tries < 3; tries++) {
    const answer = (await rl.question("  Which one? (type the number) ")).trim().toLowerCase();
    if (answer === "0") return -1;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= info.buttons.length) return n - 1;
    const byName = info.buttons.findIndex((b) => b.toLowerCase() === answer);
    if (answer && byName >= 0) return byName;
    console.log("  Please type one of the numbers above.");
  }
  return -1;
}

// A window is still open after the close request: find out why, ask you, and click what you choose.
async function handleStillOpen(app) {
  const label = `${app.name} | ${app.title}`;
  const env = { DIALOG_PID: String(app.id) };
  // If the AI has to click by hand later (even on your NEXT command), this window is brought to the front first.
  // If the app turns out to be closed, the old target is put back (see the "Closed" returns below).
  const previousTarget = focusTarget;
  focusTarget = app.name;

  // Bring the window to the front first, so a question hidden behind another window can be found
  await focusWindow({ pid: app.id });
  const look = parseDialog((await runPowerShell(CLOSE_DIALOG_SCRIPT, env, 20000)).out);

  if (look.state === "GONE") {
    focusTarget = previousTarget;
    return `Closed: ${label}`;
  }

  if (look.state !== "DIALOG" || look.buttons.length < 2) {
    console.log(`\n  !! ${label} is still open after the close request.`);
    console.log("     I could not find a question (like 'Save changes?') in it. It may be showing something I cannot read,");
    console.log("     or it runs as administrator (like Task Manager) and cannot be closed from here.");
    return (
      `NOT CLOSED: ${label} is still open after the close request. ` +
      "It may be showing a question (for example 'Save changes?') that could not be read, or it runs as administrator. " +
      "Do NOT say it is closed and do NOT click anything. Tell the user it is still open and ask what they want."
    );
  }

  const idx = await askWhichButton(label, look);
  if (idx < 0) {
    return (
      `NOT CLOSED: ${label} is still open and asking: ${look.text || look.buttons.join(" / ")}. ` +
      "The user chose to leave it open. Do NOT click anything. Tell the user it is still open."
    );
  }

  const chosen = look.buttons[idx];

  // You typed your answer in the terminal, so the terminal is in front now. Bring the app back before clicking.
  const front = await focusWindow({ pid: app.id });
  if (front === "FAILED") console.log(`  (could not bring ${label} to the front, trying to click anyway)`);

  const clicked = parseDialog(
    (await runPowerShell(CLOSE_DIALOG_SCRIPT, { ...env, DIALOG_CLICK: String(idx) }, 20000)).out
  );
  const check = await runPowerShell(CHECK_GONE_SCRIPT, { CHK_PID: String(app.id), CHK_HANDLE: String(app.handle) }, 15000);
  const gone = check.out.includes("GONE");

  if (gone) {
    console.log(`\n  Clicked "${chosen}". ${label} is now closed.`);
    focusTarget = previousTarget;
    return `Closed: ${label} (the user chose "${chosen}" in its question).`;
  }
  if (clicked.click.startsWith("OK")) {
    console.log(`\n  Clicked "${chosen}", but ${label} is still open.`);
    return (
      `Clicked "${chosen}" for the user, but ${label} is still open ` +
      "(this is normal after Cancel; after Save a Save As window may have appeared). " +
      "Do NOT say it is closed. Tell the user exactly what happened."
    );
  }
  console.log(`\n  !! I could not click "${chosen}" myself.`);
  return (
    `NOT CLOSED: ${label} is still open. The user chose "${chosen}" but the click failed (${clicked.click || "no result"}). ` +
    `Call win_Snapshot, find the button "${chosen}", click it with win_Click, then call win_Snapshot again. ` +
    "Do not say it is closed until a snapshot shows it is gone."
  );
}

addLocalTool({
  name: "close_app",
  description:
    "Close an app window politely, like clicking its X, so an app with unsaved work shows its own save question. " +
    "If the app shows a question (like 'Save changes?'), this tool shows it to the user in the terminal, " +
    "lets the user choose the button, and clicks that button itself. Never click anything yourself for this. " +
    "Give part of the app name or window title, for example 'notepad' or 'chrome'. " +
    "Not for File Explorer (use close_explorer). Never close windows by clicking or by moving the mouse.",
  parameters: {
    type: "object",
    properties: { name: pathParam("Part of the app name or window title, e.g. 'notepad'") },
    required: ["name"],
  },
  run: async ({ name }) => {
    if (!isWin) return "ERROR: close_app is only implemented for Windows.";
    const q = String(name ?? "").trim();
    if (q.length < 3) return "ERROR: give at least 3 letters of the app name or window title.";
    if (/explorer/i.test(q)) return "ERROR: use close_explorer to close File Explorer.";
    const r = await runPowerShell(CLOSE_APP_SCRIPT, { CLOSE_QUERY: q }, 20000);
    if (!r.ok) return `ERROR: could not close: ${r.err || r.out}`;

    const lines = r.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const closed = lines.filter((l) => l.startsWith("CLOSED=")).map((l) => l.slice(7));
    const stillOpen = lines
      .filter((l) => l.startsWith("OPEN="))
      .map((l) => {
        const [id, handle, appName, ...title] = l.slice(5).split("|");
        return { id, handle, name: appName, title: title.join("|") };
      });

    if (!closed.length && !stillOpen.length) return `No open window matching "${q}" was found. Nothing was closed.`;

    const report = [];
    if (closed.length) report.push("Closed:\n" + closed.join("\n"));
    for (const app of stillOpen) report.push(await handleStillOpen(app));
    return report.join("\n\n");
  },
});

// CHANGED: "open chrome" must mean the Playwright browser, never the Windows Chrome app.
// This runs before the user is asked and before anything is launched, so win_App can never start Windows Chrome.
const BROWSER_APP_NAMES = /chrom|browser/i;

if (toolMap.win_App && clients.browser) {
  toolMap.win_App.check = (args) =>
    BROWSER_APP_NAMES.test(String(args?.name ?? ""))
      ? "ERROR: do not open Chrome or a browser with win_App. The user's browser is already controlled by the browser_ tools. " +
        "Call browser_navigate with the site (for example https://www.google.com); it opens the browser if it is not open yet."
      : null;
}

// FIX (link click): ---- WhatsApp click guard ----
// Clicking a link message on WhatsApp Web opens a new tab instead of selecting the message.
// This refuses a browser_click on a link element and a "Delete" click on the wrong element, before anything runs.
let currentUrl = "";
let lastSnapshot = "";

function trackPage(text) {
  const u = text.match(/Page URL:\s*(\S+)/);
  if (u) currentUrl = u[1];
  if (text.includes("```yaml")) lastSnapshot = text; // full text, before it is shortened
}

function elementLine(ref) {
  const m = lastSnapshot.match(new RegExp(`^[ \\t]*- [^\\n]*\\[ref=${ref}\\][^\\n]*$`, "m"));
  return m ? m[0].trim() : null;
}

function checkBrowserClick(args) {
  if (!/web\.whatsapp\.com/i.test(currentUrl) || !lastSnapshot) return null;
  const ref = String(args.target ?? args.ref ?? "").trim();
  if (!/^\w+$/.test(ref)) return null;

  const line = elementLine(ref);
  if (!line) return `ERROR: ref ${ref} is not in the latest page snapshot. Call browser_snapshot and use a ref from it.`;

  const role = line.replace(/^- /, "").split(/[\s":]/)[0];
  if (role === "link") {
    return (
      "ERROR: that element is a LINK. Clicking it opens a new tab and does not select the message. " +
      "Use browser_hover on the message row, then click the down-arrow that appears."
    );
  }
  // The AI once clicked the menu container while saying "Delete option"
  if (/\bdelete\b/i.test(String(args.element ?? "")) && !/delete/i.test(line)) {
    return `ERROR: ref ${ref} is "${line.slice(0, 100)}", which is not a Delete button. Pick the ref whose name is "Delete".`;
  }
  return null;
}

if (toolMap.browser_click) toolMap.browser_click.check = checkBrowserClick;

if (aiTools.length === 0) {
  console.error("No tools available: none of the servers started.");
  process.exit(1);
}
console.log(`The AI has ${aiTools.length} tools in total.`);

// Open Chrome right away (only if the browser server started)
if (START_PAGE && clients.browser) {
  try {
    const r = await clients.browser.callTool({ name: "browser_navigate", arguments: { url: START_PAGE } });
    console.log(r.isError ? "(Could not open the start page; Chrome will open on your first browser command.)" : "Chrome is open.");
  } catch (err) {
    console.log("(Could not open the start page; Chrome will open on your first browser command.)", err.message);
  }
}

// ---- Hints for the AI ----
const fsp = SERVERS.files.prefix;
const COMPUTER_HINTS = [];

COMPUTER_HINTS.push(
  `Files: you may only touch files inside these folders: ${FILE_FOLDERS.map(toSlash).join(", ")}. Always use full absolute paths. ` +
    `Write Windows paths with FORWARD slashes, like ${toSlash(os.homedir())}/Desktop/file.gif. ` +
    "Never type backslashes: they get doubled and the path breaks. The tools accept forward slashes."
);
if (DESKTOP_FOLDERS.length) {
  COMPUTER_HINTS.push(
    `The user's Desktop folder is: ${toSlash(DESKTOP_FOLDERS[0])}. When the user says "desktop", use exactly that path. ` +
      "If the user does not give a name for a new folder or file, choose a sensible name yourself " +
      "(for example 'New Folder') instead of asking."
  );
}
COMPUTER_HINTS.push(
  "FILE TOOL GUIDE. Always use these tools for files. NEVER use the keyboard or the mouse " +
    "(ctrl+c, ctrl+v, the Delete key, clicking in File Explorer) to copy, paste, rename or delete: " +
    "find a file by name -> find_file. " +
    "The user says 'this', 'that', 'these' or 'the selected file' -> call selected_files FIRST. " +
    "copy or duplicate -> copy_path. rename -> rename_path. move to another folder -> " + fsp + "move_file. " +
    "delete -> delete_path. new folder -> " + fsp + "create_directory. list a folder -> " + fsp + "list_directory. " +
    "read a text file -> " + fsp + "read_text_file. create or overwrite a text file -> " + fsp + "write_file. " +
    "change part of a text file -> " + fsp + "edit_file (read the file first, then pass the exact old text). " +
    "open a file or folder -> open_path. clipboard text -> win_Clipboard."
);
COMPUTER_HINTS.push(
  "CLOSING WINDOWS: close File Explorer with close_explorer. Close any other app with close_app. " +
    "NEVER close a window by clicking its X, by moving the mouse to a screen corner, or with alt+f4: " +
    "you cannot see exactly what is there, so you would close the wrong window."
);
COMPUTER_HINTS.push(
  "If close_app shows the user a question (like 'Save changes?') it asks the user in the terminal and clicks their choice itself. " +
    "Only say an app is closed if close_app returned 'Closed'. If the result says NOT CLOSED, the app is still open: " +
    "do not click anything yourself, and tell the user what the result said."
);
COMPUTER_HINTS.push(
  "If selected_files finds nothing and the user did not name the file, ask one short question. " +
    "Never guess which file to delete or rename. If several files match a name, ask which one. " +
    "If the user says 'it' or 'that' about something you just created or mentioned, use that exact path."
);
COMPUTER_HINTS.push(
  "Never read images, PDFs or Office files with " + READ_TEXT_TOOL + ". " +
    "If a tool already showed that a file exists, it is found: do not search for it again."
);
COMPUTER_HINTS.push(
  "Only say something is deleted if delete_path returned 'Deleted'. " +
    "Only say something is copied or renamed if copy_path or rename_path returned 'Copied' or 'Renamed'."
);
// ADDED: hint for the screenshot tool
COMPUTER_HINTS.push(
  "SCREENSHOTS: when the user asks for a screenshot, call take_screenshot. NEVER use win_Snapshot, the keyboard (PrtScn, " +
    "win+shift+s) or the Snipping Tool for this. If the user names a folder or file name, pass it as path " +
    "(a folder is fine, the file name is made automatically). If the user names an app, pass it as app. " +
    "Only say it is saved if the result starts with 'Saved', and tell the user the full path."
);

if (clients.screen) {
  COMPUTER_HINTS.push(
    "Screen: the win_ tools control the Windows desktop (apps like Notepad, Word, Settings). " +
      "Call win_Snapshot first to see the open windows and their elements, then use the exact coordinates " +
      "from the LATEST snapshot to click or type (pass loc as [x, y]; there is no label option, and a window Handle is not a position). " +
      "Never guess coordinates. " +
      "After every click, type or shortcut, call win_Snapshot again to check what changed. " +
      "win_App opens or switches to an app by name only. If an app is still loading, call win_Wait and snapshot again. " +
      "Before you click or type in an app, call win_App (switch) with that app's name: the client then brings that window " +
      "to the front before every click, type, scroll or shortcut, so another window on top cannot take the click. " +
      "The client remembers the last app between the user's commands, so it keeps focusing that same window until another app is chosen. " +
      "Use win_Shortcut for keyboard shortcuts such as ctrl+s inside an app. " +
      "Do not use the win_ tools for file operations or for closing windows: the dedicated tools are faster and safer."
  );
  // FIX: how to save from Notepad without guessing the Save button, and without appending to "*.txt"
  COMPUTER_HINTS.push(
    "SAVING in Notepad: call win_Shortcut ctrl+s, then win_Snapshot to find the 'File name' box. " +
      "That box already contains text such as '*.txt', so call win_Type with the file name, clear set to true " +
      "and press_enter set to true (Enter saves; do not guess the position of the Save button). " +
      "Then call win_Snapshot to check the Save As window is gone, and call find_file to confirm the file exists. " +
      "Only say it is saved if find_file finds it."
  );
}

// CHANGED: the first part now says that "open chrome" means the browser_ tools (the Playwright Chrome),
// and that it opens by itself the first time a browser_ tool is used. The rest is the same as before.
const BROWSER_PROMPT = clients.browser
  ? " You also control a real Chrome browser with the browser_ tools. THAT is the user's Chrome. " +
    "It is not open when the program starts: it opens by itself the first time you use a browser_ tool. " +
    "When the user says 'open chrome', 'open the browser', 'open google', 'go to <site>' or 'open WhatsApp/YouTube/Gmail on the web', " +
    "they mean THIS browser. For 'open chrome' or 'open the browser' with no site named, call browser_navigate with https://www.google.com. " +
    // FIX (link click): browser_tab_new -> browser_tabs
    "For a site, call browser_navigate with that site's URL (or browser_tabs with action new). " +
    "NEVER open Chrome or any browser with win_App, the Start menu or win_Shortcut. " +
    "Open a site directly with browser_navigate when you know its URL. " +
    "Anything on a website uses the browser_ tools. Desktop apps and files use the win_ tools and the file tools. " +
    "Never use close_app, close_explorer or the win_ tools on the browser: close the whole browser with browser_close " +
    // FIX (link click): browser_tab_close -> browser_tabs
    "and one tab with browser_tabs. " +
    "The page comes back as a snapshot where every element has a ref. " +
    // FIX (WhatsApp delete): the old sentence said action tools already return a snapshot, which was wrong
    "After every click, type or key press, the result ends with the page as it is RIGHT NOW. Read it. " +
    "A click is not success: if a confirmation dialog (Cancel / Delete / OK / Yes) is open, the action is NOT done yet, " +
    "click the confirm button inside the dialog first. " +
    "To click or type, call browser_click or browser_type with the element description AND its exact ref from the latest snapshot. " +
    "If a ref is not found, take a new snapshot and try again. " +
    "After you send or submit something, check the next snapshot to confirm it worked.\n\nSite notes:\n- " +
    SITE_HINTS.join("\n- ")
  : "";

const messages = [
  {
    role: "system",
    content:
      "You control the user's Windows computer through tools. " +
      "When the user wants something done, call the tools instead of describing what you would do. " +
      "Finish the WHOLE request before you reply: do not stop to report progress. " +
      "Do not ask for details you can decide yourself (like the name of a new folder): pick a sensible default. " +
      "The one exception: if you cannot tell WHICH file the user means, ask one short question. " +
      "Only write a final text answer after the last action is done. " +
      "Only report success if a tool result confirms it. " +
      "If none of your tools can do what the user asks, say so plainly. " +
      "Never do something different and then report the request as done. " +
      "If the user denies an action, do not try it again: just say what you wanted to do. " +
      "When finished, reply with one or two short sentences." +
      BROWSER_PROMPT +
      "\n\nComputer notes:\n- " +
      COMPUTER_HINTS.join("\n- "),
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
  return text.slice(0, head) + "\n...[middle of the output cut out]...\n" + text.slice(-tail);
}

// ---- Binary file protection ----
const BINARY_MESSAGE =
  "This is a binary file (image, document or archive), so it cannot be read as text. " +
  `It was found, so it exists. To open it, call open_path. To check its size, call ${fsp}get_file_info.`;

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

// FIX: clean exit on Ctrl+C (no more AbortError stack trace)
async function shutdown() {
  try {
    rl.close();
  } catch {}
  for (const c of Object.values(clients)) {
    try {
      await c.close();
    } catch {}
  }
  process.exit(0);
}
rl.on("SIGINT", shutdown);
process.on("SIGINT", shutdown);

// Tools you answered "a" (always) for. They stop asking until you restart.
const autoAllow = new Set();

// FIX: true while Playwright reports an open file chooser (it is kept between your commands)
let fileChooserOpen = false;

// FIX (WhatsApp delete): browser actions that change the page. After each one, the client adds a fresh
// snapshot to the result, so the AI always sees the real page (for example a confirmation dialog).
// FIX (link click): browser_hover is included, so the AI sees the message's down-arrow right after hovering.
const BROWSER_ACTIONS = new Set(["browser_click", "browser_type", "browser_press_key", "browser_select_option", "browser_hover"]);

// FIX (maximize): a small window makes sites switch to a narrow layout and the AI struggles to click things.
// So the Playwright Chrome window is MAXIMIZED when a command starts using the browser, and put back to its
// normal size ("restore down") when the command is finished.
// The Playwright Chrome is found by its command line (ms-playwright / --remote-debugging-pipe, main process only),
// so your own normal Chrome windows are never touched.
// WIN_ACTION=max prints WAS=MAX / WAS=NORMAL / WAS=MIN (how the window was before). WIN_ACTION=restore prints RESTORED.
// If no Playwright Chrome window exists yet, it prints WIN=NONE.
const BROWSER_WINDOW_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BrowserWin {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint f);
}
"@
$procs = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -and ($_.CommandLine -notlike '*--type=*') -and ($_.CommandLine -like '*ms-playwright*' -or $_.CommandLine -like '*--remote-debugging-pipe*')
})
$h = [IntPtr]::Zero
foreach ($c in $procs) {
  $p = Get-Process -Id $c.ProcessId -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle.ToInt64() -ne 0) { $h = $p.MainWindowHandle; break }
}
if ($h.ToInt64() -eq 0) {
  "WIN=NONE"
} else {
  $root = [BrowserWin]::GetAncestor($h, 2)
  if ($root.ToInt64() -ne 0) { $h = $root }
  if ($env:WIN_ACTION -eq 'max') {
    if ([BrowserWin]::IsIconic($h)) { $was = 'MIN' } elseif ([BrowserWin]::IsZoomed($h)) { $was = 'MAX' } else { $was = 'NORMAL' }
    if ($was -ne 'MAX') { [void][BrowserWin]::ShowWindow($h, 3) }
    "WAS=$was"
  } else {
    if ([BrowserWin]::IsZoomed($h)) { [void][BrowserWin]::ShowWindow($h, 9) }
    "RESTORED"
  }
}
`;

let browserMaximized = false; // true once the browser window is maximized during this command
let browserRestoreNeeded = false; // true only if WE maximized it (a window that was already maximized is left alone)

async function maximizeBrowserWindow() {
  if (!isWin || !clients.browser || browserMaximized) return;
  const r = await runPowerShell(BROWSER_WINDOW_SCRIPT, { WIN_ACTION: "max" }, 15000);
  const m = r.out.match(/WAS=(\w+)/);
  if (!m) return; // the browser window does not exist yet, it is tried again after the next browser tool
  browserMaximized = true;
  if (m[1] !== "MAX") {
    browserRestoreNeeded = true;
    console.log("[window] browser maximized");
    await new Promise((res) => setTimeout(res, 500)); // let the page re-layout to the new size
  }
}

async function restoreBrowserWindow() {
  if (isWin && browserRestoreNeeded) {
    await runPowerShell(BROWSER_WINDOW_SCRIPT, { WIN_ACTION: "restore" }, 15000);
    console.log("[window] browser restored down");
  }
  browserMaximized = false;
  browserRestoreNeeded = false;
}

async function approve(name, args) {
  const shown = JSON.stringify(args);
  console.log(`\n  The AI wants to run ${name} ${shown.length > 300 ? shown.slice(0, 300) + "..." : shown}`);
  const answer = (await rl.question("  Allow it? (y = yes, n = no, a = always yes for this tool) ")).trim().toLowerCase();
  if (answer.startsWith("a")) {
    autoAllow.add(name);
    return true;
  }
  return answer.startsWith("y");
}

console.log('Type what you want, e.g. "copy loader.gif to a new folder on my desktop". Type "exit" to quit.');

while (true) {
  // FIX: a stray Ctrl+C / abort while waiting for input now just ends the loop
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
  // NOTE: focusTarget is NOT reset here anymore. The last app stays the focus target on your next command,
  // so "click no" after a failed close still brings that app to the front before clicking.

  try {
    let finished = false;
    let nudges = 0; // FIX: how many times we pushed the AI to call browser_file_upload this turn

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
      console.log(`\n[AI answered in ${secondsSince(aiStart)}s]`);

      const msg = res.choices[0].message;
      const assistantMsg = { role: "assistant", content: msg.content ?? "" };
      if (msg.tool_calls?.length) assistantMsg.tool_calls = msg.tool_calls;
      messages.push(assistantMsg);

      if (!msg.tool_calls?.length) {
        // FIX: the AI gave up with plain text while a file chooser is still open.
        // Remove that answer and tell it to call browser_file_upload instead of stopping.
        if (fileChooserOpen && nudges < 2) {
          nudges++;
          messages.pop(); // remove the refusal so the AI does not copy it
          messages.push({
            role: "user",
            content:
              "A file chooser is open in the browser. You CAN upload local files. " +
              "If you don't know the file's full path, call find_file first. " +
              "Then call browser_file_upload with paths set to the full path. " +
              "Do not ask me to select the file myself.",
          });
          console.log("[client] File chooser still open: telling the AI to call browser_file_upload");
          continue;
        }
        console.log("\nAI:", msg.content);
        finished = true;
        break;
      }

      for (const call of msg.tool_calls) {
        const name = call.function.name;
        const rawArgs = call.function.arguments || "{}";
        const garbled = rawArgs.length > MAX_ARGUMENT_CHARS;

        console.log(`\n[AI chose tool] ${name}`);
        console.log(`[arguments]     ${garbled ? `(garbled, ${rawArgs.length} chars, not shown)` : rawArgs}`);
        // Keep garbled text out of the chat history, so the AI does not copy it again
        if (garbled) call.function.arguments = "{}";

        const entry = toolMap[name];
        const toolStart = Date.now();
        let output;
        let args = {};

        if (garbled) {
          output =
            "ERROR: your tool arguments were garbled (far too long). Call the tool again with a short, clean path." +
            PATH_HINT +
            " Never type backslashes.";
        } else if (!entry) {
          output = "ERROR: there is no tool called " + name;
        } else {
          try {
            args = normalizeArgs(JSON.parse(rawArgs));
          } catch (err) {
            output = "ERROR: could not read the tool arguments: " + err.message;
          }
          // Check first, so you are never asked about a call that is going to fail anyway
          if (output === undefined && entry.check) output = entry.check(args) ?? undefined;
        }

        if (output === undefined) {
          const allowed = !entry.confirm || autoAllow.has(name) || (await approve(name, args));
          if (!allowed) {
            output = "The user did NOT allow this action. Do not try it again. Tell the user what you wanted to do.";
          } else {
            // Give the app window focus first (like clicking it once), so a window on top cannot take the click
            if (name === "win_App" && typeof args.name === "string" && args.name.trim()) {
              focusTarget = args.name.trim();
            }
            if (FOCUS_BEFORE.has(name) && focusTarget) {
              const f = await focusWindow({ query: focusTarget });
              if (f === "OK") console.log(`[focus] "${focusTarget}" brought to the front`);
              else if (f === "FAILED") console.log(`[focus] could not bring "${focusTarget}" to the front, continuing anyway`);
            }

            // FIX (maximize): if the browser window is already open, maximize it BEFORE the browser tool runs
            if (name.startsWith("browser_") && name !== "browser_close") await maximizeBrowserWindow();

            try {
              if (name === READ_TEXT_TOOL && BINARY_EXTENSIONS.test(String(args.path ?? ""))) {
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

                // FIX: remember if Playwright says a file chooser is open.
                // Checked on the full MCP result (before it is shortened). The marker disappears
                // from the results once the upload worked, so this flips back to false by itself.
                if (name.startsWith("browser_")) fileChooserOpen = output.includes("[File chooser]");

                if (name === READ_TEXT_TOOL && looksBinary(output)) {
                  output = BINARY_MESSAGE;
                } else if (result.isError) {
                  output = "ERROR: " + output;
                }
              }
            } catch (err) {
              output = "ERROR: " + err.message;
            }
          }
        }

        // FIX: "Typed ..." / "Clicked ..." only means the input was sent. Tell the AI to check before claiming success.
        if (INPUT_TOOLS.has(name) && !output.startsWith("ERROR")) {
          output += "\n(This only means the input was sent, not that it worked. Call win_Snapshot to check before saying it is done.)";
        }

        // FIX (maximize): the browser window only exists AFTER the first browser tool (browser_navigate opens it),
        // so if it was not maximized before, it is maximized right after. If the AI closes the browser,
        // the state is reset, so a browser opened again later in the same command is maximized again.
        if (name === "browser_close") {
          browserMaximized = false;
          browserRestoreNeeded = false;
        } else if (name.startsWith("browser_") && !browserMaximized && !output.startsWith("ERROR")) {
          await maximizeBrowserWindow();
        }

        // FIX (WhatsApp delete): after a browser click/type/key press, attach the page as it is RIGHT NOW,
        // so the AI sees a confirmation dialog instead of guessing that the action worked.
        if (BROWSER_ACTIONS.has(name) && !output.startsWith("ERROR") && clients.browser) {
          try {
            await new Promise((r) => setTimeout(r, 600)); // let the page react
            const snap = await clients.browser.callTool(
              { name: "browser_snapshot", arguments: {} },
              undefined,
              { timeout: TOOL_TIMEOUT_MS }
            );
            if (!snap.isError) {
              const snapText = (snap.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
              output += "\n\n[PAGE RIGHT AFTER THIS ACTION. Judge success ONLY from this:]\n" + snapText;
            }
          } catch {}
        }

        // FIX (WhatsApp delete): stop the AI from retrying the same stale ref over and over
        if (name.startsWith("browser_") && output.startsWith("ERROR")) {
          output +=
            "\n(Do NOT repeat this same call. Take a new browser_snapshot. If a dialog or popup is open, " +
            "only elements inside it can be clicked, so use a ref from the dialog.)";
        }

        // FIX (link click): remember the current page URL and the latest snapshot (full text, before it is shortened)
        if (name.startsWith("browser_")) trackPage(output);

        // FIX: snapshots get a bigger limit, so the element list is not cut out of the middle
        const limit = name === "win_Snapshot" ? MAX_SNAPSHOT_OUTPUT : MAX_TOOL_OUTPUT;
        const fullLength = output.length;
        output = shorten(output, limit);
        console.log(
          `[tool took ${secondsSince(toolStart)}s, ${fullLength} chars` +
            `${fullLength > limit ? ", shortened for the AI" : ""}]`
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
  } finally {
    // FIX (maximize): the command is finished (or failed), so put the browser window back to its normal size
    await restoreBrowserWindow();
  }
}

rl.close();
for (const c of Object.values(clients)) await c.close();
process.exit(0);