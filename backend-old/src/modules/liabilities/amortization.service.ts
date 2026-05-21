import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

export interface Milestone {
  monthIndex: number;
  principalDue: Decimal;
  interestDue: Decimal;
  totalDue: Decimal;
  remainingBalance: Decimal;
}

@Injectable()
export class AmortizationService {
  generateEqualInterestSchedule(principal: Decimal, annualRate: Decimal, months: number): Milestone[] {
    const monthlyRate = annualRate.div(12);
    const pow = Decimal.pow(monthlyRate.plus(1), months);
    const monthlyPayment = principal.mul(monthlyRate).mul(pow).div(pow.minus(1));
    const schedule: Milestone[] = [];
    let remaining = principal;
    for (let i = 1; i <= months; i++) {
      const interestDue = remaining.mul(monthlyRate);
      const principalDue = monthlyPayment.minus(interestDue);
      remaining = remaining.minus(principalDue);
      schedule.push({ monthIndex: i, principalDue, interestDue, totalDue: monthlyPayment, remainingBalance: remaining });
    }
    return schedule;
  }

  generateEqualPrincipalSchedule(principal: Decimal, annualRate: Decimal, months: number): Milestone[] {
    const monthlyRate = annualRate.div(12);
    const monthlyPrincipal = principal.div(months);
    const schedule: Milestone[] = [];
    let remaining = principal;
    for (let i = 1; i <= months; i++) {
      const interestDue = remaining.mul(monthlyRate);
      const totalDue = monthlyPrincipal.plus(interestDue);
      remaining = remaining.minus(monthlyPrincipal);
      schedule.push({ monthIndex: i, principalDue: monthlyPrincipal, interestDue, totalDue, remainingBalance: remaining });
    }
    return schedule;
  }
}
