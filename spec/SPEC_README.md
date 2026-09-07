# Khelo Sanand BalOlympiad — specification package

Prepared 7 September 2026. This is a planning package, not an implemented dashboard.

- Functional_Specification PDF: shareable reading copy.
- Functional_Specification DOCX: editable document with all 12 modules and game logic.
- Functional_Specification Markdown: searchable source.
- Data_and_Functions XLSX: 194 function contracts, 43 screens, 65 entities, 823 data fields, 128 game payload fields, 165 settings, permissions, decisions and tests.
- specification_catalogue.json: structured catalogue for developer handoff.
- import_templates/: blank proposed CSV headers; template scopes are documented in the workbook.
- synthetic_data/: invented demonstration records. No real children, schools, contacts, event dates or results are represented.

The user confirmed Kabaddi, 30/50/60 m sprints, Kho Kho, Softball Throw, Kids Javelin Throw, Cycling, Chess, Standing Broad Jump, Tug of War, Badminton and Volleyball. Football is excluded.

Age groups, local rules, team sizes, durations, equipment, tie procedures and event date remain unconfirmed. All example values are illustrative. Draft demo entries/rules cannot be published until they are approved through the specified workflows.

Demo CSVs use readable business codes that an importer resolves to UUIDs. They include explanatory columns and are not a ready-to-run production database seed. Bootstrap masters are included: event, clusters, category, venue, resources and stages. Load them in dependency order; complete typed draft rule profiles before any publication. The example fixtures remain Draft deliberately.

Validation performed on the package: catalogue reference checks, unique keys, sample relational consistency, required game coverage, workbook reopening and document rendering. Acceptance/game tests describe expected application behaviour; no application tests have run because implementation is outside this request.
