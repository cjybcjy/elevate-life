'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { decryptValue } from '@/lib/crypto';
import Decimal from 'decimal.js';
import { isRevolvingCredit } from '@/lib/liability-transactions';

export interface RepaymentSimResult {
  scenario: 'reduce_term' | 'reduce_payment';
  label: string;
  originalTotalInterest: number;
  newTotalInterest: number;
  interestSaved: number;
  originalPayoffDate: string;
  newPayoffDate: string;
  monthsShaved: number;
  newMonthlyPayment?: number;
  originalMonthlyPayment: number;
}

export async function simulateEarlyRepayment(
  liabilityId: string,
  extraAmount: string,
  _extraMonth: number,
): Promise<{ success: boolean; data?: RepaymentSimResult[]; error?: string }> {
  void _extraMonth;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const liability = await prisma.liability.findFirst({
    where: { id: liabilityId, userId },
  });

  if (!liability) return { success: false, error: 'Liability not found' };
  if (isRevolvingCredit(liability.paymentMethod)) {
    return { success: false, error: '循环贷余额会随借还变化，不能使用固定还款计划模拟' };
  }

  const currentBalance = new Decimal(decryptValue(liability.currentBalance, derivedKey, userId));
  const annualRate = liability.interestRate;
  const monthlyRate = annualRate.div(12);
  const totalMonths = liability.termMonths;
  const startDate = new Date(liability.startDate);

  // Calculate elapsed months and remaining months
  const now = new Date();
  const elapsedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  const remainingMonths = totalMonths - elapsedMonths;

  // Only simulate on remaining balance if payment hasn't been made yet
  const extra = new Decimal(extraAmount);

  // Compute original schedule
  let originalMonthlyPayment: Decimal;
  let originalTotalInterest = new Decimal(0);

  if (liability.paymentMethod === 'equal_interest') {
    const pow = Decimal.pow(monthlyRate.plus(1), remainingMonths);
    originalMonthlyPayment = currentBalance.mul(monthlyRate).mul(pow).div(pow.minus(1));

    let remaining = currentBalance;
    for (let i = 1; i <= remainingMonths; i++) {
      const interest = remaining.mul(monthlyRate);
      originalTotalInterest = originalTotalInterest.plus(interest);
      const principalPaid = originalMonthlyPayment.minus(interest);
      remaining = remaining.minus(principalPaid);
    }
  } else {
    // equal_principal
    const monthlyPrincipal = currentBalance.div(remainingMonths);
    originalMonthlyPayment = monthlyPrincipal.plus(currentBalance.mul(monthlyRate));

    let remaining = currentBalance;
    for (let i = 1; i <= remainingMonths; i++) {
      const interest = remaining.mul(monthlyRate);
      originalTotalInterest = originalTotalInterest.plus(interest);
      remaining = remaining.minus(monthlyPrincipal);
    }
  }

  const originalPayoffDate = new Date(now.getFullYear(), now.getMonth() + remainingMonths, 1);

  const results: RepaymentSimResult[] = [
    // Scenario A: Reduce Term (keep same monthly payment)
    (() => {
      let balance = currentBalance.minus(extra);
      let totalInterest = new Decimal(0);
      let months = 0;
      while (balance.gt(0) && months < totalMonths * 2) {
        months++;
        const interest = balance.mul(monthlyRate);
        totalInterest = totalInterest.plus(interest);
        const principalPaid = originalMonthlyPayment.minus(interest);
        balance = balance.minus(principalPaid);
      }
      const newPayoffDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
      return {
        scenario: 'reduce_term' as const,
        label: '减少期数（月供不变）',
        originalTotalInterest: originalTotalInterest.toNumber(),
        newTotalInterest: totalInterest.toNumber(),
        interestSaved: originalTotalInterest.minus(totalInterest).toNumber(),
        originalPayoffDate: originalPayoffDate.toISOString().split('T')[0],
        newPayoffDate: newPayoffDate.toISOString().split('T')[0],
        monthsShaved: remainingMonths - months,
        originalMonthlyPayment: originalMonthlyPayment.toNumber(),
      };
    })(),

    // Scenario B: Reduce Payment (keep same term)
    (() => {
      const newBalance = currentBalance.minus(extra);
      let newMonthlyPayment: Decimal;
      let totalInterest = new Decimal(0);

      if (liability.paymentMethod === 'equal_interest') {
        const pow = Decimal.pow(monthlyRate.plus(1), remainingMonths);
        newMonthlyPayment = newBalance.mul(monthlyRate).mul(pow).div(pow.minus(1));

        let remaining = newBalance;
        for (let i = 1; i <= remainingMonths; i++) {
          const interest = remaining.mul(monthlyRate);
          totalInterest = totalInterest.plus(interest);
          remaining = remaining.minus(newMonthlyPayment.minus(interest));
        }
      } else {
        const monthlyPrincipal = newBalance.div(remainingMonths);
        newMonthlyPayment = monthlyPrincipal.plus(newBalance.mul(monthlyRate));

        let remaining = newBalance;
        for (let i = 1; i <= remainingMonths; i++) {
          const interest = remaining.mul(monthlyRate);
          totalInterest = totalInterest.plus(interest);
          remaining = remaining.minus(monthlyPrincipal);
        }
      }

      return {
        scenario: 'reduce_payment' as const,
        label: '减少月供（期数不变）',
        originalTotalInterest: originalTotalInterest.toNumber(),
        newTotalInterest: totalInterest.toNumber(),
        interestSaved: originalTotalInterest.minus(totalInterest).toNumber(),
        originalPayoffDate: originalPayoffDate.toISOString().split('T')[0],
        newPayoffDate: originalPayoffDate.toISOString().split('T')[0],
        monthsShaved: 0,
        newMonthlyPayment: newMonthlyPayment.toNumber(),
        originalMonthlyPayment: originalMonthlyPayment.toNumber(),
      };
    })(),
  ];

  return { success: true, data: results };
}
