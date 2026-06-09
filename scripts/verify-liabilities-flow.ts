/**
 * Integration test: verify full server-action flow
 * Tests that getLiabilities correctly reads and decrypts existing data
 *
 * Run: npx tsx scripts/verify-liabilities-flow.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateDerivedKey, encryptValue, decryptValue } from '../src/lib/crypto';
import Decimal from 'decimal.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ledger?schema=public';

// Simulate the exact logic from getLiabilities server action
async function getLiabilities(prisma: PrismaClient, userId: string, derivedKey: string) {
  const liabilities = await prisma.liability.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const decrypted = liabilities.map((l) => ({
    ...l,
    principal: decryptValue(l.principal, derivedKey, userId),
    currentBalance: decryptValue(l.currentBalance, derivedKey, userId),
    monthlyPayment: l.monthlyPayment ? decryptValue(l.monthlyPayment, derivedKey, userId) : null,
  }));

  return { success: true, data: decrypted };
}

// Simulate the exact logic from createLiability server action
async function createLiability(
  prisma: PrismaClient,
  userId: string,
  derivedKey: string,
  data: {
    name: string;
    category: string;
    principal: string;
    currentBalance?: string;
    interestRate: string;
    termMonths: number;
    startDate: string;
    paymentMethod: string;
  }
) {
  const principalStr = new Decimal(data.principal).toFixed(4);
  const balanceStr = new Decimal(data.currentBalance || data.principal).toFixed(4);
  const encryptedPrincipal = encryptValue(principalStr, derivedKey, userId);
  const encryptedBalance = encryptValue(balanceStr, derivedKey, userId);

  const liability = await prisma.liability.create({
    data: {
      name: data.name,
      category: data.category,
      principal: encryptedPrincipal,
      currentBalance: encryptedBalance,
      isEncrypted: true,
      interestRate: new Decimal(data.interestRate),
      termMonths: data.termMonths,
      startDate: new Date(data.startDate),
      paymentMethod: data.paymentMethod,
      userId,
    },
  });

  return { success: true, data: liability };
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('=== Integration Test: Full liability CRUD flow ===\n');

  // Get demo user
  const user = await prisma.user.findFirst({ where: { username: 'demo' } });
  if (!user) { console.log('FAIL: no demo user'); process.exit(1); }
  console.log('[1] Demo user:', user.username, '(id:', user.id.slice(0, 8) + '...)');

  // Generate derived key (simulates login)
  const derivedKey = generateDerivedKey('demo123', user.id);
  console.log('[2] Derived key generated');

  // Read existing liabilities
  console.log('\n--- Existing liabilities ---');
  const existing = await getLiabilities(prisma, user.id, derivedKey);
  if (!existing.success) { console.log('FAIL: getLiabilities failed'); process.exit(1); }
  for (const l of existing.data) {
    console.log(`  ${l.name}: principal=¥${l.principal}, balance=¥${l.currentBalance}, rate=${l.interestRate}`);
  }
  console.log(`  Total: ${existing.data.length} liabilities`);

  // Create a new test liability
  console.log('\n--- Creating test liability ---');
  const createResult = await createLiability(prisma, user.id, derivedKey, {
    name: 'Integration Test 车贷',
    category: 'car_loan',
    principal: '300000',
    interestRate: '0.035',
    termMonths: 60,
    startDate: '2025-01-01',
    paymentMethod: 'equal_interest',
  });
  if (!createResult.success) { console.log('FAIL: createLiability failed'); process.exit(1); }
  console.log('  Created:', createResult.data.name, '(id:', createResult.data.id.slice(0, 8) + '...)');

  // Read again - should now include new one
  console.log('\n--- After creation ---');
  const afterCreate = await getLiabilities(prisma, user.id, derivedKey);
  if (!afterCreate.success) { console.log('FAIL: getLiabilities after create failed'); process.exit(1); }
  for (const l of afterCreate.data) {
    console.log(`  ${l.name}: principal=¥${l.principal}, balance=¥${l.currentBalance}`);
  }
  console.log(`  Total: ${afterCreate.data.length} liabilities`);

  // Verify
  if (afterCreate.data.length !== existing.data.length + 1) {
    console.log(`\nFAIL: Expected ${existing.data.length + 1} liabilities, got ${afterCreate.data.length}`);
    process.exit(1);
  }

  const newLiability = afterCreate.data.find((l: any) => l.name === 'Integration Test 车贷');
  if (!newLiability) { console.log('FAIL: New liability not found in results'); process.exit(1); }

  // Cleanup
  console.log('\n--- Cleanup ---');
  await prisma.liability.delete({ where: { id: createResult.data.id } });
  console.log('  Test liability removed');

  // Verify cleanup
  const afterCleanup = await getLiabilities(prisma, user.id, derivedKey);
  if (afterCleanup.data.length !== existing.data.length) {
    console.log(`FAIL: After cleanup expected ${existing.data.length}, got ${afterCleanup.data.length}`);
    process.exit(1);
  }
  console.log('  Cleanup verified');

  await prisma.$disconnect();
  console.log('\n=== ALL INTEGRATION TESTS PASSED ===');
  console.log('✅ Create → Read → Decrypt → Verify → Cleanup : all working');
}

main().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
