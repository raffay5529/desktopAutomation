// agent-cmd.js - the AI controls your PC by calling Windows cmd commands. No MCP server needed.
// Run:     node --env-file=.env agent-cmd.js
// Install: npm install openai   (in this folder)

import OpenAI from "openai";
import readline from "readline/promises";
import { exec } from "node:child_process";

const MODEL = "mistralai/mistral-large-2512";
const ASK_FIRST = false; // ask y/n before every cmd command. Set to true to confirm each one.
const TIMEOUT_MS = 30000; // a command running longer than this is killed

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

// ---- The one tool the AI can call ----
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
];

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
        console.log(`\n[cmd] ${args.command ?? call.function.arguments}`);

        let output;
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
        console.log("[result]", output.slice(0, 500));
        messages.push({ role: "tool", tool_call_id: call.id, content: output.slice(0, 20000) });
      }
    }
  } catch (err) {
    console.error("\nAI request failed:", err.message);
    messages.length = turnStart; // drop the broken turn
  }
}

process.exit(0);