# LeadershipTap Portal — Claude Context

## Airtable Field Map (confirmed Week 3)

### Calendar Events table
| Airtable field | Type | Notes |
|---|---|---|
| `Note Name` | Text | Primary field |
| `EventName` | Text | Meeting title |
| `StartTime` | DateTime | ISO 8601 |
| `EndTime` | DateTime | ISO 8601 |
| `SenderEmail` | Email | Organiser |
| `ParticipantEmails` | Text | Comma-separated or array |
| `EventID` | Text | External calendar ID |
| `Action Type` | Text | |
| `Convert` | Formula/checkbox | |
| `Notes` | Long text | Added Week 4 — may be empty on old records |

### Messages table
| Airtable field | Type | Notes |
|---|---|---|
| `Message Name` | Text | Primary field |
| `Subject` | Text | Message subject line |
| `AI Generated Message Content` | Long text | The message body |
| `Status` | Single select | Values: `"Pending"` / `"Sent"` — use `"Pending"` for drafts, never `"Draft"` |
| `Calculation` | Formula | Read-only — do not write |
| `Created` | Created time | Read-only — do not write |

### Users table
| Airtable field | Maps to |
|---|---|
| `Full Name` | `fullName` |
| `Preferred Name` | `preferredName` |
| `First Name` | `firstName` |
| `Last Name` | `lastName` |
| `Email` | `email` |
| `Work Email` | `workEmail` |
| `Job Title` | `jobTitle` |
| `Role` | `role` |
| `Company ID` | `companyId` |
| `Company Name` | `companyName` |
| `Avatar URL` | `avatarUrl` |
| `Enneagram` | `enneagram` |
| `MBTI` | `mbti` |

## Key conventions
- Status for messages is always `"Pending"` (not `"Draft"`)
- Never write to `Calculation` or `Created` fields
- Server Actions live in `actions.ts` co-located with the page that uses them
- Airtable mutations use the REST API directly (fetch) not the SDK, because the SDK does not support PATCH easily
- All Airtable access is server-side only — API key never exposed to browser
