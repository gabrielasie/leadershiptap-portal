# LeadershipTap Portal — Claude Context

## Key files at a glance

| File | What it does |
|---|---|
| `lib/auth/getCurrentUserRecord.ts` | Resolves Clerk session → Airtable Users record. Always call this in server actions that need the coach's Airtable ID. |
| `lib/airtable/users.ts` | CRUD for Users table. `updateUserProfile()` is the main write path for profile edits. Never write `Quick Notes` / `Family Details` here — use Coach-Person Context. |
| `lib/airtable/coachPersonContext.ts` | Per coach ↔ client pair notes (Quick Notes, Family Details, Relationship Flags). |
| `lib/airtable/coachSessions.ts` | Per coach ↔ meeting session notes and action items. |
| `lib/airtable/meetings.ts` | All Portal Calendar Events access: read, write notes, search by email. Single source of truth — the old Calendar Events table is archived and never queried. |
| `app/api/calendar/sync/route.ts` | POST — syncs Microsoft Graph calendar events for all @leadershiptap.com coaches into Portal Calendar Events. Requires Clerk session or SYNC_SECRET header. |

## Airtable field map

### Portal Calendar Events (the active calendar table — Calendar Events is archived)
| Airtable field | Notes |
|---|---|
| `Note Name` | Primary field — auto-set by sync as `YYYY-MM-DD // Attendee Name` |
| `Subject` | Meeting title (from Microsoft Graph) |
| `Start` | ISO 8601 DateTime |
| `End` | ISO 8601 DateTime |
| `Provider Event ID` | Stable Microsoft Graph event ID — used for upsert dedup |
| `Participant Emails` | Comma-separated emails (coach excluded) — written by sync |
| `Notes` | Long text — written manually by coaches via the dashboard note panel |

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
| `Calendar Event` | Linked → Portal Calendar Events |
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
| `Associated Meetings` | `associatedMeetingIds` | Linked → Portal Calendar Events — used for session count |
| `Quick Notes` | — | **Do not write.** Write to Coach-Person Context instead. |
| `Family Details` | — | **Do not write.** Write to Coach-Person Context instead. |

### Tasks
The portal Tasks live in the **`Tasks`** Airtable table (not "Linked Todoist Tasks", which is a separate linked field for Todoist integration). The primary field is `Title` (maps to `task.name`). Client link field is `Client` (linked → Users).

## Key conventions

- **All meetings data comes from Portal Calendar Events** — the old Calendar Events table is an archived read-only snapshot and is never queried by the portal.
- **Never write to formula or created-time fields**: `Full Name`, `Calculation`, `Created`, `Company Name`, `Company ID`.
- **Message status**: always `"Pending"` for drafts. Never `"Draft"`.
- **Airtable mutations**: use direct `fetch()` to the REST API. No SDK (SDK doesn't support PATCH cleanly).
- **All Airtable access is server-side only** — API key must never reach the browser.
- **Server actions** live in `actions.ts` co-located with the page/component that uses them.
- **Linked record filtering**: Airtable formula `filterByFormula` only returns the primary field value for linked records, not the record ID. Filter by linked record IDs in JavaScript after fetching, OR use the Airtable record ID directly in the URL path.
- **Upsert pattern**: fetch existing record(s) → filter in JS → PATCH if found, POST if not. See `coachSessions.ts` or `coachPersonContext.ts` for the pattern.

## Known gotchas

- **`Full Name` is a formula** — Airtable rejects writes to it. Always write `First Name` + `Last Name` separately.
- **`Company Name` is a lookup** — read-only. Write the `Company` linked field (array of record IDs) to set the company.
- **shadcn `<Select>` requires non-empty string values** — never use `value=""`. Use a sentinel like `"none"` and convert back to `undefined`/`null` before saving.
- **Profile photos go through Cloudinary** — Airtable attachment fields can't be written via REST API with a raw file. The upload flow is: browser → `/api/upload-photo` → Cloudinary → get URL → Airtable PATCH `Avatar URL` field.
- **`Participant Emails`** in Portal Calendar Events is stored as a comma-separated string; the app normalises it to `string[]` in `mapRecord`. When writing back, join with `', '`.
- **Coach Session and Coach-Person Context records are matched in JavaScript** (not Airtable formulas) because Airtable formula filters on linked record fields return primary field values, not IDs. This means the upsert functions fetch all records for a coach and filter client-side — acceptable at current data volumes.
- **`getRecentCoachSessionsForPerson`** takes a `personAirtableId` and returns sessions sorted by `lastUpdated` descending. It does NOT take a meeting ID — use it for the profile page "most recent session" card.
- **Calendar sync** runs via POST `/api/calendar/sync`. It can be triggered from the Settings page (Clerk session auth) or by a cron job (SYNC_SECRET header auth). It does NOT overwrite the `Notes` field on existing records — only coaches write to Notes.
- **Session note panel** on the dashboard allows coaches to attach notes to Portal Calendar Events records directly. These notes also appear on the client profile page under "Session Notes (from Calendar)".
