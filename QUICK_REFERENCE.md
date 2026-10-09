# Quick reference: Arun Karyana Store

## Live addresses

| What | Address |
| --- | --- |
| Shop | https://arun-karyana-store.netlify.app |
| Store dashboard | https://arun-karyana-store.netlify.app/admin.html (or `/dashboard`) |
| Classic dashboard (backup) | https://arun-karyana-store.netlify.app/admin-classic.html |
| Server health | https://arun-karyana-backend.onrender.com/health |

## Signing in to the dashboard

Sign in at `/login.html` with **owner@arunkaryanastore.com** and the owner password (shared
privately). Change it any time from Dashboard → My account. The owner login can't be reset by
email on purpose, so nobody can take it over through the inbox.

Forgot it? Passwords are stored scrambled, so nobody can look it up. Either set `ADMIN_EMAIL` and
`ADMIN_PASSWORD` on Render (Environment tab) for a second admin login, or have the developer put a
new password hash in `OWNER_PASSWORD_HASH` and raise `OWNER_BOOTSTRAP_VERSION` in `main.py`.

## Everyday tasks (all from the phone)

| Task | Where in the dashboard |
| --- | --- |
| See today's orders, money and what needs attention | **Today** |
| Confirm, pack, send out, deliver or cancel an order; call or WhatsApp the customer | **Orders** → tap an order |
| Change stock (+ / −), find low-stock or photo-less items | **Products** |
| Add or edit a product, take its photo with the phone camera | **Products** → Add product / tap a product |
| Promo codes and automatic offers | **Offers** |
| The strip of messages at the top of the shop | **More → Announcement bar** |
| A greeting card for festivals | **More → Welcome pop-up** |
| A customer can't sign in | **More → Customers** → tap them → Create temporary password → Send on WhatsApp |
| Give a family member dashboard access | **More → Customers** → tap them → Give dashboard access |
| Choose which reviews show on the shop | **More → Reviews** (the section appears once three are on) |
| Contact-form messages | **More → Messages** |

Stock goes down automatically when an order is marked **Delivered**, and comes back if a delivered
order is later cancelled. The dashboard checks for new orders every minute and chimes.

## Brand

| Token | Colour | Use |
| --- | --- | --- |
| Bone | `#f2eee6` | Page background |
| Ink | `#14120f` | Text, dark buttons |
| Kesar | `#e8531f` | Accent, highlights |
| Haldi | `#e9a83a` | Secondary accent |
| Night | `#12100e` | Dark sections, footer |

Type: Inter Tight (headings), Inter (text), Instrument Serif italic (accents), Geist Mono (labels).

## Technology

| Part | Technology | Hosting |
| --- | --- | --- |
| Shop and dashboard | HTML, CSS, JavaScript; GSAP, Lenis, three.js (all self-hosted) | Netlify, auto-deploys `main` |
| Server | Python 3.11, Flask, Gunicorn | Render, auto-deploys `main` |
| Database | MongoDB Atlas | Cloud |
| Product photos | Cloudinary | Free tier |
| Email | SendGrid (optional: the sender address must be verified) | 100 emails/day |

A GitHub Actions workflow (`store-health.yml`) pings the server every 10 minutes so it stays
awake for the first customer of the day, and prints its health.

## For developers

- Backend tests: `pip install -r requirements.txt -r requirements-dev.txt && pytest`
- After changing CSS/JS: `python3 scripts/stamp-assets.py` (cache-busting `?v=` stamps)
- Product category names are free text; the shop maps them to aisles in `assets/js/store.js` (`AISLES`).
