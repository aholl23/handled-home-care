# Handled HomeCare website (handledhomecare.com)

Plain static site, no framework. Cloudflare Pages runs `vite build` and publishes `dist/`; vite.config.js copies js/, fonts/, assets/, icons, _headers and _redirects into dist/. If you add a new top-level static file or folder, add it to the STATIC list in vite.config.js or it won't go live. Test a production build with `npm run build` (output in dist/, which is gitignored). Local preview: `npm run dev` (http://localhost:3000). Cloudflare Pages deploys every push to `main` automatically.

## Files
- `index.html`: all page text and layout. Pages are sections (`data-page="home|membership|about|get-started"`) switched by the URL hash (#membership).
- `css/styles.css`: all styles. Brand tokens are in `:root` (navy `--ink`, blue `--bay`, gold `--sun`).
- `js/app.js`: page switching, example text conversations, the request form.
- `js/site-config.js`: the EmailJS `serviceId`, `templateId` and `publicKey`. Requests are emailed through EmailJS (plain `fetch` to its REST API, no library). Until all three are filled in the form runs in preview mode. EmailJS answers 429 at its limit; the form then shows "can't take requests right now".
- `assets/`: logos and photos. `fonts/`: Libre Caslon Text (headlines, regular and bold only) and Hanken Grotesk (everything else).

## Dev server (never touch it)
- The owner runs `npm run dev` themselves in their own terminal at http://localhost:3000.
- Never start, stop, restart or kill the dev server or any node/vite process (no `taskkill`, `pkill`, `npm run dev`, `vite`, or your own static server).
- To check a page, open the one already running at http://localhost:3000.

## Business rules (never break these)
- Handled HomeCare connects homeowners with independent local pros. It does not do the work.
- Never say the company is licensed, insured, or bonded.
- Never mention Shore Works.
- No fake reviews or testimonials.
- Membership is FREE. It covers finding trusted local pros, coordinating jobs, and seasonal reminders. Never show a membership price.
- We make money from paid seasonal home checks, house watch, a parent care plan, and referral fees pros pay us. Customers pay pros directly. We never add anything to a pro's price.
- Don't show prices for paid services yet. Where a price would go, write "We'll go over the price on the call."
- Never call the check an "inspection" (that needs a license in Maryland). Say "home check" or "seasonal walkthrough."
- Phone and email stay "opening soon" until the team says otherwise.

## Style
- Clean and calm: big serif headlines (Libre Caslon Text, 400 and 700 only), Hanken Grotesk for body and buttons, lots of space, one gold accent for the main action.
- Empty photo spots and "bio coming soon" notes are hidden from visitors. They only show with `?team`. Add `has-photo` to a `.slot` once a real photo is in it.
- Short plain sentences. Test on a phone-width screen (390px) as well as desktop.
- Add `?team` to the URL to see photo-shooting notes for the team.

## Check before pushing
- Every page loads with no console errors: #home, #membership, #about, #get-started.
- Nothing scrolls sideways at 390px.
- The request form still reaches the thank-you screen on every path (fix, home check, house watch, parent, just join, local pro). Join skips step 2 and pros skip step 3, so those paths are 4 steps.

## EmailJS template (new template, Reply To = `{{reply_to}}`)
**Subject:** `New request No. {{request_no}}: {{path}} from {{name}} ({{town}})`

**Body:**
```
New request No. {{request_no}}
Sent: {{sent_at}}
What they want: {{path}}
Membership: {{membership}}

Name: {{name}}
Phone: {{phone}}
Reach by: {{contact_pref}}
Best time: {{call_time}}
Email: {{email}}

{{request_details}}

Street: {{street}}
Town: {{town}}
Home type: {{home_type}}
AC age: {{ac_age}}
Roof age: {{roof_age}}

Notes: {{extra_notes}}
```
`{{request_details}}` is built per path (only the lines that apply). The site also sends each field on its own, in case you want to split the template later: `job, kind_of_job, how_soon, visit_first, season, away_dates, visit_frequency, storm_checks, parent_name, parent_phone, parent_knows, trade, towns_served, insured`. For a local pro, `{{town}}` is the towns they serve. Fields that don't apply say "Not applicable"; optional ones left blank say "Not given".
Set **To Email** to the inbox that should get requests, **From Name** to `Handled HomeCare website`, **Reply To** to `{{reply_to}}`.

## Cache busting (do this every time you change CSS or JS)
- index.html loads css/styles.css, js/app.js and js/site-config.js with a ?v= version. When you change any of those files, update the ?v= value on all three to the current date and time (YYYYMMDDHHMM) before committing. Otherwise visitors can get an old cached copy and animations or styles break on the live site.
- Keep data-cfasync="false" on the script tags so Cloudflare Rocket Loader leaves them alone.
