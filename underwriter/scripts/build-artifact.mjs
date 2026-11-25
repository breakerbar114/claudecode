// Builds a single self-contained HTML page (no server) for publishing as a hosted artifact.
// Live rates/CPI/Fed funds are fetched once now and baked in as a dated snapshot.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = 8799;
const server = spawn("node", ["server/index.mjs"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
let rates = null;
try {
  for (let i = 0; i < 40 && !rates; i++) {
    await new Promise((r) => setTimeout(r, 250));
    rates = await fetch(`http://localhost:${port}/api/rates`).then((r) => r.json()).catch(() => null);
  }
} finally {
  server.kill();
}
if (rates) rates.source = `${rates.source} — snapshot ${new Date().toISOString().slice(0, 10)}`;
console.log("rates snapshot:", rates);

execSync("npx vite build --mode artifact", { cwd: root, stdio: "inherit", env: { ...process.env, RATES_SNAPSHOT: JSON.stringify(rates) } });

const out = path.join(root, "dist-artifact");
const assets = fs.readdirSync(path.join(out, "assets"));
const css = assets.filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(out, "assets", f), "utf8")).join("\n");
const js = assets.filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(out, "assets", f), "utf8")).join("\n");

const html = `<title>Deal Underwriter</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js.replace(/<\/script/gi, "<\\/script")}
</script>
`;
const dest = path.join(root, "deal-underwriter.html");
fs.writeFileSync(dest, html);
console.log(`wrote ${dest} (${(html.length / 1024).toFixed(0)} KB)`);
