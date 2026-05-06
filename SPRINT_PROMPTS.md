# Claude Code prompts — Sprint 1 & 2

Copy each prompt into Claude Code in order. Run `npm run build` after each one. Verification steps are at the bottom of each prompt.

---

## Sprint 1 — Correctness fixes

### Prompt 1 — Fix dashboard timezone bugs

Two timezone-related bugs in `app/(protected)/dashboard/page.tsx`:

**Bug 1.** `getTimeOfDay()` (around line 22) reads `new Date().getHours()`, which returns server-local time. On Render that's UTC, so a Josh in Eastern time sees "Good morning" at 7pm.

**Bug 2.** The "today" filter (around line 241–243) compares UTC date strings:
```ts
const todayStr = now.toISOString().slice(0, 10)
const todayItems = upcomingItems.filter(
  (item) => new Date(item.startTime).toISOString().slice(0, 10) === todayStr,
)
```
A 7pm ET Friday meeting is at 00:00 UTC Saturday and gets pushed into Saturday's list.

**Fix:**

1. Add to `lib/utils/dateFormat.ts` (it already has `formatEastern` — extend it):
   ```ts
   /** Returns YYYY-MM-DD in the given timezone (default America/New_York). */
   export function getDateInTimezone(iso: string, tz = 'America/New_York'): string {
     const parts = new Intl.DateTimeFormat('en-CA', {
       timeZone: tz,
       year: 'numeric',
       month: '2-digit',
       day: '2-digit',
     }).formatToParts(new Date(iso))
     const y = parts.find((p) => p.type === 'year')?.value ?? ''
     const m = parts.find((p) => p.type === 'month')?.value ?? ''
     const d = parts.find((p) => p.type === 'day')?.value ?? ''
     return `${y}-${m}-${d}`
   }

   /** Returns 0-23 hour in the given timezone. */
   export function getHourInTimezone(date: Date = new Date(), tz = 'America/New_York'): number {
     const h = new Intl.DateTimeFormat('en-US', {
       timeZone: tz,
       hour: 'numeric',
       hour12: false,
     }).format(date)
     return parseInt(h, 10)
   }
   ```

2. In `app/(protected)/dashboard/page.tsx`:
   - Import the two helpers.
   - Replace `getTimeOfDay()` body with `const h = getHourInTimezone()` and the existing if/else chain.
   - Replace the `todayStr` block with:
     ```ts
     const todayStr = getDateInTimezone(now.toISOString())
     const todayItems = upcomingItems.filter(
       (item) => getDateInTimezone(item.startTime, item.timezone || undefined) === todayStr,
     )
     ```

   Note: `UpcomingItem` doesn't currently expose `timezone`. If it doesn't, either pass it through (preferred — pass on the item from `meeting.timezone || 'America/New_York'`) or default to Eastern.

**Verify:** at 9pm Eastern on a Friday, the dashboard greets "Good evening" and Friday's late meetings are still in "today's sessions" — not pushed to Saturday.

---

### Prompt 2 — Fix `resolveContextForSubject` N+1 fetch

`lib/airtable/relationships.ts:380–398`. The current implementation calls `getRelationshipContexts(coachId)`, then for **each** of the coach's direct RCs calls `getRelationshipContexts(rc.personId)` again. Each call is a full table fetch + name map rebuild. For Josh's 4 clients that's ~5 round-trips on every single note save.

**Fix:** rewrite to do a single fetch and walk an in-memory index.

Replace the function body with:

```ts
export async function resolveContextForSubject(
  coachId: string,
  subjectPersonId: string,
): Promise<RelationshipContext | null> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    fetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=2000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildNameMap(apiKey, baseId),
  ])
  if (!res.ok) return null
  const data = await res.json()
  const allActive = (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter((r: RelationshipContext | null): r is RelationshipContext => r !== null)

  // Index by lead → RCs
  const byLead = new Map<string, RelationshipContext[]>()
  for (const rc of allActive) {
    const list = byLead.get(rc.leadId) ?? []
    list.push(rc)
    byLead.set(rc.leadId, list)
  }

  // 1. Direct: coach → subject
  const direct = byLead.get(coachId)?.find((c) => c.personId === subjectPersonId)
  if (direct) return direct

  // 2. One-hop: coach → intermediate → subject. Return the coach's upstream RC.
  for (const rc of byLead.get(coachId) ?? []) {
    const downstream = byLead.get(rc.personId) ?? []
    if (downstream.some((d) => d.personId === subjectPersonId)) return rc
  }

  return null
}
```

