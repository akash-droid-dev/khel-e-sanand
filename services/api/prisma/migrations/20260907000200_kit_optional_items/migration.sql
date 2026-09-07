-- Optional kit entitlements (§9, AT-023).
--
-- "Optional items do not make a kit partial." The first cut encoded that as
-- required_quantity = 0, which collides with the positive-quantity check and
-- overloads a quantity to mean "not applicable" — the exact conflation §1 rules out
-- ("A missing value is not equivalent to zero, absent, invalid or not applicable").
-- An explicit flag separates "how many" from "must they have it".
ALTER TABLE kit_entitlements
  ADD COLUMN "is_required" BOOLEAN NOT NULL DEFAULT true;

-- Every entitlement still describes a real quantity, required or not.
-- (The original check already guarantees required_quantity > 0.)
COMMENT ON COLUMN kit_entitlements.is_required IS
  'False for optional items, which are reported separately and never downgrade a fulfilled kit to Partial.';
