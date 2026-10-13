// test.js
// Playwright, persistent profile. Goes to a URL and saves the image to <Downloads>/mcp
// with the correct extension (what "Save image as" would do, but without the native Windows
// dialog, which Playwright cannot see or click).
//
// The URL can be:
//   - a direct image URL: that image is saved
//   - a web page, like a ChatGPT conversation: it waits for the image(s) on the page and saves the
//     LAST big image (or every big image with --all). You must be signed in to that site in this profile.
//
// Run (the URL is optional, the default is set below):
//   node test.js
//   node test.js "https://chatgpt.com/c/..."          <- keep the quotes in PowerShell, because of the &
//   node test.js --all                                <- save every image on the page, not only the last
//   node test.js --login                              <- ONCE: plain Chrome on this profile, to sign in (see below)
//
// Google / ChatGPT sign-in: Google blocks browsers that Playwright starts with its default
// automation flags. Two changes:
//   1. The launch options below remove those flags (--enable-automation) and hide navigator.webdriver.
//   2. If Google still blocks the sign-in, run this ONCE:
//        node test.js --login
//      It opens normal Chrome (no Playwright at all) on the SAME profile folder. Sign in there,
//      close that Chrome window, then run "node test.js" as usual. The login is kept in the profile.
//
// Optional (more detail):
//   $env:DEBUG="pw:browser"; node test.js

const USE_REAL_CHROME = true; // true = your installed Google Chrome, false = bundled Chromium
const CLOSE_WHEN_DONE = false; // true = close the browser right after saving the image

const LOGIN_MODE = process.argv.includes("--login");
const SAVE_ALL = process.argv.includes("--all");

// When the URL is a web page: how long to wait for the image to show up (this also gives you time to sign in)
const WAIT_SECONDS = 120;
// Images smaller than this (in pixels, width and height) are ignored: avatars, icons, logos
const MIN_IMAGE_SIZE = 256;

