import { loadEnvConfig } from '@next/env';
import { findMissingLedgerCategoryPresets } from '../src/lib/ledger-category-presets';

let prismaClient: Awaited<typeof import('../src/lib/prisma')>['prisma'] | undefined;

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import('../src/lib/prisma');
  prismaClient = prisma;
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  let created = 0;

  for (const user of users) {
    const existing = await prisma.category.findMany({
      where: { userId: user.id },
      select: { name: true, type: true },
    });
    const missing = findMissingLedgerCategoryPresets(existing);
    if (missing.length === 0) continue;

    const result = await prisma.category.createMany({
      data: missing.map((category) => ({ ...category, userId: user.id })),
    });
    created += result.count;
    console.log(`${user.username || user.id}: added ${result.count} ledger categories`);
  }

  console.log(`Ledger category backfill complete: ${created} categories added.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prismaClient?.$disconnect());
