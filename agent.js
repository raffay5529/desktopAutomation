// agent-cmd.js - the AI controls your PC by calling Windows cmd commands. No MCP server needed.
// (Word documents are the one exception: they use the python Word MCP server, started automatically below.)
// Run:     node --env-file=.env agent-cmd.js
// Install: npm install openai @modelcontextprotocol/sdk   (in this folder)

import OpenAI from "openai";
import readline from "readline/promises";
import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as paint from "./paint.js"; // drawing engine (made by join.js from P1-P4)

const MODEL = "mistralai/mistral-large-2512";
const ASK_FIRST = false; // ask y/n before every cmd command. Set to true to confirm each one.
const TIMEOUT_MS = 30000; // a command running longer than this is killed

// Word MCP server (python). This is the folder where you run: python -m word_document_server.main
const WORD_MCP_DIR = "C:\\Users\\HP\\Desktop\\desktopAutomation\\python-mcpWord\\Office-Word-MCP-Server";
const WORD_MCP_PYTHON = "python";
const DOCS_DIR = path.join(os.homedir(), "Desktop"); // Word files are saved here

// Full drawing command list the AI reads before it draws.
const PAINT_HELP =
  "IMPORTANT: the example scripts below only show the style. Draw ONLY what the user asked for in this chat. Never draw an example (rocket, kid, house...) unless the user asked for exactly that.\n\n" +
  paint.PAINT_HELP + (paint.PAINT_EXTRA_HELP ?? "");
let helpRead = false; // the AI must call paint_help once before its first draw

// Light safety net: refuse the most destructive commands outright.
const BLOCKED = /^\s*(format|diskpart|bcdedit)\b/i;

// Never allow killing explorer.exe (it is the taskbar and desktop). Blocks any command that has both
// the word "explorer" and a kill word in it.
const KILL_WORDS = /taskkill|stop-process|\bkill\b|wmic|pskill|terminate/i;
const EXPLORER = /explorer/i;

if (!process.env.XKIRO_API_KEY) {
  console.error("XKIRO_API_KEY is not set. Run: node --env-file=.env agent-cmd.js");
  process.exit(1);
}
const ai = new OpenAI({ apiKey: process.env.XKIRO_API_KEY, baseURL: "https://api.xkiro.com/v1" });

// ---- The tools the AI can call ----
const aiTools = [
  {
    type: "function",
    function: {
      name: "run_cmd",
      description:
        "Run one Windows cmd.exe command line and return its exit code, stdout and stderr. " +
        "You can chain commands with & or &&.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The cmd command to run, e.g. start \"\" calc.exe" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "paint_help",
      description:
        "Returns the full list of drawing commands and rules. Call it ONCE, before your first draw in this chat, and read it carefully.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "draw",
      description:
        "Draw a picture from a script and open it in Microsoft Paint. The script has ONE drawing command per line " +
        "(for example: sky day / sun 700 90 60 / grass 470 / house 270 290 260 190). " +
        "Use only commands from paint_help. Send the WHOLE script in one call.",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", description: "The drawing script, one command per line (use real new lines)." },
        },
        required: ["script"],
      },
    },
  },
];

// ---- Word MCP server: start it and add its tools to the list above ----
const mcpToolNames = new Set(); // names of the tools that belong to the Word server
let wordMcp = null;
let wordMcpStderr = "";
try {
  const env = { ...process.env, PYTHONUNBUFFERED: "1" };
  delete env.XKIRO_API_KEY; // the python server does not need the API key
  const transport = new StdioClientTransport({
    command: WORD_MCP_PYTHON,
    args: ["-m", "word_document_server.main"],
    cwd: WORD_MCP_DIR,
    env,
    stderr: "pipe", // keeps the FastMCP banner out of this console
  });
  transport.stderr?.on("data", (d) => {
    wordMcpStderr = (wordMcpStderr + d).slice(-2000);
  });
  wordMcp = new Client({ name: "agent-cmd", version: "1.0.0" });
  await wordMcp.connect(transport);
  const { tools } = await wordMcp.listTools();
  for (const t of tools) {
    mcpToolNames.add(t.name);
    aiTools.push({
      type: "function",
      function: {
        name: t.name,
        description: (t.description ?? t.name).slice(0, 1000),
        parameters: t.inputSchema ?? { type: "object", properties: {} },
      },
    });
  }
  console.log(`Word MCP server connected (${tools.length} tools).`);
} catch (err) {
  console.error("Word MCP server could not start:", err.message);
  if (wordMcpStderr.trim()) console.error(wordMcpStderr.trim());
  console.error("Word tools are disabled. Everything else still works.");
  wordMcp = null;
}

