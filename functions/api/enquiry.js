/**
 * POST /api/enquiry  — Poletech job sheet handler (Cloudflare Pages Function)
 *
 * Environment variables (Pages → Settings → Environment variables):
 *   RESEND_API_KEY     required  API key for https://resend.com (secret)
 *   FROM_EMAIL         required  e.g. "Poletech website <enquiries@poletech-scaffolding.co.uk>" (domain verified in Resend)
 *   TO_DEFAULT         optional  fallback inbox, default info@poletechscaffolding.co.uk
 *   TO_COMMERCIAL      optional  inbox for commercial / specialist enquiries
 *   TO_DOMESTIC        optional  inbox for domestic / temporary roof enquiries
 *   TURNSTILE_SECRET   optional  Cloudflare Turnstile secret; when set, a valid token is required
 * Bindings (optional):
 *   RATE_LIMIT         KV namespace used for per-IP rate limiting (5 enquiries per hour)
 *
 * Nothing secret is ever sent to the browser.
 */

const SERVICES = ['Commercial scaffolding', 'Domestic scaffolding', 'Temporary roof', 'Specialist access or scaffold design', 'Other'];
const SITES = ['House or bungalow', 'Flats or apartments', 'Listed or heritage building', 'School, college or university', 'Hospital or healthcare',
  'Shopping centre or retail', 'Office or commercial building', 'Industrial or warehouse', 'New build site', 'Event or festival', 'Other'];
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;
const POSTCODE = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y0-9]?[A-HJKS-UW0-9]?[ABEHMNPRV-Y0-9]? ?[0-9][ABD-HJLN-UW-Z]{2})$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const phoneOk = v => /^0\d{9,10}$/.test(v.replace(/[\s()-]/g, '').replace(/^\+44/, '0'));

