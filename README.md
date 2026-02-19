# JobbPin AI MVP

Full-stack MVP for:
- Clerk auth (`sign-in`, `sign-up`, Google login)
- 4-step onboarding flow
- resume upload + parsing
- Stripe subscriptions (weekly/monthly/yearly)
- AI chat assistant (Gemini)
- Supabase persistence

## 1. Repository Structure

```text
.
├── job-assistant/          # Next.js 14 frontend
├── job-assistant-api/      # NestJS backend
├── PROMPTS.md
└── README.md
```

## 2. Prerequisites

- Node.js `18.18+`
- npm `9+`
- Supabase project
- Stripe account (Test mode)
- Clerk application
- (Optional) Gemini API key for AI chat

## 3. Environment Variables

### 3.1 Frontend (`job-assistant/.env.local`)

Current frontend runtime config:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Stripe product mapping currently used by this repo
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1T0LYGRfV8PKE3SoYxwUpPKA
NEXT_PUBLIC_STRIPE_PRICE_ID_WEEKLY=price_1T0gscRfV8PKE3SoLMx0hTEz
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_1T0LYGRfV8PKE3SoYxwUpPKA
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_1T0Lb4RfV8PKE3So7S5VYaAV

# Public auth/payment keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from local env>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from local env>

# Server-side frontend secret
CLERK_SECRET_KEY=<from local env>
```

### 3.2 Backend (`job-assistant-api/.env.local` and `.env`)

Current backend runtime config (use the same values in both `.env.local` and `.env`):

```bash
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://bncrbwmulrfswcvpxvqq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from local env>

STRIPE_SECRET_KEY=<from local env>
STRIPE_WEBHOOK_SECRET=<from local env>
STRIPE_WEEKLY_PRICE_ID=price_1T0gscRfV8PKE3SoLMx0hTEz
STRIPE_MONTHLY_PRICE_ID=price_1T0LYGRfV8PKE3SoYxwUpPKA
STRIPE_YEARLY_PRICE_ID=price_1T0Lb4RfV8PKE3So7S5VYaAV

# Optional provider keys in local backend env
OPENAI_API_KEY=<from local env>
OPENAI_MODEL=gpt-4.1-mini
GEMINI_API_KEY=<from local env>
GEMINI_MODEL=gemini-2.5-flash
DMXAPI_API_KEY=<from local env>
DMXAPI_RESPONSES_URL=https://www.dmxapi.cn/v1/responses
DMXAPI_PARSE_MODEL=hehe-tywd
DMXAPI_CHAT_URL=https://www.dmxapi.cn/v1/chat/completions
DMXAPI_CHAT_MODEL=gpt-5-mini

# Optional (future backend JWT verification)
CLERK_SECRET_KEY=<from local env>
```

Important:
- This repository enforces GitHub secret scanning. Real secret values stay in local `.env` files.
- For local `npm run start:dev`, mirror `.env.local` into `.env`:

```bash
cp job-assistant-api/.env.local job-assistant-api/.env
```

## 4. Database Setup (Supabase)

Run `job-assistant-api/sql/init.sql` in Supabase SQL Editor.

Creates/updates tables:
- `profiles`
- `resumes`
- `subscriptions`
- `onboarding_states`
- `users`

Important behavior:
- `users` row is created/upserted only when onboarding is completed (`step=4` + `is_completed=true`).
- `users.clerk_user_id` is unique identity key.
- `profiles` includes onboarding fields: `first_name`, `last_name`, `country`, `city`, `linkedin_url`, `portfolio_url`, `allow_linkedin_analysis`, `employment_types`, `profile_skipped`.
- `onboarding_states.current_step` supports `1..4`.

## 5. Local Development

### 5.1 Install

```bash
cd job-assistant && npm install
cd ../job-assistant-api && npm install
```

### 5.2 Start backend

```bash
cd job-assistant-api
npm run start:dev
```

Health check:

```bash
curl http://localhost:4000/health
```

### 5.3 Start frontend

```bash
cd job-assistant
npm run dev
```

Open:
- `http://localhost:3000`
- `http://localhost:3000/sign-in`
- `http://localhost:3000/onboarding`
- `http://localhost:3000/dashboard`

## 6. Auth + Onboarding Flow

1. User signs in/signs up (email/password or Google via Clerk).
2. Redirect to `/onboarding`.
3. Complete 4 steps:
- Step 1 target role
- Step 2 profile basics
- Step 3 links (optional)
- Step 4 employment type
4. On completion:
- onboarding marked complete
- `users` table upserted
- redirect to dashboard

## 7. Stripe Subscription Rules

Plans:
- Weekly
- Monthly
- Yearly

