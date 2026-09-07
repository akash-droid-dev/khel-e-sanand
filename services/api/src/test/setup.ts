/** Points every test file at the dedicated test database. */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://khel:khel_dev_only@localhost:5432/khel_sanand_test?schema=public';
