# job-assistant-api (backend)

NestJS backend with controller/service/module structure.

For full setup and deployment instructions, use root documentation:

- `../README.md`

## Quick local run

```bash
npm install
npm run start:dev
```

Create `job-assistant-api/.env` based on `.env.example` before running Stripe or Supabase integrations.

## Current controllers

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

## users table lifecycle

- `public.users` is written only when onboarding is completed (`step=4`, `isCompleted=true`).
- Identity key is `clerk_user_id` (or dev fallback id when Clerk is disabled).
