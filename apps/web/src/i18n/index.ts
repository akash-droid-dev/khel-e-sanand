/**
 * Translation keys.
 *
 * §1: "OPTIONAL Gujarati, Hindi and English labels use translation keys. Names retain
 * their original script; timestamps, units and category rules remain consistent
 * across languages."
 *
 * Two rules follow from that second sentence and are enforced here:
 *   - a person's or school's name is NEVER passed through translation. It renders in
 *     the script it was recorded in.
 *   - numbers, times and units are formatted with the event locale for digits, but the
 *     UNIT and the VALUE never change with language. 13.100 m is 13.100 m in Gujarati.
 */
export const LOCALES = ['gu', 'hi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  gu: 'ગુજરાતી', hi: 'हिन्दी', en: 'English',
};

type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'Khelo Sanand BalOlympiad',
  'app.event': 'Event',
  'app.role': 'Role',
  'app.scope': 'Your scope',
  'app.connection.online': 'Online',
  'app.connection.offline': 'Offline — drafts are saved on this device',
  'app.lastRefresh': 'Last refreshed',
  'app.refresh': 'Refresh',
  'app.language': 'Language',
  'app.signOut': 'Sign out',
  'app.loading': 'Loading…',
  'app.empty': 'Nothing to show',
  'app.error': 'Something went wrong',
  'app.retry': 'Try again',
  'app.resetFilters': 'Reset filters',
  'app.search': 'Search',
  'app.savedAt': 'Saved at',
  'app.notSaved': 'Not saved',
  'app.savedLocally': 'Saved on this device',
  'app.savedOnServer': 'Saved on the server',

  'nav.overview': 'Overview',
  'nav.schools': 'Schools & clusters',
  'nav.people': 'People',
  'nav.deployment': 'Deployment',
  'nav.athletes': 'Athletes',
  'nav.rules': 'Sports & rules',
  'nav.schedule': 'Schedule',
  'nav.attendance': 'Attendance',
  'nav.kits': 'Kits',
  'nav.review': 'Review queue',
  'nav.reports': 'Reports',
  'nav.admin': 'Administration',
  'nav.today': 'Today',
  'nav.myMatches': 'My matches',
  'nav.mySchools': 'My schools',
  'nav.myKit': 'My kit',
  'nav.notifications': 'Notifications',
  'nav.profile': 'Profile',

  'role.ED': 'Event Director',
  'role.CH': 'Cluster Head',
  'role.VOL': 'Volunteer',

  'readiness.title': 'Event readiness',
  'readiness.unassignedSchools': 'Schools without a Cluster Head',
  'readiness.unstaffedFixtures': 'Fixtures without a scorer or reviewer',
  'readiness.unapprovedRules': 'Competitions with unapproved rules',
  'readiness.pendingEligibility': 'Entries awaiting eligibility',
  'readiness.missingConsent': 'Athletes without guardian consent',
  'readiness.blockers': 'blockers',
  'readiness.clear': 'No blockers',

  'attendance.checkIn': 'Check in',
  'attendance.checkedIn': 'Checked in',
  'attendance.checkOut': 'Check out',
  'attendance.rate': 'Attendance rate',
  'attendance.notApplicable': 'N/A',
  'attendance.noExpectedDuties': 'No expected duties, so a rate is not defined',
  'attendance.pendingClaims': 'claims awaiting review',
  'attendance.offlineClaim': 'Recorded offline — awaiting review',

  'score.saveDraft': 'Save draft',
  'score.review': 'Review summary',
  'score.submit': 'Submit',
  'score.submitted': 'Submitted for review',
  'score.returned': 'Returned for correction',
  'score.approve': 'Approve',
  'score.return': 'Return with comments',
  'score.lock': 'Lock result',
  'score.rulesPinned': 'Rules pinned to this fixture',
  'score.unresolved': 'Needs an official decision',
  'score.issues': 'Problems to fix before submitting',
  'score.noRank': 'Not ranked',
  'score.attempt': 'Attempt',
  'score.valid': 'Valid',
  'score.foul': 'Foul',
  'score.pass': 'Pass',
  'score.notTaken': 'Not taken',
  'score.best': 'Best',
  'score.confirmTitle': 'Confirm submission',
  'score.confirmBody': 'Check the fixture, participants and final values before submitting.',

  'status.Completed': 'Completed',
  'status.DNS': 'Did not start',
  'status.DNF': 'Did not finish',
  'status.DQ': 'Disqualified',
  'status.NM': 'No valid mark',
  'status.Retired': 'Retired',
  'status.Walkover': 'Walkover',
  'status.Bye': 'Bye',

  'consent.required': 'Guardian consent is required before this athlete can be entered',
  'consent.granted': 'Consent recorded',
  'consent.withdrawn': 'Consent withdrawn',
  'consent.purpose.EventParticipation': 'Taking part in the event',
  'consent.purpose.MedicalEmergency': 'Emergency medical contact',
  'consent.purpose.PhotographyMedia': 'Photographs and video',
  'consent.purpose.PublicResults': 'Name shown on public results',
};

