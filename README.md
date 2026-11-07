# Hostel Accommodation Registration System (India)

A simple, organized, and robust full-stack accommodation registration platform built with **React + Vite + TypeScript**, **Tailwind CSS**, **Framer Motion**, and **Supabase** (PostgreSQL, Auth, Edge Functions, Storage, RLS). All currency is in INR (₹) with Indian grouping (`toLocaleString('en-IN')`).

---

## 🛡️ The Golden Rule

> **"NOTHING GOES FORWARD UNTIL PAYMENT IS COMPLETED, enforced in the DATABASE and SERVER, never only in the UI."**

- **Only Paid Counts:** A registration counts toward totals and check-ins only when `payment_status` is `'paid'` or `'paid_at_desk'`.
- **Zero Reservations for Unpaid:** Pending, failed, expired, under-review, and refunded statuses never reserve spots and never block duplicates.
- **Strict Check-In:** Checked-in state is impossible inside the PostgreSQL database function `check_in_registration()` unless status is `paid` or `paid_at_desk`.
- **Server Authority:** The browser client has zero ability to update `payment_status`. Modifying payment fields is guarded by server-side triggers allowing only privileged `service_role` and administrative operations.

---

## 📁 Project Structure

```
├── supabase/
│   ├── migrations/
│   │   └── 20261106000000_hostel_schema.sql  # Complete schema, RLS, functions, triggers, storage
│   ├── seed.sql                               # Seed settings, 25 realistic registrations, profiles
│   └── functions/
│       ├── _shared/                           # CORS & Supabase client helpers
│       ├── create-registration/               # Form validation, locked rates, pending state
│       ├── lookup-pending/                    # Safe unexpired registration lookup
│       ├── get-registration-public/           # Safe public registration details by scan token
│       ├── create-payment-order/              # Mock/Razorpay order initialization
│       ├── payment-webhook/                   # Idempotent gateway webhook handler
│       ├── dev-simulate-payment/              # Dev test mode simulator (success/fail/timeout)
│       ├── send-confirmation/                 # Confirmation email HTML generator (email_outbox)
│       ├── upload-screenshot/                 # Private screenshot upload (under_review)
│       ├── mark-paid-at-desk/                 # Admin spot cash collection with required note
│       ├── refund/                            # Admin refund flow (blocks future check-in)
│       ├── review-screenshot/                 # Admin approval/rejection of payment proofs
│       └── check-in/                          # Staff verification and QR scan check-in
├── src/
│   ├── components/                            # Dedicated UI components (TiltCard, CountUp, etc.)
│   ├── context/                               # Theme, Auth, and Toast contexts
│   ├── lib/                                   # Formatters, API layer, and Supabase client
│   ├── pages/                                 # Guest registration, checkout, confirmation, QR scanner
│   │   └── admin/                             # Admin dashboard, table, review, settings, emails
│   ├── types/                                 # Strict TypeScript definitions
│   ├── App.tsx                                # Router configuration
│   └── main.tsx
├── .env.example                               # Environment template
└── package.json
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(The app includes a built-in interactive demo fallback initialized with the 25 seed records so you can immediately preview and test the UI, checkout flow, desk scanner, and admin dashboard without requiring an active Supabase project)*.

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Supabase Setup & Production Deployment

### 1. Create a Supabase Project
1. Log in to [database.new](https://database.new) and create a new project.
2. Note your **Project URL**, **Anon Key**, and **Service Role Key** under **Project Settings > API**.

### 2. Apply Database Migration & Seed Data
Using the Supabase CLI:
```bash
# Link your local repo to your Supabase project
supabase link --project-ref your-project-id

# Run migration
supabase db push

