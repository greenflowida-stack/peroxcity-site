# PeroXcity Mix — mobile app

Branch `mix-app` of peroxcity-site. Deployed by Netlify as the **peroxcity-mix** project (https://peroxcity-mix.netlify.app).

- `index.html` — the app (self-contained bundle; the welcome screen, mixing chart, job tools and chat).
- `netlify/functions/property.mjs` — satellite roof lookup backend (`/property`). Needs `GOOGLE_MAPS_KEY` in Netlify; `REGRID_TOKEN` optional.
- `netlify.toml`, `_redirects` — Netlify config.

Pushing to this branch redeploys the app once Netlify is linked to it.
