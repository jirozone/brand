# Jiro brand

The source of truth for the brand values shared by Jiro's public sites:
[new-website](https://github.com/jirozone/new-website) (www.jiroco.com),
[apply](https://github.com/jirozone/apply) and [portal](https://github.com/jirozone/portal).
The repo is public on purpose: everything in it ships to browsers anyway, and the apps' CI can read
it without a token.

## What's here

- `tokens.json`: the brand font and the colour tokens every site shares, named after the shadcn
  roles all three use (`primary`, `muted-foreground`, …). Colours are HSL channels (`"240 100% 9%"`).
  Tailwind 4 apps (apply, portal) declare them as `hsl(240 100% 9%)`, the Tailwind 3 website as the
  bare channels.

App-specific tokens stay in each app: portal's credit-score risk scale and sidebar, the website's
hero colours, corner radius and focus ring (not yet aligned).

## How the apps use it

Each app commits a copy at `brand/tokens.json` and has:

- a unit test that fails if its stylesheet's `:root` drifts from the copy
- `node scripts/sync-brand.mjs` to refresh the copy from this repo's `main`, and
  `node scripts/sync-brand.mjs --check`, which CI runs to warn when the copy is behind

## Changing a brand value

1. Change `tokens.json` here and merge (`node scripts/check.mjs` validates it).
2. In each of new-website, apply and portal: run `node scripts/sync-brand.mjs`, update the
   stylesheet until the brand test passes, and open a PR.

Check contrast before changing a text colour: portal and apply run axe (WCAG 2.1 AA) in e2e.
