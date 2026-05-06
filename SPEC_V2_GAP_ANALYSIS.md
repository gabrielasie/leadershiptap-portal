# LeadershipTap Spec v2.0 — Gap Analysis & Implementation Plan

Generated against `LeadershipTap_BuildInstructions_v2.pdf` and the codebase as of this commit.

## TL;DR

The spec is titled "Complete specification for building from scratch." It is not a patch list. But the codebase is further along than the spec implies — most of Sections 3, 4, 6, and 7B are already implemented. The remaining work is concentrated in three places:

1. Notes data layer is missing the **Relationship Context** anchor (the most important spec requirement, Section 5 Notes).
2. Meetings.Relationship Context is a text field; spec requires a linked record.
3. Several spec-described tables/fields don't exist in current Airtable (Portal Accounts as a separate table, plus the spec deprecates Coach-Person Context and Coach Session entirely).

Naming differences (Users vs People, Companies vs Organizations, Content vs Body, Title vs Task Title) are cosmetic and can be ignored or done later. They do not change behavior.

---

## What's already done (against spec)

| Spec section | Status | Notes |
|---|---|---|
| Decision 3 — RC types `coaching` and `reports_to` only | Done in code | TypeScript types are clean. Airtable data may have stale rows with old type values that need cleanup (see Action Items). |
| Decision 4 — Row direction Person → Lead | Done | Confirmed in `generateRelationshipRows()`. |
| Decision 5 — Multiple coaches/leads supported | Done | No schema constraint blocks this. |
| Decision 6 — Downstream traversal not stored rows | Done | `getDownstreamPeople()` capped at 3 hops, matches spec. |
| Decision 7 — Notes Visibility hardcoded private_to_author | Done | Hardcoded on every `createNote()` call. |
| Decision 8 — Tasks auto-set Task Type and Visibility | Done | `createTask()` derives both from assignment. |
| Decision 9 — Permission Profiles single-row scaffold | Done | `getStandardPermissionProfileId()` caches the lookup. |
| Section 3 Step 4 — Dashboard query: Lead = me AND Status = Active | Done | `getRelationshipContexts()`. |
| Section 3 Step 7 — Tasks for user | Done | `getTasks()` filters Assigned OR Created + open status. |
| Section 4 — Onboarding 3-input flow | Done | `NewPersonForm.tsx` + `generateRelationshipRows()`. |
| Section 7B — Calendar sync RC-based filtering + fan-out | Done | `app/api/calendar/sync/route.ts`. |
| Section 7B Step 7 — Cancel handling by Provider Event ID | Done | `cancelMeetings()`. |

---

## Real gaps, prioritized

### P0 — Behavioral, must fix

**1. Notes does not link to Relationship Context.** Spec Section 5 Table 8 says Notes have THREE required anchors: Author Person, Subject Person, **Relationship Context**. The current `FIELDS.NOTES` map has no `RELATIONSHIP_CONTEXT` and `notes.ts` neither reads nor writes it. This breaks the spec's privacy boundary model: without RC on a note, you cannot answer "show me notes Josh wrote in his coaching context with Iyan" without falling back to Subject Person, which is wrong when the subject is a downstream person (Section 5 Notes "key note pattern").

**2. Meetings.Relationship Context is a text field, not a linked record.** `FIELDS.MEETINGS.REL_CONTEXT_ID = 'Relationship Context ID'` and the calendar sync writes the record ID as a string. Spec Section 5 Meetings requires `Associated Relationship Context` as a `Link → Rel. Contexts` field. Functionally the sync works because the string ID matches; but you cannot use Airtable's mirror fields, you cannot follow the link in the UI, and `Associated Meetings` mirror on Relationship Contexts will be empty.

### P1 — Spec-required features not yet present

**3. Notes UI does not pass Relationship Context.** `LogNoteDialog.tsx` and `GlobalLogNoteDialog.tsx` need to compute the RC for (currentCoach, subjectPerson) and pass `relationshipContextId`. Reuse `getRelationshipContext(coachId, personId)` from `relationships.ts` — same lookup Tasks already does.