# Apply seed data (settings, 25 realistic registrations, test announcements)
supabase db execute --file supabase/seed.sql
```
*Alternatively, paste the contents of `supabase/migrations/20261106000000_hostel_schema.sql` and `supabase/seed.sql` into the Supabase Dashboard **SQL Editor** and run them.*

---

### 3. Create Admin & Volunteer Auth Users
In the Supabase Dashboard under **Authentication > Users**, create your staff users, or run this SQL snippet:

```sql
-- 1. Create Admin User
INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
VALUES ('a0000000-0000-0000-0000-000000000001', 'admin@hostel.in', '{"full_name": "Hostel Warden"}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Hostel Warden', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2. Create Volunteer User
INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
VALUES ('a0000000-0000-0000-0000-000000000002', 'volunteer@hostel.in', '{"full_name": "Rahul Sharma (Volunteer)"}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, role)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Rahul Sharma (Volunteer)', 'volunteer')
ON CONFLICT (id) DO UPDATE SET role = 'volunteer';
```

---

### 4. Configure Server-Side Function Secrets
Set the required server-side environment secrets in Supabase:
```bash
supabase secrets set DEV_SIMULATE_PAYMENTS=true
supabase secrets set RAZORPAY_KEY_ID=rzp_test_PLACEHOLDER_KEY_ID
supabase secrets set RAZORPAY_KEY_SECRET=PLACEHOLDER_SECRET_KEY
supabase secrets set RAZORPAY_WEBHOOK_SECRET=PLACEHOLDER_WEBHOOK_SECRET
```

> **Security Note:** Payment secret keys reside exclusively in Supabase environment secrets. The frontend client holds only the public key ID.

---

### 5. Deploy Edge Functions
Deploy all 10 Edge Functions:
```bash
supabase functions deploy create-registration
supabase functions deploy lookup-pending
supabase functions deploy get-registration-public
supabase functions deploy create-payment-order
supabase functions deploy payment-webhook
supabase functions deploy dev-simulate-payment
supabase functions deploy send-confirmation
supabase functions deploy upload-screenshot
supabase functions deploy mark-paid-at-desk
supabase functions deploy refund
supabase functions deploy review-screenshot
supabase functions deploy check-in
```

---

## 🧪 Testing the User Flows

### 1. Guest Registration & Live Pricing
- Visit `/` to fill out the registration form.
- Notice the **Live Order Summary**: changing check-in and check-out dates dynamically computes nights and animates total amount via `CountUp`.
- Pricing is locked from database settings (`per_night_fee` and `flat_fee`).

### 2. Checkout & Test Gateway Simulator
- On form submit, you are redirected to `/checkout/:scanToken`.
- The checkout card displays the circular SVG countdown timer (30-minute session window).
- Under the test mode simulator panel at the bottom of the checkout card:
  - Click **"Simulate Success"**: Marks payment as paid, generates a transaction reference, queues a rich confirmation email in `email_outbox`, and forwards to the confirmation ticket.
  - Click **"Simulate Failure"**: Sets payment status to `failed`, allowing the user to either retry or click **"Upload Screenshot"** to submit payment proof for administrator review.
  - Click **"Simulate Timeout"**: Triggers session expiration.

### 3. Check-in Desk Scanner (`/scan`)
- Log in with staff credentials or click **"Demo: Quick Sign-in as Volunteer"**.
- Enter or scan a token (e.g., `token_priya_002` for a paid booking).
- Click **"Confirm & Check In Guest"** to record the timestamp and staff name.
- Try entering an unpaid or refunded token (`token_varun_017` or `token_rahul_015`): the system blocks check-in with a prominent red security banner.

### 4. Admin Management (`/admin`)
- **Dashboard:** Live count-up cards showing Total Collected (INR), Confirmed Allotments, Unpaid/Failed, and Under Review Queue.
- **Registrations:** Full searchable and filterable table with CSV export. Click any row to slide open the side drawer to record **"Paid at Desk"** or issue **"Refunds"**.
- **Screenshot Review:** Queue for participant bank proofs with private image signed URLs, approval, and rejection with custom feedback notes.
- **Announcements & Users:** Full CRUD with modal dialogs and confirm prompts.
- **Settings:** Live adjustment of tariffs, expiry minutes, and refund policy text.
- **Email Outbox:** Preview rendered transactional emails, recipient details, and delivery statuses.

---

## 🔒 Security Best Practices Implemented

1. **Row Level Security (RLS):** Enabled on `profiles`, `settings`, `registrations`, `announcements`, and `email_outbox`. Unauthenticated anon visitors cannot query registrations directly.
2. **Partial Unique Indexes:** Unique constraint on `phone` and `lower(email)` enforced only `WHERE payment_status IN ('paid', 'paid_at_desk')`.
3. **Database Payment Trigger:** Protects `payment_status`, `amount`, and `transaction_id` against client-side tampering.
4. **Private Storage:** Bucket `payment-screenshots` is private; files are viewable only via time-limited signed URLs generated for authenticated staff.
