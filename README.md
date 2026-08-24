# Regency Salma

Regency Salma is a resident, community, and gate-operations MVP for a residential community. It has an Expo/React Native client and an Express/Prisma API backed by PostgreSQL.

## What is built

- Resident onboarding, household membership, and family-member records
- Pre-approved guest passes with a generated six-digit OTP
- Gate verification for security staff: guest OTP validation and check-in/check-out
- Cab, delivery, and service-provider entry without OTP when pre-approved
- Unannounced cab/delivery/service arrivals that notify the resident for approval or rejection
- Visitor and gate-entry history, including approvals and entry events
- Help-desk / maintenance workflows and manager assignment controls
- Security-focused workforce workspace: gate operations and activity, without resident-maintenance task controls
- Community spaces, announcements, polls, announcement detail, and activity history
- Resident home dashboard, linked service cards, and per-user persistent Quick Action preferences
- Community workforce onboarding for security, housekeeping, house help, maintenance, electricians, plumbers, gardeners, drivers, and related roles

## Intentionally unavailable

These screens/features are disabled rather than shown as non-functional UI:

- **Lost & Found** — no backend route or persistence model yet
- **Calendar** — no event storage or API yet

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+ (local or hosted)
- Expo Go on a device, an Android/iOS simulator, or a browser for the frontend

## Quick start

Install dependencies once:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 1. Configure the backend

Create `backend/.env` from `backend/.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/regency_salma?schema=public"
JWT_ACCESS_SECRET="replace-with-a-long-random-secret"
JWT_REFRESH_SECRET="replace-with-a-different-long-random-secret"
PORT=3000

# For Expo web and deployed clients. Comma-separate multiple origins.
CORS_ALLOWED_ORIGINS="http://localhost:8081"

# Used when generating password-reset links.
FRONTEND_URL="http://localhost:8081"
```

Create the database, then apply the Prisma schema:

```bash
cd backend
npx prisma generate
npx prisma db push
npm run dev
```

The API should now be available at `http://localhost:3000`. Confirm it with:

```bash
curl http://localhost:3000/health
```

### 2. Configure the frontend

Create `frontend/.env` from `frontend/.env.example`:

```env
# Web / simulator on the same computer
EXPO_PUBLIC_API_URL=http://localhost:3000
```

For a physical device running Expo Go, use the computer's LAN address instead of `localhost`, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Start the client:

```bash
cd frontend
npm start
```

Then scan the Expo QR code, or run `npm run android`, `npm run ios`, or `npm run web`.

## API keys and secrets

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_ACCESS_SECRET` | Yes | Signs short-lived access tokens. Use a long random value. |
| `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens. Use a different long random value. |
| `EXPO_PUBLIC_API_URL` | Yes for frontend | Public base URL of the Express API. |
| `PORT` | No | API port; defaults to `3000`. |
| `CORS_ALLOWED_ORIGINS` | Recommended | Comma-separated frontend origins permitted by the API. |
| `FRONTEND_URL` | Recommended | Base URL used in password-reset links. |
| `EMAIL_PROVIDER` | No | Set to `resend` only when production email delivery is wanted. |
| `RESEND_API_KEY` | Only with Resend | Resend API key for password-reset email delivery. |
| `EMAIL_FROM` | Only with Resend | Verified sender address, e.g. `support@yourdomain.com`. |

No maps, payment, SMS, or push-notification API keys are required for the current MVP. Without an email provider, development continues normally; email delivery is logged/skipped according to the server environment.

Never commit `.env` files or production secrets.

## Verification

Run type checks:

```bash
cd frontend && npm run typecheck
cd ../backend && npm run typecheck
```

Run the gate and resident visitor workflow tests (requires the configured test database):

```bash
cd backend
npx jest tests/visitors.test.ts tests/visitor-gate-approval.test.ts --runInBand
```

Those tests cover resident approval, six-digit guest OTP generation, invalid/valid OTP verification, unannounced delivery alerts, resident confirmation, and no-OTP delivery entry.

## Project layout

```text
frontend/     Expo Router React Native application
backend/      Express API, Prisma schema, migrations, and Jest tests
```

## Important operational notes

- Guest passes require OTP verification at the gate.
- Cab, delivery, and service-provider passes do not require an OTP after resident pre-approval; security records/confirm entry instead.
- An unannounced cab, delivery, or service provider creates a resident alert before entry is allowed.
- Quick Action visibility/order is saved locally per signed-in user on that device.