This collapses ~5 round-trips into 2.

**Verify:** add a temporary `console.time('resolveRC')` / `console.timeEnd('resolveRC')` around the call in `saveNoteAction` once before and once after, confirm the after-time is meaningfully lower. Then remove the timing.

---

### Prompt 3 — Stop session notes from bypassing the Notes table

`app/(protected)/dashboard/actions.ts:107–147` (`dashboardLogNoteAction`). Currently when `meetingId` is provided it calls `upsertCoachSession` and skips the Notes table entirely. The result: the note has no Relationship Context, doesn't appear in `getNotesByRelationshipContext`, and lives outside the spec's privacy boundary.

**Fix:** always write to Notes. When meetingId is provided, link the Meeting and set `noteType = 'meeting_note'`.

Replace `dashboardLogNoteAction` with:

```ts
export async function dashboardLogNoteAction(params: {
  clientId: string
  content: string
  meetingId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, params.clientId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: params.content,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.clientId,
      clientId: params.clientId,
      relationshipContextId: rc.id,
      meetingId: params.meetingId,
      noteType: params.meetingId ? 'meeting_note' : 'general_context',
    })

    revalidatePath('/dashboard')
    if (params.meetingId) revalidatePath(`/users/${params.clientId}`)
    return { success: true }
  } catch (err) {
    console.error('[dashboardLogNoteAction]', err)
    return { success: false, error: String(err) }
  }
}
```

Then check three downstream readers and confirm they pull from Notes (with meeting link), not from Coach Session, when displaying session notes:
1. `app/(protected)/users/[id]/MostRecentSessionNotes.tsx`
2. `app/(protected)/dashboard/SessionNotePanel.tsx`
3. `lib/airtable/coachSessions.ts` calls in profile page (`getRecentCoachSessionsForPerson`)

Decide: do we keep Coach Session as a legacy read-only store (no new writes), or do we read from `getNotesByMeetingId(meetingId)` and remove the Coach Session usage on the profile page entirely? Recommendation: switch the reads. Existing Coach Session records can stay in Airtable as historical data; the profile page just stops reading them. To do this:

- In `app/(protected)/users/[id]/page.tsx`, remove the `recentCoachSessions` fetch.
- Replace `MostRecentSessionNotes` props: pass an array of meeting-linked notes instead. Use `getNotesByMeetingId(lastMeeting.id)` to fetch the most-recent-session notes.
- Update `MostRecentSessionNotes.tsx` to render notes from the new shape.

**Verify:** create a note from the dashboard with a meeting selected → check Airtable: a Notes record exists with Meeting linked, Note Type = meeting_note, Relationship Context linked. The profile page "Most Recent Session" should show it under the latest meeting.

---

### Prompt 4 — Strip console.log debug spam

Create `lib/utils/logger.ts`:

```ts
const isProd = process.env.NODE_ENV === 'production'

export const log = {
  /** Suppressed in production. */
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(...args)
  },
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}
```

Then replace these specific call sites:

- `lib/airtable/meetings.ts`:
  - `console.log('[debug] getAllUpcomingMeetings table:'...)` → `log.debug(...)`
  - `console.log('[debug] getAllMeetings table:'...)` → `log.debug(...)`
  - Keep `console.error('[debug] ... failed status:'...)` as `log.error(...)`.
- `lib/airtable/relationships.ts`:
  - `console.log(\`[RC] found ${results.length} active contexts...\`)` → `log.debug(...)`
  - `console.warn('[get*Contexts] fetch failed:'...)` → `log.warn(...)`
- `app/(protected)/dashboard/page.tsx`:
  - `clientActivity.forEach(({ user, lastMeeting }) => { ... console.log(\`[dashboard] ...\`) })` → wrap entire forEach in `if (process.env.NODE_ENV !== 'production')` OR replace with `log.debug`. Cleanest: delete the loop entirely. It served as a one-time diagnostic and is no longer needed.
  - `console.log('[debug] getUpcomingPortalEvents...')` → `log.debug(...)`
