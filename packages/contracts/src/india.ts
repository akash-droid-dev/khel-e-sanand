/**
 * India-specific vocabularies and validators.
 *
 * The specification is deliberately jurisdiction-neutral: it says "district", "city",
 * "contact", "DOB" and leaves identity policy as a DECISION. Deployed in Gujarat for a
 * school BalOlympiad, several of those neutral choices would produce unusable or
 * non-compliant data. Everything in this file exists to close that gap.
 *
 * Each block records WHY, because these are not arbitrary preferences — they are
 * constraints imposed by how Indian school sport and Indian data law actually work.
 * See docs/INDIA_DATA_MODEL.md for the long form.
 */

/* ================================================================== *
 * 1. Administrative geography
 *
 * WHY: the spec's School entity has address / district / city only. India's
 * operational hierarchy for a district-level school event is
 *   State → District → Taluka (a.k.a. Tehsil/Block) → City or Village → PIN.
 * Sanand is a *taluka* of Ahmedabad district, Gujarat. Without the taluka level a
 * "Sanand" event cannot express its own catchment, and clusters end up encoded in
 * free text. PIN code is the only stable machine-checkable locality key.
 * ================================================================== */

/** ISO 3166-2:IN subdivision codes. Stored, not displayed — labels are translated. */
export const IN_STATE_CODE = [
  'AN','AP','AR','AS','BR','CH','CT','DH','DL','GA','GJ','HR','HP','JK','JH','KA','KL',
  'LA','LD','MP','MH','MN','ML','MZ','NL','OR','PY','PB','RJ','SK','TN','TG','TR','UP',
  'UT','WB',
] as const;
export type InStateCode = (typeof IN_STATE_CODE)[number];

export const IN_STATE_LABEL: Partial<Record<InStateCode, string>> = {
  GJ: 'Gujarat', MH: 'Maharashtra', RJ: 'Rajasthan', MP: 'Madhya Pradesh',
  DL: 'Delhi', KA: 'Karnataka', TN: 'Tamil Nadu', UP: 'Uttar Pradesh',
};

/** Indian PIN code: exactly 6 digits, first digit 1–8 (9 is Army Post Office). */
export const PINCODE_RE = /^[1-8]\d{5}$/;
export const isValidPincode = (v: string): boolean => PINCODE_RE.test(v.trim());

/* ================================================================== *
 * 2. School identity
 *
 * WHY: `school_code` in the spec is an event-local business code. Indian schools
 * already carry a national key — the UDISE+ code issued under the Ministry of
 * Education's Unified District Information System for Education. Recording it makes
 * the school master reconcilable against government data and survives renames, which
 * the spec explicitly worries about ("A renamed school keeps historical display
 * snapshots"). It is OPTIONAL because some private/unaided schools may not supply it
 * at registration time, and blocking registration on it would be worse than missing it.
 * ================================================================== */

/** UDISE / UDISE+ code: 11 digits. State(2) District(2) Block(2) Village(3) School(2). */
export const UDISE_RE = /^\d{11}$/;
export const isValidUdise = (v: string): boolean => UDISE_RE.test(v.trim());

/** Examination board the school is affiliated to. Affects standard/class naming. */
export const SCHOOL_BOARD = ['GSEB', 'CBSE', 'ICSE', 'NIOS', 'IB', 'IGCSE', 'Other'] as const;
export type SchoolBoard = (typeof SCHOOL_BOARD)[number];

/**
 * Management type. Matters operationally: government and municipal schools route
 * approvals through the education department, private unaided schools do not.
 * Mirrors the UDISE+ management categories.
 */
export const SCHOOL_MANAGEMENT = [
  'Government',
  'LocalBody',        // Municipal Corporation / Nagar Palika / Gram Panchayat
  'GovernmentAided',  // grant-in-aid
  'PrivateUnaided',
  'CentralGovernment',
  'Other',
] as const;
export type SchoolManagement = (typeof SCHOOL_MANAGEMENT)[number];

/**
 * Medium of instruction. Drives the default UI language for that school's staff and
 * the language of printed start lists — not cosmetic in Gujarat.
 */
export const MEDIUM_OF_INSTRUCTION = ['Gujarati', 'Hindi', 'English', 'Marathi', 'Other'] as const;
export type MediumOfInstruction = (typeof MEDIUM_OF_INSTRUCTION)[number];

/* ================================================================== *
 * 3. Standard / class
 *
 * WHY: the spec correctly insists class and age stay separate. In India the unit is
 * the "Standard" (1–12), not a US-style grade, and pre-primary is common in the age
 * band a BalOlympiad targets. Storing it as a closed vocabulary rather than free text
 * lets eligibility rules reference it without string matching.
 * ================================================================== */
export const STANDARD = [
  'Balvatika', 'Std1', 'Std2', 'Std3', 'Std4', 'Std5', 'Std6',
  'Std7', 'Std8', 'Std9', 'Std10', 'Std11', 'Std12',
] as const;
export type Standard = (typeof STANDARD)[number];