**4. Coach-Person Context and Coach Session tables are not in spec.** Spec consolidates everything into Notes (with Note Type) and Tasks. Deprecation options:
   - **Option A (clean):** migrate Quick Notes / Family Details into Notes with `Note Type = general_context`. Migrate Session Notes into Notes with `Note Type = meeting_note` and a Meeting link. Migrate Action Items into Tasks. Then delete the wrapper tables and lib files.
   - **Option B (defer):** keep both tables for v1, document them as legacy convenience wrappers. Address in v2.
   - Recommendation: **Option B for now.** The migration is mechanical but risky, and the spec doesn't require it for v1 functionality. Just don't add new dependencies on these tables.

**5. Portal Accounts table does not exist.** Spec Section 5 Table 6 wants a separate Portal Accounts table with Account Status, Global Access Level, Auth Provider User ID. Currently `getCurrentUserRecord()` resolves Clerk → Users (People) directly. The spec's authorization flow (Section 3) checks Account Status before anything else.
   - For v1 with only 2 coaches, this is overhead with no payoff. Add when client_user role activates (v2). The spec itself flags `client_user` and `internal_admin` as "Build and test last."
   - **Recommendation: defer.** Document in CLAUDE.md as known v2 work.

### P2 — Cosmetic / naming

**6. Tasks.Status values: lowercase vs Title Case.** Spec: `Not Started, In Progress, Complete, Cancelled`. Code: `'not started', 'in progress', 'completed', 'cancelled'`. Note also `completed` vs `Complete` — different word. The case-insensitive `mapTaskRecord` tolerates either, but writes use lowercase. To be spec-compliant you'd update the Airtable single-select options and the write paths.
   - **Recommendation:** lowest priority. Doesn't break anything. Do during a quality pass.

**7. Notes Body field is named "Content" in Airtable.** Spec says "Body". Pure rename. Trivial.

**8. Users → People, Companies → Organizations, Title → Task Title rename.** Cosmetic. The spec's Section 9 says "field descriptions verbatim" but field names are also explicit. Renames touch every file that references these tables. Cost-benefit is bad for v1.
   - **Recommendation:** skip. Don't rename Airtable tables that work.

**9. Calendar Owner Person on Meetings is text, not link.** Spec: `Calendar Owner Person Link → People`. Current: stored as email string. Linking would require populating People IDs in the sync, which means the sync needs an email→record lookup it already builds. Cheap, but not a behavioral gap.

### P3 — Data hygiene, manual

**10. Existing Relationship Context rows with legacy types.** Decision 3 names `coach, direct_report, indirect_senior, participant` as "flag for removal." Need to query Airtable and update or delete any rows still using those values. The TypeScript type union `'coaching' | 'reports_to'` will silently fall back to `'coaching'` for unknown values, which masks bad data.

**11. Existing RC rows with non-Title-Case Status values.** Sync writes `'Active'`, but earlier seed scripts may have written `'active'`. The query uses `LOWER(...) = "active"` so reads tolerate both. Audit and normalize via the Airtable UI or a one-off script.

---

## Recommended Claude Code prompts

Run in this order. After each prompt, run `npm run build` and verify the listed manual checks before moving on.

### Prompt 1 — Add Relationship Context to Notes

> Add Relationship Context as a required anchor on the Notes data layer.
>
> 1. In `lib/airtable/constants.ts`, add `RELATIONSHIP_CONTEXT: 'Relationship Context'` to `FIELDS.NOTES`.
> 2. In `lib/airtable/notes.ts`:
>    - Add `relationshipContextId?: string` to the `Note` interface.
>    - Update `mapRecord()` to read `relationshipContextId` from `FIELDS.NOTES.RELATIONSHIP_CONTEXT` using the existing `firstLinkedId()` helper.
>    - Add `relationshipContextId?: string` to `CreateNoteData`.
>    - In `createNote()`, write `[FIELDS.NOTES.RELATIONSHIP_CONTEXT]: [data.relationshipContextId]` when provided. Do not make it required at the type level yet — the form change is in Prompt 2.
> 3. Add a new read function `getNotesByRelationshipContext(rcId: string, authorPersonId: string)` that returns notes where Author Person = authorPersonId AND Relationship Context = rcId. Sort by Date desc. JS-filter both linked fields.
> 4. Do NOT remove the `CLIENT` field from constants or `mapRecord` yet — the existing data layer still uses it.
>
> Manual prerequisite before running this code: **add a Relationship Context linked field to the Notes table in Airtable** (Link → Relationship Contexts, single-record).
>
> Verification: `npm run build` passes. Open `/api/debug-fields` (or write a temp script) to confirm a Notes record can be created with all four links.

