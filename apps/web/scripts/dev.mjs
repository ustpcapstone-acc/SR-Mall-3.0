#!/usr/bin/env node
/**
 * `npm run dev` wrapper.
 *
 * Next listens on every network (-H 0.0.0.0) so phones on the same Wi-Fi can
 * open the app, but then it prints "Network: http://0.0.0.0:3000", which is
 * not an address you can open. This script:
 *
 *   1. finds this PC's real LAN address (Wi-Fi first; skips VirtualBox / WSL
 *      virtual adapters),
 *   2. keeps NEXT_PUBLIC_APP_URL in the .env files in step with it, so links
 *      in emails/notifications use the current IP after a network change,
 *   3. starts `next dev -H 0.0.0.0` and shows the real address in Next's
 *      "Network:" line.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(webDir, "../..");
const port = process.env.PORT || "3000";

function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const virtual =
        /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|vpn|tailscale|zerotier/i.test(name) ||
        a.address.startsWith("192.168.56."); // VirtualBox host-only default
      if (virtual) continue;
      const rank = /wi-?fi|wireless|wlan/i.test(name) ? 0 : /ethernet|eth|en\d/i.test(name) ? 1 : 2;
      candidates.push({ rank, address: a.address });
    }
  }
  candidates.sort((x, y) => x.rank - y.rank);
  return candidates[0]?.address ?? null;
}

function syncAppUrl(ip) {
  const url = `http://${ip}:${port}`;
  const files = [resolve(repoDir, ".env"), resolve(webDir, ".env"), resolve(repoDir, "packages/database/.env")];
  const changed = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const m = text.match(/^NEXT_PUBLIC_APP_URL="?([^"\r\n]*)"?/m);
    // Only follow LAN-style URLs; never overwrite a real domain someone set.
    if (!m || m[1] === url || !/^http:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?\/?$|^http:\/\/localhost/.test(m[1])) continue;
    writeFileSync(file, text.replace(/^NEXT_PUBLIC_APP_URL=.*$/m, `NEXT_PUBLIC_APP_URL="${url}"`));
    changed.push(file.slice(repoDir.length + 1));
  }
  return changed;
}

const ip = lanAddress();
if (ip) {
  const changed = syncAppUrl(ip);
  if (changed.length) console.log(`\x1b[33m↻ IP changed — NEXT_PUBLIC_APP_URL set to http://${ip}:${port} in ${changed.join(", ")}\x1b[0m`);
} else {
  console.log("\x1b[33m! No Wi-Fi/LAN connection found — phones can't reach this PC right now.\x1b[0m");
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "-H", "0.0.0.0", ...process.argv.slice(2)], {
  cwd: webDir,
  stdio: ["inherit", "pipe", "inherit"],
  env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
});

const shown = ip ? `http://${ip}:` : "http://localhost:";
child.stdout.on("data", (chunk) => process.stdout.write(chunk.toString().replaceAll("http://0.0.0.0:", shown)));
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
