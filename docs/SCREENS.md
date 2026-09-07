# Interface catalogue

The 43 screens defined in `spec/` -> `Khelo_Sanand_Data_and_Functions.xlsx` -> *Screens*,
with what this build ships against each.

**Status key**
- **Built** - implemented and reachable
- **Frame** - the shared score-entry frame and this discipline's form body are built;
  the fixture-selection route around them is not
- **Routed** - the route exists and renders a placeholder that says so
- **Not built** - no route

Every "Routed" and "Not built" screen is a deliberate omission, not an oversight; see
`ARCHITECTURE.md` -> *What is not built*.

---

| ID | Role | Screen | Module | Status |
|---|---|---|---|---|
| `UI-001` | ED | Overview | M11 | **Built** |
| `UI-002` | ED | Schools & Clusters | M01 | Routed |
| `UI-003` | ED | Event Setup | M01 | Not built |
| `UI-004` | ED | Venues | M01/M06 | Not built |
| `UI-005` | ED | People | M02 | Routed |
| `UI-006` | ED/CH | Deployment | M03 | Routed |
| `UI-007` | ED/CH | Athletes | M04 | Routed |
| `UI-008` | ED | Import Wizard | M04 | Not built |
| `UI-009` | ED/delegated CH | Team Roster | M04 | Not built |
| `UI-010` | ED | Sports & Rules | M05 | Routed |
| `UI-011` | ED | Competition Stages | M05/M06 | Not built |
| `UI-012` | ED/CH/VOL | Schedule | M06 | Routed |
| `UI-013` | ED/CH/VOL | Fixture Detail | M06/M09 | Not built |
| `UI-014` | VOL | Today | M07/M09 | **Built** |
| `UI-015` | VOL | My Schools | M01/M03 | Routed |
| `UI-016` | VOL | My Profile | M02 | Routed |
| `UI-017` | VOL | My Attendance | M07 | Routed |
| `UI-018` | CH/ED | Attendance Roster | M07 | Routed |
| `UI-019` | CH/ED | Kit Distribution | M08 | Routed |
| `UI-020` | VOL | My Kit | M08 | Routed |
| `UI-021` | ED/delegated CH | Optional Stock | M08 | Not built |
| `UI-022` | CH | Review Queue | M09 | Routed |
| `UI-023` | CH/ED | Scorecard Review | M09 | Not built |
| `UI-024` | ED | Result Amendment | M09 | Not built |
| `UI-025` | ALL | Notification Centre | M10 | Routed |
| `UI-026` | ED/CH | Reports | M11 | Routed |
| `UI-027` | ED | Audit Explorer | M12 | Routed |
| `UI-028` | ED | Exceptions | M12 | Routed |
| `UI-029` | ED | Configuration | M12 | Routed |
| `UI-030` | ED/Operations | Service Health | M12 | Not built |
| `UI-G-KAB` | VOL + CH review | Kabaddi Score Entry | M05/M09 | Frame |
| `UI-G-SP30` | VOL + CH review | Sprint 30 m Score Entry | M05/M09 | Frame |
| `UI-G-SP50` | VOL + CH review | Sprint 50 m Score Entry | M05/M09 | Frame |
| `UI-G-SP60` | VOL + CH review | Sprint 60 m Score Entry | M05/M09 | Frame |
| `UI-G-KHO` | VOL + CH review | Kho Kho Score Entry | M05/M09 | Frame |
| `UI-G-SBT` | VOL + CH review | Softball Throw Score Entry | M05/M09 | Frame |
| `UI-G-KJT` | VOL + CH review | Kids Javelin Throw Score Entry | M05/M09 | Frame |
| `UI-G-CYC` | VOL + CH review | Cycling Score Entry | M05/M09 | Frame |
| `UI-G-CHE` | VOL + CH review | Chess Score Entry | M05/M09 | Frame |
| `UI-G-SBJ` | VOL + CH review | Standing Broad Jump Score Entry | M05/M09 | Frame |
| `UI-G-TOW` | VOL + CH review | Tug of War Score Entry | M05/M09 | Frame |
| `UI-G-BAD` | VOL + CH review | Badminton Score Entry | M05/M09 | Frame |
| `UI-G-VOL` | VOL + CH review | Volleyball Score Entry | M05/M09 | Frame |

---

## What every built screen inherits

The universal rules in section 1 are built once in the shell and shared components,
not repeated per screen:

- **Header** - selected event, role, accessible scope, connection state, last refresh
  time, and a language switch. `apps/web/src/app/shell.tsx`
- **Event timezone** - every time renders in Asia/Kolkata, never the device's zone. A
  volunteer with a wrong phone clock still sees the official schedule.
- **List states** - loading, empty, error and filter reset, with the error naming the
  offending field or row and a remedy. `apps/web/src/screens/states.tsx`
- **Status as text plus colour**, never colour alone.
- **Touch targets** at 44 px minimum, numeric keypads for scores, and a focus ring that
  is never removed.
- **Error boundary** showing a quotable reference and confirming local drafts are
  untouched. `apps/web/src/app/error-boundary.tsx`

## The score-entry frame

`UI-G-*` are thirteen screens sharing one frame. Section 15: *"All score-entry screens
share fixture identity, pinned rules, participant list, official attestation,
observation history, Save Draft, Review, Submit and sync status."*

`apps/web/src/games/frame.tsx` provides that frame; `forms.tsx` provides eight
discipline bodies covering all thirteen codes, one per calculation family:

| Body | Disciplines | Family |
|---|---|---|
| `AttemptsForm` | SBT, KJT, SBJ | Attempts |
| `SprintForm` | SP30, SP50, SP60 | Time |
| `MatchForm` | BAD, VOL | Games / Sets |
| `KabaddiForm` | KAB | Raid |
| `KhoKhoForm` | KHO | Turn |
| `ChessForm` | CHE | Chess |
| `TugOfWarForm` | TOW | Pulls |
| `CyclingForm` | CYC | Time / OfficialOrder |

Each calls the **same calculator** from `@khel/rules` that the server runs, so the
volunteer sees the real result as they enter it - section 6: *"Render the same form and
calculator used by VOL."*

Two behaviours worth singling out:

- **The judge's validity decision comes first.** Valid / Foul / Pass is chosen before a
  measurement field appears, and a distance is only ever stored against a valid attempt
  (sections 19 and 23).
- **Unavailable controls are disabled with their reason, not hidden.** A Kabaddi bonus
  button under a profile that does not enable bonuses renders greyed, with the rule as
  its tooltip (section 16). Hiding it would make the rule profile invisible.

