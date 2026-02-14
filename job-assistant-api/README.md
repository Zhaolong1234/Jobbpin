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

Create `.env` from `.env.example`.

Required for core features:
- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_WEEKLY_PRICE_ID`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`

Optional:
- `GEMINI_API_KEY`, `GEMINI_MODEL` (AI chat)
- `CLERK_SECRET_KEY` (future backend JWT verification phase)

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

## 5. Notes

- Current API still accepts `userId` from request path/body.
- Frontend uses Clerk identity and sends user id to backend.
- Next hardening step: verify Clerk JWT in backend and derive user id from token (`sub`).

For complete full-stack deployment instructions, see root `../README.md`.
