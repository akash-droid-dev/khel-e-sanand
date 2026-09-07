import type { PrismaClient } from '@prisma/client';

/**
 * Empty every application table.
 *
 * Deliberately excludes `_prisma_migrations` so the schema stays applied, and
 * disables the append-only audit trigger for the duration — §13 forbids business
 * admins deleting audit history, which is exactly the rule under test elsewhere in
 * this suite, so the test harness lifts it explicitly rather than the schema being
 * lax about it.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe('ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await prisma.$executeRawUnsafe('ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only');
}