Trial rule:
- Only weekly supports free trial logic.
- Trial applies to first-time subscription only.
- If user subscribed before, no trial.

Webhook endpoint:
- `POST /billing/webhook`

Enable Stripe events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 8. Deploy

### 8.1 Frontend (Vercel)

Root directory: `job-assistant`

Required env:
- `NEXT_PUBLIC_API_BASE_URL=https://<render-backend-domain>`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PRICE_ID_WEEKLY`
- `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`

### 8.2 Backend (Render)

Root directory: `job-assistant-api`

Build:

```bash
npm install && npm run build
```

Start:

```bash
npm run start:prod
```

Required env:
- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_WEEKLY_PRICE_ID`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`
- `DMXAPI_API_KEY`
- `DMXAPI_RESPONSES_URL`
- `DMXAPI_PARSE_MODEL`
- `DMXAPI_CHAT_URL`
- `DMXAPI_CHAT_MODEL`

## 9. API Summary

Health:
- `GET /health`

Profile:
- `GET /profile/:userId`
- `POST /profile`

Onboarding:
- `GET /onboarding/:userId`
- `POST /onboarding/initialize`
- `POST /onboarding/sync`
- `POST /onboarding/step`

Resume:
- `POST /resume/upload`
- `GET /resume/:userId/latest`
- `GET /resume/:userId/history?limit=12`
- `PUT /resume/:userId/latest`
- `DELETE /resume/:userId/history/:resumeId`

Billing / Stripe:
- `POST /billing/checkout-session`
- `POST /billing/webhook`
- `GET /subscription/:userId`
- `POST /subscription/:userId/cancel`

AI:
- `POST /ai/chat`
- `POST /ai/implement-plan`
- `POST /ai/rollback-resume`

## 10. Troubleshooting

1. `column ... does not exist` / DB mismatch:
- Re-run `job-assistant-api/sql/init.sql`.

2. `Could not find table 'public.onboarding_states'`:
- Ensure backend points to the same Supabase project where SQL init was run.

3. Stripe checkout success but subscription not synced:
- Verify webhook URL and `STRIPE_WEBHOOK_SECRET`.
- Ensure enabled events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

4. Plan label shows raw `price_...` string:
- Ensure frontend `NEXT_PUBLIC_STRIPE_PRICE_ID_*` matches backend Stripe price IDs exactly.

5. Resume parse fails:
- Check `DMXAPI_API_KEY`.
- DMX unavailable will fall back to `pdf-parse` (lower structure quality).
- Use selectable-text PDFs (avoid image-only scans).

6. AI chat no response / quota errors:
- Verify DMX account quota and model permissions.
- Check `POST /ai/chat` payload and returned `reply`.

7. CORS / Clerk session issues:
- Ensure `FRONTEND_URL` matches frontend origin.
- Ensure Clerk publishable/secret keys are from the same Clerk app.

## 11. External Integrations and API Links

Clerk:
- Dashboard: https://dashboard.clerk.com/
- Docs: https://clerk.com/docs

Stripe:
- Dashboard (test mode): https://dashboard.stripe.com/test/dashboard
- API docs: https://docs.stripe.com/api
- Webhooks docs: https://docs.stripe.com/webhooks

Supabase:
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- Current project URL: `https://bncrbwmulrfswcvpxvqq.supabase.co`

DMX API:
- Parse endpoint: `https://www.dmxapi.cn/v1/responses`
- Chat endpoint: `https://www.dmxapi.cn/v1/chat/completions`

## 12. Resume Parse + AI Data Analysis Flow

1. PDF upload:
- Frontend uploads to `POST /resume/upload`.

2. Resume structuring:
- DMX parse extracts and structures `basics / skills / experiences / education`.
- Fallback path uses local `pdf-parse` + rules if DMX is unavailable.

3. AI scoring:
- Backend produces `aiAssessment`:
  - score `0-100`
  - why-this-score summary
  - strengths
  - actionable improvements
- Primary model path: DMX chat model.
- Fallback path: heuristic scoring by section completeness.

4. Versioned persistence:
- Parsed result stored in Supabase `resumes`.
- History loaded by `GET /resume/:userId/history`.
- Editor updates saved by `PUT /resume/:userId/latest`.

5. AI revision loop:
- `POST /ai/chat` creates suggestions/plans.
- `POST /ai/implement-plan` applies rewrite plan.
- `POST /ai/rollback-resume` restores previous version.

## 13. Big-Bug Checklist (Critical Paths)

- Stripe webhook/event misconfiguration causes stale subscription status.
- Frontend/backed price-id mismatch shows wrong plan labels.
- Image-only PDFs reduce parse quality and downstream scoring quality.
- Provider quota/key issues break AI chat/parse behavior.
- Clerk key/environment mismatch causes auth/session instability.
