"""Generate the Prisma schema from specification_catalogue.json.

Fidelity matters more than elegance here: the catalogue is the contract, so the
schema is generated from it rather than retyped. India-specific additions and
composite constraints are layered on afterwards from an explicit overlay.
"""
import json, re, sys, collections

import os
CAT = sys.argv[1]
OUT = sys.argv[2]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(CAT))

# Explicit additions layered on the generated transcription. See prisma/overlay.json.
overlay_path = os.path.join(HERE, 'prisma', 'overlay.json')
overlay = json.load(open(overlay_path)) if os.path.exists(overlay_path) else {}
overlay_models_path = os.path.join(HERE, 'prisma', 'overlay-models.prisma')
overlay_models = open(overlay_models_path).read() if os.path.exists(overlay_models_path) else ''

EXTRA_FIELDS = overlay.get('extra_fields', {})
EXTRA_INDEXES = overlay.get('extra_indexes', {})
OVERRIDES = {k: v for k, v in overlay.get('field_overrides', {}).items() if not k.startswith('_')}
EXTRA_BACK = {k: v for k, v in overlay.get('extra_back_relations', {}).items() if not k.startswith('_')}

entities = {e['entity']: e for e in cat['entities']}
fields = collections.OrderedDict()
for f in cat['fields']:
    fields.setdefault(f['entity'], []).append(f)

# ---------------------------------------------------------------- enums
# Enum value sets live in the `definition` column as slash-separated tokens.
enum_sets = {}          # frozenset(values) -> name
enum_order = {}         # name -> ordered values
field_enum = {}         # (entity, field) -> enum name

CURATED = {
    ('Setup','Registration','Ready','Live','Closed','Archived'): 'EventStatus',
    ('Invited','Active','Inactive','Withdrawn'): 'ParticipationStatus',
    ('Invited','Active','Inactive'): 'MembershipStatus',
    ('ED','CH','VOL'): 'Role',
    ('Draft','Active','Withdrawn','Inactive'): 'RegistrationStatus',
    ('Draft','Active','Withdrawn'): 'EntryStatus',
    ('Pending','Eligible','Ineligible','Exception'): 'EligibilityStatus',
    ('Pass','Fail','Pending','Override'): 'EligibilityOutcome',
    ('Draft','Locked'): 'RosterStatus',
    ('Pending','Verified','Rejected'): 'VerificationStatus',
    ('Create','Update','Upsert'): 'ImportMode',
    ('Created','Updated','Skipped','Failed','Pending'): 'ImportRowOutcome',
    ('Raid','Turn','Time','Attempts','Chess','Pulls','Games','Sets'): 'CalculationFamily',
    ('Individual','Team','Selectable'): 'ParticipantMode',
    ('Draft','Approved'): 'ApprovalStatus',
    ('Draft','Approved','Retired'): 'RuleApprovalStatus',
    ('Knockout','RoundRobin','GroupsKnockout','HeatsFinal','DirectFinal','Swiss'): 'CompetitionFormat',
    ('Draft','Published','Live','Closed'): 'CompetitionStatus',
    ('Group','Heat','Final','KnockoutRound','ChessRound'): 'StageType',
    ('Draft','Published','Completed'): 'StageStatus',
    ('Draft','Ready','InProgress','Paused','Completed','Abandoned','Cancelled'): 'FixtureLifecycle',
    ('Unpublished','Published'): 'Publication',
    ('Expected','Confirmed','Withdrawn'): 'FixtureParticipantStatus',
    ('Pending','Resolved','Invalidated'): 'DependencyStatus',
    ('Daily','Shift'): 'DutySessionMode',
    ('Open','Closed'): 'DutySessionStatus',
    ('Expected','Excused','Cancelled'): 'Expectation',
    ('Missing','Present','Late','Absent','Excused','PendingReview'): 'AttendanceStatus',
    ('Self','CH','ED','OfflineClaim'): 'AttendanceSource',
    ('Receipt','Issue','Transfer','Return','Adjustment'): 'MovementType',
    ('Draft','Submitted','Returned','Approved','Locked','Superseded'): 'RevisionStatus',
    ('Submit','Return','Approve','Lock','Override'): 'ReviewActionType',
    ('Completed','DNS','DNF','DQ','NM','Retired','Walkover','Bye'): 'ResultStatus',
    ('Requested','Review','Approved','Rejected','Applied'): 'AmendmentStatus',
    ('InApp','Email','SMS','WhatsApp'): 'Channel',
    ('Pending','Delivered','Failed'): 'DeliveryStatus',
    ('Success','RetryableFailure','PermanentFailure'): 'AttemptOutcome',
    ('Queued','Running','Completed','Failed','Expired'): 'ReportStatus',
    ('Open','InReview','Resolved','Rejected'): 'ExceptionStatus',
    ('Low','Normal','Urgent'): 'ExceptionPriority',
    ('Draft','Approved','Active','Retired'): 'ConfigStatus',
    ('Running','Passed','Failed'): 'RecoveryOutcome',
    ('Queued','Running','Completed','Partial','Failed','Cancelled'): 'JobStatus',
    ('Publish','Withdraw'): 'PublicationAction',
    ('Internal','Public'): 'PublicationAudience',
    ('Court','Track','ThrowArea','JumpArea','CyclingCourse','ChessArea','TugArea'): 'ResourceType',
    ('Available','Blocked'): 'AvailabilityKind',
    ('Active','Withdrawn'): 'SportParticipationStatus',
    ('School','Pool','Fixture','Cluster'): 'ScopeType',
    ('PrimaryScorer','Support','Reviewer'): 'DutyRole',
    ('Assigned','Replaced','Cancelled'): 'AssignmentStatus',
    ('Athlete','Entry','Scorecard','Import'): 'DocumentOwnerType',
    ('Queued','Validating','Preview','Running','Completed','Partial','Failed','Cancelled'): 'ImportStatus',
}

