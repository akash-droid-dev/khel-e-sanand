/**
 * Applies migrations to the dedicated test database once per run.
 * Uses `migrate deploy` rather than `db push` so the tests exercise the same SQL
 * that will be applied in production — including the integrity-constraints
 * migration, which is the thing most of these tests are checking.
 */
import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://khel:khel_dev_only@localhost:5432/khel_sanand_test?schema=public';

export default function setup(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, LC_ALL: 'en_US.UTF-8' },
  });
}
