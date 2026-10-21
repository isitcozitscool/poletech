// IICIC preview mode (Cloudflare Pages middleware)
// Only switches on for preview addresses (*.isitcozitscool.com and *.pages.dev).
// On the customer's real domain after launch it does nothing at all.
//
// On preview addresses it:
//   - asks for a preview code before showing anything (env PREVIEW_CODE, set in Cloudflare)
//   - tells Google not to list the preview
//   - lets the job sheet "send" without emailing anyone, so it can be tried safely
//   - pins an IICIC preview bar to the top with Love it / Request changes (WhatsApp) buttons,
//     and a hazard-tape "Website preview · not live yet" strip to the bottom

const STUDIO_WA = "447718974902";
const COOKIE = "iicic_preview";

const isPreviewHost = (h) => /\.isitcozitscool\.com$/i.test(h) || /\.pages\.dev$/i.test(h);

async function sign(code) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("iicic-preview-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const cookieVal = (req, name) => {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function lockPage(next, wrong, notSet) {
  const msg = notSet ? "This preview isn't ready yet. Check back soon." : wrong ? "That code didn't work. Check it and try again." : "";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Website preview · IICIC</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box;margin:0}body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#0a0a09 radial-gradient(circle at 30% 20%,rgba(255,46,147,.22),transparent 55%),radial-gradient(circle at 80% 90%,rgba(184,255,46,.12),transparent 50%);color:#e9e4d8;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.card{width:100%;max-width:400px;padding:32px 28px;border:2px solid rgba(255,46,147,.55);border-radius:24px 24px 24px 6px;background:rgba(18,18,17,.92);box-shadow:0 30px 80px -30px #000}
