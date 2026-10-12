// test.js
// Playwright, persistent profile. Opens an image URL and saves the image to
// <Downloads>/mcp with the correct extension (what "Save image as" would do,
// but without the native Windows dialog, which Playwright cannot see or click).
//
// Run (the URL is optional, the default is set below):
//   node test.js
//   node test.js "https://example.com/some-image"     <- keep the quotes in PowerShell, because of the &
//
// FIX (Google "Couldn't sign you in"): Google blocks browsers that Playwright starts with its default
// automation flags. Two changes:
//   1. The launch options below remove those flags (--enable-automation) and hide navigator.webdriver.
//   2. If Google still blocks the sign-in, run this ONCE:
//        node test.js --login
//      It opens normal Chrome (no Playwright at all) on the SAME profile folder. Sign in to Google there,
//      close that Chrome window, then run "node test.js" as usual. The login is kept in the profile.
//
// Optional (more detail):
//   $env:DEBUG="pw:browser"; node test.js

const USE_REAL_CHROME = true; // true = your installed Google Chrome, false = bundled Chromium
const CLOSE_WHEN_DONE = false; // true = close the browser right after saving the image

const LOGIN_MODE = process.argv.includes("--login");

// The URL is the first argument that is not a flag (so "node test.js --login" does not treat --login as a URL)
const IMAGE_URL =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSQbPpGOJQmq-W33u_yPhqGsBNEsSzUT7nZ-chbtowZg&s=10";

// If anything throws, print it instead of dying silently
process.on("uncaughtException", (err) => console.log("[!] uncaughtException:", err));
process.on("unhandledRejection", (err) => console.log("[!] unhandledRejection:", err));
process.on("exit", (code) => console.log("[exit] script ending with code", code));

(async () => {
  const path = await import("path");
  const os = await import("os");
  const fs = await import("fs");

  const profileDir = path.join(
    os.homedir(),
    "ai-workspace",
    USE_REAL_CHROME ? "test-chrome-profile" : "test-chromium-profile"
  );

  // ---- FIX: --login mode. Plain Chrome on the same profile, so Google does not see any automation ----
  if (LOGIN_MODE) {
    if (!USE_REAL_CHROME) {
      console.log("--login needs USE_REAL_CHROME = true (it opens your installed Google Chrome).");
      process.exit(1);
    }

    const chromeCandidates = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env["LOCALAPPDATA"]]
      .filter(Boolean)
      .map((base) => path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
    const chromeExe = chromeCandidates.find((p) => fs.existsSync(p));
    if (!chromeExe) {
      console.log("Could not find chrome.exe in:\n  " + chromeCandidates.join("\n  "));
      process.exit(1);
    }

    fs.mkdirSync(profileDir, { recursive: true });
    const { spawn } = await import("child_process");

    console.log("Opening normal Chrome on the profile:\n  " + profileDir);
    console.log("Sign in to Google there, then CLOSE that Chrome window. (Close any other test.js Chrome first.)");

    const child = spawn(
      chromeExe,
      [`--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", "https://accounts.google.com/"],
      { stdio: "ignore" }
    );
    await new Promise((resolve) => child.on("exit", resolve));

    console.log("Chrome closed. Now run:  node test.js");
    process.exit(0);
  }

  const { chromium } = await import("playwright");

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

  // Looks at the first bytes of the data to find the real image type
  function detectImageExtFromBuffer(buf) {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
    if (buf.subarray(0, 4).toString("ascii") === "GIF8") return ".gif";
    if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return ".webp";
    if (buf.subarray(0, 2).toString("ascii") === "BM") return ".bmp";
    if (buf.subarray(4, 12).toString("ascii") === "ftypavif") return ".avif";
    return null;
  }

  function detectImageExt(filePath) {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return detectImageExtFromBuffer(buf);
  }

  // Used only when the first bytes are not a known format (for example SVG, which is text)
  function extFromContentType(contentType) {
    const t = String(contentType).split(";")[0].trim().toLowerCase();
    const map = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/bmp": ".bmp",
      "image/avif": ".avif",
      "image/svg+xml": ".svg",
      "image/x-icon": ".ico",
      "image/vnd.microsoft.icon": ".ico",
    };
    return map[t] ?? null;
  }

  // File name without extension: the name from the URL if it has an image ending, otherwise "image"
  function baseNameFromUrl(url) {
    try {
      const parsed = path.parse(new URL(url).pathname);
      if (/^\.(jpe?g|png|gif|webp|bmp|avif|svg|ico)$/i.test(parsed.ext)) {
        const clean = parsed.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
        if (clean) return clean;
      }
    } catch {}
    return "image";
  }

  // Opens the image in the tab (so you see it, like when you go to it by hand) and saves it.
  // If the page cannot give the bytes (a redirect, a cache hit, a forced download), it asks for the
  // image directly with the browser's own cookies instead.
  async function saveImage(context, page, url) {
    let body = null;
    let contentType = "";

    try {
      const response = await page.goto(url, { waitUntil: "load" });
      if (response && response.ok()) {
        contentType = response.headers()["content-type"] ?? "";
        body = await response.body();
      }
    } catch (err) {
      console.log("[info] could not read the image from the page, asking for it directly:", err.message);
    }

    if (!body || body.length === 0) {
      const res = await context.request.get(url);
      if (!res.ok()) throw new Error(`the server answered HTTP ${res.status()} for ${url}`);
      contentType = res.headers()["content-type"] ?? "";
      body = await res.body();
    }

    const ext = detectImageExtFromBuffer(body) ?? extFromContentType(contentType);
    if (!ext) {
      throw new Error(`this is not an image (content-type: ${contentType || "unknown"}, ${body.length} bytes)`);
    }

    const savePath = uniquePath(path.join(saveDir, baseNameFromUrl(url) + ext));
    fs.writeFileSync(savePath, body);
    return { savePath, bytes: body.length, ext };
  }

  // Still active: if you save something by hand and Chrome reports a download, it is fixed and copied here too
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

  // FIX (Google sign-in): Playwright adds --enable-automation by default, which sets navigator.webdriver
  // and shows the "controlled by automated software" bar. Google reads that and refuses the sign-in.
  // ignoreDefaultArgs removes that flag, and AutomationControlled hides the webdriver signal.
  const launchOptions = {
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
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

  console.log(`${USE_REAL_CHROME ? "Chrome" : "Chromium"} is open. Going to the image:\n  ${IMAGE_URL}`);
  try {
    const { savePath, bytes, ext } = await saveImage(context, page, IMAGE_URL);
    console.log(`Saved image to: ${savePath}  (${bytes} bytes, ${ext})`);
  } catch (err) {
    console.log("Could not save the image:", err.message);
  }

  if (CLOSE_WHEN_DONE) {
    await context.close();
    process.exit(0);
  }

  console.log("Press Ctrl+C here to close the browser.");

  process.on("SIGINT", async () => {
    await context.close();
    process.exit(0);
  });
})();