- `lib/auth/getCurrentUserRecord.ts`: extensive logging. Convert all `console.log('[getCurrentUserRecord] found...')` → `log.debug(...)`. Keep error/warning paths as `log.warn` / `log.error`.

Leave `app/api/calendar/sync/route.ts` `[sync]` logs alone — they fire on a cron and are useful for ops.

**Verify:** `NODE_ENV=production npm run build && npm run start`. Hit the dashboard and a profile page. Server stdout should not contain any `[debug]`, `[dashboard] X | email:`, or `[RC] found` lines.

---

### Prompt 5 — Add the RC types audit script

Create `scripts/audit-rc-types.ts`:

```ts
/**
 * Read-only audit of the Relationship Contexts table.
 * Reports type/status distributions and flags anything that doesn't match spec.
 *
 * Usage:  npx tsx scripts/audit-rc-types.ts
 * No mutations performed — output is for human review.
 */

import 'dotenv/config'

const apiKey = process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const API = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent('Relationship Contexts')

const VALID_TYPES = new Set(['coaching', 'reports_to'])
const VALID_STATUS = new Set(['Active', 'Inactive', 'Paused', 'Ended'])

interface Row {
  id: string
  type: string
  status: string
  personId: string | null
  leadId: string | null
}

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = []
  let offset: string | undefined
  do {
    const url = `${API}/${baseId}/${TABLE}?maxRecords=10000${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    for (const r of data.records ?? []) {
      const f = r.fields as Record<string, unknown>
      const persons = Array.isArray(f.Person) ? (f.Person as string[]) : []
      const leads = Array.isArray(f.Lead) ? (f.Lead as string[]) : []
      rows.push({
        id: r.id as string,
        type: (f['Relationship Type'] as string) ?? '',
        status: (f.Status as string) ?? '',
        personId: persons[0] ?? null,
        leadId: leads[0] ?? null,
      })
    }
    offset = data.offset as string | undefined
  } while (offset)
  return rows
}

