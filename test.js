// test.js
// Bundled Playwright Chromium, persistent profile, downloads saved to the Downloads folder
// with the correct image extension. Includes diagnostics that print WHY the
// browser closes after "Save image as".
//
// Run:
//   node test.js
// Optional (more detail):
//   $env:DEBUG="pw:browser"; node test.js

const USE_REAL_CHROME = true; // set to true to test with your installed Google Chrome

// If anything throws, print it instead of dying silently
process.on("uncaughtException", (err) => console.log("[!] uncaughtException:", err));
process.on("unhandledRejection", (err) => console.log("[!] unhandledRejection:", err));
process.on("exit", (code) => console.log("[exit] script ending with code", code));

(async () => {
  const { chromium } = await import("playwright");
  const path = await import("path");
  const os = await import("os");
  const fs = await import("fs");

  const profileDir = path.join(
    os.homedir(),
    "ai-workspace",
    USE_REAL_CHROME ? "test-chrome-profile" : "test-chromium-profile"
  );

  const downloadsCandidates = [
    path.join(os.homedir(), "Downloads"),
    path.join(os.homedir(), "OneDrive", "Downloads"),
  ];
  const downloads = downloadsCandidates.find((p) => fs.existsSync(p)) ?? os.homedir();

  // Save folder: <Downloads>/mcp (uses it if it already exists, creates it if not)
  const saveDir = path.join(downloads, "mcp");
  fs.mkdirSync(saveDir, { recursive: true });

  function uniquePath(p) {
    if (!fs.existsSync(p)) return p;
    const { dir, name, ext } = path.parse(p);
    for (let i = 2; i < 1000; i++) {
      const candidate = path.join(dir, `${name} (${i})${ext}`);
      if (!fs.existsSync(candidate)) return candidate;
    }
    return p;
  }

  function detectImageExt(filePath) {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
    if (buf.slice(0, 4).toString("ascii") === "GIF8") return ".gif";
    if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return ".webp";
    if (buf.slice(0, 2).toString("ascii") === "BM") return ".bmp";
    if (buf.slice(4, 12).toString("ascii") === "ftypavif") return ".avif";
    return null;
  }

  function watchPage(page) {
    console.log("[info] page opened:", page.url() || "(blank)");
    page.on("close", () => console.log("[info] a tab/page CLOSED"));
    page.on("crash", () => console.log("[!] a page CRASHED"));

    page.on("download", async (download) => {
      console.log("[info] download started:", download.suggestedFilename());
      const tmp = path.join(os.tmpdir(), `pw-download-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      try {
        await download.saveAs(tmp);

        const suggested = download.suggestedFilename();
        const { name, ext } = path.parse(suggested);
        const realExt = detectImageExt(tmp);
        const finalName = realExt ? name + realExt : suggested;

        const savePath = uniquePath(path.join(saveDir, finalName));
        fs.copyFileSync(tmp, savePath);
        console.log("Saved download to:", savePath);
        if (realExt && realExt !== ext.toLowerCase()) {
          console.log(`  (extension fixed: ${ext || "none"} -> ${realExt})`);
        }
      } catch (err) {
        console.log("Could not save download:", err.message);
      } finally {
        try { fs.unlinkSync(tmp); } catch {}
      }
    });
  }

  const launchOptions = {
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
    acceptDownloads: true,
  };
  if (USE_REAL_CHROME) launchOptions.channel = "chrome";

  const context = await chromium.launchPersistentContext(profileDir, launchOptions);

  const browser = context.browser();
  if (browser) {
    browser.on("disconnected", () => console.log("[!] browser process DISCONNECTED (closed or crashed)"));
  }

  context.pages().forEach(watchPage);
  context.on("page", watchPage);

  context.on("close", () => {
    console.log("[!] browser context CLOSED. Exiting.");
    process.exit(0);
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://www.google.com");

  console.log(`${USE_REAL_CHROME ? "Chrome" : "Chromium"} is open. Press Ctrl+C here to close it.`);

  process.on("SIGINT", async () => {
    await context.close();
    process.exit(0);
  });
})();