### Prompt 2 — Wire Relationship Context into the Note creation forms

> Update the note creation UI to compute and pass Relationship Context.
>
> 1. In `LogNoteDialog.tsx` and `GlobalLogNoteDialog.tsx` (and any associated server actions in `app/(protected)/users/[id]/actions.ts` and `app/(protected)/dashboard/actions.ts`):
>    - When the user picks a subject person, call `getRelationshipContext(currentCoachAirtableId, subjectPersonId)` from `lib/airtable/relationships.ts`.
>    - If a context is found, pass `relationshipContextId: ctx.id` to `createNote()`.
>    - If no direct context exists (for a downstream subject person), find the upstream RC the coach uses to reach this person — the spec's "key note pattern" example: a note about Stephanie under the Josh→Iyan coaching context. For v1, do this by calling `getRelationshipContexts(coachId)` and walking one hop: for each RC where Lead = coach, check if `getRelationshipContexts(rc.personId)` returns a row where personId = subjectPersonId. Use the coach's RC, not the downstream person's row.
>    - If no context can be found at all, refuse the save with an error: "No active coaching or reporting relationship reaches this person."
> 2. Don't duplicate the logic across files. Put the resolver in `lib/airtable/relationships.ts` as `resolveContextForSubject(coachId, subjectPersonId)` and import it.
>
> Verification: log a note about a direct client → check Airtable, RC field populated. Log a note about a downstream person → RC is the upstream coaching context. Try logging a note for a person you have no relationship with → save fails with the message above.

### Prompt 3 — Convert Meetings.Relationship Context to a linked record

> Migrate the `Relationship Context ID` text field on the Meetings table to a linked record.
>
> Manual prerequisite before running this code:
> 1. In Airtable, add a new field `Relationship Context` (Link → Relationship Contexts, single-record, allow link to records).
> 2. Run a one-time backfill to copy values from the old text field to the new linked field. Either via Airtable scripting or a Node script (a `scripts/migrate-meeting-rc.ts` is a good place).
> 3. Once the linked field is fully populated, leave the old text field alone for now — the code change below switches to reading the new field.
>
> Code changes:
> 1. In `lib/airtable/constants.ts`, change `REL_CONTEXT_ID: 'Relationship Context ID'` to `RELATIONSHIP_CONTEXT: 'Relationship Context'`.
> 2. In `lib/airtable/meetings.ts`:
>    - Update `mapRecord()` to read RC as a linked field: `relationshipContextId: firstLinkedId(record.fields[FIELDS.MEETINGS.RELATIONSHIP_CONTEXT])`. (Add `firstLinkedId` if not already in this file.)
> 3. In `app/api/calendar/sync/route.ts`:
>    - In `upsertMeeting()`, change the write to `[FIELDS.MEETINGS.RELATIONSHIP_CONTEXT]: [contextId]` (array, linked record).
>    - Update the dedup `findRes` formula and the JS filter: linked-record formulas return primary field values, not IDs, so fetch all matches by Provider Event ID and filter by `firstLinkedId(r.fields[FIELDS.MEETINGS.RELATIONSHIP_CONTEXT]) === contextId`.
> 4. After deploying and confirming sync works, you can delete the old `Relationship Context ID` text column in Airtable.
>
> Verification: trigger a manual sync from Settings, then look at one of the synced Meeting records in Airtable — the `Relationship Context` field should now be a linked record badge, not a text string. Re-running the sync should be idempotent (no duplicate records).

### Prompt 4 — Backfill RC on existing Notes (one-off script)

> Write a one-time migration script at `scripts/backfill-notes-rc.ts` that:
>
> 1. Fetches all Notes records.
> 2. For each note with no Relationship Context but a populated Author Person and Subject Person:
>    - Use the same `resolveContextForSubject(authorPersonId, subjectPersonId)` resolver added in Prompt 2.
>    - If a context is found, PATCH the note with the linked RC.
>    - If not, log the note ID and skip it (manual cleanup).
> 3. Print a summary: total notes, backfilled, skipped, errors.
>
> Run via `npx tsx scripts/backfill-notes-rc.ts` after the resolver is in place.

### Prompt 5 — Audit and clean stale Relationship Context rows

