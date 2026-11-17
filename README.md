# Made in the Mood website

Ashley's jewelry storefront. Customers browse pieces and email Ashley to order; payment is by Venmo.

## How Ashley updates it

Ashley edits the shop at **https://app.pagescms.org** (invited by email; no GitHub account needed).

- **Pieces**: add, edit, hide or delete bracelets and necklaces, with photos, price, availability, sizes, materials and description.
- **Shop details**: email, Venmo, Instagram, TikTok, turnaround time and her story.

Each save publishes automatically. The live site updates about a minute later.

## How it works

| Path | What it is |
| --- | --- |
| `content/pieces/*.json` | One file per piece, written by Pages CMS |
| `content/settings.json` | Shop details |
| `media/uploads/` | Photos Ashley uploads (originals) |
| `media/site/` | Logo and Ashley's photo |
| `src/` | Page template, styles and script |
| `src/3d/<piece-name>.html` | Optional interactive 3D view of a piece. If the file exists, that piece's page gets a "3D" tile next to its photos |
| `scripts/build.mjs` | Builds `_site/`: resizes photos to 600 px and 1400 px, writes the home page and one page per piece (`/pieces/<name>/`) for link previews |
| `.pages.yml` | The editor's forms (Pages CMS config) |
| `.github/workflows/deploy.yml` | Builds and publishes to GitHub Pages on every push to `main` |

Local preview: `npm install && npm run build`, then serve `_site/`.

Candy Jade is the only collection; its section appears once a piece is tagged with it. Aurum and Aura are on the back burner (removed from the editor and site; add them back in `.pages.yml`, `scripts/build.mjs` and `src/app.js`).