export const STANDARD_LABEL: Record<Standard, string> = {
  Balvatika: 'Balvatika (pre-primary)',
  Std1: 'Standard 1', Std2: 'Standard 2', Std3: 'Standard 3', Std4: 'Standard 4',
  Std5: 'Standard 5', Std6: 'Standard 6', Std7: 'Standard 7', Std8: 'Standard 8',
  Std9: 'Standard 9', Std10: 'Standard 10', Std11: 'Standard 11', Std12: 'Standard 12',
};

/* ================================================================== *
 * 4. Contact details
 *
 * WHY: the spec warns that "Mobile is not assumed to be a universally unique
 * identifier for children" — correct, and in India acutely so: siblings routinely
 * share one guardian handset, and one number may cover a whole extended family.
 * Uniqueness is therefore enforced only on STAFF login identity, never on athletes.
 * ================================================================== */

/** Indian mobile: 10 digits beginning 6–9, optionally +91 / 0 prefixed. */
export const IN_MOBILE_RE = /^(?:\+?91[-\s]?|0)?([6-9]\d{9})$/;

/** Returns E.164 (+91XXXXXXXXXX) or null. Normalise before comparing, never before storing raw. */
export function normaliseIndianMobile(raw: string): string | null {
  const m = IN_MOBILE_RE.exec(raw.replace(/[\s-]/g, ''));
  return m && m[1] ? `+91${m[1]}` : null;
}

/* ================================================================== *
 * 5. Personal names
 *
 * WHY: a first/last split is wrong here. Indian names commonly follow
 * <given name> <father's given name> <family name> (Gujarati convention), and a
 * meaningful minority are single-token. Forcing a surname produces junk data and
 * breaks matching against school registers. The authoritative field is the full name
 * exactly as the school register writes it; components are optional and derived.
 *
 * `name_local` holds the Gujarati/Devanagari original. §1 requires that
 * "Names retain their original script" across UI languages.
 * ================================================================== */
export interface PersonName {
  /** Authoritative, as written on the school register. Never split for storage. */
  full_name: string;
  /** Original script (Gujarati/Devanagari) where supplied. Displayed verbatim. */
  full_name_local?: string | null;
  /** Optional components — for sorting/report headers only; never required. */
  given_name?: string | null;
  family_name?: string | null;
}

/* ================================================================== *
 * 6. Identity documents  ⚠️ compliance-critical
 *
 * WHY: the spec has a generic Document entity with a `document_type`. Left generic,
 * an Indian deployment will inevitably be asked to collect Aadhaar numbers for age
 * proof — and storing them here would be both unnecessary and legally hazardous.
 *
 * Design decision (GAP-IN-06): this platform NEVER stores an Aadhaar number.
 *   - The Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and
 *     Services) Act 2016 §29 restricts sharing of identity information, and UIDAI has
 *     repeatedly directed non-authorised entities not to retain Aadhaar numbers.
 *   - Aadhaar is not required for a school sports entry; a birth certificate or the
 *     school register is the ordinary age proof.
 * What IS stored: that a document of a given type was sighted, by whom, when, plus
 * the last four digits where an auditor needs to reconcile a specific record. The
 * full number, scans of it, and any biometric data are out of scope by construction.
 * ================================================================== */
export const DOCUMENT_TYPE = [
  'BirthCertificate',    // ordinary, preferred age proof
  'SchoolBonafide',      // school-issued certificate of enrolment
  'TransferCertificate', // "TC" — carries DOB as recorded on the school register
  'SchoolIdCard',
  'AadhaarSighted',      // ⚠️ sighting record only — number is NOT stored
  'MedicalFitness',
  'GuardianConsent',     // DPDP Act 2023 §9 verifiable consent artefact
  'Photograph',
  'Other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[number];

/** Document types accepted as proof of date of birth. Ordered by evidential strength. */
export const DOB_PROOF_TYPES: readonly DocumentType[] = [
  'BirthCertificate', 'TransferCertificate', 'SchoolBonafide',
];

/**
 * Types that must never have their file contents retained after verification,
 * and never appear in exports, notification payloads or general logs.
 */
export const NO_RETENTION_DOCUMENT_TYPES: readonly DocumentType[] = ['AadhaarSighted'];

/** Guard used by the document service. Refuses any field that looks like a raw Aadhaar. */
export const AADHAAR_LIKE_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const containsAadhaarLikeNumber = (v: string): boolean => AADHAAR_LIKE_RE.test(v);

/* ================================================================== *
 * 7. Guardian consent — DPDP Act 2023 §9
 *
 * WHY: every athlete in a BalOlympiad is a child. India's Digital Personal Data
 * Protection Act 2023 §9 requires a data fiduciary to obtain verifiable consent from
 * a parent or lawful guardian before processing a child's personal data, and prohibits
 * tracking or behavioural monitoring of children. The specification has no consent
 * entity at all — the largest single gap for an Indian deployment.
 *
 * Consequences wired into this platform:
 *   - registerSportEntry and any Restricted-field read require an active consent.
 *   - Consent is purpose-scoped and versioned; withdrawal is recorded, not deleted.
 *   - PUBLIC result publication requires its own separate consent purpose.
 *   - No behavioural analytics on athlete records. Attendance is staff-only.
 * ================================================================== */
export const CONSENT_PURPOSE = [
  'EventParticipation',  // register, schedule, score, produce internal results
  'MedicalEmergency',    // hold emergency contact + fitness declaration
  'PhotographyMedia',    // photographs/video at the venue
  'PublicResults',       // name appearing on a publicly visible result or leaderboard
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSE)[number];

/** Purposes without which an athlete cannot be entered at all. */
export const MANDATORY_CONSENT_PURPOSES: readonly ConsentPurpose[] = ['EventParticipation'];

export const CONSENT_STATUS = ['Granted', 'Withdrawn', 'Expired'] as const;
export type ConsentStatus = (typeof CONSENT_STATUS)[number];

/**
 * How the guardian's consent was verified. "Verifiable" is the operative word in §9;
 * a tick-box on a form filled in by a volunteer is not verification.
 */
export const CONSENT_METHOD = [
  'SignedPaperForm',    // wet signature, scanned and held as GuardianConsent document
  'SchoolAttested',     // head teacher attests guardian consent on school letterhead
  'DigitalOtpVerified', // OTP to the guardian's own verified mobile
] as const;
export type ConsentMethod = (typeof CONSENT_METHOD)[number];

export const GUARDIAN_RELATION = ['Father', 'Mother', 'LegalGuardian', 'Other'] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATION)[number];

