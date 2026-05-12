import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForecastService } from './forecast.service';
import { Liability } from '../liabilities/liabilities.entity';
import { EncryptionService } from '../encryption/encryption.service';
import Decimal from 'decimal.js';

@Controller('forecast')
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(
    private service: ForecastService,
    @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
    private encryptionService: EncryptionService,
  ) {}

  @Get('wacr') async getWACR(@Request() req: any) {
    const liabilities = await this.liabilityRepo.find({ where: { userId: req.user.userId } });
    const mapped = liabilities.map((l) => ({
      balance: new Decimal(l.isEncrypted ? this.encryptionService.decrypt(l.currentBalance.slice(4)) : l.currentBalance || '0'),
      rate: new Decimal(l.interestRate),
    }));
    const result = this.service.calculateWACR(mapped);
    return { wacr: result.toNumber() };
  }

  @Post('cashflow') async simulateCashflow(@Request() req: any, @Body() dto: any) {
    return this.service.simulateCashflow({
      monthlyIncome: new Decimal(dto.monthlyIncome || 0),
      monthlyExpense: new Decimal(dto.monthlyExpense || 0),
      months: dto.months || 12,
      incomeAdjustment: dto.incomeAdjustment,
      oneOffExpenses: (dto.oneOffExpenses || []).map((e: any) => ({ month: e.month, amount: new Decimal(e.amount) })),
    });
  }
}
