// Take the game's screenshots via Chrome DevTools Protocol (CDP).
// The local Chrome build ignores --screenshot, so drive it over WebSocket.
// Reads shots.json, loads each shot URL on the local server, waits for
// window.__shotReady (the game sets it after painting the staged scene
// twice), then captures a JPEG into screenshots/.
// Usage: node shots.mjs [port]   (default port 8080, the serve.ts port)
import { readFileSync, writeFileSync } from "node:fs";

const PORT = process.argv[2] ?? "8080";
const shots = JSON.parse(readFileSync("shots.json", "utf8"));

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) {
  console.error("no page target");
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});

for (const shot of shots) {
  const url = `file:///tmp/heist-shot.html${shot.query}`;
  await send("Page.navigate", { url });
  // Wait until the game says the staged scene is painted.
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const result = await send("Runtime.evaluate", {
      expression: "window.__shotReady === true",
      returnByValue: true,
    });
    if (result.result && result.result.value === true) {
      ready = true;
      break;
    }
  }
  if (!ready) {
    console.error("shot not ready:", shot.name);
    continue;
  }
  const capture = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  writeFileSync(`screenshots/${shot.name}`, Buffer.from(capture.data, "base64"));
  console.log("saved", `screenshots/${shot.name}`);
}
process.exit(0);
