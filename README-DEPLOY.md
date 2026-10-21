# Poletech Scaffolding website – deploy notes

This folder is the launch build. Host it on **Cloudflare Pages** (free tier is fine).

## 1. Create the Pages project
1. Push this folder to a GitHub repo (or drag-and-drop it in Pages → Create → Upload assets).
2. Build command: none. Output directory: `/` (this folder).
3. Pages picks up `functions/api/enquiry.js` automatically as the job sheet endpoint (`POST /api/enquiry`).

## 2. Turn on job sheet emails
The form posts to `/api/enquiry`, which validates everything again on the server and emails the job sheet.

1. Create a free account at https://resend.com and verify the domain `poletech-scaffolding.co.uk` (it adds a few DNS records).
2. In Pages → Settings → Environment variables (Production), add:
   | Name | Example | Notes |
   |---|---|---|
   | `RESEND_API_KEY` | `re_…` | **Encrypt** (secret) |
   | `FROM_EMAIL` | `Poletech website <enquiries@poletech-scaffolding.co.uk>` | must be on the verified domain |
   | `TO_DEFAULT` | `info@poletechscaffolding.co.uk` | fallback inbox |
   | `TO_COMMERCIAL` | *(optional)* | commercial + specialist enquiries |
   | `TO_DOMESTIC` | *(optional)* | domestic + temporary roof enquiries |
3. Optional but recommended: create a KV namespace, bind it to the project as `RATE_LIMIT` (limits each visitor to 5 enquiries an hour).
4. Optional: Cloudflare Turnstile. Add `TURNSTILE_SECRET` and the Turnstile widget to the review step; the function then requires a valid token.
5. Test: submit a job sheet on the live site and check the inbox. Urgent ("As soon as possible") jobs arrive with `[URGENT]` in the subject.

Until the variables are set, the form tells the customer it couldn't send and offers Email / Copy / Call instead. It never shows a fake "sent" message.

## 3. Domain move (from Yell)
1. Confirm who controls the domain and when the Yell contract ends.
2. Add the custom domain in Pages → Custom domains, then update DNS.
3. `_redirects` maps the old URLs (`/our-projects`, `/contact`, `/scaffolding-health-and-safety`, `/careers-popup`) to the new sections. Change them to 301s and point them at the new pages once those pages exist.
4. Replace the legal links (currently on business.yell.com) with Poletech's own privacy and terms pages before switching.

## 4. After launch
- Google Search Console: add the domain, submit `/sitemap.xml`.
- Google Business Profile: copy the "Ask for reviews" link and swap it into the Google card on `/reviews`.
- Analytics: if added, use a cookie banner (or a cookieless tool such as Cloudflare Web Analytics).

## Preview mode (IICIC)
`functions/_middleware.js` locks the site behind a preview code on preview addresses only
(poletech.isitcozitscool.com and *.pages.dev). Set `PREVIEW_CODE` in Cloudflare
(Pages > Settings > Variables and Secrets). On the real domain it does nothing.
Preview mode also hides the site from Google, adds the IICIC feedback bar and hazard-tape strip,
and lets the job sheet be tried without sending any emails.
