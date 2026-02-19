# job-assistant-api

NestJS backend for JobbPin AI MVP.

Main capabilities:
- onboarding state management
- profile persistence
- resume upload + parsing
- Stripe checkout + webhook sync
- subscription status query
- AI chat endpoint

## 1. Quick Start

```bash
npm install
npm run start:dev
```

Build check:

```bash
npm run build
```

## 2. Environment

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

For local `npm run start:dev`, mirror it into `.env`:

```bash
cp .env.local .env
```

## 3. Database Schema

Run:
- `sql/init.sql`

Tables used:
- `profiles`
- `resumes`
- `subscriptions`
- `onboarding_states`
- `users`

Important rule:
- `users` is created/upserted only when onboarding is completed (`step=4`, `isCompleted=true`).

## 4. HTTP Endpoints

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
- `POST /ai/implement-plan`
- `POST /ai/rollback-resume`

## 5. Notes

- Current API still accepts `userId` from request path/body.
- Frontend uses Clerk identity and sends user id to backend.
- Next hardening step: verify Clerk JWT in backend and derive user id from token (`sub`).

For complete full-stack deployment instructions, see root `../README.md`.