function printDistribution(label: string, m: Map<string, number>) {
  console.log(`\n=== ${label} ===`)
  for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  "${k}"`)
  }
}

async function main() {
  console.log('Fetching all Relationship Context rows...')
  const rows = await fetchAll()
  console.log(`Total rows: ${rows.length}`)

  const typeDist = new Map<string, number>()
  const statusDist = new Map<string, number>()
  const invalidType: Row[] = []
  const invalidStatus: Row[] = []
  const missingLinks: Row[] = []

  for (const r of rows) {
    typeDist.set(r.type || '(empty)', (typeDist.get(r.type || '(empty)') ?? 0) + 1)
    statusDist.set(r.status || '(empty)', (statusDist.get(r.status || '(empty)') ?? 0) + 1)
    if (!VALID_TYPES.has(r.type)) invalidType.push(r)
    if (!VALID_STATUS.has(r.status)) invalidStatus.push(r)
    if (!r.personId || !r.leadId) missingLinks.push(r)
  }

  printDistribution('Relationship Type distribution', typeDist)
  printDistribution('Status distribution', statusDist)

  if (invalidType.length) {
    console.log(`\n=== Rows with non-spec Relationship Type (${invalidType.length}) ===`)
    for (const r of invalidType.slice(0, 50)) {
      console.log(`  ${r.id}  type="${r.type}"  status="${r.status}"`)
    }
    if (invalidType.length > 50) console.log(`  ... and ${invalidType.length - 50} more`)
  }

  if (invalidStatus.length) {
    console.log(`\n=== Rows with non-spec Status (${invalidStatus.length}) ===`)
    for (const r of invalidStatus.slice(0, 50)) {
      console.log(`  ${r.id}  status="${r.status}"  type="${r.type}"`)
    }
  }

  if (missingLinks.length) {
    console.log(`\n=== Rows missing Person or Lead links (${missingLinks.length}) ===`)
    for (const r of missingLinks.slice(0, 50)) {
      console.log(`  ${r.id}  person=${r.personId ?? 'NONE'}  lead=${r.leadId ?? 'NONE'}`)
    }
  }

  console.log('\nDone. No mutations performed. Review and clean up via Airtable UI as needed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Verify:** `npx tsx scripts/audit-rc-types.ts`. Output should be human-readable. No writes to Airtable.

---

### Prompt 6 — Add a "Log Session" button (manual meeting creation)

Bug #3 from the original list, never fixed. Required for impromptu sessions, makeup calls, anything Outlook missed.

**1. Create `app/(protected)/users/[id]/LogSessionDialog.tsx`** (client component):

A dialog with:
- Date input (default = today)
- Time input (default = current time, rounded to nearest 30 min)
- Duration select: 30 / 45 / 60 / 90 minutes (default 60)
- Notes textarea (optional)
- Save / Cancel buttons

Same modal pattern as `LogNoteDialog.tsx`. On submit, call `logManualSessionAction` (added below). On NO_RELATIONSHIP error, show the same message used in LogNoteDialog. Toast "Session logged" on success.

**2. Update `app/(protected)/users/[id]/UserActionsBar.tsx`:**

Add a `<LogSessionDialog userId={userId} />` after `<AddTaskDialog>`. Use the `Calendar` lucide icon. Button label: "Log Session", outline variant matching LogNoteDialog.

**3. Add to `lib/airtable/meetings.ts`:**

```ts
export interface CreateManualMeetingData {
  title: string
  startIso: string
  endIso: string
  timezone: string
  calendarOwnerEmail: string
  relationshipContextId: string
  clientName: string
}

export async function createManualMeeting(data: CreateManualMeetingData): Promise<string> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.MEETINGS.TITLE]: data.title,
    [FIELDS.MEETINGS.START]: data.startIso,
    [FIELDS.MEETINGS.END]: data.endIso,
    [FIELDS.MEETINGS.TIMEZONE]: data.timezone,
    [FIELDS.MEETINGS.MEETING_STATUS]: 'Completed',
    [FIELDS.MEETINGS.CALENDAR_PROVIDER]: 'Manual',
    [FIELDS.MEETINGS.CALENDAR_OWNER]: data.calendarOwnerEmail,
    [FIELDS.MEETINGS.RELATIONSHIP_CONTEXT]: [data.relationshipContextId],
    [FIELDS.MEETINGS.CLIENT_NAME]: data.clientName,
  }
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Manual meeting POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}
```

**4. Add to `app/(protected)/users/[id]/actions.ts`:**

```ts
export async function logManualSessionAction(params: {
  subjectPersonId: string
  startIso: string
  durationMinutes: number
  notes?: string
}): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('SAVE_FAILED')
  const rc = await resolveContextForSubject(userRecord.airtableId, params.subjectPersonId)
  if (!rc) throw new Error('NO_RELATIONSHIP')

  // Resolve subject name for the Meeting Title
  const { getUserById } = await import('@/lib/services/usersService')
  const subject = await getUserById(params.subjectPersonId)
  const subjectName = subject
    ? subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(' ')
    : 'Unknown'
  const coachFirst = userRecord.name.split(' ')[0] || 'Coach'

  const start = new Date(params.startIso)
  const end = new Date(start.getTime() + params.durationMinutes * 60_000)

  const { createManualMeeting } = await import('@/lib/airtable/meetings')
  const meetingId = await createManualMeeting({
    title: `${coachFirst} / ${subjectName} — Manual Session`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone: 'America/New_York',
    calendarOwnerEmail: userRecord.email,
    relationshipContextId: rc.id,
    clientName: subjectName,
  })

  if (params.notes && params.notes.trim().length > 0) {
    await createNote({
      content: params.notes.trim(),
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.subjectPersonId,
      clientId: params.subjectPersonId,
      relationshipContextId: rc.id,
      meetingId,
      noteType: 'meeting_note',
    })
  }

  revalidatePath(`/users/${params.subjectPersonId}`)
}
```

**Verify:** open a client profile, click "Log Session", set a past date, fill 60 min + a note. Save. In Airtable, confirm: a new Meetings record with `Calendar Provider = Manual`, `Meeting Status = Completed`, `Relationship Context` linked. Notes record with `Meeting` linked to that meeting, `Note Type = meeting_note`. The profile page's Meetings list should show the new session as the most recent past one.

---

### Prompt 7 — Run the notes RC backfill (operational, not a code prompt)

```bash
cd /path/to/leadershiptap-portal
npx tsx scripts/backfill-notes-rc.ts
```

Watch the output. Skipped notes are logged with their record IDs — open them in Airtable and either link to the right RC manually or delete if orphaned.

After running, spot-check 5 random notes in the Notes table → confirm `Relationship Context` is populated.

---

## Sprint 2 — UX/structural fixes

### Prompt 8 — Unify the Edit Profile UI

Right now `EditInlineProfileDialog` and `EditProfileDialog` both render side by side on the profile page (`app/(protected)/users/[id]/page.tsx:466–472`). They look similar and a coach has to know which one edits what.

Pick one of two paths:

**Path A (simpler):** delete `EditInlineProfileDialog.tsx`, remove its import and JSX from `page.tsx`. Move its two fields (Title, Internal Notes) into `EditProfileDialog` if they aren't already. Single button: "Edit Profile."

**Path B (better UX):** keep one button in the corner ("Edit Profile") that opens `EditProfileDialog`. Replace the inline button with hover-state pencil icons on the editable fields directly (Title, Internal Notes). Click pencil → inline editor pops up for that field only.

Recommendation: Path A. Path B is nicer but doubles the work.

**Verify:** profile page shows exactly one Edit Profile button. Clicking it opens a dialog covering all editable fields. Title and Internal Notes are editable from the same dialog.

---

### Prompt 9 — Consolidate the "Coaching Context" UI block

`page.tsx:631–682`. Currently four labeled subsections: Internal Notes (Users field), Quick Notes (Coach-Person Context), Family Details (Coach-Person Context), Relationship Flags (Coach-Person Context).

Cheap fix without a data migration:

1. Replace the four-subsection block with a single "Coaching Context" block. Render Internal Notes, then Quick Notes, then Family Details — all as one continuous text body, separated by horizontal rules (`<hr/>`) only where each has content.
2. Move Relationship Flags out of this section entirely. Render them as inline pill badges next to the user's name in the profile card header (above line 537 with the existing `badges`).
3. The `EditProfileDialog` should still expose the three text fields separately (so the coach can write structured info), but the read view collapses them.

Goal: when the coach lands on a profile, they see one block of "what I know about this person" plus flag badges next to the name. They write into structured fields via Edit Profile.

**Verify:** profile page renders one Coaching Context block instead of four. Flags appear as badges next to the name. Edit dialog still shows three labeled text areas for input.

---

### Prompt 10 — Tasks filter on the profile page

`app/(protected)/users/[id]/page.tsx:1147–1163`. Currently shows all task statuses. Should default to Open only.

1. Convert the Tasks block to a small client component `TasksSection.tsx` that takes the full task list as a prop.
2. Add a filter toggle at the top: `[All] [Open (default)] [Done]`. Style as small chip buttons.
3. "Open" = `Not Started` + `In Progress`. "Done" = `Complete` + `Cancelled`.
4. Default = Open.
5. Empty state for each filter: "No open tasks", "No completed tasks", "No tasks yet."

**Verify:** profile page Tasks section defaults to Open. Clicking All shows everything. Clicking Done shows completed/cancelled.

---

### Prompt 11 — Onboarding org fencing on Reports To picker

`app/(protected)/people/new/NewPersonForm.tsx:189–192`. When `companyId === NO_COMPANY`, the Reports To picker shows all users across all companies. Spec Section 7 wants org fencing on this dropdown.

Fix:
1. When `companyId === NO_COMPANY`, replace the picker's `options` with `[]` and set the placeholder to "Select a company first."
2. Add a small help line under the Reports To label: "Pick a company above to see who they could report to."
3. Same treatment for the Direct Reports picker — same fencing rule. Spec applies to both.

**Verify:** open New Person form with no company selected → Reports To shows the help message and empty results. Select Acme Corp → only Acme Corp users appear in the dropdown.

---

### Prompt 12 — Show downstream RC badge on profile page

`app/(protected)/users/[id]/page.tsx:428–454`. When `relationshipContext` is null, the page shows a warning ("No formal relationship context — you're seeing this client via legacy access"). But for downstream people reached via the trail (Stephanie viewed via Iyan), the warning is wrong — there IS a relationship, just one hop downstream.

Fix:
1. Detect downstream-via-trail: if `relationshipContext` is null AND `trailEntries.length > 0`, the user got here via drill-down.
2. In that case, replace the warning with a green badge: "Reached via your coaching with [trailEntries.last.name]". Use `bg-emerald-50 border-emerald-200 text-emerald-700` styling matching the direct-RC badge.
3. Keep the warning only for the case where there's no RC and no trail — that's the actual legacy-access case.

**Verify:** click a direct client → green "Coaching" badge. Drill into one of their reports → green "Reached via your coaching with [Name]" badge. Open a profile that's actually unrelated (admin view) → warning still shows.

---

## Sprint 3 — Polish (optional, ship if you have time)

### Prompt 13 — Profile page split

`app/(protected)/users/[id]/page.tsx` is 1178 lines. Extract into composable section components. Each section gets its own file in `app/(protected)/users/[id]/sections/`:

- `ProfileCardSection.tsx` (avatar, name, badges, contact)
- `MostRecentSessionSection.tsx` (lastMeeting + recentMeetings list)
- `SessionNotesFromCalendarSection.tsx`
- `CoachingContextSection.tsx` (post Prompt 9)
- `PersonalityStrengthsSection.tsx`
- `ProfileDetailsSection.tsx`
- `CoachNotesSection.tsx`
- `TeamSection.tsx`
- `TheirTeamSection.tsx`
- `MeetingsSection.tsx`
- `MessagesSection.tsx`
- `TasksSection.tsx` (Prompt 10)

`page.tsx` becomes the orchestrator — fetches data in `Promise.all`, passes to sections. Each section is a server component unless interactive.

No behavior change. Just file organization.

---

### Prompt 14 — Suspense boundaries on dashboard

`app/(protected)/dashboard/page.tsx` awaits ten parallel fetches before rendering anything. Wrap the three independent regions in `<Suspense>` so they stream:

1. Coming Up Next + Today section
2. Open Tasks
3. Your Clients (with notes)

Move each into its own async server component. The page becomes:

```tsx
<Suspense fallback={<ComingUpNextSkeleton />}>
  <ComingUpNextRegion userRecord={userRecord} />
