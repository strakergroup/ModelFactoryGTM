# arbitr Model Factory

Internal app where the model team fills in a go-to-market fact pack for each
custom model, publishes it, and Product, Marketing, Security & Legal and RevOps
review it. A pack becomes **Launch-ready** when all four sign-offs are on its
latest published version.

- Next.js 16 on Vercel; each pack is one private JSON file in Vercel Blob.
- Sign-in: one shared password plus a self-reported name (names are recorded
  on edits, comments and sign-offs but are not verified identities).
- Fields, sections and disclosure tags (Public / Under NDA / Internal) live in
  `lib/fields.ts`; add a field by adding one line there.

## Environment variables (set in Vercel, never in this repo)

| Name | Purpose |
| :- | :- |
| `FACT_PACK_PASSWORD` | Shared sign-in password |
| `BLOB_READ_WRITE_TOKEN` | Set automatically when the Blob store is connected |

## Develop

```bash
npm install
npm run build
```
