# Handled HomeCare website (handledhomecare.com)

Plain static site: no framework, no build step. Local preview: `npm run dev` (http://localhost:3000). Cloudflare Pages deploys every push to `main` automatically.

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
- Membership price varies by membership type. Don't show a flat price.
- Phone and email stay "opening soon" until the team says otherwise.

## Style
- Clean and calm: big serif headlines (Libre Caslon Text, 400 and 700 only), Hanken Grotesk for body and buttons, lots of space, one gold accent for the main action.
- Empty photo spots and "bio coming soon" notes are hidden from visitors. They only show with `?team`. Add `has-photo` to a `.slot` once a real photo is in it.
- Short plain sentences. Test on a phone-width screen (390px) as well as desktop.
- Add `?team` to the URL to see photo-shooting notes for the team.

## Check before pushing
- Every page loads with no console errors: #home, #membership, #about, #get-started.
- Nothing scrolls sideways at 390px.
- The request form still reaches the thank-you screen (5 steps).

## EmailJS template (new template, Reply To = `{{reply_to}}`)
**Subject:** `New request No. {{request_no}} from {{name}} ({{town}})`

**Body:**
```
New request No. {{request_no}}
Sent: {{sent_at}}

Name: {{name}}
Phone: {{phone}}
Best time to call: {{call_time}}
Email: {{email}}

For: {{who_for}}
Kind of job: {{kind_of_job}}
The job: {{job}}
How soon: {{how_soon}}
Check it out in person first: {{visit_first}}
Wants membership: {{membership}}

Street: {{street}}
Town: {{town}}
```
Set **To Email** to the inbox that should get requests, **From Name** to `Handled HomeCare website`, **Reply To** to `{{reply_to}}`.

## Cache busting (do this every time you change CSS or JS)
- index.html loads css/styles.css, js/app.js and js/site-config.js with a ?v= version. When you change any of those files, update the ?v= value on all three to the current date and time (YYYYMMDDHHMM) before committing. Otherwise visitors can get an old cached copy and animations or styles break on the live site.
- Keep data-cfasync="false" on the script tags so Cloudflare Rocket Loader leaves them alone.