const gu: Dict = {
  'app.title': 'ખેલો સાણંદ બાલઓલિમ્પિયાડ',
  'app.event': 'ઇવેન્ટ',
  'app.role': 'ભૂમિકા',
  'app.scope': 'તમારો વ્યાપ',
  'app.connection.online': 'ઓનલાઇન',
  'app.connection.offline': 'ઓફલાઇન — ડ્રાફ્ટ આ ડિવાઇસ પર સાચવ્યા છે',
  'app.lastRefresh': 'છેલ્લે તાજું કર્યું',
  'app.refresh': 'તાજું કરો',
  'app.language': 'ભાષા',
  'app.signOut': 'સાઇન આઉટ',
  'app.loading': 'લોડ થાય છે…',
  'app.empty': 'બતાવવા માટે કંઈ નથી',
  'app.error': 'કંઈક ખોટું થયું',
  'app.retry': 'ફરી પ્રયાસ કરો',
  'app.resetFilters': 'ફિલ્ટર રીસેટ કરો',
  'app.search': 'શોધો',
  'app.savedAt': 'સાચવ્યું',
  'app.notSaved': 'સાચવ્યું નથી',
  'app.savedLocally': 'આ ડિવાઇસ પર સાચવ્યું',
  'app.savedOnServer': 'સર્વર પર સાચવ્યું',

  'nav.overview': 'ઝાંખી',
  'nav.schools': 'શાળાઓ અને ક્લસ્ટર',
  'nav.people': 'લોકો',
  'nav.deployment': 'ફાળવણી',
  'nav.athletes': 'ખેલાડીઓ',
  'nav.rules': 'રમતો અને નિયમો',
  'nav.schedule': 'સમયપત્રક',
  'nav.attendance': 'હાજરી',
  'nav.kits': 'કિટ',
  'nav.review': 'સમીક્ષા કતાર',
  'nav.reports': 'અહેવાલ',
  'nav.admin': 'વ્યવસ્થાપન',
  'nav.today': 'આજે',
  'nav.myMatches': 'મારી મેચ',
  'nav.mySchools': 'મારી શાળાઓ',
  'nav.myKit': 'મારી કિટ',
  'nav.notifications': 'સૂચનાઓ',
  'nav.profile': 'પ્રોફાઇલ',

  'role.ED': 'ઇવેન્ટ ડિરેક્ટર',
  'role.CH': 'ક્લસ્ટર હેડ',
  'role.VOL': 'સ્વયંસેવક',

  'readiness.title': 'ઇવેન્ટ તૈયારી',
  'readiness.unassignedSchools': 'ક્લસ્ટર હેડ વગરની શાળાઓ',
  'readiness.unstaffedFixtures': 'સ્કોરર કે સમીક્ષક વગરની મેચ',
  'readiness.unapprovedRules': 'મંજૂર ન થયેલા નિયમો ધરાવતી સ્પર્ધાઓ',
  'readiness.pendingEligibility': 'પાત્રતાની રાહ જોતી એન્ટ્રી',
  'readiness.missingConsent': 'વાલી સંમતિ વગરના ખેલાડીઓ',
  'readiness.blockers': 'અવરોધ',
  'readiness.clear': 'કોઈ અવરોધ નથી',

  'attendance.checkIn': 'હાજરી નોંધો',
  'attendance.checkedIn': 'હાજરી નોંધાઈ',
  'attendance.checkOut': 'બહાર નીકળો',
  'attendance.rate': 'હાજરી દર',
  'attendance.notApplicable': 'લાગુ નથી',
  'attendance.noExpectedDuties': 'કોઈ અપેક્ષિત ફરજ નથી, તેથી દર નક્કી થતો નથી',
  'attendance.pendingClaims': 'સમીક્ષાની રાહ જોતા દાવા',
  'attendance.offlineClaim': 'ઓફલાઇન નોંધાયું — સમીક્ષા બાકી',

  'score.saveDraft': 'ડ્રાફ્ટ સાચવો',
  'score.review': 'સમીક્ષા સારાંશ',
  'score.submit': 'સબમિટ કરો',
  'score.submitted': 'સમીક્ષા માટે મોકલ્યું',
  'score.returned': 'સુધારા માટે પરત',
  'score.approve': 'મંજૂર કરો',
  'score.return': 'ટિપ્પણી સાથે પરત કરો',
  'score.lock': 'પરિણામ લોક કરો',
  'score.rulesPinned': 'આ મેચ માટે નિયમો નિશ્ચિત',
  'score.unresolved': 'અધિકારીના નિર્ણયની જરૂર',
  'score.issues': 'સબમિટ કરતા પહેલાં સુધારવાની બાબતો',
  'score.noRank': 'ક્રમાંક નથી',
  'score.attempt': 'પ્રયાસ',
  'score.valid': 'માન્ય',
  'score.foul': 'ફાઉલ',
  'score.pass': 'પાસ',
  'score.notTaken': 'લીધો નથી',
  'score.best': 'શ્રેષ્ઠ',
  'score.confirmTitle': 'સબમિશનની પુષ્ટિ કરો',
  'score.confirmBody': 'સબમિટ કરતા પહેલાં મેચ, સહભાગીઓ અને અંતિમ મૂલ્યો તપાસો.',

  'status.Completed': 'પૂર્ણ',
  'status.DNS': 'શરૂ કર્યું નથી',
  'status.DNF': 'પૂર્ણ કર્યું નથી',
  'status.DQ': 'ગેરલાયક',
  'status.NM': 'કોઈ માન્ય માપ નથી',
  'status.Retired': 'નિવૃત્ત',
  'status.Walkover': 'વોકઓવર',
  'status.Bye': 'બાય',

  'consent.required': 'આ ખેલાડીની નોંધણી પહેલાં વાલીની સંમતિ જરૂરી છે',
  'consent.granted': 'સંમતિ નોંધાઈ',
  'consent.withdrawn': 'સંમતિ પાછી ખેંચી',
  'consent.purpose.EventParticipation': 'ઇવેન્ટમાં ભાગ લેવો',
  'consent.purpose.MedicalEmergency': 'કટોકટી તબીબી સંપર્ક',
  'consent.purpose.PhotographyMedia': 'ફોટા અને વિડિયો',
  'consent.purpose.PublicResults': 'જાહેર પરિણામોમાં નામ',
};