def pascal(s):
    return ''.join(p.capitalize() for p in re.split(r'[_\s]+', s))

for ent, fs in fields.items():
    for f in fs:
        if f['type'] != 'enum':
            continue
        raw = (f.get('definition') or '').strip()
        vals = tuple(v.strip() for v in raw.split('/') if v.strip() and ' ' not in v.strip())
        if not vals:
            continue
        key = vals
        if key in CURATED:
            name = CURATED[key]
        elif key in enum_sets:
            name = enum_sets[key]
        else:
            name = f"{pascal(ent)}{pascal(f['field'])}"
        enum_sets[key] = name
        enum_order[name] = vals
        field_enum[(ent, f['field'])] = name

# ---------------------------------------------------------------- types
SCALAR = {
    'uuid':      'String   @db.Uuid',
    'timestamp': 'DateTime @db.Timestamptz(3)',
    'integer':   'Int',
    'text':      'String',
    'date':      'DateTime @db.Date',
    'boolean':   'Boolean',
    'json':      'Json',
    'decimal':   'Decimal  @db.Decimal(18, 6)',
}

AUDIT_USER_FIELDS = {'created_by', 'updated_by'}

def is_required(f):
    return str(f.get('required', '')).strip().lower() in ('yes', 'true', 'required')

def snake_plural(name):
    s = re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
    if s.endswith('s'): return s + 'es'
    if s.endswith('y') and s[-2] not in 'aeiou': return s[:-1] + 'ies'
    return s + 's'

# Detect models needing named relations (2+ FKs to the same target).
fk_targets = {}
for ent, fs in fields.items():
    counts = collections.Counter(f['foreign_target'] for f in fs
                                 if f.get('foreign_target') and f['field'] not in AUDIT_USER_FIELDS)
    fk_targets[ent] = counts

back_relations = collections.defaultdict(list)   # target model -> [(field decl)]

lines = []
model_bodies = {}

for ent, fs in fields.items():
    body = []
    for f in fs:
        name = f['field']
        ftype = f['type']
        req = is_required(f)
        target = f.get('foreign_target') or None

        if name == 'id':
            body.append(('id', 'String   @id @default(uuid()) @db.Uuid', f))
            continue
        if name == 'created_at':
            body.append((name, 'DateTime @default(now()) @db.Timestamptz(3)', f)); continue
        if name == 'updated_at':
            body.append((name, 'DateTime @updatedAt @db.Timestamptz(3)', f)); continue
        if name == 'row_version':
            body.append((name, 'Int      @default(1)', f)); continue

        if ftype == 'enum' and (ent, name) in field_enum:
            decl = field_enum[(ent, name)]
            decl += '' if req else '?'
            body.append((name, decl, f)); continue

        base = SCALAR.get(ftype, 'String')
        parts = base.split(None, 1)
        typ = parts[0]
        attrs = parts[1] if len(parts) > 1 else ''
        decl = f"{typ}{'' if req else '?'}{(' ' + attrs) if attrs else ''}"
        body.append((name, decl, f))

        # Domain relation (audit user columns are deliberately not Prisma relations)
        if target and name not in AUDIT_USER_FIELDS and target in fields:
            rel_field = name[:-3] if name.endswith('_id') else f'{name}_ref'
            multi = fk_targets[ent][target] > 1
            # Prisma requires an explicit relation name for a self-relation, and for
            # any model holding two or more foreign keys to the same target.
            self_ref = (target == ent)
            rel_name = f'{ent}_{name}' if (multi or self_ref) else None
            q = chr(34)
            named = ('name: ' + q + rel_name + q + ', ') if rel_name else ''
            rel_attr = ('@relation(' + named +
                        'fields: [' + name + '], references: [id], '
                        'onDelete: Restrict, onUpdate: Cascade)')
            body.append((rel_field, f"{target}{'' if req else '?'} {rel_attr}", None))
            back = (f'{snake_plural(ent)}_{name}' if (multi or self_ref)
                    else snake_plural(ent))
            q2 = chr(34)
            suffix = (' @relation(' + q2 + rel_name + q2 + ')') if rel_name else ''
            back_relations[target].append(f'  {back:<44} {ent}[]' + suffix)
    model_bodies[ent] = body

