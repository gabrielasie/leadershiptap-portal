# Platform data audit — Relationship Contexts + cross-table observations

## Findings — Relationship Contexts (38 rows)

### 1. Four duplicate Person + Lead + Type rows (real problem)

| Person | IDs | Same Lead? | Same Type? |
|---|---|---|---|
| Garfield, Gabe | 9 + 26 | yes (Josh) | yes (coaching) |
| Barton, Jacqueline | 10 + 33 | yes | yes |
| Smith, Alison | 11 + 34 | yes | yes |
| Munn, Alyssa | 12 + 43 | yes | yes |

This shouldn't happen. `generateRelationshipRows()` in `lib/airtable/relationships.ts` builds a `personId|leadId|type` dedup set and silently skips matches before writing. Two possibilities:

(a) The duplicates were created **before** dedup logic was added (the seed script `scripts/seed-relationship-contexts.mjs`, run multiple times).
(b) The "duplicates" aren't actually duplicate rows — they're two different **Users records** with the same display name (e.g. there are two `Garfield, Gabe` in the Users table with different `recXXX` IDs). The dedup keys would be different, so both write succeeds. The display says "Garfield, Gabe" twice but they're different people from the system's perspective.

Almost certainly (b). To confirm: open the Relationship Contexts table in Airtable, click into the Person field for both rows of any duplicate. If the linked Users record IDs differ, you have duplicate Users records — that's the real bug.

**Recommended fix:**
- Open the Users table. Search for each duplicate name. If two records exist, pick the canonical one (the one with more populated fields — work email, profile photo, etc.). Re-link any meetings, notes, tasks pointing to the duplicate over to the canonical record. Delete the duplicate User. The orphaned RC row will follow.
- After cleanup, all four duplicates should resolve to one row each, leaving you with 34 rows.

### 2. One non-spec Relationship Type: "peer"

ID 20, Matt Metzger. Spec only allows `coaching` and `reports_to` (Decision 3). The normalizer I added in `lib/airtable/relationships.ts` coerces unknown values to `coaching` and logs a warning. Right now, the app silently treats Matt as a coaching client. Wrong.

**Decision needed (ask Josh):** what's Matt's actual relationship?
- If Matt is a fellow LeadershipTap coach — there should be NO RC row at all between coaches. Delete this row.
- If Matt is being coached by Josh — change Type to `coaching`.
- If Matt reports to Josh — change Type to `reports_to`.

### 3. Permission Level values are wrong shape for v1

Every row has `Permission Level = full_access`. Two issues:

**Issue 3a — Wrong field semantics.** The spec's Section 5 Table 5 calls this field `Permission Profile` and types it as `Link → Permission Profiles` (a linked record), not a single-select. The current Airtable column is a single-select with values `full_access, coach_owner, manager_limited, read_only` — that's the **old** Decision 9 model the spec replaced.

**Issue 3b — `generateRelationshipRows()` is currently writing the wrong shape.** The code writes:

```ts
fields[FIELDS.RELATIONSHIP_CONTEXTS.PERMISSION_LEVEL] = [standardProfileId]
```

That's an array of record IDs — correct for a linked-record field. But the actual Airtable column is a single-select. So the write probably silently coerces to the string representation of the record ID (something like `recXXX`), or silently fails, or Airtable rejects with a field-type mismatch logged to console.warn. The fact that all 38 rows say `full_access` and not `recXXX` means **the writes aren't happening through the new code**. These rows pre-date the linked-record write logic.

**Two paths forward:**

