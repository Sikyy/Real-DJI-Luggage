# DJI Luggage CMS

Payload/Next workspace for managing the DJI Luggage website content without disturbing the current static site.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Replace `PAYLOAD_SECRET` with a long random value.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000/admin` and create the first admin user.
6. Optional: run `NODE_ENV=production npm run seed` to populate the first DJI Luggage content records.

## Static Site Preview

Run the static website from the repository root:

```sh
node scripts/static-server.mjs
```

The preview runs at `http://localhost:8767/`. It serves the existing static files and rewrites dynamic CMS-backed detail routes:

- `/newsroom/:slug/` -> `article-template.html`
- `/careers/:slug/` -> `career-template.html`

This lets newly created `News Posts` and `Job Posts` work from the admin list pages without creating matching folders by hand.

## First Content Scope

- `Site Settings`: header, menu, footer, address, social links, global CTA labels.
- `Home Page`, `About Page`, `Services Page`, `Platform Page`, `Newsroom Page`, `Careers Page`: main marketing page content.
- `Team Members`: leadership carousel data.
- `Trusted Logos`: logo source strategy, including inline SVG/source-symbol support.
- `Testimonials`, `News Posts`, `Job Posts`, and `Contact Submissions`: reusable content collections for testimonials, articles, careers, and inquiries.

The static HTML site runs on port `8767`; this CMS runs separately on port `3000`.

## Multilingual Status

Payload `i18n` translates the admin interface. Payload `localization` is also enabled for public website content, with editable copy fields localized automatically by `src/utilities/localizedContent.ts`.

The static frontend detects locale-prefixed paths such as `/id/about` and `/zh/newsroom/...`, then requests CMS data with `?locale=id&fallback-locale=en`. Launch locales are:

- `en`: default export-facing website copy.
- `id`: Indonesian/local market copy.
- `zh`: optional buyer-facing Chinese copy and internal review support.

Existing English CMS content was copied into the `en` locale tables in `cms.db`; the pre-localization database backup is `cms.db.before-localization-20260601`.
