// index.js  (basic version, no AI yet)
// Opens Chrome, then waits for you to type commands in the terminal.
//
// Setup:
//   npm init -y
//   npm pkg set type=module
//   npm install playwright
// Run:
//   node index.js

import { chromium } from "playwright";
import readline from "readline/promises";

// Open your installed Chrome with a visible window
const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newPage();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('Chrome is open. Try "find youtube" or "search lofi music". Type "exit" to quit.');

while (true) {
  const text = (await rl.question("\nYou: ")).trim();
  if (!text) continue;
  if (text.toLowerCase() === "exit") break;

  // For now a simple if/else decides what to do.
  // Later, the AI will make this decision instead.
  if (text.toLowerCase().includes("youtube")) {
    await page.goto("https://www.youtube.com");
    console.log("Opened YouTube");
  } else {
    await page.goto("https://www.google.com/search?q=" + encodeURIComponent(text));
    console.log("Searched Google for:", text);
  }
}

await browser.close();
rl.close();