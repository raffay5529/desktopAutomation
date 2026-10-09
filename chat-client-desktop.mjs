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
const KEEP_FULL_TOOL_OUTPUTS = 2;
const TOOL_TIMEOUT_MS = 30_000; // a stuck tool fails after 30 seconds
const MAX_ARGUMENT_CHARS = 2000; // longer tool arguments are garbled: refused without asking you
const TEMPERATURE = 0.2; // lower = steadier tool calls
const CONFIRM_DELETE = true; // delete_path asks y/n. It uses the Recycle Bin, so false is fairly safe

const START_PAGE = "https://www.google.com"; // only used when the browser server is enabled below

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

// Want Documents or Downloads too? Add them here:
// path.join(os.homedir(), "Documents"), path.join(os.homedir(), "Downloads")
const FILE_FOLDERS = [WORKSPACE, ...DESKTOP_FOLDERS];

// ---- The MCP servers ----
// "only"    = the tools the AI gets (if fewer than half of them exist, it gets all tools instead)
// "never"   = tools the AI never gets, no matter what
// "confirm" = tools that ask you y/n before they run
const SERVERS = {
  // Desktop is the main target for now, so the browser is OFF. Set enabled: true when you move to Playwright.
  browser: {
    enabled: false,
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
    return (allowRoot && target === r) || target.startsWith(r + path.sep);
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

  for (const root of FILE_FOLDERS) walk(root, 0);
  return results;
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

const CLOSE_APP_SCRIPT = `
$q = [WildcardPattern]::Escape($env:CLOSE_QUERY)
$protected = @('explorer','WindowsTerminal','cmd','powershell','pwsh','conhost','OpenConsole','node','dwm','winlogon','csrss','svchost')
$found = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($protected -notcontains $_.ProcessName) -and ($_.ProcessName -like "*$q*" -or $_.MainWindowTitle -like "*$q*") })
foreach ($p in $found) {
  if ($p.CloseMainWindow()) { "CLOSED=" + $p.ProcessName + " | " + $p.MainWindowTitle } else { "FAILED=" + $p.ProcessName }
}
if ($found.Count -eq 0) { "NONE" }
`;

addLocalTool({
  name: "close_app",
  description:
    "Close an app window politely, like clicking its X, so an app with unsaved work shows its own save question. " +
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
    const r = await runPowerShell(CLOSE_APP_SCRIPT, { CLOSE_QUERY: q });
    if (!r.ok) return `ERROR: could not close: ${r.err || r.out}`;
    const closed = r.out.split(/\r?\n/).filter((l) => l.startsWith("CLOSED="));
    if (closed.length) {
      return (
        `Asked ${closed.length} window(s) to close:\n` +
        closed.map((l) => l.slice(7)).join("\n") +
        "\n(An app with unsaved work may still show a save question.)"
      );
    }
    return r.out.includes("FAILED=")
      ? "ERROR: the app did not accept the close request."
      : `No open window matching "${q}" was found. Nothing was closed.`;
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

if (clients.screen) {
  COMPUTER_HINTS.push(
    "Screen: the win_ tools control the Windows desktop (apps like Notepad, Word, Settings). " +
      "Call win_Snapshot first to see the open windows and their elements, then use the exact positions or labels " +
      "from the LATEST snapshot to click or type. Never guess coordinates. " +
      "After every click, type or shortcut, call win_Snapshot again to check what changed. " +
      "win_App opens or switches to an app by name only. If an app is still loading, call win_Wait and snapshot again. " +
      "Use win_Shortcut for keyboard shortcuts such as ctrl+s inside an app. " +
      "Do not use the win_ tools for file operations or for closing windows: the dedicated tools are faster and safer."
  );
}

const BROWSER_PROMPT = clients.browser
  ? " You also control a real Chrome browser. Open a site directly with browser_navigate when you know its URL. " +
    "The page comes back as a snapshot where every element has a ref. " +
    "Most action tools already return a fresh snapshot; call browser_snapshot only if the last result has none. " +
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

// Tools you answered "a" (always) for. They stop asking until you restart.
const autoAllow = new Set();

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
        temperature: TEMPERATURE,
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