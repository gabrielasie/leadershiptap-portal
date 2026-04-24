# LeadershipTap Portal — Claude Context

## Key files at a glance

| File | What it does |
|---|---|
| `lib/auth/getCurrentUserRecord.ts` | Resolves Clerk session → Airtable Users record. Always call this in server actions that need the coach's Airtable ID. |
| `lib/airtable/users.ts` | CRUD for Users table. `updateUserProfile()` is the main write path for profile edits. Never write `Quick Notes` / `Family Details` here — use Coach-Person Context. |
| `lib/airtable/coachPersonContext.ts` | Per coach ↔ client pair notes (Quick Notes, Family Details, Relationship Flags). |
| `lib/airtable/coachSessions.ts` | Per coach ↔ meeting session notes and action items. |
| `lib/airtable/calendarEvents.ts` | Upserts Calendar Events from Microsoft Graph. Matches by `Provider Event ID`. |
| `lib/graph/auth.ts` | `getGraphAccessToken()` — client credentials token for Microsoft Graph. |
| `lib/graph/calendar.ts` | `fetchCalendarEvents()` — reads a user's calendarView from Graph. |
| `lib/services/meetingsService.ts` | `deduplicateMeetings()` deduplicates by `providerEventId` first, falls back to `title|startTime`. |
| `app/context/ViewModeContext.tsx` | `useViewMode()` — exposes `isAdminView`, `isCoachView`, `currentCoachAirtableId`. |
| `app/actions/viewMode.ts` | `setViewModeCookie(mode)` server action — sets `lt_view_mode` cookie. |
| `app/api/calendar/sync/route.ts` | POST — fetches Graph events for both coach emails, upserts to Airtable. Requires Clerk session. |

## Airtable field map

### Calendar Events
| Airtable field | Notes |
|---|---|
| `Note Name` | Primary field (auto-named) |
| `EventName` | Meeting title |
| `StartTime` | ISO 8601 DateTime |
| `EndTime` | ISO 8601 DateTime |
| `SenderEmail` | Organiser / coach email |
| `ParticipantEmails` | Comma-separated string |
| `Provider Event ID` | Stable Microsoft Graph event ID — used for dedup |
| `Session Status` | Single select: `Completed`, `Scheduled`, `Cancelled` |
| `Action Items` | Long text |
| `Notes` | Long text — legacy; prefer Coach Session for new writes |
| `EventID` | Legacy external ID field — not used for dedup |

### Coach-Person Context
| Airtable field | Notes |
|---|---|
| `Coach` | Linked → Users (coach record IDs) |
| `Person` | Linked → Users (client record IDs) |
| `Quick Notes` | Free-text coaching notes |
| `Family Details` | Free-text |
| `Relationship Flags` | Multi-select |
| `Last Updated` | Date — written on every upsert |

### Coach Session
| Airtable field | Notes |
|---|---|
| `Coach` | Linked → Users (coach record IDs) |
| `Calendar Event` | Linked → Calendar Events |
| `Focal Person` | Linked → Users (client record IDs) |
| `Session Notes` | Long text |
| `Action Items` | Long text |
| `Last Updated` | Date — written on every upsert |

### Messages
| Airtable field | Notes |
|---|---|
| `Message Name` | Primary field |
| `Subject` | Subject line |
| `AI Generated Message Content` | Body |
| `Status` | `"Pending"` or `"Sent"` — **never `"Draft"`** |
| `Calculation` | Formula — read-only, never write |
| `Created` | Created time — read-only, never write |

### Users (key fields)
| Airtable field | TypeScript | Notes |
|---|---|---|
| `Full Name` | `fullName` | Formula field — **never write to it** |
| `First Name` / `Last Name` | `firstName` / `lastName` | Write these instead |
| `Work Email` | `workEmail` | Used for meeting email matching |
| `Role` | `role` | `"admin"`, `"coach"`, `"client"` |
| `Coach` | `coachIds` | Linked record IDs |
| `Associated Meetings` | `associatedMeetingIds` | Linked → Calendar Events — used for session count |
| `Quick Notes` | — | **Do not write.** Write to Coach-Person Context instead. |
| `Family Details` | — | **Do not write.** Write to Coach-Person Context instead. |

### Tasks
The portal Tasks live in the **`Tasks`** Airtable table (not "Linked Todoist Tasks", which is a separate linked field for Todoist integration). The primary field is `Title` (maps to `task.name`). Client link field is `Client` (linked → Users).

## Key conventions

- **Never write to formula or created-time fields**: `Full Name`, `Calculation`, `Created`, `Company Name`, `Company ID`.
- **Message status**: always `"Pending"` for drafts. Never `"Draft"`.
- **Airtable mutations**: use direct `fetch()` to the REST API. No SDK (SDK doesn't support PATCH cleanly).
- **All Airtable access is server-side only** — API key must never reach the browser.
- **Server actions** live in `actions.ts` co-located with the page/component that uses them.
- **Linked record filtering**: Airtable formula `filterByFormula` only returns the primary field value for linked records, not the record ID. Filter by linked record IDs in JavaScript after fetching, OR use the Airtable record ID directly in the URL path.
- **Upsert pattern**: fetch existing record(s) → filter in JS → PATCH if found, POST if not. See `coachSessions.ts` or `coachPersonContext.ts` for the pattern.
- **View mode**: read `lt_view_mode` cookie server-side for data filtering; use `useViewMode()` client-side for UI. After a mode change, call `router.refresh()` to re-run server components.

## Known gotchas

- **`Full Name` is a formula** — Airtable rejects writes to it. Always write `First Name` + `Last Name` separately.
- **`Company Name` is a lookup** — read-only. Write the `Company` linked field (array of record IDs) to set the company.
- **shadcn `<Select>` requires non-empty string values** — never use `value=""`. Use a sentinel like `"none"` and convert back to `undefined`/`null` before saving.
- **Profile photos go through Cloudinary** — Airtable attachment fields can't be written via REST API with a raw file. The upload flow is: browser → `/api/upload-photo` → Cloudinary → get URL → Airtable PATCH `Avatar URL` field.
- **`ParticipantEmails`** is stored as a comma-separated string in Airtable, but the app normalises it to `string[]` in `mapRecord`. When writing back, join with `', '`.
- **Coach Session and Coach-Person Context records are matched in JavaScript** (not Airtable formulas) because Airtable formula filters on linked record fields return primary field values, not IDs. This means the upsert functions fetch all records for a coach and filter client-side — acceptable at current data volumes.
- **`getRecentCoachSessionsForPerson`** takes a `personAirtableId` and returns sessions sorted by `lastUpdated` descending. It does NOT take a meeting ID — use it for the profile page "most recent session" card.
- **Graph token is ephemeral** — do not cache or store it. `getGraphAccessToken()` fetches a fresh token on every call. Add caching only if rate limits become an issue.
- **Calendar sync tags each event's `SenderEmail` with the coach email it came from** — this is how you know which coach's calendar an event belongs to.
- **`lt_view_mode` cookie** is set as `httpOnly: false` so the client-side ViewModeContext can read it on first render (for SSR hydration consistency).