.tag{display:inline-block;font-weight:900;font-size:28px;letter-spacing:-.02em;color:#ffe100;text-shadow:3px 3px 0 #ff2e93;transform:skewX(-6deg)}
.k{margin-top:18px;font-size:12px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:#ff2e93}
h1{font-size:26px;line-height:1.15;margin:6px 0 8px}p{color:#bdb7aa;font-size:15px}
label{display:block;margin:22px 0 6px;font-size:13px;font-weight:700;color:#e9e4d8}
input{width:100%;height:52px;padding:0 16px;border-radius:12px;border:2px solid rgba(233,228,216,.25);background:#0a0a09;color:#fff;font:600 18px system-ui,sans-serif;letter-spacing:.08em}
input:focus{outline:none;border-color:#b8ff2e}
button{margin-top:14px;width:100%;height:54px;border:0;border-radius:4px 26px 26px 26px;background:#e9e4d8;color:#0a0a09;font-weight:900;font-size:14px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}
button:hover{background:#ffe100}.err{margin-top:12px;color:#ff6b6b;font-size:14px;font-weight:700}
.foot{margin-top:22px;font-size:13px}.foot a{color:#b8ff2e}
</style></head><body><main class="card">
<span class="tag">IICIC</span>
<p class="k">Website preview</p>
<h1>Your new website is ready for a look</h1>
<p>Enter the preview code we sent you to have a look around.</p>
${notSet ? "" : `<form method="post" action="/__preview"><input type="hidden" name="next" value="${esc(next)}">
<label for="c">Preview code</label><input id="c" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus>
<button type="submit">Let me in →</button></form>`}
${msg ? `<p class="err" role="alert">${msg}</p>` : ""}
<p class="foot">No code? <a href="https://wa.me/${STUDIO_WA}" rel="noopener">Ask us on WhatsApp ↗</a></p>
</main></body></html>`, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

class PreviewBar {
  constructor(path) { this.path = path; }
  element(body) {
    const page = this.path === "/" ? "the homepage" : this.path;
    const wa = (t) => `https://wa.me/${STUDIO_WA}?text=${encodeURIComponent(t)}`;
    const love = wa(`Hi IICIC! 👍 I've had a look at the preview and I love it.\n\nPage: ${page}`);
    const change = wa(`Hi IICIC! ✏️ I've had a look at the preview and I'd like a change.\n\nPage: ${page}\nWhat I'd like changed: `);
    body.prepend(`<div id="iicic-pv" role="region" aria-label="Website preview feedback">
<style>:root{--pvh:44px;--pvt:26px}
#iicic-pv{position:fixed;top:0;left:0;right:0;height:var(--pvh);z-index:2147483000;display:flex;justify-content:center;align-items:center;gap:8px;padding:0 10px;background:#0a0a09;border-bottom:2px solid #ff2e93;font:700 12.5px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e9e4d8}
#iicic-pv b{color:#ffe100;letter-spacing:.02em;white-space:nowrap;margin-right:4px}#iicic-pv a{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;text-decoration:none;white-space:nowrap;font:inherit}
#iicic-pv .l{background:#b8ff2e;color:#0a0a09}#iicic-pv .c{background:#ff2e93;color:#0a0a09}
#iicic-tape{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;height:calc(var(--pvt) + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(-45deg,#ffd400 0 14px,#111 14px 28px);box-shadow:0 -2px 8px rgba(0,0,0,.25);pointer-events:none}
#iicic-tape span{background:#ffd400;color:#111;font:800 11.5px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:5px 12px;border:2px solid #111;white-space:nowrap}
body{padding-top:var(--pvh)!important;padding-bottom:calc(var(--pvt) + env(safe-area-inset-bottom,0px))!important}
header.site{top:var(--pvh)!important}section[id]{scroll-margin-top:calc(80px + var(--pvh))!important}
.rail{top:calc(96px + var(--pvh))!important;bottom:calc(24px + var(--pvt))!important}
.wa-float{bottom:calc(20px + var(--pvt) + env(safe-area-inset-bottom,0px))!important}
body::before{display:none!important}
@media (max-width:980px){.actionbar{bottom:var(--pvt)!important;padding-bottom:10px!important}footer.site{padding-bottom:calc(120px + var(--pvt))!important}}
@media (max-width:420px){#iicic-pv .t{display:none}#iicic-pv a{padding:0 10px}#iicic-tape span{letter-spacing:.08em;font-size:10.5px}}</style>
<b>IICIC <span class="t">website preview</span></b><a class="l" href="${love}" target="_blank" rel="noopener">👍 Love it</a><a class="c" href="${change}" target="_blank" rel="noopener">✏️ Request changes</a>
</div>
<div id="iicic-tape" aria-hidden="true"><span>Website preview · not live yet</span></div>`, { html: true });
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!isPreviewHost(url.hostname)) return next(); // live site: untouched

  if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });

  const code = (env.PREVIEW_CODE || "").trim();
  if (!code) return lockPage("/", false, true);
  const good = await sign(code.toUpperCase());

  if (url.pathname === "/__preview" && request.method === "POST") {
    const fd = await request.formData().catch(() => null);
    const tried = ((fd && fd.get("code")) || "").toString().trim().toUpperCase();
    let dest = ((fd && fd.get("next")) || "/").toString();
    if (!dest.startsWith("/") || dest.startsWith("//")) dest = "/";
    if (tried && (await sign(tried)) === good) {
      return new Response(null, { status: 303, headers: { location: dest, "set-cookie": `${COOKIE}=${good}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" } });
    }
    return lockPage(dest, true, false);
  }

  if (cookieVal(request, COOKIE) !== good) return lockPage(url.pathname + url.search, false, false);

  // try the job sheet safely: pretend it sent, email nobody
  if (url.pathname === "/api/enquiry" && request.method === "POST") {
    return new Response(JSON.stringify({ ok: true, preview: true }), { headers: { "content-type": "application/json" } });
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("x-robots-tag", "noindex, nofollow");
  out.headers.set("cache-control", "no-store");
  if ((res.headers.get("content-type") || "").includes("text/html")) {
    return new HTMLRewriter().on("body", new PreviewBar(url.pathname)).transform(out);
  }
  return out;
}