- **Path A (spec-correct, more work):** rename the column to `Permission Profile`, convert single-select → Link → Permission Profiles, populate all 38 rows with the link to the `standard` profile. Then the existing code works.
- **Path B (pragmatic v1 shortcut):** keep the single-select. Change `generateRelationshipRows()` to write the literal string `'full_access'` (or `'standard'`, doesn't matter for v1 since the app never reads this value). Code change is one line. Spec deviation but no behavior impact in v1.

I'd ship Path B for v1 and put Path A on the architecture migration list. Reading the field anywhere in the code? Let me confirm that's not happening currently.

### 4. Start Date populated on only 4 of 38 rows

IDs 9-12 have `2026-04-26`. The other 34 are blank. Spec says "Use first session date for coaching rows. Optional but recommended."

**Optional backfill:** for each RC, find the earliest associated Meeting (by Start Time, Status != Cancelled) and write that as Start Date. One-off script, useful for "active since" badge on profile pages.

### 5. Zero `reports_to` rows in the entire table

The whole org chart / drill-down feature (`getDirectReports`, "Their Team" section, downstream traversal) is empty because there are no `reports_to` Relationship Contexts. The platform has the feature, the data has none of it.

But: your `Users` table has `Manager`, `Direct Reports`, and `Team Members` linked fields. The profile page reads from those (`directReportIds`, `managerIds`, `teamMemberIds`). So you have a parallel reporting hierarchy living on the Users table that doesn't flow into Relationship Contexts.

This is the spec's split-store anti-pattern. Decision 4 says reporting hierarchy is a Relationship Context row. Decision 6 says downstream visibility is computed by traversing those rows. With the data living on Users.Manager instead, the spec's traversal model has nothing to traverse.

**Two paths:**

- **Path A (spec-correct):** migrate Users.Manager and Users.Direct Reports into `reports_to` RC rows. Remove the Users-level fields. The onboarding flow already supports this — your `NewPersonForm.tsx` writes RCs for Reports To and Direct Reports correctly. The migration is for existing data only.
- **Path B (pragmatic):** keep both. Document Users.Manager as the legacy field and Relationship Contexts as the spec-future field. Make sure the profile page reads from BOTH and merges. (It currently does this for Direct Reports — pulling both `directReportIds` from Users and the result of `getDirectReports()` from RC traversal.)

Path A is correct. Path B is what you have. Plan A for the architecture migration.

---

## Default value verification (code writes vs current Airtable)

| Field | Code writes | Current Airtable | Match? |
|---|---|---|---|
| Status (RC) | `'Active'` | `Active` (all 38) | yes |
| Status (RC, read filter) | `LOWER({Status}) = "active"` | values are Title Case | yes (case-insensitive) |
| Relationship Type (RC) | `'coaching'` or `'reports_to'` | 37 coaching, 1 peer | one bad row |
| Permission Level (RC) | `[standardProfileId]` (linked array) | `full_access` (single-select string) | **no — schema mismatch** |
| Start Date (RC) | not written | 4 populated, 34 empty | partial (optional) |
| Status (Tasks) | `'Not Started'` (Title Case) | (not in this dump) | unknown |
| Note Type (Notes) | `'general_context'` default | (not in this dump) | unknown |
| Visibility (Notes) | `'private_to_author'` always | (not in this dump) | unknown |

**The big one is Permission Level.** Schema mismatch between code and Airtable. Today this doesn't cause a user-visible bug because nothing reads the field. But silent write failures will compound — every new RC row from the onboarding form may end up with this field empty. Can you check one of the recent RC rows you created via the form (e.g. Hui Yang's row) and tell me what's in the Permission Level cell? That'll confirm whether the write succeeds or silently fails.

---

## Cross-table observations (need more data to confirm)

I only saw Relationship Contexts. I'd want to also audit:

1. **Users table** — duplicate detection. The four "duplicates" finding above strongly suggests Users has duplicate records. Run an audit checking for matches on (Work Email) and (First Name + Last Name).
2. **Companies table** — what's `Status` for each org? Section 5 Table 2 says only Active orgs should appear in dropdowns; the form now filters to Active only. If most companies are Inactive or Prospect, the company picker will be sparse and Josh will hit the "no companies to pick from" wall again.
3. **Notes table** — verify all notes have `Author Person`, `Subject Person`, `Relationship Context` populated post-backfill. If any notes are still missing RC, the privacy boundary leaks.
4. **Tasks table** — verify status values are Title Case post-Prompt 6 backfill.
5. **Meetings table** — confirm `Relationship Context` is now a linked-record field (per Prompt 3) and `Calendar Provider` distribution.

To run these audits yourself, I already wrote `scripts/audit-rc-types.ts`. The same pattern applied to other tables would be ~30 lines per script.

---

## Priority-ordered fix list

**Today (data fixes, no code):**

1. Investigate the 4 duplicate Users records. Pick canonical, re-link, delete the dupes. Resolves the duplicate RC rows.
2. Fix Matt Metzger's RC: ask Josh, then change Type or delete the row.
3. Check what's actually in the Permission Level cell for an RC created via the new form (e.g. Hui Yang). Tell me, I'll confirm whether writes succeed.

**This week (small code changes):**

4. Path B for Permission Level — change `generateRelationshipRows()` to stop writing it (or write a literal string), so the code stops trying to coerce a record ID into a single-select field.
5. Run the audit script across all tables. Pattern: `audit-users-dupes.ts`, `audit-notes-rc.ts`, `audit-tasks-status.ts`. Each script is mechanical.

**Architecture migration window:**

6. Path A for Permission Level — rename column to `Permission Profile`, convert to Link → Permission Profiles, populate.
7. Path A for reporting hierarchy — migrate Users.Manager / Direct Reports into `reports_to` Relationship Contexts. Drop the Users-level fields. Update profile page to read only from RC.
8. Backfill Start Date from first meeting per RC.

**Lower priority:**

9. Delete legacy seed scripts that may have created the duplicates (`scripts/seed-relationship-contexts.mjs`).

---

## "Seamless to use" — UX flags from the data

A few things in the data tell me where the platform is rough:

1. **No Start Date on most RCs** means the "Active since [Mar 2024]" badge on the profile page is mostly empty. Either backfill, or stop showing the badge when missing rather than rendering a half-filled phrase.
2. **No reports_to data** means the entire "Their Team" section + drill-down breadcrumbs are inert. If you're not actually using reporting hierarchy in v1, consider hiding those sections (rather than rendering empty states) so the profile page isn't full of unused affordances.
3. **38 RCs all under one coach** means the dashboard's "By Coach" filter on the Clients page is moot. Consider hiding the filter when coaches.length === 1.

Each of those is a small `if` in the rendering layer. Together they tighten the perceived polish meaningfully.