const hi: Dict = {
  'app.title': 'खेलो साणंद बालओलंपियाड',
  'app.event': 'आयोजन',
  'app.role': 'भूमिका',
  'app.scope': 'आपका दायरा',
  'app.connection.online': 'ऑनलाइन',
  'app.connection.offline': 'ऑफ़लाइन — ड्राफ़्ट इसी डिवाइस पर सहेजे गए हैं',
  'app.lastRefresh': 'अंतिम ताज़ा',
  'app.refresh': 'ताज़ा करें',
  'app.language': 'भाषा',
  'app.signOut': 'साइन आउट',
  'app.loading': 'लोड हो रहा है…',
  'app.empty': 'दिखाने के लिए कुछ नहीं',
  'app.error': 'कुछ गड़बड़ हुई',
  'app.retry': 'फिर कोशिश करें',
  'app.resetFilters': 'फ़िल्टर हटाएँ',
  'app.search': 'खोजें',
  'app.savedAt': 'सहेजा गया',
  'app.notSaved': 'सहेजा नहीं गया',
  'app.savedLocally': 'इस डिवाइस पर सहेजा',
  'app.savedOnServer': 'सर्वर पर सहेजा',

  'nav.overview': 'सारांश',
  'nav.schools': 'स्कूल और क्लस्टर',
  'nav.people': 'लोग',
  'nav.deployment': 'तैनाती',
  'nav.athletes': 'खिलाड़ी',
  'nav.rules': 'खेल और नियम',
  'nav.schedule': 'समय-सारणी',
  'nav.attendance': 'उपस्थिति',
  'nav.kits': 'किट',
  'nav.review': 'समीक्षा सूची',
  'nav.reports': 'रिपोर्ट',
  'nav.admin': 'प्रशासन',
  'nav.today': 'आज',
  'nav.myMatches': 'मेरे मैच',
  'nav.mySchools': 'मेरे स्कूल',
  'nav.myKit': 'मेरी किट',
  'nav.notifications': 'सूचनाएँ',
  'nav.profile': 'प्रोफ़ाइल',

  'role.ED': 'इवेंट डायरेक्टर',
  'role.CH': 'क्लस्टर हेड',
  'role.VOL': 'स्वयंसेवक',

  'readiness.title': 'आयोजन तैयारी',
  'readiness.unassignedSchools': 'क्लस्टर हेड रहित स्कूल',
  'readiness.unstaffedFixtures': 'स्कोरर या समीक्षक रहित मैच',
  'readiness.unapprovedRules': 'अस्वीकृत नियमों वाली प्रतियोगिताएँ',
  'readiness.pendingEligibility': 'पात्रता प्रतीक्षित प्रविष्टियाँ',
  'readiness.missingConsent': 'अभिभावक सहमति रहित खिलाड़ी',
  'readiness.blockers': 'अवरोध',
  'readiness.clear': 'कोई अवरोध नहीं',

  'attendance.checkIn': 'उपस्थिति दर्ज करें',
  'attendance.checkedIn': 'उपस्थिति दर्ज',
  'attendance.checkOut': 'बाहर निकलें',
  'attendance.rate': 'उपस्थिति दर',
  'attendance.notApplicable': 'लागू नहीं',
  'attendance.noExpectedDuties': 'कोई अपेक्षित ड्यूटी नहीं, इसलिए दर परिभाषित नहीं',
  'attendance.pendingClaims': 'समीक्षा प्रतीक्षित दावे',
  'attendance.offlineClaim': 'ऑफ़लाइन दर्ज — समीक्षा शेष',

  'score.saveDraft': 'ड्राफ़्ट सहेजें',
  'score.review': 'समीक्षा सारांश',
  'score.submit': 'जमा करें',
  'score.submitted': 'समीक्षा हेतु भेजा',
  'score.returned': 'सुधार हेतु लौटाया',
  'score.approve': 'स्वीकृत करें',
  'score.return': 'टिप्पणी सहित लौटाएँ',
  'score.lock': 'परिणाम लॉक करें',
  'score.rulesPinned': 'इस मैच के नियम नियत',
  'score.unresolved': 'अधिकारी के निर्णय की आवश्यकता',
  'score.issues': 'जमा करने से पहले ठीक करने योग्य',
  'score.noRank': 'कोई क्रम नहीं',
  'score.attempt': 'प्रयास',
  'score.valid': 'मान्य',
  'score.foul': 'फ़ाउल',
  'score.pass': 'पास',
  'score.notTaken': 'नहीं लिया',
  'score.best': 'सर्वश्रेष्ठ',
  'score.confirmTitle': 'जमा करने की पुष्टि',
  'score.confirmBody': 'जमा करने से पहले मैच, प्रतिभागी और अंतिम मान जाँचें।',

  'status.Completed': 'पूर्ण',
  'status.DNS': 'शुरू नहीं किया',
  'status.DNF': 'पूरा नहीं किया',
  'status.DQ': 'अयोग्य',
  'status.NM': 'कोई मान्य माप नहीं',
  'status.Retired': 'सेवानिवृत्त',
  'status.Walkover': 'वॉकओवर',
  'status.Bye': 'बाय',

  'consent.required': 'इस खिलाड़ी की प्रविष्टि से पहले अभिभावक की सहमति आवश्यक है',
  'consent.granted': 'सहमति दर्ज',
  'consent.withdrawn': 'सहमति वापस ली',
  'consent.purpose.EventParticipation': 'आयोजन में भाग लेना',
  'consent.purpose.MedicalEmergency': 'आपातकालीन चिकित्सा संपर्क',
  'consent.purpose.PhotographyMedia': 'फ़ोटो और वीडियो',
  'consent.purpose.PublicResults': 'सार्वजनिक परिणामों में नाम',
};

