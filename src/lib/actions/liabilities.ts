'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';

function generateSchedule(
  principal: Decimal,
  annualRate: Decimal,
  months: number,
  paymentMethod: string,
  startDate: Date,
) {
  const schedule: any[] = [];

  if (paymentMethod === 'equal_interest') {
    const monthlyRate = annualRate.div(12);
    const pow = Decimal.pow(monthlyRate.plus(1), months);
    const monthlyPayment = principal.mul(monthlyRate).mul(pow).div(pow.minus(1));
    let remaining = principal;
    for (let i = 1; i <= months; i++) {
      const interestDue = remaining.mul(monthlyRate);
      const principalDue = monthlyPayment.minus(interestDue);
      remaining = remaining.minus(principalDue);
      schedule.push({
        monthIndex: i,
        principalDue: principalDue.toFixed(4),
        interestDue: interestDue.toFixed(4),
        totalDue: monthlyPayment.toFixed(4),
        remainingBalance: remaining.toFixed(4),
      });
    }
  } else {
    const monthlyRate = annualRate.div(12);
    const monthlyPrincipal = principal.div(months);
    let remaining = principal;
    for (let i = 1; i <= months; i++) {
      const interestDue = remaining.mul(monthlyRate);
      const totalDue = monthlyPrincipal.plus(interestDue);
      remaining = remaining.minus(monthlyPrincipal);
      schedule.push({
        monthIndex: i,
        principalDue: monthlyPrincipal.toFixed(4),
        interestDue: interestDue.toFixed(4),
        totalDue: totalDue.toFixed(4),
        remainingBalance: remaining.toFixed(4),
      });
    }
  }

  return schedule.slice(0, 12).map((s) => {
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + s.monthIndex, 1);
    return { ...s, dueDate };
  });
}

export async function getLiabilities() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const liabilities = await prisma.liability.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const decrypted = liabilities.map((l) => ({
    id: l.id,
    userId: l.userId,
    name: l.name,
    category: l.category,
    principal: decryptValue(l.principal, derivedKey, userId),
    currentBalance: decryptValue(l.currentBalance, derivedKey, userId),
    interestRate: l.interestRate.toNumber(),
    termMonths: l.termMonths,
    startDate: l.startDate,
    paymentMethod: l.paymentMethod,
    monthlyPayment: l.monthlyPayment ? decryptValue(l.monthlyPayment, derivedKey, userId) : null,
    isEncrypted: l.isEncrypted,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));

  return { success: true, data: decrypted };
}

export async function createLiability(data: {
  name: string;
  category: string;
  principal: string;
  currentBalance?: string;
  interestRate: string;
  termMonths: number;
  startDate: string;
  paymentMethod: string;
  monthlyPayment?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    const principalStr = new Decimal(data.principal).toFixed(4);
    const balanceStr = new Decimal(data.currentBalance || data.principal).toFixed(4);
    const encryptedPrincipal = encryptValue(principalStr, derivedKey, userId);
    const encryptedBalance = encryptValue(balanceStr, derivedKey, userId);
    const encryptedMonthlyPayment = data.monthlyPayment
      ? encryptValue(new Decimal(data.monthlyPayment).toFixed(4), derivedKey, userId)
      : null;

    const liability = await prisma.liability.create({
      data: {
        name: data.name,
        category: data.category,
        principal: encryptedPrincipal,
        currentBalance: encryptedBalance,
        monthlyPayment: encryptedMonthlyPayment,
        isEncrypted: true,
        interestRate: new Decimal(data.interestRate),
        termMonths: data.termMonths,
        startDate: new Date(data.startDate),
        paymentMethod: data.paymentMethod,
        userId,
      },
    });

    const schedule = generateSchedule(
      new Decimal(principalStr),
      new Decimal(data.interestRate),
      data.termMonths,
      data.paymentMethod,
      new Date(data.startDate),
    );

    await prisma.debtMilestone.createMany({
      data: schedule.map((s) => ({
        liabilityId: liability.id,
        monthIndex: s.monthIndex,
        dueDate: s.dueDate,
        principalDue: new Decimal(s.principalDue),
        interestDue: new Decimal(s.interestDue),
        totalDue: new Decimal(s.totalDue),
        remainingBalance: new Decimal(s.remainingBalance),
      })),
    });

    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        id: liability.id,
        userId: liability.userId,
        name: liability.name,
        category: liability.category,
        principal: data.principal,
        currentBalance: data.currentBalance || data.principal,
        interestRate: liability.interestRate.toNumber(),
        termMonths: liability.termMonths,
        startDate: liability.startDate,
        paymentMethod: liability.paymentMethod,
        monthlyPayment: data.monthlyPayment || null,
        isEncrypted: liability.isEncrypted,
        createdAt: liability.createdAt,
        updatedAt: liability.updatedAt,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateLiability(
  id: string,
  data: Partial<{
    name: string;
    category: string;
    principal: string;
    currentBalance: string;
    interestRate: string;
    termMonths: number;
    startDate: string;
    paymentMethod: string;
    monthlyPayment: string;
  }>
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.termMonths !== undefined) updateData.termMonths = data.termMonths;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.interestRate !== undefined) updateData.interestRate = new Decimal(data.interestRate);
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);

    if (data.principal !== undefined) {
      updateData.principal = encryptValue(new Decimal(data.principal).toFixed(4), derivedKey, userId);
      updateData.isEncrypted = true;
    }
    if (data.currentBalance !== undefined) {
      updateData.currentBalance = encryptValue(new Decimal(data.currentBalance).toFixed(4), derivedKey, userId);
      updateData.isEncrypted = true;
    }
    if (data.monthlyPayment !== undefined) {
      updateData.monthlyPayment = encryptValue(new Decimal(data.monthlyPayment).toFixed(4), derivedKey, userId);
      updateData.isEncrypted = true;
    }

    const liability = await prisma.liability.update({
      where: { id, userId },
      data: updateData,
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: { ...liability, interestRate: liability.interestRate.toNumber() } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteLiability(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.debtMilestone.deleteMany({ where: { liabilityId: id } });
    await prisma.liability.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
