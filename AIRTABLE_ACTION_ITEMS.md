# Airtable action items — based on data audit

You implement these manually in the Airtable UI. None require code.

## 1. Delete the Matt Metzger "peer" RC row

You confirmed Matt is a fellow coach, not a client. Per the spec, there should be no Relationship Context row between two coaches at all.

- Open the Relationship Contexts table.
- Find ID 20 (Person = Metzger, Matt; Lead = Hartsell, Joshua; Type = peer).
- Delete the row.

Do NOT change the type to `coaching` — that would make Matt show up on Josh's Clients dashboard as a coachee.

## 2. Dedupe the four duplicated Users records

Each duplicate name (Garfield, Barton, Smith, Munn) is almost certainly two **Users** records with different `recXXX` IDs. Fix the Users table; the duplicate RCs follow.

For each pair:

1. Open the Users table.
2. Search the duplicate name. Confirm two records exist.
3. Pick the canonical record. Decide based on which has more populated fields — work email, profile photo, job title, associated meetings, notes/tasks. Use this checklist:
   - Has Work Email populated → +3 points
   - Has Profile Photo → +2 points
   - Has Job Title → +1 point
   - Has Associated Meetings (any count) → +1 per meeting, capped at 10
   The higher-scoring record stays.
4. Re-link any Meetings, Notes, or Tasks pointing to the loser → re-point them at the winner.
5. Delete the loser User record.
6. The Relationship Context row whose Person field pointed to the loser will become orphaned (Person field empty). Delete it too.

Run this script to get the exact list to work through:

```
npx tsx scripts/audit-users-duplicates.ts
```

It scores both records in each pair so you know which to keep at a glance.

## 3. Verify the Companies table Status field

Now that the New Person form filters company picker to `Status = "Active"`, any Companies row with a different Status (Inactive, Prospect, blank) won't appear. Spot-check:

1. Open the Companies table.
2. For each company you expect to see in the picker (Acme Corp, Leadership Tap, etc.), confirm Status is `Active`.
3. For any Inactive or Prospect company that should actually be Active, fix it.

## 4. (Optional, after the architecture migration) Fix the Permission Level schema

Right now the column is a single-select with values like `full_access`, `coach_owner`, `manager_limited`, `read_only`. Spec says it should be a `Link → Permission Profiles` named `Permission Profile`.

When you're ready:

1. Create a new linked-record column called `Permission Profile`.
2. Populate every existing RC with a link to the `standard` profile in the Permission Profiles table.
3. Delete the old `Permission Level` single-select column.
4. Update the constant in `lib/airtable/constants.ts`:
   `PERMISSION_LEVEL: 'Permission Level'` → `PERMISSION_PROFILE: 'Permission Profile'`
5. The app does not currently read this field for permission decisions, so no functional change. It just brings the schema into spec compliance for v2 when client_user roles activate.

For v1, leaving it alone is fine. The code I just shipped stops writing to this field entirely (it was silently failing anyway).

## 5. (Optional) Backfill RC Start Dates

```
npx tsx scripts/backfill-rc-start-dates.ts
```

Walks every RC where Start Date is empty, finds the earliest non-cancelled associated Meeting, and PATCHes the Start Date. RCs with no associated meetings stay blank — those will fill in naturally as sessions happen. The "Active since [Mar 2024]" badge on profile pages will populate correctly.

Run **after** the calendar sync has caught up with past events (Bug 2 fix from the earlier round). Otherwise it'll only see the few past meetings the old sync had captured.

## 6. (Optional, future) Migrate Users.Manager / Direct Reports into reports_to RCs

Today reporting hierarchy lives on the Users table (`Manager`, `Direct Reports` linked fields). The spec wants those as `reports_to` Relationship Context rows. Two paths:

- Path A: keep Users.Manager fields, document as legacy. The profile page already merges both. No work.
- Path B: migrate. For each Users record with a Manager linked, create a `reports_to` RC (Person = this user, Lead = manager, Type = reports_to). Delete the Users.Manager field afterward.

I'd hold this for the architecture migration window. Not urgent.
