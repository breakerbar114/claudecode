// Private-app lock: one password (APP_PASSWORD), then a signed cookie that lasts a year so the
// home-screen app stays signed in. With no APP_PASSWORD set (local dev), everything is open.
import crypto from "node:crypto";

const COOKIE = "uw_session";
const YEAR = 60 * 60 * 24 * 365;
// Files the phone needs to install the app before signing in. None of them hold data.
const PUBLIC = ["/login", "/healthz", "/manifest.webmanifest", "/icons/", "/favicon"];

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

function secret() {
  // A random SESSION_SECRET is best; fall back to one derived from the password so changing it logs everyone out.
  return process.env.SESSION_SECRET || crypto.createHash("sha256").update("uw:" + process.env.APP_PASSWORD).digest("hex");
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function token() {
  const issued = String(Math.floor(Date.now() / 1000));
  return `${issued}.${sign(issued)}`;
}

function valid(tok) {
  if (!tok) return false;
  const [issued, sig] = tok.split(".");
  if (!issued || !sig) return false;
  const expected = sign(issued);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() / 1000 - Number(issued) < YEAR;
}

function readCookie(req) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

function samePassword(given) {
  const a = crypto.createHash("sha256").update(String(given ?? "")).digest();
  const b = crypto.createHash("sha256").update(process.env.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Slow down password guessing: 8 tries per 15 minutes per IP.
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, list);
  return list.length >= 8;
}

const page = (error = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Deal Underwriter</title>
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Underwriter">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
:root{--bg:#f5f6f8;--card:#fff;--fg:#14171c;--muted:#667085;--line:#e3e6eb;--accent:#1f6feb;--bad:#c4314b;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0d1015;--card:#161a21;--fg:#e8ebf0;--muted:#8b95a5;--line:#2a303b;--accent:#5b9bff;--bad:#ff6b81;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);
font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:max(16px,env(safe-area-inset-top)) 16px}
form{width:100%;max-width:340px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px 22px;display:grid;gap:14px}
img{width:56px;height:56px;border-radius:13px}h1{margin:0;font-size:20px}p{margin:0;color:var(--muted);font-size:14px}
input{font:inherit;font-size:16px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg)}
input:focus{outline:2px solid var(--accent);outline-offset:-1px}
button{font:inherit;font-weight:650;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#fff}
.err{color:var(--bad);font-size:14px}
</style></head><body>
<form method="post" action="/login">
<img src="/icons/icon-192.png" alt="">
<h1>Deal Underwriter</h1>
<p>Private app. Enter your password once and this device stays signed in.</p>
${error ? `<div class="err">${error}</div>` : ""}
<input type="password" name="password" autocomplete="current-password" placeholder="Password" autofocus required>
<button type="submit">Sign in</button>
</form></body></html>`;

export function installAuth(app, express) {
  app.set("trust proxy", 1); // behind Render/Railway's HTTPS proxy
  if (!authEnabled()) return;

  app.get("/login", (_req, res) => res.type("html").send(page()));
  app.post("/login", express.urlencoded({ extended: false }), (req, res) => {
    const ip = req.ip || "?";
    if (tooMany(ip)) return res.status(429).type("html").send(page("Too many tries. Wait 15 minutes and try again."));
    if (!samePassword(req.body?.password)) {
      attempts.get(ip).push(Date.now());
      return res.status(401).type("html").send(page("Wrong password."));
    }
    attempts.delete(ip);
    res.cookie(COOKIE, token(), { httpOnly: true, secure: req.secure, sameSite: "lax", maxAge: YEAR * 1000, path: "/" });
    res.redirect(303, "/");
  });
  app.get("/logout", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.redirect(303, "/login");
  });

  app.use((req, res, next) => {
    if (PUBLIC.some((p) => req.path === p || (p.endsWith("/") && req.path.startsWith(p)))) return next();
    if (valid(readCookie(req))) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Signed out. Reopen the app and sign in." });
    return res.redirect(302, "/login");
  });
}
