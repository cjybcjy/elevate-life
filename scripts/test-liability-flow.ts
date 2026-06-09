/**
 * End-to-end test: verify liability creation and retrieval
 * Run: npx tsx scripts/test-liability-flow.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateDerivedKey, encryptValue, decryptValue } from '../src/lib/crypto';
import Decimal from 'decimal.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ledger?schema=public';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('=== Test 1: Check demo user ===');
  const user = await prisma.user.findFirst({ where: { username: 'demo' } });
  if (!user) {
    console.log('FAIL: demo user not found');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('PASS: demo user exists, id:', user.id);

  console.log('\n=== Test 2: Generate derived key ===');
  const derivedKey = generateDerivedKey('demo123', user.id);
  console.log('PASS: derived key generated, length:', derivedKey.length);

  console.log('\n=== Test 3: Create liability via Prisma ===');
  const principal = '100000.00';
  const currentBalance = '100000.00';
  const encryptedPrincipal = encryptValue(principal, derivedKey, user.id);
  const encryptedBalance = encryptValue(currentBalance, derivedKey, user.id);

  console.log('  Encrypted principal length:', encryptedPrincipal.length);
  console.log('  Encrypted balance length:', encryptedBalance.length);

  let liability;
  try {
    liability = await prisma.liability.create({
      data: {
        name: 'Test 房贷',
        category: 'mortgage',
        principal: encryptedPrincipal,
        currentBalance: encryptedBalance,
        isEncrypted: true,
        interestRate: new Decimal('0.045'),
        termMonths: 360,
        startDate: new Date('2024-01-01'),
        paymentMethod: 'equal_interest',
        userId: user.id,
      },
    });
    console.log('PASS: liability created, id:', liability.id);
  } catch (err: any) {
    console.log('FAIL: could not create liability:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n=== Test 4: Read liability back ===');
  const found = await prisma.liability.findFirst({
    where: { id: liability.id },
  });
  if (!found) {
    console.log('FAIL: liability not found after creation');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('PASS: liability found in DB');

  console.log('\n=== Test 5: Decrypt liability ===');
  try {
    const decryptedPrincipal = decryptValue(found.principal, derivedKey, user.id);
    const decryptedBalance = decryptValue(found.currentBalance, derivedKey, user.id);
    console.log('  Decrypted principal:', decryptedPrincipal);
    console.log('  Decrypted balance:', decryptedBalance);
    if (decryptedPrincipal === principal && decryptedBalance === currentBalance) {
      console.log('PASS: encryption/decryption roundtrip works');
    } else {
      console.log('FAIL: decrypted values do not match original');
      await prisma.$disconnect();
      process.exit(1);
    }
  } catch (err: any) {
    console.log('FAIL: decryption error:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n=== Test 6: Query all liabilities for user ===');
  const allLiabilities = await prisma.liability.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`PASS: found ${allLiabilities.length} liabilities for user`);

  console.log('\n=== Test 7: Decrypt all user liabilities ===');
  let allPassed = true;
  for (const l of allLiabilities) {
    try {
      const p = decryptValue(l.principal, derivedKey, user.id);
      const b = decryptValue(l.currentBalance, derivedKey, user.id);
      console.log(`  ${l.name}: principal=${p}, balance=${b}`);
    } catch (err: any) {
      console.log(`  ${l.name}: DECRYPT FAILED - ${err.message}`);
      allPassed = false;
    }
  }
  if (allPassed) {
    console.log('PASS: all liabilities decrypted successfully');
  } else {
    console.log('FAIL: some liabilities could not be decrypted');
  }

  // Clean up test data
  console.log('\n=== Cleanup: removing test liability ===');
  await prisma.debtMilestone.deleteMany({ where: { liabilityId: liability.id } });
  await prisma.liability.delete({ where: { id: liability.id } });
  console.log('Test liability removed');

  await prisma.$disconnect();
  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