> Write a script at `scripts/audit-rc-types.ts` that:
>
> 1. Fetches all Relationship Context records.
> 2. Reports the distribution of `Relationship Type` values.
> 3. Lists any rows where the type is not `coaching` or `reports_to` (e.g. `coach`, `direct_report`, `indirect_senior`, `participant`, `Executive Coaching`, `manager`, `sponsor`, `peer`).
> 4. Lists any rows where Status is not `Active`, `Inactive`, `Paused`, or `Ended`.
>
> Do not modify rows — output a report only. The user will decide whether to delete, update, or set Status = Inactive on each one. The TypeScript type `'coaching' | 'reports_to'` silently falls back to `'coaching'` for unknown values, so this audit catches data masquerading as valid.

### Prompt 6 — (Optional, P2) Normalize Tasks.Status casing

> Bring Tasks.Status into spec compliance.
>
> Spec values: `Not Started, In Progress, Complete, Cancelled`.
> Current code: `'not started', 'in progress', 'completed', 'cancelled'`.
>
> 1. Update Airtable Tasks table single-select options to spec values.
> 2. Run a backfill to update existing records.
> 3. Update `lib/airtable/tasks.ts`:
>    - Change `mapTaskRecord` status normalization to recognize the new casing (and continue to tolerate the old, in case of stragglers).
>    - Change writes in `createTask` and `updateTask` to use `'Not Started'` etc.
> 4. Update `lib/types.ts` `TaskStatus` type to use the new strings.
> 5. Update any UI badges that display status to use the new strings (or keep a display formatter).
>
> Verification: create a task → status reads `Not Started` in Airtable, displays correctly in UI.

---

## Manual action items (Airtable UI work, not code)

Do these in order. They block the corresponding prompts.

1. **Add `Relationship Context` field to Notes table.** Type: Link → Relationship Contexts, single-record. Required for Prompt 1.
2. **Add `Relationship Context` field to Meetings table.** Type: Link → Relationship Contexts, single-record. Required for Prompt 3. (Keep the old `Relationship Context ID` text field until backfill is done.)
3. **Audit `Relationship Type` values in Relationship Contexts.** Run Prompt 5's audit, then manually fix any non-conforming rows.
4. **Audit `Status` values across all tables.** Spec uses Title Case (`Active`, `Inactive`, `Paused`, `Ended`). Current code is case-tolerant on reads but writes Title Case. Fix anything that's lowercase via Airtable UI.

---

## Items to skip or defer (and why)

| Item | Decision | Reason |
|---|---|---|
| Rename Users → People in Airtable | Skip | Cosmetic. Touching every file that references the table for zero behavior change. The constant key `PEOPLE` already maps to the string `'Users'`. |
| Rename Companies → Organizations | Skip | Same as above. |
| Rename Notes.Content → Body | Skip | Cosmetic. |
| Rename Tasks.Title → Task Title | Skip | Cosmetic. |
| Build Portal Accounts table | Defer to v2 | Spec itself says `client_user` and `internal_admin` are "build and test last." For 2 coaches, Clerk publicMetadata + Users.Role is sufficient. Add when external clients get login access. |
| Migrate Coach-Person Context and Coach Session into Notes | Defer to v2 | Mechanical but risky. They work today, spec doesn't break for keeping them, and there's no v1 user impact. Document in CLAUDE.md as legacy. |
| Convert Meetings.Calendar Owner from text to link | Optional | Nice-to-have for spec compliance. Not behaviorally important. |

---

## Checklist before declaring v1 done

Once Prompts 1–5 are run and the manual Airtable work is complete, verify:

- [ ] Logging a note about a direct client populates Relationship Context.
- [ ] Logging a note about a downstream person uses the upstream coaching RC.
- [ ] Calendar sync writes Meetings with `Relationship Context` as a linked field, not text.
- [ ] All existing notes have a Relationship Context (after backfill).
- [ ] No Relationship Context rows have stale type values.
- [ ] Tasks read/write correctly (Prompt 6 if you want spec-clean status casing).
- [ ] All four privacy boundary cases work end-to-end:
   1. Josh's notes about Iyan are visible to Josh, not to Matt.
   2. Josh's notes about Stephanie (downstream via Iyan) are visible only to Josh.
   3. Matt's notes about Kevin are visible only to Matt.
   4. Iyan's reports_to row to Hui doesn't expose Iyan's coaching notes to Hui.
