# LeadershipTap Portal

An internal coaching portal for a small leadership team. Built with Next.js, Clerk authentication, and Airtable as the data source.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Auth**: Clerk (Microsoft 365 / Google SSO)
- **Data**: Airtable (server-side only — API key never exposed to browser)
- **UI**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel

## Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account with an application created
- An [Airtable](https://airtable.com) account with the LeadershipTap base and a Personal Access Token

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/gabrielasie/leadershiptap-portal.git
cd leadershiptap-portal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```env
# Airtable
AIRTABLE_API_KEY=pat...          # Personal Access Token (starts with "pat")
AIRTABLE_BASE_ID=app...          # Base ID from Airtable URL (starts with "app")

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/users
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/users
```

**Where to find these values:**
- Airtable token: [airtable.com/create/tokens](https://airtable.com/create/tokens) — create a token with `data.records:read`, `data.records:write`, `schema.bases:read` scopes
- Airtable Base ID: found in your base URL → `airtable.com/YOUR_BASE_ID/...`
- Clerk keys: Clerk Dashboard → your app → API Keys

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/sign-in`.

## Project Structure

```
app/
├── (protected)/          # Auth-protected routes
│   ├── layout.tsx        # Server-side auth check via Clerk
│   ├── users/
│   │   ├── page.tsx      # Users directory
│   │   └── [id]/
│   │       └── page.tsx  # User detail + meetings
├── sign-in/[[...sign-in]]/
│   └── page.tsx
├── sign-up/[[...sign-up]]/
│   └── page.tsx
└── page.tsx              # Redirects to /users

lib/
├── airtable/             # Low-level Airtable fetch functions
│   ├── users.ts
│   └── meetings.ts
└── services/             # Business logic layer
    ├── usersService.ts
    └── meetingsService.ts

proxy.ts                  # Clerk auth middleware
```

## What's Working (Week 3)

- ✅ Clerk authentication (sign in / sign out)
- ✅ Protected routes — unauthenticated users redirected to sign-in
- ✅ Users Directory page — pulls live data from Airtable
- ✅ User Detail page — shows profile fields from Airtable
- ✅ Meetings section — fetches Calendar Events from Airtable
- ✅ Deployed to Vercel (staging)

## What's Next (Week 4)

- Meeting Detail view
- Filter/search on Users Directory
- Microsoft 365 SSO configuration
- Polish UI with shadcn/ui components

## Deployment

The app is deployed to Vercel and auto-deploys on every push to `main`.

Staging URL: [leadershiptap-portal.vercel.app](https://leadershiptap-portal.vercel.app)

Remember to add all `.env.local` variables to Vercel → Settings → Environment Variables.
