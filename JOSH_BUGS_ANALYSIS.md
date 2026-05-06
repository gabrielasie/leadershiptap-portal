# Josh's calendar sync bugs — analysis & status

## Bug 1 — "Only sync calendar invites if attendee is in the portal"

**Status: already implemented (more strictly than asked). Decision needed.**

The current sync at `app/api/calendar/sync/route.ts` already filters out events where no attendee matches the portal. But it filters by **active Relationship Context**, not by Users-table membership. The relevant code is around lines 520–533:

```ts
for (const attendee of event.attendees ?? []) {
  const email = attendee.emailAddress.address.toLowerCase()
  if (email === coachLower) continue
  const match = contextMap.get(email)  // contextMap = active RCs for this coach
  if (match) confirmedMatches.push(match)
}
if (confirmedMatches.length === 0) {
  discarded++
  continue
}
```

The spec (Section 7B) requires this behaviour: events only sync if the attendee has an active Relationship Context with the calendar owner. That's stricter than "any portal Person."

**Why this matters:**

If Josh meets with someone who's in the Users table but doesn't have an active `coaching` or `reports_to` RC with him, the meeting gets discarded. Common case: a person at a client org is in Users for org-chart reasons but isn't actively coached.

**Two ways to interpret Josh's request:**

(a) "I'm losing meetings I should see." Then the issue is data, not code. Every coachee Josh actively meets with should have an active `coaching` RC pointing Person=coachee → Lead=Josh. Run the audit script to find the gap:
```
npx tsx scripts/audit-rc-types.ts
```
Then either fix the missing RCs in Airtable, or use the New Person onboarding flow to create them.

(b) "I want every portal-Person meeting, even without an RC." That's a deliberate spec deviation. Easy code change but breaks the privacy model — synced Meetings would have no Relationship Context, which means they're outside the spec's scope-by-context boundary. Notes attached to those meetings have nowhere to anchor.

**Recommendation:** push back on Josh and ask which case he's hitting. If he names a specific lost meeting, we can verify it's case (a) and fix the RC data. Don't relax the filter without understanding what he's missing.

---

## Bug 2 — "Currently only pulls events in the future"

**Status: fixed.**

`fetchEvents` in `app/api/calendar/sync/route.ts` was querying Microsoft Graph with `startDateTime: now`. Past events never reached Airtable.

**Changes I made:**

1. Window extended backward by 90 days, forward by 60 days. Both configurable via `SYNC_PAST_DAYS` and `SYNC_FUTURE_DAYS` env vars (defaults 90 / 60). Set via Render dashboard if Josh wants a different range.

2. Added pagination via `@odata.nextLink`. The previous code took only the first 500 events — fine for a 60-day forward window, risky for a 150-day total window if Josh is busy. Now it follows pagination links until exhausted.

3. Past events now get `Meeting Status = 'Completed'` instead of always `'Scheduled'`. Future events still get `'Scheduled'`. Cancelled events go through the existing `cancelMeetings` path unchanged.

4. Added `$orderby: start/dateTime asc` to make the iteration deterministic across pages.

**Operational note for Josh:**

When you trigger the next sync, expect it to import a chunk of past meetings. Idempotency holds — re-running won't create duplicates because the dedup key is `Provider Event ID + Relationship Context`. If you see duplicates, that means the same Outlook event has multiple Provider Event IDs, which would be a Graph quirk worth investigating separately.

If sync timing balloons (the route has a 60-second `maxDuration`), you can shrink `SYNC_PAST_DAYS` via env. 90 days should be safe for typical calendars.

---

## Bug 3 — "Organization info doesn't appear to be syncing. Filter button broken."

**Status: diagnosed. Not fixing yet per Josh's "after architecture migration" tag.**

Two distinct problems hiding under one bug.

### 3a. Company info shows up empty or weird

`lib/airtable/users.ts:42–43`:

```ts
companyId: record.fields["Company ID"] as string | undefined,
companyName: record.fields["Company Name"] as string | undefined,
```

Both fields are read as plain strings. But in the Airtable base schema, `Company Name` is a **lookup** field (it pulls Name from the linked Companies record), and lookup fields return **arrays**, not strings. The TypeScript `as string` cast is a compile-time hint with no runtime effect.

What actually comes through:
- User with no company linked → field undefined → renders as nothing → **looks empty**
- User with one company linked → field is `["Acme Corp"]`. JS array → string coercion gives `"Acme Corp"` so simple display works by accident.
- User with multiple companies linked → field is `["Acme Corp", "Other"]` → renders as `"Acme Corp,Other"` (note the missing space).
- Anywhere the value is compared (`user.companyName === 'Acme Corp'`) it fails because the runtime value is an array.

**Fix when ready (do not run yet):** read the lookup correctly using the existing `readLookup` helper in `users.ts`:

```ts
companyName: readLookup(record.fields["Company Name"]),
companyId: readLookup(record.fields["Company ID"]),
```

This returns the first element joined as a string. Do the same audit on every `as string` cast against an Airtable lookup field, not just these two — there are likely more.

### 3b. There IS no company filter in the ClientsGrid filter bar

Josh said "I can't filter people based on company even though the filter button is present." Walking through the actual UI code at `app/(protected)/users/ClientsGrid.tsx:309–362`:

The filter row shows: Search input, Role filter, Coach filter, Sort dropdown, View toggle (By Client / By Company), Add Client button.

There is no company filter dropdown. The thing Josh is probably calling "the filter button" is the **By Company view toggle**, which groups results by company — it's a presentation toggle, not a filter. The `companies` prop is passed into the component (line 22) but nothing in the component uses it to build a filter.

**Fix when ready (do not run yet):**

Add a third `<FilterSelect>` between Role and Coach:

```tsx
{companies.length > 1 && (
  <FilterSelect value={selectedCompany} onChange={setSelectedCompany}>
    <option value="all">All Companies</option>
    {companies.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </FilterSelect>
)}
```

Add `selectedCompany` state and a filter clause in the `filtered` useMemo:

```tsx
if (selectedCompany !== 'all') {
  result = result.filter(({ user }) => user.companyLinkedIds?.includes(selectedCompany))
}
```

Note: filter on `user.companyLinkedIds` (the actual linked record IDs), not `user.companyName` — that's what's reliable. This depends on 3a being fixed first if you also want to display company names; but the filter itself works regardless because it uses IDs.

Also wire `selectedCompany` into `clearFilters()` and `hasFilters`.

---

## Recommended order

1. (Done) Bug 2 fixes are live. Trigger a sync from Settings to confirm past events come in correctly.
2. Talk to Josh about Bug 1. Don't change code until you know which interpretation he means.
3. Bug 3 — wait for the architecture migration window. The fix is ~30 lines of code total but the lookup-cast issue is base-schema-wide and worth doing in one pass.
