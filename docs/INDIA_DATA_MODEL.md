# The Indian sports ecosystem: data model decisions

The specification is deliberately jurisdiction-neutral. It says "district", "city",
"contact", "DOB" and leaves identity policy as an open decision. Deployed in Gujarat
for a school BalOlympiad, several of those neutral choices produce data that is
unusable, unmatched against government records, or non-compliant.

This document records what was changed and why. The short version: **eleven changes,
of which three are compliance-critical and eight are operational.**

---

## 1. Administrative geography — `State → District → Taluka → City/Village → PIN`

The spec's `School` has `address`, `district`, `city`.

India's operational hierarchy for a district-level school event has one more level that
matters: the **taluka** (also *tehsil* or *block*). Sanand is a taluka of Ahmedabad
district — so "Khelo Sanand" is a *taluka-level* event inside a district. Without that
level the catchment cannot be expressed and clusters end up encoded in free text.

| Field added | Type | Why |
|---|---|---|
| `state_code` | ISO 3166-2:IN (`GJ`) | Needed once an event spans more than one district |
| `taluka` | text | The event's actual unit of organisation |
| `pincode` | 6 digits, first 1–8 | The only machine-checkable locality key in an Indian address |

`9` as a first digit is the Army Post Office range and is rejected. Enforced by
`school_pincode_format_ck`.

---

## 2. School identity — UDISE+

`school_code` in the spec is an **event-local business code**. Indian schools already
carry a national key: the **UDISE+ code** issued under the Ministry of Education's
Unified District Information System for Education — 11 digits, encoding
state / district / block / village / school.

Recording it makes the school master reconcilable against government data and survives
renames, which §2 explicitly worries about. Enforced as exactly 11 digits by
`school_udise_format_ck`.

It is **optional**. Some private unaided schools cannot supply it at registration, and
blocking a registration on a missing code is worse than a null.

Also added, because they change how a school is actually dealt with:

- **`board`** — GSEB / CBSE / ICSE / NIOS / IB / IGCSE. Affiliation determines how
  standards map to age bands.
- **`management_type`** — Government, LocalBody (municipal / panchayat),
  GovernmentAided, PrivateUnaided, CentralGovernment. Mirrors the UDISE+ categories.
  Operationally significant: government and municipal schools route approvals through
  the education department; private unaided do not.
- **`medium_of_instruction`** — Gujarati / Hindi / English / Marathi. Drives the default
  UI language for that school's staff and the language of printed start lists. Not
  cosmetic in Gujarat.

---

## 3. Standard, not grade

§5 correctly insists class and age stay separate. In India the unit is the **Standard**
(1–12), and pre-primary (**Balvatika**) is common in the age band a BalOlympiad targets.

`AthleteRegistration.standard` is a closed vocabulary, plus `section` ("A", "B") which
is what actually locates a child on the school register during verification.

It lives on the **registration**, not the athlete, because a child's class changes each
edition — exactly the reason §5 wants class separated from age.

---

## 4. Contact details — mobile is not an identifier

§3 already warns that "Mobile is not assumed to be a universally unique identifier for
children". In India this is acute: siblings routinely share one guardian handset, and
one number may cover an extended family.

- `Guardian.mobile_e164` is **deliberately not unique**.
- Uniqueness applies only to **staff login identity**, and only where the configured
  identifier policy says so.
- Validation: 10 digits beginning 6–9, normalised to `+91XXXXXXXXXX`.
  `normaliseIndianMobile()` in `packages/contracts/src/india.ts`; enforced by
  `guardian_mobile_format_ck` and `volunteer_mobile_format_ck`.

---

## 5. Names — no first/last split

A first/last split is wrong here. Gujarati convention is commonly
`<given name> <father's given name> <family name>`, and a meaningful minority of names
are single-token. Forcing a surname produces junk data and breaks matching against
school registers.

- `full_name` / `display_name` is **authoritative**, as written on the school register.
- `full_name_local` / `display_name_local` holds the Gujarati or Devanagari original.
  §1 requires that "Names retain their original script" across UI languages — so a name
  is **never** passed through translation.
- `given_name` / `family_name` are optional, for sorting only, never required.

---

## 6. ⚠️ Identity documents — Aadhaar is designed out

**This platform never stores an Aadhaar number.**

The spec's generic `Document.document_type` would invite an Indian deployment to store
Aadhaar as age proof. Two reasons not to:

1. The Aadhaar Act 2016 §29 restricts sharing of identity information, and UIDAI has
   repeatedly directed non-authorised entities not to retain Aadhaar numbers.
2. It is unnecessary. A **birth certificate** or **transfer certificate (TC)** is the
   ordinary age proof for a school entry.

What is stored instead:

```
DOB_PROOF_TYPES = [BirthCertificate, TransferCertificate, SchoolBonafide]
```

`AadhaarSighted` exists as a **sighting record only**: who checked, when, verification
status — and, where an auditor must reconcile one specific record,
`sighted_last_four`, constrained to exactly four digits:

```sql
CHECK (sighted_last_four IS NULL OR sighted_last_four ~ '^[0-9]{4}$')
```

A 12-digit value cannot be written to that column. `containsAadhaarLikeNumber()` guards
free-text fields. Biometrics are out of scope entirely.

**Removing the capability is stronger than guarding it.**

---

## 7. ⚠️ Guardian consent — DPDP Act 2023 §9

The single largest gap for an Indian deployment: the specification has **no consent
entity at all**, and every athlete here is a child.

India's Digital Personal Data Protection Act 2023 §9 requires a data fiduciary to
obtain **verifiable consent of a parent or lawful guardian** before processing a
child's personal data, and prohibits tracking or behavioural monitoring of children.

