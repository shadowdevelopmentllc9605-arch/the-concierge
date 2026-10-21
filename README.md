# The Concierge

Shopper-facing application for **Shadow Development LLC's The Concierge** two-sided retail-shopping platform.

## Current architecture

- **GitHub**: source code and pull-request history.
- **Vercel**: separate Vite/React deployments for the shopper and retailer apps.
- **Supabase**: shared authentication, PostgreSQL data, row-level security and Storage.
- **Stripe**: payment integration; live-payment eligibility requires checkout, reconciliation and tax-readiness verification.

The legacy `src/api/base44Client.js` file is a Supabase-backed compatibility adapter for existing UI components. Its file name does **not** mean that the Base44 runtime is still in use. Do not reintroduce Base44 SDK or Vite packages.

## Building and testing

Use Node.js **24** to match the Vercel project and GitHub Actions validation setup. On Android with Termux, use an available supported Node installation; a computer is not required.

```sh
npm ci
npm test
npm run build
npm run lint
```

The checked-in `package-lock.json` must stay in sync with `package.json`. **Do not replace `npm ci` with `npm install` in CI** to conceal missing or mismatched lockfile entries. If dependencies change, regenerate and commit the lockfile and verify the resulting PR checks.

App configuration belongs in Vercel's protected project settings and Supabase/Stripe secrets—not in repository files. Only safe publishable frontend values may use `VITE_` names. Never expose a Stripe secret key or Supabase secret/service-role key in browser code.

## Phase One release boundary

The goal is a **controlled pilot with a small verified retailer catalog and real shoppers**, not nationwide coverage before launch.

Shopper criteria: reliable sign-in and onboarding without mandatory private body photos, catalog discovery, verifiable offer price/stock, wishlist/cart, checkout when commercially authorized, and correct post-purchase history.

- Sensitive body-scan uploads and other private-photo features must remain **off** until independent access-control, encryption, backup, and restore requirements pass.
- Do not turn on live checkout until payment, tax, stock, and refund readiness are explicitly verified.
- Never treat a `READY` deployment as a successful shopper-to-retailer end-to-end test.
- Use separate preview branches for changes, require checks and review evidence, and promote a **known tested commit** as a coordinated release.

## Companion application

- [The Concierge shopper](https://github.com/shadowdevelopmentllc9605-arch/the-concierge)
- [Concierge Pro retailer](https://github.com/shadowdevelopmentllc9605-arch/concierge-pro)

See the shopper repo's `docs/PHASE_ONE_RELEASE_BASELINE_2026-10-21.md` for an evidence-based release baseline and final pilot checklist.
