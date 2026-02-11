# job-assistant (frontend)

Frontend dashboard app based on Next.js 14.

For full-stack setup and deployment (Vercel + Render + Supabase + Stripe), use the root documentation:

- `../README.md`

## Quick local run

```bash
npm install
npm run dev
```

Create `job-assistant/.env.local` with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx
```