</Suspense>
<Suspense fallback={<TasksSkeleton />}>
  <OpenTasksRegion userRecord={userRecord} />
</Suspense>
<Suspense fallback={<ClientsSkeleton />}>
  <YourClientsRegion userRecord={userRecord} />
</Suspense>
```

Each fetches its own data. Skeletons are simple animated divs.

**Verify:** dashboard shows the greeting + skeleton placeholders within ~100ms, then sections fill in as their data arrives.

---

### Prompt 15 — Loading skeleton on profile page

`app/(protected)/users/[id]/loading.tsx` exists — check what it shows. If it's a blank page or generic spinner, replace with a skeleton matching the profile page layout: avatar circle placeholder, name bar, profile card outline, two empty meeting card placeholders.

Use `animate-pulse` on `bg-slate-100` divs. No new dependencies needed.

---

## Order of operations

If you can only run a few of these, run in this order (highest impact / lowest risk first):

1. Prompt 1 (timezone) — Josh sees the symptoms immediately.
2. Prompt 4 (logger) — clean up server stdout before anything else.
3. Prompt 2 (N+1) — quick perf win, low risk.
4. Prompt 5 (audit script) — read-only, run once, see what's hiding in your data.
5. Prompt 7 (run backfill) — confirm production data is clean.
6. Prompt 6 (Log Session) — biggest user-visible feature add.
7. Prompt 3 (notes split-store) — meaningful but requires discussion with Josh first about Coach Session deprecation.
8. Sprint 2 (UX) once Sprint 1 is shipped.

Do not run Prompts 3 and 6 simultaneously — both touch `actions.ts` and could conflict.
