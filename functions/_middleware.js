// Preview closed (IICIC). Every request gets a short "this preview has ended" page.
export async function onRequest() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Preview closed · IICIC</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box;margin:0}body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#0a0a09 radial-gradient(circle at 30% 20%,rgba(255,46,147,.22),transparent 55%);color:#e9e4d8;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.card{max-width:400px;padding:32px 28px;border:2px solid rgba(255,46,147,.55);border-radius:24px 24px 24px 6px;background:rgba(18,18,17,.92)}
.tag{font-weight:900;font-size:28px;color:#ffe100;text-shadow:3px 3px 0 #ff2e93}h1{font-size:24px;margin:14px 0 8px}p{color:#bdb7aa;font-size:15px}a{color:#b8ff2e}</style></head>
<body><main class="card"><span class="tag">IICIC</span><h1>This preview has closed</h1><p>Thanks for taking a look. Want a website like this for your business? <a href="https://isitcozitscool.com">isitcozitscool.com</a></p></main></body></html>`,
  { status: 410, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