# ---------------------------------------------------------------- emit
out = []
out.append('''// ============================================================================
//  Khelo Sanand BalOlympiad — database schema
//
//  GENERATED from Khelo_Sanand_Specification/specification_catalogue.json
//  (65 entities, 823 field contracts) by scripts/generate-schema.py, then
//  extended with the India-specific model in prisma/overlay.prisma.
//
//  Regenerate:  npm run db:generate-schema
//  Hand edits to the generated section will be overwritten. Put additions in
//  overlay.prisma instead.
//
//  Conventions
//  -----------
//  * Field names stay snake_case, matching the specification's data dictionary
//    verbatim so a reviewer can diff the two.
//  * `created_by` / `updated_by` are Uuid columns WITHOUT Prisma relations.
//    Modelling them would put 130 back-relations on User and make the client
//    unusable; the foreign keys are added at SQL level in the migration.
//  * Timestamps are timestamptz — §1 requires timezone-aware instants with
//    event_local_date derived, never a naive local time.
//  * Money-free by design: procurement and purchasing are out of scope (§9).
// ============================================================================

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["relationJoins"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
''')

out.append('// ---------------------------------------------------------------- enums\n')
for name in sorted(set(enum_order)):
    vals = enum_order[name]
    out.append(f'enum {name} {{')
    for v in vals:
        out.append(f'  {v}')
    out.append('}\n')

out.append('// ---------------------------------------------------------------- models\n')
for ent in fields:
    e = entities.get(ent, {})
    purpose = (e.get('purpose') or '').strip()
    scope = (e.get('scope') or '').strip()
    module = (e.get('module') or '').strip()
    out.append(f'/// {module} — {purpose}' if purpose else f'/// {module}')
    if scope:
        out.append(f'/// Scope: {scope}')
    out.append(f'model {ent} {{')
    for name, decl, f in model_bodies[ent]:
        ov = OVERRIDES.get(ent + '.' + name)
        if ov:
            out.append('  ' + ov['line'])
            continue
        comment = ''
        if f is not None:
            d = (f.get('definition') or '').strip()
            dc = (f.get('data_class') or '').strip()
            bits = []
            if d and f['type'] != 'enum': bits.append(d)
            if dc and dc != 'Operational': bits.append(f'[{dc}]')
            if bits: comment = '  /// ' + ' '.join(bits)
        out.append(f'  {name:<34} {decl}{comment}')
    extras = EXTRA_FIELDS.get(ent, [])
    if extras:
        out.append('')
        out.append('  // --- India-specific additions (docs/INDIA_DATA_MODEL.md) ---')
        for x in extras:
            out.append('  /// ' + x['why'])
            out.append('  ' + x['line'])
    for extra_br in EXTRA_BACK.get(ent, []):
        back_relations[ent].append('  ' + extra_br)
    for br in sorted(set(back_relations.get(ent, []))):
        out.append(br)
    idx = EXTRA_INDEXES.get(ent, [])
    if idx:
        out.append('')
        for i in idx:
            out.append('  ' + i)
    out.append(f'  @@map("{snake_plural(ent)}")')
    out.append('}\n')

if overlay_models:
    out.append(overlay_models)

open(OUT, 'w').write('\n'.join(out))
print(f'models={len(fields)} enums={len(set(enum_order))} '
      f'fields={sum(len(v) for v in fields.values())}')
