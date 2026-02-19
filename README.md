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

Create `job-assistant/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Optional legacy fallback
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx

NEXT_PUBLIC_STRIPE_PRICE_ID_WEEKLY=price_xxx_weekly
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_xxx_monthly
NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY=price_xxx_yearly

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

### 3.2 Backend (`job-assistant-api/.env.local`)

Create `job-assistant-api/.env.local`:

```bash
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_WEEKLY_PRICE_ID=price_xxx_weekly
STRIPE_MONTHLY_PRICE_ID=price_xxx_monthly
STRIPE_YEARLY_PRICE_ID=price_xxx_yearly

DMXAPI_API_KEY=sk_xxx
DMXAPI_RESPONSES_URL=https://www.dmxapi.cn/v1/responses
DMXAPI_PARSE_MODEL=hehe-tywd
DMXAPI_CHAT_URL=https://www.dmxapi.cn/v1/chat/completions
DMXAPI_CHAT_MODEL=gpt-5-mini

# Optional: future backend JWT verification
CLERK_SECRET_KEY=sk_test_xxx
```

Important:
- Current backend scripts read process env at runtime. Keep `.env.local` as your local source of truth.
- For local `npm run start:dev`, mirror it into `.env`:

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

- `GET /health`
- `POST /resume/upload`
- `GET /resume/:userId/latest`
- `POST /billing/checkout-session`
- `POST /billing/webhook`
- `GET /subscription/:userId`
- `GET /profile/:userId`
- `POST /profile`
- `GET /onboarding/:userId`
- `POST /onboarding/initialize`
- `POST /onboarding/sync`
- `POST /onboarding/step`
- `POST /ai/chat`

## 10. Troubleshooting

1. `column ... does not exist`
- Re-run `job-assistant-api/sql/init.sql` (schema is outdated).

2. `Could not find table 'public.onboarding_states' in schema cache`
- Ensure SQL script has been executed in the same Supabase project used by backend env.

3. Stripe success but subscription not updated
- Check webhook URL, enabled events, and `STRIPE_WEBHOOK_SECRET`.

4. AI chat returns quota/billing errors
- Check `GEMINI_API_KEY` validity and provider usage limits.

5. CORS errors
- Ensure backend `FRONTEND_URL` exactly matches frontend origin.
