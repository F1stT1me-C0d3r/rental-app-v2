# Rental App v2 — test build

Customer + admin roles, vehicle management, lockbox pickup codes. SQLite for local testing; Postgres when deployed.

Plan: `docs/implementation-plan.md`

## Run locally (5 minutes)

```bash
# terminal 1
cd api
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev            # http://localhost:4000

# terminal 2
cd web
npm install
npm run dev            # http://localhost:5173
```

Logins (seeded, password `changeme`): `owner@example.com` (admin), `customer@example.com`, `customer2@example.com`.

The seed includes a confirmed, paid booking for the customer whose pickup window is open **now**, so "Get lockbox code" works immediately.

## Test checklist
See `docs/test-checklist.md`.

## Deploy (staging)
1. `api/prisma/schema.prisma`: provider `sqlite` → `postgresql`; delete `api/prisma/migrations`; `npx prisma migrate dev --name init` against Postgres.
2. Railway: Postgres + service with root `api/`; set `JWT_SECRET`, `LOCKBOX_KEY`, `CORS_ORIGIN`; health check `/health`.
3. Vercel: root `web/`, `VITE_API_URL` = Railway URL.
