# Parasale

An e-commerce storefront platform for hardware, tools, and repeat supply ordering.

## Architecture

- **Frontend**: React 19 + Vite, runs on port 5000
- **Backend**: Node.js + Express 5, runs on port 3001
- **Database/Auth**: Supabase (PostgreSQL)
- **Payments**: Razorpay (optional)

## Project Structure

```
client/          # React frontend (Vite)
  src/
    api/         # Axios API client (proxied via /api to backend)
    components/  # Reusable UI components
    lib/         # Utilities (supabase client, razorpay loader)
    pages/       # Route pages (Home, Products, Cart, Checkout, Admin)
    store/       # Zustand stores (authStore, cartStore)
server/          # Express backend API
  sql/           # SQL migration/patch files
  index.js       # API routes + Razorpay webhook handler
```

## Development

- Frontend workflow: `cd client && npm run dev` (port 5000)
- Backend workflow: `cd server && node index.js` (port 3001)
- Frontend proxies `/api/*` to the backend via Vite proxy

## Environment Variables / Secrets Required

- `VITE_SUPABASE_URL` — Supabase project URL (frontend)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (frontend)
- `SUPABASE_URL` — Supabase project URL (backend)
- `SUPABASE_KEY` — Supabase service role key (backend)
- `RAZORPAY_KEY_ID` — Razorpay key ID (optional, for payments)
- `RAZORPAY_KEY_SECRET` — Razorpay secret (optional, for payments)
- `RAZORPAY_WEBHOOK_SECRET` — Razorpay webhook secret (optional)

## Key Features

- Category-based product browsing
- Shopping cart with Zustand state management
- Razorpay payment integration
- Admin dashboard for product/order management
- Order state machine: Cart → Checkout → Paid → Confirmed → Dispatched → Delivered
