# TODO

- [ ] Add Open Graph and Twitter/X Card metadata so shared site links render rich preview cards in messaging apps.
  - Add page-specific `description`, `og:title`, `og:description`, `og:url`, `og:image`, and `twitter:*` tags directly in each HTML `<head>`.
  - Account for the main page and localized pages having different copy; add locale-specific metadata for `/`, `/id`, and `/zh` routes instead of relying on JavaScript localization.
  - Create a public 1200x630 share image, for example `/assets/og/dji-luggage-og.jpg`.
  - Use absolute production URLs for `og:image` and `og:url`.