/** Age of majority in India. Below this, §9 consent rules apply. */
export const CHILD_AGE_THRESHOLD_YEARS = 18;

/* ================================================================== *
 * 8. Age categories
 *
 * WHY: the spec leaves age groups as a DECISION and is right to — but shipping with
 * no template forces every organiser to invent one, and inconsistent cutoffs are the
 * commonest source of eligibility disputes in Indian school sport.
 *
 * These are TEMPLATES, seeded as Draft and requiring ED approval before use. They
 * follow the School Games Federation of India convention of under-N bands assessed
 * "as on 31 December" of the competition year. Neither the bands nor the cutoff are
 * asserted as this event's approved policy — DEC-002 in docs/DECISIONS.md remains open.
 * ================================================================== */
export interface AgeCategoryTemplate {
  code: string;
  label: string;
  /** Athlete must be strictly under this age at the cutoff instant. */
  under_age_years: number;
  /** Month/day of the cutoff. Combined with the edition year at approval time. */
  cutoff_month: number;
  cutoff_day: number;
  note: string;
}

export const SGFI_STYLE_CATEGORY_TEMPLATES: readonly AgeCategoryTemplate[] = [
  { code: 'U09', label: 'Under 9',  under_age_years: 9,  cutoff_month: 12, cutoff_day: 31,
    note: 'BalOlympiad-scale band. Not an SGFI band; included for primary-school events.' },
  { code: 'U11', label: 'Under 11', under_age_years: 11, cutoff_month: 12, cutoff_day: 31,
    note: 'Common state-level primary band.' },
  { code: 'U14', label: 'Under 14', under_age_years: 14, cutoff_month: 12, cutoff_day: 31,
    note: 'SGFI-convention band.' },
  { code: 'U17', label: 'Under 17', under_age_years: 17, cutoff_month: 12, cutoff_day: 31,
    note: 'SGFI-convention band.' },
  { code: 'U19', label: 'Under 19', under_age_years: 19, cutoff_month: 12, cutoff_day: 31,
    note: 'SGFI-convention band.' },
];

/**
 * Participation category. Kept separate from the age band so a competition is
 * (age band × participation category), which is how entries are actually organised.
 * §5 forbids inferring any of this from names or photographs — it is declared.
 */
export const PARTICIPATION_CATEGORY = ['Boys', 'Girls', 'Mixed', 'Open'] as const;
export type ParticipationCategory = (typeof PARTICIPATION_CATEGORY)[number];

/* ================================================================== *
 * 9. Academic year and locale
 *
 * WHY: an Indian school edition label is "2026-27", not "2026" — the academic year
 * runs roughly June to April. The spec's `edition_year_label` is free text; this
 * validator keeps it consistent so editions sort correctly.
 * ================================================================== */
export const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{2})$/;

export function isValidAcademicYear(v: string): boolean {
  const m = ACADEMIC_YEAR_RE.exec(v);
  if (!m || !m[1] || !m[2]) return false;
  const start = Number(m[1]);
  const endShort = Number(m[2]);
  return ((start + 1) % 100) === endShort;
}

/** UI languages. §1 lists Gujarati, Hindi and English as OPTIONAL; for Sanand they are not. */
export const LOCALE = ['gu', 'hi', 'en'] as const;
export type Locale = (typeof LOCALE)[number];
export const DEFAULT_LOCALE: Locale = 'gu';

export const LOCALE_LABEL: Record<Locale, string> = {
  gu: 'ગુજરાતી',
  hi: 'हिन्दी',
  en: 'English',
};

/** IST. No daylight saving — a simplification that holds for every Indian event. */
export const EVENT_TIMEZONE_DEFAULT = 'Asia/Kolkata';
export const IST_UTC_OFFSET_MINUTES = 330;