export async function onRequestPost({ request, env }) {
  // Same-origin only
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: 'Bad origin' }, 403);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  // Rate limit: 5 per IP per hour (only if a KV namespace is bound)
  if (env.RATE_LIMIT) {
    const key = `rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const n = parseInt(await env.RATE_LIMIT.get(key) || '0', 10);
    if (n >= 5) return json({ ok: false, error: 'Too many enquiries. Please call 01234 857779.' }, 429);
    await env.RATE_LIMIT.put(key, String(n + 1), { expirationTtl: 3700 });
  }

  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, error: 'Invalid form' }, 400); }

  // Spam traps: hidden field filled, or form completed impossibly fast. Pretend success so bots learn nothing.
  if (clean(form.get('website'), 200) || Number(form.get('elapsed') || 0) < 4000) return json({ ok: true });

  if (env.TURNSTILE_SECRET) {
    const token = clean(form.get('cf-turnstile-response'), 2048);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip })
    });
    const v = await r.json().catch(() => ({}));
    if (!v.success) return json({ ok: false, error: 'Spam check failed' }, 400);
  }

  // Server-side validation (mirrors the browser checks; never trust the client)
  const f = {
    ref: clean(form.get('ref'), 20).replace(/[^A-Z0-9-]/gi, ''),
    service: clean(form.get('service'), 60),
    postcode: clean(form.get('postcode'), 10).toUpperCase(),
    site: clean(form.get('site'), 60),
    desc: clean(form.get('desc'), 4000),
    storeys: clean(form.get('storeys'), 3),
    sides: form.getAll('sides').map(s => clean(s, 20)).slice(0, 6),
    when: clean(form.get('when'), 40),
    start: clean(form.get('start'), 10),
    client: clean(form.get('client'), 120),
    programme: clean(form.get('programme'), 40),
    drawings: clean(form.get('drawings'), 40),
    name: clean(form.get('name'), 120),
    company: clean(form.get('company'), 120),
    phone: clean(form.get('phone'), 30),
    email: clean(form.get('email'), 254),
    pref: clean(form.get('pref'), 10),
    consent: form.get('consent') === 'on'
  };
  const errors = [];
  if (!SERVICES.includes(f.service)) errors.push('service');
  if (!POSTCODE.test(f.postcode)) errors.push('postcode');
  if (!SITES.includes(f.site)) errors.push('site');
  if (f.desc.length < 10) errors.push('desc');
  if (f.name.length < 2) errors.push('name');
  if (!f.phone && !f.email) errors.push('contact');
  if (f.phone && !phoneOk(f.phone)) errors.push('phone');
  if (f.email && !EMAIL.test(f.email)) errors.push('email');
  if (f.start && !/^\d{4}-\d{2}-\d{2}$/.test(f.start)) errors.push('start');
  if (!f.consent) errors.push('consent');
  if (errors.length) return json({ ok: false, error: 'Please check: ' + errors.join(', ') }, 422);

  // Attachments
  const files = form.getAll('files').filter(x => x && typeof x === 'object' && x.size > 0);
  if (files.length > MAX_FILES) return json({ ok: false, error: `Please attach up to ${MAX_FILES} files.` }, 413);
  let total = 0; const attachments = [];
  for (const file of files) {
    total += file.size;
    if (total > MAX_BYTES) return json({ ok: false, error: 'Attachments are over 10 MB.' }, 413);
    if (!FILE_TYPES.includes(file.type)) return json({ ok: false, error: `${file.name} is not a JPG, PNG, HEIC or PDF.` }, 415);
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    attachments.push({ filename: clean(file.name, 120).replace(/[^\w.\- ]/g, '_') || 'attachment', content: btoa(bin) });
  }

  // Routing
  const commercial = /Commercial|Specialist/.test(f.service);
  const to = (commercial ? env.TO_COMMERCIAL : env.TO_DOMESTIC) || env.TO_DEFAULT || 'info@poletechscaffolding.co.uk';
  const urgent = f.when === 'As soon as possible';

  const lines = [
    ['Reference', f.ref], ['Service', f.service], ['Needed', f.when || 'Not given'], ['Start date', f.start || 'Not fixed'],
    ['Postcode', f.postcode], ['Site type', f.site], ['Height', f.storeys ? `${f.storeys} storey` : 'Not given'],
    ['Scaffold to', f.sides.join(', ') || 'Not given'],
    ...(commercial ? [['Contractor / client', f.client || '—'], ['Programme', f.programme || 'Not sure'], ['Drawings', f.drawings || 'Not given']] : []),
    ['Name', f.name], ['Company', f.company || '—'], ['Phone', f.phone || '—'], ['Email', f.email || '—'], ['Contact by', f.pref || 'Phone'],
    ['Attachments', attachments.length ? attachments.map(a => a.filename).join(', ') : 'None']
  ];
  const text = lines.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nThe work:\n${f.desc}\n\nSent from the job sheet on poletech-scaffolding.co.uk`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<h2 style="font-family:Arial,sans-serif;color:#13244f">${urgent ? 'URGENT · ' : ''}Job sheet ${esc(f.ref)}</h2>
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">${lines.map(([k, v]) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#4f5a6e;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#1c2333">${esc(String(v))}</td></tr>`).join('')}</table>
<h3 style="font-family:Arial,sans-serif;color:#13244f">The work</h3><p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc(f.desc)}</p>`;

  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return json({ ok: false, error: 'Email is not configured yet' }, 503);
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL, to: [to], reply_to: f.email || undefined,
      subject: `${urgent ? '[URGENT] ' : ''}[${commercial ? 'Commercial' : 'Domestic'}] Job sheet ${f.ref} · ${f.postcode}`,
      text, html, attachments
    })
  });
  if (!send.ok) return json({ ok: false, error: 'Could not send right now' }, 502);
  return json({ ok: true, ref: f.ref });
}

export const onRequestGet = () => json({ ok: false, error: 'Method not allowed' }, 405);
