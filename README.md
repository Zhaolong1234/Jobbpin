# Job Assistant MVP

Deployable full-stack baseline for:
- resume upload + structured parsing
- onboarding progress in dashboard
- Stripe subscription (test mode)
- Supabase persistence

Current stage skips Clerk authentication and uses `dev_user_id`.

## 1. Repository Structure

```text
.
├── job-assistant/          # Next.js 14 frontend
├── job-assistant-api/      # NestJS backend (controller/service/module)
├── PROMPTS.md
└── README.md
```

## 2. Prerequisites

- Node.js `18.18+`
- npm `9+`
- Stripe account (Test mode)
- Supabase project
- Vercel account (frontend deploy)
- Render account (backend deploy)

## 3. Environment Variables

### 3.1 Frontend (`job-assistant/.env.local`)

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx
```

### 3.2 Backend (`job-assistant-api/.env`)

```bash
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

GEMINI_API_KEY=AIzaSy_xxx
GEMINI_MODEL=gemini-2.5-flash
```

## 4. Supabase Setup

Run SQL in `job-assistant-api/sql/init.sql` via Supabase SQL editor.

Tables created:
- `profiles`
- `resumes`
- `subscriptions`

## 5. Local Development

## 5.1 Install dependencies

```bash
cd job-assistant
npm install

cd ../job-assistant-api
npm install
```

## 5.2 Start backend

```bash
cd job-assistant-api
npm run start:dev
```

Backend health check:

```bash
curl http://localhost:4000/health
```

## 5.3 Start frontend

```bash
cd job-assistant
npm run dev
```

Open:
- frontend: `http://localhost:3000`
- dashboard: `http://localhost:3000/dashboard`

## 6. Stripe Test Mode Setup

1. In Stripe Dashboard (Test mode), create:
- Product
- Monthly recurring Price

2. Put Price ID into frontend:
- `NEXT_PUBLIC_STRIPE_PRICE_ID`

3. Configure webhook endpoint:
- Local: use Stripe CLI forwarding to `http://localhost:4000/billing/webhook`
- Cloud: use Render URL `https://<render-service>/billing/webhook`

4. Add webhook signing secret to backend:
- `STRIPE_WEBHOOK_SECRET`

Test card:
- `4242 4242 4242 4242`
- any future date / any CVC / any ZIP

## 7. Deployment

## 7.1 Frontend on Vercel

1. Import repository.
2. Set root directory: `job-assistant`
3. Build command: default (`next build`)
4. Add env:
- `NEXT_PUBLIC_API_BASE_URL=https://<render-backend-domain>`
- `NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx`
5. Deploy.

## 7.2 Backend on Render

1. Create a new Web Service from repo.
2. Root directory: `job-assistant-api`
3. Build command:

```bash
npm install && npm run build
```

4. Start command:

```bash
npm run start:prod
```

5. Add env vars:
- `PORT`
- `FRONTEND_URL` (your Vercel domain)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
6. Deploy.

## 7.3 Stripe webhook (cloud)

After Render deploy:
1. Set webhook URL to `https://<render-domain>/billing/webhook`
2. Enable events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
3. Copy webhook secret to Render env `STRIPE_WEBHOOK_SECRET`

## 8. API Endpoints

### Health
- `GET /health`

### Resume
- `POST /resume/upload` (multipart: `file`, `userId`)
- `GET /resume/:userId/latest`

### Billing
- `POST /billing/checkout-session`
- `POST /billing/webhook`

### Subscription
- `GET /subscription/:userId`

## 9. Common Troubleshooting

1. `Only PDF files are supported`
- Ensure uploaded file MIME is `application/pdf`.

2. Stripe checkout fails with missing key
- Check `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PRICE_ID`.

3. Checkout success but status not updated
- Verify webhook endpoint availability and signature secret.

4. Supabase write failure
- Verify `SUPABASE_SERVICE_ROLE_KEY`.
- Ensure SQL initialization script has been executed.

5. CORS error
- Set backend `FRONTEND_URL` to exact frontend origin.

## 10. Clerk Integration (Next Phase)

Current stage uses `dev_user_id`. To integrate Clerk later:

1. Frontend env (Vercel):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

2. Backend env:
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER`

3. Replacement steps:
- Replace `dev_user_id` with Clerk `user.id` on frontend.
- Add auth guard/middleware on backend to verify Clerk JWT.
- Protect `/dashboard` and backend private endpoints.

4. Main touch points:
- `job-assistant/src/lib/config.ts` (`DEV_USER_ID`)
- all frontend API calls currently sending static `userId`
- backend controllers currently accepting `userId` from request
