import { Controller, Get, Post, Body, Query, UseGuards, Request, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(ForecastController.name);

  constructor(
    private service: ForecastService,
    @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
    private encryptionService: EncryptionService,
  ) {}

  @Get('wacr') async getWACR(@Request() req: any) {
    try {
      const liabilities = await this.liabilityRepo.find({ where: { userId: req.user.userId } });

      if (liabilities.length === 0) {
        return { wacr: 0, message: 'No liabilities found' };
      }

      const mapped = liabilities.map((l) => {
        const balanceStr = (l.isEncrypted
          ? this.encryptionService.decrypt(l.currentBalance.slice(4))
          : l.currentBalance) || '0';
        return {
          balance: new Decimal(balanceStr),
          rate: new Decimal(l.interestRate),
        };
      });
      const result = this.service.calculateWACR(mapped);
      return { wacr: result.toNumber(), liabilityCount: liabilities.length };
    } catch (error: any) {
      this.logger.error(`WACR calculation failed: ${error.message}`, error.stack);
      return { wacr: 0, error: 'Failed to calculate WACR', message: error.message };
    }
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