const DICTS: Record<Locale, Dict> = { gu, hi, en };

/**
 * Look up a key. Falls back to English, then to the key itself — a missing
 * translation shows an English label, never a blank control.
 */
export function translate(locale: Locale, key: string): string {
  return DICTS[locale][key] ?? en[key] ?? key;
}

/**
 * Format an instant in the event timezone.
 * §1: "Use the event timezone (proposed Asia/Kolkata) in every schedule and
 * attendance view." Never the device's timezone — a volunteer whose phone is set
 * wrongly must still see the official schedule.
 */
export function formatTime(
  value: Date | string, locale: Locale, timezone = 'Asia/Kolkata',
): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function formatDate(
  value: Date | string, locale: Locale, timezone = 'Asia/Kolkata',
): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric',
  }).format(d);
}

/**
 * Format a measurement.
 *
 * The NUMBER may be localised; the UNIT and the VALUE never change with language.
 * §1: "timestamps, units and category rules remain consistent across languages."
 * A distance of 13.100 m reads the same in every locale.
 */
export function formatMeasurement(value: string, unit: string, locale: Locale): string {
  const n = Number(value);
  if (Number.isNaN(n)) return `${value} ${unit}`;
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 0) : 0;
  const formatted = new Intl.NumberFormat(`${locale}-IN`, {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(n);
  return `${formatted} ${unit}`;
}
