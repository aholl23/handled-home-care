# Handled HomeCare website (handledhomecare.com)

Plain static site: no framework, no build step. Cloudflare Pages deploys every push to `main` automatically.

## Files
- `index.html`: all page text and layout. Pages are sections (`data-page="home|membership|about|get-started"`) switched by the URL hash (#membership).
- `css/styles.css`: all styles. Brand tokens are in `:root` (navy `--ink`, blue `--bay`, gold `--sun`).
- `js/app.js`: page switching, example text conversations, the request form.
- `js/site-config.js`: the Web3Forms access key. Requests are emailed through Web3Forms. Without a real key the form runs in preview mode.
- `assets/`: logos and photos. `fonts/`: Libre Franklin.

## Business rules (never break these)
- Handled HomeCare connects homeowners with independent local pros. It does not do the work.
- Never say the company is licensed, insured, or bonded.
- Never mention Shore Works.
- No fake reviews or testimonials.
- Membership price varies by membership type. Don't show a flat price.
- Phone and email stay "opening soon" until the team says otherwise.

## Style
- Clean, Apple-like: big bold type, lots of space, one gold accent for the main action.
- Short plain sentences. Test on a phone-width screen (390px) as well as desktop.
- Add `?team` to the URL to see photo-shooting notes for the team.

## Check before pushing
- Every page loads with no console errors: #home, #membership, #about, #get-started.
- Nothing scrolls sideways at 390px.
- The request form still reaches the thank-you screen.