// The AI gives a short file name like report.docx. Make it a full path on the Desktop so we always know where the file is.
function fixWordPaths(value, key = "") {
  if (typeof value === "string") {
    return /file|path/i.test(key) && !path.isAbsolute(value) ? path.join(DOCS_DIR, value) : value;
  }
  if (Array.isArray(value)) return value.map((v) => fixWordPaths(v, key));
  return value;
}

function runCmd(command) {
  return new Promise((resolve) => {
    // chcp 65001 makes cmd print UTF-8 so non-English text is not garbled
    exec(
      "chcp 65001 >nul & " + command,
      { shell: "cmd.exe", timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        let out = stdout?.trim() ?? "";
        if (stderr?.trim()) out += (out ? "\n" : "") + "STDERR: " + stderr.trim();
        const code = err ? (err.killed ? "TIMEOUT (command took too long)" : err.code) : 0;
        resolve(`exit_code: ${code}\n${out || "(no output)"}`);
      }
    );
  });
}

// ---- Chat ----
const messages = [
  {
    role: "system",
    content:
      "You control the user's Windows computer by calling the run_cmd tool, which runs a cmd.exe command. " +
      "When the user asks for something, call the tool instead of describing what you would do.\n\n" +
      "RULES:\n" +
      "- Only say something worked if the tool output proves it. If a command fails, finds nothing, or prints an error, " +
      "say exactly that.\n" +
      "- Open an app with: start \"\" appname (for example: start \"\" calc.exe, start \"\" notepad.exe). " +
      "Always use start for GUI apps, otherwise the command waits until the app is closed.\n" +
      "- Open a website with: start \"\" https://example.com\n" +
      "- NEVER open an app you are not sure about by guessing or by its display name with spaces (like start \"\" \"Avast Secure Browser\"). " +
      "That fails and Windows shows a 'cannot find' popup with an error sound. " +
      "Only these names are safe to use directly with start: calc, notepad, mspaint, cmd, msedge (Microsoft Edge), chrome, firefox. " +
      "For every other app (Opera, Opera GX, Brave, Vivaldi, Avast Secure Browser, Telegram, Discord, VLC, Spotify and so on) FIND it first, in this order:\n" +
      "  1) Search the Start Menu shortcuts with ONE short keyword from the app name (like avast, opera, brave): " +
      "dir /s /b \"%ProgramData%\\Microsoft\\Windows\\Start Menu\\Programs\\*keyword*.lnk\" \"%AppData%\\Microsoft\\Windows\\Start Menu\\Programs\\*keyword*.lnk\" " +
      "Pick the shortcut that is the app itself (not an uninstaller or a help link) and open it with: start \"\" \"C:\\full\\path\\App Name.lnk\"\n" +
      "  2) If no shortcut is found, search for the program file: where /R \"C:\\Program Files\" *keyword*.exe " +
      "then do the same in \"C:\\Program Files (x86)\" and in \"%LocalAppData%\\Programs\". Open the right .exe with: start \"\" \"C:\\full\\path\\name.exe\"\n" +
      "  3) If nothing is found, say the app was not found. Never say it opened unless a command ran without an error.\n" +
      "- Program file names for taskkill: Edge msedge.exe, Opera opera.exe, Opera GX opera.exe, Brave brave.exe, Firefox firefox.exe, Avast Secure Browser AvastBrowser.exe.\n" +
      "- Close an app with: taskkill /F /IM name.exe. Calculator's process is CalculatorApp.exe " +
      "(or Calculator.exe on newer Windows). Notepad is notepad.exe, Chrome is chrome.exe.\n" +
      "- If you don't know the real process name, find it with: tasklist | findstr /I keyword. " +
      "Then run taskkill with the name you found. After killing, check again with tasklist | findstr /I keyword " +
      "and report CLOSED only if nothing is left.\n" +
      "- Bring an open window to the front and maximize it (works even if it is minimized) with this command. " +
      "Replace only the process name notepad. The number 3 maximizes (use 9 to restore normal size, 6 to minimize): " +
      "powershell -NoProfile -Command \"$p=Get-Process notepad | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; " +
      "Add-Type -Name W -Namespace N -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr h,int c); " +
      "[DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr h);'; " +
      "[N.W]::ShowWindow($p.MainWindowHandle,3); [N.W]::SetForegroundWindow($p.MainWindowHandle)\"\n" +
      "- If that prints a null error, the app has no window yet or the process name is wrong: find the name with tasklist | findstr /I keyword.\n" +
      "- Take a screenshot of the whole screen with this exact command. It saves a NEW timestamped file on the Desktop each time and prints the full path of the file it saved, " +
      "so always tell the user that exact path: " +
      "powershell -NoProfile -Command \"Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $f='%USERPROFILE%\\Desktop\\shot_' + (Get-Date -Format yyyyMMdd_HHmmss) + '.png'; $bmp.Save($f); $g.Dispose(); $bmp.Dispose(); Write-Output $f\"\n" +
      "- If the user gives a name for the screenshot (for example 'save it as abc' or 'name it abc'), use the SAME command but change ONLY the file name part: " +
      "replace '%USERPROFILE%\\Desktop\\shot_' + (Get-Date -Format yyyyMMdd_HHmmss) + '.png' with '%USERPROFILE%\\Desktop\\abc.png' (abc is the name the user gave). " +
      "Use only letters, numbers, spaces, dash and underscore in the name, and never add .png twice. " +
      "If the user gives no name, keep the default timestamped name shot_date_time.\n" +
      "- You cannot see the screenshot, you only get the saved file path. Never describe what is on the screen.\n" +
      "- TYPE IN CALCULATOR: when the user asks you to calculate, add, type or enter numbers in the Calculator, do NOT say you cannot. Use run_cmd. " +
      "The Calculator must already be open (if it is not, open it first with: start \"\" calc.exe). " +
      "Then type into it with this exact command. Change ONLY the text inside SendWait('...'). This example types 2+2 and presses Enter: " +
      "powershell -NoProfile -Command \"Add-Type -AssemblyName Microsoft.VisualBasic; Add-Type -AssemblyName System.Windows.Forms; [Microsoft.VisualBasic.Interaction]::AppActivate('Calculator'); Start-Sleep -Milliseconds 500; [System.Windows.Forms.SendKeys]::SendWait('2{+}2{ENTER}')\"\n" +
      "  Rules for the text inside SendWait: digits, minus, * / and the decimal point are written as they are. " +
      "The characters + ^ % ~ ( ) have a special meaning, so ALWAYS put them in braces: write {+} for plus. " +
      "Use {ENTER} to get the result (the equals key), {ESC} to clear, {BACKSPACE} to delete one digit. " +
      "To type a whole sum in one command, write it all in one SendWait, for example 12{+}30{ENTER}.\n" +
      "  If it prints an error like 'AppActivate' cannot find the window, make sure the Calculator is open and try again once. " +
      "You cannot see the Calculator screen, so only say the keys were typed. Never claim you read the result from the screen.\n" +
      "- DRAW IN PAINT: when the user asks you to draw, paint, sketch or make a picture, diagram, flowchart, logo, scene, chart, flag or illustration of ANYTHING " +
      "(and open it in Paint), NEVER write your own PowerShell or System.Drawing drawing and NEVER use run_cmd for it. Use the two drawing tools:\n" +
      "  1) If you have not done it yet in this chat, call paint_help ONCE and read the whole command list. You must do this before your first draw.\n" +
      "  2) Write ONE script, one command per line, using ONLY the commands from the list, and call draw ONCE with the whole script. " +
      "Prefer the ready-made commands (person, face, cat, house, tree, rocket, countryflag ...) over building things from small shapes. " +
      "Draw background first, then far things, ground, scenery, the main subject BIG in the middle, small details, text last. " +
      "Every new picture needs a NEW script that fits what the user asked for now.\n" +
      "  3) If draw answers NOT DRAWN with a list of problems, fix ONLY the lines it names and call draw again with the FULL corrected script. " +
      "If it says some lines were skipped, tell the user honestly that parts were skipped.\n" +
      "  4) When draw answers OK, tell the user the saved path and what you drew in one or two sentences. " +
      "You cannot see the picture, so never describe how it looks, only what you drew. Never say it opened unless draw said OK.\n" +
      "- WORD DOCUMENTS: when the user asks you to create, write or edit a Word document (.docx), use the Word tools " +
      "(create_document, add_heading, add_paragraph, add_table and so on), NOT run_cmd. " +
      "First call create_document, then add the content with the other Word tools. " +
      "Give only a short file name like report.docx (no folder): the program saves it on the Desktop. " +
      "Do NOT open the document yourself: the program opens it in Word automatically when you are done. " +
      "If a Word tool says the file is open in another program, tell the user to close Word and ask again. " +
      "You cannot see the document, so only say what you added and the file name.\n" +
      "- NEVER close File Explorer by killing explorer.exe (no taskkill, no Stop-Process, no other way). Explorer is the taskbar and the desktop, " +
      "so killing it makes the taskbar and icons disappear. If the user says close File Explorer, a folder window or This PC, " +
      "close ONLY the folder windows with this command: " +
      "powershell -NoProfile -Command \"(New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.Name -match 'Explorer' } | ForEach-Object { $_.Quit() }\"\n" +
      "- Use normal Windows tools: dir, type, copy, move, mkdir, echo, ipconfig, systeminfo and so on. " +
      "To write text to a file use: echo text > C:\\path\\file.txt\n" +
      "- Never kill explorer.exe, cmd.exe, node.exe or system processes. Never format drives or delete system folders.\n" +
      "- Judge by the printed output. exit_code 1 can just mean the last command found nothing.\n" +
      "- Reply in one or two short sentences when done.",
  },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("SIGINT", () => process.exit(0));

console.log('\nType what you want, e.g. "open calculator". Type "exit" to quit.');

while (true) {
  const text = (await rl.question("\nYou: ")).trim();
  if (!text) continue;
  if (text.toLowerCase() === "exit") break;

  const turnStart = messages.length;
  const helpBefore = helpRead;
  const createdDocs = new Set(); // Word files created during this turn (opened when the turn is over)
  messages.push({ role: "user", content: text });

  try {
    for (let round = 0; round < 15; round++) {
      const res = await ai.chat.completions.create({ model: MODEL, messages, tools: aiTools, temperature: 0.2 });
      const msg = res.choices[0].message;
      const reply = { role: "assistant", content: msg.content ?? "" };
      if (msg.tool_calls?.length) reply.tool_calls = msg.tool_calls;
      messages.push(reply);

      if (!msg.tool_calls?.length) {
        console.log("\nAI:", msg.content);
        break;
      }

      for (const call of msg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}

        let output;
        let keepFull = false; // true = do not cut this tool result (the paint help is long)

        if (call.function.name === "paint_help") {
          console.log("\n[paint_help] sending the command list to the AI");
          helpRead = true;
          keepFull = true;
          output = PAINT_HELP;
        } else if (call.function.name === "draw") {
          let script = args.script ?? args.commands ?? args.code;
          if (Array.isArray(script)) script = script.join("\n");
          const nLines = typeof script === "string" ? script.split("\n").filter((l) => l.trim()).length : 0;
          console.log(`\n[draw] script with ${nLines} lines`);
          if (!helpRead) {
            output = "ERROR: you have not read the command list yet. Call paint_help first, read it, then call draw.";
          } else if (typeof script !== "string" || !script.trim()) {
            output = "ERROR: call draw with a non-empty 'script' string (one drawing command per line).";
          } else {
            const r = await paint.drawPicture(script);
            output = r.message;
          }
        } else if (wordMcp && mcpToolNames.has(call.function.name)) {
          console.log(`\n[word] ${call.function.name} ${JSON.stringify(args).slice(0, 200)}`);
          try {
            for (const k of Object.keys(args)) args[k] = fixWordPaths(args[k], k);
            const r = await wordMcp.callTool({ name: call.function.name, arguments: args });
            const outText = (r.content ?? [])
              .map((c) => (c.type === "text" ? c.text : ""))
              .join("\n")
              .trim();
            output = r.isError ? "ERROR: " + outText : outText || "(no output)";
            if (!r.isError && call.function.name === "create_document" && typeof args.filename === "string") {
              createdDocs.add(/\.docx$/i.test(args.filename) ? args.filename : args.filename + ".docx");
            }
          } catch (err) {
            output = "ERROR: the Word tool failed: " + err.message;
          }
        } else {
          console.log(`\n[cmd] ${args.command ?? call.function.arguments}`);
          if (call.function.name !== "run_cmd" || typeof args.command !== "string" || !args.command.trim()) {
            output = "ERROR: call run_cmd with a non-empty 'command' string.";
          } else if (BLOCKED.test(args.command)) {
            output = "ERROR: that command is blocked for safety. Do not try it again.";
          } else if (EXPLORER.test(args.command) && KILL_WORDS.test(args.command)) {
            output =
              "ERROR: blocked. Never kill explorer.exe, it removes the taskbar and desktop. " +
              "To close only File Explorer windows use the Shell.Application Quit command from the rules. Do not try to kill explorer.";
          } else if (ASK_FIRST && (await rl.question("  Run it? (y/n) ")).trim().toLowerCase() !== "y") {
            output = "The user did NOT allow this. Do not try it again.";
          } else {
            output = await runCmd(args.command);
          }
        }
        console.log("[result]", keepFull ? `(${output.length} characters)` : output.slice(0, 500));
        messages.push({ role: "tool", tool_call_id: call.id, content: keepFull ? output : output.slice(0, 20000) });
      }
    }
  } catch (err) {
    console.error("\nAI request failed:", err.message);
    messages.length = turnStart; // drop the broken turn
    helpRead = helpBefore; // if the help text was in the dropped turn, the AI must ask for it again
  }

  // Open the Word files created in this turn. This runs after the AI is finished, because Word locks a file
  // while it is open, and the AI could not keep editing it.
  for (const file of createdDocs) {
    if (!fs.existsSync(file)) continue;
    console.log(`\n[open] ${file}`);
    await runCmd(`start "" "${file}"`);
  }
}

await wordMcp?.close().catch(() => {});
process.exit(0);