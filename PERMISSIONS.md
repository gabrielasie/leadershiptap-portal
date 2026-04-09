# LeadershipTap Portal — Permissions Model

## Role determination

Portal access roles are stored in **Clerk `publicMetadata`**, not in Airtable.

```json
// Clerk user publicMetadata
{ "role": "admin" }   // or "coach"
```

Set this in the Clerk Dashboard → Users → select user → Metadata → Public.
If `publicMetadata.role` is absent or unrecognised, treat the user as `"coach"`.

Read server-side with:
```ts
import { auth } from '@clerk/nextjs/server'
const { sessionClaims } = await auth()
const role = (sessionClaims?.metadata as { role?: string })?.role ?? 'coach'
```

**Why Clerk, not Airtable `Role` field:**
The Airtable `Users.Role` field stores the *client's* organisational role
("Team Member", "Senior Leader"). It is unrelated to portal access level.
Mixing them would require an extra Airtable fetch on every request and create
ambiguity in the field map.

---

## Airtable field required for coach scoping

Add one field to the **Users** table:

| Field | Type | Value |
|---|---|---|
| `Coach Email` | Email / Text | The portal login email of the assigned coach |

This is the coach's Clerk login email. When a coach is logged in,
their clients are rows where `{Coach Email} = "<coach login email>"`.

Can be upgraded to a linked record later without changing the filtering logic.

---

## ADMIN role

**Can see:**
- All clients in the Clients list (no filter)
- All meetings, notes, messages, tasks across all clients
- All pages and actions in the portal

**Identified by:** `Clerk publicMetadata.role === "admin"`

---

## COACH role

**Can see:**
- Only clients where `Airtable Users.Coach Email` matches their Clerk login email
- Only meetings, notes, messages, and tasks for those clients
- Their own dashboard view (meetings this week = their clients' meetings only)

**Identified by:** `Clerk publicMetadata.role === "coach"` (or role absent)

**Cannot see:**
- Other coaches' clients
- Other coaches' notes or messages

---

## TEMPORARY OPEN ACCESS (development — Week 7)

The following are intentionally unscoped during active development.
Each item should be gated before production.

| Area | Current state | Required gate |
|---|---|---|
| Clients list (`/users`) | Returns all Airtable Users records | Filter by `Coach Email` for coach role |
| Dashboard client activity | Shows all clients | Same filter |
| Dashboard meetings this week | Shows all meetings | Filter to coach's clients only |
| User detail page (`/users/[id]`) | Accessible by any logged-in user | Verify requesting user owns this client |
| Notes, tasks, messages | No ownership check | Verify client belongs to requesting coach |
| Meetings list (`/meetings`) | All meetings visible | Filter to coach's clients |

No data is currently public — all routes are behind Clerk authentication
(`(protected)` layout). The open access above is coach-to-coach, not
unauthenticated.

---

## Implementation order (when ready to enforce)

1. Add `Coach Email` field to Airtable Users table and populate it
2. Add a `getSessionRole()` helper that reads Clerk `publicMetadata.role`
3. Update `getAllUsers()` to accept an optional `coachEmail` filter param
4. Add a middleware or layout check on `/users/[id]` to verify ownership
5. Scope dashboard queries through the same filter
6. Set `publicMetadata.role = "admin"` on your own Clerk account first,
   confirm you still see everything, then set coaches to `"coach"`