// The URL is the first argument that is not a flag (so "node test.js --login" does not treat --login as a URL)
const TARGET_URL =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  "https://chatgpt.com/c/6accbcb1-c618-83ee-b267-e9cfaa8351ab";

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

  // ---- --login mode. Plain Chrome on the same profile, so Google does not see any automation ----
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
    console.log("Sign in there (for example to chatgpt.com), then CLOSE that Chrome window. (Close any other test.js Chrome first.)");

    const child = spawn(
      chromeExe,
      [`--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", "https://chatgpt.com/"],
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

  // Writes the bytes to <Downloads>/mcp with the real extension. Never overwrites.
  function writeImage(body, contentType, baseName) {
    const ext = detectImageExtFromBuffer(body) ?? extFromContentType(contentType);
    if (!ext) {
      throw new Error(`this is not an image (content-type: ${contentType || "unknown"}, ${body.length} bytes)`);
    }
    const savePath = uniquePath(path.join(saveDir, baseName + ext));
    fs.writeFileSync(savePath, body);
    return { savePath, bytes: body.length, ext };
  }

  // ---- Direct image URL ----
  // If the page cannot give the bytes (a redirect, a cache hit, a forced download), it asks for the
  // image directly with the browser's own cookies instead.
  async function saveDirectImage(context, response, url) {
    let body = null;
    let contentType = "";

    try {
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

    return [writeImage(body, contentType, baseNameFromUrl(url))];
  }

  // ---- Web page (for example a ChatGPT conversation) ----
  // Finds the big images on the page. Each one is tagged with data-pw-img, so it can be found again later.
  async function findPageImages(page) {
    try {
      return await page.evaluate((minSize) => {
        document.querySelectorAll("[data-pw-img]").forEach((e) => e.removeAttribute("data-pw-img"));
        const found = [];
        for (const img of document.querySelectorAll("img")) {
          const src = img.currentSrc || img.src;
          if (!src || !img.complete) continue;
          if (img.naturalWidth < minSize || img.naturalHeight < minSize) continue;
          const n = found.length;
          img.setAttribute("data-pw-img", String(n));
          found.push({ n, src, width: img.naturalWidth, height: img.naturalHeight });
        }
        return found;
      }, MIN_IMAGE_SIZE);
    } catch {
      return []; // the page is navigating (for example while you sign in), try again on the next round
    }
  }

  // Waits until a big image is on the page. If the site shows a sign-in page, sign in in the browser window.
  async function waitForPageImages(page) {
    const start = Date.now();
    const deadline = start + WAIT_SECONDS * 1000;
    let told = false;

    while (Date.now() < deadline) {
      const images = await findPageImages(page);
      if (images.length > 0) {
        await page.waitForTimeout(1500); // let images that are still loading appear too
        const again = await findPageImages(page);
        return again.length ? again : images;
      }
      if (!told && Date.now() - start > 5000) {
        console.log(
          `[info] no image on the page yet. If you see a sign-in page or a "verify you are human" check, ` +
            `do it in the browser window (waiting up to ${WAIT_SECONDS}s)...`
        );
        told = true;
      }
      await page.waitForTimeout(1000);
    }
    return [];
  }

  // Gets the bytes of one image. Three ways, from best to last resort:
  //   1. ask for the image URL with the browser's own cookies (the original file)
  //   2. fetch it from inside the page (works for blob: and data: URLs too)
  //   3. take a screenshot of the image element (not the original file, but always works)
  async function downloadPageImage(context, page, img) {
    try {
      const res = await context.request.get(img.src);
      if (res.ok()) {
        const body = await res.body();
        if (body.length > 0) return { body, contentType: res.headers()["content-type"] ?? "", note: "" };
      }
    } catch {}

    try {
      const r = await page.evaluate(async (src) => {
        const res = await fetch(src, { credentials: "include" });
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { b64: btoa(bin), type: res.headers.get("content-type") || "" };
      }, img.src);
      if (r) return { body: Buffer.from(r.b64, "base64"), contentType: r.type, note: "" };
    } catch {}

    console.log("[info] could not download the original file, taking a screenshot of the image instead");
    const shot = await page.locator(`img[data-pw-img="${img.n}"]`).screenshot({ type: "png" });
    return { body: shot, contentType: "image/png", note: ", screenshot of the image, not the original file" };
  }

  async function savePageImages(context, page) {
    console.log("[info] this is a web page, looking for the image on it...");
    const images = await waitForPageImages(page);
    if (images.length === 0) {
      throw new Error(
        `no image bigger than ${MIN_IMAGE_SIZE}px was found after ${WAIT_SECONDS}s. ` +
          "If the site asked you to sign in, sign in in the browser window (or run: node test.js --login) and run this again."
      );
    }

    const chosen = SAVE_ALL ? images : [images[images.length - 1]];
    console.log(`[info] found ${images.length} image(s), saving ${chosen.length}`);

    const saved = [];
    for (const img of chosen) {
      const { body, contentType, note } = await downloadPageImage(context, page, img);
      const result = writeImage(body, contentType, SAVE_ALL ? `image-${img.n + 1}` : "image");
      saved.push({ ...result, note });
    }
    return saved;
  }

  // Goes to the URL. An image is saved directly, a web page is searched for its image(s).
  async function saveFromUrl(context, page, url) {
    let response = null;
    try {
      response = await page.goto(url, { waitUntil: "load", timeout: 60000 });
    } catch (err) {
      console.log("[info] could not open it as a page, asking for it directly:", err.message);
    }

    const contentType = response ? response.headers()["content-type"] ?? "" : "";
    if (response && /text\/html/i.test(contentType)) return savePageImages(context, page);
    return saveDirectImage(context, response, url);
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

  // Playwright adds --enable-automation by default, which sets navigator.webdriver
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

  console.log(`${USE_REAL_CHROME ? "Chrome" : "Chromium"} is open. Going to:\n  ${TARGET_URL}`);
  try {
    const saved = await saveFromUrl(context, page, TARGET_URL);
    for (const s of saved) {
      console.log(`Saved image to: ${s.savePath}  (${s.bytes} bytes, ${s.ext}${s.note ?? ""})`);
    }
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