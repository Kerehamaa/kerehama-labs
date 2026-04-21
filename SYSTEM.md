# Kerehama Labs — Business System

## The Process (5 Phases)

### Phase 1: RESEARCH
Find a business. Look for small local businesses (Tauranga first) that have no website or a bad one. Facebook-only businesses are ideal targets.

### Phase 2: INFO
Gather everything:
- Business name, address, hours
- Services and pricing (check Setmore, Square, booking platforms)
- Social media links (Facebook, Instagram)
- Email address
- Reviews and ratings
- Photos from their socials
- Their existing booking system

### Phase 3: BUILD
Build a demo site at labs.kerehama.nz/sites/<business-name>/
- Use the kerehama-labs repo (Kerehamaa/kerehama-labs)
- Dark, premium design. No emojis anywhere.
- Real pricing and services from their actual booking platform
- Deep-link booking buttons to their existing Setmore/booking system (per-service links)
- Stock photos as placeholders (Unsplash)
- Google Maps embed
- Demo strip at bottom: "Demo site built by Kerehama Andrews"
- Mobile responsive
- Push to main branch, Netlify auto-deploys

### Phase 4: TALK TO ME
Show Kerehama the site. He reviews it. If changes needed, go back to Phase 3. If good, move on.

### Phase 5: EMAIL
Draft the cold outreach email. Rules:
- Plain text only. No HTML design. No images. Looks like spam otherwise.
- Short, specific to their business, not salesy
- Don't include pricing in the first email — just get them to reply
- Have a second follow-up email ready with pricing for when they show interest

## Pricing (for follow-up email)

| Item | Our Price | Market Rate |
|---|---|---|
| Website build | $250 NZD | $800 — $2,000+ |
| Domain + hosting setup | $50 one-off | $100 — $300 |
| Monthly hosting & updates | $15/month | $30 — $80/month |

Total to start: $300 + $15/month ongoing.

## Rules
- No emojis. Ever. On any site or email.
- Don't sell code, sell the service (build + host + maintain)
- Demo stays on labs.kerehama.nz until paid
- Never hand over files before payment
- First email = get them to reply. Second email = pricing.
- Site must look better than anything their competitors have
- All booking buttons deep-link to the correct service on their booking platform

## Prospect Tracker

### Imperial Barbers Tauranga — PHASE 5 COMPLETE
- Address: 84 First Avenue, Tauranga 3110
- Hours: 9am-6pm, 7 days
- Email: imperialstylesnz@gmail.com
- Facebook: @ImperialBarbersTauranga
- Instagram: @imperialbarbers_tauranga
- Setmore: imperialbarbers.setmore.com
- Services: Hair Cut $30, Scissors Cut $33, Skin/Zero Fade $35, Flat Top $30
- Demo: https://labs.kerehama.nz/sites/imperial-barbers/
- Status: Email drafted, awaiting Kerehama to send
- First email: plain text, subject "I built something for Imperial Barbers"

### New Hong Kong Takeaways — PHASE 4 COMPLETE
- Address: 1308 Cameron Road, Greerton, Tauranga 3112
- Phone: 07-577 6510
- Hours: Mon-Sun 12pm-10pm, Smorgasbord 3:30pm-8:30/9pm
- Email: None found
- Current site: newhongkongtakeaways.wixsite.com/website (terrible free Wix)
- Family-owned since 2001
- Demo: https://labs.kerehama.nz/sites/new-hong-kong/
- Status: No email — Kerehama will contact them directly (call/walk-in/text)
- Approach: family-owned discount angle

## Infrastructure
- Repo: Kerehamaa/kerehama-labs (GitHub)
- SSH key alias: github.com-kerehama-labs
- Hosted: Netlify (labs.kerehama.nz)
- Local workspace: /root/.openclaw/workspace/kerehama-labs
- Sites go in: sites/<business-name>/index.html
- Netlify config: force=false on /sites/* redirect, so real files serve directly
- Send email function exists at netlify/functions/send-email.mjs
