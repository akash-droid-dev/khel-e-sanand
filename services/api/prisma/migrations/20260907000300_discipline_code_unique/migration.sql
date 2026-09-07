-- A discipline code is an identity, not a label.
--
-- §6: "Sprint distances are separate disciplines", and §15 lists 13 codes for 11 game
-- groups. The code (KAB, SP30, SP50 …) is what the rules registry, score templates and
-- calculators key on, so two rows sharing one code would route scoring ambiguously.
-- The same holds for the sport family above it.
CREATE UNIQUE INDEX "sports_code_key" ON "sports"("code");
CREATE UNIQUE INDEX "disciplines_code_key" ON "disciplines"("code");
CREATE INDEX "disciplines_sport_id_idx" ON "disciplines"("sport_id");
