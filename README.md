# LeadershipTap Portal

An internal coaching portal for a small leadership team. Built with Next.js 16, Clerk authentication, and Airtable as the data source.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Auth**: Clerk (Microsoft 365 / Google SSO)
- **Calendar**: Microsoft Graph API (app-only, reads coach calendar events)
- **Data**: Airtable (server-side only — API key never exposed to browser)
- **UI**: Tailwind CSS + shadcn/ui
- **File uploads**: Cloudinary (profile photos)
- **Hosting**: Vercel

## Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account with an application created
- An [Airtable](https://airtable.com) base with the LeadershipTap schema and a Personal Access Token
- An Azure app registration with `Calendars.Read` (application permission) granted

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/gabrielasie/leadershiptap-portal.git
cd leadershiptap-portal
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Airtable
AIRTABLE_API_KEY=pat...           # Personal Access Token (starts with "pat")
AIRTABLE_BASE_ID=app...           # Base ID from Airtable URL

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Microsoft Graph (calendar sync only)
AZURE_TENANT_ID=...               # Azure AD tenant ID
AZURE_CLIENT_ID=...               # App registration client ID
AZURE_CLIENT_SECRET=...           # App registration client secret
GRAPH_COACH_EMAIL=coach@domain.com
GRAPH_COACH_EMAIL_2=coach2@domain.com

# Cloudinary (profile photo uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_UPLOAD_PRESET=...
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/sign-in`.

---

## Architecture

### Airtable tables

| Table | Purpose |
|---|---|
| **Users** | All people — coaches, admins, clients. `Role` field distinguishes them. |
| **Portal Calendar Events** | Active calendar table. Synced from Microsoft Graph via `/api/calendar/sync`. Fields: Subject, Start, End, Provider Event ID, Participant Emails, Notes, Note Name. |
| **Calendar Events** | Archived — historical snapshot only. Never queried by the portal. |
| **Coach-Person Context** | Per coach ↔ client pair: Quick Notes, Family Details. One record per pair. |
| **Coach Session** | Per coach ↔ meeting pair: Session Notes, Action Items. One record per meeting per coach. |
| **Messages** | Follow-up email drafts. Status: `"Pending"` or `"Sent"` (never `"Draft"`). |
| **Tasks** | Portal action items linked to clients. |
| **Notes** | Free-form coaching notes NOT tied to a specific meeting. |
| **Companies** | Company records linked from Users. |
| **Enneagram / 16Personalities / Conflict Postures / Apology Languages / Strengths** | Lookup tables for personality fields. |

### Auth layers

There are two separate auth systems that never interact:

**Clerk** — app login. Every browser session is authenticated via Clerk. `getCurrentUserRecord()` resolves the Clerk session to an Airtable Users record by email. Role (`admin` / `coach` / `client`) comes from Clerk `publicMetadata.role` as the source of truth; Airtable `Role` field is a fallback.

**Microsoft Graph** — calendar data only. Uses client credentials (app-only) flow — no user login required. Called exclusively from the `/api/calendar/sync` route handler. The access token is never stored; it is fetched fresh on each sync.

### Note model

Notes live in three places depending on their scope:

| Scope | Table | When to use |
|---|---|---|
| General client facts | **Users** record | Persistent profile fields (name, birthday, etc.) |
| Coach ↔ client context | **Coach-Person Context** | Quick Notes, Family Details — per coach/person pair |
| Session notes | **Coach Session** | Notes captured during or after a specific meeting |

**Reading order** (most specific wins): Coach Session → Coach-Person Context → User record.

Quick Notes and Family Details are written to Coach-Person Context, never to the User record directly. `upsertCoachPersonContext()` is the only write path.

Session Notes are written to Coach Session via `upsertCoachSession()`. The Calendar Event `Notes` field is a legacy fallback for records that pre-date the Coach Session table.

### View modes

Coaches can toggle between **Coach View** (sees only their own clients) and **Admin View** (sees all clients). The toggle is in the sidebar.

- The current mode is stored in the `lt_view_mode` cookie (readable server-side).
- `ViewModeProvider` (client) syncs the cookie with `localStorage` and exposes `useViewMode()`.
- Server components read the cookie directly via `next/headers` cookies to filter data before rendering.
- `getUsers(sessionUser, filterByCoachId?)` applies the filter — when `filterByCoachId` is set, only users whose `coachIds` array includes that ID are returned.

### Calendar sync

`POST /api/calendar/sync` fetches events for both coach emails (`GRAPH_COACH_EMAIL`, `GRAPH_COACH_EMAIL_2`) from the last 90 days to 30 days ahead, then upserts them into Airtable Calendar Events using `Provider Event ID` as the stable identity key. The "Sync Calendar" button is visible in the dashboard in Admin View only.

---

## Project Structure

```
app/
├── (protected)/
│   ├── layout.tsx            # ViewModeProvider + auth
│   ├── dashboard/            # Main dashboard
│   ├── users/
│   │   ├── page.tsx          # Clients directory
│   │   └── [id]/
│   │       ├── page.tsx      # Client profile
│   │       └── sessions/[meetingId]/   # Session detail
│   └── meetings/[id]/        # Meeting detail (coach-view)
├── api/
│   ├── calendar/sync/        # Microsoft Graph → Airtable upsert
│   └── upload-photo/         # Cloudinary → Airtable avatar
├── context/
│   └── ViewModeContext.tsx   # Coach/Admin view toggle
└── actions/
    └── viewMode.ts           # Server action: set lt_view_mode cookie

lib/
├── airtable/                 # Low-level Airtable fetch functions (no SDK)
│   ├── users.ts
│   ├── meetings.ts
│   ├── coachPersonContext.ts
│   ├── coachSessions.ts
│   ├── calendarEvents.ts
│   ├── messages.ts
│   ├── notes.ts
│   └── tasks.ts
├── graph/                    # Microsoft Graph helpers
│   ├── auth.ts               # getGraphAccessToken (client credentials)
│   └── calendar.ts           # fetchCalendarEvents
├── services/                 # Business logic (uses lib/airtable/*)
│   ├── usersService.ts
│   ├── meetingsService.ts
│   └── messagesService.ts
└── auth/
    ├── getCurrentUserRecord.ts   # Clerk → Airtable record resolver
    ├── getSessionUser.ts
    └── isAuthorized.ts
```

## Deployment

Auto-deploys to Vercel on every push to `main`. Add all `.env.local` variables to Vercel → Settings → Environment Variables.