Two new entities:

**`Guardian`** — a parent or lawful guardian, as a record rather than a free-text
contact string, because §9 requires consent to come from an *identified* guardian.

**`ConsentRecord`** — purpose-scoped, versioned, language-aware:

| Field | Why it exists |
|---|---|
| `purpose` | `EventParticipation`, `MedicalEmergency`, `PhotographyMedia`, `PublicResults` — separate questions, separately consented |
| `method` | `SignedPaperForm` / `SchoolAttested` / `DigitalOtpVerified`. §9 says *verifiable*; a volunteer's tick-box is not verification |
| `notice_version` | Changing the notice does not retroactively re-consent anyone |
| `notice_locale` | Consent to a notice nobody could read is not consent |
| `withdrawn_at` | Withdrawal is recorded, never deleted — §13 needs the trail |
| `expires_at` | Consent for one edition does not roll forward silently |
| `evidence_document_id` | The signed form or attestation |

Wired into the platform:

- `MANDATORY_CONSENT_PURPOSES = [EventParticipation]` — no consent, no entry.
- Public result publication requires its own separate consent purpose.
- Error code `CONSENT_REQUIRED` (HTTP 451) blocks at the API, so imports and background
  jobs are covered too — not just the UI.
- At most one live consent per athlete per purpose
  (`consent_one_active_per_purpose_uq`).
- **No behavioural analytics on athlete records.** No third-party scripts anywhere.

---

## 8. Age categories — templates, not defaults

§27 lists age groups as an open decision, and it is right to. But shipping with no
template forces every organiser to invent one, and inconsistent cutoffs are the
commonest source of eligibility disputes in Indian school sport.

Seeded as **Draft templates requiring approval**, following the School Games Federation
of India convention of under-N bands assessed *as on 31 December* of the competition
year:

| Code | Band | Cutoff |
|---|---|---|
| U09 | Under 9 | 31 December |
| U11 | Under 11 | 31 December |
| U14 | Under 14 | 31 December |
| U17 | Under 17 | 31 December |
| U19 | Under 19 | 31 December |

U-14 / U-17 / U-19 are the SGFI-convention bands; U-9 and U-11 are added for a
primary-school event and are marked as such.

**Neither the bands nor the cutoff is asserted as this event's policy.** They seed as
`approval_status: Draft` with the note `TEMPLATE — requires organiser approval
(DEC-002)`. DEC-002 remains open.

`Category.participation_category` (Boys / Girls / Mixed / Open) is kept **separate**
from the age band, so a competition is (age band × participation category) — which is
how entries are actually organised. §5 forbids inferring any of this from names or
photographs, so it is declared.

---

## 9. Academic year — "2026-27", not "2026"

India's school year runs roughly June to April. `Event.academic_year` is validated as
`YYYY-YY` with a consistent second component (`isValidAcademicYear`), so editions sort
correctly and match how schools label them.

---

## 10. Language — Gujarati first

§1 lists Gujarati, Hindi and English as OPTIONAL. For a Sanand deployment they are not.

- `Event.default_locale` defaults to **`gu`**.
- Full UI translation for all three, with a font stack that will not render tofu for
  Gujarati or Devanagari.
- **Numbers may be localised; units and values never change with language.** 13.100 m
  is 13.100 m in every locale (`formatMeasurement`). §1: "timestamps, units and category
  rules remain consistent across languages."
- Times render in the **event timezone**, never the device's — a volunteer whose phone
  clock is wrong must still see the official schedule.

---

## 11. Connectivity — offline is the normal case

Rural Gujarat venues have patchy 4G. §14 and source S12 note that the Background
Synchronization API is not universally available.

- Drafts cache in IndexedDB, scoped to `(event, user)` — a draft never leaks between
  accounts on a shared handset.
- **Minimised personal data in the cache**: no dates of birth, no guardian contacts, no
  documents. A venue phone is not worth a lost handset.
- Local save and server save are shown as **separate facts** with separate timestamps.
- A stale draft is **quarantined for review**, never merged or auto-retried.
- Manual retry always works; nothing depends on background sync.
- Cache cleared on sign-out.

---

## Summary

| # | Change | Kind |
|---|---|---|
| 1 | Taluka, state code, PIN code | Operational |
| 2 | UDISE+ code, board, management type, medium | Operational |
| 3 | Standard and section on the registration | Operational |
| 4 | Indian mobile format; never unique for athletes | Operational |
| 5 | Full name authoritative; local script; no forced surname | Operational |
| 6 | **Aadhaar designed out; four digits maximum** | **Compliance** |
| 7 | **Guardian consent, purpose-scoped (DPDP §9)** | **Compliance** |
| 8 | SGFI-style category templates, seeded Draft | Operational |
| 9 | Academic year `YYYY-YY` | Operational |
| 10 | Gujarati default; units invariant across languages | Operational |
| 11 | Offline-first with quarantine, minimal cached PII | Operational |
| — | **Document retention expiry** | **Compliance** |

Implementation: `packages/contracts/src/india.ts`,
`services/api/prisma/overlay-models.prisma`,
`services/api/prisma/migrations/20260907000100_integrity_constraints/`.

---

## A note on legal references

The statutory references above (DPDP Act 2023 §9, Aadhaar Act 2016 §29) are the basis
for these design decisions, and the decisions are conservative — they avoid collecting
data rather than relying on a permission. **They are not legal advice.** Before the
event, have the organiser's counsel confirm the consent notice text, the retention
periods (DEC-016) and the public-results policy (DEC-015).
