import { exec } from "child_process";
import { mouse, Button, Point } from "@nut-tree-fork/nut-js";

// Remove nut-js's built-in delay between actions; we control timing ourselves
mouse.config.autoDelayMs = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Settings you can tweak -------------------------------------------
const CENTER_X = 600;           // horizontal center of the rocket (screen coords)
const CENTER_Y = 480;           // vertical center of the rocket body (clears Paint toolbar)
const SCALE = 1;                // 1 = ~420px tall rocket; try 0.8 or 1.2 to resize
const STEP_DELAY_MS = 6;        // delay between mouse points (lower = faster)
const PAINT_STARTUP_MS = 3500;  // time to let Paint open and maximize
const CLOSE_DELAY_MS = 2000;    // wait this long after drawing, then close Paint
// -----------------------------------------------------------------------

async function moveTo(x, y) {
  await mouse.setPosition(new Point(Math.round(x), Math.round(y)));
}

// Draw one continuous stroke through a list of points
async function drawStroke(points) {
  const [first, ...rest] = points;

  await moveTo(first.x, first.y);
  await sleep(50);
  await mouse.pressButton(Button.LEFT);
  await sleep(50);

  for (const p of rest) {
    await moveTo(p.x, p.y);
    await sleep(STEP_DELAY_MS);
  }

  await mouse.releaseButton(Button.LEFT);
  await sleep(100);
}

// ---- Geometry helpers --------------------------------------------------

// Rocket-local coordinates (0,0 = middle of the body, negative y = up)
// converted to screen coordinates
const P = (x, y) => ({ x: CENTER_X + x * SCALE, y: CENTER_Y + y * SCALE });

// Points along an arc (angles in degrees, 0 = right, 90 = down)
function arcPoints(cx, cy, radius, startDeg, endDeg, steps = 80) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    points.push({
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    });
  }
  return points;
}

// Evenly spaced points along a straight line
function linePoints(a, b, spacing = 6) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.round(dist / spacing));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  return points;
}

// Connect a list of corner points with straight segments
function polyline(corners) {
  const points = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const segment = linePoints(corners[i], corners[i + 1]);
    points.push(...(i === 0 ? segment : segment.slice(1)));
  }
  return points;
}

// Smooth quadratic Bezier curve from a to b, bent toward control point c
function curvePoints(a, c, b, steps = 30) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    });
  }
  return points;
}

// Full circle in rocket-local coordinates
function circle(x, y, r, steps = 60) {
  const c = P(x, y);
  return arcPoints(c.x, c.y, r * SCALE, 0, 360, steps);
}

// Solid-looking dot made of concentric circles
async function drawFilledDot(x, y, r) {
  for (let rr = r; rr > 0; rr -= 3) {
    await drawStroke(circle(x, y, rr, 40));
  }
}

// ---- The rocket --------------------------------------------------------

async function drawRocket() {
  // 1) Body: pointed nose cone curving into straight sides, flat bottom
  const nose = P(0, -220);
  const leftShoulder = P(-55, -100);
  const rightShoulder = P(55, -100);
  const leftBase = P(-55, 90);
  const rightBase = P(55, 90);

  await drawStroke([
    ...curvePoints(nose, P(-55, -170), leftShoulder),
    ...polyline([leftShoulder, leftBase, rightBase, rightShoulder]),
    ...curvePoints(rightShoulder, P(55, -170), nose),
  ]);

  // 2) Line where the nose cone meets the body
  await drawStroke(polyline([leftShoulder, rightShoulder]));

  // 3) Porthole window (double ring + solid center)
  await drawStroke(circle(0, -50, 30));
  await drawStroke(circle(0, -50, 22));
  await drawFilledDot(0, -50, 12);

  // 4) Decorative band around the lower body
  await drawStroke(polyline([P(-55, 40), P(55, 40)]));
  await drawStroke(polyline([P(-55, 55), P(55, 55)]));

  // 5) Side fins
  await drawStroke(
    polyline([P(-55, 10), P(-112, 95), P(-112, 135), P(-55, 90)])
  );
  await drawStroke(
    polyline([P(55, 10), P(112, 95), P(112, 135), P(55, 90)])
  );

  // 6) Engine nozzle
  await drawStroke(
    polyline([P(-30, 90), P(-38, 118), P(38, 118), P(30, 90)])
  );

  // 7) Outer flame
  await drawStroke([
    ...curvePoints(P(-30, 118), P(-42, 175), P(0, 210)),
    ...curvePoints(P(0, 210), P(42, 175), P(30, 118)),
  ]);

  // 8) Inner flame
  await drawStroke([
    ...curvePoints(P(-14, 118), P(-20, 150), P(0, 182)),
    ...curvePoints(P(0, 182), P(20, 150), P(14, 118)),
  ]);
}

async function main() {
  console.log("Opening Paint (maximized)...");
  // "start /max" launches the program with a maximized window
  exec('start "" /max mspaint.exe');
  await sleep(PAINT_STARTUP_MS);

  console.log("Drawing rocket...");
  await drawRocket();

  console.log("Drawing complete! Closing Paint in 2 seconds...");
  await sleep(CLOSE_DELAY_MS);

  // /F force-closes Paint so the "Save changes?" prompt doesn't block it
  exec("taskkill /IM mspaint.exe /F", (err) => {
    if (err) console.error("Could not close Paint:", err.message);
    else console.log("Paint closed.");
  });
}

main().catch(console.error);